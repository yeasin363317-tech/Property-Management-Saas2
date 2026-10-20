# Vibe96 submission checklist (honest status)

Source of truth: https://www.vibe96.com/sell , /how-it-works , /seller-agreement. **These pages were not read** while building this package (no network access) — read them and reconcile before submitting.

Counts (actual): 16 screens (login, register, forgot, reset, dashboard, properties, units, tenants, leases, rent, receipt, expenses, maintenance, reports, notifications, profile) · 13 database tables.

| Item | Status |
|---|---|
| Complete source (API, web, Prisma schema + migration, Docker, docs) | Written |
| Syntax parse of all 65 TS/TSX files | Verified (parse only, no type-check) |
| `npm install` / lockfile (`package-lock.json`) | **Not done** — run `npm install`, commit lockfile |
| Type-check, lint, build (api + web) | **Not run** |
| Migration applied to an empty PostgreSQL | **Not run** (hand-written SQL: verify, then `prisma migrate diff`) |
| API integration tests (auth, isolation, rent, leases, health) | Written, **not run** |
| Frontend test (login) | Written, **not run** |
| Docker build, compose startup, readiness | **Not run** |
| `npm audit --omit=dev` | **Not run** |
| Secrets scan | No secrets in repo; `.env.example` placeholders only (re-check before commit) |
| OpenAPI file | Not provided (docs/api.md table instead) |
| 5+ screenshots at 1920×1080 | **Blocked** — need a running app |
| Public demo URL | **Blocked** — not deployed |
| Marketplace listing draft, seller agreement, human review | **Todo (you)** |
| LICENSE | Placeholder — choose your license |

Known gaps: no maintenance image uploads, no email reminders, no worker process (cron + CLI job instead), no PDF receipts (browser print), service layer is thin for simple CRUD modules (logic lives in route files).
