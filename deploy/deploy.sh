#!/usr/bin/env bash
#
# Astera Online — deploy the current commit.
#
#   ./deploy/deploy.sh          fetch origin/master, build, migrate, restart
#   ./deploy/deploy.sh --local  deploy the working tree as it stands
#
# Idempotent: running it twice in a row is a no-op with a restart in the middle.
# It never touches another project on this box — every command below is scoped to
# the `astera` compose project or to /var/www/astera.
#
# THE ORDER IS THE WHOLE POINT. Migrations run BEFORE the new image serves
# traffic, because the server refuses to start against a database it is ahead of
# (D47) — and that refusal is the good outcome. The bad one is the reverse order:
# an old image against a new schema answers every request and fails every worker
# tick, so the API looks healthy while no fleet in the galaxy ever lands again.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
COMPOSE="docker compose -f docker-compose.prod.yml"
WEBROOT=/var/www/astera

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

[[ -f .env ]] || { echo "No .env beside docker-compose.prod.yml. Copy .env.production.example."; exit 1; }

if [[ "${1:-}" != "--local" ]]; then
  say "Fetching origin/master"
  git fetch --quiet origin
  git checkout --quiet master
  git reset --hard --quiet origin/master
fi
echo "  at $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

say "Building the server image"
$COMPOSE build api

say "Starting the database"
$COMPOSE up -d postgres
# `up -d` returns as soon as the container is created; the healthcheck is what
# says the socket is actually accepting. Migrating before that is a race that
# only shows up on a cold box.
for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' astera-postgres-prod 2>/dev/null || echo starting)
  [[ "$status" == healthy ]] && break
  sleep 1
done
[[ "$status" == healthy ]] || { echo "Postgres did not become healthy."; exit 1; }
echo "  postgres healthy"

say "Applying migrations"
# A one-off container on the same network, running the same image. Deliberately
# NOT run at boot inside the server: N replicas racing the same DDL is worse than
# a deploy that stops here and says so.
$COMPOSE run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate

say "Restarting the API"
$COMPOSE up -d api

say "Building the client"
# Exported to a directory rather than an image: nginx serves these files
# directly, so there is no container in the path of a static asset.
STAGE="$ROOT/.deploy-web"
rm -rf "$STAGE"
docker build --target web-dist --output "type=local,dest=$STAGE" .
[[ -f "$STAGE/index.html" ]] || { echo "Client build produced no index.html."; exit 1; }

say "Publishing the client to $WEBROOT"
sudo mkdir -p "$WEBROOT"
# --delete so a removed asset actually goes; rsync swaps each file into place, so
# a reload never sees a half-written bundle.
sudo rsync -a --delete "$STAGE"/ "$WEBROOT"/
sudo chown -R www-data:www-data "$WEBROOT"
rm -rf "$STAGE"

say "Checking the deployment"
API_PORT=$(grep -E '^API_PORT=' .env | cut -d= -f2 || echo 3200)
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
health=$(curl -sS "http://127.0.0.1:${API_PORT}/health" || echo '{}')
echo "$health" | jq . 2>/dev/null || echo "$health"

# `ok:false` is not necessarily a failed deploy — a stranded flight from before
# this deploy will say so — but it must never scroll past unread.
if [[ "$(echo "$health" | jq -r '.ok' 2>/dev/null)" != "true" ]]; then
  echo
  echo "  ⚠  /health is not ok. The API is serving; something in the queue is not."
  echo "     Read the checks above before walking away."
fi

say "Deployed $(git rev-parse --short HEAD)"
