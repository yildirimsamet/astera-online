#!/usr/bin/env bash
#
# ONE COMMAND, AND AT THE END OF IT THE GAME IS PLAYABLE ON :5173.
#
# Owner instruction: *"tek komutla localde projeyi kaldırayım, tüm eksikleri
# yapılacakları tek komut ile yaptırayım."* So this is not a wrapper around
# `pnpm dev` — it is every precondition that `pnpm dev` silently assumes, checked
# and satisfied in order, and it refuses rather than starting something half-up.
#
#   pnpm start
#
# THREE PROCESSES, NOT FOUR. There is no socket service to raise: realtime is
# SSE on `/api/stream`, served by the API process itself (`docs/deployment.md`
# says the same of production, where `socket.` merely redirects to the apex). And
# `ROLE=both` in `.env` means that one process is API *and* worker, so scheduled
# moments — arrivals, battles, radar warnings — drain without a second command.
# What comes up is: PostgreSQL in Docker, the API/worker on :3100, the client on
# :5173, with the client proxying `/api` to the API so everything is one origin.
#
# WHY THE DATABASE IS SET UP EVERY TIME. `docker-compose.yml` puts the dev
# database on **tmpfs** — speed over durability, deliberately — so every fresh
# container starts empty. Migration and bootstrap are therefore not a first-run
# step, they are part of starting up, and both are idempotent: an already-migrated
# database applies nothing and an already-open galaxy reports `already up`.
#
# "BUILD" MEANS TYPECHECK HERE, and that is not a shortcut. Only `apps/web` emits
# anything (`vite build`), and the dev server on :5173 serves from source and never
# reads that output — while `packages/rules`, `packages/sim` and `apps/server` have
# no build step at all, because they run from TypeScript through tsx and vite. So
# `tsc --noEmit` across all four IS the compile, and `--dist` adds the production
# bundle for anyone who wants the artifact proven too.
#
# A type error REPORTS but does not block, because the instruction ordered these:
# the app being up and testable is the goal, and being told what is broken is the
# other half. `--strict` swaps that round.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

API_PORT=3100
WEB_PORT=5173
PG_CONTAINER=astera-pg
LOG_DIR=.dev
LOG=$LOG_DIR/dev.log

do_build=1
strict=0
dist=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) do_build=0 ;;
    --strict) strict=1 ;;
    --dist) dist=1 ;;
    -h|--help)
      sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      echo
      echo "  --skip-build  no typecheck; straight to the database and the servers"
      echo "  --strict      a type error stops the bring-up instead of warning"
      echo "  --dist        also run the production web build (not used by :5173)"
      exit 0
      ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step_no=0
