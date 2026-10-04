import React, { useEffect, useState } from 'react';
import client from '../api/client.js';
import StatModal from './StatModal.jsx';
import { Skeleton } from './Skeleton.jsx';
import { SectionTitle } from './breakdownParts.jsx';
import { peso, pctOf, plural } from '../lib/breakdown.js';

const UNIT_STATUS = {
  occupied: { label: 'Occupied', badge: 'bg-status-paidSoft text-status-paid' },
  vacant: { label: 'Vacant', badge: 'bg-status-upcomingSoft text-status-upcoming' },
  maintenance: { label: 'Maintenance', badge: 'bg-status-pendingSoft text-status-pending' },
  reserved: { label: 'Reserved', badge: 'bg-status-verifySoft text-status-verify' },
};
const STATUS_ORDER = ['occupied', 'vacant', 'reserved', 'maintenance'];

const UTILITY_LABELS = { electricity: 'Electricity', water: 'Water', wifi: 'Wifi' };

const unitUtilities = (unit) =>
  Object.entries(UTILITY_LABELS)
    .filter(([key]) => unit.utilities?.[key]?.amount > 0 || unit.utilities?.[key]?.dueDay)
    .map(([, label]) => label);

// One property at a glance: address, occupancy, potential rent and every unit.
// Loaded from GET /properties/:id. Mount it with a `key` of the property id so
// opening a different property starts a fresh load.
export default function PropertyDetailModal({ propertyId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    client
      .get(`/properties/${propertyId}`)
      .then((res) => {
        if (!ignore) setData(res.data);
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.error?.message || 'Could not load this property.');
      });
    return () => {
      ignore = true;
    };
  }, [propertyId]);

  const property = data?.property;
  const units = [...(data?.units || [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const occupied = units.filter((u) => u.status === 'occupied').length;
  const potentialRent = units.reduce((sum, u) => sum + (u.monthlyRent || 0), 0);

  return (
    <StatModal open title={property?.name || 'Property details'} onClose={onClose}>
      {error && <p className="text-sm text-status-overdue">{error}</p>}

      {!error && !data && (
        <div className="space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {property && (
        <>
          <p className="text-sm text-ink/60">{property.address}</p>
          {property.description && <p className="mt-1 text-sm text-ink/50">{property.description}</p>}

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink/40">Units</p>
              <p className="mt-0.5 text-xl font-bold">{units.length}</p>
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink/40">Occupied</p>
              <p className="mt-0.5 text-xl font-bold">
                {occupied}
                <span className="ml-1 text-xs font-medium text-ink/45">{pctOf(occupied, units.length)}%</span>
              </p>
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink/40">Potential rent</p>
              <p className="mt-0.5 text-xl font-bold">
                {peso(potentialRent)}
                <span className="text-xs font-medium text-ink/45">/mo</span>
              </p>
            </div>
          </div>

          <SectionTitle>Units &middot; {units.length}</SectionTitle>
          {units.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
              This property has no units yet. Turn on Manage mode to add one.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {units.map((u) => {
                const s = UNIT_STATUS[u.status] || { label: u.status, badge: 'bg-canvas text-ink/60' };
                const utilities = unitUtilities(u);
                return (
                  <li key={u._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-ink/50">
                        {utilities.length > 0 ? `Utilities: ${utilities.join(', ')}` : 'No utilities set'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold">{peso(u.monthlyRent)}/mo</span>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>
                        {s.label}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {units.length > 0 && (
            <p className="mt-3 text-xs text-ink/45">
              {STATUS_ORDER.map((key) => [key, units.filter((u) => u.status === key).length])
                .filter(([, n]) => n > 0)
                .map(([key, n]) => `${plural(n, 'unit')} ${UNIT_STATUS[key].label.toLowerCase()}`)
                .join(' \u00b7 ')}
            </p>
          )}
        </>
      )}
    </StatModal>
  );
}
