import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import client from '../api/client.js';
import BentoCard from '../components/BentoCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import BillBreakdownModal from '../components/BillBreakdownModal.jsx';
import FilterDropdown from '../components/FilterDropdown.jsx';
import { Skeleton, SkeletonText, SkeletonCircle } from '../components/Skeleton.jsx';
import { BILL_TYPE_META, BillIcon } from '../lib/billIcons.jsx';

function peso(amount) {
  if (amount === null || amount === undefined) return 'Amount not set';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);
}

const TYPE_FILTERS = ['all', 'rent', 'electricity', 'water', 'wifi'];
const STATUS_FILTERS = ['all', 'paid', 'pending', 'overdue', 'upcoming'];

// Fixed per-type color, used only for the Total Obligations breakdown bar
// below - unlike ROW_STYLE/STATUS_CHIP_STYLE (which color by status), this
// is the one place bill *type* itself gets a color identity, so the four
// categories are distinguishable in a single stacked bar.
const TYPE_COLOR = {
  rent: { bar: 'bg-primary', dot: 'bg-primary' },
  electricity: { bar: 'bg-status-pending', dot: 'bg-status-pending' },
  water: { bar: 'bg-status-upcoming', dot: 'bg-status-upcoming' },
  wifi: { bar: 'bg-status-verify', dot: 'bg-status-verify' },
};

// Each status chip always wears its own status color (a light tint at
// rest, the solid color once selected) instead of every chip defaulting to
// plain gray text - so the toolbar itself previews what's behind each
// filter, not just which one happens to be active right now.
const STATUS_CHIP_STYLE = {
  all: { soft: 'bg-canvas text-ink/50 hover:bg-line', active: 'bg-primary text-white' },
  paid: { soft: 'bg-status-paidSoft text-status-paid', active: 'bg-status-paid text-white' },
  pending: { soft: 'bg-status-pendingSoft text-status-pending', active: 'bg-status-pending text-white' },
  overdue: { soft: 'bg-status-overdueSoft text-status-overdue', active: 'bg-status-overdue text-white' },
  upcoming: { soft: 'bg-status-upcomingSoft text-status-upcoming', active: 'bg-status-upcoming text-white' },
};

// Small status dot shown on inactive segments of the toolbar's status bar.
const STATUS_DOT = {
  paid: 'bg-status-paid',
  pending: 'bg-status-pending',
  overdue: 'bg-status-overdue',
  upcoming: 'bg-status-upcoming',
};

// Per-row visual treatment keyed by status - the same color that drives the
// StatusBadge also drives a slim left-edge accent, a faint row tint (only
// for the two statuses that need attention), and the bill-type icon chip's
// color, so a row reads as one coherent color story instead of the color
// only living inside the badge. Paid rows deliberately mute everything
// (no accent, no tint, no action) so cleared bills recede and the eye is
// pulled toward what's still outstanding.
const ROW_STYLE = {
  paid: { edge: 'border-l-transparent', tint: '', chipBg: 'bg-line', chipText: 'text-ink/40', muted: true },
  pending: { edge: 'border-l-status-pending', tint: 'bg-status-pendingSoft/30', chipBg: 'bg-status-pendingSoft', chipText: 'text-status-pending', muted: false },
  overdue: { edge: 'border-l-status-overdue', tint: 'bg-status-overdueSoft/30', chipBg: 'bg-status-overdueSoft', chipText: 'text-status-overdue', muted: false },
  upcoming: { edge: 'border-l-status-upcoming', tint: '', chipBg: 'bg-status-upcomingSoft', chipText: 'text-status-upcoming', muted: false },
};

// Normalizes a RentRecord and a UtilityBillRecord into one common shape so
// they can share a single table, filter set, and Mark Paid action - a
// landlord shouldn't have to check two different screens to know what's
// outstanding this month (spec's core "one checklist" philosophy, extended
// to cover every bill type, not just rent).
function normalizeRent(r) {
  return {
    id: r._id,
    billType: 'rent',
    tenantName: r.tenant?.fullName,
    unitName: r.unit?.name,
    amount: r.amountDue,
    dueDate: r.dueDate,
    status: r.status === 'verification' ? 'pending' : r.status, // checklist collapses "awaiting verification" into pending visually
    raw: r,
  };
}

function normalizeUtility(b) {
  return {
    id: b._id,
    billType: b.type,
    tenantName: b.tenant?.fullName,
    unitName: b.unit?.name,
    // Once paid, show what was ACTUALLY paid rather than the original
    // (possibly never-set) expected amount - a utility bill with no
    // amount configured still has a real paidAmount once the landlord
    // enters it at mark-paid time, and that's the number worth showing.
    amount: b.status === 'paid' && b.paidAmount != null ? b.paidAmount : b.amountDue,
    dueDate: b.dueDate,
    status: b.status,
    raw: b,
  };
}

