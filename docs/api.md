# API (base `/api/v1`)

All routes except `health`, `ready`, `auth/*` require a session cookie. Non-GET requests must send `X-Requested-With: XMLHttpRequest`. Lists accept `page`, `pageSize` (≤100) and return `meta`. Errors: `{error:{code,message,details?}}`.

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /ready` |
| Auth | `POST /auth/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password`; `GET/PATCH /auth/me` |
| Admin (ADMIN only) | `GET /admin/users`, `PATCH /admin/users/:id {disabled}` |
| Dashboard | `GET /dashboard?from&to` |
| Properties | `GET/POST /properties`, `GET/PATCH /properties/:id`, `POST /properties/:id/archive`, `/restore` |
| Units | `GET/POST /units`, `GET/PATCH /units/:id` |
| Tenants | `GET/POST /tenants`, `GET/PATCH /tenants/:id` |
| Leases | `GET/POST /leases`, `GET /leases/:id`, `POST /leases/:id/terminate`, `/renew` |
| Rent | `GET /rent/obligations`, `GET /rent/obligations/:id`, `POST /rent/obligations/generate {month:"YYYY-MM"}` |
| Payments | `GET/POST /payments`, `POST /payments/:id/reverse`, `GET /payments/:id/receipt` |
| Expenses | `GET/POST /expenses`, `PATCH/DELETE /expenses/:id` |
| Maintenance | `GET/POST /maintenance`, `PATCH /maintenance/:id` |
| Reports | `GET /reports/{summary,monthly,by-property,collections,outstanding,expenses}?from&to&propertyId&format=json|csv` |
| Notifications | `GET /notifications`, `POST /notifications/refresh`, `/read-all`, `/:id/read` |
| Audit | `GET /audit-logs` (own entries) |

`POST /payments` body: `{obligationId, amount, paidAt, method, reference?, note?, idempotencyKey?}` (or `Idempotency-Key` header). A formal OpenAPI file is **not** provided; this table is the API documentation.
