function computeStatus(rentRecord, { hasAwaitingVerification, now = new Date() } = {}) {
  if (rentRecord.status === 'paid') return 'paid';
  if (hasAwaitingVerification) return 'verification';

  const due = new Date(rentRecord.dueDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueMidnight = new Date(due);
  dueMidnight.setHours(0, 0, 0, 0);

  if (today < dueMidnight) return 'upcoming';
  if (today.getTime() <= dueMidnight.getTime()) return 'pending';
  return 'overdue';
}

export { computeStatus };
