import 'dotenv/config';
import { createApp } from './src/app.js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FIREBASE_PROJECT_ID'];

async function main() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
    process.exit(1);
  }

  const app = createApp();
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`[server] listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
