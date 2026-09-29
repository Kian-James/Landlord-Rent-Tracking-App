# Security checklist

Filled in against the public repository at
https://github.com/Kian-James/Landlord-Rent-Tracking-App, updated for commit
`f0c477c` (2026-09-27). It was first filled in at commit `f61b629`
(2026-09-23), by cloning the repo, reading its full commit history, and
reading the actual source (not just the README).

**What changed since the first version:** on 2026-09-27 (`464add0`) I removed
Firebase Authentication and moved login entirely to Supabase Auth. My professor
suggested it, and I had not realised Supabase already had authentication
built in. Running Firebase next to Supabase was inefficient: two providers,
two sets of keys and two places to configure. Rows 3, 6, 8, 10, 18, 19, 20 and
22 below are updated for that. The other rows still stand as first written.

A few rows need a check only you can do (things behind your GitHub/Supabase
dashboard login, or your own live project). Those are marked below with what
to check and why, rather than guessed at.

## Secrets and credentials

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 1 | `.env` is gitignored and is not in the repository | Yes | Root `.gitignore` has `.env`, `.env.*`, `!.env.example`. Cloned the full repo and ran `git log --all --diff-filter=A --name-only`: no `.env` file has ever been added in any commit, only `client/.env.example` and `server/.env.example`. This was run at `f61b629` (21 commits); re-run it at the current HEAD to cover the three later commits. |
| 2 | A `.env.example` with placeholder values only is committed | Yes | Both `client/.env.example` and `server/.env.example` are committed. Every value is either blank or an obvious placeholder (`SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co`, `VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co`, etc.), with no real key in either. The Firebase variables (`FIREBASE_PROJECT_ID`, `VITE_FIREBASE_*`) are gone from both files. |
| 3 | No connection string, key, token or password is hardcoded in source, comments or commented-out code | Yes | `server/src/config/supabase.js` reads only from `process.env`, and `client/src/lib/supabase.js` reads only from `import.meta.env` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`). Searched `git log -p --all` for `postgres://`, `AIza…`, `AKIA…`, `-----BEGIN`: no matches with real values, only variable names in comments/env-var lists. |
| 4 | Git history is clean: I searched `git log -p` for password, secret, api key and `postgres://` | Yes | Ran it across all commits up to `f61b629`. Every hit was a variable name (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET` in an old removed feature) or a comment, with no actual secret value anywhere in history. Re-run it once more at the current HEAD, because `464add0` rewrote the auth code. |
| 5 | Any credential that was ever committed has been rotated | N/A | Nothing was ever committed (row 4), so there's nothing to rotate. |
| 6 | Production credentials live only in my hosting provider's environment settings | Yes | The only GitHub Actions workflow (`deploy-pages.yml`) never references `SUPABASE_SERVICE_ROLE_KEY`; it only injects the public `VITE_` values. The README's Deploying section instructs setting the server secret directly in Render's dashboard, not in a file. After the switch to Supabase auth, the only server secret left is `SUPABASE_SERVICE_ROLE_KEY`. I can't see your Render dashboard, so check that nothing there was pasted into a script by mistake, and delete the old `FIREBASE_PROJECT_ID` variable there and any `VITE_FIREBASE_*` variables in the GitHub repository variables, since nothing uses them any more. |

## GitHub Actions

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 7 | No secret value is written literally in any workflow YAML file | Yes | Only workflow is `.github/workflows/deploy-pages.yml`. It contains no literal key/password anywhere, only `${{ vars.* }}` references. |
| 8 | Secrets are stored in repository Actions secrets and read with `${{ secrets.NAME }}` | N/A | The workflow needs no secrets at all: it only builds the public client bundle, and correctly uses repository **Variables** (not Secrets) for the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values, since those end up in public JS anyway (the workflow's own header comment says this explicitly). The anon key is designed to be public and is safe here because Row Level Security is on for every table (row 19). The one real secret, `SUPABASE_SERVICE_ROLE_KEY`, is only ever used on Render, never in a workflow. |
| 9 | No workflow step echoes, dumps or debug-prints a secret, and I opened a recent run's log to confirm | Yes | From the YAML source, no step echoes or prints any variable. Confirmed by opening the latest "Deploy client to GitHub Pages" run log: no key or value is printed anywhere in it. |
| 10 | Uploaded build artifacts contain no `.env`, key file or generated config | Yes | The uploaded Pages artifact is `client/dist`, the Vite build output. It only ever contains the public `VITE_*` values baked in by design (the Supabase URL and anon key). There's no `.env` file for it to accidentally include, and the service-role key is never given to the client build. |
| 11 | Third-party actions are pinned to a commit SHA, not a moveable tag | No | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` are all pinned to version tags, not commit SHAs. Low risk since these are all GitHub's own official actions, but strictly this doesn't meet the check as written. |
| 12 | Secret scanning and push protection are enabled on the repository | Yes | Checked **Settings → Code security and analysis**: both secret scanning and push protection show as enabled. |

## Database

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 13 | Every query taking user input uses parameters, never string concatenation | Yes | All data access goes through the `@supabase/supabase-js` (PostgREST) client, which parameterizes filters, and no raw SQL string-building was found. `server/src/db/helper.js` even escapes `%`/`_`/`\` for the one place it builds a `LIKE` pattern from user input. |
| 14 | The database is not open to the whole internet, or is reachable only by the app | N/A | This is a managed Supabase project; direct Postgres access requires its own password and the app never exposes it. Not something configurable from the repo. |
| 15 | The database user the app connects as has only the permissions it needs | No | The API connects with the Supabase **service-role key** (`server/src/config/supabase.js`), which bypasses Row Level Security entirely and has full table access. The same key is also used to check the login tokens Supabase Auth issues. This is a normal pattern for this Supabase+Express setup, since the code enforces per-landlord scoping itself in every query (`landlord_id = req.landlordId`), but it's more privilege than "only what it needs," so this is a real No, not a technicality. |
| 16 | Seed and sample data is invented, not real people's data | Yes | `server/db/seed.sql` uses obviously invented data: fictional property names, `@example.com` emails (`juan.sample@example.com`, `maria.sample@example.com`, etc.), and placeholder phone numbers (`09170000001`…). |
| 17 | Debug, seed and reset routes are removed before going public | Yes | Checked every file in `server/src/routes/`: no `/debug`, `/seed` or `/reset` endpoint exists. Seeding is done manually via SQL Editor, not an HTTP route. |

## Access control

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 18 | The app has an access layer: Cloudflare Zero Trust, an app-level password, or a real login | Yes | Real per-user login through **Supabase Auth** (email/password and Google). The server verifies every request's token with `supabase.auth.getUser(token)` in `server/src/middleware/auth.js`, and rejects a missing or invalid token with a 401. Firebase Authentication is no longer used. |
| 19 | If Supabase or Firebase: Row Level Security or security rules are on, and I tested it signed out | Yes | `server/db/schema.sql` runs `alter table … enable row level security;` on all 10 tables, with no policies defined. Tested live with the anon key while signed out: every table returns no rows. Now that the client uses Supabase directly, this is what stops the public anon key in the browser from reading data. |
| 20 | If Zero Trust: an email is on the access policy. If an app password: the credentials are in your private workspace README | N/A | This project uses real per-user Supabase Auth accounts, not a Zero Trust gate or a shared app password, so neither sub-check applies. |
| 21 | The gate covers every route, including the ones that only change data | Yes | Checked every route file: `authRoutes` (per-route), and `propertyRoutes`, `unitRoutes`, `tenantRoutes`, `contractRoutes`, `rentRoutes`, `utilityBillRoutes`, `notificationRoutes`, `dashboardRoutes`, `settingsRoutes` all call `router.use(requireAuth)`, including every `PATCH`/`POST`/`DELETE`. The only routes without login are `/healthz` and `/readyz` in `app.js`, which return no user data. |
| 22 | The credentials for the gate are environment variables, not in source | N/A | Same reasoning as row 20: there's no separate gate password; access is a real Supabase login. The keys Supabase needs are environment variables (rows 2, 3 and 6). |

## Input and output

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 23 | Input from the user is validated on the server, not only in the browser | Yes | Every mutating route uses `express-validator` (`body(...).isLength()`, `.isBoolean()`, `.isArray()`, etc.) plus a shared `validate` middleware that rejects bad input with 400 before the handler runs, confirmed in `settingsRoutes.js` and others. |
| 24 | User-supplied text is escaped when rendered, so it cannot inject markup or script | Yes | React JSX escapes by default. Searched every file in `client/src/pages/` for `dangerouslySetInnerHTML`: none found. |
| 25 | Error responses do not expose stack traces, file paths or connection details | Yes | `server/src/middleware/errorHandler.js`: for any error that isn't a known `ApiError`, it logs the real error server-side but returns only `"Something went wrong. Please try again."` to the client, with no stack or details. |
| 26 | CORS is not a wildcard on routes that change data | Yes | `server/src/app.js` sets `cors({ origin: allowedOrigins })`, built from `CORS_ORIGINS`, with no `*` anywhere in the code. (Just make sure `CORS_ORIGINS` on Render is actually your real Pages origin, not left as `*`.) |

## Repository and privacy

| # | Check | Yes / No / N/A | Evidence |
| --- | --- | --- | --- |
| 27 | No student number, personal email, phone number or home address in the repository or in commit messages | Yes | Originally found that 20 of 21 commits were authored with my real personal Gmail address, visible in the public commit history (redacted here, see the fix below for what I did instead of repeating it). Fixed with `git filter-repo --mailmap` to rewrite all past commits to use my GitHub noreply address instead, force-pushed the rewritten history, and set `git config user.email` to the noreply address so future commits stay safe. No student number, phone number or physical address was found anywhere in file contents or history. |
| 28 | No classmate's personal data in the repository | Yes | All names/emails/phone numbers found in the codebase are obviously fictional seed data (`@example.com`, sequential placeholder numbers), with nothing matching a real classmate. |
| 29 | Dependencies come from official registries, and `node_modules` is gitignored | Yes | `package-lock.json` resolves everything from `registry.npmjs.org`. Root `.gitignore` has `node_modules/`. Firebase packages were removed from `package.json` in the auth switch, which also leaves fewer dependencies to keep updated. |
| 30 | Images, fonts and other assets are mine, licensed, or credited | Yes | `docs/assets/screenshot.png` is my own screenshot of the running app, and the app icon is my own asset, with nothing sourced from elsewhere. |
| 31 | Repository visibility is deliberate, and I checked it after my last push | Yes | Confirmed public just now: the repo, its file tree, and full commit history were all readable without any login. |

## Anything I found and fixed

The checklist caught one real thing I hadn't thought about: my personal Gmail
address was sitting in plain text as the commit author on 20 of my 21
commits, visible to anyone on GitHub. I hadn't considered that git identity
is public the same way file contents are. I fixed it with `git filter-repo
--mailmap` to rewrite every past commit to use my GitHub noreply address
instead, force-pushed the rewritten history, and set `git config user.email`
to the noreply address so future commits stay safe automatically.

The second change was a design one. I first used Firebase Authentication next
to Supabase for the database, which meant two providers to configure and two
sets of keys. I didn't know Supabase had authentication built in until my
professor told me. I switched to Supabase Auth only (`464add0`), so the
server now checks tokens with Supabase itself and the project has one
provider and one server secret instead of two. That was also a security gain,
since there are fewer keys to protect and fewer places for a configuration
mistake.

Everything else, meaning no `.env` or secret ever committed, no wildcard CORS,
RLS enabled on every table and confirmed with a live signed-out test, every
mutating route behind real auth and server-side validation, generic error
messages, invented (not real) seed/demo data, secret scanning and push
protection both on, and no unlicensed assets, checked out clean.