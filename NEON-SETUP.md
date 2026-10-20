# Neon + Vercel quick setup

This project uses Prisma/PostgreSQL. The browser talks only to `/api/v1`; `DATABASE_URL` is read by the server and must **never** be prefixed with `VITE_` or committed to Git.

## Existing Neon database prepared for this app

The selected Neon project is `Saas`, project ID `raspy-moon-42698330`, branch `production` (`br-small-river-aoxhpugq`), database `neondb`, region Singapore. The 13 app tables were empty at inspection time. I added the missing foreign-key constraints and the `lease_no_overlap` GiST exclusion constraint. Existing tables/indexes/check constraints were retained. Neon console: https://console.neon.tech/app/projects/raspy-moon-42698330/branches/br-small-river-aoxhpugq

There is a second project also named `Saas`; do not delete it based on its name alone.

## Deploy from ZIP to Vercel

1. Extract this ZIP; upload the project root to a new private GitHub repository.
2. Import the repository into Vercel. Keep Root Directory at `./` (repository root), Framework Preset `Vite`, Build Command `npm run build`, Output Directory `apps/web/dist`, Node.js `22.x`.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `DATABASE_URL` = Neon **pooled** connection string for the selected `neondb` database; include `?sslmode=require` (and preserve any existing query parameters). Use the connection-string copy button in Neon. Never paste this value into source files or public chat.
   - `NODE_ENV` = `production`
   - `APP_ORIGIN` = your exact Vercel deployment URL, e.g. `https://your-project.vercel.app`
   - `CORS_ORIGINS` = the same exact URL
   - `COOKIE_SECURE` = `true`
   - `TRUST_PROXY` = `1`
   - `ENABLE_REGISTRATION` = `true` for first account signup; after creating your account, set it to `false` and redeploy if you want to close public registration.
   - `SESSION_TTL_HOURS` = `168`
4. Deploy. Open `/api/v1/health` (expected `{"status":"ok"}`) and `/api/v1/ready` (expected `{"status":"ready"}`). Then register and test property → unit → tenant → lease → rent/payment flows. Test with two separate landlord accounts to confirm data isolation.

## Migration tracking / future schema changes

The existing database had no `_prisma_migrations` table. The current app can query the existing schema without that table, and the initial migration must **not** be blindly deployed to this already-created database. Before future schema changes, compare the database against `apps/api/prisma/schema.prisma` and baseline the initial migration from a trusted local shell using the same `DATABASE_URL`:

```bash
npx prisma migrate resolve --applied 20260101000000_init --schema apps/api/prisma/schema.prisma
```

Only run the baseline command after verifying the existing schema matches the initial migration. Do not run `prisma migrate deploy` against this existing DB before baselining; it would attempt to create tables that already exist. This command is for migration bookkeeping and does not create app tables.

## Important deployment limitation

This ZIP does not contain a database password or Vercel credentials. You must set the environment variables in Vercel yourself. I could inspect the project files and database schema, but dependency installation/build/tests could not be completed in this environment, so the first Vercel build and runtime checks remain required. The daily notification/rent job is not automatically scheduled by Vercel.
