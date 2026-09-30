import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import client from '../api/client.js';
import BentoCard from '../components/BentoCard.jsx';
import Avatar from '../components/Avatar.jsx';
import { Skeleton, SkeletonText, SkeletonCircle } from '../components/Skeleton.jsx';

function peso(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(
    amount || 0
  );
}

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'Payment method (optional)' },
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

function cleanNumber(raw, { decimals = 0, max } = {}) {
  let next = String(raw ?? '').replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, '');
  if (decimals > 0) {
    const [whole, ...rest] = next.split('.');
    next = rest.length ? `${whole}.${rest.join('').slice(0, decimals)}` : whole;
  }
  next = next.replace(/^0+(?=\d)/, '');
  if (max !== undefined && next !== '' && Number(next) > max) next = String(max);
  return next;
}

function withCommas(raw) {
  const [whole, fraction] = String(raw).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function NumberInput({ value, onChange, decimals = 0, min, max, commas = false, className, ...rest }) {
  const inputRef = useRef(null);
  const caretRef = useRef(null);
  const [, refresh] = useReducer((n) => n + 1, 0);
  const raw = String(value ?? '');
  const display = commas ? withCommas(raw) : raw;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (caretRef.current === null || !input) return;
    let remaining = caretRef.current;
    caretRef.current = null;
    let position = 0;
    while (position < input.value.length && remaining > 0) {
      if (/[0-9.]/.test(input.value[position])) remaining -= 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  });

  const handleChange = (e) => {
    const typed = e.target.value;
    const caret = e.target.selectionStart ?? typed.length;
    caretRef.current = typed.slice(0, caret).replace(/[^0-9.]/g, '').length;
    onChange(cleanNumber(typed, { decimals, max }));
    refresh();
  };

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      onBlur={() => {
        if (min !== undefined && raw !== '' && Number(raw) < min) onChange(String(min));
      }}
      className={className}
    />
  );
}

function isValidDueDay(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

const PHONE_ERROR = 'Phone number must be 11 digits and start with 09 (e.g. 09171234567).';

function normalizePhone(raw, previous = '') {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('9')) digits = `0${digits}`;
  digits = digits.slice(0, 11);
  return digits.startsWith('09'.slice(0, digits.length)) ? digits : previous;
}

function isValidPhone(value) {
  return value === '' || /^09\d{9}$/.test(value);
}

function paymentMethodLabel(value) {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label || 'Not recorded';
}

const STATUS_LABEL = {
  active: { text: 'Active', cls: 'bg-status-paidSoft text-status-paid' },
  notice_period: { text: 'Notice Period', cls: 'bg-status-pendingSoft text-status-pending' },
  vacated: { text: 'Vacated', cls: 'bg-line text-ink/60' },
  inactive: { text: 'Inactive', cls: 'bg-line text-ink/60' },
};

const EMPTY_MOVE_IN_FORM = {
  unitId: '',
  fullName: '',
  email: '',
  phone: '',
  monthlyRent: '',
  rentDueDay: '1',
  leaseStartDate: '',
  leaseEndDate: '',
  contractDurationMonths: '12',
  advanceMonths: '1',
  advanceAmount: '',
  advanceUseExact: false,
  advanceMethod: '',
  advanceReferenceNumber: '',
  depositMonths: '1',
  depositAmount: '',
  depositUseExact: false,
  depositMethod: '',
  depositReferenceNumber: '',
};

function fundAmount(useExact, exactValue, months, monthlyRent) {
  if (useExact) return Number(exactValue) || 0;
  return (Number(months) || 0) * (Number(monthlyRent) || 0);
}

