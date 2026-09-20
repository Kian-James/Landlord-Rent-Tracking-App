export const optionalAmount = (value) =>
  value === undefined || value === null || value === '' ? null : Number(value);

export function buildFund({ months, amount, method, referenceNumber, collectedAt }) {
  return {
    months: Number(months),
    amountOverride: optionalAmount(amount),
    collectedAt,
    method: method || null,
    referenceNumber: referenceNumber || '',
  };
}
