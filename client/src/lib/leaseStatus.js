// Display metadata for contract statuses, shared by the lease history views.
// Statuses come from the backend: active | superseded | expired | terminated.
// "superseded" means the lease was replaced by a renewal, so it reads as "Renewed".

const LEASE_STATUS = {
  active: { label: 'Active', cls: 'bg-status-paidSoft text-status-paid' },
  superseded: { label: 'Renewed', cls: 'bg-line text-ink/60' },
  expired: { label: 'Expired', cls: 'bg-status-overdueSoft text-status-overdue' },
  terminated: { label: 'Terminated', cls: 'bg-line text-ink/60' },
};

export const leaseStatus = (status) => LEASE_STATUS[status] || { label: status || 'Unknown', cls: 'bg-line text-ink/60' };

export const fmtLeaseDate = (value) => new Date(value).toLocaleDateString();
