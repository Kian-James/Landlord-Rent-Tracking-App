# PropTrack API

Express API. **Supabase (Postgres + Storage) holds the data. Firebase Auth handles login.**

```
Browser ──Firebase login──▶ Firebase Auth
   │  (ID token)
   └──Authorization: Bearer <token>──▶ this API ──service-role key──▶ Supabase
```

The browser never talks to Supabase directly. The API verifies each Firebase ID
token, creates a `landlords` row the first time it sees a new Firebase user
(the row id *is* the Firebase UID), and scopes every query to that landlord.

## Setup

1. **Supabase** – create a project, then SQL Editor → paste `supabase/schema.sql` → Run.
   Copy the project URL and the **service_role** key (Project Settings → API).
2. **Firebase** – Authentication → Sign-in method → enable **Email/Password** and **Google**.
   Copy the **Project ID**.
3. `cp .env.example .env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PROJECT_ID`.
4. `npm install && npm run dev`

The service-role key bypasses Row Level Security. Keep it server-side only.
RLS is enabled on every table with no policies, so the public anon key can't read or write anything.

## Scripts

- `npm run wiring-check` – confirms every module imports and the app assembles (no network).
- `npm run smoke-test` – end-to-end run against the Supabase project in `.env`. It writes and then deletes
  test rows/files, so point it at a dev project. Firebase token verification is stubbed.

## Notes

- Existing MongoDB data is not migrated by anything here. Old accounts have no Firebase user, so
  people sign up again (or you import users into Firebase and move rows over yourself).
- Google sign-in no longer connects Gmail automatically (Firebase doesn't return a refresh token).
  The optional Gmail integration under Settings is still the same placeholder it was before.
