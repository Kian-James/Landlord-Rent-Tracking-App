import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel } from '@fortawesome/free-solid-svg-icons';
import Modal from './Modal.jsx';
import MonthPicker from './MonthPicker.jsx';
import { MAX_EXPORT_MONTHS } from '../lib/ledgerExport.js';

const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();
const firstOf = (year, month) => new Date(year, month, 1);
const shiftMonths = (date, n) => firstOf(date.getFullYear(), date.getMonth() + n);

function PickerField({ label, value, onChange, min, max }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <MonthPicker
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        align="left"
        renderTrigger={({ open, toggle, label: text }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`flex h-11 w-full items-center rounded-full px-4 text-sm font-medium transition-colors ${
              open ? 'bg-surface ring-2 ring-primary/30' : 'bg-canvas hover:bg-line'
            }`}
          >
            {text}
          </button>
        )}
      />
    </div>
  );
}

// Mounted only while the modal is open (Modal renders nothing when closed),
// so its From/To state resets to the current month every time it opens.
function ExportForm({ defaultMonth, propertyLabel, onClose, onExport }) {
  const [from, setFrom] = useState(defaultMonth);
  const [to, setTo] = useState(defaultMonth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const count = monthIndex(to) - monthIndex(from) + 1;

  const now = new Date();
  const presets = [
    { label: 'This month', from: firstOf(now.getFullYear(), now.getMonth()), to: firstOf(now.getFullYear(), now.getMonth()) },
    { label: 'Last 3 months', from: shiftMonths(firstOf(now.getFullYear(), now.getMonth()), -2), to: firstOf(now.getFullYear(), now.getMonth()) },
    { label: 'Year to date', from: firstOf(now.getFullYear(), 0), to: firstOf(now.getFullYear(), now.getMonth()) },
    { label: `Full ${now.getFullYear()}`, from: firstOf(now.getFullYear(), 0), to: firstOf(now.getFullYear(), 11) },
  ];
  const presetActive = (p) => monthIndex(p.from) === monthIndex(from) && monthIndex(p.to) === monthIndex(to);

  const handleExport = async () => {
    setBusy(true);
    setError('');
    try {
      await onExport(from, to);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Could not create the Excel file. Please try again.');
      setBusy(false);
    }
  };

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        Choose which months to include. The file has a monthly summary plus every rent and utility bill in the range.
      </p>
      <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink/60">
        Properties included: <span className="font-semibold text-ink">{propertyLabel}</span>
        {propertyLabel !== 'All properties' && ' (change it with the property filter on the page)'}
      </p>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setFrom(p.from);
              setTo(p.to);
            }}
            className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
              presetActive(p) ? 'bg-primary text-white' : 'bg-canvas text-ink/70 hover:bg-line'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <PickerField
          label="From"
          value={from}
          onChange={setFrom}
          max={to}
          min={shiftMonths(to, -(MAX_EXPORT_MONTHS - 1))}
        />
        <PickerField
          label="To"
          value={to}
          onChange={setTo}
          min={from}
          max={shiftMonths(from, MAX_EXPORT_MONTHS - 1)}
        />
      </div>

      <p className="text-xs text-ink/50">
        {count === 1 ? `1 month: ${fmt(from)}` : `${count} months: ${fmt(from)} to ${fmt(to)}`}
        {' '}&middot; up to {MAX_EXPORT_MONTHS} months at a time
      </p>

      {error && <p className="text-sm text-status-overdue">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="h-10 rounded-full border border-line px-4 text-sm font-medium text-ink/60 hover:bg-canvas disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          <FontAwesomeIcon icon={faFileExcel} />
          {busy ? 'Preparing...' : 'Export .xlsx'}
        </button>
      </div>
    </div>
  );
}

export default function ExportRangeModal({ open, onClose, defaultMonth, onExport, propertyLabel = 'All properties' }) {
  return (
    <Modal open={open} onClose={onClose} title="Export to Excel" size="md">
      <ExportForm defaultMonth={defaultMonth} propertyLabel={propertyLabel} onClose={onClose} onExport={onExport} />
    </Modal>
  );
}
