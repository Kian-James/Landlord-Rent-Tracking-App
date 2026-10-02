import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { faCheck, faEnvelope, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleAuthButton from '../components/GoogleAuthButton.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import AuthField from '../components/AuthField.jsx';
import AuthAlert from '../components/AuthAlert.jsx';
import { friendlyAuthError } from '../lib/authError.js';

const MIN_PASSWORD_LENGTH = 10;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const passwordLongEnough = form.password.length >= MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const result = await register(form.name, form.email, form.password);
      if (result.needsEmailConfirmation) {
        setInfo('Check your email to confirm your account, then log in.');
      } else {
        navigate('/properties?onboarding=1');
      }
    } catch (err) {
      setError(friendlyAuthError(err, 'Unable to create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up with any email and a password, or continue with Google."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-success-dark hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleAuthButton onError={setError} />

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink/35">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="name"
          label="Full name"
          icon={faUser}
          required
          autoComplete="name"
          placeholder="Juan Dela Cruz"
          value={form.name}
          onChange={handleChange('name')}
        />
        <AuthField
          id="email"
          label="Email"
          icon={faEnvelope}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange('email')}
          hint="Any email works. It doesn't need to be Gmail."
        />
        <AuthField
          id="password"
          label="Password"
          icon={faLock}
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          placeholder="Create a password"
          value={form.password}
          onChange={handleChange('password')}
          hint={
            <span className={`inline-flex items-center gap-1.5 ${passwordLongEnough ? 'text-status-paid' : ''}`}>
              <FontAwesomeIcon icon={faCheck} className={`h-2.5 w-2.5 ${passwordLongEnough ? '' : 'opacity-30'}`} />
              At least {MIN_PASSWORD_LENGTH} characters
            </span>
          }
        />

        {error && <AuthAlert>{error}</AuthAlert>}
        {info && <AuthAlert tone="success">{info}</AuthAlert>}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
          )}
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
