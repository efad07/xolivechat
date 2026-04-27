import React, { useEffect, useRef, useState } from "react";
import Peer, { MediaConnection } from "peerjs";
import { Copy, Video as VideoIcon, VideoOff, Mic, MicOff, PhoneCall, PhoneOff, Shuffle, Play } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { ref, get, set, remove, onValue, off } from "firebase/database";
import { rtdb } from "../firebase";

export default function WebRTCVideoCall() {
  const [peerId, setPeerId] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // ADD THESE STATES
  const [mode, setMode] = useState("manual");
  const [status, setStatus] = useState("");

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  // INIT PEER
  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
      setErrorMsg("");
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setErrorMsg(err.message || "Connection error occurred.");
    });

    // incoming call
    peer.on("call", async (call) => {
      try {
        if (inCall) {
          // Prevent multiple simultaneous calls
          console.warn("Already in a call, rejecting incoming call.");
          return;
        }

        const stream = await getStream();
        if (!stream) return;

        callRef.current = call;
        call.answer(stream);
        setInCall(true);

        call.on("stream", (remoteStream) => {
          if (remoteVideo.current) {
            remoteVideo.current.srcObject = remoteStream;
          }
        });

        call.on("close", () => {
          handleEndCall();
        });
      } catch (err) {
        console.error("Incoming call error:", err);
        setErrorMsg("Failed to answer incoming call. Check camera/mic permissions.");
      }
    });

    return () => {
      // Complete cleanup on unmount
      if (callRef.current) callRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GET CAMERA + MIC
  const getStream = async () => {
    if (streamRef.current) return streamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }
      setErrorMsg("");
      return stream;
    } catch (err) {
      console.error("User media error:", err);
      setErrorMsg("Permission denied to access camera/microphone.");
      return null;
    }
  };

  // CONNECT TO PEER logic
  const connectToPeer = async (targetId: string) => {
    if (!peerRef.current) {
      setErrorMsg("Peer connection not ready yet. Please wait.");
      return;
    }
    if (inCall) {
      setErrorMsg("You are already in a call.");
      return;
    }

    try {
      const stream = await getStream();
      if (!stream) return;

      const call = peerRef.current.call(targetId, stream);
      
      if (!call) {
         setErrorMsg("Failed to initiate call. Verify remote ID is valid.");
         return;
      }
      
      callRef.current = call;
      setInCall(true);
      setErrorMsg("");

      call.on("stream", (remoteStream) => {
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        handleEndCall();
      });
      
      call.on("error", (err) => {
        console.error("Call error:", err);
        setErrorMsg("Call connection failed.");
        handleEndCall();
      });
    } catch (err) {
      console.error(err);
      setErrorMsg("Call failed to start.");
    }
  };

  // MANUAL CALL
  const startCall = async () => {
    if (!remoteId.trim()) {
      setErrorMsg("Enter a valid remote ID to call.");
      return;
    }
    await connectToPeer(remoteId);
  };

  // RANDOM MATCH FUNCTION
  const startMatching = async () => {
    if (!peerRef.current || !peerId) return;

    setStatus("Searching...");
    setErrorMsg("");

    try {
      const waitingRef = ref(rtdb, "waitingUsers");
      const snapshot = await get(waitingRef);

      if (snapshot.exists()) {
        const users = snapshot.val();
        const firstKey = Object.keys(users).find(key => users[key] !== peerId);

        if (firstKey) {
          const otherPeer = users[firstKey];

          await remove(ref(rtdb, `waitingUsers/${firstKey}`));

          await set(ref(rtdb, `matches/${firstKey}`), {
            peer1: otherPeer,
            peer2: peerId,
          });

          await connectToPeer(otherPeer);
          setStatus("Connected");
          return;
        }
      }

      await set(ref(rtdb, `waitingUsers/${peerId}`), peerId);

      onValue(ref(rtdb, `matches/${peerId}`), (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          connectToPeer(data.peer1);
          setStatus("Connected");
          off(ref(rtdb, `matches/${peerId}`));
        }
      });
    } catch (err) {
      console.error("Matchmaking error:", err);
      setErrorMsg("Failed to start matchmaking. Make sure Firebase is configured.");
      setStatus("");
    }
  };

  // NEXT BUTTON
  const nextUser = async () => {
    handleEndCall();
    startMatching();
  };

  // END CALL CLEAN
  const handleEndCall = async () => {
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }

    if (remoteVideo.current) {
       remoteVideo.current.srcObject = null;
    }

    // Always clean up matchmaking states on end call
    try {
      if (peerId) {
        await remove(ref(rtdb, `waitingUsers/${peerId}`));
        await remove(ref(rtdb, `matches/${peerId}`));
        off(ref(rtdb, `matches/${peerId}`));
      }
    } catch (e) {
      console.error(e);
    }

    setInCall(false);
    setStatus("");
  };

  // COPY ID
  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    // Visual feedback could be added here
  };

  // AUDIO
  const toggleMute = () => {
    if (!streamRef.current) return;
    const audio = streamRef.current.getAudioTracks()[0];
    if (!audio) return;

    audio.enabled = !audio.enabled;
    setIsMuted(!audio.enabled);
  };

  // VIDEO
  const toggleCamera = () => {
    if (!streamRef.current) return;
    const video = streamRef.current.getVideoTracks()[0];
    if (!video) return;

    video.enabled = !video.enabled;
    setIsCameraOff(!video.enabled);
  };

  return (
    <div className="flex-1 bg-slate-900 text-white p-4 sm:p-6 flex flex-col items-center min-h-[calc(100vh-64px)] overflow-y-auto w-full">
      <Helmet>
        <title>QuickConnect 1:1 - WebRTC Video Call</title>
      </Helmet>

      <div className="w-full max-w-5xl flex flex-col items-center mt-4">
        <h1 className="text-3xl font-bold text-blue-400 mb-6 flex items-center gap-3">
          <PhoneCall className="w-8 h-8" />
          QuickConnect 1:1
        </h1>

        {errorMsg && (
          <div className="w-full max-w-md bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-lg mb-6 text-sm text-center">
            {errorMsg}
          </div>
        )}

        {/* TABS */}
        <div className="flex bg-slate-800 rounded-xl mb-6 shadow-xl border border-slate-700 overflow-hidden max-w-md w-full">
          <button 
            onClick={() => { setMode("manual"); setStatus(""); }}
            className={`flex-1 py-3 font-bold text-sm transition-colors ${mode === "manual" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            Manual Connect
          </button>
          <button 
            onClick={() => { setMode("random"); setStatus(""); }}
            className={`flex-1 py-3 font-bold text-sm transition-colors ${mode === "random" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            Random Match
          </button>
        </div>

        {/* INPUT SECTION */}
        <div className="w-full max-w-md bg-slate-800 p-5 rounded-xl mb-6 shadow-xl border border-slate-700">
          <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Your Unique Peer ID</label>
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
            <code className="text-blue-300 truncate font-mono select-all">
              {peerId || "Generating ID..."}
            </code>
            <button 
              onClick={copyId} 
              disabled={!peerId}
              className="text-slate-400 hover:text-white transition-colors p-2 disabled:opacity-50"
              title="Copy ID"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>

          {mode === "manual" ? (
            <div className="mt-6 border-t border-slate-700 pt-6">
              <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Connect to Peer</label>
              <input
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                placeholder="Enter Remote Peer ID"
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value)}
                disabled={inCall}
              />

              <button
                onClick={startCall}
                disabled={inCall || !peerId}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 focus:ring-4 focus:ring-blue-600/50 transition-all p-3 rounded-lg flex justify-center items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-900/50"
              >
                <PhoneCall className="w-5 h-5" /> Start Call
              </button>
            </div>
          ) : (
            <div className="mt-6 border-t border-slate-700 pt-6 flex flex-col items-center">
              <label className="text-xs text-slate-400 font-bold uppercase mb-4 block w-full text-center">Random Matchmaking</label>
              
              {status && (
                <div className={`mb-4 px-4 py-2 rounded-full text-sm font-bold animate-pulse ${status === "Searching..." ? "bg-indigo-500/20 text-indigo-300" : "bg-emerald-500/20 text-emerald-400"}`}>
                  {status}
                </div>
              )}

              <button
                onClick={startMatching}
                disabled={!!status || inCall || !peerId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-600/50 transition-all p-4 rounded-lg flex justify-center items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-900/50"
              >
                <Shuffle className="w-5 h-5" /> Start Matching
              </button>
            </div>
          )}
        </div>

        {/* VIDEO GRID */}
        <div className="grid md:grid-cols-2 gap-4 w-full relative mb-24">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-slate-800 shadow-xl group">
             <video ref={localVideo} autoPlay muted playsInline className={`w-full h-full object-cover ${isCameraOff ? "opacity-0" : "opacity-100"} transition-opacity duration-300`} />
             <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 text-xs font-bold rounded-full text-slate-300 z-10 flex items-center gap-2">
                You {isMuted && <MicOff className="w-3 h-3 text-red-400" />} {isCameraOff && <VideoOff className="w-3 h-3 text-red-400" />}
             </div>
             {isCameraOff && (
               <div className="absolute inset-0 flex items-center justify-center">
                 <VideoOff className="w-16 h-16 text-slate-700" />
               </div>
             )}
          </div>
          
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border border-slate-800 shadow-xl">
             <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
             <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 text-xs font-bold rounded-full text-blue-300 z-10">
                Remote Peer
             </div>
             {!inCall && (
               <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-600">
                 <VideoIcon className="w-16 h-16 mb-4 opacity-50" />
                 <span className="font-medium">Waiting for connection...</span>
               </div>
             )}
          </div>
        </div>

        {/* CONTROLS */}
        {inCall && (
          <div className="fixed bottom-8 flex gap-4 bg-slate-800/90 backdrop-blur-md p-4 rounded-full border border-slate-700 shadow-2xl z-50">
            <button 
              onClick={toggleMute}
              className={`p-4 rounded-full transition-colors flex items-center justify-center outline-none ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button 
              onClick={toggleCamera}
              className={`p-4 rounded-full transition-colors flex items-center justify-center outline-none ${isCameraOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              title={isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
            >
              {isCameraOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
            </button>
            
            {mode === "random" && (
              <button 
                onClick={nextUser} 
                className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full ml-2 shadow-lg shadow-indigo-900/50 transition-colors flex items-center justify-center outline-none"
                title="Next User"
              >
                <Play className="w-6 h-6" />
              </button>
            )}

            <button 
              onClick={handleEndCall} 
              className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-full ml-2 shadow-lg shadow-red-900/50 transition-colors flex items-center justify-center outline-none"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
