# AI usage

This project was built with AI assistance. This file is the record of it. It is
graded as the finals badge, and it is worth 100 points.

Start it in week 1 and keep it up as you go. The commit history of this file is
part of the evidence: a file written all at once the night before the deadline
looks exactly like what it is.

## 1. How I used AI

### 2026-09-20 - Tenant move-in and contracts

- **Tool:** Claude
- **What I asked for:** Tenant creation that also creates the contract with advance and deposit payments and marks the unit occupied, plus contract endpoints and a move-out action.
- **What it gave back:** `tenantController.js`, `contractController.js`, and `utils/moveInFunds.js`, which builds the advance/deposit objects.
- **What I kept, what I changed, and why:** I stopped writing controllers by hand here because they were repeating the property and unit code I had already written, so I had the AI generate them and then read through them by hand. I kept the move-in flow, including the rollback: if the contract insert or unit update fails, the tenant row that was just created gets deleted, so I don't end up with a tenant who has no contract. I kept the "unit already occupied" check as a 409. Supabase has no multi-table transactions through its client, so this manual rollback is the workaround, and I know it is not fully atomic.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/314dcf4

### 2026-09-21 - Rent tracking and dashboard

- **Tool:** Claude
- **What I asked for:** Monthly rent records per tenant, a status for each record (paid, upcoming, pending, overdue), and dashboard numbers for the landlord.
- **What it gave back:** `rentController.js`, `services/rentGenerator.js` (the longest service file, about 190 lines), `services/rentStatus.js`, and `dashboardController.js`.
- **What I kept, what I changed, and why:** I kept the generator and the status logic. The status is computed from the due date compared to today rather than stored, so it never goes stale. The first version also had leftover receipt-verification code from a feature I decided not to build, so I removed it in a follow-up commit (`c8183ca`).
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/2fa23e7

### 2026-09-21 - Utility bills and calendar

- **Tool:** Claude
- **What I asked for:** Electricity, water and wifi bills per unit with a due day each, a bill checklist, and a calendar view.
- **What it gave back:** `utilityBillController.js`, `services/utilityBillGenerator.js`, and on the client `Calendar.jsx`, `BillChecklist.jsx`, `lib/calendarGrid.js` and `lib/billIcons.jsx`.
- **What I kept, what I changed, and why:** I kept all of it, since the bill amounts and due days are stored on the unit itself (the `utilities` field that `unitController.js` already handles). The calendar grid maths in `calendarGrid.js` is the part I trust least, because I only tested it by clicking through months.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/0a542a3

### 2026-09-21 - Notifications and scheduled jobs

- **Tool:** Claude
- **What I asked for:** In-app notifications, a bell in the UI, and scheduled jobs that remind the landlord about rent and expiring contracts.
- **What it gave back:** `notificationController.js`, `services/notifications.js`, `jobs/scheduler.js` and `jobs/contractReminders.js` (using `node-cron`), and `NotificationBell.jsx`.
- **What I kept, what I changed, and why:** I kept it, with one adjustment forced by deployment: `node-cron` needs a process that keeps running, and Vercel does not run one. So the scheduler starts from `server.js` for local use, and `api/index.js` deliberately does not start it.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/e445415

### 2026-09-21 - Settings page and tests

- **Tool:** Claude
- **What I asked for:** A settings page (notification preferences) and some way to test the backend.
- **What it gave back:** `settingsRoutes.js`, `Settings.jsx`, and two scripts: `scripts/wiringCheck.js`, which imports the whole app and checks that everything loads, and `scripts/smokeTest.js`.
- **What I kept, what I changed, and why:** I kept both scripts. I understand that they are shallow: the wiring check proves the app assembles without import errors, not that the endpoints return correct data. Two days later I did a cleanup commit (`799609a`) to remove a Gmail placeholder and unused code that had come along with this work.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/0ed031b

