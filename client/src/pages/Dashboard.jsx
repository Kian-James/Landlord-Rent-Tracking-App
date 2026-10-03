import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import BentoCard from '../components/BentoCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import FilterDropdown from '../components/FilterDropdown.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import StatCard from '../components/StatCard.jsx';
import CycleBreakdownModal from '../components/CycleBreakdownModal.jsx';
import ReviewStatModal from '../components/ReviewStatModal.jsx';
import ConfirmPaidModal from '../components/ConfirmPaidModal.jsx';
import { Skeleton, SkeletonText, SkeletonRow } from '../components/Skeleton.jsx';
import { buildMonthGrid, periodKeyOf } from '../lib/calendarGrid.js';
import { getCached, setCached, cacheKey, invalidate } from '../lib/apiCache.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet,
  faShieldHalved,
  faTriangleExclamation,
  faFileLines,
  faMagnifyingGlass,
  faCheck,
  faCircleCheck,
  faClock,
  faFileSignature,
} from '@fortawesome/free-solid-svg-icons';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, Tooltip, PieChart, Pie } from 'recharts';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

// Needs Attention cards. Same recipe as the unit cards: a coloured top edge
// and a soft tint fading to white, an icon chip + label, one big figure, and
// a single clear action pinned to the bottom. Class names are spelled out in
// full so Tailwind can see them.
const ATTENTION_STYLE = {
  overdue: {
    label: 'Overdue',
    icon: faTriangleExclamation,
    accent: 'border-t-status-overdue',
    glow: 'from-status-overdueSoft/70',
    chip: 'bg-status-overdueSoft text-status-overdue',
    text: 'text-status-overdue',
  },
  verification: {
    label: 'Verification Inbox',
    icon: faFileLines,
    accent: 'border-t-status-verify',
    glow: 'from-status-verifySoft/70',
    chip: 'bg-status-verifySoft text-status-verify',
    text: 'text-status-verify',
  },
  dueSoon: {
    label: 'Due Soon',
    icon: faClock,
    accent: 'border-t-status-pending',
    glow: 'from-status-pendingSoft/70',
    chip: 'bg-status-pendingSoft text-status-pending',
    text: 'text-status-pending',
  },
  contract: {
    label: 'Contract Renewal',
    icon: faFileSignature,
    accent: 'border-t-status-upcoming',
    glow: 'from-status-upcomingSoft/70',
    chip: 'bg-status-upcomingSoft text-status-upcoming',
    text: 'text-status-upcoming',
  },
};

const DAY_MS = 86400000;
const dayStart = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};
// Whole days from today to `date` (negative = in the past).
const daysFromToday = (date) => Math.round((dayStart(date) - dayStart(new Date())) / DAY_MS);
const shortDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// The small "when" chip in the card's top-right corner.
function whenChip(item) {
  if (item.kind === 'overdue') {
    const n = Math.max(1, Math.abs(daysFromToday(item.record.dueDate)));
    return `${n} day${n === 1 ? '' : 's'} late`;
  }
  if (item.kind === 'dueSoon') {
    const n = daysFromToday(item.record.dueDate);
    return n <= 0 ? 'Due today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
  }
  if (item.kind === 'contract') {
    const n = daysFromToday(item.contract.endDate);
    if (n < 0) return `Ended ${Math.abs(n)}d ago`;
    return n === 0 ? 'Ends today' : `${n} day${n === 1 ? '' : 's'} left`;
  }
  return 'Needs review';
}

