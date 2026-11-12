import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faChevronRight,
  faFileContract,
  faLock,
  faScaleBalanced,
  faUser,
  faUserGear,
} from '@fortawesome/free-solid-svg-icons';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyAuthError } from '../lib/authError.js';
import BentoCard from '../components/BentoCard.jsx';
import Avatar from '../components/Avatar.jsx';
import ContractTemplateCard from '../components/ContractTemplateCard.jsx';
import DeleteAccountModal from '../components/DeleteAccountModal.jsx';
import {
  Row,
  Section,
  Toggle,
  btnDangerOutline,
  btnPrimary,
  btnSecondary,
  inputClass,
} from '../components/SettingsParts.jsx';

// One page, grouped the way people think about an account:
//   Profile -> Notifications -> Contract template -> Security -> Legal -> Account
// A sticky section list on the left (large screens) jumps between them; every
// section is the same kind of card (title, one-line description, rows).
const NAV = [
  { id: 'profile', label: 'Profile', icon: faUser },
  { id: 'notifications', label: 'Notifications', icon: faBell },
  { id: 'contract', label: 'Contract template', icon: faFileContract },
  { id: 'security', label: 'Security', icon: faLock },
  { id: 'legal', label: 'Legal', icon: faScaleBalanced },
  { id: 'account', label: 'Account', icon: faUserGear },
];

const LEGAL_LINKS = [
  { to: '/terms', title: 'Terms of Service', hint: 'The rules for using Rentora.' },
  { to: '/privacy', title: 'Privacy Policy', hint: 'What we collect, why, and your rights.' },
  { to: '/tenant-notice', title: 'Tenant Privacy Notice', hint: 'Share this with your tenants - it explains how their data is used.' },
];

