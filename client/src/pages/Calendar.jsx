import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client.js';
import BentoCard from '../components/BentoCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import { Skeleton, SkeletonText } from '../components/Skeleton.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import ExportRangeModal from '../components/ExportRangeModal.jsx';
import FilterDropdown from '../components/FilterDropdown.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel, faMagnifyingGlass, faShieldHalved, faTriangleExclamation, faWallet } from '@fortawesome/free-solid-svg-icons';
import CycleBreakdownModal from '../components/CycleBreakdownModal.jsx';
import StatCard from '../components/StatCard.jsx';
import { fetchLedgerRange, downloadLedgerWorkbook } from '../lib/ledgerExport.js';
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
  verification: 'bg-status-verify',
};

const LEDGER_FILTERS = ['all', 'paid', 'pending', 'overdue', 'upcoming', 'verification'];

// Mirrors the real layout (summary strip, month grid + bills sidebar,
// ledger table) so switching months doesn't flash an empty page while the
// new month's data comes in.
function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <BentoCard>
        <SkeletonText width="w-40" className="h-3" />
        <Skeleton className="mt-2 h-8 w-72" />
      </BentoCard>
      <BentoCard className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-11 min-w-[200px] flex-1 rounded-full" />
          <Skeleton className="h-11 w-52 rounded-full" />
          <Skeleton className="h-11 w-44 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </BentoCard>

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
    propertyName: r.property?.name,
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
    propertyName: b.property?.name,
    // Once paid, show what was ACTUALLY paid rather than the original
    // (possibly never-set) expected amount.
    amount: b.status === 'paid' && b.paidAmount != null ? b.paidAmount : b.amountDue,
    dueDate: b.dueDate,
    status: b.status,
  };
}

