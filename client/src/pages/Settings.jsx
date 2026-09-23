import React, { useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyAuthError } from '../lib/authError.js';
import BentoCard from '../components/BentoCard.jsx';

export default function Settings() {
  const { landlord, setLandlord, canChangePassword, changePassword: changeFirebasePassword } = useAuth();
  const [name, setName] = useState(landlord?.name || '');
  const [prefs, setPrefs] = useState(landlord?.notificationPreferences || {});
  const [message, setMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');

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
    </div>
  );
}