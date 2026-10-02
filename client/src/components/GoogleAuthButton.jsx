import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyAuthError } from '../lib/authError.js';

// Google's four-colour "G" (brand guidelines ask for the coloured mark).
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3a7.2 7.2 0 0 1-10.71-3.78H1.34v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.35 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.34a12 12 0 0 0 0 10.78z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.34 6.61l4.01 3.09A7.2 7.2 0 0 1 12 4.77z" />
    </svg>
  );
}

// Clicking this sends the whole page to Google and back - there is no
// "success" to hand back to the caller here. onError only ever fires for a
// setup problem (e.g. Google not enabled in Supabase) caught before the
// redirect; what happens after a real sign-in is handled by /auth/callback.
export default function GoogleAuthButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      onError?.(friendlyAuthError(err, 'Something went wrong signing in with Google. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-60"
    >
      <GoogleG />
      {busy ? 'Redirecting...' : 'Continue with Google'}
    </button>
  );
}
