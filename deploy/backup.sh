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

cd "$(dirname "$0")/.."
[[ -f .env ]] || { echo "No .env beside docker-compose.prod.yml."; exit 1; }
# shellcheck disable=SC1091
set -a; source .env; set +a

DEST="${BACKUP_DIR:-$HOME/backups}"
KEEP="${BACKUP_KEEP:-14}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DEST/astera-$STAMP.sql.gz"

mkdir -p "$DEST"

# Streamed straight out of the container and gzipped on the way. `--clean` so the
# dump can be replayed into a database that already has a schema.
docker exec astera-postgres-prod \
  pg_dump -U "${POSTGRES_USER:-astera}" -d "${POSTGRES_DB:-astera}" --clean --if-exists \
  | gzip -9 > "$OUT.partial"

# Renamed only once the dump has finished, so a run killed halfway can never be
# mistaken for a good backup by the retention sweep below.
mv "$OUT.partial" "$OUT"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Retention. Sorted by name, which is chronological because the stamp is.
mapfile -t old < <(ls -1 "$DEST"/astera-*.sql.gz 2>/dev/null | head -n -"$KEEP")
for f in "${old[@]:-}"; do
  [[ -n "$f" ]] && rm -f "$f" && echo "pruned $(basename "$f")"
done
