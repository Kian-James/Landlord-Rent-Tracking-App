import { supabase } from '../config/supabase.js';
import { chunk, fetchAll, unwrap } from '../db/helper.js';
import { computeStatus } from './rentStatus.js';
import { getPrepaidPeriods } from './prepaidPeriods.js';
import { notifyMany } from './notifications.js';

function periodKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dueDateFor(year, month, dueDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

async function generateRentRecordsForMonth(referenceDate = new Date(), landlordId = null) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const period = periodKey(referenceDate);

  const tenants = await fetchAll(() => {
    let q = supabase.from('tenants').select('*').in('status', ['active', 'notice_period']).order('id');
    if (landlordId) q = q.eq('landlord_id', landlordId);
    return q;
  });

  const activeContracts = await fetchAll(() => {
    let q = supabase.from('contracts').select('*').eq('status', 'active').order('id');
    if (landlordId) q = q.eq('landlord_id', landlordId);
    return q;
  });
  const contractByTenantId = new Map(activeContracts.map((c) => [c.tenant_id, c]));

  const candidates = tenants.map((tenant) => {
    const contract = contractByTenantId.get(tenant.id);
    const isPrepaid = contract
      ? getPrepaidPeriods({
          advance: contract.advance,
          startDate: contract.start_date,
          endDate: contract.end_date,
        }).has(period)
      : false;
    return {
      contract,
      isPrepaid,
      row: {
        landlord_id: tenant.landlord_id,
        tenant_id: tenant.id,
        unit_id: tenant.unit_id,
        property_id: tenant.property_id,
        period,
        due_date: dueDateFor(year, month, tenant.rent_due_day).toISOString(),
        amount_due: tenant.monthly_rent,
        status: isPrepaid ? 'paid' : 'upcoming',
      },
    };
  });

  const created = [];
  for (const batch of chunk(candidates, 500)) {
    const rows = unwrap(
      await supabase
        .from('rent_records')
        .upsert(
          batch.map((c) => c.row),
          { onConflict: 'tenant_id,period', ignoreDuplicates: true }
        )
        .select()
    );
    created.push(...rows);
  }

  const prepaid = created.filter((r) => r.status === 'paid');
  for (const batch of chunk(prepaid, 200)) {
    const payments = unwrap(
      await supabase
        .from('payments')
        .insert(
          batch.map((record) => {
            const contract = contractByTenantId.get(record.tenant_id);
            const collectedAt = contract.advance?.collectedAt || contract.start_date;
            return {
              landlord_id: record.landlord_id,
              tenant_id: record.tenant_id,
              unit_id: record.unit_id,
              property_id: record.property_id,
              rent_record_id: record.id,
              expected_amount: record.amount_due,
              actual_amount: record.amount_due,
              payment_date: collectedAt,
              method: contract.advance?.method || null,
              reference_number: contract.advance?.referenceNumber || '',
              notes: 'Covered by advance rent collected at move-in.',
              verification_status: 'approved',
              verified_at: collectedAt,
              source: 'advance',
            };
          })
        )
        .select('id, rent_record_id')
    );
    await Promise.all(
      payments.map(async (p) =>
        unwrap(await supabase.from('rent_records').update({ payment_id: p.id }).eq('id', p.rent_record_id))
      )
    );
  }

  return { period, created: created.length, tenantsConsidered: tenants.length, coveredByAdvance: prepaid.length };
}

async function refreshRentStatuses(landlordId = null) {
  const records = await fetchAll(() => {
    let q = supabase.from('rent_records').select('*').neq('status', 'paid').order('id');
    if (landlordId) q = q.eq('landlord_id', landlordId);
    return q;
  });
  if (records.length === 0) return { checked: 0, updated: 0 };

  const awaiting = await fetchAll(() => {
    let q = supabase
      .from('payments')
      .select('id, rent_record_id')
      .eq('verification_status', 'awaiting_verification')
      .order('id');
    if (landlordId) q = q.eq('landlord_id', landlordId);
    return q;
  });
  const awaitingVerificationIds = new Set(awaiting.map((p) => p.rent_record_id));

  const idsByNextStatus = new Map();
  const toNotify = [];

  for (const record of records) {
    const nextStatus = computeStatus(
      { dueDate: record.due_date, status: record.status },
      { hasAwaitingVerification: awaitingVerificationIds.has(record.id) }
    );

    if (nextStatus !== record.status) {
      if (!idsByNextStatus.has(nextStatus)) idsByNextStatus.set(nextStatus, []);
      idsByNextStatus.get(nextStatus).push(record.id);
      record.status = nextStatus;
      toNotify.push(record);
    } else if (nextStatus === 'overdue') {
      toNotify.push(record);
    }
  }

  let updated = 0;
  for (const [status, ids] of idsByNextStatus) {
    for (const batch of chunk(ids, 150)) {
      unwrap(await supabase.from('rent_records').update({ status }).in('id', batch));
      updated += batch.length;
    }
  }

  await notifyMany(toNotify.map(statusNotificationFor).filter(Boolean));

  return { checked: records.length, updated };
}

function statusNotificationFor(record) {
  const today = new Date().toISOString().slice(0, 10);
  const daysUntilDue = Math.ceil((new Date(record.due_date) - new Date()) / 86400000);
  const base = {
    landlord: record.landlord_id,
    relatedResourceType: 'RentRecord',
    relatedResourceId: record.id,
  };

  if (record.status === 'overdue') {
    return {
      ...base,
      type: 'rent_overdue',
      title: 'Rent overdue',
      message: `Rent for period ${record.period} is overdue.`,
      priority: 'critical',
      dedupeKey: `rent_overdue:${record.id}:${today}`,
    };
  }
  if (record.status === 'upcoming' && [3, 1].includes(daysUntilDue)) {
    return {
      ...base,
      type: 'rent_due_soon',
      title: 'Rent due soon',
      message: `Rent for period ${record.period} is due in ${daysUntilDue} day(s).`,
      priority: 'important',
      dedupeKey: `rent_due_soon:${record.id}:${daysUntilDue}`,
    };
  }
  if (record.status === 'pending') {
    return {
      ...base,
      type: 'rent_due_today',
      title: 'Rent due today',
      message: `Rent for period ${record.period} is due today.`,
      priority: 'important',
      dedupeKey: `rent_due_today:${record.id}`,
    };
  }
  return null;
}

export { generateRentRecordsForMonth, refreshRentStatuses, periodKey };