export default function Settings() {
  const {
    landlord,
    setLandlord,
    canChangePassword,
    changePassword: changeAccountPassword,
    deleteAccount,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(landlord?.name || '');
  const [address, setAddress] = useState(landlord?.address || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

  const [prefs, setPrefs] = useState(landlord?.notificationPreferences || {});
  const [prefError, setPrefError] = useState('');

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');

  // Highlight the section being read in the side list.
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean);
    if (!('IntersectionObserver' in window) || els.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -65% 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const profileDirty = name.trim() !== (landlord?.name || '') || address.trim() !== (landlord?.address || '');

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage({ type: '', text: '' });
    try {
      const { data } = await client.patch('/settings/profile', { name: name.trim(), address: address.trim() });
      setLandlord(data.landlord);
      setProfileMessage({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Could not save your profile. Please try again.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveNotification = async (key, value) => {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setPrefError('');
    try {
      const { data } = await client.patch('/settings/notifications', { [key]: value });
      setLandlord(data.landlord);
    } catch {
      setPrefs(previous);
      setPrefError('Could not save that change. Please try again.');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await changeAccountPassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordMessage({ type: 'ok', text: 'Password updated.' });
    } catch (err) {
      setPasswordMessage({ type: 'error', text: friendlyAuthError(err, 'Could not update password.') });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const confirmDelete = async ({ confirmEmail, password }) => {
    // Lets the login page say "your account was deleted" (router state would be
    // lost to the automatic redirect that happens when the session ends).
    try {
      sessionStorage.setItem('rentora:accountDeleted', '1');
    } catch {
      /* storage unavailable - the message is a nicety */
    }
    try {
      await deleteAccount({ confirmEmail, password });
    } catch (err) {
      try {
        sessionStorage.removeItem('rentora:accountDeleted');
      } catch {
        /* ignore */
      }
      throw err;
    }
    navigate('/login', { replace: true });
  };

  const note = (m) =>
    m.text ? <span className={`mr-auto text-sm ${m.type === 'ok' ? 'text-status-paid' : 'text-status-overdue'}`}>{m.text}</span> : null;

  return (
    <div className="max-w-6xl space-y-4 sm:space-y-6">
      <BentoCard className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Account
            </div>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:mt-1 sm:text-3xl">Settings</h1>
            <p className="mt-1 hidden text-sm text-ink/50 sm:block">
              Your profile, reminders, contract template and account.
            </p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{landlord?.name}</p>
              <p className="text-xs text-ink/50">{landlord?.email}</p>
            </div>
            <Avatar name={landlord?.name || landlord?.email} />
          </div>
        </div>
      </BentoCard>

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* Section list - large screens only; phones just scroll */}
        <nav aria-label="Settings sections" className="hidden rounded-bento bg-surface p-2 shadow-bento lg:sticky lg:top-6 lg:block">
          {NAV.map((item) => {
            const active = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveSection(item.id);
                }}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-canvas text-ink' : 'text-ink/55 hover:bg-canvas/70 hover:text-ink'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className={`h-3.5 w-3.5 ${active ? 'text-primary' : ''}`} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <form onSubmit={saveProfile}>
            <Section
              id="profile"
              title="Profile"
              description="Your name and address appear on the contracts you generate."
              footer={
                <>
                  {note(profileMessage)}
                  <button type="submit" disabled={!profileDirty || savingProfile} className={btnPrimary}>
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              }
            >
              <Row title="Name">
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Your name" className={inputClass} />
              </Row>
              <Row title="Address" description="Printed on your contracts.">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  minLength={5}
                  maxLength={300}
                  placeholder="House no., street, barangay, city"
                  className={inputClass}
                />
              </Row>
              <Row title="Email" description="The email you sign in with.">
                <p className="truncate text-sm text-ink/70">{landlord?.email}</p>
              </Row>
            </Section>
          </form>

          <Section id="notifications" title="Notifications" description="Choose which reminders you get.">
            <Row inline title="Rent reminders" description="Heads-up before rent and utility bills are due.">
              <Toggle label="Rent reminders" checked={!!prefs.rentReminders} onChange={(v) => saveNotification('rentReminders', v)} />
            </Row>
            <Row inline title="Contract expiration reminders" description="Heads-up before a tenant’s contract ends.">
              <Toggle label="Contract expiration reminders" checked={!!prefs.contractReminders} onChange={(v) => saveNotification('contractReminders', v)} />
            </Row>
            {prefError && <p className="px-4 py-3 text-sm text-status-overdue sm:px-6">{prefError}</p>}
          </Section>

          <ContractTemplateCard />

          {canChangePassword ? (
            <form onSubmit={changePassword}>
              <Section
                id="security"
                title="Security"
                description="Change the password you sign in with."
                footer={
                  <>
                    {note(passwordMessage)}
                    <button type="submit" disabled={savingPassword} className={btnPrimary}>
                      {savingPassword ? 'Updating…' : 'Update password'}
                    </button>
                  </>
                }
              >
                <Row title="Current password">
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    className={inputClass}
                  />
                </Row>
                <Row title="New password" description="At least 10 characters.">
                  <input
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className={inputClass}
                  />
                </Row>
              </Section>
            </form>
          ) : (
            <Section id="security" title="Security" description="How you sign in.">
              <Row title="Signed in with Google" description="Your password is managed by your Google account, so there is nothing to change here." />
            </Section>
          )}

          <Section id="legal" title="Legal" description="The documents that govern your use of Rentora.">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-canvas/60 sm:px-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink/50">{l.hint}</p>
                </div>
                <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3 shrink-0 text-ink/30" />
              </Link>
            ))}
          </Section>

          <Section id="account" title="Account" description={`Signed in as ${landlord?.email || ''}`}>
            <Row inline title="Log out" description="Sign out of Rentora on this device.">
              <button type="button" onClick={handleLogout} className={btnSecondary}>
                Log out
              </button>
            </Row>
          </Section>

          <Section tone="danger" title="Danger zone" description="Actions here can’t be undone.">
            <Row inline title="Delete account" description="Permanently delete your account and all your properties, tenants, contracts and payment records.">
              <button type="button" onClick={() => setShowDelete(true)} className={btnDangerOutline}>
                Delete account
              </button>
            </Row>
          </Section>
        </div>
      </div>

      <DeleteAccountModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        email={landlord?.email}
        needsPassword={canChangePassword}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
