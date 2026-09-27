import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import { friendlyAuthError } from '../lib/authError.js';

// Landed on after the Google redirect round-trip. The Supabase client parses
// the URL and fires SIGNED_IN on its own (see AuthContext); this page just
// waits for that, then routes on to the right place.
export default function AuthCallback() {
  const { landlord, loading, consumeNewLandlordFlag } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.replace('#', '?'));
    const message = params.get('error_description') || params.get('error');
    if (message) setError(decodeURIComponent(message.replace(/\+/g, ' ')));
  }, []);

  useEffect(() => {
    if (loading || error) return;
    if (landlord) {
      const isNew = consumeNewLandlordFlag();
      navigate(isNew ? '/properties?onboarding=1' : '/', { replace: true });
    }
  }, [landlord, loading, error, navigate, consumeNewLandlordFlag]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-bento border border-line bg-surface p-8 text-center shadow-bento">
          <p className="text-sm text-status-overdue">{friendlyAuthError({ message: error }, error)}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="mt-4 text-sm font-medium text-brand"
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}
