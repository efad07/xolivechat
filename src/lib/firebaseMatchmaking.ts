import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";

export const findMatch = async (userId: string, onMatchFound: (roomId: string) => void) => {
  const queueRef = collection(db, "queue");
  const snapshot = await getDocs(queueRef);

  let match: any = null;

  snapshot.forEach((docSnap) => {
    if (docSnap.id !== userId && !match && docSnap.data().status === "waiting") {
      match = docSnap;
    }
  });

  if (match) {
    // I am the caller
    const roomId = "vid_" + Date.now().toString() + "_" + Math.floor(Math.random()*1000);

    await deleteDoc(doc(db, "queue", match.id));
    await deleteDoc(doc(db, "queue", userId)).catch(() => {});

    await setDoc(doc(db, "queue", match.id), { status: "matched", roomId }, { merge: true });

    onMatchFound(roomId);
    return () => {};
  } else {
    const myQueueRef = doc(db, "queue", userId);
    await setDoc(myQueueRef, { userId, status: "waiting" });

    const unsub = onSnapshot(myQueueRef, (docSnap) => {
       const data = docSnap.data();
       if (data?.status === "matched" && data.roomId) {
          onMatchFound(data.roomId);
       }
    });

    return () => {
       unsub();
       deleteDoc(myQueueRef).catch(() => {});
    };
  }
};
