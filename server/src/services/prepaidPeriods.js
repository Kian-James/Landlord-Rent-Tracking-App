function enumeratePeriods(startDate, endDate) {
  const periods = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  let guard = 0;
  while (cursor <= end && guard < 600) {
    periods.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
    guard += 1;
  }
  return periods;
}

function getPrepaidPeriods(contract) {
  const months = Math.floor(contract?.advance?.months || 0);
  if (months <= 0 || !contract?.startDate || !contract?.endDate) return new Set();

  const periods = enumeratePeriods(new Date(contract.startDate), new Date(contract.endDate));
  if (periods.length === 0) return new Set();

  const prepaid = new Set();
  prepaid.add(periods[0]);

  for (let i = 1; i < months; i += 1) {
    const indexFromEnd = periods.length - i;
    if (indexFromEnd <= 0) break;
    prepaid.add(periods[indexFromEnd]);
  }

  return prepaid;
}

export { getPrepaidPeriods };