step() { step_no=$((step_no + 1)); printf '\n\033[1m[%d/7] %s\033[0m\n' "$step_no" "$1"; }
ok()   { printf '      \033[32m·\033[0m %s\n' "$1"; }
warn() { printf '      \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ── 1. the machine ──────────────────────────────────────────────────────────
step 'Checking the toolchain'

command -v docker >/dev/null || die 'docker is not installed; the dev database runs in it.'
docker compose version >/dev/null 2>&1 || die 'docker compose v2 is required.'
docker info >/dev/null 2>&1 || die 'the docker daemon is not running. Start it and try again.'
command -v pnpm >/dev/null || die 'pnpm is not installed (see packageManager in package.json).'
ok "docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?') · pnpm $(pnpm --version)"

node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [[ "$node_major" -lt 22 ]]; then
  warn "node $node_major is below the engines floor of 22; expect odd failures."
else
  ok "node $(node --version)"
fi

# THE PORTS, BEFORE ANYTHING IS STARTED. Vite has no `strictPort` in its config,
# so a taken :5173 does not fail — it quietly moves to :5174 and the instruction
# ("webserver 5173 portunda") is broken without a word being said. It is checked
# here AND `--strictPort` is passed below, so neither a stale process nor a config
# change can drift the port.
port_holder() {
  ss -ltnp 2>/dev/null | awk -v want=":$1\$" '$4 ~ want {print $NF; exit}'
}
for port in "$API_PORT" "$WEB_PORT"; do
  holder=$(port_holder "$port" || true)
  if [[ -n "$holder" ]]; then
    die "port $port is already taken by: $holder
  A previous run is probably still up. Stop it, then try again."
  fi
done
ok "ports $API_PORT and $WEB_PORT are free"

# ── 2. dependencies and configuration ───────────────────────────────────────
step 'Settling dependencies and .env'

if [[ ! -f .env ]]; then
  cp .env.example .env
  warn '.env did not exist; copied from .env.example. Read it before going further.'
else
  ok '.env present'
fi

# Reinstall when the lockfile has moved since the last install, which is what a
# `git pull` that adds a dependency looks like. `--frozen-lockfile` refuses to
# silently rewrite the lockfile behind the operator.
if [[ ! -d node_modules ]] || [[ pnpm-lock.yaml -nt node_modules/.modules.yaml ]]; then
  ok 'lockfile is newer than the install; running pnpm install'
  pnpm install --frozen-lockfile
else
  ok 'node_modules is current'
fi

# ── 3. the compile ──────────────────────────────────────────────────────────
step 'Building (typecheck across all four packages)'

type_errors=0
if [[ "$do_build" -eq 0 ]]; then
  warn 'skipped by --skip-build'
else
  if pnpm -s typecheck; then
    ok 'rules · sim · server · web — no type errors'
  else
    type_errors=1
    if [[ "$strict" -eq 1 ]]; then
      die 'type errors, and --strict was asked for.'
    fi
    warn 'TYPE ERRORS ABOVE. Starting anyway — tsx and vite strip types and will run.'
  fi

  if [[ "$dist" -eq 1 ]]; then
    pnpm --filter @astera/web build
    ok 'production web bundle built into apps/web/dist (the :5173 server does not use it)'
  fi
fi

# ── 4. the database ─────────────────────────────────────────────────────────
step 'Raising PostgreSQL'

docker compose -f docker-compose.yml up -d postgres >/dev/null
for _ in $(seq 1 60); do
  health=$(docker inspect "$PG_CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo starting)
  [[ "$health" == 'healthy' ]] && break
  sleep 1
done
[[ "${health:-}" == 'healthy' ]] || die "$PG_CONTAINER did not become healthy. docker logs $PG_CONTAINER"
ok "$PG_CONTAINER healthy on :5433"

# ── 5. migrations ───────────────────────────────────────────────────────────
step 'Applying migrations'

# The schema guard refuses to start a server whose code is ahead of the database,
# so this is a precondition rather than a convenience. Applying nothing is the
# normal answer and is not worth a line of its own.
pnpm -s --filter @astera/server season migrate
ok 'schema is current'

# ── 6. the world ────────────────────────────────────────────────────────────
step 'Opening the galaxies'

# Idempotent: an existing galaxy comes back as `already up`. A tmpfs database
# that has just been created has none, so this is what makes the very first
# request to /api/preview answer instead of 409 NO_FRONTIER.
pnpm -s --filter @astera/server season bootstrap
pnpm -s --filter @astera/server season status

# ── 7. the processes ────────────────────────────────────────────────────────
step 'Starting the API/worker and the client'

mkdir -p "$LOG_DIR"
: > "$LOG"

# TWO PROCESSES, STARTED SEPARATELY, and that is not a style choice. `pnpm
# --parallel … dev -- --strictPort` would hand the flag to BOTH scripts, and the
# API's is `tsx watch src/index.ts` — which has no idea what a strict port is.
# The flag belongs to vite alone, so vite is launched alone.
#
# EACH IN ITS OWN PROCESS GROUP, WHICH IS WHAT MAKES STOPPING WORK. `pnpm run`
# is a shell that spawns the real server as a grandchild, and a TERM to the shell
# does not reach it: the first version of this script left an orphaned `vite` and
# an orphaned `tsx` holding :5173 and :3100 after Ctrl-C, so the NEXT run refused
# with "port taken" — the one command turning into two. `setsid` makes each child
# a group leader, and `kill -TERM -PID` takes the whole group with it.
# STARTED INLINE, NEVER THROUGH `$(helper)`. A command substitution runs in a
# SUBSHELL, so a job backgrounded inside one is the subshell's child and not the
# script's — `wait` then answers "not my child" immediately, the script falls
# through to its own EXIT trap and tears down the servers it just raised. That is
# exactly what happened on the first attempt: banner, then instant SIGTERM.
setsid=''
command -v setsid >/dev/null && setsid=setsid

$setsid pnpm --filter @astera/server dev >>"$LOG" 2>&1 &
api_pid=$!
# `--strictPort` so a port that is taken is an ERROR rather than a silent move to
# :5174. Step 1 catches the ordinary case; this catches the race between them.
$setsid pnpm --filter @astera/web dev -- --strictPort --port "$WEB_PORT" >>"$LOG" 2>&1 &
web_pid=$!

stop_tree() {
  # The group first, the bare process second — the fallback path above has no
  # group of its own to kill.
  kill -TERM -"$1" 2>/dev/null || kill -TERM "$1" 2>/dev/null || true
}
cleanup() {
  trap - EXIT INT TERM
  stop_tree "$api_pid"
  stop_tree "$web_pid"
  wait "$api_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

fail_with_log() {
  echo
  tail -n 40 "$LOG" >&2
  die "$1 (full log: $LOG)"
}

api_healthy() {
  curl -sS --max-time 2 "http://127.0.0.1:$API_PORT/health" 2>/dev/null | grep -q '"ok":true'
}
web_answering() {
  curl -fsS --max-time 2 -o /dev/null "http://127.0.0.1:$WEB_PORT/" 2>/dev/null
}

printf '      waiting for :%s and :%s ' "$API_PORT" "$WEB_PORT"
api_up=0
web_up=0
for _ in $(seq 1 120); do
  # Each of these is its own `if`. Written as `a || b && c` the whole list can end
  # non-zero on the ordinary not-ready-yet answer, and `set -e` would take that
  # for a failure and exit the script mid-wait.
  kill -0 "$api_pid" 2>/dev/null || fail_with_log 'the API process exited during startup'
  kill -0 "$web_pid" 2>/dev/null || fail_with_log 'the client process exited during startup'
  if [[ "$api_up" -eq 0 ]] && api_healthy; then api_up=1; fi
  if [[ "$web_up" -eq 0 ]] && web_answering; then web_up=1; fi
  if [[ "$api_up" -eq 1 && "$web_up" -eq 1 ]]; then break; fi
  printf '.'
  sleep 1
done
echo
[[ "$api_up" -eq 1 ]] || fail_with_log "the API never reported healthy on :$API_PORT"
[[ "$web_up" -eq 1 ]] || fail_with_log "the client never answered on :$WEB_PORT"

lan=$(hostname -I 2>/dev/null | awk '{print $1}')
cat <<BANNER

  ────────────────────────────────────────────────────────
   ASTERA IS UP
     play        http://localhost:$WEB_PORT
$( [[ -n "$lan" ]] && printf '     on a phone  http://%s:%s\n' "$lan" "$WEB_PORT" )
     api/worker  http://localhost:$API_PORT/health   (SSE at /api/stream)
     database    postgres://astera:astera@localhost:5433/astera
     log         $LOG
$( [[ "$type_errors" -eq 1 ]] && printf '\n   \033[33mNOTE: the typecheck failed. The app is running; the errors are above.\033[0m\n' )
   Ctrl-C stops the API and the client. The database keeps running:
     docker compose stop postgres
  ────────────────────────────────────────────────────────

BANNER

# The two dev servers own the terminal from here, hot-reloading as files change.
tail -f -n 0 "$LOG" &
tail_pid=$!

# A poll rather than `wait -n "$api_pid" "$web_pid"`, whose PID arguments need
# bash 5.1. This holds the terminal on any bash, and it can say WHICH half went
# down instead of returning an anonymous status.
while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 2
done
kill "$tail_pid" 2>/dev/null || true
kill -0 "$api_pid" 2>/dev/null || warn "the API on :$API_PORT stopped. Tail: $LOG"
kill -0 "$web_pid" 2>/dev/null || warn "the client on :$WEB_PORT stopped. Tail: $LOG"
