import { supabase } from '../config/supabase.js';
import { chunk, fetchAll, unwrap } from '../db/helper.js';
import { computeStatus } from './rentStatus.js';
import { notifyMany } from './notifications.js';

const BILL_TYPES = ['electricity', 'water', 'wifi'];

function periodKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dueDateFor(year, month, dueDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dueDay, lastDay));
}

async function generateUtilityBillsForMonth(referenceDate = new Date(), landlordId = null) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const period = periodKey(referenceDate);

  const units = await fetchAll(() => {
    let q = supabase.from('units').select('*').eq('archived', false).order('id');
    if (landlordId) q = q.eq('landlord_id', landlordId);
    return q;
  });

  const rows = [];
  for (const unit of units) {
    for (const type of BILL_TYPES) {
      const detail = unit.utilities?.[type];
      if (!detail?.dueDay) continue;

      rows.push({
        landlord_id: unit.landlord_id,
        unit_id: unit.id,
        property_id: unit.property_id,
        tenant_id: unit.current_tenant_id || null,
        type,
        period,
        due_date: dueDateFor(year, month, detail.dueDay).toISOString(),
        amount_due: detail.amount || null,
        status: 'upcoming',
      });
    }
  }

  let created = 0;
  for (const batch of chunk(rows, 500)) {
    const inserted = unwrap(
      await supabase
        .from('utility_bill_records')
        .upsert(batch, { onConflict: 'unit_id,type,period', ignoreDuplicates: true })
        .select('id')
    );
    created += inserted.length;
  }
  return { period, created, unitsConsidered: units.length };
}

async function refreshUtilityBillStatuses(landlordId = null) {
  const records = await fetchAll(() => {
    let q = supabase.from('utility_bill_records').select('*, unit:units!unit_id(name)').neq('status', 'paid').order('id');
    if (landlordId) q = q.eq('landlord_id', landlordId);
    return q;
  });

  const idsByNextStatus = new Map();
  const overdue = [];

  for (const record of records) {
    const nextStatus = computeStatus({ dueDate: record.due_date, status: record.status });
    if (nextStatus === record.status) continue;
    if (!idsByNextStatus.has(nextStatus)) idsByNextStatus.set(nextStatus, []);
    idsByNextStatus.get(nextStatus).push(record.id);
    if (nextStatus === 'overdue') overdue.push(record);
  }

  let updated = 0;
  for (const [status, ids] of idsByNextStatus) {
    for (const batch of chunk(ids, 150)) {
      unwrap(await supabase.from('utility_bill_records').update({ status }).in('id', batch));
      updated += batch.length;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  await notifyMany(
    overdue.map((record) => ({
      landlord: record.landlord_id,
      type: 'utility_bill_overdue',
      title: 'Utility bill overdue',
      message: `${record.type} for ${record.unit?.name || 'a unit'} is overdue.`,
      relatedResourceType: 'UtilityBillRecord',
      relatedResourceId: record.id,
      priority: 'important',
      dedupeKey: `utility_overdue:${record.id}:${today}`,
    }))
  );

  return { checked: records.length, updated };
}

export { generateUtilityBillsForMonth, refreshUtilityBillStatuses, periodKey };
