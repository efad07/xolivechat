import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, collection, query, where, limit, getDocs, deleteDoc, increment, orderBy, addDoc, getDoc } from 'firebase/firestore';
import { ref, get, set, remove, onValue, off } from 'firebase/database';
import { db, rtdb, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import AdBanner from './AdBanner';
import { checkWin, getWinLength } from '../lib/gameLogic';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { Helmet } from 'react-helmet-async';
import TicTacToe from './TicTacToe';

import useVideoCall from '../hooks/useVideoCall';
import { findMatch as findRealtimeMatch } from '../lib/firebaseMatchmaking';

const Chat = lazy(() => import('./Chat'));
const VideoCall = lazy(() => import('./VideoCall'));

export default function GameRoom() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [processedGame, setProcessedGame] = useState(false);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);

  const isIdle = !paramRoomId;
  const [boardSize, setBoardSize] = useState<number>(3);

  // WEBRTC PEER STATES
  const [myPeerId, setMyPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState<string | null>(null);
  
  // NEW FIREBASE MATCHMAKING / WEBRTC STATE
  const [videoRoomId, setVideoRoomId] = useState<string | null>(null);
  const { localVideo, remoteVideo } = useVideoCall(videoRoomId);
  const videoMatchCleanup = useRef<(() => void) | null>(null);

  // STRICT MODE STATE
  const [gameMode, setGameMode] = useState<"normal" | "random" | "ai">("normal");
  const [roomIdInput, setRoomIdInput] = useState("");

  const [localGame, setLocalGame] = useState({
    active: false,
    board: Array(boardSize * boardSize).fill(''),
    currentTurn: 'X',
    winner: '',
    status: 'playing',
    size: boardSize
  });

  const roomRefState = useRef<any>(null);
  useEffect(() => {
    roomRefState.current = room;
  }, [room]);

  useEffect(() => {
    return () => {
      const currentRoom = roomRefState.current;
      if (paramRoomId && currentRoom && user && (currentRoom.hostId === user.uid || currentRoom.guestId === user.uid) && currentRoom.status === 'playing') {
        updateDoc(doc(db, 'rooms', paramRoomId), { status: 'abandoned' }).catch(console.error);
      }
      if (myPeerId) {
        remove(ref(rtdb, `waitingUsers/${myPeerId}`)).catch(console.error);
        off(ref(rtdb, `matches/${myPeerId}`));
      }
    };
  }, [paramRoomId, user, myPeerId]);

  useEffect(() => {
    if (!user || isIdle) {
      setRoom(null);
      return;
    }
    
    const roomRef = doc(db, 'rooms', paramRoomId);
    
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoom({ id: docSnap.id, ...data });

        // Assign targetPeerId if we are the guest joining the host
        if (data.hostPeerId && data.hostId !== user.uid) {
           setTargetPeerId(data.hostPeerId);
        }

        // Auto-join as guest if not host and no guest
        if (data.hostId !== user.uid && !data.guestId && data.status !== 'abandoned') {
          try {
            await updateDoc(roomRef, {
              guestId: user.uid,
              guestPeerId: myPeerId, // Provide guest PeerJS
              status: 'playing'
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `rooms/${paramRoomId}`);
          }
        }
      } else {
        // Room doesn't exist, go back to lobby
        navigate('/');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${paramRoomId}`);
    });

    return () => unsubscribe();
  }, [paramRoomId, user, isIdle, navigate, myPeerId]);

  // Matchmaking Listener
  useEffect(() => {
    // STRICT MODE SEPARATION: DO NOT connect to Firebase queue in normal mode
    if (gameMode === "normal" || !isSearching || !user) return;
    
    // Always clean listener
    const unsub = onSnapshot(doc(db, 'queue', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'matched' && data.channel) {
          setIsSearching(false);
          // Remove user from queue on exit
          deleteDoc(doc(db, 'queue', user.uid)).catch(console.error);
          navigate(`/room/${data.channel}`);
        }
      }
    });
    
    return () => {
      unsub();
      if (isSearching) {
         deleteDoc(doc(db, 'queue', user.uid)).catch(console.error);
      }
    };
  }, [isSearching, user, navigate]);

  // Leaderboard Listener
  useEffect(() => {
    if (!isIdle) return;
    
    const q = query(
      collection(db, 'players'),
      orderBy('totalWins', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let players: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.totalGames > 0) {
          players.push({
            id: doc.id,
            name: data.name || data.displayName || 'Anonymous',
            photoURL: data.photoURL,
            totalWins: data.totalWins || 0,
            totalGames: data.totalGames || 0,
            winRate: data.totalGames ? ((data.totalWins || 0) / data.totalGames) * 100 : 0
          });
        }
      });
      
      players.sort((a, b) => {
        if (b.totalWins !== a.totalWins) {
          return b.totalWins - a.totalWins;
        }
        return b.winRate - a.winRate;
      });
      
      setTopPlayers(players.slice(0, 10));
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
    });
    
    return () => unsubscribe();
  }, [isIdle]);

    const createNormalRoom = async () => {
      if (!user) {
        alert("Please sign in to play!");
        return;
      }
      try {
        console.log("Creating room...");

        const docRef = await addDoc(collection(db, "normalRooms"), {
          hostId: user.uid,
          createdAt: Date.now()
        });

        console.log("Room created with ID:", docRef.id);
        alert("Room Code: " + docRef.id);

        // Pre-create the TicTacToe board so they can play
        await setDoc(doc(db, 'rooms', docRef.id), {
          hostId: user.uid,
          hostPeerId: myPeerId, // Provide host PeerJS
          guestId: null,
          status: 'waiting',
          board: Array(boardSize * boardSize).fill(''),
          currentTurn: 'X',
          winner: '',
          size: boardSize,
          mode: 'normal',
          createdAt: serverTimestamp()
        });

        navigate(`/room/${docRef.id}`);

      } catch (err) {
        console.error(err);
        alert("Error creating room");
      }
    };

    const joinNormalRoom = async () => {
      if (!roomIdInput) {
        alert("Enter room code");
        return;
      }
      const id = roomIdInput;
      try {
        const roomRef = doc(db, "normalRooms", id);
        const snap = await getDoc(roomRef);

        if (!snap.exists()) {
          alert("Room not found");
          return;
        }

        navigate(`/room/${id}`);

      } catch (err) {
        console.error(err);
        alert("Error joining room");
      }
    };

  const findMatch = async () => {
    if (!user) {
      alert("Please sign in to play!");
      return;
    }
    setGameMode("random");
    setIsSearching(true);
    console.log("Searching opponent via RTDB...");

    try {
      const waitingRef = ref(rtdb, "waitingUsers");
      const snapshot = await get(waitingRef);

      if (snapshot.exists()) {
        const users = snapshot.val();
        const firstKey = Object.keys(users).find(key => users[key] !== myPeerId);

        if (firstKey) {
          const otherPeer = users[firstKey];
          await remove(ref(rtdb, `waitingUsers/${firstKey}`));

          // Create the game room
          const roomsRef = collection(db, "videoRooms");
          const newRoom = await addDoc(roomsRef, {
            status: "playing",
            createdAt: serverTimestamp()
          });

          await setDoc(doc(db, 'rooms', newRoom.id), {
            hostId: 'host-placeholder',
            guestId: user.uid,
            hostPeerId: otherPeer,
            guestPeerId: myPeerId,
            status: 'playing',
            board: Array(boardSize * boardSize).fill(''),
            currentTurn: 'X',
            winner: '',
            size: boardSize,
            mode: 'random',
            createdAt: serverTimestamp()
          });

          await set(ref(rtdb, `matches/${firstKey}`), {
            roomId: newRoom.id,
            peer1: otherPeer,
            peer2: myPeerId
          });

          setIsSearching(false);
          navigate(`/room/${newRoom.id}`);
          return;
        }
      }

      // Add self to waiting pool
      await set(ref(rtdb, `waitingUsers/${myPeerId}`), myPeerId);

      onValue(ref(rtdb, `matches/${myPeerId}`), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          off(ref(rtdb, `matches/${myPeerId}`));
          setIsSearching(false);
          
          // Claim hostId
          setDoc(doc(db, 'rooms', data.roomId), { hostId: user.uid }, { merge: true });
          
          navigate(`/room/${data.roomId}`);
        }
      });
    } catch (err) {
      console.error(err);
      setIsSearching(false);
      alert("Matchmaking error");
    }
  };

  const cancelSearch = () => {
    setIsSearching(false);
    if (myPeerId) {
      remove(ref(rtdb, `waitingUsers/${myPeerId}`)).catch(console.error);
    }
  };

  const startAIGame = () => {
    setGameMode("ai");
    setLocalGame({
      active: true,
      board: Array(boardSize * boardSize).fill(''),
      currentTurn: 'X',
      winner: '',
      status: 'playing',
      size: boardSize
    });
  };

  const switchPlayer = async () => {
    if (paramRoomId && room) {
      try {
        await updateDoc(doc(db, 'rooms', paramRoomId), { status: 'abandoned' });
        if (user) await deleteDoc(doc(db, 'queue', user.uid));
      } catch (e) {
        console.error(e);
      }
    }
    navigate('/');
    findMatch();
  };

  // Clean up when switching modes
  useEffect(() => {
    if (gameMode === 'normal' || gameMode === 'ai') {
      if (isSearching) {
        setIsSearching(false);
        if (user) {
           deleteDoc(doc(db, 'queue', user.uid)).catch(console.error);
        }
      }
    }
  }, [gameMode, isSearching, user]);

  // AI Logic Execution
  useEffect(() => {
    if (gameMode === 'ai' && localGame.active && localGame.status === 'playing' && localGame.currentTurn === 'O') {
      const timer = setTimeout(() => {
        const emptyIndices = localGame.board.map((val, idx) => val === '' ? idx : -1).filter(idx => idx !== -1);
        if (emptyIndices.length > 0) {
          // Simple AI: Random empty cell
          const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          
          const newBoard = [...localGame.board];
          newBoard[randomIdx] = 'O';

          let newWinner = '';
          let newStatus = 'playing';
          
          const winResult = checkWin(newBoard, localGame.size, getWinLength(localGame.size));
          if (winResult) {
            newWinner = winResult.player;
            newStatus = 'finished';
            if (winResult.player !== 'Draw') {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#f72585', '#b5179e']
              });
            }
          }
          
          setLocalGame(prev => ({
            ...prev,
            board: newBoard,
            currentTurn: 'X',
            winner: newWinner,
            status: newStatus
          }));
        }
      }, 600); // 600ms artificial thinking delay

      return () => clearTimeout(timer);
    }
  }, [gameMode, localGame]);

  const activeRoom = localGame.active ? {
    size: localGame.size,
    board: localGame.board,
    status: localGame.status,
    currentTurn: localGame.currentTurn,
    winner: localGame.winner,
    hostId: user ? user.uid : 'local1',
    guestId: 'local2',
    mode: gameMode
  } : (room || {
    size: boardSize,
    board: Array(boardSize * boardSize).fill(''),
    status: isIdle ? 'idle' : 'waiting',
    currentTurn: 'X',
    winner: '',
    hostId: '',
    guestId: '',
    mode: gameMode
  });

  const handleCellClick = async (index: number) => {
    if (localGame.active) {
      if (localGame.board[index] !== '' || localGame.status !== 'playing' || localGame.winner) return;
      if (gameMode === 'ai' && localGame.currentTurn === 'O') return; // Prevent user click during AI turn
      
      const newBoard = [...localGame.board];
      newBoard[index] = localGame.currentTurn;
      
      let newWinner = '';
      let newStatus = 'playing';
      
      const winResult = checkWin(newBoard, localGame.size, getWinLength(localGame.size));
      if (winResult) {
        newWinner = winResult.player;
        newStatus = 'finished';
        if (winResult.player !== 'Draw') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: winResult.player === 'X' ? ['#4361ee', '#3f37c9'] : ['#f72585', '#b5179e']
          });
        }
      }
      
      setLocalGame(prev => ({
        ...prev,
        board: newBoard,
        currentTurn: prev.currentTurn === 'X' ? 'O' : 'X',
        winner: newWinner,
        status: newStatus
      }));
      return;
    }

    if (!user) {
      alert("Please sign in to play!");
      return;
    }
    if (!room || room.status !== 'playing' || room.winner) return;
    
    const isHost = room.hostId === user.uid;
    const isGuest = room.guestId === user.uid;
    
    if (!isHost && !isGuest) return; // Spectators cannot play
    if ((isHost && room.currentTurn !== 'X') || (isGuest && room.currentTurn !== 'O')) return;
    if (room.board[index] !== '') return;

    const newBoard = [...room.board];
    const mySymbol = isHost ? 'X' : 'O';
    newBoard[index] = mySymbol;

    const winLength = getWinLength(room.size);
    const winResult = checkWin(newBoard, room.size, winLength);
    
    let newWinner = '';
    let newStatus = room.status;

    if (winResult) {
      newWinner = winResult.player;
      newStatus = 'finished';
      if (winResult.player !== 'Draw') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: winResult.player === 'X' ? ['#4361ee', '#3f37c9'] : ['#f72585', '#b5179e']
        });
      }
    }

    try {
      await updateDoc(doc(db, 'rooms', paramRoomId!), {
        board: newBoard,
        currentTurn: room.currentTurn === 'X' ? 'O' : 'X',
        winner: newWinner,
        status: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${paramRoomId}`);
    }
  };

  const resetGame = async () => {
    if (localGame.active) {
      setLocalGame(prev => ({
        ...prev,
        board: Array(prev.size * prev.size).fill(''),
        currentTurn: 'X',
        winner: '',
        status: 'playing'
      }));
      return;
    }

    if (!room || !paramRoomId || !user) return;
    try {
      await updateDoc(doc(db, 'rooms', paramRoomId), {
        board: Array(room.size * room.size).fill(''),
        currentTurn: 'X',
        winner: '',
        status: 'playing'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${paramRoomId}`);
    }
  };

  const isHost = localGame.active ? true : (user ? activeRoom.hostId === user.uid : false);
  const isGuest = localGame.active ? false : (user ? activeRoom.guestId === user.uid : false);
  const isSpectator = user && !isHost && !isGuest && !isIdle;
  const mySymbol = localGame.active ? (gameMode === 'ai' ? 'X' : activeRoom.currentTurn) : (isHost ? 'X' : (isGuest ? 'O' : ''));
  const isMyTurn = localGame.active ? (gameMode === 'ai' ? localGame.currentTurn === 'X' : true) : (mySymbol !== '' && activeRoom.currentTurn === mySymbol);

  useEffect(() => {
    if (activeRoom.status === 'playing') {
      setProcessedGame(false);
    } else if (activeRoom.status === 'finished' && user && !isSpectator && !processedGame) {
      setProcessedGame(true);
      
      const isWin = activeRoom.winner === mySymbol;
      const isDraw = activeRoom.winner === 'Draw';
      const isLoss = !isWin && !isDraw;

      const userRef = doc(db, 'players', user.uid);
      setDoc(userRef, {
        totalGames: increment(1),
        totalWins: increment(isWin ? 1 : 0),
        totalLosses: increment(isLoss ? 1 : 0),
        totalDraws: increment(isDraw ? 1 : 0)
      }, { merge: true }).catch(console.error);
    }
  }, [activeRoom.status, activeRoom.winner, user, isSpectator, mySymbol, processedGame]);

  if (isIdle && !localGame.active) {
    return (
      <div className="w-full h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-slate-950 text-white overflow-hidden">
        <Helmet>
          <title>QuickConnect | Random Video Chat & Play</title>
          <meta property="og:title" content="QuickConnect | Random Video Chat & Play" />
        </Helmet>

        {/* 🎮 LEFT SIDE - GAME (75%) */}
        <div className="w-full lg:w-[75%] h-full relative flex flex-col items-center justify-center p-4">
          
          {/* 🔝 QUICKCONNECT (COMPACT) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-3 bg-black/70 px-4 py-2 sm:py-3 rounded-xl backdrop-blur-md pointer-events-auto shadow-xl border border-slate-700/50 w-[95%] sm:w-auto overflow-x-auto whitespace-nowrap hide-scrollbar">
            {user ? (
              <>
                <button onClick={createNormalRoom} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 sm:px-4 py-1.5 rounded transition shadow">
                  Create Room
                </button>
                
                <div className="flex items-center">
                  <input
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    placeholder="Code"
                    className="px-3 py-1.5 rounded-l bg-slate-900 border border-slate-700 text-white w-20 sm:w-24 uppercase focus:outline-none focus:border-cyan-500"
                  />
                  <button onClick={joinNormalRoom} className="bg-green-600 hover:bg-green-500 px-3 sm:px-4 py-1.5 rounded-r font-semibold transition shadow">
                    Join
                  </button>
                </div>

                <span className="text-gray-500 mx-1 hidden sm:inline">|</span>

                <button 
                  onClick={async () => {
                     if (!user) return alert("Sign in first!");
                     setIsSearching(true);
                     const cleanup = await findRealtimeMatch(user.uid, (rid) => {
                        setVideoRoomId(rid);
                        setIsSearching(false);
                     });
                     videoMatchCleanup.current = cleanup;
                  }} 
                  disabled={isSearching}
                  className="bg-red-600 hover:bg-red-500 px-3 sm:px-4 py-1.5 rounded font-bold transition flex items-center gap-2 disabled:opacity-50 shadow"
                >
                  {isSearching ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching...</>
                  ) : (
                    <>Random 🎥</>
                  )}
                </button>
                {isSearching && (
                  <button onClick={() => {
                     setIsSearching(false);
                     if (videoMatchCleanup.current) {
                        videoMatchCleanup.current();
                        videoMatchCleanup.current = null;
                     }
                  }} className="text-slate-300 hover:text-white text-xs ml-1 hover:underline">Cancel</button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 px-2 text-sm sm:text-base">
                <Users size={18} className="text-slate-400" />
                <span className="font-medium whitespace-normal text-center w-full">Sign in to match and play online</span>
              </div>
            )}
          </div>

          {/* 🎮 BIG GAME CENTER */}
          <div className="bg-black/80 backdrop-blur-xl p-8 sm:p-12 mt-16 rounded-3xl shadow-2xl pointer-events-auto border border-slate-800/50">
            {/* 🔥 BIG GRID CONTROL */}
            <div className="scale-[1.1] sm:scale-125 md:scale-150 origin-center transition-transform">
              <TicTacToe />
            </div>
          </div>
        </div>

        {/* 🎥 RIGHT SIDE - VIDEO (25%) */}
        <div className="w-full lg:w-[25%] h-[40vh] lg:h-full flex flex-col gap-2 p-2 border-t lg:border-t-0 lg:border-l border-slate-800 bg-black z-30 shadow-2xl relative">
          <div className="flex-1 relative flex flex-col gap-2 overflow-hidden">
             {/* Remote Video (Opponent) */}
             <div className="flex-1 w-full relative bg-slate-900 border border-slate-800 rounded shadow-lg overflow-hidden flex items-center justify-center">
                 <video
                    ref={remoteVideo}
                    autoPlay
                    playsInline
                    className="absolute w-full h-full object-cover"
                 />
                 {!videoRoomId && <span className="text-slate-500 text-sm z-10">Waiting for opponent...</span>}
             </div>

             {/* Local Video (You) */}
             <div className="h-1/3 min-h-[120px] w-full relative bg-slate-900 border border-slate-800 rounded shadow-lg overflow-hidden flex items-center justify-center">
                <video
                    ref={localVideo}
                    autoPlay
                    muted
                    playsInline
                    className="absolute w-full h-full object-cover"
                />
             </div>
          </div>

          {/* OPTIONAL CONTROLS */}
          <div className="p-3 flex items-center justify-center gap-4 bg-slate-950 mt-1 rounded border border-slate-800">
            <button className="bg-slate-800 hover:bg-slate-700 w-12 h-12 flex items-center justify-center rounded-full transition shadow text-xl">🎤</button>
            <button className="bg-slate-800 hover:bg-slate-700 w-12 h-12 flex items-center justify-center rounded-full transition shadow text-xl">📷</button>
            {videoRoomId && (
               <button 
                  onClick={() => {
                     setVideoRoomId(null);
                     if (videoMatchCleanup.current) {
                        videoMatchCleanup.current();
                        videoMatchCleanup.current = null;
                     }
                  }} 
                  className="bg-red-600 hover:bg-red-700 w-12 h-12 flex items-center justify-center rounded-full transition shadow text-white font-bold text-sm"
               >
                  End
               </button>
            )}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 flex flex-col">
      <Helmet>
        <title>{isIdle ? 'Play Tic Tac Toe Online | Chat, Video Call & Multiplayer | XoliveChat' : `Live Match | XoliveChat`}</title>
        <meta property="og:title" content={isIdle ? 'Play Tic Tac Toe Online | Chat, Video Call & Multiplayer | XoliveChat' : `Live Match | XoliveChat`} />
      </Helmet>

      <header className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-800 flex items-center gap-2">
            <Users size={18} className="text-cyan-400" />
            <span className="font-semibold text-slate-200">{isIdle ? 'Lobby' : 'Live Match'}</span>
          </div>
          {user && !isIdle && (
            <div className="bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-800 font-medium text-slate-300">
              {isSpectator ? (
                <span>Spectating</span>
              ) : (
                <>You are: <span className={cn("font-bold", isHost ? "text-cyan-400" : "text-fuchsia-500")}>{mySymbol}</span></>
              )}
            </div>
          )}
          {user && !isIdle && activeRoom && activeRoom.mode === 'normal' && (
            <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 font-medium text-slate-300 flex items-center gap-2">
               <span>Room ID:</span>
               <span className="font-mono text-cyan-400 user-select-all select-all">{activeRoom.id}</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full flex-1 grid lg:grid-cols-12 gap-8">
        
        {/* Left Column: Game Board */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          <AdBanner isPremium={user?.isPremium} />

          {/* Status Bar */}
          <div className="w-full bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 mb-6 flex items-center justify-center min-h-[80px]">
            {!user ? (
              <div className="text-slate-400 font-medium">Sign in to play!</div>
            ) : isIdle ? (
              <div className="text-slate-400 font-medium">Ready to play?</div>
            ) : (
              <AnimatePresence mode="wait">
                {activeRoom.status === 'abandoned' ? (
                  <motion.div key="abandoned" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-400 font-medium flex items-center gap-2">
                    Opponent left the game.
                  </motion.div>
                ) : activeRoom.status === 'waiting' ? (
                  <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-400 font-medium flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                    Waiting for opponent to join...
                  </motion.div>
                ) : activeRoom.winner ? (
                  <motion.div key="winner" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                    {activeRoom.winner === 'Draw' ? "It's a Draw!" : <><Trophy className="text-yellow-400" /> Player {activeRoom.winner} Wins!</>}
                  </motion.div>
                ) : (
                  <motion.div key="turn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-lg font-medium text-slate-300 flex items-center gap-2">
                    {isSpectator ? "Game in progress..." : (isMyTurn ? "Your Turn" : "Opponent's Turn")}
                    <span className={cn("font-bold text-xl", activeRoom.currentTurn === 'X' ? "text-cyan-400" : "text-fuchsia-500")}>
                      ({activeRoom.currentTurn})
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Board */}
          <div className="relative bg-slate-900 p-4 rounded-3xl shadow-xl shadow-cyan-900/10 border border-slate-800 w-full aspect-square max-w-[500px]">
            
            {isIdle && !localGame.active && (
              <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center">
                {isSearching ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-cyan-400 font-medium text-lg">Searching for opponent...</p>
                    <button onClick={cancelSearch} className="mt-4 px-6 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 w-full max-w-xs">
                    <div className="flex gap-2 w-full justify-center mb-2">
                      {[3, 4, 5].map(size => (
                        <button 
                          key={size}
                          onClick={() => setBoardSize(size)}
                          className={cn("px-4 py-2 rounded-xl font-bold transition-all border", boardSize === size ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400")}
                        >
                          {size}x{size}
                        </button>
                      ))}
                    </div>
                    <button onClick={startAIGame} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/50 transition-all transform hover:scale-105">
                      Play vs AI (Offline Mode)
                    </button>
                    <button onClick={createNormalRoom} className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-fuchsia-900/50">
                      Create Normal Room
                    </button>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Enter Room Code"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-cyan-500 text-center"
                      />
                      <button onClick={joinNormalRoom} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700">
                        Join Normal Room
                      </button>
                    </div>
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-slate-700"></div>
                      <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">OR</span>
                      <div className="flex-grow border-t border-slate-700"></div>
                    </div>
                    <button onClick={findMatch} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-cyan-900/50 transition-all transform hover:scale-105 flex items-center justify-center gap-2">
                       Find Random Match (Video)
                    </button>
                  </div>
                )}
              </div>
            )}

            <div 
              className="w-full h-full grid gap-2"
              style={{ gridTemplateColumns: `repeat(${activeRoom.size}, minmax(0, 1fr))` }}
            >
              {activeRoom.board.map((cell: string, index: number) => {
                const fontSizeClass = activeRoom.size >= 5 ? "text-xl md:text-3xl" : activeRoom.size === 4 ? "text-3xl md:text-5xl" : "text-5xl md:text-7xl";
                return (
                  <button
                    key={index}
                    onClick={() => handleCellClick(index)}
                    disabled={cell !== '' || activeRoom.status !== 'playing' || activeRoom.winner !== '' || (!localGame.active && (!isMyTurn || !user || isSpectator))}
                    className={cn(
                      "flex items-center justify-center rounded-xl md:rounded-2xl font-bold transition-colors",
                      fontSizeClass,
                      cell === '' && isMyTurn && activeRoom.status === 'playing' && (localGame.active || (user && !isSpectator)) ? "bg-slate-800 hover:bg-slate-700 cursor-pointer" : "bg-slate-800 cursor-default",
                      cell === 'X' ? "text-cyan-400" : "text-fuchsia-500",
                      activeRoom.winner && cell !== '' && "opacity-50"
                    )}
                  >
                    <AnimatePresence>
                      {cell && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                          {cell}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </div>

          {(!isIdle || localGame.active) && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {activeRoom.winner && (localGame.active || (user && !isSpectator)) && (
                <button
                  onClick={resetGame}
                  className="px-8 py-3 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/50"
                >
                  Play Again
                </button>
              )}
              {localGame.active && (
                <button
                  onClick={() => {
                    setLocalGame(prev => ({ ...prev, active: false }));
                    setGameMode("normal");
                  }}
                  className="px-8 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  {gameMode === 'ai' ? 'Exit AI Game' : 'Exit Local Game'}
                </button>
              )}
              {!isSpectator && !localGame.active && (
                <button
                  onClick={switchPlayer}
                  className="px-8 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Find New Player
                </button>
              )}
            </div>
          )}

          {isIdle && !localGame.active && (
            <div className="mt-12 w-full max-w-[500px] flex flex-col gap-6">
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center">
                <h2 className="text-xl font-bold text-slate-200 mb-2">About Tic Tac Toe Online</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Play the classic game of Tic Tac Toe with friends or random opponents online! 
                  Features real-time multiplayer, live chat, and video calling. 
                  Completely free to play. Sign in with Google to get started and track your wins!
                </p>
              </div>

              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2 justify-center">
                  <Trophy className="text-yellow-400" size={20} /> Top Players
                </h2>
                <div className="space-y-3">
                  {topPlayers.length > 0 ? topPlayers.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-bold w-4">{i + 1}.</span>
                        {p.photoURL ? (
                          <img src={p.photoURL} alt={p.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-slate-300">{p.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-cyan-400 font-bold">{p.totalWins} wins</span>
                        <span className="text-slate-500 text-xs">{p.winRate.toFixed(1)}% WR</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-slate-500 py-4">No players yet. Play a game to get on the board!</div>
                  )}
                  <div className="text-center text-slate-500 text-xs mt-4 pt-4 border-t border-slate-800/50">
                    Leaderboard updates in real-time
                  </div>
                </div>
              </div>
            </div>
          )}

          <AdBanner isPremium={user?.isPremium} />
        </div>

        {/* Right Column: Video & Chat */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-[800px]">
          {!isIdle && activeRoom && (
            <div className="flex-none">
              <Suspense fallback={<div className="w-full aspect-video bg-slate-900 rounded-3xl flex items-center justify-center text-slate-500 animate-pulse">Loading Video...</div>}>
                <VideoCall 
                  roomId={paramRoomId || 'default-room'} 
                  isHost={isHost} 
                  mode={activeRoom?.mode || 'normal'}
                  onPeerReady={(id) => setMyPeerId(id)}
                  targetPeerId={targetPeerId}
                />
              </Suspense>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="w-full h-full bg-slate-900 rounded-3xl flex items-center justify-center text-slate-500 animate-pulse">Loading Chat...</div>}>
              <Chat roomId={paramRoomId || 'default-room'} />
            </Suspense>
          </div>
        </div>

      </div>
    </div>
  );
}
