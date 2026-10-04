import React, { useEffect, useState } from 'react';
import client from '../api/client.js';
import StatModal from './StatModal.jsx';
import Avatar from './Avatar.jsx';
import { Skeleton } from './Skeleton.jsx';
import { peso } from '../lib/breakdown.js';
import { fmtLeaseDate, leaseStatus } from '../lib/leaseStatus.js';

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['superseded', 'Renewed'],
  ['expired', 'Expired'],
  ['terminated', 'Terminated'],
];

// Every lease across all tenants, filterable by status. Loaded from
// GET /contracts. `tenants` is only used to look up the property name,
// since the contracts endpoint embeds the tenant and unit but not the property.
export default function AllLeasesModal({ open, onClose, tenants }) {
  return (
    <StatModal open={open} title="All leases" onClose={onClose}>
      <AllLeasesBody tenants={tenants} />
    </StatModal>
  );
}

function AllLeasesBody({ tenants }) {
  const [status, setStatus] = useState('all');
  const [contracts, setContracts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    client
      .get('/contracts', { params: status === 'all' ? {} : { status } })
      .then(({ data }) => {
        if (ignore) return;
        setContracts(data.contracts);
        setError('');
      })
      .catch(() => {
        if (!ignore) setError('Could not load leases.');
      });
    return () => {
      ignore = true;
    };
  }, [status]);

  const pickFilter = (key) => {
    if (key === status) return;
    setContracts(null);
    setStatus(key);
  };

  const propertyByTenantId = new Map(tenants.map((t) => [t._id, t.property?.name]));

  return (
    <>
      <div role="group" aria-label="Filter leases" className="scrollbar-hide flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-canvas p-1">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => pickFilter(key)}
            aria-pressed={status === key}
            className={`h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
              status === key ? 'bg-primary text-white' : 'text-ink/60 hover:bg-line'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-status-overdue">{error}</p>}

      {!error && contracts === null && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      )}

      {contracts && contracts.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
          No leases match this filter.
        </p>
      )}

      {contracts && contracts.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {contracts.map((c) => {
            const s = leaseStatus(c.status);
            const name = c.tenant?.fullName || 'Unknown tenant';
            const place = [propertyByTenantId.get(c.tenant?._id), c.unit?.name].filter(Boolean).join(' \u00b7 ');
            return (
              <li key={c._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    {place && <span className="block truncate text-xs text-ink/50">{place}</span>}
                    <span className="block text-xs text-ink/40">
                      {fmtLeaseDate(c.startDate)} &ndash; {fmtLeaseDate(c.endDate)}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold">{peso(c.monthlyRent)}/mo</span>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
