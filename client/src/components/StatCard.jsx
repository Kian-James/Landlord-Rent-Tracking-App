import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import BentoCard from './BentoCard.jsx';

// The one summary-card style used on every page (Dashboard look): an icon chip
// + label header, a big metric, an optional segmented bar, then caption lines.
// Passing `onClick` makes the whole card a keyboard-accessible button that
// opens that card's breakdown modal.

const TONES = {
  neutral: { chip: 'bg-canvas text-ink/60', value: '' },
  paid: { chip: 'bg-status-paidSoft text-status-paid', value: 'text-status-paid' },
  overdue: { chip: 'bg-status-overdueSoft text-status-overdue', value: 'text-status-overdue' },
  pending: { chip: 'bg-status-pendingSoft text-status-pending', value: 'text-status-pending' },
  upcoming: { chip: 'bg-status-upcomingSoft text-status-upcoming', value: 'text-status-upcoming' },
  verify: { chip: 'bg-status-verifySoft text-status-verify', value: 'text-status-verify' },
};

const CLICKABLE =
  'cursor-pointer transition duration-150 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

// pill: { text, tone } shown at the right of the header.
// bar: [{ pct, className }] segments drawn on a grey track.
// captions: strings/nodes; the first is the main caption, the rest are fainter.
export default function StatCard({ icon, tone = 'neutral', label, value, suffix, pill, bar, captions = [], onClick }) {
  const t = TONES[tone] || TONES.neutral;
  const pillTone = pill ? TONES[pill.tone || tone] || TONES.neutral : null;

  const interactive = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': `${label}, view breakdown`,
        title: 'View breakdown',
        onClick,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <BentoCard className={onClick ? CLICKABLE : ''} {...interactive}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
          <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-medium text-ink/70">{label}</p>
        {pill && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillTone.chip}`}>{pill.text}</span>
        )}
      </div>

      <p className={`metric mt-3 text-metric ${t.value}`}>
        {value}
        {suffix && <span className="ml-1.5 text-sm font-normal text-ink/45">{suffix}</span>}
      </p>

      {bar && (
        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-line">
          {bar.map((seg, i) => (
            <div key={i} className={`h-full transition-all ${seg.className}`} style={{ width: `${seg.pct}%` }} />
          ))}
        </div>
      )}

      {captions.map((c, i) => (
        <p key={i} className={`text-xs ${i === 0 ? `${bar ? 'mt-1.5' : 'mt-1'} text-ink/45` : 'mt-0.5 text-ink/35'}`}>
          {c}
        </p>
      ))}
    </BentoCard>
  );
}
