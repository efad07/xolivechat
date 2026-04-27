import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
const firebaseConfig = {
  apiKey: "AIzaSyB6mPgliDo_MPL9Ha0Nkg_kyXJlDB-ZUYM",
  authDomain: "xolivechat.firebaseapp.com",
  databaseURL: "https://xolivechat-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "xolivechat",
  storageBucket: "xolivechat.firebasestorage.app",
  messagingSenderId: "889508561814",
  appId: "1:889508561814:web:360dfccfd48cbbf69d13b7",
  measurementId: "G-NZNWPJVNXM",
  firestoreDatabaseId: "(default)"
};

let app: any;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Analytics safe
try {
  if (app) {
    isSupported().then((yes) => {
      if (yes) getAnalytics(app);
    }).catch(() => {});
  }
} catch (e) {}

export const auth = app ? getAuth(app) : getAuth();
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore();
import { getDatabase } from 'firebase/database';
export const rtdb = app ? getDatabase(app) : getDatabase();

export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("Signup success:", userCredential.user);
    return userCredential;
  } catch (error: any) {
    console.error("Signup error:", error.code, error.message);
  }
};

export const login = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login success:", userCredential.user);
    return userCredential;
  } catch (error: any) {
    console.error("Login error:", error.code, error.message);
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// GLOBAL ACCESS (IMPORTANT)
(window as any).signUp = signUp;
(window as any).login = login;
(window as any).logout = logOut;
(window as any).db = db;

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in user:", user.email);
  } else {
    console.log("No user logged in");
  }
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
