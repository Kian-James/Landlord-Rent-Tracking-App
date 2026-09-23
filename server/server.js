import 'dotenv/config';
import { createApp } from './src/app.js';
import { startScheduler } from './src/jobs/scheduler.js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FIREBASE_PROJECT_ID'];

async function main() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
    process.exit(1);
  }

  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });

  if (process.env.NODE_ENV !== 'test') {
    startScheduler();
  }
}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