// "All" view is grouped by urgency instead of one long due-date list, so the
// things that need action sit at the top and settled bills sit at the bottom.
const GROUP_ORDER = ['overdue', 'pending', 'upcoming', 'paid'];
const GROUP_META = {
  overdue: { label: 'Overdue', hint: 'Past due - collect these first' },
  pending: { label: 'Pending', hint: 'Due soon' },
  upcoming: { label: 'Upcoming', hint: 'Not due yet' },
  paid: { label: 'Paid', hint: 'Settled' },
};

// Inside a group: overdue = longest overdue first, open bills = soonest due
// first, paid = most recently due first (old history sinks to the bottom).
function sortWithinStatus(status, items) {
  const byDue = (a, b) => new Date(a.dueDate) - new Date(b.dueDate);
  return [...items].sort(status === 'paid' ? (a, b) => byDue(b, a) : byDue);
}

export default function BillChecklist() {
  const [rentRecords, setRentRecords] = useState([]);
  const [utilityRecords, setUtilityRecords] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // The item currently awaiting a paid-amount entry (only used for utility
  // bills whose amount was never configured - see handleMarkPaid below).
  const [payingItem, setPayingItem] = useState(null);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [payError, setPayError] = useState('');

  // Gear icon next to search toggles this - when on, paid rows show a
  // "Mark Unpaid" action instead of nothing, so undoing a mistaken
  // mark-paid isn't a persistent, easy-to-misclick control sitting next to
  // every paid row all the time.
  const [manageMode, setManageMode] = useState(false);

  // In the "All" view, bills are grouped by urgency and the Paid group can be
  // folded away so settled bills never push outstanding ones down the page.
  const [paidCollapsed, setPaidCollapsed] = useState(false);

  // Which summary card's breakdown modal is open: 'obligations' | 'collected' | 'overdue'.
  const [breakdown, setBreakdown] = useState(null);

  // Bills generate themselves - no manual button to remember to click.
  // Generation is idempotent (a unique index prevents duplicates even if
  // this fires on every page load), so it's safe to call every time this
  // page opens rather than making the landlord take an extra action first.
  const load = async () => {
    await Promise.all([client.post('/rent-records/generate', {}), client.post('/utility-bills/generate', {})]);
    const [rentRes, utilityRes] = await Promise.all([client.get('/rent-records'), client.get('/utility-bills')]);
    setRentRecords(rentRes.data.records);
    setUtilityRecords(utilityRes.data.records);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkPaid = async (item) => {
    if (item.billType === 'rent') {
      await client.post(`/rent-records/${item.id}/mark-paid`, {});
      await load();
      return;
    }

    // Utility bills with no amount configured need the landlord to say
    // what they actually paid, so the record reflects reality instead of
    // permanently showing "Amount not set" even after payment.
    if (item.amount === null || item.amount === undefined) {
      setPayingItem(item);
      setPaidAmountInput('');
      setPayError('');
      return;
    }

    await client.post(`/utility-bills/${item.id}/mark-paid`, {});
    await load();
  };

  const confirmPayWithAmount = async (e) => {
    e.preventDefault();
    setPayError('');
    try {
      await client.post(`/utility-bills/${payingItem.id}/mark-paid`, {
        paidAmount: paidAmountInput ? Number(paidAmountInput) : undefined,
      });
      setPayingItem(null);
      await load();
    } catch (err) {
      setPayError(err.response?.data?.error?.message || 'Could not mark this bill paid.');
    }
  };

  const handleMarkUnpaid = async (item) => {
    const label = BILL_TYPE_META[item.billType].label.toLowerCase();
    if (!confirm(`Mark this ${label} bill as unpaid? This can be re-marked paid again later if needed.`)) return;
    const path = item.billType === 'rent' ? `/rent-records/${item.id}/mark-unpaid` : `/utility-bills/${item.id}/mark-unpaid`;
    await client.post(path, {});
    await load();
  };

  const combined = useMemo(() => {
    const items = [...rentRecords.map(normalizeRent), ...utilityRecords.map(normalizeUtility)];
    return items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [rentRecords, utilityRecords]);

  const filtered = combined.filter((item) => {
    if (typeFilter !== 'all' && item.billType !== typeFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (search) {
      const haystack = `${item.tenantName || ''} ${item.unitName || ''}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // Grouped only in the "All" view. Picking a specific status already narrows
  // the list to one group, so headers would just repeat the chip you clicked.
  const showGroupHeaders = statusFilter === 'all';
  const sections = (showGroupHeaders ? GROUP_ORDER : [statusFilter])
    .map((status) => {
      const items = sortWithinStatus(status, filtered.filter((i) => i.status === status));
      const total = items.reduce((sum, i) => sum + (i.amount || 0), 0);
      return { status, items, total };
    })
    .filter((section) => section.items.length > 0);

  const countForType = (type) => (type === 'all' ? combined.length : combined.filter((i) => i.billType === type).length);

  const renderTypeLabel = (t) =>
    t === 'all' ? (
      <span>All Bills <span className="text-ink/40">({countForType('all')})</span></span>
    ) : (
      <span>
        <BillIcon type={t} className="mr-1.5" />
        {BILL_TYPE_META[t].label} <span className="text-ink/40">({countForType(t)})</span>
      </span>
    );

  const totalObligations = combined.reduce((sum, i) => sum + (i.amount || 0), 0);
  const collected = combined.filter((i) => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);
  const collectedPct = totalObligations > 0 ? Math.round((collected / totalObligations) * 100) : 0;
  const overdueCount = combined.filter((i) => i.status === 'overdue').length;
  const overdueAmount = combined.filter((i) => i.status === 'overdue').reduce((sum, i) => sum + (i.amount || 0), 0);
  // Segmented breakdown for the Collected card's progress bar - shows the
  // full paid/pending/overdue split in one glance instead of just the
  // paid percentage. "Upcoming" items are intentionally left out of the
  // three segments (there's no fourth color for them here), so the bar's
  // unfilled track also doubles as "not yet due."
  const pendingAmount = combined.filter((i) => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0);
  const paidPct = totalObligations > 0 ? Math.round((collected / totalObligations) * 100) : 0;
  const pendingPct = totalObligations > 0 ? Math.round((pendingAmount / totalObligations) * 100) : 0;
  const overduePct = totalObligations > 0 ? Math.round((overdueAmount / totalObligations) * 100) : 0;
  const countForStatus = (s) => (s === 'all' ? combined.length : combined.filter((i) => i.status === s).length);
  const typeBreakdown = ['rent', 'electricity', 'water', 'wifi'].map((t) => {
    const amount = combined.filter((i) => i.billType === t).reduce((sum, i) => sum + (i.amount || 0), 0);
    const pct = totalObligations > 0 ? Math.round((amount / totalObligations) * 100) : 0;
    return { type: t, amount, pct };
  });

  // Summary cards double as buttons that open a breakdown modal. A div with
  // role="button" (rather than <button>) keeps the block-level card content valid.
  const cardButton = (kind, label) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    title: 'View breakdown',
    onClick: () => setBreakdown(kind),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setBreakdown(kind);
      }
    },
  });
  const CLICKABLE =
    'cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  // Jump from a modal to the matching slice of the list below.
  const viewInList = (status) => {
    setStatusFilter(status);
    setTypeFilter('all');
    setSearch('');
    setBreakdown(null);
    setTimeout(() => document.getElementById('bill-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="space-y-6">
      <BentoCard className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Fiscal Cycle &middot; {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Monthly Bill Checklist</h1>
            <p className="mt-1 text-sm text-ink/50">Unified ledger for rent, electricity, water, and wifi obligations across all units.</p>
          </div>

          {/* The header used to be pure title text with a lot of empty
              space to its right - this collection ring reuses the same
              paid/pending/overdue split as the Collected stat card's bar,
              just as a donut with a legend, so the header itself carries
              real information instead of only introducing the page. */}
          {!loading && combined.length > 0 && (
            <div className="flex items-center gap-5">
              <div className="hidden w-32 space-y-1.5 text-[11px] sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-paid" />
                  <span className="text-ink/50">Paid</span>
                  <span className="ml-auto font-semibold">{peso(collected)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending" />
                  <span className="text-ink/50">Pending</span>
                  <span className="ml-auto font-semibold">{peso(pendingAmount)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-overdue" />
                  <span className="text-ink/50">Overdue</span>
                  <span className="ml-auto font-semibold">{peso(overdueAmount)}</span>
                </div>
              </div>
              <div
                className="relative h-20 w-20 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(#16A34A 0% ${paidPct}%, #D97706 ${paidPct}% ${paidPct + pendingPct}%, #DC2626 ${paidPct + pendingPct}% ${paidPct + pendingPct + overduePct}%, #E9E9E9 ${paidPct + pendingPct + overduePct}% 100%)`,
                }}
              >
                <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-surface">
                  <span className="text-base font-bold">{collectedPct}%</span>
                  <span className="text-[9px] text-ink/40">collected</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </BentoCard>

      {!loading && combined.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BentoCard className={CLICKABLE} {...cardButton('obligations', 'Total obligations, view breakdown')}>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Total Obligations</p>
            <p className="mt-1 text-xl font-semibold">{peso(totalObligations)}</p>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line">
              {typeBreakdown.map((b) => (
                <div key={b.type} className={`h-full ${TYPE_COLOR[b.type].bar}`} style={{ width: `${b.pct}%` }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink/45">
              {typeBreakdown.map((b) => (
                <span key={b.type} className="inline-flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${TYPE_COLOR[b.type].dot}`} />
                  {BILL_TYPE_META[b.type].label}
                </span>
              ))}
            </div>
          </BentoCard>
          <BentoCard className={CLICKABLE} {...cardButton('collected', 'Collected, view breakdown')}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Collected</p>
              <span className="rounded-full bg-status-paidSoft px-2 py-0.5 text-[10px] font-semibold text-status-paid">{collectedPct}%</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-status-paid">{peso(collected)}</p>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-status-paid" style={{ width: `${paidPct}%` }} />
              <div className="h-full bg-status-pending" style={{ width: `${pendingPct}%` }} />
              <div className="h-full bg-status-overdue" style={{ width: `${overduePct}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] text-ink/40">Paid &middot; Pending &middot; Overdue split</p>
          </BentoCard>
          <BentoCard
            className={`relative overflow-hidden border-l-4 border-l-status-overdue ${CLICKABLE}`}
            {...cardButton('overdue', 'Overdue bills, view breakdown')}
          >
            <div className="pointer-events-none absolute inset-0 bg-status-overdueSoft/25" />
            <div className="relative">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Overdue Bills</p>
              <p className="mt-1 text-xl font-semibold text-status-overdue">{overdueCount} <span className="text-sm font-normal text-ink/45">of {combined.length} total</span></p>
              <p className="mt-1 text-xs text-ink/45">{peso(overdueAmount)} past due</p>
            </div>
          </BentoCard>
        </div>
      )}

      {/* One-line toolbar: search, status segmented bar, bill-type filter and
          manage toggle share a single row on desktop (all 44px tall, same as
          the Dashboard toolbar) and wrap gracefully on small screens. No
          overflow-hidden on the card, so the type dropdown is never clipped. */}
      <BentoCard className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              placeholder="Search tenant or unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-full bg-canvas pl-10 pr-4 text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Status filter as one segmented bar: the selected segment fills
              with its status color, the rest stay quiet with a colored dot. */}
          <div
            role="group"
            aria-label="Filter by status"
            className="scrollbar-hide flex h-11 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-canvas p-1"
          >
            {STATUS_FILTERS.map((st) => {
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  aria-pressed={active}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium capitalize transition-colors ${
                    active ? STATUS_CHIP_STYLE[st].active : 'text-ink/60 hover:bg-line'
                  }`}
                >
                  {st !== 'all' && !active && (
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[st]}`} aria-hidden="true" />
                  )}
                  {st}
                  {st !== 'all' && <span className={active ? 'opacity-80' : 'text-ink/40'}>{countForStatus(st)}</span>}
                </button>
              );
            })}
          </div>

          <FilterDropdown
            size="bar"
            value={typeFilter}
            options={TYPE_FILTERS}
            onChange={setTypeFilter}
            renderTrigger={renderTypeLabel}
            renderOption={renderTypeLabel}
          />

          <button
            onClick={() => setManageMode((m) => !m)}
            aria-pressed={manageMode}
            aria-label="Manage paid bills"
            title="Manage paid bills"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
              manageMode ? 'bg-primary text-white' : 'bg-canvas text-ink/60 hover:bg-line'
            }`}
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>
      </BentoCard>

      {manageMode && (
        <p className="-mt-3 text-xs text-ink/45">
          Manage mode is on — paid bills below now show a "Mark Unpaid" action in case one was marked paid by mistake.
        </p>
      )}

      {loading ? (
        <BentoCard id="bill-list" className="scroll-mt-6 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-medium">Tenant &amp; Unit</th>
                <th className="px-4 py-3 font-medium">Bill</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <SkeletonCircle size="h-8 w-8" />
                      <div className="space-y-1.5">
                        <SkeletonText width="w-28" />
                        <SkeletonText width="w-16" className="h-3" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><SkeletonText width="w-16" /></td>
                  <td className="px-4 py-3"><SkeletonText width="w-14" /></td>
                  <td className="px-4 py-3"><SkeletonText width="w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3"><SkeletonText width="w-14" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </BentoCard>
      ) : filtered.length === 0 ? (
        <BentoCard className="text-center">
          <p className="font-medium">Nothing here</p>
          <p className="mt-1 text-sm text-ink/50">
            {combined.length === 0
              ? "No bills for this period yet. Add a tenant or a unit utility due day under Properties/Tenants and they'll show up here automatically."
              : 'No bills match this filter.'}
          </p>
        </BentoCard>
      ) : (
        <BentoCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-medium">Tenant &amp; Unit</th>
                <th className="px-4 py-3 font-medium">Bill</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sections.map((section) => {
                const meta = GROUP_META[section.status];
                const collapsed = showGroupHeaders && section.status === 'paid' && paidCollapsed;
                return (
                  <React.Fragment key={section.status}>
                    {showGroupHeaders && (
                      <tr className="bg-canvas/60">
                        <td colSpan={6} className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[section.status]}`} aria-hidden="true" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink">{meta.label}</span>
                            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink/60">
                              {section.items.length}
                            </span>
                            <span className="text-xs text-ink/45">{meta.hint}</span>
                            <span className="ml-auto flex items-center gap-3">
                              {section.total > 0 && (
                                <span className="text-xs font-medium text-ink/60">{peso(section.total)}</span>
                              )}
                              {section.status === 'paid' && (
                                <button
                                  type="button"
                                  onClick={() => setPaidCollapsed((c) => !c)}
                                  aria-expanded={!paidCollapsed}
                                  className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink/60 hover:bg-line"
                                >
                                  {paidCollapsed ? 'Show' : 'Hide'}
                                </button>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!collapsed &&
                      section.items.map((item) => {
                        const style = ROW_STYLE[item.status] || ROW_STYLE.upcoming;
                        return (
                          <tr key={`${item.billType}-${item.id}`} className={style.tint}>
                            <td className={`border-l-4 px-4 py-3 ${style.edge}`}>
                              <div className="flex items-center gap-2.5">
                                <Avatar name={item.tenantName || item.unitName} size="sm" />
                                <div>
                                  <p className={`font-medium ${style.muted ? 'text-ink/40' : ''}`}>{item.tenantName || 'Vacant'}</p>
                                  <p className="text-xs text-ink/50">{item.unitName}</p>
                                </div>
                              </div>
                            </td>
                            <td className={`px-4 py-3 ${style.muted ? 'text-ink/40' : 'text-ink/70'}`}>
                              <span className="inline-flex items-center gap-2">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${style.chipBg} ${style.chipText}`}>
                                  <BillIcon type={item.billType} className="text-[11px]" />
                                </span>
                                {BILL_TYPE_META[item.billType].label}
                              </span>
                            </td>
                            <td className={`px-4 py-3 font-medium ${style.muted ? 'text-ink/40' : ''}`}>{peso(item.amount)}</td>
                            <td className={`px-4 py-3 ${style.muted ? 'text-ink/30' : 'text-ink/60'}`}>{new Date(item.dueDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                            <td className="px-4 py-3">
                              {item.status !== 'paid' ? (
                                <button
                                  onClick={() => handleMarkPaid(item)}
                                  className="rounded-full bg-success px-3 py-1 text-xs font-medium text-white hover:bg-success-dark"
                                >
                                  Mark Paid
                                </button>
                              ) : manageMode ? (
                                <button onClick={() => handleMarkUnpaid(item)} className="text-xs font-medium text-status-overdue">
                                  Mark Unpaid
                                </button>
                              ) : (
                                <span className="text-xs text-ink/30">&mdash;</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </BentoCard>
      )}

      <BillBreakdownModal
        kind={breakdown}
        items={combined}
        onClose={() => setBreakdown(null)}
        onViewList={viewInList}
      />

      <Modal open={!!payingItem} onClose={() => setPayingItem(null)} title="Mark Bill as Paid">
        {payingItem && (
          <form onSubmit={confirmPayWithAmount} className="space-y-3">
            <div>
              <p className="text-sm font-medium">
                {payingItem.tenantName || 'Vacant'} &middot; {payingItem.unitName}
              </p>
              <p className="text-xs text-ink/50">
                <BillIcon type={payingItem.billType} className="mr-1" />
                {BILL_TYPE_META[payingItem.billType].label} &middot; due {new Date(payingItem.dueDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-ink/60">Amount Paid</label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>
            {payError && <p className="text-xs text-status-overdue">{payError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="rounded-full bg-status-paid px-4 py-2 text-sm font-medium text-white">
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setPayingItem(null)}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink/60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}