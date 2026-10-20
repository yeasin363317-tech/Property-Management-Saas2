# Security

Implemented: Argon2id hashing · hashed session tokens, HttpOnly/SameSite cookies · CSRF header + Origin check · per-landlord scoping on every query · role guard on `/admin` (no hidden accounts; admins via `scripts/create-admin.ts`) · Zod validation on every body/query · Prisma parameterised queries (raw SQL uses `Prisma.sql` tagged templates only) · rate limits (global, plus 20/15 min on auth) · Helmet headers · CORS allow-list from env · generic error responses (no stack traces) · audit log for auth, leases, payments, reversals, expenses, exports, admin actions · CSV formula-injection guard · registration can be disabled (`ENABLE_REGISTRATION=false`) · PostgreSQL not published by default.

Before production: strong `POSTGRES_PASSWORD`; `COOKIE_SECURE=true` behind HTTPS; exact `APP_ORIGIN`/`CORS_ORIGINS`; `TRUST_PROXY` matching your proxy count; backups; keep Node/Postgres/images patched; run `npm run audit:prod`.

Known limitations: no 2FA; no per-user session listing; no account lockout beyond rate limiting; login timing for unknown emails is approximate; no file uploads (so none to restrict); single-owner model (no staff users sharing one landlord account).
