#!/usr/bin/env bash
# Build, reseed and start the isolated D99 capacity environment.

set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.capacity.yml"

capacity_password="${CAPACITY_PASSWORD:-}"
(( ${#capacity_password} >= 8 && ${#capacity_password} <= 200 )) || {
  echo "Set CAPACITY_PASSWORD (8–200 characters) for staging accounts."
  exit 1
}

# Seeded commanders (every seat of SERVERS: 2 × 1,000) and how many of them the run logs in;
# the rest are offline with a fleet in the air (scaling plan §8.2 L3).
users="${1:-2000}"
seed="${2:-99300}"
[[ "$users" =~ ^[0-9]+$ ]] && (( users >= 1 && users <= 2000 )) || {
  echo "Users must be 1..2000."
  exit 1
}
[[ "$seed" =~ ^[0-9]+$ ]] || { echo "Seed must be a positive integer."; exit 1; }
export ASTERA_GIT_COMMIT
ASTERA_GIT_COMMIT="$(git rev-parse HEAD)"
missions="${3:-$(( users < 90 ? users : 90 ))}"
miners="${4:-$(( users < 45 ? users : 45 ))}"
online="${5:-$(( users < 1000 ? users : 1000 ))}"
[[ "$online" =~ ^[0-9]+$ ]] && (( online >= 1 && online <= users )) || {
  echo "Online must be 1..users."
  exit 1
}
# The plan's L3: 1,000 online on 1,250 streams (a quarter keep a second tab open).
connections=$(( online * 5 / 4 ))
[[ "$missions" =~ ^[0-9]+$ ]] && (( missions <= users )) || {
  echo "Missions must be 0..users."
  exit 1
}
[[ "$miners" =~ ^[0-9]+$ ]] && (( miners <= users )) || {
  echo "Miners must be 0..users."
  exit 1
}

$COMPOSE build api1
$COMPOSE up -d postgres valkey
$COMPOSE stop api1 api2 api3 worker nginx
$COMPOSE --profile tools run --rm seed \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/capacity.ts \
  --yes --users "$users" --online "$online" --seed "$seed" --missions "$missions" --miners "$miners"
$COMPOSE up -d worker api1 api2 api3 nginx

ports=(
  "${CAPACITY_API_PORT_1:-3300}"
  "${CAPACITY_API_PORT_2:-3301}"
  "${CAPACITY_API_PORT_3:-3302}"
  "${CAPACITY_WORKER_PORT:-3310}"
  "${CAPACITY_NGINX_PORT:-3380}"
)
capacity_database_url="postgres://astera_capacity:capacity_only@127.0.0.1:${CAPACITY_POSTGRES_PORT:-5645}/astera_capacity"
wave_launches=$(( online < 100 ? online : 100 ))
for port in "${ports[@]}"; do
  for _ in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -fsS "http://127.0.0.1:${port}/health" >/dev/null
  echo "healthy :${port}"
done

echo
echo "Run direct replica load (synthetic source IPs, shared Valkey):"
echo "  CAPACITY_DATABASE_URL='$capacity_database_url' pnpm capacity:test -- --base-urls http://127.0.0.1:${ports[0]},http://127.0.0.1:${ports[1]},http://127.0.0.1:${ports[2]} --metrics-urls http://127.0.0.1:${ports[0]}/metrics,http://127.0.0.1:${ports[1]}/metrics,http://127.0.0.1:${ports[2]}/metrics,http://127.0.0.1:${ports[3]}/metrics --users $online --connections $connections --seeded-accounts $users --scenario normal --duration-seconds 3600"
echo
echo "Run through Nginx (login stays direct so the auth-abuse bucket remains production-shaped):"
echo "  CAPACITY_DATABASE_URL='$capacity_database_url' pnpm capacity:test -- --base-urls http://127.0.0.1:${ports[4]} --login-base-urls http://127.0.0.1:${ports[0]},http://127.0.0.1:${ports[1]},http://127.0.0.1:${ports[2]} --metrics-urls http://127.0.0.1:${ports[0]}/metrics,http://127.0.0.1:${ports[1]}/metrics,http://127.0.0.1:${ports[2]}/metrics,http://127.0.0.1:${ports[3]}/metrics --users $online --connections $connections --seeded-accounts $users --scenario normal --duration-seconds 3600 --wave-launches $wave_launches --reconnect-at-seconds 1200"
