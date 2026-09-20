const FIREBASE_MESSAGES = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'That password is too weak. Please use at least 10 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Please allow popups and try again.',
  'auth/account-exists-with-different-credential':
    'An account with this email already exists. Log in with your original method instead.',
  'auth/requires-recent-login': 'Please log in again before changing your password.',
};

const SILENT_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

export function friendlyAuthError(error, fallback) {
  if (SILENT_CODES.has(error?.code)) return '';
  return FIREBASE_MESSAGES[error?.code] || error?.response?.data?.error?.message || fallback;
}
