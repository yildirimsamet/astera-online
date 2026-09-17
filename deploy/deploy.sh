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
# THE ORDER IS THE WHOLE POINT. No application process runs across a migration.
# An old worker can consume a newly backfilled event kind as unknown before the
# new image starts; a new server refuses to start against a database it is ahead
# of (D47). Stop old, migrate, then start new.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
COMPOSE="docker compose -f docker-compose.prod.yml"
WEBROOT=/var/www/astera

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

[[ -f .env ]] || { echo "No .env beside docker-compose.prod.yml. Copy .env.production.example."; exit 1; }

# A SCRIPT THAT UPDATES ITSELF HAS TO HAND OVER, NOT CARRY ON.
#
# `git reset --hard` rewrites this file while bash is part-way through reading
# it. Bash keeps a byte offset into the script and re-reads from it, so what runs
# after the fetch is whatever now happens to sit at that offset in the NEW file —
# a mixture of two versions, silently. The first deploy after adding a step to
# this script ran the old body and reported success.
#
# So: fetch, then replace this process with the updated script. The marker stops
# the new one fetching again.
if [[ "${1:-}" != "--local" && "${ASTERA_DEPLOY_REEXEC:-}" != "1" ]]; then
  say "Fetching origin/master"
  # CAPTURED BEFORE THE RESET, because afterwards it is unrecoverable: the reset
  # moves `master` and the old commit is no longer any ref this script can name.
  # It travels through the re-exec in the environment, and it is what the rollback
  # artifacts below are named after — an artifact whose name is the commit it can
  # take you BACK to, rather than the one it was taken during.
  export ASTERA_PREVIOUS_SHA=$(git rev-parse HEAD)
  git fetch --quiet origin
  git checkout --quiet master
  git reset --hard --quiet origin/master
  export ASTERA_DEPLOY_REEXEC=1
  exec "$0" "$@"
fi
echo "  at $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

say "Checking the D99 host budget"
./deploy/host-capacity-preflight.sh

# THE CSP NONCE NEEDS A MODULE, AND A MISSING ONE IS A BLANK GAME.
#
# `index.html` ships every script tag stamped with a `__CSP_NONCE__` placeholder
# (apps/web/vite.config.ts, `html.cspNonce`) and nginx rewrites it per request
# with `sub_filter`, so the `script-src 'nonce-…' 'strict-dynamic'` header and
# the document agree. Without ngx_http_sub_module the substitution silently does
# not happen, the nonce in the header matches nothing in the page, and EVERY
# script is refused — a black screen with a console full of CSP violations.
#
# So it is checked here, before anything is built, rather than discovered after
# the client has already been published over the working one.
say "Checking nginx can stamp the CSP nonce"
if ! nginx -V 2>&1 | grep -q -- '--with-http_sub_module'; then
  echo "  ✗ nginx was built without ngx_http_sub_module."
  echo "    deploy/nginx/astera.conf needs it to rewrite __CSP_NONCE__ per request."
  echo "    On Debian/Ubuntu: sudo apt install nginx-full (or nginx-extras)."
  exit 1
fi
echo "  ngx_http_sub_module present"

# ── THE ROLLBACK BOUNDARY, TAKEN BEFORE ANYTHING IS REPLACED ─────────────────
#
# A rollback needs three things and this script used to retain none of them: the
# image that is running now, the client files that are serving now, and the vhost
# that is loaded now. The runbook's manual path takes all three by hand (its
# "rule 10" copies); the script overwrote the image tag, published over the
# webroot in place, and saved the vhost to a mktemp it deleted on the way out.
#
# Measured cost of that gap: after the 2026-09-17 release the only way back was
# to check out the previous commit and rebuild the client. Nothing was lost, but
# "rebuild it" is not a rollback plan when the site is down.
#
# Cheap to fix and cheap to keep: one docker tag, one `cp -a` of a directory that
# is a few MB, and a vhost copy that is a few KB.
say "Retaining the rollback boundary"
# On `--local` there was no fetch, so the commit being replaced is the one in the
# tree; the artifacts are then named after it, which is the best available truth.
ROLLBACK_SHA=${ASTERA_PREVIOUS_SHA:-$(git rev-parse HEAD)}
echo "  rolling back to would mean $(git rev-parse --short "$ROLLBACK_SHA")"

# The image that is RUNNING, not the one about to be built. `docker tag` on a
# digest that is already tagged is free and copies no layers.
if docker image inspect astera-server:latest >/dev/null 2>&1; then
  docker tag astera-server:latest "astera-server:rollback-${ROLLBACK_SHA}"
  echo "  image   astera-server:rollback-${ROLLBACK_SHA}"
else
  echo "  image   none yet (first install)"
fi

