// Number formatting + status metadata shared by the breakdown modals, so
// amounts are formatted one way everywhere.

export const peso = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n || 0);
export const sum = (list) => list.reduce((total, i) => total + (i.amount || 0), 0);
export const pctOf = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const STATUS_ORDER = ['paid', 'verification', 'pending', 'overdue', 'upcoming'];
export const STATUS_META = {
  paid: { label: 'Paid', dot: 'bg-status-paid' },
  verification: { label: 'Awaiting review', dot: 'bg-status-verify' },
  pending: { label: 'Pending', dot: 'bg-status-pending' },
  overdue: { label: 'Overdue', dot: 'bg-status-overdue' },
  upcoming: { label: 'Upcoming', dot: 'bg-status-upcoming' },
};
