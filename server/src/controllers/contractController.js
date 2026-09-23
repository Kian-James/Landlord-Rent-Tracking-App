import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { assertUuid, findOwnedOrThrow, queryString, text, unwrap, updateOwned } from '../db/helper.js';
import { buildFund, optionalAmount } from '../utils/moveInFunds.js';

const WITH_TENANT_AND_UNIT = '*, tenant:tenants!tenant_id(id, full_name), unit:units!unit_id(id, name)';

const list = asyncHandler(async (req, res) => {
  let query = supabase
    .from('contracts')
    .select(WITH_TENANT_AND_UNIT)
    .eq('landlord_id', req.landlordId)
    .order('start_date', { ascending: false });

  const tenantId = queryString(req.query.tenantId);
  const status = queryString(req.query.status);
  if (tenantId) query = query.eq('tenant_id', assertUuid(tenantId, 'tenant id'));
  if (status) query = query.eq('status', status);

  res.json({ contracts: toApi(unwrap(await query)) });
});

const expiringSoon = asyncHandler(async (req, res) => {
  const days = Number(req.query.days) || 60;
  const cutoff = new Date(Date.now() + days * 86400000);
  const contracts = unwrap(
    await supabase
      .from('contracts')
      .select(WITH_TENANT_AND_UNIT)
      .eq('landlord_id', req.landlordId)
      .eq('status', 'active')
      .lte('end_date', cutoff.toISOString())
      .order('end_date', { ascending: true })
  );
  res.json({ contracts: toApi(contracts) });
});

const renew = asyncHandler(async (req, res) => {
  const oldContract = await findOwnedOrThrow('contracts', req.params.id, req.landlordId);
  const {
    startDate, endDate, durationMonths, monthlyRent, notes,
    advanceMonths, advanceAmount, advanceMethod, advanceReferenceNumber,
    depositMonths, depositAmount, depositMethod, depositReferenceNumber,
  } = req.body;

  if (oldContract.status !== 'active') {
    throw new ApiError(409, 'Only an active contract can be renewed.');
  }

  const startIso = new Date(startDate).toISOString();
  const endIso = new Date(endDate).toISOString();
  const oldDeposit = oldContract.deposit || {};

  const newContract = unwrap(
    await supabase
      .from('contracts')
      .insert({
        landlord_id: req.landlordId,
        tenant_id: oldContract.tenant_id,
        unit_id: oldContract.unit_id,
        property_id: oldContract.property_id,
        start_date: startIso,
        end_date: endIso,
        duration_months: Number(durationMonths),
        monthly_rent: Number(monthlyRent ?? oldContract.monthly_rent),
        notes: text(notes),
        previous_contract_id: oldContract.id,
        status: 'active',
        advance: buildFund({
          months: advanceMonths !== undefined ? advanceMonths : 0,
          amount: advanceAmount,
          method: advanceMethod,
          referenceNumber: advanceReferenceNumber,
          collectedAt: startIso,
        }),
        deposit: buildFund({
          months: depositMonths !== undefined ? depositMonths : oldDeposit.months ?? 1,
          amount: optionalAmount(depositAmount) ?? oldDeposit.amountOverride ?? null,
          method: depositMethod || oldDeposit.method || null,
          referenceNumber: depositReferenceNumber ?? oldDeposit.referenceNumber ?? '',
          collectedAt: oldDeposit.collectedAt ?? startIso,
        }),
      })
      .select()
      .single()
  );

  let previousContract;
  try {
    previousContract = await updateOwned('contracts', oldContract.id, req.landlordId, { status: 'superseded' });

    unwrap(
      await supabase
        .from('tenants')
        .update({
          monthly_rent: newContract.monthly_rent,
          lease_start_date: newContract.start_date,
          lease_end_date: newContract.end_date,
          contract_duration_months: newContract.duration_months,
        })
        .eq('id', oldContract.tenant_id)
        .eq('landlord_id', req.landlordId)
    );
  } catch (err) {
    await supabase.from('contracts').delete().eq('id', newContract.id);
    throw err;
  }

  res.status(201).json({ contract: toApi(newContract), previousContract: toApi(previousContract) });
});

export { list, expiringSoon, renew };
