import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface CustomUser extends User {
  isPremium?: boolean;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const customUser = currentUser as CustomUser;
        customUser.isPremium = false; // Default
        setUser(customUser);
        
        try {
          const userRef = doc(db, 'players', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || '',
              totalWins: 0,
              totalLosses: 0,
              totalDraws: 0,
              totalGames: 0,
              isPremium: false
            });
          } else {
            // Update profile info using merge: true to prevent overwriting stats
            await setDoc(userRef, {
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || '',
            }, { merge: true });
            
            const data = userSnap.data();
            if (data.isPremium) {
              customUser.isPremium = true;
              setUser({ ...customUser });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `players/${currentUser.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
