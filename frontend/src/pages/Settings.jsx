import React, { useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyAuthError } from '../lib/authError.js';
import BentoCard from '../components/BentoCard.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';

export default function Settings() {
  const { landlord, setLandlord, canChangePassword, changePassword: changeFirebasePassword } = useAuth();
  const [name, setName] = useState(landlord?.name || '');
  const [prefs, setPrefs] = useState(landlord?.notificationPreferences || {});
  const [gmail, setGmail] = useState(null);
  const [message, setMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    client.get('/gmail/status').then((res) => setGmail(res.data));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    const { data } = await client.patch('/settings/profile', { name });
    setLandlord(data.landlord);
    setMessage('Profile updated.');
  };

  const saveNotifications = async (updates) => {
    const merged = { ...prefs, ...updates };
    setPrefs(merged);
    const { data } = await client.patch('/settings/notifications', updates);
    setLandlord(data.landlord);
  };

  const connectGmail = async () => {
    try {
      const { data } = await client.get('/gmail/oauth/start');
      window.location.href = data.redirectUrl;
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Gmail is not configured on this server yet.');
    }
  };

  const disconnectGmail = async () => {
    await client.post('/gmail/disconnect');
    const { data } = await client.get('/gmail/status');
    setGmail(data);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    try {
      await changeFirebasePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordMessage('Password updated.');
    } catch (err) {
      setPasswordMessage(friendlyAuthError(err, 'Could not update password.'));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      <BentoCard>
        <h2 className="text-base font-semibold">Profile</h2>
        <form onSubmit={saveProfile} className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button type="submit" className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
            Save
          </button>
        </form>
        <p className="mt-2 text-xs text-ink/50">Account email: {landlord?.email}</p>
        {message && <p className="mt-2 text-xs text-brand">{message}</p>}
      </BentoCard>

      {canChangePassword && (
      <BentoCard>
        <h2 className="text-base font-semibold">Change Password</h2>
        <form onSubmit={changePassword} className="mt-3 space-y-2">
          <input
            type="password"
            placeholder="Current password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="New password (min 10 characters)"
            required
            minLength={10}
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
            Update Password
          </button>
        </form>
        {passwordMessage && <p className="mt-2 text-xs text-ink/60">{passwordMessage}</p>}
      </BentoCard>
      )}

      <BentoCard>
        <h2 className="text-base font-semibold">Notifications</h2>
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between text-sm">
            Rent reminders
            <input
              type="checkbox"
              checked={!!prefs.rentReminders}
              onChange={(e) => saveNotifications({ rentReminders: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            Contract expiration reminders
            <input
              type="checkbox"
              checked={!!prefs.contractReminders}
              onChange={(e) => saveNotifications({ contractReminders: e.target.checked })}
            />
          </label>
        </div>
      </BentoCard>

      <BentoCard>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Gmail Integration</h2>
          <span className="text-xs">
            {gmail?.connected ? (
              <span className="text-status-paid"><FontAwesomeIcon icon={faCircle} className="mr-1 text-[8px]" />Connected</span>
            ) : (
              <span className="text-ink/40"><FontAwesomeIcon icon={faCircle} className="mr-1 text-[8px]" />Not Connected</span>
            )}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Optional. Everything else in PropTrack works fully without Gmail — it only adds tenant email reminders.
        </p>
        {gmail?.connected ? (
          <>
            <p className="mt-2 text-sm">Connected as {gmail.gmailAddress}</p>
            <button onClick={disconnectGmail} className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas">
              Disconnect Gmail
            </button>
          </>
        ) : (
          <button onClick={connectGmail} className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
            Connect Gmail
          </button>
        )}
        {!gmail?.configured && (
          <p className="mt-2 text-xs text-ink/40">
            Gmail OAuth credentials aren't configured on this server yet (see docs/GMAIL_INTEGRATION.md).
          </p>
        )}
      </BentoCard>
    </div>
  );
}