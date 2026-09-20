import React from 'react';

const STATUS_CONFIG = {
  paid: { label: 'Paid', dot: 'bg-status-paid', bg: 'bg-status-paidSoft', text: 'text-status-paid' },
  pending: { label: 'Pending', dot: 'bg-status-pending', bg: 'bg-status-pendingSoft', text: 'text-status-pending' },
  overdue: { label: 'Overdue', dot: 'bg-status-overdue', bg: 'bg-status-overdueSoft', text: 'text-status-overdue' },
  upcoming: { label: 'Upcoming', dot: 'bg-status-upcoming', bg: 'bg-status-upcomingSoft', text: 'text-status-upcoming' },
  verification: { label: 'Verification', dot: 'bg-status-verify', bg: 'bg-status-verifySoft', text: 'text-status-verify' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
