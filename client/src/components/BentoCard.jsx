import React, { forwardRef } from 'react';

const BentoCard = forwardRef(function BentoCard({ children, className = '', span = 1, as: Tag = 'div', ...rest }, ref) {
  const spanClass = { 1: '', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4' }[span] || '';
  return (
    <Tag
      ref={ref}
      className={`rounded-bento border border-line bg-surface p-5 shadow-bento ${spanClass} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default BentoCard;
