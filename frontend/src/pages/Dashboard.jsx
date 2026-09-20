import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import BentoCard from '../components/BentoCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import FilterDropdown from '../components/FilterDropdown.jsx';
import { Skeleton, SkeletonText, SkeletonRow } from '../components/Skeleton.jsx';
import { buildMonthGrid, periodKeyOf } from '../lib/calendarGrid.js';
import { getCached, setCached, cacheKey, invalidate } from '../lib/apiCache.js';

function peso(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(
    amount || 0
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const ATTENTION_STYLE = {
  overdue: { tint: 'bg-status-overdueSoft', label: 'Overdue', labelColor: 'text-status-overdue' },
  verification: { tint: 'bg-status-verifySoft', label: 'Verification Inbox', labelColor: 'text-status-verify' },
  dueSoon: { tint: 'bg-status-pendingSoft', label: 'Due Soon', labelColor: 'text-status-pending' },
  contract: { tint: 'bg-status-upcomingSoft', label: 'Contract Renewal', labelColor: 'text-status-upcoming' },
};

const DOT_FOR_STATUS = {
  paid: 'bg-status-paid',
  pending: 'bg-status-pending',
  overdue: 'bg-status-overdue',
  upcoming: 'bg-status-upcoming',
  verification: 'bg-status-verify',
};

const PAGE_SIZE = 5;
const FILTERS = ['all', 'paid', 'pending', 'overdue', 'verification'];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-56" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <BentoCard key={i}>
            <SkeletonText width="w-24" className="h-3" />
            <Skeleton className="mt-3 h-7 w-28" />
            <SkeletonText width="w-32" className="mt-2 h-3" />
          </BentoCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoCard span={2}>
          <SkeletonText width="w-40" className="h-3" />
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-6 h-2 w-full rounded-full" />
        </BentoCard>
        <BentoCard>
          <SkeletonText width="w-32" />
          <div className="mt-4 space-y-3">
            <SkeletonText width="w-full" />
            <SkeletonText width="w-full" />
            <SkeletonText width="w-3/4" />
          </div>
        </BentoCard>
      </div>

      <BentoCard>
        <SkeletonText width="w-36" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <SkeletonText width="w-20" className="h-3" />
              <SkeletonText width="w-32" className="mt-2" />
              <Skeleton className="mt-3 h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </BentoCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoCard span={2} className="p-5">
          <SkeletonText width="w-40" />
          <div className="mt-4 divide-y divide-line">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </BentoCard>
        <div className="space-y-4">
          <BentoCard>
            <SkeletonText width="w-28" />
            <Skeleton className="mt-3 h-40 w-full" />
          </BentoCard>
          <BentoCard>
            <SkeletonText width="w-32" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { landlord } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [checklistFilter, setChecklistFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const period = periodKeyOf(cursor);
  const dashboardKey = cacheKey('/dashboard', { period, propertyId: selectedPropertyId });
  const propertiesKey = '/properties';

  const load = () => {
    const cachedDashboard = getCached(dashboardKey);
    const cachedProperties = getCached(propertiesKey);
    if (cachedDashboard) setData(cachedDashboard);
    if (cachedProperties) setProperties(cachedProperties);

    Promise.all([
      client.get('/dashboard', { params: { period, propertyId: selectedPropertyId } }),
      client.get('/properties'),
    ])
      .then(([dashRes, propsRes]) => {
        setData(dashRes.data);
        setProperties(propsRes.data.properties);
        setCached(dashboardKey, dashRes.data);
        setCached(propertiesKey, propsRes.data.properties);
        setError('');
      })
      .catch(() => {
        if (!cachedDashboard) setError('Could not load your dashboard right now.');
      });
  };

  useEffect(() => {
    load();
    setPage(1);
  }, [period, selectedPropertyId]);

  const handleMarkPaid = async (recordId) => {
    await client.post(`/rent-records/${recordId}/mark-paid`, {});
    invalidate('/dashboard');
    load();
  };

  const weeks = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const recordsByDay = useMemo(() => {
    const map = {};
    (data?.checklist || []).forEach((r) => {
      const day = new Date(r.dueDate).getDate();
      map[day] = map[day] || [];
      map[day].push(r);
    });
    return map;
  }, [data]);

  if (error) return <p className="text-status-overdue">{error}</p>;
  if (!data) return <DashboardSkeleton />;

  const { totals, needsAttention, checklist } = data;
  const attentionItems = [
    ...needsAttention.overdue.map((r) => ({ kind: 'overdue', record: r })),
    ...needsAttention.verification.map((p) => ({ kind: 'verification', payment: p })),
    ...needsAttention.dueSoon.map((r) => ({ kind: 'dueSoon', record: r })),
    ...needsAttention.expiringContracts.map((c) => ({ kind: 'contract', contract: c })),
  ];

  const collectedPct = totals.expectedRent > 0 ? Math.round((totals.collected / totals.expectedRent) * 100) : 0;
  const totalRecords = checklist.length || 1;
  const paidPct = Math.round(((totals.paid || 0) / totalRecords) * 100);
  const pendingPct = Math.round(((totals.pending || 0) / totalRecords) * 100);
  const overduePct = Math.max(0, 100 - paidPct - pendingPct);

  const today = new Date();
  const isCurrentMonth = period === periodKeyOf(today);
  const cycleDay = isCurrentMonth ? today.getDate() : null;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const filteredChecklist = checklist.filter((r) => {
    if (checklistFilter !== 'all' && r.status !== checklistFilter) return false;
    if (search && !r.tenant?.fullName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filteredChecklist.length / PAGE_SIZE));
  const pagedChecklist = filteredChecklist.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const countFor = (status) => (status === 'all' ? checklist.length : checklist.filter((r) => r.status === status).length);

  const propertyOptions = ['all', ...properties.map((p) => p._id)];
  const propertyNameById = Object.fromEntries(properties.map((p) => [p._id, p.name]));
  const selectedPropertyName =
    selectedPropertyId === 'all' ? `All Properties (${properties.length})` : propertyNameById[selectedPropertyId] || 'Property';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {greeting()}, {landlord?.name?.split(' ')[0]}
            </h1>
          </div>
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
            <span className="px-1 text-sm font-medium">{cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-full px-2 py-1 text-sm text-ink/60 hover:bg-canvas"
              aria-label="Next month"
            >
              &rsaquo;
            </button>
          </div>
          <FilterDropdown
            value={selectedPropertyId}
            options={propertyOptions}
            onChange={setSelectedPropertyId}
            renderTrigger={(v) => (v === 'all' ? `All Properties (${properties.length})` : propertyNameById[v] || 'Property')}
            renderOption={(v) => (v === 'all' ? `All Properties (${properties.length})` : propertyNameById[v])}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <BentoCard>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Expected Rent</p>
          <p className="mt-2 text-2xl font-semibold">{peso(totals.expectedRent)}</p>
          <p className="mt-1 text-xs text-ink/45">{totals.tenants} tenant(s) in portfolio</p>
        </BentoCard>

        <BentoCard>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Collected to Date</p>
            <span className="rounded-full bg-status-paidSoft px-2 py-0.5 text-[10px] font-semibold text-status-paid">
              {collectedPct}% Collected
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-status-paid">{peso(totals.collected)}</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-status-paid transition-all" style={{ width: `${collectedPct}%` }} />
          </div>
        </BentoCard>

        <BentoCard>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Outstanding Rent</p>
            <span className="rounded-full bg-status-overdueSoft px-2 py-0.5 text-[10px] font-semibold text-status-overdue">
              {totals.overdue + totals.pending} Unresolved
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-status-overdue">{peso(totals.outstanding)}</p>
          <p className="mt-1 text-xs text-ink/45">{totals.overdue} Overdue &middot; {totals.pending} Pending due soon</p>
        </BentoCard>

        <BentoCard>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Ledger Distribution</p>
            <span className="text-[10px] text-ink/40">{checklist.length} Units</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{totals.paid} Paid</p>
          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-status-paid" style={{ width: `${paidPct}%` }} />
            <div className="h-full bg-status-pending" style={{ width: `${pendingPct}%` }} />
            <div className="h-full bg-status-overdue" style={{ width: `${overduePct}%` }} />
          </div>
          <p className="mt-1 text-xs text-ink/45">
            {totals.paid} Paid &middot; {totals.pending} Pending &middot; {totals.overdue} Overdue &middot; {totals.verification} Review
          </p>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoCard span={2} className="flex flex-col justify-between overflow-hidden bg-gradient-to-br from-ink to-[#1f3a2c] text-white">
          <div>
            <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide">
              {selectedPropertyId === 'all' ? 'Portfolio Hub' : 'Property Hub'}
            </span>
            <p className="mt-3 text-xl font-semibold">
              {selectedPropertyId === 'all' ? 'Your Rental Portfolio' : selectedPropertyName}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {selectedPropertyId === 'all'
                ? <>{properties.length} propert{properties.length === 1 ? 'y' : 'ies'} &middot; {totals.tenants} active tenant(s)</>
                : <>{totals.tenants} active tenant(s)</>}
            </p>
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold">{collectedPct}%</p>
              <p className="text-xs text-white/60">of this cycle's expected rent collected</p>
            </div>
            <Link to="/properties" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink">
              Property Details
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Monthly Cash Velocity</p>
          {isCurrentMonth && <p className="mt-0.5 text-[11px] text-ink/40">Cycle Day {cycleDay} of {daysInMonth}</p>}
          <div
            className="relative mt-3 flex h-28 w-28 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#1E8E5A ${collectedPct * 3.6}deg, #E7E9E4 0deg)`,
            }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface">
              <span className="text-xl font-semibold">{collectedPct}%</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink/45">{peso(totals.collected)} of {peso(totals.expectedRent)}</p>
        </BentoCard>
      </div>

      <BentoCard span={4}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Needs Attention</h2>
          <span className="rounded-full bg-status-overdueSoft px-2 py-0.5 text-xs font-semibold text-status-overdue">
            {attentionItems.length} Action{attentionItems.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink/45">Immediate follow-ups required to ensure zero month-end arrears.</p>

        {attentionItems.length === 0 ? (
          <p className="mt-4 rounded-lg bg-canvas px-3 py-4 text-center text-sm text-ink/50">
            You're all caught up. Nothing needs attention right now.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {attentionItems.map((item, i) => {
              const style = ATTENTION_STYLE[item.kind];
              return (
                <div key={i} className={`rounded-lg ${style.tint} px-4 py-3`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${style.labelColor}`}>{style.label}</p>
                  {item.kind === 'overdue' && (
                    <>
                      <p className="mt-1 text-sm font-medium">{item.record.tenant?.fullName} &middot; {item.record.unit?.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-status-overdue">{peso(item.record.amountDue)}</p>
                        <button onClick={() => handleMarkPaid(item.record._id)} className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
                          Mark Paid
                        </button>
                      </div>
                    </>
                  )}
                  {item.kind === 'verification' && (
                    <>
                      <p className="mt-1 text-sm font-medium">{item.payment.tenant?.fullName} &middot; {item.payment.unit?.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">{peso(item.payment.expectedAmount)}</p>
                        <Link to="/verification" className="rounded-full bg-status-verify px-3 py-1 text-xs font-medium text-white">
                          Review Slip
                        </Link>
                      </div>
                    </>
                  )}
                  {item.kind === 'dueSoon' && (
                    <>
                      <p className="mt-1 text-sm font-medium">{item.record.tenant?.fullName} &middot; {item.record.unit?.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-status-pending">{peso(item.record.amountDue)}</p>
                        <StatusBadge status="upcoming" />
                      </div>
                    </>
                  )}
                  {item.kind === 'contract' && (
                    <>
                      <p className="mt-1 text-sm font-medium">{item.contract.tenant?.fullName} &middot; {item.contract.unit?.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-ink/60">Expires {new Date(item.contract.endDate).toLocaleDateString()}</p>
                        <Link to="/tenants" className="rounded-full border border-line px-3 py-1 text-xs font-medium">
                          Review
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </BentoCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoCard span={2} className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-0">
            <h2 className="text-base font-semibold">Live Rent Checklist</h2>
            <p className="text-xs text-ink/45">Instant tenant reconciliation for {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setChecklistFilter(f);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  checklistFilter === f ? 'bg-ink text-white' : 'border border-line text-ink/60'
                }`}
              >
                {f} ({countFor(f)})
              </button>
            ))}
          </div>

          <div className="px-5 pt-3">
            <input
              placeholder="Search tenant name or unit..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>

          <ul className="mt-2 divide-y divide-line px-5">
            {pagedChecklist.map((r) => (
              <li key={r._id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={r.tenant?.fullName} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{r.tenant?.fullName}</p>
                    <p className="text-xs text-ink/50">{r.unit?.name} &middot; {peso(r.amountDue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status !== 'paid' && r.status !== 'verification' && (
                    <button onClick={() => handleMarkPaid(r._id)} className="text-xs font-medium text-ink/60 hover:text-ink">
                      Mark Paid
                    </button>
                  )}
                </div>
              </li>
            ))}
            {pagedChecklist.length === 0 && (
              <p className="py-4 text-sm text-ink/50">
                {checklist.length === 0
                  ? "No rent records yet for this period. Generate them from the Rent tab."
                  : 'No records match this filter.'}
              </p>
            )}
          </ul>

          {filteredChecklist.length > 0 && (
            <div className="flex items-center justify-between px-5 py-4 text-xs text-ink/50">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredChecklist.length)} of {filteredChecklist.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-line px-2 py-1 disabled:opacity-30"
                >
                  &lsaquo;
                </button>
                <span>{page}/{pageCount}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="rounded-full border border-line px-2 py-1 disabled:opacity-30"
                >
                  &rsaquo;
                </button>
              </div>
            </div>
          )}
        </BentoCard>

        <div className="space-y-4">
          <BentoCard>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{cursor.toLocaleDateString('en-US', { month: 'long' })} Due Dates</h2>
              <Link to="/calendar" className="text-xs font-medium text-ink/50 hover:text-ink">Full calendar &rarr;</Link>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium uppercase text-ink/40">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-0.5">
              {weeks.flat().map((date, i) => {
                const isToday = date && isCurrentMonth && date.getDate() === today.getDate();
                const dayRecords = date ? recordsByDay[date.getDate()] || [] : [];
                return (
                  <div
                    key={i}
                    className={`flex h-7 flex-col items-center justify-center rounded text-[10px] ${
                      isToday ? 'bg-ink text-white' : date ? 'text-ink/60' : ''
                    }`}
                  >
                    {date && date.getDate()}
                    {dayRecords.length > 0 && (
                      <span className={`mt-0.5 h-1 w-1 rounded-full ${DOT_FOR_STATUS[dayRecords[0].status]}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </BentoCard>

          <BentoCard>
            <h2 className="text-sm font-semibold">Quick Operations</h2>
            <p className="mt-1 text-xs text-ink/45">Common daily landlord actions.</p>
            <div className="mt-3 space-y-2">
              <Link to="/tenants" className="block rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas">
                + Add Tenant
              </Link>
              <Link to="/properties" className="block rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas">
                + Add Property
              </Link>
              <Link to="/bills" className="block rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-canvas">
                Record Payment
              </Link>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}