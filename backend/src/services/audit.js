import { supabase } from '../config/supabase.js';

export async function recordAudit(event, { landlord, metadata = {}, ip = '' } = {}) {
  try {
    const { error } = await supabase.from('audit_logs').insert({ landlord_id: landlord, event, metadata, ip });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[audit] failed to record event', event, err.message);
  }
}