### 2026-09-27 - Client side of the Firebase to Supabase auth switch

- **Tool:** Claude
- **What I asked for:** Help moving the login pages from Firebase to Supabase authentication. My professor told me Supabase already has authentication built in, so running Firebase next to Supabase was unnecessary. I changed the server side myself (see section 3).
- **What it gave back:** The client-side changes: `lib/supabase.js`, `AuthCallback.jsx`, and updates to `AuthContext.jsx` and the Google sign-in button.
- **What I kept, what I changed, and why:** I kept the client changes and checked that the token the client sends is the one my `requireAuth` middleware now verifies with `supabase.auth.getUser`. I removed the Firebase config and dependency so the project has one auth provider instead of two.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/464add0

### 2026-09-27 - Security checklist and documentation screenshots

- **Tool:** Claude
- **What I asked for:** A security checklist for the project, and a script to take screenshots of the pages for the docs.
- **What it gave back:** `checklist.md` and `client/scripts/screenshot-pages.mjs`.
- **What I kept, what I changed, and why:** I kept the screenshot script as is. For the checklist, I checked the items against the code I could point to: `helmet`, `hpp`, `express-rate-limit` and `express-validator` are all in `package.json`, and every query filters by `landlord_id`.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/f0c477c (also `803f0f3`)

## 2. Where the AI got it wrong

### Case 1 - Features I never built left dead code behind

- **What it gave me:** Along with the rent and settings work, it added code for features that are not part of my app: receipt verification for rent payments, and a Gmail integration placeholder.
- **What was wrong with it:** None of it was used, and it made the code confusing to read. I only noticed when I went back through the generated code by hand. Some of it is still there: `rentGenerator.js` still writes `verification_status: 'approved'` on advance payments, which is a leftover from the receipt-verification idea.
- **What I did instead:** I removed the receipt verification leftovers in `c8183ca` and the Gmail placeholder and other unused code in `799609a`. I should still clean up the remaining `verification_status` fields.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/c8183ca and https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/799609a

### Case 2 - The backend had no permission to use the database

- **What it gave me:** The schema and Supabase setup, which worked as SQL but did not include any permissions for the backend's `service_role` key.
- **What was wrong with it:** Requests from the backend were refused because `service_role` had no access to the `public` schema. Creating tables was not enough.
- **What I did instead:** I granted `service_role` access to the `public` schema in Supabase and committed the fix. I now know that a working schema and a backend that can use it are two separate things.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/adec356

### Case 3 - The Vercel deployment failed twice

- **What it gave me:** The Vercel setup: `vercel.json` with a rewrite to `/api`, and `api/index.js`, which exports the Express app. The project is written with ES modules (`"type": "module"`).
- **What was wrong with it:** The first deploy did not work, and my first fix did not fully fix it. The two fix commits are seven minutes apart, and the second one was about overriding the module type, so the problem was how the serverless runtime loaded my ES module code.
- **What I did instead:** I fixed the Vercel configuration first (`bece1dd`), then applied the module type override (`f61b629`) to get it running.
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/bece1dd and https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/f61b629

## 3. Who wrote what

### Written by me: auth

- **File:** `server/src/middleware/auth.js`, `server/src/services/landlords.js`, `server/src/controllers/authController.js`, `server/src/routes/authRoutes.js`
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/e1d8050 (first version), https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/f512204 (my schema fix) and https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/464add0 (switch to Supabase auth)
- **What it does and why it is built this way:** `requireAuth` runs before any protected route. It reads the `Bearer` token from the `Authorization` header, and if there is none it stops with a 401. Then it asks Supabase who the token belongs to with `supabase.auth.getUser(token)`. If Supabase says the token is invalid or expired, that is also a 401. Once the user is known, it calls `getOrCreateLandlord`, which looks for a row in my `landlords` table with the same id as the Supabase user. If there is none, it creates one from the user's email and name, so a landlord is created the first time they log in. If two requests arrive at the same moment and both try to insert, the database rejects the second one (error code `23505`), and the code then reads the row that the first request created instead of failing. Finally, `requireAuth` puts `req.landlordId` on the request, and every controller uses it to filter queries. My `f512204` fix made the landlord query select only columns that exist in the schema. I moved from Firebase to Supabase auth (`464add0`) because my professor pointed out Supabase already has authentication, so I no longer needed two providers. `GET /api/auth/user` just returns the current landlord and whether they are new.

