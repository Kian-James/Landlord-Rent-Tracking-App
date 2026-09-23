import cron from 'node-cron';
import { generateRentRecordsForMonth, refreshRentStatuses } from '../services/rentGenerator.js';
import { generateUtilityBillsForMonth, refreshUtilityBillStatuses } from '../services/utilityBillGenerator.js';
import { checkExpiringContracts } from './contractReminders.js';

function startScheduler() {
  cron.schedule('0 1 * * *', async () => {
    try {
      const result = await generateRentRecordsForMonth(new Date());
      console.log('[cron] rent generation', result);
    } catch (err) {
      console.error('[cron] rent generation failed', err);
    }
  });

  cron.schedule('2 1 * * *', async () => {
    try {
      const result = await generateUtilityBillsForMonth(new Date());
      console.log('[cron] utility bill generation', result);
    } catch (err) {
      console.error('[cron] utility bill generation failed', err);
    }
  });

  cron.schedule('5 1 * * *', async () => {
    try {
      const result = await refreshRentStatuses();
      console.log('[cron] status refresh', result);
    } catch (err) {
      console.error('[cron] status refresh failed', err);
    }
  });

  cron.schedule('6 1 * * *', async () => {
    try {
      const result = await refreshUtilityBillStatuses();
      console.log('[cron] utility bill status refresh', result);
    } catch (err) {
      console.error('[cron] utility bill status refresh failed', err);
    }
  });

  cron.schedule('10 1 * * *', async () => {
    try {
      const result = await checkExpiringContracts();
      console.log('[cron] contract reminders', result);
    } catch (err) {
      console.error('[cron] contract reminders failed', err);
    }
  });

  console.log('[cron] scheduler started');
}

export { startScheduler };
