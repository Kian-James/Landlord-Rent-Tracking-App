import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';
import { unwrap } from '../db/helper.js';
import { recordAudit } from './audit.js';

const LANDLORD_COLUMNS = 'id, name, email, notification_preferences, created_at, updated_at';

export async function getOrCreateLandlord(user, { ip = '' } = {}) {
  const uid = user.id;

  const existing = unwrap(await supabase.from('landlords').select(LANDLORD_COLUMNS).eq('id', uid).maybeSingle());
  if (existing) return { landlord: existing, isNew: false };

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
    return { landlord: data, isNew: true };
  }

  if (error.code === '23505') {
    const raced = unwrap(await supabase.from('landlords').select(LANDLORD_COLUMNS).eq('id', uid).maybeSingle());
    if (raced) return { landlord: raced, isNew: false };
    throw new ApiError(409, 'An account with this email already exists.');
  }
  throw new Error(error.message);
}

export async function updateLandlord(id, patch) {
  return unwrap(await supabase.from('landlords').update(patch).eq('id', id).select(LANDLORD_COLUMNS).single());
}
