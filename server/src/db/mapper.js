const FOREIGN_KEYS = {
  landlord_id: 'landlord',
  tenant_id: 'tenant',
  unit_id: 'unit',
  property_id: 'property',
  rent_record_id: 'rent_record',
  payment_id: 'payment',
  current_tenant_id: 'current_tenant',
  previous_contract_id: 'previous_contract',
};

const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function fundAmount(fund, monthlyRent) {
  if (!fund) return 0;
  if (fund.amountOverride !== null && fund.amountOverride !== undefined) return Number(fund.amountOverride);
  return (Number(fund.months) || 0) * (Number(monthlyRent) || 0);
}

export function toApi(value) {
  if (Array.isArray(value)) return value.map(toApi);
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === 'id') {
      out._id = val;
      out.id = val;
    } else if (key in FOREIGN_KEYS) {
      const embedKey = FOREIGN_KEYS[key];
      const embedded = value[embedKey];
      if (embedded === undefined) out[camel(embedKey)] = val;
    } else {
      out[camel(key)] = toApi(val);
    }
  }

  if ('advance' in out && 'deposit' in out && 'monthlyRent' in out) {
    out.advanceAmount = fundAmount(out.advance, out.monthlyRent);
    out.depositAmount = fundAmount(out.deposit, out.monthlyRent);
    out.totalMoveInAmount = out.advanceAmount + out.depositAmount;
  }
  return out;
}
