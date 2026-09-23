# PropTrack - Landlord Rent Tracker

A web app for small landlords to track properties, tenants, monthly rent and utility bills in one place, and see at a glance who has paid and who is overdue.

**Live site:** https://yourusername.github.io/Landlord-Rent-Tracking-App/
**API:** https://your-api.onrender.com/healthz
**Demo video:** (link)

![A screenshot of the dashboard](docs/assets/screenshot.png)

## What it does

- Sign up and log in with email and password or Google
- Add properties and units, with a monthly rent and optional utility amounts and due days
- Move a tenant in with a lease, advance rent and security deposit; move them out again without losing history
- Generate each month's rent automatically and mark it paid
- See a dashboard of what is paid, pending and overdue, with contracts that are about to expire
- Track electricity, water and wifi bills per unit, with a calendar of everything due
- Get in-app notifications for overdue rent, overdue bills and expiring contracts

## Built with

React, Vite and Tailwind CSS on the front end. Express on the back end. Supabase (PostgreSQL) for data and Firebase Authentication for login. The client is on GitHub Pages, the API on (host), the database on Supabase.

## Demo mode

This project does not ship a simulated backend. Every screen sits behind a login and reads real data, so the client always calls the API at `VITE_API_BASE_URL`. If the API is asleep on a free tier, the first request can take about a minute.

## Running it yourself

You need a Supabase project and a Firebase project. Both have free tiers.

**1. The database.** In Supabase, open **SQL Editor**, paste `server/db/schema.sql` and run it. Copy the project URL and the **service_role** key from **Project Settings > API**.

**2. Login.** In Firebase, open **Authentication > Sign-in method** and enable **Email/Password** and **Google**. Copy the Project ID, and register a web app to get the four client values.

**3. The API.**

    cd server
    npm install
    cp .env.example .env        # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_PROJECT_ID
    npm run dev                 # http://localhost:3000

**4. The client, in another terminal.**

    cd client
    npm install
    cp .env.example .env        # fill in the four VITE_FIREBASE_ values
    npm run dev                 # http://localhost:5173

Check the API on its own before you blame the client:

    curl http://localhost:3000/healthz     # is the process alive
    curl http://localhost:3000/readyz      # is the database reachable

**Demo data.** Log in once, copy your User UID from **Firebase > Authentication > Users**, paste it at the top of `server/db/seed.sql` and run it in the SQL Editor. It adds two invented properties, six units, four tenants and a few months of rent. Running it again replaces only its own rows.

**Tests.**

    cd server
    npm run wiring-check     # every module imports and the app assembles
    npm run smoke-test       # end-to-end run against the Supabase project in .env

The smoke test writes and then deletes its own rows, so point it at a development project.

## Environment variables

None of these are committed. `.env.example` in each folder lists them with placeholder values.

| Name | Where | What it is |
| --- | --- | --- |
| `SUPABASE_URL` | server | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server | bypasses Row Level Security. Server only, never in the client |
| `FIREBASE_PROJECT_ID` | server | used to verify login tokens |
| `CORS_ORIGINS` | server | comma-separated origins allowed to call the API |
| `NODE_ENV` | server | `production` on your host |
| `PORT` | server | **set by the host**, do not set it yourself |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | client, at build time | public Firebase web app identifiers |
| `VITE_API_BASE_URL` | client, at build time | your API's public URL, no trailing slash |

Every `VITE_` value is compiled into the built JavaScript and is **public**.

## Deploying

**Client, to GitHub Pages.** Already wired up in `.github/workflows/deploy-pages.yml`.

1. **Settings > Pages > Build and deployment > Source: GitHub Actions.**
2. **Settings > Secrets and variables > Actions > Variables:** add `VITE_API_BASE_URL` and the four `VITE_FIREBASE_` values.
3. Push to `main`. The repository must be **public** for Pages on a free account.
4. **Firebase > Authentication > Settings > Authorized domains:** add `yourusername.github.io`, or Google login is blocked on the live site.

**API.** Any Node host works. On Render: New Web Service, root directory `server`, build command `npm install`, start command `npm start`, health check path `/healthz`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PROJECT_ID`, `NODE_ENV=production` and `CORS_ORIGINS=https://yourusername.github.io` in its dashboard. An origin has no path and no trailing slash.

**Database.** Run `server/db/schema.sql` once in the Supabase SQL Editor. The seed file is for demos only.

## Project structure

    client/          React front end, built by Vite
      src/api/       one axios client that attaches the Firebase token
      src/context/   login state
      src/pages/     Dashboard, Properties, Tenants, Bills, Calendar, Settings
      src/components/
    server/          Express API
      db/            schema.sql and seed.sql
      src/routes/, controllers/, services/, jobs/, middleware/
      scripts/       wiring check and smoke test
    docs/            planning documents and weekly reports

## Architecture

The browser signs in with Firebase and sends the resulting token with every request. The API verifies the token, creates the landlord's record on first sight, and scopes every query to that landlord. Only the API talks to Supabase, using the service-role key, so the browser never holds database credentials. Row Level Security is switched on for every table with no policies, so the public Supabase key can read nothing. Receipts are not part of this version; rent is marked paid by the landlord.

    Browser (GitHub Pages) --token--> Express API --service role--> Supabase PostgreSQL
            |
            +--login--> Firebase Authentication

## What I would do next

- Add screens for what the API already supports: renewing a contract, undoing a paid bill, and dismissing notifications
- Let tenants send proof of payment, which needs a verification step and file storage that this version leaves out
- Run the daily rent and reminder jobs on an always-on host or a scheduler, because on a sleeping free tier they only run while the API is awake

## Author

Your name, and a link. Course and section.

## Licence

MIT, see [LICENSE](LICENSE). Put your own name in it.
