# Deployment

## Route 1 — Docker Compose on a Linux VPS
1. Install Docker + Compose, clone repo, `cp .env.example .env`, set values (see HowToSetup.md).
2. `docker compose up -d --build`. Only the `web` container publishes a port (`WEB_PORT`, default 8080); PostgreSQL stays on the internal network.
3. HTTPS: put a reverse proxy (Caddy/Nginx + certbot) on 443 forwarding to `127.0.0.1:8080`, forward `X-Forwarded-Proto`, then set `APP_ORIGIN=https://your.domain`, `CORS_ORIGINS=https://your.domain`, `COOKIE_SECURE=true`, and `docker compose up -d`.
4. Daily job (cron on host): `15 2 * * * cd /opt/pms && docker compose exec -T api node dist/jobs/daily.js >> /var/log/pms-daily.log 2>&1`
5. Upgrade: `git pull && docker compose up -d --build` (migrations apply on start). Back up first.

## Route 2 — Manual Linux server
Install Node 22 and PostgreSQL, create DB/user, `npm install && npm run build`, `npm run db:migrate`, run `node apps/api/dist/server.js` under systemd, serve `apps/web/dist` from Nginx with `/api/` proxied to `127.0.0.1:4000`. Cron: `15 2 * * * cd /opt/pms/apps/api && DATABASE_URL=... node dist/jobs/daily.js`.

Example systemd unit: `ExecStart=/usr/bin/node /opt/pms/apps/api/dist/server.js`, `EnvironmentFile=/etc/pms.env`, `User=pms`, `Restart=on-failure`.

Health: `/api/v1/health` (process) and `/api/v1/ready` (database).
