import React from 'react';
import StatModal from './StatModal.jsx';
import Avatar from './Avatar.jsx';
import { SectionTitle } from './breakdownParts.jsx';
import { peso, plural } from '../lib/breakdown.js';

// Dashboard "Awaiting Review": tenant payments submitted but not yet approved.
export default function ReviewStatModal({ open, payments, totals, onClose }) {
  const list = payments || [];
  const amountOf = (p) => p.actualAmount ?? p.expectedAmount;
  const total = list.reduce((s, p) => s + (amountOf(p) || 0), 0);

  return (
    <StatModal open={open} title="Awaiting review" onClose={onClose} action={{ label: 'Open Bill Checklist', to: '/bills' }}>
      <p className="text-3xl font-bold tracking-tight text-status-verify">{list.length}</p>
      <p className="mt-0.5 text-sm text-ink/50">
        {plural(list.length, 'payment')} waiting for you to confirm
        {list.length > 0 && ` \u00b7 ${peso(total)} in total`}
      </p>

      <SectionTitle>Waiting for approval</SectionTitle>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
          Nothing to review right now.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {list.map((p) => (
            <li key={p._id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={p.tenant?.fullName} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.tenant?.fullName}</span>
                  <span className="block text-xs text-ink/50">
                    {[p.unit?.name, p.method, p.paymentDate && new Date(p.paymentDate).toLocaleDateString()]
                      .filter(Boolean)
                      .join(' \u00b7 ')}
                  </span>
                </span>
              </span>
              <span className="shrink-0 font-semibold">{peso(amountOf(p))}</span>
            </li>
          ))}
        </ul>
      )}

      {totals && (
        <>
          <SectionTitle>This cycle at a glance</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Paid', totals.paid, 'text-status-paid'],
              ['Pending', totals.pending, 'text-status-pending'],
              ['Overdue', totals.overdue, 'text-status-overdue'],
              ['Awaiting', totals.verification ?? 0, 'text-status-verify'],
            ].map(([label, n, tone]) => (
              <div key={label} className="rounded-xl bg-canvas px-3 py-2.5">
                <p className={`text-xl font-bold ${tone}`}>{n}</p>
                <p className="text-xs text-ink/50">{label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </StatModal>
  );
}
