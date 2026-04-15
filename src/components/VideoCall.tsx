import React, { useEffect, useRef, useState } from 'react';
import { collection, addDoc, onSnapshot, query, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Phone } from 'lucide-react';

interface VideoCallProps {
  roomId: string;
  isHost: boolean;
}

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function VideoCall({ roomId, isHost }: VideoCallProps) {
  const { user } = useAuth();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const isLobby = roomId === 'default-room';

  useEffect(() => {
    return () => {
      endCall();
    };
  }, [roomId]);

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !audioEnabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  const startCall = async () => {
    if (!user || isLobby) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      const signalingRef = collection(db, `rooms/${roomId}/signaling`);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await addDoc(signalingRef, {
              type: 'candidate',
              sender: user.uid,
              data: JSON.stringify(event.candidate.toJSON()),
              createdAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error adding candidate', error);
          }
        }
      };

      if (isHost) {
        // Host creates offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await addDoc(signalingRef, {
          type: 'offer',
          sender: user.uid,
          data: JSON.stringify({ type: offer.type, sdp: offer.sdp }),
          createdAt: new Date().toISOString()
        });
      }

      // Listen for signaling data
      const unsubscribe = onSnapshot(query(signalingRef), async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.sender === user.uid) return; // Ignore our own messages

            try {
              if (data.type === 'offer' && !isHost) {
                const offer = JSON.parse(data.data);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await addDoc(signalingRef, {
                  type: 'answer',
                  sender: user.uid,
                  data: JSON.stringify({ type: answer.type, sdp: answer.sdp }),
                  createdAt: new Date().toISOString()
                });
              } else if (data.type === 'answer' && isHost) {
                const answer = JSON.parse(data.data);
                if (pc.signalingState !== 'stable') {
                  await pc.setRemoteDescription(new RTCSessionDescription(answer));
                }
              } else if (data.type === 'candidate') {
                const candidate = JSON.parse(data.data);
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            } catch (error) {
              console.error('Error handling signaling data', error);
            }
          }
        });
      }, (error) => {
        console.error('Signaling error', error);
      });

      setInCall(true);

      // Store unsubscribe to clean up later if needed
      (pc as any).unsubscribeSignaling = unsubscribe;

    } catch (error) {
      console.error('Error starting call', error);
    }
  };

  const endCall = async () => {
    if (peerConnectionRef.current) {
      if ((peerConnectionRef.current as any).unsubscribeSignaling) {
        (peerConnectionRef.current as any).unsubscribeSignaling();
      }
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setInCall(false);

    // Clean up signaling collection
    try {
      const signalingRef = collection(db, `rooms/${roomId}/signaling`);
      const snapshot = await getDocs(signalingRef);
      snapshot.forEach(async (d) => {
        await deleteDoc(doc(db, `rooms/${roomId}/signaling`, d.id));
      });
    } catch (error) {
      console.error('Error cleaning up signaling', error);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-xl">
      <div className="relative aspect-video bg-black">
        {/* Remote Video */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            {isLobby ? 'Join a room to use video call' : (!user ? 'Sign in to use video call' : (inCall ? 'Waiting for other player...' : 'Video Call'))}
          </div>
        )}

        {/* Local Video (PiP) */}
        {localStream && (
          <div className="absolute bottom-4 right-4 w-1/3 max-w-[120px] aspect-video bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 flex justify-center gap-4 bg-slate-800">
        {isLobby ? (
          <div className="text-slate-400 text-sm">Video calling disabled in lobby</div>
        ) : !user ? (
          <div className="text-slate-400 text-sm">Video calling requires sign in</div>
        ) : !inCall ? (
          <button
            onClick={startCall}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-white rounded-full font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Phone size={18} /> Start Call
          </button>
        ) : (
          <>
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full transition-colors ${audioEnabled ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-colors ${videoEnabled ? 'bg-slate-600 text-white hover:bg-slate-500' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button
              onClick={endCall}
              className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              <PhoneOff size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
