#!/usr/bin/env bash
# Read-only D99 production-host gate. Run on the VPS before deploy/deploy.sh.

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.prod.yml)
failures=0

pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*" >&2; failures=$((failures + 1)); }
note() { printf '  INFO  %s\n' "$*"; }

for command in awk curl df docker jq nproc sed ss systemctl; do
  command -v "$command" >/dev/null 2>&1 || fail "missing command: $command"
done
(( failures == 0 )) || exit 1

cpu_count=$(nproc)
(( cpu_count >= 6 )) && pass "$cpu_count logical CPUs" || fail "$cpu_count CPUs; D99 requires at least 6"

memory_total_kib=$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)
memory_available_kib=$(awk '/^MemAvailable:/ { print $2 }' /proc/meminfo)
memory_floor_kib=$((10 * 1024 * 1024))
memory_available_floor_kib=$((6 * 1024 * 1024))
(( memory_total_kib >= memory_floor_kib )) \
  && pass "$((memory_total_kib / 1024)) MiB physical memory" \
  || fail "$((memory_total_kib / 1024)) MiB physical memory; D99 requires at least 10 GiB"
(( memory_available_kib >= memory_available_floor_kib )) \
  && pass "$((memory_available_kib / 1024)) MiB memory currently available" \
  || fail "$((memory_available_kib / 1024)) MiB available; stop other workloads before D99 deploy"

swap_total_kib=$(awk '/^SwapTotal:/ { print $2 }' /proc/meminfo)
swap_free_kib=$(awk '/^SwapFree:/ { print $2 }' /proc/meminfo)
swap_used_kib=$((swap_total_kib - swap_free_kib))
(( swap_used_kib < 512 * 1024 )) \
  && pass "$((swap_used_kib / 1024)) MiB swap in use" \
  || fail "$((swap_used_kib / 1024)) MiB swap in use; investigate memory pressure first"

disk_available_kib=$(df -Pk / | awk 'NR == 2 { print $4 }')
disk_floor_kib=$((20 * 1024 * 1024))
(( disk_available_kib >= disk_floor_kib )) \
  && pass "$((disk_available_kib / 1024)) MiB free on /" \
  || fail "$((disk_available_kib / 1024)) MiB free on /; D99 requires 20 GiB headroom"

[[ -f .env ]] || fail 'missing production .env'
if [[ -f .env ]]; then
  compose_json=$("${COMPOSE[@]}" config --format json 2>/dev/null) \
    || { fail 'docker-compose.prod.yml does not render with production .env'; compose_json='{}'; }
  if [[ "$compose_json" != '{}' ]]; then
    mapfile -t services < <(jq -r '.services | keys[]' <<<"$compose_json")
    expected=$'api1\napi2\napi3\npostgres\nvalkey\nworker'
    actual=$(printf '%s\n' "${services[@]}")
    [[ "$actual" == "$expected" ]] \
      && pass 'exactly three API replicas, one worker, PostgreSQL and Valkey configured' \
      || fail "unexpected production services: ${services[*]}"
    [[ "$(jq -r '.services.api1.environment.ROLE' <<<"$compose_json")" == api \
       && "$(jq -r '.services.api2.environment.ROLE' <<<"$compose_json")" == api \
       && "$(jq -r '.services.api3.environment.ROLE' <<<"$compose_json")" == api \
       && "$(jq -r '.services.worker.environment.ROLE' <<<"$compose_json")" == worker ]] \
      && pass 'API and singleton worker roles are separated' \
      || fail 'ROLE layout is not 3×api + 1×worker'
    for service in api1 api2 api3 worker; do
      soft=$(jq -r ".services.${service}.ulimits.nofile.soft // 0" <<<"$compose_json")
      hard=$(jq -r ".services.${service}.ulimits.nofile.hard // 0" <<<"$compose_json")
      (( soft >= 65535 && hard >= 65535 )) \
        && pass "$service nofile $soft/$hard" \
        || fail "$service nofile $soft/$hard; both must be at least 65535"
    done
    for spec in 'api1:1073741824' 'api2:1073741824' 'api3:1073741824' \
                'worker:805306368' 'postgres:4294967296' 'valkey:134217728'; do
      service=${spec%%:*}
      expected_limit=${spec##*:}
      limit=$(jq -r ".services.${service}.mem_limit // 0" <<<"$compose_json")
      [[ "$limit" == "$expected_limit" ]] \
        && pass "$service memory ceiling $((limit / 1024 / 1024)) MiB" \
        || fail "$service memory ceiling $limit bytes differs from the measured D99 budget $expected_limit"
    done
  fi
fi

nginx_limit=$(systemctl show nginx -p LimitNOFILE --value 2>/dev/null || true)
[[ "$nginx_limit" =~ ^[0-9]+$ ]] && (( nginx_limit >= 65535 )) \
  && pass "nginx systemd nofile $nginx_limit" \
  || fail "nginx systemd nofile is ${nginx_limit:-unknown}; require at least 65535"

nginx_dump=$(sudo -n nginx -T 2>&1) || { fail 'cannot validate active nginx config with passwordless sudo'; nginx_dump=''; }
if [[ -n "$nginx_dump" ]]; then
  worker_connections=$(awk '/^[[:space:]]*worker_connections[[:space:]]+[0-9]+;/ {
    value=$2; sub(/;/, "", value); print value; exit
  }' <<<"$nginx_dump")
  [[ "$worker_connections" =~ ^[0-9]+$ ]] && (( worker_connections >= 8192 )) \
    && pass "nginx worker_connections $worker_connections" \
    || fail "nginx worker_connections is ${worker_connections:-unknown}; run deploy/configure-capacity-host.sh"
fi

mapfile -t shared_containers < <(
  docker ps --format '{{.Names}}' | awk '/^(candely|hoofywood)(-|_)/ { print }'
)
if (( ${#shared_containers[@]} == 0 )); then
  pass 'no HoofyWood/Candely containers are consuming the Astera capacity budget'
else
  fail "shared-host containers still running: ${shared_containers[*]}"
fi

if docker inspect astera-postgres-prod >/dev/null 2>&1; then
  pg_max=$(docker exec astera-postgres-prod sh -c \
    'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "show max_connections"' 2>/dev/null || true)
  [[ "$pg_max" == 100 ]] \
    && pass 'PostgreSQL max_connections = 100' \
    || fail "PostgreSQL max_connections is ${pg_max:-unreadable}; expected 100"
else
  note 'PostgreSQL is not running; runtime max_connections check deferred'
fi

if (( failures > 0 )); then
  printf '\nD99 host preflight failed with %d blocking issue(s).\n' "$failures" >&2
  exit 1
fi

printf '\nD99 host preflight passed. No state was changed.\n'
