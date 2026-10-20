# Codebase guide (for AI agents and developers)

Monorepo (npm workspaces): `apps/api` (Express+Prisma, CommonJS), `apps/web` (React+Vite, ESM). See docs/architecture.md.

Commands: `npm run dev:api|dev:web`, `npm run typecheck`, `npm run lint`, `npm test` (API tests need `TEST_DATABASE_URL`), `npm run build`, `npm run db:migrate`, `npm run db:migrate:dev -w apps/api` (new migration), `npm run audit:prod`.

Rules:
1. **Every Prisma query on business data must include `ownerId: ownerOf(req)`** (use `updateMany/deleteMany` with `{id, ownerId}`). Verify any referenced parent id belongs to the owner. Add a negative test in `tests/isolation.test.ts` for new endpoints.
2. Money: Decimal only; strings over the wire; never `Number` arithmetic on amounts server-side.
3. Payment/obligation changes go through `rent.service.ts` inside a transaction with the obligation row locked. Never delete payments; reverse them.
4. Validate with Zod at the route boundary; throw `AppError` helpers; never return raw errors.
5. Raw SQL only via `Prisma.sql` templates with bound parameters.
6. No secrets in code or docs; new env vars go in `config/env.ts` and `.env.example`.
7. Schema change = edit `schema.prisma` + generate a migration; never edit applied migrations.
8. Frontend: all data via `lib/api.ts`; forms use React Hook Form + Zod; no mock data in production paths. Simple CRUD screens are configs for `components/ResourcePage.tsx`.
