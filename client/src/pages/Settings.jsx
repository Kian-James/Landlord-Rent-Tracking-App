import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyAuthError } from '../lib/authError.js';
import BentoCard from '../components/BentoCard.jsx';

export default function Settings() {
  const { landlord, setLandlord, canChangePassword, changePassword: changeAccountPassword, logout } = useAuth();
  const navigate = useNavigate();
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
      await changeAccountPassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordMessage('Password updated.');
    } catch (err) {
      setPasswordMessage(friendlyAuthError(err, 'Could not update password.'));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <BentoCard className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Account
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Settings</h1>
        </div>
      </BentoCard>

      <BentoCard>
        <h2 className="text-base font-semibold">Profile</h2>
        <form onSubmit={saveProfile} className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button type="submit" className="shrink-0 rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
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
          <button type="submit" className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
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

      {/* The account menu that used to hold "Log out" (the top bar's
          UserMenu) is now part of the desktop-only icon rail, so small
          screens - which use the bottom tab bar instead - had no way to
          sign out. This card is that way out on every screen size. */}
      <BentoCard>
        <h2 className="text-base font-semibold">Account</h2>
        <p className="mt-1 text-xs text-ink/50">Signed in as {landlord?.email}</p>
        <button
          onClick={handleLogout}
          className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium text-status-overdue hover:bg-status-overdueSoft"
        >
          Log out
        </button>
      </BentoCard>
    </div>
  );
}
