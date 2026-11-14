import {
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';

export interface AuthContextValue {
  currentUser: FirebaseUser | null;
  loading: boolean;
  signInWithEmailAndPassword: (email: string, password: string) => Promise<UserCredential>;
  createUserWithEmailAndPassword: (email: string, password: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmailAndPassword = useCallback(
    (email: string, password: string) => {
      return firebaseSignInWithEmailAndPassword(auth, email, password);
    },
    [],
  );

  const createUserWithEmailAndPassword = useCallback(
    (email: string, password: string) => {
      return firebaseCreateUserWithEmailAndPassword(auth, email, password);
    },
    [],
  );

  const signInWithGoogle = useCallback(() => {
    return signInWithPopup(auth, googleProvider);
  }, []);

  const signOut = useCallback(() => {
    return firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signInWithGoogle,
      signOut,
    }),
    [
      currentUser,
      loading,
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé à l’intérieur d’un AuthProvider.');
  }
  return ctx;
}
