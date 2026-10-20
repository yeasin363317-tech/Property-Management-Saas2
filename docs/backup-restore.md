# Backup and restore

Docker:
```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > pms-$(date +%F).dump
# restore into an empty database (stop the api first)
docker compose stop api web
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < pms-2026-01-01.dump
docker compose start api web
```
Manual: `pg_dump -Fc -U pms pms > backup.dump` and `pg_restore -U pms -d pms --clean --if-exists backup.dump`.
Store dumps off-server, encrypted; test a restore regularly. The data volume is `pgdata` (`docker volume ls`).
