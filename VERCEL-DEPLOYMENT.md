# Vercel + Neon deployment

## Included configuration
- Vercel serverless adapter: `api/[...path].ts`
- React/Vite production build: `apps/web/dist`
- `/api/*` requests are kept out of the SPA fallback rewrite.
- Prisma Client is generated as part of the API build.

## Vercel project settings
- Root Directory: repository root (leave blank/default).
- Framework: Vite
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `apps/web/dist`
- Node.js: 22.x
- Function region: `sin1` (Singapore), close to the configured Neon database region.

## Required environment variables
Use `.env.vercel.example` as a checklist. Set `DATABASE_URL` to the pooled connection string from the intended Neon project. Set `APP_ORIGIN` and `CORS_ORIGINS` to the exact deployed URL. Set `COOKIE_SECURE=true`, `TRUST_PROXY=1`, and `NODE_ENV=production`. Keep the database URL server-only; never prefix it with `VITE_`.

## Database note
The selected Neon project is `Saas` (project `raspy-moon-42698330`), database `neondb`, production branch in Singapore. It has the 13 application tables expected by this app. Missing foreign keys and the active-lease overlap exclusion constraint have been added. The `_prisma_migrations` table is still absent. **Do not run `prisma migrate deploy` against this existing database until you have baselined the initial migration.** Follow [NEON-SETUP.md](NEON-SETUP.md).

## Post-deploy checks
1. Open `/api/v1/health` and expect `{"status":"ok"}`.
2. Open `/api/v1/ready` and expect `{"status":"ready"}`.
3. Test sign-up/login, cookies, and CRUD operations. Test data isolation with two different landlord accounts.
4. If registration should be closed after initial setup, set `ENABLE_REGISTRATION=false`.
5. The daily rent/notification job is not automatically scheduled by Vercel; configure a protected Cron Function or run the job from a separate scheduler.

## Important limits
The archive contains source/configuration, not your database password. The project must be imported or deployed from Vercel with environment variables set. Build/test results must be checked in the target deployment environment.
