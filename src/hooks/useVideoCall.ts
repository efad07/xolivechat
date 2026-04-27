import { useRef, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc, onSnapshot, collection, addDoc, getDoc } from "firebase/firestore";

export default function useVideoCall(roomId: string | null) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let pc: RTCPeerConnection;
    let unsubParams: any[] = [];

    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return null;
        }
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        return stream;
      } catch (e) {
        console.error("Camera access error:", e);
        return null;
      }
    };

    if (!roomId) {
      startLocalStream();
      return () => {
         isCancelled = true;
         streamRef.current?.getTracks().forEach(t => t.stop());
         streamRef.current = null;
      };
    }

    const connectWebRTC = async () => {
      pc = new RTCPeerConnection({
        iceServers: [
           { urls: "stun:stun.l.google.com:19302" },
           { urls: "stun:stun1.l.google.com:19302" }
        ],
      });
      peerRef.current = pc;

      const stream = streamRef.current || await startLocalStream();
      if (!stream) return;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideo.current && remoteVideo.current.srcObject !== event.streams[0]) {
          remoteVideo.current.srcObject = event.streams[0];
        }
      };

      const roomRef = doc(db, "signals", roomId);
      const callerIce = collection(roomRef, "callerIce");
      const calleeIce = collection(roomRef, "calleeIce");

      const roomSnap = await getDoc(roomRef);
      const isCaller = !roomSnap.exists() || !roomSnap.data()?.offer;

      pc.onicecandidate = (event) => {
        if (event.candidate && !isCancelled) {
          addDoc(isCaller ? callerIce : calleeIce, event.candidate.toJSON());
        }
      };

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!isCancelled) {
          await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } }, { merge: true });
        }

        const unsub = onSnapshot(roomRef, (snap) => {
          const data = snap.data();
          if (data?.answer && !pc.currentRemoteDescription && !isCancelled) {
            pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        });
        unsubParams.push(unsub);

        const unsubIce = onSnapshot(calleeIce, (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "added" && !isCancelled) {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate).catch(e => console.error(e));
            }
          });
        });
        unsubParams.push(unsubIce);
      } else {
        const offer = roomSnap.data().offer;
        if (offer && !isCancelled) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (!isCancelled) {
            await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });
          }
        }

        const unsubIce = onSnapshot(callerIce, (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "added" && !isCancelled) {
              const candidate = new RTCIceCandidate(change.doc.data());
              pc.addIceCandidate(candidate).catch(e => console.error(e));
            }
          });
        });
        unsubParams.push(unsubIce);
      }
    };

    connectWebRTC();

    return () => {
      isCancelled = true;
      unsubParams.forEach(u => u());
      pc?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [roomId]);

  return { localVideo, remoteVideo, peerRef };
}
