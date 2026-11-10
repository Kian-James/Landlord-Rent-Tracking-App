# Performance notes

## Why "load balancing" isn't the fix here
On Vercel, every request already runs on its own serverless instance and traffic is spread automatically, so there's
no load balancer to add. The slowness came from how much each page load asks the server and database to do.
What changed instead:

### Server
* **Sign-in check (every request):** was 2 network round trips (ask Supabase Auth, then read the landlord row).
  Now the token is verified locally (`getClaims`, Supabase's public keys are fetched once and cached; projects on the
  old shared-secret JWTs automatically fall back to asking Supabase), a verified token is remembered for 30 s, and the
  landlord row is remembered for 15 s (and refreshed immediately when the profile is saved).
  Trade-off: a signed-out or removed user's token can keep working for up to 30 s (never past its own expiry).
* **Rent status refresh (every Dashboard / Bills / Notifications load):** used to read every unpaid rent record
  the landlord ever had and re-send notifications for all overdue ones each time. Now it reads only records that can
  actually change (unpaid, not already overdue, due within 4 days), shares one run between simultaneous requests, and
  sends the daily overdue reminders at most every 10 minutes per instance. Results are identical.
  Utility bills got the same narrowing.
* **Contract PDF engine** (pdf.js, pdf-lib, fonts) now loads only when a contract is used. It had added ~700 ms to the
  startup of every endpoint.
* Rent record generation fetches tenants and contracts in parallel.

### Client
* One 313 KB (gzipped) JavaScript file became per-screen files: ~165 KB loads on first visit (was 313 KB), and the
  chart library (~100 KB) now loads after the Dashboard cards are already on screen.
* Other screens are downloaded quietly in the background once the app is idle, so moving around feels instant.
* The Google Fonts stylesheet no longer blocks first paint; the browser connects to Supabase early.
* The notification bell stops polling while the tab is in the background.

## Things worth doing on your hosting (no code)
* **Put the API in the same region as your Supabase project.** Each page makes several database calls; a far-away
  region adds the distance to every one of them. In `vercel.json` add `"regions": ["sin1"]` (Singapore) if your
  Supabase project is in Southeast Asia, otherwise use the nearest region to it.
* Make sure the Supabase project uses the **new JWT signing keys** (Settings > JWT Keys) to get the local sign-in check.
  Without them everything still works; it just keeps asking Supabase.
* The Supabase free tier pauses idle projects and is slower on its first call afterwards.

## Not changed on purpose
* The Bills page shows totals across the landlord's whole history, so it still loads every record. Limiting that
  (e.g. last 12 months plus anything unpaid) would change the totals it shows, so it's a decision for you.
* Rent/utility record generation still runs when the Bills page opens: on Vercel nothing else creates records for a
  tenant who was just added, so skipping it could hide a new tenant's bill.
