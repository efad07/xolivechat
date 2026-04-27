import React, { useEffect, useRef, useState } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { useAuth } from './AuthContext';
import { Video, VideoOff, Mic, MicOff, PhoneCall, PhoneOff } from 'lucide-react';

interface VideoCallProps {
  roomId: string;
  isHost: boolean;
  mode?: string;
  onPeerReady?: (id: string) => void;
  targetPeerId?: string | null;
  isFullScreen?: boolean;
}

export default function VideoCall({ roomId, isHost, mode = 'random', onPeerReady, targetPeerId, isFullScreen }: VideoCallProps) {
  const { user } = useAuth();
  const [peerId, setPeerId] = useState('');
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isLobby = roomId === 'default-room';

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  useEffect(() => {
    if (!user) return; // Only init peer if logged in

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      setErrorMsg('');
      if (onPeerReady) onPeerReady(id);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setErrorMsg(err.message || 'Connection error occurred.');
    });

    peer.on('call', async (call) => {
      try {
        if (inCall) {
          console.warn('Already in a call');
          return;
        }

        const stream = await getStream();
        if (!stream) return;

        callRef.current = call;
        call.answer(stream);
        setInCall(true);

        call.on('stream', (remoteStream) => {
          if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
        });

        call.on('close', handleEndCall);
      } catch (err) {
        console.error('Incoming call error:', err);
      }
    });

    return () => {
      if (callRef.current) callRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      peer.destroy();
    };
  }, [user]);

  // Start local video unconditionally if isFullScreen
  useEffect(() => {
    if (isFullScreen) {
      getStream();
    }
  }, [isFullScreen]);

  // Connect when target is provided
  useEffect(() => {
    if (targetPeerId && targetPeerId !== peerId && !inCall && !isLobby) {
      connectToPeer(targetPeerId);
    }
  }, [targetPeerId, peerId, isLobby]);

  const getStream = async () => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('User media error:', err);
      setErrorMsg('Permission denied for camera/microphone.');
      return null;
    }
  };

  const connectToPeer = async (targetId: string) => {
    if (!peerRef.current) return;
    if (inCall) return;

    try {
      const stream = await getStream();
      if (!stream) return;

      const call = peerRef.current.call(targetId, stream);
      if (!call) return;
      
      callRef.current = call;
      setInCall(true);

      call.on('stream', (remoteStream) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
      });

      call.on('close', handleEndCall);
      call.on('error', (err) => {
        console.error('Call error:', err);
        handleEndCall();
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndCall = () => {
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    
    // In full screen lobby mode, don't kill the local stream immediately so we keep preview
    if (!isFullScreen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (localVideo.current) localVideo.current.srcObject = null;
    }
    if (remoteVideo.current) remoteVideo.current.srcObject = null;

    setInCall(false);
    if (!isFullScreen) {
       setIsMuted(false);
       setIsCameraOff(false);
    }
  };

  const toggleMute = () => {
    if (!streamRef.current) return;
    const audio = streamRef.current.getAudioTracks()[0];
    if (audio) {
      audio.enabled = !audio.enabled;
      setIsMuted(!audio.enabled);
    }
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const video = streamRef.current.getVideoTracks()[0];
    if (video) {
      video.enabled = !video.enabled;
      setIsCameraOff(!video.enabled);
    }
  };

  return (
    <div className={`bg-slate-900 overflow-hidden shadow-xl flex flex-col items-center justify-center relative ${isFullScreen ? 'w-full h-full rounded-none border-none' : 'w-full min-h-[300px] mt-4 h-[350px] rounded-3xl border border-slate-800'}`}>
      {isLobby && !isFullScreen ? (
        <div className="flex flex-col items-center justify-center text-slate-500 h-full p-6 text-center">
          <VideoOff size={32} className="opacity-50 mb-2" />
          <p className="font-medium text-slate-400">Join a room to enable video calls</p>
        </div>
      ) : !user && !isFullScreen ? (
        <p className="text-slate-500">Sign in to use video call</p>
      ) : (
        <div className="w-full h-full relative overflow-hidden flex">
           {/* LOCAL VIDEO OUTSIDE FULL SCREEN IF IN CALL, OR FULL SCREEN IF WAITING */}
           <div className={`transition-all duration-300 ${inCall ? (isFullScreen ? 'absolute top-4 left-4 w-32 h-44 md:w-48 md:h-64 z-20 rounded-2xl overflow-hidden border-4 border-slate-700 shadow-2xl' : 'absolute top-4 left-4 w-24 h-32 z-20 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl') : "w-full h-full relative"}`}>
              <video 
                ref={localVideo} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover bg-black ${isCameraOff ? "opacity-0" : "opacity-100"}`} 
              />
              {(!inCall || isCameraOff) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                   {!inCall ? (
                     <>
                     {isFullScreen ? (
                        null
                     ) : (
                       <>
                        <Video className="w-12 h-12 text-slate-600 mb-2 animate-pulse" />
                        <p className="text-slate-400 text-sm font-medium px-4 text-center">Waiting for opponent to connect...</p>
                        {peerId && <p className="text-xs text-slate-600 mt-2 font-mono">My ID: {peerId}</p>}
                       </>
                     )}
                     </>
                   ) : (
                     <VideoOff className="w-8 h-8 text-slate-500" />
                   )}
                </div>
              )}
           </div>

           {/* REMOTE VIDEO */}
           {inCall && (
            <div className={`w-full h-full bg-black relative top-0 left-0 ${isFullScreen ? 'absolute inset-0' : ''}`}>
               <video 
                 ref={remoteVideo} 
                 autoPlay 
                 playsInline 
                 className="w-full h-full object-cover" 
               />
               <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 text-xs font-bold rounded-full text-blue-300 z-10">
                  Remote Peer
               </div>

               {/* CONTROLS OVERLAY - Rendered unconditionally below if full screen */}
            </div>
           )}
           
           {(inCall || isFullScreen) && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-slate-800/90 backdrop-blur-md p-3 rounded-full border border-slate-700 shadow-2xl z-50">
                  <button 
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-colors flex items-center justify-center outline-none ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                    title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <button 
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-colors flex items-center justify-center outline-none ${isCameraOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                    title={isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
                  >
                    {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>

                  {inCall && (
                    <button 
                      onClick={handleEndCall} 
                      className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-full ml-1 shadow-lg shadow-red-900/50 transition-colors flex items-center justify-center outline-none"
                      title="End Call"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  )}
              </div>
           )}
        </div>
      )}
    </div>
  );
}