# The client that is serving right now. `--delete` so a re-run does not blend two
# releases into one directory.
if [[ -d "$WEBROOT" ]]; then
  sudo rsync -a --delete "$WEBROOT"/ /var/www/astera-previous/
  echo "  webroot /var/www/astera-previous"
else
  echo "  webroot none yet (first install)"
fi

say "Building the server image"
$COMPOSE build api1

say "Starting PostgreSQL and Valkey"
$COMPOSE up -d postgres valkey
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
for _ in $(seq 1 30); do
  valkey_status=$(docker inspect -f '{{.State.Health.Status}}' astera-valkey-prod 2>/dev/null || echo starting)
  [[ "$valkey_status" == healthy ]] && break
  sleep 1
done
[[ "$valkey_status" == healthy ]] || { echo "Valkey did not become healthy."; exit 1; }
echo "  valkey healthy"

say "Stopping every application role for migration"
# The worker must not see rows authored by a
# migration for code it does not yet know; unknown scheduled events are completed
# deliberately, so even a few seconds of version skew can erase a public moment.
$COMPOSE stop api1 api2 api3 worker
# First D99 deploy leaves the old single-process service as a Compose orphan. Stop
# it explicitly before migration; `--remove-orphans` below removes only its
# stateless container, never the PostgreSQL volume.
docker stop astera-api-prod >/dev/null 2>&1 || true

say "Applying migrations"
# A one-off container on the same network, running the same image. Deliberately
# NOT run at boot inside the server: N replicas racing the same DDL is worse than
# a deploy that stops here and says so.
$COMPOSE run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate

say "Starting one worker and three API replicas"
$COMPOSE up -d --remove-orphans worker api1 api2 api3

say "Building the client"
# Exported to a directory rather than an image: nginx serves these files
# directly, so there is no container in the path of a static asset.
STAGE="$ROOT/.deploy-web"
rm -rf "$STAGE"
# The analytics id, if this deployment has one. Read from the same `.env` the API
# uses, and passed as a BUILD argument because Vite inlines it into the bundle —
# there is no runtime environment on a directory of static files. Unset means the
# client ships with no tag at all, which is the correct behaviour and not a
# degraded one.
GA_ID=$(grep -E '^VITE_GA_ID=' .env | cut -d= -f2- || true)
docker build --target web-dist --build-arg "VITE_GA_ID=${GA_ID}" \
  --output "type=local,dest=$STAGE" .
[[ -n "$GA_ID" ]] && echo "  analytics: $GA_ID" || echo "  analytics: not configured"
[[ -f "$STAGE/index.html" ]] || { echo "Client build produced no index.html."; exit 1; }

# PRE-COMPRESS, so nginx never spends a cycle on it. `gzip_static on` serves the
# `.gz` beside a file when the client accepts it; built here at level 9 rather
# than per request at nginx's default level 1, which is worth ~100 KB on the one
# file that decides how long a phone stares at the loading cover.
#
# -k keeps the original: a client that does not send Accept-Encoding still needs
# it, and `try_files` looks for the plain name.
find "$STAGE" -type f ! -name 'index.html' \( -name '*.js' -o -name '*.css' -o -name '*.svg' \
     -o -name '*.json' -o -name '*.webmanifest' -o -name '*.html' \) \
     -size +1k -exec gzip -9 -k -f {} +
echo "  pre-compressed $(find "$STAGE" -name '*.gz' | wc -l) files"

say "Publishing the client to $WEBROOT"
sudo mkdir -p "$WEBROOT"
# Keep old hashed assets for tabs that load a lazy module after a deployment.
# The helper copies the new asset set first and swaps index.html last.
#
# --chmod IS NOT TIDINESS. `-a` copies the source's permissions onto the
# destination ROOT as well, and `docker build --output` writes its staging
# directory 0700 — so a plain `-a` left /var/www/astera readable by its owner
# only. nginx runs as www-data and would still have served it after the chown
# below, which is exactly what makes it a bad failure: the site works, and
# nobody can read the directory to find out why anything is wrong.
sudo bash deploy/publish-web.sh "$STAGE" "$WEBROOT"
sudo chown -R www-data:www-data "$WEBROOT"
rm -rf "$STAGE"

