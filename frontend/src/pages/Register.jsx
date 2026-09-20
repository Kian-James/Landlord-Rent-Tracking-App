import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import { friendlyAuthError } from '../lib/authError.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/properties?onboarding=1');
    } catch (err) {
      setError(friendlyAuthError(err, 'Unable to create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-bento border border-line bg-surface p-8 shadow-bento">
        <p className="text-lg font-semibold">PropTrack</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-ink/60">
          Sign up with any email and a password, or continue with Google. Connecting Gmail is optional and can wait.
        </p>

        <div className="mt-6">
          <GoogleAuthButton
            onSuccess={({ isNewUser }) => navigate(isNewUser ? '/properties?onboarding=1' : '/')}
            onError={setError}
          />
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink/40">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">Full name</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={handleChange('name')}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">Account email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange('email')}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink/45">This can be any email — it doesn't need to be Gmail.</p>
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange('password')}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink/45">At least 10 characters.</p>
          </div>

          {error && <p className="text-sm text-status-overdue">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/60">
          Already have an account? <Link to="/login" className="font-medium text-brand">Log in</Link>
        </p>
      </div>
    </div>
  );
}
