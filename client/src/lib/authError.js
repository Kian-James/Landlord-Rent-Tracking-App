const SUPABASE_AUTH_CODES = {
  invalid_credentials: 'Invalid email or password.',
  user_already_exists: 'An account with this email already exists.',
  user_not_found: 'Invalid email or password.',
  weak_password: 'That password is too weak. Please use at least 10 characters.',
  email_not_confirmed: 'Please confirm your email before logging in. Check your inbox.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  validation_failed: 'Please enter a valid email address.',
  user_banned: 'This account has been disabled.',
  same_password: 'Your new password must be different from your current password.',
  provider_disabled: 'Google sign-in is not available right now.',
};

const MESSAGE_PATTERNS = [
  [/invalid login credentials/i, 'Invalid email or password.'],
  [/already registered/i, 'An account with this email already exists.'],
  [/password should be at least/i, 'That password is too weak. Please use at least 10 characters.'],
  [/email not confirmed/i, 'Please confirm your email before logging in. Check your inbox.'],
  [/rate limit/i, 'Too many attempts. Please wait a few minutes and try again.'],
  [/unable to validate email/i, 'Please enter a valid email address.'],
  [/failed to fetch/i, 'Network error. Please check your connection and try again.'],
];

export function friendlyAuthError(error, fallback) {
  if (!error) return fallback;
  if (error.code && SUPABASE_AUTH_CODES[error.code]) return SUPABASE_AUTH_CODES[error.code];

  const message = error.message || '';
  for (const [pattern, friendly] of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return friendly;
  }

  return error?.response?.data?.error?.message || message || fallback;
}