function AttentionCard({ item, onMarkPaid }) {
  const style = ATTENTION_STYLE[item.kind];
  const source = item.record || item.payment || item.contract;
  const name = source.tenant?.fullName;
  const unitName = source.unit?.name;

  // What the big figure is, and the line under it.
  let figureLabel;
  let figure;
  let detail;
  if (item.kind === 'contract') {
    figureLabel = 'Lease ends';
    figure = shortDate(item.contract.endDate);
    detail = 'Review the lease and renew it before it lapses';
  } else if (item.kind === 'verification') {
    figureLabel = 'Payment to confirm';
    figure = peso(item.payment.actualAmount ?? item.payment.expectedAmount);
    detail = [item.payment.method, item.payment.paymentDate && `paid ${shortDate(item.payment.paymentDate)}`]
      .filter(Boolean)
      .join(' \u00b7 ') || 'Submitted by your tenant';
  } else {
    figureLabel = item.kind === 'overdue' ? 'Amount overdue' : 'Amount due';
    figure = peso(item.record.amountDue);
    detail = `Due ${shortDate(item.record.dueDate)}`;
  }

  const actionBase = 'mt-auto flex h-9 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold transition';

  return (
    <div
      className={`group flex flex-col rounded-card border border-t-4 border-line bg-gradient-to-br ${style.glow} via-surface to-surface p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-card ${style.accent}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
          <FontAwesomeIcon icon={style.icon} className="h-3.5 w-3.5" />
        </span>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${style.text}`}>{style.label}</p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-ink/50">{unitName}</p>
        </div>
      </div>

      <div className="mb-4 mt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-ink/40">{figureLabel}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className={`text-2xl font-bold tracking-tight ${style.text}`}>{figure}</p>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-ink/60 ring-1 ring-line">
            {whenChip(item)}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink/50">{detail}</p>
      </div>

      {item.kind === 'overdue' && (
        <button type="button" onClick={() => onMarkPaid(item.record)} className={`${actionBase} bg-success text-white hover:bg-success-dark`}>
          <FontAwesomeIcon icon={faCheck} className="h-3 w-3" />
          Mark Paid
        </button>
      )}
      {item.kind === 'verification' && (
        <Link to="/bills" className={`${actionBase} bg-status-verify text-white hover:opacity-90`}>
          Review in Bills
        </Link>
      )}
      {item.kind === 'dueSoon' && (
        <Link to="/bills" className={`${actionBase} border border-line bg-surface text-ink/70 hover:bg-canvas`}>
          View in Bills
        </Link>
      )}
      {item.kind === 'contract' && (
        <Link to="/tenants" className={`${actionBase} border border-line bg-surface text-ink/70 hover:bg-canvas`}>
          Review &amp; renew
        </Link>
      )}
    </div>
  );
}

const DOT_FOR_STATUS = {
  paid: 'bg-status-paid',
  pending: 'bg-status-pending',
  overdue: 'bg-status-overdue',
  upcoming: 'bg-status-upcoming',
  verification: 'bg-status-verify',
};

const PAGE_SIZE = 5;
const FILTERS = ['all', 'paid', 'pending', 'overdue', 'verification'];

