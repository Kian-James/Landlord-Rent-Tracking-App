import React from 'react';
import { faShieldHalved, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import BentoCard from './BentoCard.jsx';
import StatCard from './StatCard.jsx';
import StatusBadge from './StatusBadge.jsx';
import Avatar from './Avatar.jsx';
import RentoraLogo from './RentoraLogo.jsx';

// The right-hand side of the auth pages is a small "taste of the app" built
// from the app's own components (StatCard, Avatar, StatusBadge, BentoCard),
// so the sign-in screen looks like the product it leads into. Sample figures
// only - decoration, not live data.
const SAMPLE_BILLS = [
  { name: 'Juan Dela Cruz', unit: 'Unit 101', amount: '₱8,500', status: 'paid' },
  { name: 'Ana Lim', unit: 'Townhome B', amount: '₱12,500', status: 'overdue' },
  { name: 'Maria Clara Reyes', unit: 'Unit 102', amount: '₱9,000', status: 'pending' },
];

function AppPreview() {
  return (
    <div className="pointer-events-none hidden select-none flex-col gap-4 lg:flex" aria-hidden="true">
      {/* Same eyebrow + greeting treatment as the Dashboard header card */}
      <BentoCard>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Rent &middot; Bills &middot; Tenants
        </div>
        <p className="mt-1 font-heading text-3xl font-bold leading-tight tracking-tight">
          Know who&apos;s paid, before you have to ask.
        </p>
        <p className="mt-2 text-sm text-ink/50">
          Everything about your properties in one calm place, with what needs attention on top.
        </p>
      </BentoCard>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={faShieldHalved}
          tone="paid"
          label="Collected to Date"
          pill={{ text: '68%' }}
          value="₱94,898"
          bar={[{ pct: 68, className: 'bg-status-paid' }]}
          captions={['15 of 22 bills paid']}
        />
        <StatCard
          icon={faTriangleExclamation}
          tone="overdue"
          label="Overdue Arrears"
          value="₱44,600"
          captions={['7 Overdue · 0 Pending due soon']}
        />
      </div>

      <BentoCard className="flex flex-1 flex-col p-0">
        <div className="px-6 py-4">
          <p className="text-sm font-semibold">This month&apos;s bills</p>
        </div>
        <ul className="flex flex-1 flex-col border-t border-line">
          {SAMPLE_BILLS.map((b) => (
            <li
              key={b.name}
              className={`flex flex-1 items-center gap-3 border-b border-b-line border-l-4 px-5 py-3 last:border-b-0 ${
                b.status === 'overdue' ? 'border-l-status-overdue bg-status-overdueSoft/30' : 'border-l-transparent'
              }`}
            >
              <Avatar name={b.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.name}</p>
                <p className="text-xs text-ink/50">{b.unit}</p>
              </div>
              <p className="text-sm font-semibold">{b.amount}</p>
              <div className="w-24 text-right">
                <StatusBadge status={b.status} />
              </div>
            </li>
          ))}
        </ul>
      </BentoCard>
    </div>
  );
}

// Shared frame for Login and Register: the form in a white bento card on the
// grey canvas, with the app preview beside it on large screens. Same canvas,
// card radius/shadow and pill controls as the rest of Rentora.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center bg-canvas px-4 py-8 sm:px-6">
      {/* items-stretch: the form card and the preview column always share one
          height - the shorter side grows to match the taller one. */}
      <div className="mx-auto grid w-full max-w-[1080px] items-stretch gap-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-8">
        <main className="flex flex-col">
          <BentoCard className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8 sm:p-10 lg:max-w-none">
            <RentoraLogo />
            <h1 className="mt-8 text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">{subtitle}</p>

            <div className="mt-7">{children}</div>

            <p className="mt-7 text-center text-sm text-ink/55">{footer}</p>
          </BentoCard>
        </main>

        <AppPreview />
      </div>
    </div>
  );
}
