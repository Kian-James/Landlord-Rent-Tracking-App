import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { countOf, fetchAll, findOwnedOrThrow, text, unwrap, updateOwned } from '../db/helper.js';

const list = asyncHandler(async (req, res) => {
  const properties = unwrap(
    await supabase
      .from('properties')
      .select('*')
      .eq('landlord_id', req.landlordId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
  );

  const units = await fetchAll(() =>
    supabase.from('units').select('property_id, status').eq('landlord_id', req.landlordId).eq('archived', false).order('id')
  );
  const tally = new Map();
  for (const unit of units) {
    const entry = tally.get(unit.property_id) || { unitCount: 0, occupiedCount: 0 };
    entry.unitCount += 1;
    if (unit.status === 'occupied') entry.occupiedCount += 1;
    tally.set(unit.property_id, entry);
  }

  res.json({
    properties: properties.map((p) => ({
      ...toApi(p),
      unitCount: tally.get(p.id)?.unitCount || 0,
      occupiedCount: tally.get(p.id)?.occupiedCount || 0,
    })),
  });
});

const getOne = asyncHandler(async (req, res) => {
  const property = await findOwnedOrThrow('properties', req.params.id, req.landlordId);
  const units = unwrap(
    await supabase.from('units').select('*').eq('property_id', property.id).eq('landlord_id', req.landlordId).eq('archived', false)
  );
  res.json({ property: toApi(property), units: toApi(units) });
});

const create = asyncHandler(async (req, res) => {
  const { name, address, description, notes } = req.body;
  const property = unwrap(
    await supabase
      .from('properties')
      .insert({
        landlord_id: req.landlordId,
        name: text(name),
        address: text(address),
        description: text(description),
        notes: text(notes),
      })
      .select()
      .single()
  );
  res.status(201).json({ property: toApi(property) });
});

const update = asyncHandler(async (req, res) => {
  const property = await findOwnedOrThrow('properties', req.params.id, req.landlordId);
  const { name, address, description, notes } = req.body;

  const patch = {};
  if (name !== undefined) patch.name = text(name);
  if (address !== undefined) patch.address = text(address);
  if (description !== undefined) patch.description = text(description);
  if (notes !== undefined) patch.notes = text(notes);

  const updated = await updateOwned('properties', property.id, req.landlordId, patch);
  res.json({ property: toApi(updated) });
});

const archive = asyncHandler(async (req, res) => {
  const property = await findOwnedOrThrow('properties', req.params.id, req.landlordId);
  const occupied = await countOf(
    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property.id)
      .eq('archived', false)
      .eq('status', 'occupied')
  );
  if (occupied > 0) {
    throw new ApiError(409, 'This property still has occupied units. Move tenants out first.');
  }
  await updateOwned('properties', property.id, req.landlordId, { archived: true });
  unwrap(await supabase.from('units').update({ archived: true }).eq('property_id', property.id).eq('landlord_id', req.landlordId));
  res.status(204).end();
});

export { list, getOne, create, update, archive };
