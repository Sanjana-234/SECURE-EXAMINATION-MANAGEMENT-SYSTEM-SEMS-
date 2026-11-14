#!/bin/sh
# Nightly backup: consistent DB snapshot (safe while running) + uploads. Run from the repo root via cron.
set -eu
OUT="${1:-/backups}/sems-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$OUT"
docker compose exec -T sems-1 node --disable-warning=ExperimentalWarning src/backup.ts /data/snapshot.db 2>/dev/null \
  || docker compose exec -T sems node --disable-warning=ExperimentalWarning src/backup.ts /data/snapshot.db
docker compose cp "$(docker compose ps -q | head -1):/data/snapshot.db" "$OUT/sems.db"
docker compose cp "$(docker compose ps -q | head -1):/data/uploads" "$OUT/uploads" || true
echo "Backup written to $OUT"
