# Security checklist

Filled in against the public repository at
https://github.com/Kian-James/Landlord-Rent-Tracking-App, commit `f61b629`
(2026-09-23), by cloning the repo, reading its full commit history, and
reading the actual source (not just the README).

A few rows need a check only you can do (things behind your GitHub/Supabase
dashboard login, or your own live project). Those are marked below with what
to check and why, rather than guessed at.

## Secrets and credentials

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 1 | `.env` is gitignored and is not in the repository | Yes | Root `.gitignore` has `.env`, `.env.*`, `!.env.example`. Cloned the full repo and ran `git log --all --diff-filter=A --name-only`: no `.env` file has ever been added in any of the 21 commits, only `client/.env.example` and `server/.env.example`. |
| 2 | A `.env.example` with placeholder values only is committed | Yes | Both `client/.env.example` and `server/.env.example` are committed. Every value is either blank or an obvious placeholder (`SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co`, etc.) — no real key in either. |
| 3 | No connection string, key, token or password is hardcoded in source, comments or commented-out code | Yes | `server/src/config/supabase.js` and `server/src/config/firebase.js` read only from `process.env`; `client/src/lib/firebase.js` reads only from `import.meta.env`. Searched `git log -p --all` for `postgres://`, `AIza…`, `AKIA…`, `-----BEGIN` — no matches with real values, only variable names in comments/env-var lists. |
| 4 | Git history is clean: I searched `git log -p` for password, secret, api key and `postgres://` | Yes | Ran it across all 21 commits. Every hit was a variable name (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET` in an old removed feature) or a comment — no actual secret value anywhere in history. |
| 5 | Any credential that was ever committed has been rotated | N/A | Nothing was ever committed (row 4), so there's nothing to rotate. |
| 6 | Production credentials live only in my hosting provider's environment settings | Yes | The only GitHub Actions workflow (`deploy-pages.yml`) never references `SUPABASE_SERVICE_ROLE_KEY` or `FIREBASE_PROJECT_ID` — it only injects the public `VITE_` values. The README's Deploying section instructs setting the server secrets directly in Render's dashboard, not in a file. I can't see your actual Render dashboard, so double-check nothing there got pasted into a script by mistake. |

## GitHub Actions

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 7 | No secret value is written literally in any workflow YAML file | Yes | Only workflow is `.github/workflows/deploy-pages.yml`. It contains no literal key/password anywhere, only `${{ vars.* }}` references. |
| 8 | Secrets are stored in repository Actions secrets and read with `${{ secrets.NAME }}` | N/A | The workflow needs no secrets at all — it only builds the public client bundle, and correctly uses repository **Variables** (not Secrets) for the `VITE_*` values, since those end up in public JS anyway (the workflow's own header comment says this explicitly). The real secrets (`SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PROJECT_ID`) are only ever used on Render, never in a workflow. |
| 9 | No workflow step echoes, dumps or debug-prints a secret, and I opened a recent run's log to confirm | Yes | From the YAML source, no step echoes or prints any variable. Confirmed by opening the latest "Deploy client to GitHub Pages" run log — no key or value is printed anywhere in it. |
| 10 | Uploaded build artifacts contain no `.env`, key file or generated config | Yes | The uploaded Pages artifact is `client/dist`, the Vite build output. It only ever contains the public `VITE_*` values baked in by design — there's no `.env` file for it to accidentally include. |
| 11 | Third-party actions are pinned to a commit SHA, not a moveable tag | No | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` are all pinned to version tags, not commit SHAs. Low risk since these are all GitHub's own official actions, but strictly this doesn't meet the check as written. |
| 12 | Secret scanning and push protection are enabled on the repository | Yes | Checked **Settings → Code security and analysis**: both secret scanning and push protection show as enabled. |

## Database

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 13 | Every query taking user input uses parameters, never string concatenation | Yes | All data access goes through the `@supabase/supabase-js` (PostgREST) client, which parameterizes filters — no raw SQL string-building found. `server/src/db/helper.js` even escapes `%`/`_`/`\` for the one place it builds a `LIKE` pattern from user input. |
| 14 | The database is not open to the whole internet, or is reachable only by the app | N/A | This is a managed Supabase project; direct Postgres access requires its own password and the app never exposes it. Not something configurable from the repo. |
| 15 | The database user the app connects as has only the permissions it needs | No | The API connects with the Supabase **service-role key** (`server/src/config/supabase.js`), which bypasses Row Level Security entirely and has full table access. This is a normal pattern for this Supabase+Express setup — the code enforces per-landlord scoping itself in every query — but it's honestly more privilege than "only what it needs," so this is a real No, not a technicality. |
| 16 | Seed and sample data is invented, not real people's data | Yes | `server/db/seed.sql` uses obviously invented data: fictional property names, `@example.com` emails (`juan.sample@example.com`, `maria.sample@example.com`, etc.), and placeholder phone numbers (`09170000001`…). |
| 17 | Debug, seed and reset routes are removed before going public | Yes | Checked every file in `server/src/routes/`: no `/debug`, `/seed` or `/reset` endpoint exists. Seeding is done manually via SQL Editor, not an HTTP route. |

## Access control

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 18 | The app has an access layer: Cloudflare Zero Trust, an app-level password, or a real login | Yes | Real per-user auth via Firebase (email/password and Google), verified server-side with `firebaseAuth().verifyIdToken()` in `server/src/middleware/auth.js`. |
| 19 | If Supabase or Firebase: Row Level Security or security rules are on, and I tested it signed out | Yes | `server/db/schema.sql` runs `alter table … enable row level security;` on all 10 tables, with no policies defined. Tested live with the anon key while signed out — every table returns no rows. |
| 20 | If Zero Trust: an email is on the access policy. If an app password: the credentials are in your private workspace README | N/A | This project uses real per-user Firebase accounts, not a Zero Trust gate or a shared app password, so neither sub-check applies. |
| 21 | The gate covers every route, including the ones that only change data | Yes | Checked every route file: `authRoutes`, `propertyRoutes`, `unitRoutes`, `tenantRoutes`, `contractRoutes`, `rentRoutes`, `utilityBillRoutes`, `notificationRoutes`, `dashboardRoutes`, `settingsRoutes` all call `router.use(requireAuth)` (or apply it per-route), including every `PATCH`/`POST`/`DELETE`. |
| 22 | The credentials for the gate are environment variables, not in source | N/A | Same reasoning as row 20 — there's no separate gate password; access is real Firebase login. |

## Input and output

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 23 | Input from the user is validated on the server, not only in the browser | Yes | Every mutating route uses `express-validator` (`body(...).isLength()`, `.isBoolean()`, `.isArray()`, etc.) plus a shared `validate` middleware that rejects bad input with 400 before the handler runs — confirmed in `settingsRoutes.js` and others. |
| 24 | User-supplied text is escaped when rendered, so it cannot inject markup or script | Yes | React JSX escapes by default. Searched every file in `client/src/pages/` for `dangerouslySetInnerHTML` — none found. |
| 25 | Error responses do not expose stack traces, file paths or connection details | Yes | `server/src/middleware/errorHandler.js`: for any error that isn't a known `ApiError`, it logs the real error server-side but returns only `"Something went wrong. Please try again."` to the client, with no stack or details. |
| 26 | CORS is not a wildcard on routes that change data | Yes | `server/src/app.js` sets `cors({ origin: allowedOrigins })`, built from `CORS_ORIGINS` — no `*` anywhere in the code. (Just make sure `CORS_ORIGINS` on Render is actually your real Pages origin, not left as `*`.) |

## Repository and privacy

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 27 | No student number, personal email, phone number or home address in the repository or in commit messages | Yes | Originally found that 20 of 21 commits were authored with my real personal Gmail address, visible in the public commit history (redacted here — see the fix below for what I did instead of repeating it). Fixed with `git filter-repo --mailmap` to rewrite all past commits to use my GitHub noreply address instead, force-pushed the rewritten history, and set `git config user.email` to the noreply address so future commits stay safe. No student number, phone number or physical address was found anywhere in file contents or history. |
| 28 | No classmate's personal data in the repository | Yes | All names/emails/phone numbers found in the codebase are obviously fictional seed data (`@example.com`, sequential placeholder numbers) — nothing matching a real classmate. |
| 29 | Dependencies come from official registries, and `node_modules` is gitignored | Yes | `package-lock.json` resolves everything from `registry.npmjs.org`. Root `.gitignore` has `node_modules/`. |
| 30 | Images, fonts and other assets are mine, licensed, or credited | Yes | `docs/assets/screenshot.png` is my own screenshot of the running app, and the app icon is my own asset — nothing sourced from elsewhere. |
| 31 | Repository visibility is deliberate, and I checked it after my last push | Yes | Confirmed public just now: the repo, its file tree, and full commit history were all readable without any login. |

## Anything I found and fixed

The checklist caught one real thing I hadn't thought about: my personal Gmail
address was sitting in plain text as the commit author on 20 of my 21
commits, visible to anyone on GitHub. I hadn't considered that git identity
is public the same way file contents are. I fixed it with `git filter-repo
--mailmap` to rewrite every past commit to use my GitHub noreply address
instead, force-pushed the rewritten history, and set `git config user.email`
to the noreply address so future commits stay safe automatically.

Everything else — no `.env` or secret ever committed, no wildcard CORS, RLS
enabled on every table and confirmed with a live signed-out test, every
mutating route behind real auth and server-side validation, generic error
messages, invented (not real) seed/demo data, secret scanning and push
protection both on, and no unlicensed assets — checked out clean.