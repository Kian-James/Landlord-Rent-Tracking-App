import React from 'react';

// Rentora's mark: a house with a door cut-out and a small green "rent paid"
// dot. `tone="dark"` is the dark tile used on light backgrounds, `tone="light"`
// is the white tile used on dark ones. The same drawing is in
// public/icons/rentora.svg (favicon), so keep the two in sync.
export function RentoraMark({ tone = 'dark', className = 'h-9 w-9' }) {
  const tile = tone === 'dark' ? '#1F2937' : '#FFFFFF';
  const house = tone === 'dark' ? '#FFFFFF' : '#1F2937';
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Rentora">
      <rect width="32" height="32" rx="9" fill={tile} />
      <path
        d="M8 15.2 16 8.5l8 6.7V23a1.5 1.5 0 0 1-1.5 1.5H19v-5.2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5.2H9.5A1.5 1.5 0 0 1 8 23z"
        fill={house}
      />
      <circle cx="24.5" cy="8.5" r="2.6" fill="#16A34A" />
    </svg>
  );
}

export default function RentoraLogo({ tone = 'dark', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <RentoraMark tone={tone} className="h-9 w-9" />
      <span className={`font-heading text-xl font-extrabold tracking-tight ${tone === 'dark' ? 'text-ink' : 'text-white'}`}>
        Rentora
      </span>
    </span>
  );
}
