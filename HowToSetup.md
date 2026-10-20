# How to set up

## Requirements
Node.js 22 LTS (>= 20.11), npm 10+, PostgreSQL 16 (14+ works; needs the `btree_gist` extension, included in standard packages), Docker 24+ with Compose v2 (Docker route only).

## A. Docker Compose (Linux VPS or local)
```bash
git clone <your-repo> pms && cd pms
cp .env.example .env
nano .env     # CHANGE: POSTGRES_PASSWORD (letters/digits only), APP_ORIGIN, CORS_ORIGINS, COOKIE_SECURE=true when on HTTPS
docker compose up -d --build
docker compose ps                                  # all services healthy
curl -fsS http://localhost:8080/api/v1/health      # {"status":"ok"}
curl -fsS http://localhost:8080/api/v1/ready       # {"status":"ready"}
```
Migrations run automatically when the API container starts (`prisma migrate deploy`). Open the site and register your account. Create an administrator (optional):
```bash
docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD='a-long-password' api npx tsx scripts/create-admin.ts
```
(If `tsx` is unavailable in the image, run it from a dev checkout pointed at the same DATABASE_URL.)
Schedule the daily job (see docs/deployment.md): `docker compose exec -T api node dist/jobs/daily.js`.

## B. Manual (Node + PostgreSQL)
```bash
sudo -u postgres psql -c "CREATE USER pms WITH PASSWORD 'CHANGE_ME';" -c "CREATE DATABASE pms OWNER pms;"
npm install                       # creates package-lock.json on first run; commit it
export DATABASE_URL='postgresql://pms:CHANGE_ME@localhost:5432/pms?schema=public'
export NODE_ENV=production APP_ORIGIN=https://rent.example.com CORS_ORIGINS=https://rent.example.com COOKIE_SECURE=true TRUST_PROXY=1
npm run build
npm run db:migrate                # prisma migrate deploy
node apps/api/dist/server.js      # use systemd/pm2 in production
```
Serve `apps/web/dist` with Nginx and proxy `/api/` to `127.0.0.1:4000` (see `apps/web/nginx.conf`). Add HTTPS with certbot.

## C. Development
```bash
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db     # DB on 127.0.0.1:5432
export DATABASE_URL='postgresql://pms:<POSTGRES_PASSWORD>@localhost:5432/pms?schema=public'
npm run db:migrate
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173 (proxies /api)
```
Optional demo data (never in production): `DEMO_SEED=true DEMO_PASSWORD='long-demo-pass' npm run db:seed` → login `demo.landlord@example.com`.

## Tests and checks
```bash
createdb pms_test   # or via psql; database name must contain "test"
export TEST_DATABASE_URL='postgresql://pms:<pw>@localhost:5432/pms_test?schema=public'
DATABASE_URL=$TEST_DATABASE_URL npx -w apps/api prisma migrate deploy
npm test && npm run typecheck && npm run lint && npm run build && npm run audit:prod
```

## Troubleshooting
See [docs/troubleshooting.md](docs/troubleshooting.md).
