# Property Manager — self-hostable residential property & tenant management

Manage properties, units, tenants, leases, monthly rent, payments, expenses, maintenance and financial reports from one web app. You host it yourself (Docker or a plain Linux server); no third-party BaaS is required.

> **Validation status:** project source is prepared, but full dependency installation, build, and tests have not completed in this environment. Run the checks after importing it into your deployment environment. For the existing Neon database and Vercel setup, follow [NEON-SETUP.md](NEON-SETUP.md).

## Features
- Registration, login/logout, server-side sessions, password reset by email (optional SMTP), profile, roles (`LANDLORD`, `ADMIN`)
- Dashboard from live database queries (counts, rent due, collected, outstanding, recent payments, expiring leases, maintenance)
- Properties (archive/restore), units, tenants (active/former), leases (renew, terminate, overlap-proof)
- Monthly rent obligations (idempotent), full/partial payments, reversals, receipts (print), overdue logic
- Expenses and maintenance requests with costs and status
- Reports: summary, monthly, by property, collections, outstanding, expenses — CSV export and print view
- In-app notifications (rent due, overdue, lease expiring, maintenance changes) and per-user audit log
- Strict per-landlord data isolation, CSRF protection, rate limiting, Argon2id passwords

Not included (by design): online payment processing, email reminders (only password-reset email), maintenance image uploads.

## Stack
React 18 · TypeScript (strict) · Vite · Tailwind · React Router · TanStack Query · React Hook Form + Zod — Node 22 · Express · Prisma · PostgreSQL 16 — Docker Compose + Nginx.

## Layout
```
apps/api   Express API (modules/<feature>, middleware, utils, jobs, prisma/ schema+migrations+seed, tests)
apps/web   React SPA (features/<feature>, components, lib)
docs/      architecture, database (ERD), api, security, deployment, backup-restore, troubleshooting
```

## Deploy with Neon + Vercel

Follow [NEON-SETUP.md](NEON-SETUP.md) to connect the existing Neon database and deploy the web app/API to Vercel. Keep `DATABASE_URL` server-only; do not commit secrets.

## Quick start (Docker)
```bash
cp .env.example .env        # edit POSTGRES_PASSWORD, APP_ORIGIN, CORS_ORIGINS
docker compose up -d --build
curl http://localhost:8080/api/v1/ready
```
Open http://localhost:8080 and register. Full instructions: [HowToSetup.md](HowToSetup.md).

## Docs
[Architecture](docs/architecture.md) · [Database](docs/database.md) · [API](docs/api.md) · [Security](docs/security.md) · [Deployment](docs/deployment.md) · [Backup/restore](docs/backup-restore.md) · [Troubleshooting](docs/troubleshooting.md) · [Vibe96 checklist](docs/vibe96-checklist.md)
