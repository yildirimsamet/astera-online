#!/usr/bin/env bash
#
# Astera Online — one compressed dump of the live database.
#
#   ./deploy/backup.sh          write ~/backups/astera-<stamp>.sql.gz
#
# WHY THIS MATTERS MORE THAN IT LOOKS. A season is fourteen days of decisions
# that only exist here: what a commander built, who they scouted, what they lost.
# None of it is derivable and none of it is anywhere else. Losing the volume
# without a dump is losing the players, not just the data — nobody starts a
# fourteen-day season twice.
#
# Installed by the operator as a cron entry; see docs/deployment.md.

set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo "No .env beside docker-compose.prod.yml."; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

DEST="${BACKUP_DIR:-$HOME/backups}"
KEEP="${BACKUP_KEEP:-14}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DEST/astera-$STAMP.sql.gz"
MEDIA_OUT="$DEST/astera-$STAMP.media.tar.gz"

mkdir -p "$DEST"

# Streamed straight out of the container and gzipped on the way. `--clean` so the
# dump can be replayed into a database that already has a schema.
docker exec astera-postgres-prod \
  pg_dump -U "${POSTGRES_USER:-astera}" -d "${POSTGRES_DB:-astera}" --clean --if-exists \
  | gzip -9 > "$OUT.partial"

# Renamed only once the dump has finished, so a run killed halfway can never be
# mistaken for a good backup by the retention sweep below.
# Files are immutable after sending. Copying them after the DB dump includes
# every referenced file plus any newer uploads; a partial pair is never published.
docker exec astera-api1-prod tar -C /data/chat-media -czf - . > "$MEDIA_OUT.partial"
mv "$MEDIA_OUT.partial" "$MEDIA_OUT"
mv "$OUT.partial" "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

# The independent hourly cron also runs this if pg_dump/media backup fails.
python3 deploy/backup-retention.py --directory "$DEST" --keep "$KEEP" --apply