# ── THE VHOST GOES IN AFTER THE CLIENT, AND THE ORDER IS LOAD-BEARING ────────
#
# These two halves only work together, and they fail in opposite directions:
#
#   · NEW PAGE + OLD VHOST is harmless. The old policy carries no nonce source,
#     so a browser ignores the `nonce` attribute on the new page's script tags
#     entirely and `'self'` allows them exactly as before. That is the state the
#     site sits in for the few seconds between the two steps below.
#   · OLD PAGE + NEW VHOST IS A BLANK GAME. `'strict-dynamic'` makes `'self'`
#     and every host source IGNORED, so a page whose script tags carry no nonce
#     has nothing left to allow them and every script on it is refused.
#
# This block used to sit immediately after the API replicas started — minutes
# before the client was even built — which would have blanked the live site for
# the length of a Docker build. `test/deployment-publish.test.ts` holds the
# order now so it cannot drift back.
say "Installing the three-replica Nginx route"
nginx_live=/etc/nginx/sites-available/astera
# RETAINED, NOT TEMPORARY. This copy is both the "restore it if `nginx -t` fails"
# safety net below AND the rollback artifact: an old client must never be put back
# under the current nonce vhost, so a rollback needs the vhost that matched it.
# Named like the runbook's, so both paths leave the same evidence behind.
# `pre-<sha>` names the release it came BEFORE, which is the runbook's own
# convention and matches the copies already on the box. The image tag opposite
# is `rollback-<previous sha>` — the commit it takes you back TO. Two different
# shas on purpose; they answer two different questions.
nginx_previous="${nginx_live}.pre-$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%d-%H%M%S)"
nginx_had_previous=false
if sudo test -e "$nginx_live"; then
  sudo cp -a "$nginx_live" "$nginx_previous"
  nginx_had_previous=true
  echo "  vhost  $nginx_previous"
fi
sudo install -o root -g root -m 0644 deploy/nginx/astera.conf "$nginx_live"
if ! sudo nginx -t; then
  echo "Nginx rejected the new route; restoring the pre-deploy file." >&2
  if [[ "$nginx_had_previous" == true ]]; then
    sudo cp -a "$nginx_previous" "$nginx_live"
  else
    sudo rm -f "$nginx_live"
  fi
  sudo nginx -t
  exit 1
fi
sudo systemctl reload nginx

say "Checking the deployment"
ports=(
  "$(grep -E '^API_PORT_1=' .env | cut -d= -f2 || echo 3200)"
  "$(grep -E '^API_PORT_2=' .env | cut -d= -f2 || echo 3201)"
  "$(grep -E '^API_PORT_3=' .env | cut -d= -f2 || echo 3202)"
  "$(grep -E '^WORKER_PORT=' .env | cut -d= -f2 || echo 3210)"
)
for port in "${ports[@]}"; do
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then break; fi
    sleep 1
  done
  health=$(curl -sS "http://127.0.0.1:${port}/health" || echo '{}')
  echo "  :${port}"
  echo "$health" | jq . 2>/dev/null || echo "$health"

  # `ok:false` is not necessarily a failed deploy — a stranded flight from before
  # this deploy will say so — but it must never scroll past unread.
  if [[ "$(echo "$health" | jq -r '.ok' 2>/dev/null)" != "true" ]]; then
    echo
    echo "  ⚠  :${port}/health is not ok. Read the checks above before walking away."
  fi
done

# THE NONCE IS VERIFIED ON THE LIVE PAGE, NOT ASSUMED.
#
# The preflight above proves nginx CAN substitute; this proves it DID. A page
# served with the placeholder intact carries no valid nonce, so under
# `'strict-dynamic'` every script on it is refused and the game is a blank
# screen — the one failure of this deploy that no health endpoint would report.
say "Checking the served page carries a real CSP nonce"
served=$(curl -fsS -D /tmp/astera-index-headers https://asteraonline.space/ 2>/dev/null || echo '')
header_nonce=$(grep -i '^content-security-policy:' /tmp/astera-index-headers 2>/dev/null \
  | grep -o "nonce-[0-9a-f]\{32\}" | head -1 | cut -d- -f2- || echo '')
rm -f /tmp/astera-index-headers
if [[ -z "$served" ]]; then
  echo "  ⚠  Could not fetch https://asteraonline.space/ from this box; check it by hand."
elif [[ "$served" == *"__CSP_NONCE__"* ]]; then
  echo
  echo "  ✗ The page still contains __CSP_NONCE__. sub_filter did not run."
  echo "    Most likely a stale index.html.gz in $WEBROOT, or the location block"
  echo "    in deploy/nginx/astera.conf was not reloaded. THE GAME IS BLANK until"
  echo "    this is fixed: sudo rm -f $WEBROOT/index.html.gz && sudo nginx -s reload"
  exit 1
elif [[ -z "$header_nonce" ]] || [[ "$served" != *"nonce=\"$header_nonce\""* ]]; then
  echo
  echo "  ✗ The nonce in the CSP header does not appear in the page."
  echo "    Compare: curl -sSD - https://asteraonline.space/ | head -40"
  exit 1
else
  echo "  nonce stamped and matching"
fi

say "Deployed $(git rev-parse --short HEAD)"
