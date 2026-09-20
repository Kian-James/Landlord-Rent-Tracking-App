import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { assertUuid, findOwnedOrThrow, queryString, text, unwrap, updateOwned } from '../db/helper.js';

const list = asyncHandler(async (req, res) => {
  let query = supabase
    .from('units')
    .select('*, current_tenant:tenants!current_tenant_id(id, full_name, status)')
    .eq('landlord_id', req.landlordId)
    .eq('archived', false)
    .order('name', { ascending: true });

  const propertyId = queryString(req.query.propertyId);
  const status = queryString(req.query.status);
  if (propertyId) query = query.eq('property_id', assertUuid(propertyId, 'property id'));
  if (status) query = query.eq('status', status);

  res.json({ units: toApi(unwrap(await query)) });
});

function normalizeUtilityDetail(input = {}) {
  const amount = input.amount === undefined || input.amount === null || input.amount === '' ? 0 : Math.max(0, Number(input.amount) || 0);
  const rawDueDay = input.dueDay;
  const dueDay =
    rawDueDay === undefined || rawDueDay === null || rawDueDay === ''
      ? null
      : Math.min(31, Math.max(1, Math.round(Number(rawDueDay)) || 1));
  return { amount, dueDay };
}

function normalizeUtilities(input = {}) {
  return {
    electricity: normalizeUtilityDetail(input.electricity),
    water: normalizeUtilityDetail(input.water),
    wifi: normalizeUtilityDetail(input.wifi),
  };
}

const create = asyncHandler(async (req, res) => {
  const { propertyId, name, monthlyRent, notes, utilities } = req.body;
  await findOwnedOrThrow('properties', propertyId, req.landlordId);

  const unit = unwrap(
    await supabase
      .from('units')
      .insert({
        landlord_id: req.landlordId,
        property_id: propertyId,
        name: text(name),
        monthly_rent: Number(monthlyRent),
        notes: text(notes),
        utilities: normalizeUtilities(utilities),
        status: 'vacant',
      })
      .select()
      .single()
  );
  res.status(201).json({ unit: toApi(unit) });
});

const update = asyncHandler(async (req, res) => {
  const unit = await findOwnedOrThrow('units', req.params.id, req.landlordId);
  const { name, monthlyRent, status, notes, utilities } = req.body;
  const patch = {};

  if (status && status !== unit.status) {
    if (status === 'occupied' && !unit.current_tenant_id) {
      throw new ApiError(400, 'Assign a tenant before marking this unit occupied.');
    }
    if (['vacant', 'maintenance'].includes(status)) patch.current_tenant_id = null;
  }

  if (name !== undefined) patch.name = text(name);
  if (monthlyRent !== undefined) patch.monthly_rent = Number(monthlyRent);
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = text(notes);
  if (utilities !== undefined) {
    const current = unit.utilities || {};
    patch.utilities = normalizeUtilities({
      electricity: { ...current.electricity, ...utilities.electricity },
      water: { ...current.water, ...utilities.water },
      wifi: { ...current.wifi, ...utilities.wifi },
    });
  }

  const updated = await updateOwned('units', unit.id, req.landlordId, patch);
  res.json({ unit: toApi(updated) });
});

const remove = asyncHandler(async (req, res) => {
  const unit = await findOwnedOrThrow('units', req.params.id, req.landlordId);
  if (unit.status === 'occupied') {
    throw new ApiError(409, 'Move the current tenant out before removing this unit.');
  }
  await updateOwned('units', unit.id, req.landlordId, { archived: true });
  res.status(204).end();
});

export { list, create, update, remove };
