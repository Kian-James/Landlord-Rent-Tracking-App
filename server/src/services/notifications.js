import { supabase } from '../config/supabase.js';
import { chunk, unwrap } from '../db/helper.js';

function toRow(n) {
  return {
    landlord_id: n.landlord,
    type: n.type,
    title: n.title,
    message: n.message,
    related_resource_type: n.relatedResourceType,
    related_resource_id: n.relatedResourceId,
    priority: n.priority || 'informational',
    dedupe_key: n.dedupeKey,
  };
}

async function notifyMany(list) {
  const created = [];
  for (const batch of chunk(list.map(toRow), 500)) {
    const rows = unwrap(
      await supabase
        .from('notifications')
        .upsert(batch, { onConflict: 'landlord_id,dedupe_key', ignoreDuplicates: true })
        .select()
    );
    created.push(...rows);
  }
  return created;
}

export { notifyMany };
