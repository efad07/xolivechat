import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, collection, query, where, limit, getDocs, deleteDoc, increment, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import AdBanner from './AdBanner';
import { checkWin, getWinLength } from '../lib/gameLogic';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Share2, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { Helmet } from 'react-helmet-async';

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
    };
  }, [paramRoomId, user]);

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

        // Auto-join as guest if not host and no guest
        if (data.hostId !== user.uid && !data.guestId && data.status !== 'abandoned') {
          try {
            await updateDoc(roomRef, {
              guestId: user.uid,
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
  }, [paramRoomId, user, isIdle, navigate]);

  // Matchmaking Listener
  useEffect(() => {
    if (!isSearching || !user) return;
    
    const unsub = onSnapshot(doc(db, 'matchmaking', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'matched' && data.roomId) {
          setIsSearching(false);
          deleteDoc(doc(db, 'matchmaking', user.uid)).catch(console.error);
          navigate(`/room/${data.roomId}`);
        }
      }
    });
    
    return () => unsub();
  }, [isSearching, user, navigate]);

  // Leaderboard Listener
  useEffect(() => {
    if (!isIdle) return;
    
    const q = query(
      collection(db, 'users'),
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
            name: data.displayName || 'Anonymous',
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

  const findMatch = async () => {
    if (!user) {
      alert("Please sign in to play online!");
      return;
    }
    setIsSearching(true);
    
    try {
      const q = query(collection(db, 'matchmaking'), where('status', '==', 'waiting'), limit(2));
      const querySnapshot = await getDocs(q);
      
      const opponentDoc = querySnapshot.docs.find(d => d.id !== user.uid);
      
      if (opponentDoc) {
        const newRoomRef = doc(collection(db, 'rooms'));
        await setDoc(newRoomRef, {
          hostId: opponentDoc.id,
          guestId: user.uid,
          status: 'playing',
          board: Array(9).fill(''),
          currentTurn: 'X',
          winner: '',
          size: 3,
          createdAt: serverTimestamp()
        });
        
        await updateDoc(doc(db, 'matchmaking', opponentDoc.id), {
          status: 'matched',
          roomId: newRoomRef.id
        });
        
        await deleteDoc(doc(db, 'matchmaking', user.uid));
        setIsSearching(false);
        navigate(`/room/${newRoomRef.id}`);
      } else {
        await setDoc(doc(db, 'matchmaking', user.uid), {
          status: 'waiting',
          roomId: null,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Matchmaking error", error);
      setIsSearching(false);
    }
  };

  const cancelSearch = async () => {
    if (!user) return;
    setIsSearching(false);
    try {
      await deleteDoc(doc(db, 'matchmaking', user.uid));
    } catch (e) {
      console.error(e);
    }
  };

  const createPrivateRoom = async () => {
    if (!user) {
      alert("Please sign in to create a room!");
      return;
    }
    const newRoomRef = doc(collection(db, 'rooms'));
    await setDoc(newRoomRef, {
      hostId: user.uid,
      status: 'waiting',
      board: Array(9).fill(''),
      currentTurn: 'X',
      winner: '',
      size: 3,
      createdAt: serverTimestamp()
    });
    navigate(`/room/${newRoomRef.id}`);
  };

  const switchPlayer = async () => {
    if (paramRoomId && room) {
      try {
        await updateDoc(doc(db, 'rooms', paramRoomId), { status: 'abandoned' });
      } catch (e) {
        console.error(e);
      }
    }
    navigate('/');
    findMatch();
  };

  const activeRoom = room || {
    size: 3,
    board: Array(9).fill(''),
    status: isIdle ? 'idle' : 'waiting',
    currentTurn: 'X',
    winner: '',
    hostId: '',
    guestId: ''
  };

  const handleCellClick = async (index: number) => {
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

  const isHost = user ? activeRoom.hostId === user.uid : false;
  const isGuest = user ? activeRoom.guestId === user.uid : false;
  const isSpectator = user && !isHost && !isGuest && !isIdle;
  const mySymbol = isHost ? 'X' : (isGuest ? 'O' : '');
  const isMyTurn = mySymbol !== '' && activeRoom.currentTurn === mySymbol;

  useEffect(() => {
    if (activeRoom.status === 'playing') {
      setProcessedGame(false);
    } else if (activeRoom.status === 'finished' && user && !isSpectator && !processedGame) {
      setProcessedGame(true);
      
      const isWin = activeRoom.winner === mySymbol;
      const isDraw = activeRoom.winner === 'Draw';
      const isLoss = !isWin && !isDraw;

      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        totalGames: increment(1),
        totalWins: increment(isWin ? 1 : 0),
        totalLosses: increment(isLoss ? 1 : 0),
        totalDraws: increment(isDraw ? 1 : 0)
      }, { merge: true }).catch(console.error);
    }
  }, [activeRoom.status, activeRoom.winner, user, isSpectator, mySymbol, processedGame]);

  const roomUrl = `${window.location.origin}/room/${paramRoomId}`;

  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomUrl);
    alert("Room link copied to clipboard!");
  };

  const shareOnWhatsApp = () => {
    const text = `Hey! Let's play Tic Tac Toe online. Join my room here: ${roomUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex-1 p-4 md:p-8 flex flex-col">
      <Helmet>
        <title>{isIdle ? 'Play Tic Tac Toe Online | Multiplayer' : `Tic Tac Toe Room ${paramRoomId?.slice(0,6)}`}</title>
        <meta property="og:title" content={isIdle ? 'Play Tic Tac Toe Online | Multiplayer' : `Join my Tic Tac Toe Room!`} />
        <meta property="og:url" content={isIdle ? window.location.origin : roomUrl} />
      </Helmet>

      <header className="max-w-6xl mx-auto w-full flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-800 flex items-center gap-2">
            <Users size={18} className="text-cyan-400" />
            <span className="font-semibold text-slate-200">Room: {isIdle ? 'Lobby' : paramRoomId?.slice(0, 6)}</span>
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
        </div>
        {!isIdle && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyRoomLink}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-medium bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 rounded-xl transition-colors"
              title="Copy Link"
            >
              <Share2 size={18} /> <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={shareOnWhatsApp}
              className="flex items-center gap-2 text-green-400 hover:text-green-300 font-medium bg-green-500/10 hover:bg-green-500/20 px-4 py-2 rounded-xl transition-colors"
              title="Share on WhatsApp"
            >
              <MessageCircle size={18} /> <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>
        )}
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
            
            {isIdle && (
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
                    <button onClick={findMatch} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-cyan-900/50 transition-all transform hover:scale-105">
                      Play Online Now
                    </button>
                    <button onClick={createPrivateRoom} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-lg border border-slate-700 transition-all">
                      Play with Friends
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
                const fontSizeClass = activeRoom.size === 3 ? "text-5xl md:text-7xl" : "text-2xl md:text-4xl";
                return (
                  <button
                    key={index}
                    onClick={() => handleCellClick(index)}
                    disabled={cell !== '' || activeRoom.status !== 'playing' || activeRoom.winner !== '' || !isMyTurn || !user || isSpectator}
                    className={cn(
                      "flex items-center justify-center rounded-xl md:rounded-2xl font-bold transition-colors",
                      fontSizeClass,
                      cell === '' && isMyTurn && activeRoom.status === 'playing' && user && !isSpectator ? "bg-slate-800 hover:bg-slate-700 cursor-pointer" : "bg-slate-800 cursor-default",
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

          {!isIdle && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              {activeRoom.winner && user && !isSpectator && (
                <button
                  onClick={resetGame}
                  className="px-8 py-3 bg-cyan-600 text-white rounded-xl font-bold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/50"
                >
                  Play Again
                </button>
              )}
              {!isSpectator && (
                <button
                  onClick={switchPlayer}
                  className="px-8 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Find New Player
                </button>
              )}
            </div>
          )}

          {isIdle && (
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
                          <img src={p.photoURL} alt={p.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
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
          <div className="flex-none">
            <Suspense fallback={<div className="w-full aspect-video bg-slate-900 rounded-3xl flex items-center justify-center text-slate-500 animate-pulse">Loading Video...</div>}>
              <VideoCall roomId={paramRoomId || 'default-room'} isHost={isHost} />
            </Suspense>
          </div>
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
