import React, { forwardRef } from 'react';

// Phones get tighter padding (p-4) so cards feel compact; from `sm` up it is
// the original p-6. A card that already asks for a small padding of its own
// (p-0 for flush tables, p-3 for toolbars...) keeps that value on phones -
// before, the default padding silently won over those overrides. The `sm:p-6`
// keeps every desktop card exactly as it was.
const SMALL_PAD = /(?:^|\s)(p-(?:0|1|2|3|4))(?=\s|$)/;

const BentoCard = forwardRef(function BentoCard({ children, className = '', span = 1, as: Tag = 'div', ...rest }, ref) {
  const spanClass = { 1: '', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4' }[span] || '';
  const match = className.match(SMALL_PAD);
  const mobilePad = match ? match[1] : 'p-4';
  const extra = match ? className.replace(SMALL_PAD, ' ') : className.replace(/(?:^|\s)p-5(?=\s|$)/, ' ');
  return (
    <Tag
      ref={ref}
      className={`rounded-bento bg-surface ${mobilePad} shadow-bento sm:p-6 ${spanClass} ${extra}`}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default BentoCard;