// Mirrors the real layout below (greeting row, stat row, hero row, needs
// attention, checklist + sidebar) so the page doesn't visually jump once
// data arrives - it just fades from placeholders into real content in
// place.
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
  // Which stat card's breakdown is open: 'target' | 'collected' | 'remaining' | 'review'.
  const [statModal, setStatModal] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const period = periodKeyOf(cursor);
  const dashboardKey = cacheKey('/dashboard', { period, propertyId: selectedPropertyId });
  const propertiesKey = '/properties';

  const load = () => {
    // Stale-while-revalidate: paint instantly with whatever we last had for
    // this exact period/property combo (or the last properties list), then
    // quietly refetch in the background so it's never more than a beat out
    // of date. Only the very first visit (nothing cached yet) shows the
    // loading state.
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
        // If we have nothing to show at all (no cache), surface the error.
        // If we're just showing slightly stale cached data, fail quietly -
        // the user still sees a working dashboard.
        if (!cachedDashboard) setError('Could not load your dashboard right now.');
      });
  };

  useEffect(() => {
    load();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedPropertyId]);

  // Mark Paid (here and in the checklist below) goes through the same "are
  // you sure?" confirmation as the Bill Checklist.
  const [payItems, setPayItems] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');

  const openPayConfirm = (record) => {
    setPayError('');
    setPayItems([
      {
        id: record._id,
        billType: 'rent',
        tenantName: record.tenant?.fullName,
        unitName: record.unit?.name,
        amount: record.amountDue,
        dueDate: record.dueDate,
        status: record.status,
      },
    ]);
  };

  const confirmMarkPaid = async () => {
    setPayBusy(true);
    setPayError('');
    try {
      await client.post(`/rent-records/${payItems[0].id}/mark-paid`, {});
      // The dashboard's cached totals/checklist are now stale for every
      // period/property combo, not just this one - drop them all so the
      // next load (here, and elsewhere in the app) fetches fresh.
      invalidate('/dashboard');
      load();
      setPayItems(null);
    } catch (err) {
      setPayError(err.response?.data?.error?.message || 'Could not mark this bill paid.');
    } finally {
      setPayBusy(false);
    }
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

  // "Rent Due by Weekday" bar chart - the analytics section's bar chart,
  // built entirely from the already-fetched checklist (no new endpoint):
  // sums amountDue for every rent record whose dueDate falls on each
  // weekday. Today's weekday is called out as the highlighted bar, mirroring
  // the reference design's single dark accent bar among lighter ones.
  const weekdayChartData = useMemo(() => {
    const sums = WEEKDAY_LABELS.map((label) => ({ label, amount: 0 }));
    (data?.checklist || []).forEach((r) => {
      // getDay(): 0=Sun..6=Sat -> shift so 0=Mon..6=Sun to match the labels.
      const jsDay = new Date(r.dueDate).getDay();
      const idx = (jsDay + 6) % 7;
      sums[idx].amount += r.amountDue || 0;
    });
    return sums;
  }, [data]);

  // "Cost Breakdown" doughnut - reuses the same paid/pending/overdue/
  // verification totals already shown in the stat row, just visualized as
  // proportions of the cycle instead of separate cards.
  const breakdownChartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Paid', value: data.totals.paid, color: '#16A34A' },
      { name: 'Pending', value: data.totals.pending, color: '#D97706' },
      { name: 'Overdue', value: data.totals.overdue, color: '#DC2626' },
      { name: 'Verification', value: data.totals.verification, color: '#7C3AED' },
    ].filter((slice) => slice.value > 0);
  }, [data]);

  if (error) return <p className="text-status-overdue">{error}</p>;
  if (!data) return <DashboardSkeleton />;

  const { totals, needsAttention, checklist } = data;
  const attentionItems = [
    ...needsAttention.overdue.map((r) => ({ kind: 'overdue', record: r })),
    ...(needsAttention.verification || []).map((p) => ({ kind: 'verification', payment: p })),
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
  // 0=Mon..6=Sun, matching WEEKDAY_LABELS/weekdayChartData order, so the bar
  // chart can highlight whichever bar is "today" (only meaningful - and
  // only highlighted - when viewing the current month's cycle).
  const todayWeekdayIdx = isCurrentMonth ? (today.getDay() + 6) % 7 : -1;
  const monthLabelForChart = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

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
      {/* Greeting + toolbar. No overflow-hidden on the card itself - it used to
          clip the notifications dropdown. The decorative glow is clipped in
          its own wrapper instead. */}
      <BentoCard className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-bento" aria-hidden="true">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Fiscal Ledger Command
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {greeting()}, {landlord?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            Cycle: {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} &middot;{' '}
            {selectedPropertyId === 'all'
              ? <>All {properties.length} Propert{properties.length === 1 ? 'y' : 'ies'}</>
              : selectedPropertyName}{' '}
            ({checklist.length} Unit{checklist.length === 1 ? '' : 's'})
          </p>
        </div>

      </BentoCard>

      {/* Toolbar lives in its own Bento card, separate from the greeting.
          Search, month picker, property filter and notifications each sit in
          their own bar, all 44px tall so they line up. No overflow-hidden
          here, so the notifications dropdown is never clipped. */}
      <BentoCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              placeholder="Search tenant name or unit..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-full bg-canvas pl-10 pr-4 text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex h-11 items-center gap-1 rounded-full bg-canvas px-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-base text-ink/60 hover:bg-line"
              aria-label="Previous month"
            >
              &lsaquo;
            </button>
            <MonthPicker
              value={cursor}
              onChange={setCursor}
              renderTrigger={({ open, toggle }) => (
                <button
                  onClick={toggle}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  className={`flex h-9 min-w-[6.5rem] items-center justify-center rounded-full px-3 text-sm font-medium transition-colors ${
                    open ? 'bg-surface shadow-sm' : 'hover:bg-line'
                  }`}
                >
                  {cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </button>
              )}
            />
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-base text-ink/60 hover:bg-line"
              aria-label="Next month"
            >
              &rsaquo;
            </button>
          </div>

          <FilterDropdown
            size="bar"
            value={selectedPropertyId}
            options={propertyOptions}
            onChange={setSelectedPropertyId}
            renderTrigger={(v) => (v === 'all' ? `All Properties (${properties.length})` : propertyNameById[v] || 'Property')}
            renderOption={(v) => (v === 'all' ? `All Properties (${properties.length})` : propertyNameById[v])}
          />

          <NotificationBell variant="bar" />
        </div>
      </BentoCard>

      {/* Stat row - icon-in-soft-square + inline label header (reference
          style), value, then a delta/context line. Kept at 4 cards (not the
          reference's 3) so no existing metric (Awaiting Review) gets
          dropped - all four still come straight from `totals`. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={faWallet}
          label="Expected Rent"
          value={peso(totals.expectedRent)}
          captions={[`${totals.tenants} tenant(s) in portfolio`]}
          onClick={() => setStatModal('target')}
        />
        <StatCard
          icon={faShieldHalved}
          tone="paid"
          label="Collected to Date"
          pill={{ text: `${collectedPct}%` }}
          value={peso(totals.collected)}
          bar={[{ pct: collectedPct, className: 'bg-status-paid' }]}
          onClick={() => setStatModal('collected')}
        />
        <StatCard
          icon={faTriangleExclamation}
          tone="overdue"
          label="Overdue Arrears"
          value={peso(totals.outstanding)}
          captions={[`${totals.overdue} Overdue \u00b7 ${totals.pending} Pending due soon`]}
          onClick={() => setStatModal('remaining')}
        />
        <StatCard
          icon={faFileLines}
          tone="verify"
          label="Awaiting Review"
          value={totals.verification ?? 0}
          captions={[`${totals.paid} Paid \u00b7 ${totals.pending} Pending \u00b7 ${totals.overdue} Overdue`]}
          onClick={() => setStatModal('review')}
        />
      </div>

      <CycleBreakdownModal
        kind={statModal === 'review' ? null : statModal}
        titles={{ target: 'Expected rent', collected: 'Collected to date', remaining: 'Overdue arrears' }}
        items={checklist.map((r) => ({
          id: r._id,
          billType: 'rent',
          tenantName: r.tenant?.fullName,
          unitName: r.unit?.name,
          amount: r.amountDue,
          dueDate: r.dueDate,
          status: r.status,
        }))}
        periodLabel={cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        onClose={() => setStatModal(null)}
      />
      <ConfirmPaidModal
        items={payItems}
        amounts={{}}
        onAmountChange={() => {}}
        busy={payBusy}
        error={payError}
        onConfirm={confirmMarkPaid}
        onClose={() => setPayItems(null)}
      />
      <ReviewStatModal
        open={statModal === 'review'}
        payments={needsAttention.verification}
        totals={totals}
        onClose={() => setStatModal(null)}
      />

      {/* Analytics section - bar chart (rent due by weekday) + cost/status
          breakdown doughnut, replacing the old occupancy/gauge row. Both
          charts are derived from the same `data` already fetched above; no
          new endpoints. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BentoCard span={2}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Rent Due by Weekday</h2>
              <p className="mt-0.5 text-xs text-ink/45">Total amount due this cycle, grouped by due-date weekday.</p>
            </div>
            <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-medium text-ink/60">{monthLabelForChart}</span>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayChartData} barCategoryGap="28%">
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                  formatter={(value) => [peso(value), 'Due']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 20px -10px rgba(15,23,42,0.25)' }}
                />
                <Bar dataKey="amount" radius={[8, 8, 8, 8]} maxBarSize={36}>
                  {weekdayChartData.map((entry, i) => (
                    <Cell key={entry.label} fill={i === todayWeekdayIdx ? '#1F2937' : '#E4E7EC'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        <BentoCard>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Cost Breakdown</h2>
            <Link to="/bills" className="text-xs font-medium text-ink/45 hover:text-ink">See Detail</Link>
          </div>
          <div className="relative mx-auto mt-2 h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={breakdownChartData.length > 1 ? 3 : 0}
                  stroke="none"
                >
                  {breakdownChartData.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [peso(value), name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="metric text-xl">{peso(totals.expectedRent)}</span>
              <span className="text-[10px] text-ink/45">expected this cycle</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink/60"><span className="h-1.5 w-1.5 rounded-full bg-status-paid" />Paid</span>
              <span className="font-medium">{totals.paid} Units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink/60"><span className="h-1.5 w-1.5 rounded-full bg-status-pending" />Pending</span>
              <span className="font-medium">{totals.pending} Units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink/60"><span className="h-1.5 w-1.5 rounded-full bg-status-overdue" />Overdue</span>
              <span className="font-medium">{totals.overdue} Units</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-ink/60"><span className="h-1.5 w-1.5 rounded-full bg-status-verify" />Verification</span>
              <span className="font-medium">{totals.verification ?? 0} Units</span>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Needs Attention */}
      <BentoCard span={4}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Needs Attention</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              attentionItems.length === 0 ? 'bg-status-paidSoft text-status-paid' : 'bg-status-overdueSoft text-status-overdue'
            }`}
          >
            {attentionItems.length} Action{attentionItems.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink/45">Immediate follow-ups required to ensure zero month-end arrears.</p>

        {attentionItems.length === 0 ? (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-card bg-status-paidSoft/60 px-4 py-6 text-status-paid">
            <FontAwesomeIcon icon={faCircleCheck} className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">You&apos;re all caught up</p>
              <p className="text-xs opacity-80">Nothing needs attention right now.</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {attentionItems.map((item, i) => (
              <AttentionCard key={i} item={item} onMarkPaid={openPayConfirm} />
            ))}
          </div>
        )}
      </BentoCard>

      {/* Live checklist + mini calendar sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* flex-col + h-full so the pagination footer can be pinned to the
            very bottom of the card via the list's flex-1 below, rather than
            sitting right under however many rows happen to render. The
            grid's default `align-items: stretch` already makes this card as
            tall as the sidebar next to it - without h-full this card's own
            div wouldn't actually fill that stretched height, leaving the
            footer stranded high up whenever the (paginated, max 5-ish rows)
            checklist is short. */}
        <BentoCard span={2} className="flex h-full flex-col p-0">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 p-5 pb-0">
            <h2 className="text-base font-semibold">Live Rent Checklist</h2>
            <p className="text-xs text-ink/45">Instant tenant reconciliation for {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 px-5 pt-3">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setChecklistFilter(f);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  checklistFilter === f ? 'bg-primary text-white' : 'border border-line text-ink/60'
                }`}
              >
                {f} ({countFor(f)})
              </button>
            ))}
          </div>

          {/* flex-1 makes the list itself claim all the leftover vertical
              space inside the now-stretched card, so the footer below
              (a plain block, not flex-1) always lands right at the card's
              bottom edge no matter how few rows are showing. */}
          <ul className="mt-2 flex-1 divide-y divide-line px-5">
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
                    <button onClick={() => openPayConfirm(r)} className="rounded-full border border-success px-3 py-1 text-xs font-medium text-success hover:bg-success-light">
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
            <div className="flex shrink-0 items-center justify-between px-5 py-4 text-xs text-ink/50">
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
                      isToday ? 'bg-primary text-white' : date ? 'text-ink/60' : ''
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
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-[10px] text-ink/50">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-paid" />Paid</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-overdue" />Overdue</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-pending" />Pending</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-status-verify" />Verify</span>
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