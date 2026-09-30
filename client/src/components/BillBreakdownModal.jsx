import React from 'react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { BILL_TYPE_META, BillIcon } from '../lib/billIcons.jsx';
import { peso, sum, pctOf, plural, STATUS_META } from '../lib/breakdown.js';
import { BarRow, SectionTitle } from './breakdownParts.jsx';

const TYPES = ['rent', 'electricity', 'water', 'wifi'];
const TYPE_DOT = {
  rent: 'bg-primary',
  electricity: 'bg-status-pending',
  water: 'bg-status-upcoming',
  wifi: 'bg-status-verify',
};
const BILL_STATUS_ORDER = ['paid', 'pending', 'overdue', 'upcoming'];

const TITLES = {
  obligations: 'Total obligations',
  collected: 'Collected',
  overdue: 'Overdue bills',
};
const VIEW_LABEL = { obligations: 'View all bills', collected: 'View paid bills', overdue: 'View overdue bills' };
const VIEW_STATUS = { obligations: 'all', collected: 'paid', overdue: 'overdue' };

function ObligationsBody({ items }) {
  const total = sum(items);
  const unpriced = items.filter((i) => i.amount === null || i.amount === undefined).length;

  // Only show a "by property" section when every bill actually carries a
  // property name - otherwise the split would silently misattribute bills.
  const propertyOf = (i) => i.raw?.property?.name;
  const canGroupByProperty = items.length > 0 && items.every((i) => propertyOf(i));
  const properties = canGroupByProperty
    ? [...new Set(items.map(propertyOf))].map((name) => {
        const list = items.filter((i) => propertyOf(i) === name);
        return { name, count: list.length, amount: sum(list) };
      }).sort((a, b) => b.amount - a.amount)
    : [];

  return (
    <>
      <p className="text-3xl font-bold tracking-tight">{peso(total)}</p>
      <p className="mt-0.5 text-sm text-ink/50">across {plural(items.length, 'bill')}</p>
      {unpriced > 0 && (
        <p className="mt-2 rounded-lg bg-status-pendingSoft px-3 py-2 text-xs text-status-pending">
          {plural(unpriced, 'bill')} {unpriced === 1 ? 'has' : 'have'} no amount set yet, so
          {unpriced === 1 ? " it isn't" : " they aren't"} counted in these totals.
        </p>
      )}

      <SectionTitle>By bill type</SectionTitle>
      <div className="space-y-3.5">
        {TYPES.map((type) => {
          const list = items.filter((i) => i.billType === type);
          return (
            <BarRow
              key={type}
              dot={TYPE_DOT[type]}
              label={BILL_TYPE_META[type].label}
              sub={plural(list.length, 'bill')}
              amount={sum(list)}
              pct={pctOf(sum(list), total)}
            />
          );
        })}
      </div>

      {properties.length > 1 && (
        <>
          <SectionTitle>By property</SectionTitle>
          <div className="space-y-3.5">
            {properties.map((pr) => (
              <BarRow
                key={pr.name}
                dot="bg-primary"
                label={pr.name}
                sub={plural(pr.count, 'bill')}
                amount={pr.amount}
                pct={pctOf(pr.amount, total)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CollectedBody({ items }) {
  const total = sum(items);
  const paid = items.filter((i) => i.status === 'paid');
  const collected = sum(paid);
  const rate = pctOf(collected, total);

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-status-paid">{peso(collected)}</p>
          <p className="mt-0.5 text-sm text-ink/50">collected of {peso(total)}</p>
        </div>
        <span className="rounded-full bg-status-paidSoft px-3 py-1 text-sm font-semibold text-status-paid">{rate}%</span>
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-line">
        {BILL_STATUS_ORDER.map((st) => (
          <div
            key={st}
            className={`h-full ${STATUS_META[st].dot}`}
            style={{ width: `${pctOf(sum(items.filter((i) => i.status === st)), total)}%` }}
          />
        ))}
      </div>

      <SectionTitle>Where the money stands</SectionTitle>
      <div className="space-y-3.5">
        {BILL_STATUS_ORDER.map((st) => {
          const list = items.filter((i) => i.status === st);
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

      <SectionTitle>Collection rate by bill type</SectionTitle>
      <div className="space-y-3.5">
        {TYPES.map((type) => {
          const list = items.filter((i) => i.billType === type);
          const typeTotal = sum(list);
          const typePaid = sum(list.filter((i) => i.status === 'paid'));
          return (
            <BarRow
              key={type}
              dot={TYPE_DOT[type]}
              label={BILL_TYPE_META[type].label}
              sub={`of ${peso(typeTotal)}`}
              amount={typePaid}
              pct={pctOf(typePaid, typeTotal)}
            />
          );
        })}
      </div>
    </>
  );
}

function daysLate(dueDate) {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000));
}

function OverdueBody({ items }) {
  const overdue = items.filter((i) => i.status === 'overdue');
  if (overdue.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-medium">Nothing is overdue</p>
        <p className="mt-1 text-sm text-ink/50">Every bill is either paid or not yet late.</p>
      </div>
    );
  }

  // Group by tenant + unit so it's obvious who owes what, biggest debt first.
  const groups = new Map();
  overdue.forEach((i) => {
    const key = `${i.tenantName || 'Vacant'}|${i.unitName || ''}`;
    if (!groups.has(key)) groups.set(key, { tenant: i.tenantName || 'Vacant', unit: i.unitName, bills: [] });
    groups.get(key).bills.push(i);
  });
  const tenants = [...groups.values()]
    .map((g) => ({
      ...g,
      total: sum(g.bills),
      bills: [...g.bills].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <p className="text-3xl font-bold tracking-tight text-status-overdue">{peso(sum(overdue))}</p>
      <p className="mt-0.5 text-sm text-ink/50">
        past due &middot; {plural(overdue.length, 'bill')} from {plural(tenants.length, 'tenant')}
      </p>

      <div className="mt-4 max-h-[46vh] space-y-4 overflow-y-auto pr-1">
        {tenants.map((g) => (
          <div key={`${g.tenant}|${g.unit}`} className="rounded-xl border border-line">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas/50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={g.tenant} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{g.tenant}</p>
                  <p className="text-xs text-ink/50">{g.unit}</p>
                </div>
              </div>
              <p className="shrink-0 text-sm font-semibold text-status-overdue">{peso(g.total)}</p>
            </div>
            <ul className="divide-y divide-line">
              {g.bills.map((b) => (
                <li key={`${b.billType}-${b.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-overdueSoft text-status-overdue">
                      <BillIcon type={b.billType} className="text-[11px]" />
                    </span>
                    <span className="truncate">{BILL_TYPE_META[b.billType].label}</span>
                    <span className="shrink-0 text-xs text-ink/45">
                      due {new Date(b.dueDate).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs font-medium text-status-overdue">{daysLate(b.dueDate)}d late</span>
                    <span className="w-20 text-right font-medium">
                      {b.amount == null ? 'Not set' : peso(b.amount)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

// `kind` is 'obligations' | 'collected' | 'overdue' (null = closed).
// `items` is the page's full normalized bill list; each body derives its own
// numbers from it so the modal always agrees with the cards.
export default function BillBreakdownModal({ kind, items, onClose, onViewList }) {
  return (
    <Modal open={!!kind} onClose={onClose} title={kind ? TITLES[kind] : ''} size="lg">
      {kind && (
        <>
          <div className="max-h-[68vh] overflow-y-auto pr-1">
            {kind === 'obligations' && <ObligationsBody items={items} />}
            {kind === 'collected' && <CollectedBody items={items} />}
            {kind === 'overdue' && <OverdueBody items={items} />}
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-line px-4 text-sm font-medium text-ink/60 hover:bg-canvas"
            >
              Close
            </button>
            {!(kind === 'overdue' && !items.some((i) => i.status === 'overdue')) && (
            <button
              type="button"
              onClick={() => onViewList(VIEW_STATUS[kind])}
              className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {VIEW_LABEL[kind]}
            </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