### Written by me: properties and units

- **File:** `server/src/controllers/propertyController.js`, `server/src/routes/propertyRoutes.js`, `server/src/controllers/unitController.js`, `server/src/routes/unitRoutes.js`
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/a8ed429
- **What it does and why it is built this way:** Every query is filtered by `landlord_id = req.landlordId`, so a landlord can only ever read or change their own rows. `create` reads the fields from the request, trims them with `text()`, inserts the row and returns 201. `update` builds a `patch` object with only the fields that were actually sent, so a PATCH never wipes out fields the client left out. Deleting is really archiving: `archive` sets `archived: true` instead of deleting the row, and it refuses with a 409 if the property still has occupied units, so I can't lose a tenant's history by accident. It then archives that property's units too. In `list`, I load all the units once and count units and occupied units per property with a `Map`, instead of running one query per property. In `unitController.js`, `normalizeUtilities` cleans the electricity, water and wifi amounts and due days (amount never below 0, due day clamped to 1-31), and `update` refuses to mark a unit `occupied` unless it has a tenant assigned. The routes use `express-validator` to reject bad input before the controller runs.

### Written by me: server setup, middleware and utilities

- **File:** `server/src/app.js`, `server/server.js`, `server/src/middleware/validate.js`, `server/src/middleware/rateLimit.js`, `server/src/middleware/errorHandler.js`, `server/src/utils/ApiError.js`, `server/src/utils/asyncHandler.js`
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/b15192b
- **What it does and why it is built this way:** `createApp()` builds the Express app in one function, so the same app can be started by `server.js` locally and imported by `api/index.js` on Vercel. It uses `helmet` for security headers, `cors` limited to the origins in my `CORS_ORIGINS` setting, `hpp` against duplicate query parameters, and a JSON body limit of 1 MB. `apiLimiter` allows 600 requests per 15 minutes. `/healthz` says the server is up, and `/readyz` also checks that the database answers. `ApiError` is an error with a status code and a message that is safe to show. `asyncHandler` wraps an async controller so that any error goes to `next()` instead of crashing the request. `errorHandler` sends `ApiError`s back with their own message and turns anything unexpected into a generic 500, so internal details never reach the user. `validate` collects the `express-validator` results into one 400 response with a list of field messages.

### The AI-written part I understand best

- **File:** `server/src/services/rentGenerator.js`
- **Commit:** https://github.com/Kian-James/Landlord-Rent-Tracking-App/commit/2fa23e7
- **What it does and why we kept it:** `generateRentRecordsForMonth` creates one rent record per active tenant for a month. The due date comes from the tenant's due day, capped to the last day of the month, so a due day of 31 works in February. It fetches tenants and active contracts in pages, and checks each tenant's contract to see whether that month is already covered by advance rent. If it is, the record starts as `paid` and a matching payment is created; otherwise it starts as `upcoming`. The insert uses an upsert on `tenant_id, period` with `ignoreDuplicates`, so running the job twice in one month never creates duplicate records. Rows are inserted in batches of 500 so a large number of tenants doesn't hit database limits. `refreshRentStatuses` recomputes each unpaid record's status from its due date, updates them in batches, and sends a notification when a record becomes due soon, due today or overdue, with a dedupe key so the same alert isn't created twice. I kept it because the duplicate protection and the advance-rent handling are things I would have had to get right myself, and I checked them against how my contracts store advance payments.