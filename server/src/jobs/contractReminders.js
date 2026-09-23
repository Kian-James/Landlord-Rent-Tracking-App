import { supabase } from '../config/supabase.js';
import { fetchAll, chunk, unwrap } from '../db/helper.js';
import { notifyMany } from '../services/notifications.js';

async function checkExpiringContracts() {
  const contracts = await fetchAll(() =>
    supabase.from('contracts').select('*').eq('status', 'active').is('reminder_sent_at', null).order('id')
  );

  const due = [];
  for (const contract of contracts) {
    const daysUntilExpiry = Math.ceil((new Date(contract.end_date) - new Date()) / 86400000);
    if (daysUntilExpiry > contract.reminder_days_before) continue;
    due.push({ contract, daysUntilExpiry });
  }

  await notifyMany(
    due.map(({ contract, daysUntilExpiry }) => ({
      landlord: contract.landlord_id,
      type: 'contract_expiring',
      title: 'Contract expiring soon',
      message: `A lease expires in ${Math.max(daysUntilExpiry, 0)} day(s).`,
      relatedResourceType: 'Contract',
      relatedResourceId: contract.id,
      priority: 'important',
      dedupeKey: `contract_expiring:${contract.id}`,
    }))
  );

  for (const batch of chunk(due.map((d) => d.contract.id), 150)) {
    unwrap(await supabase.from('contracts').update({ reminder_sent_at: new Date().toISOString() }).in('id', batch));
  }

  return { checked: contracts.length, notified: due.length };
}

export { checkExpiringContracts };
