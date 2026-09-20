import asyncHandler from '../utils/asyncHandler.js';
import { supabase } from '../config/supabase.js';
import { toApi } from '../db/mapper.js';
import { countOf, findOwnedOrThrow, unwrap, updateOwned } from '../db/helper.js';

const list = asyncHandler(async (req, res) => {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('landlord_id', req.landlordId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(100);
  if (req.query.unreadOnly === 'true') query = query.eq('read', false);

  const notifications = unwrap(await query);
  const unreadCount = await countOf(
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('landlord_id', req.landlordId)
      .eq('read', false)
      .eq('dismissed', false)
  );

  res.json({ notifications: toApi(notifications), unreadCount });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await findOwnedOrThrow('notifications', req.params.id, req.landlordId);
  const updated = await updateOwned('notifications', notification.id, req.landlordId, { read: true });
  res.json({ notification: toApi(updated) });
});

const markAllRead = asyncHandler(async (req, res) => {
  unwrap(await supabase.from('notifications').update({ read: true }).eq('landlord_id', req.landlordId).eq('read', false));
  res.status(204).end();
});

const dismiss = asyncHandler(async (req, res) => {
  const notification = await findOwnedOrThrow('notifications', req.params.id, req.landlordId);
  await updateOwned('notifications', notification.id, req.landlordId, { dismissed: true });
  res.status(204).end();
});

export { list, markRead, markAllRead, dismiss };
