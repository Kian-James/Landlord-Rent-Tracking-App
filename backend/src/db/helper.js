import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) =>
  typeof value === 'string' && UUID_RE.test(value);

export function assertUuid(value, label = 'id') {
  if (!isUuid(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }

  return value;
}

export function unwrap({ data, error }) {
  if (error) {
    const err = new Error(error.message || 'Database error');

    err.code = error.code;
    err.details = error.details;

    throw err;
  }

  return data;
}

export async function findOwnedOrThrow(
  table,
  id,
  landlordId,
  { select = '*', match = {} } = {}
) {
  if (!isUuid(id)) {
    throw new ApiError(404, 'Not found.');
  }

  let query = supabase
    .from(table)
    .select(select)
    .eq('id', id)
    .eq('landlord_id', landlordId);

  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value);
  }

  const row = unwrap(await query.maybeSingle());

  if (!row) {
    throw new ApiError(404, 'Not found.');
  }

  return row;
}

export async function fetchAll(build, pageSize = 1000) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const page = unwrap(
      await build().range(from, from + pageSize - 1)
    );

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

// Split an array into smaller chunks.
export function chunk(list, size) {
  const chunks = [];

  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }

  return chunks;
}

export const escapeLike = (text) =>
  String(text).replace(/[\\%_]/g, (c) => `\\${c}`);

export const text = (value) =>
  value === undefined || value === null
    ? ''
    : String(value).trim();

export const queryString = (value) =>
  typeof value === 'string' && value !== ''
    ? value
    : undefined;

export async function countOf(query) {
  const { count, error } = await query;

  if (error) {
    const err = new Error(error.message || 'Database error');
    err.code = error.code;

    throw err;
  }

  return count ?? 0;
}

export async function updateOwned(
  table,
  id,
  landlordId,
  patch,
  { select = '*' } = {}
) {
  // Nothing to update, so just return the existing record.
  if (Object.keys(patch).length === 0) {
    return findOwnedOrThrow(table, id, landlordId, { select });
  }

  return unwrap(
    await supabase
      .from(table)
      .update(patch)
      .eq('id', id)
      .eq('landlord_id', landlordId)
      .select(select)
      .single()
  );
}

