import React, { useState } from 'react';
import client from '../api/client.js';
import Modal from './Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const noop = () => {};

// Contracts print the landlord's address, so every landlord needs one on file. Anyone who
// doesn't have one yet is asked for it here (it can't be skipped), then carries on as normal.
// Before the database update that adds the address column, `landlord.address` isn't a string
// at all, and nothing is asked.
export default function AddressGate() {
  const { landlord, setLandlord } = useAuth();
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const missing = landlord && typeof landlord.address === 'string' && landlord.address.trim().length < 5;
  if (!missing) return null;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (address.trim().length < 5) {
      setError('Enter your full address (house no., street, barangay, city, province).');
      return;
    }
    setSaving(true);
    try {
      const { data } = await client.patch('/settings/profile', { name: landlord.name, address: address.trim() });
      setLandlord(data.landlord);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not save your address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={noop} title="Add your address" size="md">
      <form onSubmit={save} className="space-y-3">
        <p className="text-sm text-ink/60">
          Your address is printed on your lease contracts, so we need it before you continue. You can change it any time in Settings.
        </p>
        <input
          autoFocus
          required
          minLength={5}
          maxLength={300}
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="House no., street, barangay, city, province"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-status-overdue">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving\u2026' : 'Save address'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
