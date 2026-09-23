# Security and privacy checklist

Work through this **before your first push**, and again before you submit. Boxes are ticked only where the code or repository was checked; the rest are yours to confirm.

## Before the first push

- [ ] `.gitignore` includes `.env`, and `git check-ignore -v .env` confirms it. The root `.gitignore` lists `.env` and `.env.*`; run the command to confirm on your machine
- [ ] `git ls-files | grep -iE '\.env$|\.pem$|id_rsa'` prints nothing
- [x] `.env.example` is committed in `client/` and `server/`, with placeholder values only
- [x] A scan of the repository for keys, tokens, private keys and connection strings found nothing
- [ ] No `student.json`, and no name, student number or email of yours or anyone else's

Deleting a file later does **not** remove it from the history. If you commit a credential, **rotate it first**, at the service, and clean up the history second. The Supabase service-role key is the one that matters most here: it bypasses every access rule.

## The application

- [x] Every SQL query is parameterised. The API uses the Supabase client, which sends values separately from the query, and builds no SQL from user input. The only raw SQL is `schema.sql` and `seed.sql`, which are static
- [ ] Input is validated **on the server**, not only in React. Routes use `express-validator`, but text length limits are enforced by database constraints, so an over-long value returns a 500 instead of a friendly 400. Add length validators to close this
- [x] `cors({ origin: allowedOrigins })` names the origins from `CORS_ORIGINS`
- [ ] `NODE_ENV=production` on the host. Responses never contain a stack trace, because the error handler sends a generic message, but set the variable anyway
- [x] `helmet` is installed and used
- [x] Every `/api` route has a rate limit (600 requests per 15 minutes per address). The health checks are left out on purpose so a host's probes are never blocked. Logins are handled by Firebase, which has its own limits
- [x] No passwords are stored or logged by this project. Firebase Authentication holds them, hashed
- [x] Every route that touches somebody's data has the ownership check **in the query**, as `.eq('landlord_id', ...)`, and another landlord's id returns a 404
- [ ] `npm audit` run once. At the time of writing it reports 0 vulnerabilities for the production dependencies of both `client/` and `server/`; run it again before you submit

Row Level Security is switched on for every table with no policies, so the public Supabase key can read and write nothing. Only the API, using the service-role key, reaches the data.

## Privacy

The half that matters more, because it is about other people.

- [ ] **No real classmates' names, numbers, emails or photos**, anywhere. Not in seed data, not in screenshots, not in the demo video
- [x] The seed data in `server/db/seed.sql` is invented: sample names, `example.com` emails and `0917000000x` phone numbers
- [ ] If real people tested your app, even three friends, their data is deleted before you submit
- [ ] If your app collects anything about anyone, the app says what it collects. It stores tenant names, emails and phone numbers, so add a short note to the app or the README
- [ ] Any face in a screenshot is stock, generated, or yours

If your project handles personal information about real people, you are inside the Philippine Data Privacy Act. Collect the minimum, say what you collect, and do not collect anything you cannot justify. Tenant email and phone are optional fields in this app for that reason.

## What to write in your journal

One short paragraph: the riskiest thing about your project from this list, what you did about it, and what you knowingly accepted. A student who can name the tradeoff they made scores better than one who claims there was none.
