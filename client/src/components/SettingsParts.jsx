import React from 'react';

// Small building blocks that give every Settings section the same shape:
//   <Section>  a card with a title, one-line description, rows, optional footer
//   <Row>      "label + hint on the left, control on the right" (stacked on phones)
//   <Toggle>   an on/off switch for instant-save options
// Keeping them here means the Settings page and the Contract template card look identical.

export const inputClass =
  'h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 disabled:bg-canvas disabled:text-ink/50';
export const btnPrimary =
  'inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50';
export const btnSecondary =
  'inline-flex h-10 items-center justify-center rounded-full border border-line px-4 text-sm font-medium transition hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'inline-flex h-10 items-center justify-center rounded-full bg-status-overdue px-5 text-sm font-semibold text-white transition hover:opacity-90';
export const btnDangerOutline =
  'inline-flex h-10 items-center justify-center rounded-full border border-status-overdue/40 px-4 text-sm font-medium text-status-overdue transition hover:bg-status-overdueSoft';

export function Section({ id, title, description, tone, footer, children }) {
  return (
    <section
      id={id}
      className={`scroll-mt-6 overflow-hidden rounded-bento bg-surface shadow-bento ${
        tone === 'danger' ? 'ring-1 ring-status-overdue/30' : ''
      }`}
    >
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <h2 className={`text-base font-semibold ${tone === 'danger' ? 'text-status-overdue' : ''}`}>{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink/55">{description}</p>}
      </div>
      <div className="mt-3 divide-y divide-line border-t border-line">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-canvas/50 px-4 py-3 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

// `inline`: keep label and control on one line even on phones (for switches and
// short buttons). Otherwise the control drops under the label on phones.
export function Row({ title, description, inline = false, children }) {
  return (
    <div
      className={`flex gap-2 px-4 py-3.5 sm:px-6 ${
        inline ? 'items-center justify-between gap-4' : 'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6'
      }`}
    >
      <div className={`min-w-0 ${inline ? '' : 'sm:w-64 sm:shrink-0'}`}>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-snug text-ink/50">{description}</p>}
      </div>
      <div className={inline ? 'shrink-0' : 'min-w-0 sm:max-w-md sm:flex-1'}>{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        checked ? 'bg-primary' : 'bg-ink/20'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}
