import React from 'react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import StatusBadge from './StatusBadge.jsx';
import { BILL_TYPE_META, BillIcon } from '../lib/billIcons.jsx';
import { peso, plural, sum } from '../lib/breakdown.js';

const keyOf = (item) => `${item.billType}:${item.id}`;

// "Are you sure this is paid?" - the single confirmation step for marking
// bills paid, whether it's one bill (Mark Paid on a row) or many (the bulk
// bar). Utility bills that never had an amount set get an optional "amount
// paid" box on their row so the record reflects what was really collected.
export default function ConfirmPaidModal({ items, amounts, onAmountChange, busy, error, onConfirm, onClose }) {
  const open = !!items && items.length > 0;
  const many = open && items.length > 1;
  const total = open ? sum(items) : 0;
  const unpriced = open ? items.filter((i) => i.amount === null || i.amount === undefined).length : 0;

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={many ? `Mark ${items.length} bills as paid?` : 'Mark this bill as paid?'}
      size={many ? 'lg' : 'md'}
    >
      {open && (
        <div className="space-y-4">
          <p className="text-sm text-ink/60">
            {many
              ? 'Only continue if you have actually received these payments. They will count toward your collected totals straight away.'
              : 'Are you sure this bill has been paid? It will count toward your collected totals straight away.'}
          </p>

          {many && (
            <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink/45">Total being marked paid</p>
                <p className="text-2xl font-bold tracking-tight">{peso(total)}</p>
              </div>
              <p className="text-sm text-ink/55">{plural(items.length, 'bill')}</p>
            </div>
          )}

          <ul className={`divide-y divide-line rounded-xl border border-line ${many ? 'max-h-[40vh] overflow-y-auto' : ''}`}>
            {items.map((item) => {
              const unset = item.amount === null || item.amount === undefined;
              return (
                <li key={keyOf(item)} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={item.tenantName || item.unitName} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.tenantName || 'Vacant'}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink/50">
                        {item.unitName}
                        <span className="inline-flex items-center gap-1">
                          <BillIcon type={item.billType} className="text-[10px]" />
                          {BILL_TYPE_META[item.billType].label}
                        </span>
                        <span>due {new Date(item.dueDate).toLocaleDateString()}</span>
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={item.status} />
                    {unset ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount paid"
                        aria-label={`Amount paid for ${item.tenantName || item.unitName} ${BILL_TYPE_META[item.billType].label}`}
                        value={amounts[keyOf(item)] || ''}
                        onChange={(e) => onAmountChange(keyOf(item), e.target.value)}
                        className="w-28 rounded-lg border border-line px-2.5 py-1.5 text-right text-sm"
                      />
                    ) : (
                      <span className="w-20 text-right font-semibold">{peso(item.amount)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {unpriced > 0 && (
            <p className="rounded-lg bg-status-pendingSoft px-3 py-2 text-xs text-status-pending">
              {plural(unpriced, 'bill')} {unpriced === 1 ? "has" : "have"} no amount set. Enter what was actually paid,
              or leave it blank to mark it paid without an amount.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-status-overdueSoft px-3 py-2 text-sm text-status-overdue">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="h-10 rounded-full border border-line px-4 text-sm font-medium text-ink/60 hover:bg-canvas disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-success px-5 text-sm font-semibold text-white hover:bg-success-dark disabled:opacity-60"
            >
              {busy && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              )}
              {busy ? 'Marking...' : many ? `Yes, mark ${items.length} as paid` : 'Yes, mark as paid'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
