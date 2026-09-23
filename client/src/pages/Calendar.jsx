import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client.js';
import BentoCard from '../components/BentoCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import { Skeleton, SkeletonText } from '../components/Skeleton.jsx';
import { buildMonthGrid, periodKeyOf } from '../lib/calendarGrid.js';
import { BILL_TYPE_META, BillIcon } from '../lib/billIcons.jsx';

function peso(amount) {
  if (amount === null || amount === undefined) return 'Amount not set';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);
}

const DOT_FOR_STATUS = {
  paid: 'bg-status-paid',
  pending: 'bg-status-pending',
  overdue: 'bg-status-overdue',
  upcoming: 'bg-status-upcoming',
};

const LEDGER_FILTERS = ['all', 'paid', 'pending', 'overdue', 'upcoming'];

function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <BentoCard key={i}>
            <SkeletonText width="w-24" className="h-3" />
            <Skeleton className="mt-2 h-6 w-28" />
          </BentoCard>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <BentoCard span={2}>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
            ))}
          </div>
        </BentoCard>
        <BentoCard className="space-y-2">
          <SkeletonText width="w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </BentoCard>
      </div>

      <BentoCard>
        <SkeletonText width="w-40" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </BentoCard>
    </div>
  );
}

function normalizeRent(r) {
  return {
    id: r._id,
    billType: 'rent',
    tenantName: r.tenant?.fullName,
    unitName: r.unit?.name,
    amount: r.amountDue,
    dueDate: r.dueDate,
    status: r.status,
  };
}

function normalizeUtility(b) {
  return {
    id: b._id,
    billType: b.type,
    tenantName: b.tenant?.fullName,
    unitName: b.unit?.name,
    amount: b.status === 'paid' && b.paidAmount != null ? b.paidAmount : b.amountDue,
    dueDate: b.dueDate,
    status: b.status,
  };
}

