import asyncHandler from '../utils/asyncHandler.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { assertUuid, countOf, queryString, unwrap } from '../db/helper.js';
import { refreshRentStatuses, periodKey } from '../services/rentGenerator.js';

const summary = asyncHandler(async (req, res) => {
  await refreshRentStatuses(req.landlordId);

  const period = queryString(req.query.period) || periodKey(new Date());
  const propertyId = queryString(req.query.propertyId);
  const scopedToProperty = propertyId && propertyId !== 'all';
  if (scopedToProperty) assertUuid(propertyId, 'property id');

  const scope = (query) => {
    let q = query.eq('landlord_id', req.landlordId);
    if (scopedToProperty) q = q.eq('property_id', propertyId);
    return q;
  };

  const records = unwrap(
    await scope(
      supabase
        .from('rent_records')
        .select('*, tenant:tenants!tenant_id(id, full_name), unit:units!unit_id(id, name), property:properties!property_id(id, name)')
    )
      .eq('period', period)
      .order('due_date', { ascending: true })
  );

  const totals = records.reduce(
    (acc, r) => {
      const amount = Number(r.amount_due);
      acc.expected += amount;
      if (r.status === 'paid') acc.collected += amount;
      else acc.outstanding += amount;
      acc.counts[r.status] = (acc.counts[r.status] || 0) + 1;
      return acc;
    },
    { expected: 0, collected: 0, outstanding: 0, counts: {} }
  );

  const overdue = records.filter((r) => r.status === 'overdue');
  const dueSoon = records.filter((r) => {
    if (r.status !== 'upcoming') return false;
    const days = Math.ceil((new Date(r.due_date) - new Date()) / 86400000);
    return days <= 3;
  });

  const [activeTenantCount, verification, expiringContracts] = await Promise.all([
    countOf(scope(supabase.from('tenants').select('id', { count: 'exact', head: true })).eq('status', 'active')),
    scope(
      supabase.from('payments').select('*, tenant:tenants!tenant_id(id, full_name), unit:units!unit_id(id, name)')
    )
      .eq('verification_status', 'awaiting_verification')
      .then(unwrap),
    scope(
      supabase.from('contracts').select('*, tenant:tenants!tenant_id(id, full_name), unit:units!unit_id(id, name)')
    )
      .eq('status', 'active')
      .lte('end_date', new Date(Date.now() + 30 * 86400000).toISOString())
      .then(unwrap),
  ]);

  res.json({
    period,
    propertyId: scopedToProperty ? propertyId : 'all',
    totals: {
      expectedRent: totals.expected,
      collected: totals.collected,
      outstanding: totals.outstanding,
      tenants: activeTenantCount,
      paid: totals.counts.paid || 0,
      pending: totals.counts.pending || 0,
      overdue: totals.counts.overdue || 0,
      verification: totals.counts.verification || 0,
      upcoming: totals.counts.upcoming || 0,
    },
    needsAttention: {
      overdue: toApi(overdue),
      dueSoon: toApi(dueSoon),
      verification: toApi(verification),
      expiringContracts: toApi(expiringContracts),
    },
    checklist: toApi(records),
  });
});

export { summary };
