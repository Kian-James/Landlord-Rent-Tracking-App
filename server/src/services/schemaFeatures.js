// Lets newer features degrade gracefully when a database migration hasn't been
// run yet: the rest of the app keeps working and the new field is just off.

import { supabase } from '../config/supabase.js';

const known = new Map(); // "table.column" -> { ok, checkedAt }
const RECHECK_MS = 30 * 1000;

// Does this column exist? A "yes" is remembered; a "no" is re-checked every 30 seconds,
// so running the migration takes effect without restarting the server.
export async function hasColumn(table, column) {
  const key = `${table}.${column}`;
  const hit = known.get(key);
  if (hit && (hit.ok || Date.now() - hit.checkedAt < RECHECK_MS)) return hit.ok;
  const { error } = await supabase.from(table).select(column).limit(1);
  const ok = !(error && error.code === '42703');
  known.set(key, { ok, checkedAt: Date.now() });
  return ok;
}

export const MIGRATION_HINT =
  'This needs a database update first. Run db/migrations/002_contract_pdf_templates.sql in Supabase, then try again.';
