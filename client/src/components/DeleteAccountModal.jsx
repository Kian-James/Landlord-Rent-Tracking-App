import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { friendlyAuthError } from '../lib/authError.js';

// Confirmation dialog for permanently deleting an account. Deliberately a bit
// of friction: say what will be lost, then require the account email (and the
// password, for email/password accounts) before the red button enables.
const LOSES = [
  'Your properties, units and tenants',
  'All leases, contracts and your contract template',
  'Every rent, utility bill and payment record (including receipts)',
  'Your notifications and sign-in',
];

export default function DeleteAccountModal({ open, onClose, email, needsPassword, onConfirm }) {
  const [typedEmail, setTypedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTypedEmail('');
      setPassword('');
      setError('');
      setDeleting(false);
    }
  }, [open]);

  const emailMatches = typedEmail.trim().toLowerCase() === String(email || '').toLowerCase();
  const canDelete = emailMatches && (!needsPassword || password.length > 0) && !deleting;

  const submit = async (e) => {
    e.preventDefault();
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onConfirm({ confirmEmail: typedEmail.trim(), password });
    } catch (err) {
      setError(
        err?.response?.data?.error?.message || friendlyAuthError(err, 'Could not delete your account. Please try again.')
      );
      setDeleting(false);
    }
  };

  const field =
    'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-status-overdue/50 focus:ring-2 focus:ring-status-overdue/15';

  return (
    <Modal open={open} onClose={() => !deleting && onClose()} title="Delete your account?" size="md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink/70">
          This <span className="font-semibold text-status-overdue">permanently deletes</span> your account and everything in
          it. It cannot be undone.
        </p>
        <ul className="list-disc space-y-1 rounded-xl bg-status-overdueSoft/50 py-3 pl-8 pr-4 text-sm text-ink/75">
          {LOSES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="text-xs text-ink/55">
          Need a copy first? Use <span className="font-medium">Export Excel</span> on the Calendar page and download your
          contract PDFs before continuing.
        </p>

        <div>
          <label htmlFor="del-email" className="text-xs font-medium text-ink/70">
            Type <span className="font-semibold text-ink">{email}</span> to confirm
          </label>
          <input
            id="del-email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            autoComplete="off"
            className={`mt-1 ${field}`}
          />
        </div>

        {needsPassword && (
          <div>
            <label htmlFor="del-password" className="text-xs font-medium text-ink/70">
              Your password
            </label>
            <input
              id="del-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={`mt-1 ${field}`}
            />
          </div>
        )}

        {error && <p className="rounded-xl bg-status-overdueSoft px-3 py-2 text-sm text-status-overdue">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="h-10 rounded-full border border-line px-5 text-sm font-medium hover:bg-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canDelete}
            className="h-10 rounded-full bg-status-overdue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
