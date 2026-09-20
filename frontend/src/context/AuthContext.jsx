import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import client, { setUnauthorizedHandler } from '../api/client.js';
import { auth } from '../lib/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [landlord, setLandlord] = useState(null);
  const [loading, setLoading] = useState(true);

  const handlingSignIn = useRef(false);


  const loadLandlord = useCallback(async () => {
    const { data } = await client.get('/auth/user');
    setLandlord(data.landlord);
    return data.landlord;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setLandlord(null);
      signOut(auth);
    });
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (handlingSignIn.current) return;
      try {
        if (user) await loadLandlord();
        else setLandlord(null);
      } catch {
        setLandlord(null);
      } finally {
        setLoading(false);
      }
    });
  }, [loadLandlord]);

  const runSignIn = useCallback(async (flow) => {
    handlingSignIn.current = true;
    try {
      return await flow();
    } catch (err) {
      if (auth.currentUser) await signOut(auth);
      throw err;
    } finally {
      handlingSignIn.current = false;
    }
  }, []);

  const login = useCallback(
    (email, password) =>
      runSignIn(async () => {
        await signInWithEmailAndPassword(auth, email, password);
        return loadLandlord();
      }),
    [runSignIn, loadLandlord]
  );

  const register = useCallback(
    (name, email, password) =>
      runSignIn(async () => {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        await user.getIdToken(true);
        return loadLandlord();
      }),
    [runSignIn, loadLandlord]
  );

  const loginWithGoogle = useCallback(
    () =>
      runSignIn(async () => {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
        const signedInLandlord = await loadLandlord();
        return { landlord: signedInLandlord, isNewUser };
      }),
    [runSignIn, loadLandlord]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setLandlord(null);
  }, []);

  const canChangePassword = !!auth.currentUser?.providerData.some((p) => p.providerId === 'password');

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await updatePassword(user, newPassword);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        landlord,
        setLandlord,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        canChangePassword,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
