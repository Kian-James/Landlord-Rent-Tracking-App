import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';
import { unwrap } from '../db/helper.js';
import { recordAudit } from './audit.js';
import { hasColumn, MIGRATION_HINT } from './schemaFeatures.js';

const BASE_COLUMNS = 'id, name, email, notification_preferences, created_at, updated_at';
const FULL_COLUMNS = 'id, name, email, address, notification_preferences, created_at, updated_at';

// `address` only exists once the contract-PDF migration has been run.
const columns = async () => ((await hasColumn('landlords', 'address')) ? FULL_COLUMNS : BASE_COLUMNS);

// The landlord record is read on every request, so keep it for a few seconds.
// (Changing the profile below refreshes it on this server straight away.)
const LANDLORD_TTL_MS = 15 * 1000;
const landlordCache = new Map(); // id -> { landlord, until }

function remember(landlord) {
  landlordCache.set(landlord.id, { landlord, until: Date.now() + LANDLORD_TTL_MS });
  if (landlordCache.size > 1000) landlordCache.delete(landlordCache.keys().next().value);
}

export async function getOrCreateLandlord(user, { ip = '' } = {}) {
  const uid = user.id;

  const cached = landlordCache.get(uid);
  if (cached && cached.until > Date.now()) return { landlord: cached.landlord, isNew: false };

  const LANDLORD_COLUMNS = await columns();
  const existing = unwrap(await supabase.from('landlords').select(LANDLORD_COLUMNS).eq('id', uid).maybeSingle());
  if (existing) {
    remember(existing);
    return { landlord: existing, isNew: false };
  }

  if (!user.email) {
    throw new ApiError(403, 'Your account needs an email address to use PropTrack.');
  }
  const email = user.email.toLowerCase();
  const metaName = user.user_metadata?.name || user.user_metadata?.full_name;
  const name = String(metaName || email.split('@')[0]).trim().slice(0, 120) || 'Landlord';

  const { data, error } = await supabase
    .from('landlords')
    .insert({ id: uid, name, email })
    .select(LANDLORD_COLUMNS)
    .single();

  if (!error) {
    await recordAudit('register', { landlord: uid, ip });
    remember(data);
    return { landlord: data, isNew: true };
  }

  if (error.code === '23505') {
    const raced = unwrap(await supabase.from('landlords').select(LANDLORD_COLUMNS).eq('id', uid).maybeSingle());
    if (raced) {
      remember(raced);
      return { landlord: raced, isNew: false };
    }
    throw new ApiError(409, 'An account with this email already exists.');
  }
  throw new Error(error.message);
}

export async function updateLandlord(id, patch) {
  const LANDLORD_COLUMNS = await columns();
  const update = { ...patch };
  if (LANDLORD_COLUMNS === BASE_COLUMNS && 'address' in update) {
    // migration not run yet: ignore an empty address, refuse a real one with a clear message
    if (String(update.address || '').trim()) throw new ApiError(503, MIGRATION_HINT);
    delete update.address;
  }
  const updated = unwrap(await supabase.from('landlords').update(update).eq('id', id).select(LANDLORD_COLUMNS).single());
  remember(updated);
  return updated;
}
