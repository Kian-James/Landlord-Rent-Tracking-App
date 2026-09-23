import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { assertUuid, findOwnedOrThrow, queryString, text, unwrap, updateOwned } from '../db/helper.js';
import { generateRentRecordsForMonth, refreshRentStatuses } from '../services/rentGenerator.js';
import { computeStatus } from '../services/rentStatus.js';
import { recordAudit } from '../services/audit.js';

const list = asyncHandler(async (req, res) => {
  await refreshRentStatuses(req.landlordId);

  let query = supabase
    .from('rent_records')
    .select('*, tenant:tenants!tenant_id(id, full_name), unit:units!unit_id(id, name), property:properties!property_id(id, name)')
    .eq('landlord_id', req.landlordId)
    .order('due_date', { ascending: true });

  const period = queryString(req.query.period);
  const status = queryString(req.query.status);
  const propertyId = queryString(req.query.propertyId);
  if (period) query = query.eq('period', period);
  if (status) query = query.eq('status', status);
  if (propertyId) query = query.eq('property_id', assertUuid(propertyId, 'property id'));

  res.json({ records: toApi(unwrap(await query)) });
});

function parseReferenceDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, 'referenceDate is not a valid date.');
  return date;
}

const generate = asyncHandler(async (req, res) => {
  const result = await generateRentRecordsForMonth(parseReferenceDate(req.body.referenceDate), req.landlordId);
  res.json(result);
});

const markPaid = asyncHandler(async (req, res) => {
  const record = await findOwnedOrThrow('rent_records', req.params.id, req.landlordId);
  if (record.status === 'paid') throw new ApiError(409, 'This rent period is already marked paid.');

  const { actualAmount, paymentDate, method, referenceNumber, notes } = req.body;
  const now = new Date().toISOString();

  const payment = unwrap(
    await supabase
      .from('payments')
      .insert({
        landlord_id: req.landlordId,
        tenant_id: record.tenant_id,
        unit_id: record.unit_id,
        property_id: record.property_id,
        rent_record_id: record.id,
        expected_amount: record.amount_due,
        actual_amount: Number(actualAmount ?? record.amount_due),
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : now,
        method: method || 'cash',
        reference_number: text(referenceNumber),
        notes: text(notes),
        verification_status: 'approved',
        verified_by: req.landlordId,
        verified_at: now,
        source: 'manual',
      })
      .select()
      .single()
  );

  const updated = await updateOwned('rent_records', record.id, req.landlordId, { status: 'paid', payment_id: payment.id });

  await recordAudit('payment.recorded_manual', { landlord: req.landlordId, metadata: { rentRecordId: record.id } });

  res.json({ record: toApi(updated), payment: toApi(payment) });
});

const markUnpaid = asyncHandler(async (req, res) => {
  const record = await findOwnedOrThrow('rent_records', req.params.id, req.landlordId);
  if (record.status !== 'paid') throw new ApiError(409, 'This rent period is not currently marked paid.');

  const status = computeStatus({ dueDate: record.due_date, status: 'pending' });
  const updated = await updateOwned('rent_records', record.id, req.landlordId, { status, payment_id: null });

  await recordAudit('payment.reverted', { landlord: req.landlordId, metadata: { rentRecordId: record.id } });

  res.json({ record: toApi(updated) });
});

export { list, generate, markPaid, markUnpaid };
