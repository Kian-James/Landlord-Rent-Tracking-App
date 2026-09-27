import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyAuthError } from '../lib/authError.js';

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
      className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60"
    >
      <FontAwesomeIcon icon={faGoogle} />
      Continue with Google
    </button>
  );
}
