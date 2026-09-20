import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { assertUuid, findOwnedOrThrow, queryString, text, unwrap, updateOwned } from '../db/helper.js';
import { generateUtilityBillsForMonth, refreshUtilityBillStatuses } from '../services/utilityBillGenerator.js';
import { computeStatus } from '../services/rentStatus.js';
import { recordAudit } from '../services/audit.js';

const list = asyncHandler(async (req, res) => {
  await refreshUtilityBillStatuses(req.landlordId);

  let query = supabase
    .from('utility_bill_records')
    .select('*, tenant:tenants!tenant_id(id, full_name), unit:units!unit_id(id, name), property:properties!property_id(id, name)')
    .eq('landlord_id', req.landlordId)
    .order('due_date', { ascending: true });

  const period = queryString(req.query.period);
  const status = queryString(req.query.status);
  const type = queryString(req.query.type);
  const propertyId = queryString(req.query.propertyId);
  if (period) query = query.eq('period', period);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  if (propertyId) query = query.eq('property_id', assertUuid(propertyId, 'property id'));

  res.json({ records: toApi(unwrap(await query)) });
});

const generate = asyncHandler(async (req, res) => {
  let referenceDate = new Date();
  if (req.body.referenceDate) {
    referenceDate = new Date(req.body.referenceDate);
    if (Number.isNaN(referenceDate.getTime())) throw new ApiError(400, 'referenceDate is not a valid date.');
  }
  res.json(await generateUtilityBillsForMonth(referenceDate, req.landlordId));
});

const markPaid = asyncHandler(async (req, res) => {
  const record = await findOwnedOrThrow('utility_bill_records', req.params.id, req.landlordId);
  if (record.status === 'paid') throw new ApiError(409, 'This bill is already marked paid.');

  const { paidAmount, notes } = req.body;
  const patch = { status: 'paid', paid_at: new Date().toISOString() };
  if (paidAmount !== undefined) patch.paid_amount = Number(paidAmount);
  else if (record.amount_due) patch.paid_amount = record.amount_due;
  if (notes !== undefined) patch.notes = text(notes);

  const updated = await updateOwned('utility_bill_records', record.id, req.landlordId, patch);

  await recordAudit('utility_bill.marked_paid', {
    landlord: req.landlordId,
    metadata: { utilityBillId: record.id, type: record.type },
  });

  res.json({ record: toApi(updated) });
});

const markUnpaid = asyncHandler(async (req, res) => {
  const record = await findOwnedOrThrow('utility_bill_records', req.params.id, req.landlordId);
  if (record.status !== 'paid') throw new ApiError(409, 'This bill is not currently marked paid.');

  const status = computeStatus({ dueDate: record.due_date, status: 'pending' });
  const updated = await updateOwned('utility_bill_records', record.id, req.landlordId, {
    status,
    paid_at: null,
    paid_amount: null,
  });

  await recordAudit('utility_bill.reverted', {
    landlord: req.landlordId,
    metadata: { utilityBillId: record.id, type: record.type },
  });

  res.json({ record: toApi(updated) });
});

export { list, generate, markPaid, markUnpaid };
