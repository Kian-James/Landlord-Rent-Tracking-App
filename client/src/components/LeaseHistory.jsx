import React, { useEffect, useState } from 'react';
import client from '../api/client.js';
import { Skeleton } from './Skeleton.jsx';
import { peso } from '../lib/breakdown.js';
import { fmtLeaseDate, leaseStatus } from '../lib/leaseStatus.js';

// Every lease a tenant has had, newest first. Renewing a lease keeps the old
// one on file, and this is where those earlier leases can be looked at.
// Loaded from GET /tenants/:id, which returns the tenant plus all their contracts.
export default function LeaseHistory({ tenantId }) {
  const [contracts, setContracts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    client
      .get(`/tenants/${tenantId}`)
      .then(({ data }) => {
        if (!ignore) setContracts(data.contracts);
      })
      .catch(() => {
        if (!ignore) setError('Could not load lease history.');
      });
    return () => {
      ignore = true;
    };
  }, [tenantId]);

  return (
    <div className="border-t border-line pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
        Lease history{contracts ? ` \u00b7 ${contracts.length}` : ''}
      </p>

      {error && <p className="mt-2 text-sm text-status-overdue">{error}</p>}

      {!error && contracts === null && <Skeleton className="mt-2 h-14 w-full rounded-xl" />}

      {contracts && contracts.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {contracts.map((c) => {
            const s = leaseStatus(c.status);
            return (
              <li key={c._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {fmtLeaseDate(c.startDate)} &ndash; {fmtLeaseDate(c.endDate)}
                  </span>
                  <span className="block text-xs text-ink/50">
                    {c.durationMonths} month(s) &middot; Advance {peso(c.advanceAmount)} &middot; Deposit {peso(c.depositAmount)}
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

      {contracts && contracts.length === 1 && (
        <p className="mt-2 text-[11px] text-ink/40">No earlier leases yet. When this lease is renewed, the old one is kept here.</p>
      )}
    </div>
  );
}
