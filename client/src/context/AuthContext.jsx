import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import client, { setUnauthorizedHandler } from '../api/client.js';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [landlord, setLandlord] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(true);

  const handlingSignIn = useRef(false);
  const newLandlordRef = useRef(false);

  const loadLandlord = useCallback(async (user) => {
    const { data } = await client.get('/auth/user');
    setLandlord(data.landlord);
    setIdentities(user?.identities?.map((i) => i.provider) || []);
    newLandlordRef.current = !!data.isNewLandlord;
    return data.landlord;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setLandlord(null);
      supabase.auth.signOut();
    });
  }, []);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (handlingSignIn.current) return;

      if (event === 'SIGNED_OUT') {
        setLandlord(null);
        setLoading(false);
        return;
      }
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return;

      try {
        if (session?.user) await loadLandlord(session.user);
        else setLandlord(null);
      } catch {
        setLandlord(null);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [loadLandlord]);

  const runSignIn = useCallback(async (flow) => {
    handlingSignIn.current = true;
    try {
      return await flow();
    } catch (err) {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.auth.signOut();
      throw err;
    } finally {
      handlingSignIn.current = false;
    }
  }, []);

  const login = useCallback(
    (email, password) =>
      runSignIn(async () => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return loadLandlord(data.user);
      }),
    [runSignIn, loadLandlord]
  );

  // Supabase projects can require email confirmation before a session is
  // issued. When that is on, signUp() succeeds but returns no session -
  // there is nothing to load yet, so this returns needsEmailConfirmation
  // instead of throwing, and the caller decides what to show.
  const register = useCallback(
    (name, email, password) =>
      runSignIn(async () => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (!data.session) return { landlord: null, needsEmailConfirmation: true };
        return { landlord: await loadLandlord(data.user), needsEmailConfirmation: false };
      }),
    [runSignIn, loadLandlord]
  );

  // Google sign-in redirects the whole page to Google and back, so nothing
  // meaningful can run after this resolves - the SPA is being torn down.
  // Whatever happens next happens in the /auth/callback page once the
  // browser returns and this context's own onAuthStateChange fires again.
  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback` },
    });
    if (error) throw error;
  }, []);

  // AuthCallback reads this exactly once, right after a fresh sign-in, to
  // decide whether to route to onboarding. Consuming it clears it so a
  // later token refresh or tab restore can't replay the "new" routing.
  const consumeNewLandlordFlag = useCallback(() => {
    const value = newLandlordRef.current;
    newLandlordRef.current = false;
    return value;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setLandlord(null);
  }, []);

  const canChangePassword = identities.includes('email');

  // Supabase has no separate re-authenticate call. Signing in again with the
  // current password is what proves it's really the account holder before
  // updateUser() changes it.
  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: landlord.email,
        password: currentPassword,
      });
      if (verifyError) throw verifyError;

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    [landlord]
  );

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
        consumeNewLandlordFlag,
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
