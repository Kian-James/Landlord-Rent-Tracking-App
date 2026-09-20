import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import client from '../api/client.js';
import BentoCard from '../components/BentoCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import FilterDropdown from '../components/FilterDropdown.jsx';
import { Skeleton, SkeletonText, SkeletonCircle } from '../components/Skeleton.jsx';
import { BILL_TYPE_META, BillIcon } from '../lib/billIcons.jsx';

function peso(amount) {
  if (amount === null || amount === undefined) return 'Amount not set';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount);
}

const TYPE_FILTERS = ['all', 'rent', 'electricity', 'water', 'wifi'];
const STATUS_FILTERS = ['all', 'paid', 'pending', 'overdue', 'upcoming'];

function normalizeRent(r) {
  return {
    id: r._id,
    billType: 'rent',
    tenantName: r.tenant?.fullName,
    unitName: r.unit?.name,
    amount: r.amountDue,
    dueDate: r.dueDate,
    status: r.status,
    raw: r,
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
    raw: b,
  };
}

export default function BillChecklist() {
  const [rentRecords, setRentRecords] = useState([]);
  const [utilityRecords, setUtilityRecords] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [payingItem, setPayingItem] = useState(null);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [payError, setPayError] = useState('');

  const [manageMode, setManageMode] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Monthly Bill Checklist</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          value={typeFilter}
          options={TYPE_FILTERS}
          onChange={setTypeFilter}
          renderTrigger={renderTypeLabel}
          renderOption={renderTypeLabel}
        />

        <span className="h-5 w-px bg-line" aria-hidden="true" />

        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-ink/10 text-ink' : 'text-ink/45 hover:text-ink/70'
            }`}
          >
            {s}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <input
            placeholder="Search tenant or unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setManageMode((m) => !m)}
            aria-pressed={manageMode}
            title="Manage paid bills"
            className={`rounded-lg border p-2 text-sm transition-colors ${
              manageMode ? 'border-ink bg-ink text-white' : 'border-line text-ink/50 hover:text-ink'
            }`}
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>
      </div>

      {manageMode && (
        <p className="-mt-3 text-xs text-ink/45">
          Manage mode is on — paid bills below now show a "Mark Unpaid" action in case one was marked paid by mistake.
        </p>
      )}

      {loading ? (
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
              {filtered.map((item) => (
                <tr key={`${item.billType}-${item.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={item.tenantName || item.unitName} size="sm" />
                      <div>
                        <p className="font-medium">{item.tenantName || 'Vacant'}</p>
                        <p className="text-xs text-ink/50">{item.unitName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <BillIcon type={item.billType} className="mr-1.5" />
                    {BILL_TYPE_META[item.billType].label}
                  </td>
                  <td className="px-4 py-3">{peso(item.amount)}</td>
                  <td className="px-4 py-3 text-ink/60">{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3">
                    {item.status !== 'paid' ? (
                      <button onClick={() => handleMarkPaid(item)} className="text-xs font-medium text-brand">
                        Mark Paid
                      </button>
                    ) : (
                      manageMode && (
                        <button onClick={() => handleMarkUnpaid(item)} className="text-xs font-medium text-status-overdue">
                          Mark Unpaid
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BentoCard>
      )}

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