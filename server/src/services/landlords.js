import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';
import { unwrap } from '../db/helper.js';
import { recordAudit } from './audit.js';

const LANDLORD_COLUMNS = 'id, name, email, notification_preferences, created_at, updated_at';

export async function getOrCreateLandlord(decodedToken, { ip = '' } = {}) {
  const uid = decodedToken.uid;

  const existing = unwrap(await supabase.from('landlords').select(LANDLORD_COLUMNS).eq('id', uid).maybeSingle());
  if (existing) return existing;

  if (!decodedToken.email) {
    throw new ApiError(403, 'Your account needs an email address to use PropTrack.');
  }
  const email = decodedToken.email.toLowerCase();
  const name = String(decodedToken.name || email.split('@')[0]).trim().slice(0, 120) || 'Landlord';

  const { data, error } = await supabase
    .from('landlords')
    .insert({ id: uid, name, email })
    .select(LANDLORD_COLUMNS)
    .single();

  if (!error) {
    await recordAudit('register', { landlord: uid, ip });
    return data;
  }

  if (error.code === '23505') {
    const raced = unwrap(await supabase.from('landlords').select(LANDLORD_COLUMNS).eq('id', uid).maybeSingle());
    if (raced) return raced;
    throw new ApiError(409, 'An account with this email already exists.');
  }
  throw new Error(error.message);
}

export async function updateLandlord(id, patch) {
  return unwrap(await supabase.from('landlords').update(patch).eq('id', id).select(LANDLORD_COLUMNS).single());
}
