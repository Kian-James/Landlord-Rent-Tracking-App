import React from 'react';
import { peso } from '../lib/breakdown.js';

// Visual building blocks shared by the breakdown modals (Bill Checklist and
// Calendar), so both read the same.

export function SectionTitle({ children }) {
  return <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink/50">{children}</p>;
}

// One labelled bar: dot + label (+ optional sub-label) on the left, amount and
// percentage on the right, and a thin proportional bar underneath.
export function BarRow({ dot, label, sub, amount, pct }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
          <span className="truncate font-medium">{label}</span>
          {sub && <span className="shrink-0 text-xs text-ink/45">{sub}</span>}
        </span>
        <span className="shrink-0 text-right">
          <span className="font-semibold">{peso(amount)}</span>
          <span className="inline-block w-10 text-xs text-ink/45">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${dot}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
