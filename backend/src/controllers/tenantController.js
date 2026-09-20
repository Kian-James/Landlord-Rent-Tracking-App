import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { escapeLike, findOwnedOrThrow, queryString, text, unwrap, updateOwned } from '../db/helper.js';
import { buildFund } from '../utils/moveInFunds.js';

const list = asyncHandler(async (req, res) => {
  let query = supabase
    .from('tenants')
    .select('*, unit:units!unit_id(id, name), property:properties!property_id(id, name)')
    .eq('landlord_id', req.landlordId)
    .order('created_at', { ascending: false });

  const status = queryString(req.query.status);
  const search = queryString(req.query.search);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('full_name', `%${escapeLike(search)}%`);

  const tenants = unwrap(await query);

  const allContracts = unwrap(
    await supabase.from('contracts').select('*').eq('landlord_id', req.landlordId).order('start_date', { ascending: false })
  );
  const contractByTenantId = new Map();
  for (const contract of allContracts) {
    if (!contractByTenantId.has(contract.tenant_id)) contractByTenantId.set(contract.tenant_id, contract);
  }

  res.json({
    tenants: tenants.map((t) => ({
      ...toApi(t),
      contract: contractByTenantId.has(t.id) ? toApi(contractByTenantId.get(t.id)) : null,
    })),
  });
});

const getOne = asyncHandler(async (req, res) => {
  const tenant = await findOwnedOrThrow('tenants', req.params.id, req.landlordId);
  const contracts = unwrap(
    await supabase
      .from('contracts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('landlord_id', req.landlordId)
      .order('start_date', { ascending: false })
  );
  res.json({ tenant: toApi(tenant), contracts: toApi(contracts) });
});

const create = asyncHandler(async (req, res) => {
  const {
    unitId, fullName, email, phone, monthlyRent, rentDueDay,
    leaseStartDate, leaseEndDate, contractDurationMonths, notes,
    advanceMonths, advanceAmount, advanceMethod, advanceReferenceNumber,
    depositMonths, depositAmount, depositMethod, depositReferenceNumber,
  } = req.body;

  const unit = await findOwnedOrThrow('units', unitId, req.landlordId);
  if (unit.status === 'occupied') {
    throw new ApiError(409, 'This unit is already occupied. Move out the current tenant first.');
  }

  const startIso = new Date(leaseStartDate).toISOString();
  const endIso = new Date(leaseEndDate).toISOString();

  const tenant = unwrap(
    await supabase
      .from('tenants')
      .insert({
        landlord_id: req.landlordId,
        property_id: unit.property_id,
        unit_id: unit.id,
        full_name: text(fullName),
        email: text(email).toLowerCase(),
        phone: text(phone),
        monthly_rent: Number(monthlyRent ?? unit.monthly_rent),
        rent_due_day: Number(rentDueDay ?? 1),
        lease_start_date: startIso,
        lease_end_date: endIso,
        contract_duration_months: Number(contractDurationMonths) || 12,
        notes: text(notes),
        status: 'active',
      })
      .select()
      .single()
  );

  let contract;
  try {
    contract = unwrap(
      await supabase
        .from('contracts')
        .insert({
          landlord_id: req.landlordId,
          tenant_id: tenant.id,
          unit_id: unit.id,
          property_id: unit.property_id,
          start_date: startIso,
          end_date: endIso,
          duration_months: tenant.contract_duration_months,
          monthly_rent: tenant.monthly_rent,
          status: 'active',
          advance: buildFund({
            months: advanceMonths !== undefined ? advanceMonths : 1,
            amount: advanceAmount,
            method: advanceMethod,
            referenceNumber: advanceReferenceNumber,
            collectedAt: startIso,
          }),
          deposit: buildFund({
            months: depositMonths !== undefined ? depositMonths : 1,
            amount: depositAmount,
            method: depositMethod,
            referenceNumber: depositReferenceNumber,
            collectedAt: startIso,
          }),
        })
        .select()
        .single()
    );

    unwrap(
      await supabase.from('units').update({ status: 'occupied', current_tenant_id: tenant.id }).eq('id', unit.id).eq('landlord_id', req.landlordId)
    );
  } catch (err) {
    await supabase.from('tenants').delete().eq('id', tenant.id);
    throw err;
  }

  res.status(201).json({ tenant: toApi(tenant), contract: toApi(contract) });
});

const update = asyncHandler(async (req, res) => {
  const tenant = await findOwnedOrThrow('tenants', req.params.id, req.landlordId);
  const { fullName, email, phone, monthlyRent, rentDueDay, notes, status } = req.body;

  const patch = {};
  if (fullName !== undefined) patch.full_name = text(fullName);
  if (email !== undefined) patch.email = text(email).toLowerCase();
  if (phone !== undefined) patch.phone = text(phone);
  if (monthlyRent !== undefined) patch.monthly_rent = Number(monthlyRent);
  if (rentDueDay !== undefined) patch.rent_due_day = Number(rentDueDay);
  if (notes !== undefined) patch.notes = text(notes);
  if (status !== undefined) patch.status = status;

  const updated = await updateOwned('tenants', tenant.id, req.landlordId, patch);
  res.json({ tenant: toApi(updated) });
});

const moveOut = asyncHandler(async (req, res) => {
  const tenant = await findOwnedOrThrow('tenants', req.params.id, req.landlordId);
  const unit = await findOwnedOrThrow('units', tenant.unit_id, req.landlordId);

  const updatedTenant = await updateOwned('tenants', tenant.id, req.landlordId, { status: 'vacated' });
  const updatedUnit = await updateOwned('units', unit.id, req.landlordId, { status: 'vacant', current_tenant_id: null });

  unwrap(
    await supabase
      .from('contracts')
      .update({ status: 'terminated' })
      .eq('tenant_id', tenant.id)
      .eq('landlord_id', req.landlordId)
      .eq('status', 'active')
  );

  res.json({ tenant: toApi(updatedTenant), unit: toApi(updatedUnit) });
});

export { list, getOne, create, update, moveOut };
