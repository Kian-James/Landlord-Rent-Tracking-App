// Vercel serverless entry point.
//
// Vercel doesn't run a long-lived process (no app.listen), it calls this
// module per-request. Exporting the Express app directly works because an
// Express app is itself a (req, res) request handler.
//
// This intentionally does NOT start the node-cron scheduler (see
// src/jobs/scheduler.js) — cron.schedule() needs a persistent process, which
// serverless functions are not. Local/dev still uses server.js, which does
// start it. See README "Cron on Vercel" note for the serverless alternative.

import { createApp } from '../src/app.js';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'FIREBASE_PROJECT_ID'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  // Don't process.exit() here — that would crash the whole serverless
  // runtime. Log loudly instead; requests will fail until the env vars
  // are set in the Vercel dashboard.
  console.error(`Missing required environment variables: ${missing.join(', ')}. Set these in Vercel > Project > Settings > Environment Variables.`);
}

const app = createApp();

export default app;
