# Architecture

Browser → Nginx (static SPA, `/api/` proxy) → Express API → PostgreSQL (Prisma). The database is not published to the host.

**API layers.** `routes.ts` mounts modules under `/api/v1`. Each `modules/<feature>` holds route handlers with Zod validation; business logic that is non-trivial lives in services (`lease.service.ts`, `rent.service.ts`, `reports.service.ts`, `notifications.service.ts`). Shared: `config/env.ts` (validated env), `middleware/` (auth, CSRF, errors), `utils/` (errors, dates, schemas, audit, mailer). Responses: `{data, meta?}` or `{error:{code,message,details?}}`.

**Tenancy.** Every business row has `ownerId` (the landlord user). Every query includes `ownerId = req.user.id`; updates/deletes use `updateMany/deleteMany` with `{id, ownerId}`; parents referenced in request bodies are looked up with `ownerId` before use. IDs, roles and owner IDs from the client are never trusted.

**Sessions.** Random 256-bit token in an HttpOnly, SameSite=Lax cookie (`Secure` via `COOKIE_SECURE`); only its SHA-256 is stored in `Session`. CSRF: required `X-Requested-With` header + Origin allow-list on non-GET requests.

## Financial rules
- Money is `DECIMAL(12,2)`; the API accepts strings/numbers with ≤2 decimals and returns strings.
- One `RentObligation` per lease per month (unique key). Amount = lease rent (no proration). Due date = month + lease `dueDay` (1–28).
- `paidAmount` = sum of that obligation's `RentPayment.amount` (payments positive, reversals negative), recomputed inside the same DB transaction while the obligation row is locked (`SELECT … FOR UPDATE`).
- Status: `PAID` if paid ≥ due; otherwise `OVERDUE` if due date < today, else `PARTIAL` (paid>0) or `UNPAID`. Overdue is derived at read time.
- Late payments: accepted, no automatic fees. Over-payments: rejected (409); credits are not supported. Partial payments reduce the balance only.
- Duplicate protection: unique `(ownerId, idempotencyKey)`; a repeated key returns the original payment (HTTP 200, `meta.duplicate=true`). The web form uses one key per opened form.
- Corrections: `POST /payments/:id/reverse` appends a negative `REVERSAL` row (once per payment). Nothing is deleted.
- Leases: overlap rejected in code and by a PostgreSQL exclusion constraint (`lease_no_overlap`). Unit occupancy is derived from active leases. Renewal marks the old lease `RENEWED` and creates a linked lease starting the next day. Expired active leases are set to `ENDED` by the daily job.

## Scheduled work
`node dist/jobs/daily.js` (idempotent): close expired leases, generate this month's obligations for all landlords, refresh notifications. Also available manually in the UI ("Generate rent for month").

## Reports
Rent due (obligations due in range) · Rent collected (net payments dated in range) · Outstanding (current unpaid balance of obligations due on/before range end) · Expenses · Net operating cash flow = collected − expenses. This is not profit.
