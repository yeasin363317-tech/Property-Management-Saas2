# Troubleshooting

- **API exits with "Invalid environment configuration"** — a required variable is missing (`DATABASE_URL`) or malformed; check `docker compose logs api`.
- **403 CSRF_ORIGIN / CSRF_HEADER** — `CORS_ORIGINS` must contain the exact URL shown in the browser (scheme + host + port, no trailing slash). Custom API clients must send `X-Requested-With: XMLHttpRequest`.
- **Logged out immediately on HTTPS/HTTP mismatch** — `COOKIE_SECURE=true` only works over HTTPS; use `false` for plain-HTTP local testing.
- **Rate limited behind a proxy** — set `TRUST_PROXY=1` so client IPs are read from `X-Forwarded-For`.
- **Migration error about `btree_gist`/`gen_random_uuid`** — use PostgreSQL 13+ with contrib extensions; the DB user needs permission to `CREATE EXTENSION btree_gist` (or create it as superuser once).
- **`/ready` returns 503** — database unreachable; check `docker compose ps db` and credentials. Special characters in `POSTGRES_PASSWORD` break the composed URL: use letters and digits.
- **No password-reset email** — SMTP is not configured (`SMTP_HOST`, `SMTP_FROM`); the UI says so.
- **Rent not generated** — leases must be ACTIVE and cover the month; run "Generate rent for month" or the daily job.
- **Tests refuse to run** — `TEST_DATABASE_URL` must be set and its database name must contain `test`.