export default function Calendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const calendarCardRef = useRef(null);
  const [calendarHeight, setCalendarHeight] = useState(null);

  useLayoutEffect(() => {
    const el = calendarCardRef.current;
    if (!el) return undefined;

    const measure = () => setCalendarHeight(el.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor]);
  const [records, setRecords] = useState([]);
  const [utilityBills, setUtilityBills] = useState([]);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const period = periodKeyOf(cursor);
  const today = new Date();

  const load = () => {
    Promise.all([
      client.post('/rent-records/generate', { referenceDate: cursor.toISOString() }),
      client.post('/utility-bills/generate', { referenceDate: cursor.toISOString() }),
    ]).then(() =>
      Promise.all([
        client.get('/rent-records', { params: { period } }),
        client.get('/utility-bills', { params: { period } }),
      ])
    ).then(([rentRes, utilityRes]) => {
      setRecords(rentRes.data.records);
      setUtilityBills(utilityRes.data.records);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [period]);

  const weeks = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const allItems = useMemo(
    () => [...records.map(normalizeRent), ...utilityBills.map(normalizeUtility)],
    [records, utilityBills]
  );

  const itemsByDay = useMemo(() => {
    const map = {};
    allItems.forEach((item) => {
      const day = new Date(item.dueDate).getDate();
      map[day] = map[day] || [];
      map[day].push(item);
    });
    return map;
  }, [allItems]);

  const totals = records.reduce(
    (acc, r) => {
      if (r.status === 'paid') acc.paid += r.amountDue;
      else acc.outstanding += r.amountDue;
      acc.expected += r.amountDue;
      return acc;
    },
    { expected: 0, paid: 0, outstanding: 0 }
  );

  const filteredLedger = records
    .filter((r) => ledgerFilter === 'all' || r.status === ledgerFilter)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = periodKeyOf(cursor) === periodKeyOf(today);

  const upcomingBills = allItems
    .filter((i) => i.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (loading) return <CalendarSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Rent &amp; Bill Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-line px-1 py-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-full px-2 py-1 text-sm text-ink/60 hover:bg-canvas"
              aria-label="Previous month"
            >
              &lsaquo;
            </button>
            <span className="px-2 text-sm font-medium">{monthLabel}</span>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-full px-2 py-1 text-sm text-ink/60 hover:bg-canvas"
              aria-label="Next month"
            >
              &rsaquo;
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BentoCard>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Cycle Target</p>
          <p className="mt-1 text-xl font-semibold">{peso(totals.expected)}</p>
        </BentoCard>
        <BentoCard>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Collected</p>
          <p className="mt-1 text-xl font-semibold text-status-paid">{peso(totals.paid)}</p>
        </BentoCard>
        <BentoCard>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Outstanding</p>
          <p className="mt-1 text-xl font-semibold text-status-overdue">{peso(totals.outstanding)}</p>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <BentoCard ref={calendarCardRef} span={2} className="overflow-visible">
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-ink/40">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {weeks.flat().map((date, i) => {
              const isToday = date && isCurrentMonth && date.getDate() === today.getDate();
              const dayItems = date ? itemsByDay[date.getDate()] || [] : [];
              const hasOverdue = dayItems.some((it) => it.status === 'overdue');
              const hasItems = dayItems.length > 0;

              return (
                <div
                  key={i}
                  className={`group relative min-h-[72px] rounded-lg border p-1.5 text-left transition-shadow ${
                    date ? 'border-line' : 'border-transparent'
                  } ${isToday ? 'bg-ink text-white' : hasItems ? 'bg-canvas ring-1 ring-line hover:ring-2 hover:ring-ink/30' : 'bg-canvas'}`}
                >
                  {date && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-medium ${isToday ? 'text-white' : 'text-ink/70'}`}>{date.getDate()}</p>
                        {hasItems && (
                          <span
                            className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                              hasOverdue ? 'bg-status-overdue' : 'bg-ink/70'
                            }`}
                          >
                            {dayItems.length}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {dayItems.slice(0, 6).map((item, idx) => (
                          <span
                            key={idx}
                            className={`h-2.5 w-2.5 rounded-full ${DOT_FOR_STATUS[item.status]} ${
                              isToday ? 'ring-1 ring-white/50' : ''
                            }`}
                          />
                        ))}
                      </div>

                      {hasItems && (
                        <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 scale-90 rounded-lg border border-line bg-surface p-3 text-left opacity-0 shadow-lg transition-all duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100">
                          <p className="text-xs font-semibold text-ink/70">
                            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                          </p>
                          <ul className="mt-2 space-y-2">
                            {dayItems.map((item, idx) => (
                              <li key={idx} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-ink">
                                    {item.unitName}{item.tenantName ? ` - ${item.tenantName}` : ''}
                                  </p>
                                  <StatusBadge status={item.status} />
                                </div>
                                <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink/60">
                                  <span><BillIcon type={item.billType} className="mr-1" />{BILL_TYPE_META[item.billType].label}</span>
                                  <span>{peso(item.amount)}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ink/50">
            {Object.entries({ paid: 'Paid', pending: 'Pending', overdue: 'Overdue', upcoming: 'Upcoming' }).map(
              ([status, label]) => (
                <span key={status} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${DOT_FOR_STATUS[status]}`} />
                  {label}
                </span>
              )
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-ink/40">
            Each dot is one bill due that day (rent or utility) — hover any day with a badge to see exactly what's due.
          </p>
        </BentoCard>

        <BentoCard
          className="flex flex-col p-0"
          style={{ height: calendarHeight ? `${calendarHeight}px` : undefined, maxHeight: calendarHeight ? `${calendarHeight}px` : '640px' }}
        >
          <h2 className="shrink-0 p-5 pb-3 text-base font-semibold">This Month's Bills</h2>
          <ul className="scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
            {upcomingBills.map((item, idx) => (
              <li key={idx} className="rounded-lg bg-canvas px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={item.tenantName || item.unitName} size="sm" />
                    <p className="text-sm font-medium">
                      {item.unitName}{item.tenantName ? ` - ${item.tenantName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-1 flex items-center justify-between pl-10 text-xs text-ink/60">
                  <span><BillIcon type={item.billType} className="mr-1" />{BILL_TYPE_META[item.billType].label} &middot; due {new Date(item.dueDate).getDate()}{['th','st','nd','rd'][(new Date(item.dueDate).getDate() % 10 > 3 || Math.floor((new Date(item.dueDate).getDate() % 100) / 10) === 1) ? 0 : new Date(item.dueDate).getDate() % 10]}</span>
                  <span className="font-medium text-ink/70">{peso(item.amount)}</span>
                </div>
              </li>
            ))}
            {upcomingBills.length === 0 && (
              <p className="text-sm text-ink/50">
                Nothing outstanding this month. Add a tenant or a unit utility due day under Properties/Tenants and it'll show up here.
              </p>
            )}
          </ul>
        </BentoCard>
      </div>

      <BentoCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <h2 className="text-base font-semibold">Detailed Rent Ledger</h2>
          <div className="flex flex-wrap gap-2">
            {LEDGER_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setLedgerFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  ledgerFilter === f ? 'bg-ink text-white' : 'border border-line text-ink/60'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-5 py-2 font-medium">Tenant &amp; Unit</th>
                <th className="px-5 py-2 font-medium">Due Date</th>
                <th className="px-5 py-2 font-medium">Amount</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredLedger.map((r) => (
                <tr key={r._id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.tenant?.fullName} size="sm" />
                      <div>
                        <p className="font-medium">{r.tenant?.fullName}</p>
                        <p className="text-xs text-ink/50">{r.property?.name} &middot; {r.unit?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink/60">{new Date(r.dueDate).toLocaleDateString()}</td>
                  <td className="px-5 py-3">{peso(r.amountDue)}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-sm text-ink/50">
                    No records for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BentoCard>
    </div>
  );
}