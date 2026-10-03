import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faPen, faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import Avatar from './Avatar.jsx';
import { BillIcon } from '../lib/billIcons.jsx';
import { peso } from '../lib/breakdown.js';

// One unit inside a property card. The coloured top edge + a bold status pill
// make a unit's state readable at a glance (Occupied / Vacant / Maintenance /
// Reserved), the rent is the headline number, utilities are colour-coded
// chips (same colours as the Bill Checklist), and the tenant gets its own strip.
// The Edit unit button only appears when the page is in Manage mode.

const STATUS = {
  occupied: {
    label: 'Occupied',
    accent: 'border-t-status-paid',
    badge: 'bg-status-paidSoft text-status-paid',
    dot: 'bg-status-paid',
  },
  vacant: {
    label: 'Vacant',
    accent: 'border-t-status-upcoming',
    badge: 'bg-status-upcomingSoft text-status-upcoming',
    dot: 'bg-status-upcoming',
  },
  maintenance: {
    label: 'Maintenance',
    accent: 'border-t-status-pending',
    badge: 'bg-status-pendingSoft text-status-pending',
    dot: 'bg-status-pending',
  },
  reserved: {
    label: 'Reserved',
    accent: 'border-t-status-verify',
    badge: 'bg-status-verifySoft text-status-verify',
    dot: 'bg-status-verify',
  },
};

const UTILITY_CHIPS = [
  { key: 'electricity', label: 'Electricity', tone: 'bg-status-pendingSoft text-status-pending' },
  { key: 'water', label: 'Water', tone: 'bg-status-upcomingSoft text-status-upcoming' },
  { key: 'wifi', label: 'Wifi', tone: 'bg-status-verifySoft text-status-verify' },
];

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function ordinalDay(day) {
  if (!day) return null;
  const suffix = ['th', 'st', 'nd', 'rd'][day % 10 > 3 || Math.floor((day % 100) / 10) === 1 ? 0 : day % 10];
  return `${day}${suffix}`;
}

function TenantStrip({ unit }) {
  if (unit.status === 'occupied') {
    const name = unit.currentTenant?.fullName;
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2">
        <Avatar name={name || unit.name} size="sm" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-ink/40">Current tenant</p>
          <p className="truncate text-sm font-medium">{name || 'Tenant on file'}</p>
        </div>
      </div>
    );
  }

  const copy = {
    maintenance: { icon: faScrewdriverWrench, text: 'Under maintenance, not available to rent' },
    reserved: { icon: faKey, text: 'Reserved for an upcoming tenant' },
  }[unit.status] || { icon: faKey, text: 'No tenant yet, available to rent' };

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink/50">
      <FontAwesomeIcon icon={copy.icon} className="h-3 w-3 shrink-0 text-ink/35" />
      {copy.text}
    </div>
  );
}

export default function UnitCard({ unit, onEdit, manage = false }) {
  const s = STATUS[unit.status] || {
    label: capitalize(unit.status) || 'Unknown',
    accent: 'border-t-line',
    badge: 'bg-canvas text-ink/60',
    dot: 'bg-ink/30',
  };

  const chips = UTILITY_CHIPS.filter(({ key }) => unit.utilities?.[key]?.amount > 0 || unit.utilities?.[key]?.dueDay);

  return (
    <div
      className={`flex flex-col rounded-card border border-t-4 border-line bg-surface p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-card ${s.accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-base font-semibold leading-tight">{unit.name}</p>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
          {s.label}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink/40">Monthly rent</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight">{peso(unit.monthlyRent)}</p>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map(({ key, label, tone }) => {
            const cfg = unit.utilities[key];
            return (
              <span
                key={key}
                title={label}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}
              >
                <BillIcon type={key} />
                {cfg.amount > 0 ? peso(cfg.amount) : 'Amount not set'}
                {cfg.dueDay ? ` \u00b7 due ${ordinalDay(cfg.dueDay)}` : ''}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-auto space-y-3 pt-4">
        <TenantStrip unit={unit} />
        {manage && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:bg-canvas hover:text-ink"
          >
            <FontAwesomeIcon icon={faPen} className="h-2.5 w-2.5" />
            Edit unit
          </button>
        )}
      </div>
    </div>
  );
}
