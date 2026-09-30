import React from 'react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import StatusBadge from './StatusBadge.jsx';
import { peso, sum, pctOf, plural, STATUS_ORDER, STATUS_META } from '../lib/breakdown.js';
import { BarRow, SectionTitle } from './breakdownParts.jsx';

const TITLES = { target: 'Cycle target', collected: 'Collected to date', remaining: 'Remaining & arrears' };

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// "43d late", "due today", "in 5d" - relative to today, only meaningful for unpaid rent.
function dueNote(item) {
  const diff = Math.round((startOfDay(new Date(item.dueDate)) - startOfDay(new Date())) / DAY);
  if (item.status === 'overdue') return { text: `${Math.max(1, Math.abs(diff))}d late`, tone: 'text-status-overdue' };
  if (diff === 0) return { text: 'due today', tone: 'text-status-pending' };
  if (diff > 0) return { text: `in ${diff}d`, tone: 'text-ink/50' };
  return { text: `${Math.abs(diff)}d ago`, tone: 'text-ink/50' };
}

function RentRow({ item, showBadge = false, showNote = false }) {
  const note = showNote ? dueNote(item) : null;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={item.tenantName || item.unitName} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{item.tenantName || 'Vacant'}</span>
          <span className="block text-xs text-ink/50">
            {item.unitName} &middot; due {new Date(item.dueDate).toLocaleDateString()}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {note && <span className={`text-xs font-medium ${note.tone}`}>{note.text}</span>}
        {showBadge && <StatusBadge status={item.status} />}
        <span className="w-20 text-right font-semibold">{peso(item.amount)}</span>
      </span>
    </li>
  );
}

function RentList({ items, ...rowProps }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {items.map((item) => (
        <RentRow key={`${item.billType}-${item.id}`} item={item} {...rowProps} />
      ))}
    </ul>
  );
}

const byDue = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);

function StatusSplit({ rent, total }) {
  return (
    <>
      <SectionTitle>Where it stands</SectionTitle>
      <div className="space-y-3.5">
        {STATUS_ORDER.map((st) => {
          const list = rent.filter((i) => i.status === st);
          if (list.length === 0 && st !== 'paid') return null;
          return (
            <BarRow
              key={st}
              dot={STATUS_META[st].dot}
              label={STATUS_META[st].label}
              sub={plural(list.length, 'bill')}
              amount={sum(list)}
              pct={pctOf(sum(list), total)}
            />
          );
        })}
      </div>
    </>
  );
}

function TargetBody({ rent, other, periodLabel }) {
  const total = sum(rent);
  const utilTotal = sum(other);
  return (
    <>
      <p className="text-3xl font-bold tracking-tight">{peso(total)}</p>
      <p className="mt-0.5 text-sm text-ink/50">
        rent scheduled for {periodLabel} &middot; {plural(rent.length, 'bill')}
      </p>
      {utilTotal > 0 && (
        <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink/60">
          Not included: {peso(utilTotal)} in electricity, water and wifi is also due this month. Those are tracked in
          the Bill Checklist.
        </p>
      )}
      <StatusSplit rent={rent} total={total} />
      <SectionTitle>Rent schedule</SectionTitle>
      <RentList items={[...rent].sort(byDue)} showBadge />
    </>
  );
}

function CollectedBody({ rent }) {
  const total = sum(rent);
  const paid = rent.filter((i) => i.status === 'paid').sort(byDue);
  const collected = sum(paid);
  const rate = pctOf(collected, total);
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-status-paid">{peso(collected)}</p>
          <p className="mt-0.5 text-sm text-ink/50">
            collected of {peso(total)} &middot; {paid.length} of {plural(rent.length, 'rent bill')} paid
          </p>
        </div>
        <span className="rounded-full bg-status-paidSoft px-3 py-1 text-sm font-semibold text-status-paid">{rate}%</span>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-line">
        {STATUS_ORDER.map((st) => (
          <div
            key={st}
            className={`h-full ${STATUS_META[st].dot}`}
            style={{ width: `${pctOf(sum(rent.filter((i) => i.status === st)), total)}%` }}
          />
        ))}
      </div>
      <StatusSplit rent={rent} total={total} />
      <SectionTitle>Paid so far</SectionTitle>
      {paid.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-ink/50">
          No rent has been marked paid for this month yet.
        </p>
      ) : (
        <RentList items={paid} />
      )}
    </>
  );
}

function RemainingBody({ rent }) {
  const open = rent.filter((i) => i.status !== 'paid');
  const overdue = open.filter((i) => i.status === 'overdue').sort(byDue);
  const notLate = open.filter((i) => i.status !== 'overdue').sort(byDue);
  const outstanding = sum(open);

  if (open.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-medium">Everything is collected</p>
        <p className="mt-1 text-sm text-ink/50">No rent is outstanding for this month.</p>
      </div>
    );
  }

  const tenants = new Set(overdue.map((i) => i.tenantName || i.unitName)).size;
  return (
    <>
      <p className="text-3xl font-bold tracking-tight text-status-overdue">{peso(outstanding)}</p>
      <p className="mt-0.5 text-sm text-ink/50">
        still to collect &middot; {plural(open.length, 'bill')}
        {overdue.length > 0 && ` · ${plural(tenants, 'tenant')} overdue`}
      </p>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full bg-status-overdue" style={{ width: `${pctOf(sum(overdue), outstanding)}%` }} />
        <div className="h-full bg-status-upcoming" style={{ width: `${pctOf(sum(notLate), outstanding)}%` }} />
      </div>

      {overdue.length > 0 && (
        <>
          <SectionTitle>Overdue &middot; {peso(sum(overdue))}</SectionTitle>
          <RentList items={overdue} showNote />
        </>
      )}
      {notLate.length > 0 && (
        <>
          <SectionTitle>Not late yet &middot; {peso(sum(notLate))}</SectionTitle>
          <RentList items={notLate} showBadge showNote />
        </>
      )}
    </>
  );
}

// kind: 'target' | 'collected' | 'remaining' (null = closed).
// `items` is the page's normalized bill list for the viewed month (rent +
// utilities). The cards only count rent, so the modal splits it the same way.
export default function CycleBreakdownModal({ kind, items, periodLabel, onClose }) {
  const rent = items.filter((i) => i.billType === 'rent');
  const other = items.filter((i) => i.billType !== 'rent');
  return (
    <Modal open={!!kind} onClose={onClose} title={kind ? `${TITLES[kind]} \u00b7 ${periodLabel}` : ''} size="lg">
      {kind && (
        <>
          <div className="max-h-[68vh] overflow-y-auto pr-1">
            {kind === 'target' && <TargetBody rent={rent} other={other} periodLabel={periodLabel} />}
            {kind === 'collected' && <CollectedBody rent={rent} />}
            {kind === 'remaining' && <RemainingBody rent={rent} />}
          </div>
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-line px-5 text-sm font-medium text-ink/60 hover:bg-canvas"
            >
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