export default function Calendar() {
  const [cursor, setCursor] = useState(() => new Date());
  const [exportOpen, setExportOpen] = useState(false);
  // Which summary card's breakdown is open: 'target' | 'collected' | 'remaining'.
  const [breakdown, setBreakdown] = useState(null);

  // The calendar's own content (a fixed 5-or-6-week grid) is always what
  // should decide the shared row height - the bills list next to it can
  // have anywhere from 0 to dozens of entries, and letting either CSS
  // grid/flex stretch (which sizes the row to whichever sibling's content
  // is naturally *tallest*) or a hardcoded pixel guess drive the height
  // means a long bill list drags the calendar taller instead of scrolling
  // within it. Measuring the calendar directly and applying that as an
  // explicit height on the bills card is the only way to make the
  // calendar the source of truth regardless of how many bills there are.
  const calendarCardRef = useRef(null);
  const [calendarHeight, setCalendarHeight] = useState(null);
  const [rawRecords, setRawRecords] = useState([]);
  const [rawUtilityBills, setRawUtilityBills] = useState([]);
  // Toolbar: property scope applies to everything on the page (summary cards,
  // calendar, bills list, ledger, breakdowns, export); search only narrows the
  // detail views (calendar cells, bills list, ledger table).
  const [properties, setProperties] = useState([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Re-runs whenever `cursor` changes (a new month can have 5 vs 6 weeks,
  // changing the calendar's natural height) AND whenever `loading` flips
  // to false. That second trigger matters because calendarCardRef is only
  // attached to the real calendar grid - while `loading` is true this
  // component early-returns <CalendarSkeleton /> instead, so the ref is
  // null. Without `loading` in the deps, the very first successful
  // measurement (right after the initial page-load fetch resolves) would
  // never happen, since that transition doesn't change `cursor` and so
  // wouldn't otherwise re-trigger this effect - leaving calendarHeight
  // stuck at null and the bills list unbounded until the user happened to
  // change months.
  useLayoutEffect(() => {
    const el = calendarCardRef.current;
    if (!el) return undefined;

    const measure = () => setCalendarHeight(el.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [cursor, loading]);

  const period = periodKeyOf(cursor);
  const today = new Date();

  // Bills generate themselves for whatever month is being viewed - no
  // manual button to remember to click. Generation is idempotent (a
  // unique index prevents duplicates), so it's safe to call every time
  // the viewed month changes rather than requiring an explicit action.
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
      setRawRecords(rentRes.data.records);
      setRawUtilityBills(utilityRes.data.records);
      setLoading(false);
    });
  };

  useEffect(() => {
    client
      .get('/properties')
      .then(({ data }) => setProperties(data.properties || []))
      .catch(() => setProperties([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const weeks = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  // Property scope: everything below works from these, so one filter
  // consistently drives the whole page.
  const records = useMemo(
    () => (propertyFilter === 'all' ? rawRecords : rawRecords.filter((r) => r.property?._id === propertyFilter)),
    [rawRecords, propertyFilter]
  );
  const utilityBills = useMemo(
    () => (propertyFilter === 'all' ? rawUtilityBills : rawUtilityBills.filter((b) => b.property?._id === propertyFilter)),
    [rawUtilityBills, propertyFilter]
  );

  // Every due item (rent + all utility types) normalized into one shape and
  // grouped by day-of-month, so the calendar and the "This Month's Bills"
  // list are always showing the exact same data.
  const allItems = useMemo(
    () => [...records.map(normalizeRent), ...utilityBills.map(normalizeUtility)],
    [records, utilityBills]
  );

  const searchTerm = search.trim().toLowerCase();
  const textMatches = (...values) => !searchTerm || values.some((v) => String(v || '').toLowerCase().includes(searchTerm));
  const visibleItems = useMemo(
    () => allItems.filter((i) => textMatches(i.tenantName, i.unitName, i.propertyName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, searchTerm]
  );

  const itemsByDay = useMemo(() => {
    const map = {};
    visibleItems.forEach((item) => {
      const day = new Date(item.dueDate).getDate();
      map[day] = map[day] || [];
      map[day].push(item);
    });
    return map;
  }, [visibleItems]);

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
    .filter((r) => textMatches(r.tenant?.fullName, r.unit?.name, r.property?.name))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const isCurrentMonth = periodKeyOf(cursor) === periodKeyOf(today);

  const upcomingBills = visibleItems
    .filter((i) => i.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const collectedPct = totals.expected > 0 ? Math.round((totals.paid / totals.expected) * 100) : 0;
  const overdueTenantCount = new Set(records.filter((r) => r.status === 'overdue').map((r) => r.tenant?._id)).size;
  const quarter = Math.floor(cursor.getMonth() / 3) + 1;

  // Extra figures for the summary cards' captions and bars.
  const rentPaidCount = records.filter((r) => r.status === 'paid').length;
  const overdueAmount = records.filter((r) => r.status === 'overdue').reduce((sum, r) => sum + r.amountDue, 0);
  const notLateAmount = totals.outstanding - overdueAmount;
  const overduePct = totals.outstanding > 0 ? Math.round((overdueAmount / totals.outstanding) * 100) : 0;
  const utilitiesDueTotal = utilityBills.reduce((sum, b) => sum + (b.amountDue || 0), 0);
  const periodLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const propertyOptions = ['all', ...properties.map((p) => p._id)];
  const propertyNameById = Object.fromEntries(properties.map((p) => [p._id, p.name]));
  const propertyLabel = (v) => (v === 'all' ? `All Properties (${properties.length})` : propertyNameById[v] || 'Property');
  const exportScopeName = propertyFilter === 'all' ? '' : propertyNameById[propertyFilter] || '';

  // Fetches every month in the chosen range, then builds and downloads the
  // workbook. Errors bubble up to the export dialog, which shows them inline.
  async function exportLedgerExcel(from, to) {
    const data = await fetchLedgerRange(client, from, to, propertyFilter === 'all' ? null : propertyFilter);
    if (data.rentRecords.length === 0 && data.utilityRecords.length === 0) {
      throw new Error('There are no rent or utility bills in that range to export.');
    }
    await downloadLedgerWorkbook(data, from, to, exportScopeName);
  }

  if (loading) return <CalendarSkeleton />;

  return (
    <div className="space-y-6">
      <BentoCard className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-bento" aria-hidden="true">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div className="relative">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Fiscal Operations &middot; Q{quarter} Schedule
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Rent &amp; Bill Calendar</h1>
            <p className="mt-1 max-w-xl text-sm text-ink/50">
              Visual chronological schedule of all rent, electricity, water, and wifi collections across all managed units.
            </p>
          </div>
        </div>
      </BentoCard>

      {/* Toolbar (same one-line treatment as the other pages): search, month
          picker, property filter and Export Excel. */}
      <BentoCard className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              placeholder="Search tenant, unit or property..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            renderTrigger={({ open, toggle, label }) => (
              <button
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  open ? 'bg-surface shadow-sm' : 'hover:bg-line'
                }`}
              >
                {label}
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
            value={propertyFilter}
            options={propertyOptions}
            onChange={setPropertyFilter}
            renderTrigger={propertyLabel}
            renderOption={propertyLabel}
          />

        <button
          onClick={() => setExportOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
        >
          <FontAwesomeIcon icon={faFileExcel} />
          Export Excel
        </button>
        </div>
      </BentoCard>

      <ExportRangeModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultMonth={new Date(cursor.getFullYear(), cursor.getMonth(), 1)}
        onExport={exportLedgerExcel}
        propertyLabel={propertyFilter === 'all' ? 'All properties' : exportScopeName || 'Selected property'}
      />

      {/* Cycle summary strip - shared StatCard style; each card opens a breakdown. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={faWallet}
          label="Cycle Target"
          value={peso(totals.expected)}
          captions={[
            `${records.length} rent bill(s) scheduled this cycle`,
            utilitiesDueTotal > 0 ? `+ ${peso(utilitiesDueTotal)} utilities also due` : null,
          ].filter(Boolean)}
          onClick={() => setBreakdown('target')}
        />
        <StatCard
          icon={faShieldHalved}
          tone="paid"
          label="Collected to Date"
          pill={{ text: `${collectedPct}%` }}
          value={peso(totals.paid)}
          bar={[{ pct: collectedPct, className: 'bg-status-paid' }]}
          captions={[`${rentPaidCount} of ${records.length} rent bill(s) paid`]}
          onClick={() => setBreakdown('collected')}
        />
        <StatCard
          icon={faTriangleExclamation}
          tone="overdue"
          label="Remaining · Arrears"
          pill={overdueTenantCount > 0 ? { text: `${overdueTenantCount} Critical` } : undefined}
          value={peso(totals.outstanding)}
          bar={[
            { pct: overduePct, className: 'bg-status-overdue' },
            { pct: totals.outstanding > 0 ? 100 - overduePct : 0, className: 'bg-status-upcoming' },
          ]}
          captions={[`${peso(overdueAmount)} overdue \u00b7 ${peso(notLateAmount)} not late yet`]}
          onClick={() => setBreakdown('remaining')}
        />
      </div>

      <CycleBreakdownModal
        kind={breakdown}
        items={allItems}
        periodLabel={periodLabel}
        onClose={() => setBreakdown(null)}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* Month grid */}
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
                  } ${isToday ? 'bg-primary text-white' : hasItems ? 'bg-canvas ring-1 ring-line hover:ring-2 hover:ring-primary/30' : 'bg-canvas'}`}
                >
                  {date && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-medium ${isToday ? 'text-white' : 'text-ink/70'}`}>{date.getDate()}</p>
                        {hasItems && (
                          <span
                            className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                              hasOverdue ? 'bg-status-overdue' : 'bg-primary'
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

                      {/* Hover popover: enlarges on hover and lists every bill due that day */}
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
            {Object.entries({ paid: 'Paid', pending: 'Pending', overdue: 'Overdue', upcoming: 'Upcoming', verification: 'Verification' }).map(
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

        {/* This Month's Bills - unified rent + utility list. Height is
            explicitly capped to the calendar's measured height (see
            calendarCardRef above) so the calendar always dictates the
            shared height, no matter how many bills there are - the list
            scrolls internally (scrollbar hidden, but wheel/trackpad/touch/
            keyboard scrolling all still work) instead of ever growing
            past that height or dragging the calendar taller. */}
        <BentoCard
          className="flex flex-col overflow-hidden p-0"
          style={calendarHeight ? { height: `${calendarHeight}px`, maxHeight: `${calendarHeight}px` } : undefined}
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

      {/* Detailed rent ledger table */}
      <BentoCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <h2 className="text-base font-semibold">Detailed Rent Ledger</h2>
          <div className="flex flex-wrap gap-2">
            {LEDGER_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setLedgerFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  ledgerFilter === f ? 'bg-primary text-white' : 'border border-line text-ink/60'
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