function PaymentDetailsEditor({ method, referenceNumber, onChange }) {
  const [showDetails, setShowDetails] = useState(Boolean(method || referenceNumber));

  return showDetails ? (
    <div className="space-y-2">
      <select
        value={method}
        onChange={(e) => {
          const newMethod = e.target.value;
          onChange({ method: newMethod, referenceNumber: newMethod === 'cash' ? '' : referenceNumber });
        }}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
      >
        {PAYMENT_METHOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {method !== 'cash' && (
        <input
          placeholder="Reference number (optional)"
          value={referenceNumber}
          onChange={(e) => onChange({ method, referenceNumber: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowDetails(true)}
      className="text-[11px] font-medium text-ink/40 hover:text-ink/70"
    >
      + Add payment method / reference no.
    </button>
  );
}

function FundEditor({ label, monthlyRent, mode, values, onChange }) {
  const amount = fundAmount(mode === 'exact', values.amount, values.months, monthlyRent);

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-ink/70">{label}</span>

      {mode === 'exact' ? (
        <NumberInput
          decimals={2}
          commas
          placeholder="Amount (₱)"
          value={values.amount}
          onChange={(amount) => onChange({ ...values, amount })}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      ) : (
        <NumberInput
          decimals={1}
          max={120}
          placeholder="Months"
          value={values.months}
          onChange={(months) => onChange({ ...values, months })}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      )}

      <p className="text-[11px] text-ink/40">≈ {peso(amount)}</p>
    </div>
  );
}

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [vacantUnits, setVacantUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [nudgeGuide, setNudgeGuide] = useState(false);
  const guideRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showFundsDetail, setShowFundsDetail] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_MOVE_IN_FORM);

  const [editingTenantId, setEditingTenantId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');

  const [manageMode, setManageMode] = useState(false);

  const [expandedLeaseId, setExpandedLeaseId] = useState(null);

  const loadTenants = async () => {
    const { data } = await client.get('/tenants');
    setTenants(data.tenants);
  };

  const loadVacantUnits = async () => {
    const { data } = await client.get('/units', { params: { status: 'vacant' } });
    setVacantUnits(data.units);
  };

  // Used only to explain *why* Add Tenant is blocked (no property yet vs.
  // property with no units vs. every unit already occupied). Non-fatal if it
  // fails - the guide just falls back to a generic message.
  const loadProperties = async () => {
    try {
      const { data } = await client.get('/properties');
      setProperties(data.properties || []);
    } catch {
      setProperties([]);
    }
  };

  useEffect(() => {
    Promise.all([loadTenants(), loadVacantUnits(), loadProperties()]).finally(() => setLoading(false));
  }, []);

  const resetMoveInForm = () => {
    setForm(EMPTY_MOVE_IN_FORM);
    setShowFundsDetail(false);
  };

  const handleMoveIn = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidDueDay(form.rentDueDay)) {
      setError('Rent due day must be a whole number from 1 to 31.');
      return;
    }
    if (!isValidPhone(form.phone)) {
      setError(PHONE_ERROR);
      return;
    }
    try {
      await client.post('/tenants', {
        ...form,
        monthlyRent: form.monthlyRent ? Number(form.monthlyRent) : undefined,
        rentDueDay: Number(form.rentDueDay),
        contractDurationMonths: Number(form.contractDurationMonths),
        advanceMonths: Number(form.advanceMonths) || 0,
        advanceAmount: form.advanceUseExact && form.advanceAmount ? Number(form.advanceAmount) : undefined,
        advanceMethod: form.advanceMethod || undefined,
        advanceReferenceNumber: form.advanceReferenceNumber || undefined,
        depositMonths: Number(form.depositMonths) || 0,
        depositAmount: form.depositUseExact && form.depositAmount ? Number(form.depositAmount) : undefined,
        depositMethod: form.depositMethod || undefined,
        depositReferenceNumber: form.depositReferenceNumber || undefined,
      });
      setShowForm(false);
      resetMoveInForm();
      await Promise.all([loadTenants(), loadVacantUnits()]);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not move in tenant.');
    }
  };

  const handleMoveOut = async (tenantId) => {
    if (!confirm('Move out this tenant? Their history will be preserved.')) return;
    await client.post(`/tenants/${tenantId}/move-out`);
    await Promise.all([loadTenants(), loadVacantUnits()]);
  };

  const startEditing = (tenant) => {
    setShowForm(false);
    setError('');
    setEditError('');
    setEditingTenantId(tenant._id);
    setEditForm({
      fullName: tenant.fullName || '',
      email: tenant.email || '',
      phone: normalizePhone(tenant.phone),
      monthlyRent: tenant.monthlyRent ?? '',
      rentDueDay: tenant.rentDueDay ?? 1,
      status: tenant.status || 'active',
      notes: tenant.notes || '',
    });
  };

  const cancelEditing = () => {
    setEditingTenantId(null);
    setEditForm(null);
    setEditError('');
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    if (!editingTenantId || !editForm) return;
    setEditError('');
    if (!isValidDueDay(editForm.rentDueDay)) {
      setEditError('Rent due day must be a whole number from 1 to 31.');
      return;
    }
    if (!isValidPhone(editForm.phone)) {
      setEditError(PHONE_ERROR);
      return;
    }
    try {
      await client.patch(`/tenants/${editingTenantId}`, {
        ...editForm,
        monthlyRent: editForm.monthlyRent === '' ? undefined : Number(editForm.monthlyRent),
        rentDueDay: Number(editForm.rentDueDay),
      });
      cancelEditing();
      await loadTenants();
    } catch (err) {
      setEditError(err.response?.data?.error?.message || 'Could not update tenant.');
    }
  };

  const totalMoveIn =
    fundAmount(form.advanceUseExact, form.advanceAmount, form.advanceMonths, form.monthlyRent) +
    fundAmount(form.depositUseExact, form.depositAmount, form.depositMonths, form.monthlyRent);

  const activeTenants = tenants.filter((t) => t.status === 'active');
  const monthlyRentRoll = activeTenants.reduce((sum, t) => sum + (t.monthlyRent || 0), 0);
  const expiringSoonCount = activeTenants.filter((t) => {
    if (!t.contract?.endDate) return false;
    const days = Math.ceil((new Date(t.contract.endDate) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;

  // Why (if at all) moving in a tenant is currently impossible. A tenant
  // must be placed into a vacant unit, and a unit belongs to a property, so
  // the blocker is always the earliest missing step in that chain.
  const totalUnitCount = properties.reduce((sum, pr) => sum + (pr.unitCount || 0), 0);
  const addTenantBlock =
    vacantUnits.length > 0
      ? null
      : properties.length === 0
        ? {
            title: 'Add a property first',
            body: 'Tenants move into a unit, and units live inside a property. You don\'t have any properties yet. Adding one also asks for at least one unit.',
            step: 1,
            cta: 'Add a property',
          }
        : totalUnitCount === 0
          ? {
              title: 'Add a unit to your property',
              body: 'Your property doesn\'t have any units yet. Add at least one unit, then you can move a tenant into it.',
              step: 2,
              cta: 'Add a unit',
            }
          : {
              title: 'No vacant units available',
              body: 'Every unit is currently occupied. Add another unit, or move a tenant out to free one up.',
              step: 2,
              cta: 'Manage units',
            };

  const handleAddTenantClick = () => {
    if (addTenantBlock) {
      guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setNudgeGuide(true);
      setTimeout(() => setNudgeGuide(false), 1600);
      return;
    }
    cancelEditing();
    setShowForm((s) => !s);
  };

  return (
    <div className="space-y-6">
      <BentoCard className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Lease Portfolio &middot; {activeTenants.length} Active
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Tenants &amp; Leases</h1>
            <p className="mt-1 text-sm text-ink/50">Active leases, move-ins, and upcoming renewals.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setManageMode((m) => !m)}
              aria-pressed={manageMode}
              title="Manage tenants"
              className={`rounded-lg border p-2 text-sm transition-colors ${
                manageMode ? 'border-primary bg-primary text-white' : 'border-line text-ink/50 hover:text-ink'
              }`}
            >
              <FontAwesomeIcon icon={faGear} />
            </button>
            <button
              onClick={handleAddTenantClick}
              aria-disabled={Boolean(addTenantBlock)}
              title={addTenantBlock ? addTenantBlock.title : undefined}
              className={`rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark ${
                addTenantBlock ? 'opacity-40' : ''
              }`}
            >
              + Add Tenant
            </button>
          </div>
        </div>
      </BentoCard>

      {!loading && tenants.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BentoCard>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Active Tenants</p>
            <p className="mt-1 text-xl font-semibold">{activeTenants.length} <span className="text-sm font-normal text-ink/45">of {tenants.length} total</span></p>
            <p className="mt-1 text-xs text-ink/45">Across all managed units</p>
          </BentoCard>
          <BentoCard>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Monthly Rent Roll</p>
            <p className="mt-1 text-xl font-semibold">{peso(monthlyRentRoll)}/mo</p>
            <p className="mt-1 text-xs text-ink/45">Contracted rent from active leases</p>
          </BentoCard>
          <BentoCard>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Leases Expiring Soon</p>
              {expiringSoonCount > 0 && (
                <span className="rounded-full bg-status-pendingSoft px-2 py-0.5 text-[10px] font-semibold text-status-pending">
                  {expiringSoonCount}
                </span>
              )}
            </div>
            <p className="mt-1 text-xl font-semibold">{expiringSoonCount} <span className="text-sm font-normal text-ink/45">within 30 days</span></p>
            <p className="mt-1 text-xs text-ink/45">Review renewals under each tenant</p>
          </BentoCard>
        </div>
      )}

      {manageMode && (
        <p className="-mt-3 text-xs text-ink/45">
          Manage mode is on — tenant rows below now show Edit and Move Out actions.
        </p>
      )}

      {!loading && addTenantBlock && (
        <div
          ref={guideRef}
          className={`rounded-xl border bg-status-upcomingSoft p-4 transition-shadow ${
            nudgeGuide ? 'border-primary ring-2 ring-primary/40' : 'border-line'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-status-upcoming">
                <FontAwesomeIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{addTenantBlock.title}</p>
                <p className="mt-0.5 text-xs text-ink/60">{addTenantBlock.body}</p>
                <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium">
                  <li className={addTenantBlock.step === 1 ? 'text-primary' : 'text-status-paid'}>
                    {addTenantBlock.step === 1 ? '1. Add property' : '\u2713 Property added'}
                  </li>
                  <li className="text-ink/30" aria-hidden="true">&rarr;</li>
                  <li className={addTenantBlock.step === 2 ? 'text-primary' : 'text-ink/45'}>2. Add a vacant unit</li>
                  <li className="text-ink/30" aria-hidden="true">&rarr;</li>
                  <li className="text-ink/45">3. Move in a tenant</li>
                </ol>
              </div>
            </div>
            <Link
              to="/properties"
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-center text-xs font-semibold text-white hover:bg-primary-dark"
            >
              {addTenantBlock.cta}
            </Link>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-status-overdue">{error}</p>}

      {showForm && (
        <BentoCard>
          <h2 className="text-base font-semibold">Tenant Move-In</h2>
          <form onSubmit={handleMoveIn} className="mt-4 space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                required
                value={form.unitId}
                onChange={(e) => {
                  const unitId = e.target.value;
                  const unit = vacantUnits.find((u) => u._id === unitId);
                  setForm((f) => ({
                    ...f,
                    unitId,
                    monthlyRent: unit ? unit.monthlyRent ?? f.monthlyRent : f.monthlyRent,
                  }));
                }}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              >
                <option value="">Select vacant unit...</option>
                {vacantUnits.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} &middot; {peso(u.monthlyRent)}</option>
                ))}
              </select>
              <input
                required
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                pattern="09[0-9]{9}"
                title="11-digit mobile number starting with 09"
                placeholder="Phone 09XXXXXXXXX (optional)"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: normalizePhone(e.target.value, f.phone) }))}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-ink/50">Monthly rent</label>
                <NumberInput
                  decimals={2}
                  commas
                  placeholder="Defaults to unit rent"
                  value={form.monthlyRent}
                  onChange={(monthlyRent) => setForm((f) => ({ ...f, monthlyRent }))}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-ink/50">Rent due day of month</label>
                <NumberInput
                  required
                  min={1}
                  max={31}
                  placeholder="1-31"
                  value={form.rentDueDay}
                  onChange={(rentDueDay) => setForm((f) => ({ ...f, rentDueDay }))}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-ink/50">Lease start date</label>
                <input
                  required
                  type="date"
                  value={form.leaseStartDate}
                  onChange={(e) => setForm((f) => ({ ...f, leaseStartDate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-ink/50">Lease end date</label>
                <input
                  required
                  type="date"
                  value={form.leaseEndDate}
                  onChange={(e) => setForm((f) => ({ ...f, leaseEndDate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="rounded-lg border border-line">
              <button
                type="button"
                onClick={() => setShowFundsDetail((s) => !s)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-sm">
                  <span className="font-medium">Move-in funds</span>{' '}
                  <span className="text-ink/50">
                    {form.depositUseExact
                      ? <>&middot; deposit</>
                      : <>&middot; {form.advanceMonths || 0}mo advance, {form.depositMonths || 0}mo deposit</>}
                    {form.monthlyRent ? <> &middot; {peso(totalMoveIn)} total</> : null}
                  </span>
                </span>
                <span className="text-xs text-ink/40">{showFundsDetail ? 'Hide' : 'Customize'}</span>
              </button>

              {showFundsDetail && (
                <div className="space-y-4 border-t border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ink/40">
                      {form.depositUseExact
                        ? 'One combined deposit amount.'
                        : 'Split into advance and security deposit, by months.'}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => {
                          const useExact = !f.depositUseExact;
                          return {
                            ...f,
                            advanceUseExact: useExact,
                            depositUseExact: useExact,
                            advanceMonths: useExact ? '0' : f.advanceMonths && f.advanceMonths !== '0' ? f.advanceMonths : '1',
                            advanceAmount: '',
                          };
                        })
                      }
                      className="shrink-0 text-[11px] font-medium text-ink/40 underline decoration-dotted hover:text-ink/70"
                    >
                      {form.depositUseExact ? 'Use months instead' : 'Use exact amount instead'}
                    </button>
                  </div>

                  {form.depositUseExact ? (
                    <FundEditor
                      label="Deposit"
                      monthlyRent={form.monthlyRent}
                      mode="exact"
                      values={{ amount: form.depositAmount }}
                      onChange={(v) => setForm((f) => ({ ...f, depositAmount: v.amount }))}
                    />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <FundEditor
                        label="Advance"
                        monthlyRent={form.monthlyRent}
                        mode="months"
                        values={{ months: form.advanceMonths }}
                        onChange={(v) => setForm((f) => ({ ...f, advanceMonths: v.months }))}
                      />
                      <FundEditor
                        label="Security deposit"
                        monthlyRent={form.monthlyRent}
                        mode="months"
                        values={{ months: form.depositMonths }}
                        onChange={(v) => setForm((f) => ({ ...f, depositMonths: v.months }))}
                      />
                    </div>
                  )}

                  <PaymentDetailsEditor
                    method={form.depositMethod}
                    referenceNumber={form.depositReferenceNumber}
                    onChange={({ method, referenceNumber }) =>
                      setForm((f) => ({
                        ...f,
                        advanceMethod: method,
                        advanceReferenceNumber: referenceNumber,
                        depositMethod: method,
                        depositReferenceNumber: referenceNumber,
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <button type="submit" className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Complete Move-In
            </button>
          </form>
        </BentoCard>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <BentoCard key={i}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SkeletonCircle />
                  <div className="space-y-1.5">
                    <SkeletonText width="w-40" />
                    <SkeletonText width="w-56" className="h-3" />
                  </div>
                </div>
                <Skeleton className="h-8 w-16 rounded-lg" />
              </div>
            </BentoCard>
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <BentoCard className="text-center">
          <p className="font-medium">No tenants yet</p>
          <p className="mt-1 text-sm text-ink/50">Add a tenant to begin tracking monthly rent.</p>
        </BentoCard>
      ) : (
        <div className="space-y-2">
          {tenants.map((t) => {
            const statusInfo = STATUS_LABEL[t.status] || STATUS_LABEL.inactive;
            const isEditing = editingTenantId === t._id;
            return (
              <BentoCard key={t._id} className={isEditing ? 'space-y-4' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={t.fullName} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{t.fullName}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.cls}`}>
                          {statusInfo.text}
                        </span>
                      </div>
                      <p className="text-xs text-ink/50">
                        {t.property?.name} &middot; {t.unit?.name} &middot; {peso(t.monthlyRent)}/mo
                      </p>
                      {t.contract && (
                        <p className="text-xs text-ink/40">
                          Advance {peso(t.contract.advanceAmount)} &middot; Deposit {peso(t.contract.depositAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.contract && (
                      <button
                        onClick={() => setExpandedLeaseId((id) => (id === t._id ? null : t._id))}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas"
                      >
                        {expandedLeaseId === t._id ? 'Hide Lease' : 'View Lease'}
                      </button>
                    )}
                    {(manageMode || isEditing) && (
                      <button
                        onClick={() => (isEditing ? cancelEditing() : startEditing(t))}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas"
                      >
                        {isEditing ? 'Cancel' : 'Edit'}
                      </button>
                    )}
                    {manageMode && t.status === 'active' && !isEditing && (
                      <button onClick={() => handleMoveOut(t._id)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-canvas">
                        Move Out
                      </button>
                    )}
                  </div>
                </div>

                {expandedLeaseId === t._id && t.contract && (
                  <div className="mt-4 space-y-3 border-t border-line pt-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-ink/50">Lease Term</p>
                        <p className="font-medium">
                          {new Date(t.contract.startDate).toLocaleDateString()} &ndash; {new Date(t.contract.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-ink/40">{t.contract.durationMonths} month(s) &middot; {t.contract.status}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50">Rent Locked at Signing</p>
                        <p className="font-medium">{peso(t.contract.monthlyRent)}/mo</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50">Advance</p>
                        <p className="font-medium">{peso(t.contract.advanceAmount)}</p>
                        <p className="text-xs text-ink/40">
                          {paymentMethodLabel(t.contract.advance?.method)}
                          {t.contract.advance?.referenceNumber && ` \u00b7 Ref: ${t.contract.advance.referenceNumber}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50">Security Deposit</p>
                        <p className="font-medium">{peso(t.contract.depositAmount)}</p>
                        <p className="text-xs text-ink/40">
                          {paymentMethodLabel(t.contract.deposit?.method)}
                          {t.contract.deposit?.referenceNumber && ` \u00b7 Ref: ${t.contract.deposit.referenceNumber}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-ink/50">Total Collected at Move-In</p>
                        <p className="font-medium">{peso(t.contract.totalMoveInAmount)}</p>
                      </div>
                      {t.contract.notes && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-ink/50">Notes</p>
                          <p className="text-sm">{t.contract.notes}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-ink/40">
                      Lease terms are locked in at signing and can only change through a renewal - this view is read-only.
                    </p>
                  </div>
                )}

                {isEditing && editForm && (
                  <form onSubmit={handleUpdateTenant} className="space-y-3 border-t border-line pt-4">
                    {editError && <p className="text-sm text-status-overdue">{editError}</p>}
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        required
                        placeholder="Full name"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        {Object.entries(STATUS_LABEL).map(([value, { text }]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                      <input
                        type="email"
                        placeholder="Email (optional)"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="off"
                        pattern="09[0-9]{9}"
                        title="11-digit mobile number starting with 09"
                        placeholder="Phone 09XXXXXXXXX (optional)"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: normalizePhone(e.target.value, f.phone) }))}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <NumberInput
                        decimals={2}
                        commas
                        placeholder="Monthly rent"
                        value={editForm.monthlyRent}
                        onChange={(monthlyRent) => setEditForm((f) => ({ ...f, monthlyRent }))}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <div>
                        <label className="text-xs text-ink/50">Rent due day of month</label>
                        <NumberInput
                          required
                          min={1}
                          max={31}
                          placeholder="1-31"
                          value={editForm.rentDueDay}
                          onChange={(rentDueDay) => setEditForm((f) => ({ ...f, rentDueDay }))}
                          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <textarea
                      placeholder="Notes (optional)"
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                    <p className="text-[11px] text-ink/40">
                      Advance/deposit and lease dates are locked in on the contract itself and aren't edited here.
                    </p>
                    <div className="flex gap-2">
                      <button type="submit" className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
                        Save Changes
                      </button>
                      <button type="button" onClick={cancelEditing} className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </BentoCard>
            );
          })}
        </div>
      )}
    </div>
  );
}