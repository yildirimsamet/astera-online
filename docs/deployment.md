# Deployment

Production VPS: `ssh yildirim@hoofywood.com`

Astera Online is live at `https://asteraonline.space`. This is the production runbook: it
describes the topology that actually runs, the evidence required before opening it to players,
and the rollback boundary. It is deliberately not a release history.

> A green command is not a deploy. A deploy is the intended, pushed commit running on every
> process, against the intended schema, with the world still internally consistent and the
> public client serving the same release.

> **Downtime is a cost, not a ritual.** Nothing in the definition above requires the site to
> stop. Take a stop only when the release cannot be applied while serving, and say which rule
> forced it — the world is live and real people are in it. The rolling path still costs at most
> one failed request per replica; step 7 says why, and why it is not retried away.

> **AND A STOP IS NOT THE OPERATOR'S DECISION TO TAKE.** When step 6 finds a genuine stop
> condition, the deploy pauses there and the owner is asked, with the count of commanders
> mid-session in front of them, BEFORE anything is stopped or migrated. Rule 12.

## Current production contract

```
          443 ┌────────────────────────────────────────────────┐
   ───────────│ nginx on the host                              │
              │ / → static · /api → least_conn upstream       │
              └───────────────┬────────────────────────────────┘
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
          astera-api1-prod astera-api2-prod astera-api3-prod   ROLE=api
                 :3200            :3201            :3202
                    └─────────┼─────────┘
                              ▼
                    astera-postgres-prod              PostgreSQL 16
                              ▲
                              │
                    astera-worker-prod :3210          ROLE=worker

                    astera-valkey-prod                rate limits only
```

- There are exactly three stateless API replicas and exactly one worker. Never scale the worker
  casually: a second one buys no API capacity and duplicates housekeeping work.
- Every published application/database port is bound to `127.0.0.1`. Nginx is the only public
  entry point. The API replicas use 3200/3201/3202, worker health uses 3210 and PostgreSQL uses
  5545 on the host.
- The client and API use one origin. Refresh cookies are `SameSite=Lax`, requests use
  `credentials: 'same-origin'`, and there is no CORS. `api.`, `www.` and `socket.` redirect to
  the apex; realtime is SSE at `/api/stream`, not a separate socket service.
- PostgreSQL is the durable world and transactional event bus. Valkey contains only disposable,
  shared rate-limit counters. It is not a gameplay cache or source of truth.
- An API replica without its PostgreSQL `LISTEN` connection is not ready. The connection carries
  realtime events **and cache invalidations**; serving cached reads after missing an invalidation
  can return false world state. `/health` therefore returns 503 for `stream: not listening` on an
  API. The worker intentionally has no LISTEN socket, so that value is expected on port 3210.
- Production admits at most two live galaxies, each with 300 real-player seats, filled strictly
  in order. Each new galaxy also has 30 tier-1, 15 tier-2 and 6 tier-3 neutral worlds; those 51
  worlds do not consume player seats.
- The certified host budget assumes HoofyWood and Candely remain stopped. Astera deployment has
  no authority to delete their containers or volumes, and they must not be restarted casually
  while this capacity contract is in force.

The production Compose file is `docker-compose.prod.yml`. Never substitute `docker-compose.yml`:
that file is for development, uses tmpfs and has a trivial database password.

## Release rules

These are stop conditions, not suggestions.

1. **One immutable input.** Deploy a clean, pushed full commit SHA. The VPS HEAD,
   `origin/master`, OCI image revision, runtime metrics commit, all four application container
   image IDs, and the public web release marker must identify that same SHA.
2. **Build before downtime.** Build both the server image and web artifact before blocking
   traffic. A client build that begins after API restart can fail and leave a new API serving an
   old client.
3. **Prove rollback before mutation.** A dump that merely exists is not a rollback. Restore it
   into a disposable database and, when migrations exist, run the new image's migrations against
   that restored copy before touching production.
4. **A dump is only a rollback boundary if nothing wrote after it.** On the **quiesced path**
   that means blocking public writes, stopping every API and the worker, and only then taking
   the final dump: never restore a backup over a world that has accepted newer player writes.
   On the **rolling path** there is no such boundary to protect, because a release that applies
   no DDL never rolls the database back — it rolls the IMAGE and the WEBROOT back, and both are
   retained by rule 10. Rehearse the restore anyway (step 5): it is what proves the dump is
   complete and the data shape is valid.
5. **No process spans a migration it cannot survive.** An old worker can consume a newly
   backfilled event kind as unknown and complete it before the new worker sees it; an old
   replica can query a column a contraction has removed. That is what forces a stop — **not the
   mere existence of a migration.** Most DDL is EXPAND-ONLY (new tables, nullable columns,
   added enum values, dropped constraints, new indexes) and old code runs against it untouched,
   which is why `pendingMigrations` clamps at zero and an old image boots cleanly against a
   database AHEAD of its journal. Which kind this release is, is measured in step 5b against a
   restored copy — never assumed from the migration count in either direction.
6. **Migrate with the image that will run.** Migrations are an explicit one-off command, never an
   application startup side effect and never N replicas racing the same DDL.
7. **API before web, and never a mixed web artifact.** Validate the three APIs and singleton
   worker on the new image before publishing the already-built client. The public must never be
   able to request an `index.html` from one build and an asset directory from another. Stopping
   Nginx is one way to guarantee that and it is the right one when the files are replaced IN
   PLACE. Swapping a fully-built directory in by rename is another, and it closes the window
   without a stop: two renames on one filesystem, `index.html` and its assets moving together.
8. **Health is blocking.** All four `/health` documents must parse and have `.ok == true`. A 200
   from one route or a script printing `Deployed` is not evidence.
9. **A season transition is separate.** Shortening a deadline, freezing, recapping and rolling
   over the world are owner operations after a successful code deploy, never hidden inside it.
10. **Keep the way back.** Retain the previous image by ID, the previous webroot, the previous
    Nginx vhost and the verified final dump until the release has passed its observation window.
11. **Already-open clients are part of the release.** A phone can keep the previous JavaScript
    bundle alive across a deploy. Do not remove or rename an API route that bundle calls in the
    same release unless the server keeps a compatibility alias or the client has a tested
    version-mismatch reload path. A successful cold-browser smoke does not cover this case.
12. **Taking the world down requires the owner to say so, in advance.** If step 6 finds a real
    stop condition, the deploy STOPS THERE. Report which condition it is, how it was measured,
    and how many commanders are mid-session — that number is what the stop costs — and wait for
    an explicit decision before stopping Nginx, stopping any application role, or applying DDL
    to production. "The runbook said to" is not consent, and neither is an instruction to
    deploy: an operator told to ship has been told the destination, not the price. The rolling
    path needs no such approval, because it takes nothing away from anyone.

### Why `deploy/deploy.sh` is not the production path yet

Do not use `deploy/deploy.sh` for a live release. It is useful development scaffolding, but it
currently:

- hard-resets without first requiring the operator to review tracked and untracked VPS files;
- builds a mutable `astera-server` tag and records `unknown` unless
  `ASTERA_GIT_COMMIT` was supplied from outside;
- has no database backup or restore rehearsal;
- starts and exposes the new API before building the web client;
- reloads Nginx before internal acceptance;
- only warns when `.ok` is false and still prints `Deployed`;
- has no external smoke or public release-identity check; and
- permits an uncommitted working tree through `--local`.

Until those properties change, the manual fail-closed sequence below is canonical. Do not quote
the script's final line as proof of deployment.

## Production deploy, in order

The root `pnpm verify` and `pnpm lint` commands run type-aware ESLint with a 4 GB Node heap.
Use those root scripts during qualification; a bare `eslint .` falls back to Node's smaller
default heap and can fail for memory reasons without identifying an application regression.

### 1. Qualify the commit locally

```bash
git status --short
git fetch origin
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)"
pnpm verify
pnpm build
```

Review the complete diff, including migrations and documentation. If a public response shape
changed, its route must be covered in `apps/server/test/contract.test.ts`. Run the real-HTTP and
browser harnesses against an isolated scratch database, never production:

```bash
node tools/loop-check.mjs
node tools/movement.mjs
node tools/visual.mjs
```

Set higher `RATE_LIMIT_*` values only on that throwaway API if a harness would otherwise hit a
429. A production release starts only after the commit is pushed.

### 2. Inventory the VPS before changing it

```bash
ssh yildirim@hoofywood.com
cd ~/astera

git status --short
git fetch origin
release_sha="$(git rev-parse origin/master)"
printf 'release %s\n' "$release_sha"

docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
sudo ss -ltnp
df -h /
free -h
```

Review every VPS worktree entry. `.env` is intentionally untracked/ignored; an operator backup
such as `.env.bak.*` may also be present. Preserve them. Never use `git clean`, and never assume an
untracked file is disposable.

Before replacing the mutable server tag, retain the exact image currently running and record the
current runtime commit:

```bash
previous_commit="$(curl -fsS http://127.0.0.1:3200/metrics | jq -er '.service.commit')"
previous_image_id="$(docker inspect astera-api1-prod --format '{{.Image}}')"
docker tag "$previous_image_id" "astera-server:rollback-$previous_commit"
```

Also retain the public files and Nginx route. Use a unique timestamp and do not overwrite a prior
rollback copy:

```bash
rollback_stamp="$(date -u +%Y%m%d-%H%M%S)"
web_rollback="/var/www/astera-releases/pre-${release_sha:0:12}-$rollback_stamp"
nginx_rollback="/etc/nginx/sites-available/astera.pre-${release_sha:0:12}-$rollback_stamp"
sudo install -d -m 0755 /var/www/astera-releases
sudo cp -a /var/www/astera "$web_rollback"
sudo cp -a /etc/nginx/sites-available/astera "$nginx_rollback"
```

### 3. Reserve the certified host budget

Record the other stacks before stopping them. Use `stop`, never `down`; their volumes are outside
this release and must remain untouched.

```bash
docker ps --format '{{.Names}} {{.Status}}' > "$HOME/pre-astera-containers.txt"
(cd ~/candely && docker compose stop)
(cd ~/hoofywood && docker compose -f docker-compose.prod.yml stop)

cd ~/astera
./deploy/host-capacity-preflight.sh
```

The preflight is read-only and must report zero failures. It checks the 3 API + 1 worker topology,
memory ceilings, six-core/10-GiB/20-GiB host floors, PostgreSQL's 100-connection ceiling, container
and Nginx file limits, `worker_connections >= 8192`, and absence of HoofyWood or Candely containers
from the capacity budget.

The one-time Nginx host adjustment is:

```bash
./deploy/configure-capacity-host.sh
./deploy/host-capacity-preflight.sh
```

Do not run the mutating configurator routinely; the second command is the ordinary gate.

### 4. Pin the VPS checkout and build both artifacts

Only after the worktree inventory is understood:

```bash
git checkout master
git reset --hard "$release_sha"
test "$(git rev-parse HEAD)" = "$release_sha"

export ASTERA_GIT_COMMIT="$release_sha"
compose=(docker compose -f docker-compose.prod.yml)

"${compose[@]}" build api1
new_image_id="$(docker image inspect astera-server:latest --format '{{.Id}}')"
docker tag "$new_image_id" "astera-server:$release_sha"
test "$(docker image inspect astera-server:latest \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$release_sha"
```

Build the client to a private staging directory before downtime. `VITE_GA_ID` is inlined at build
time; changing it requires a rebuild, not a restart. The release marker makes the public artifact
auditable.

```bash
web_stage="$(mktemp -d "/tmp/astera-web-${release_sha:0:12}.XXXXXXXX")"
ga_id="$(sed -n 's/^VITE_GA_ID=//p' .env | tail -n 1)"

docker build --target web-dist \
  --build-arg "VITE_GA_ID=$ga_id" \
  --output "type=local,dest=$web_stage" .

test -f "$web_stage/index.html"
printf '%s\n' "$release_sha" > "$web_stage/release.txt"
find "$web_stage" -type f \
  \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' \
     -o -name '*.webmanifest' -o -name '*.html' \) \
  -size +1k -exec gzip -9 -k -f {} +
```

Do not delete `web_stage` until external acceptance succeeds.

### 5. Rehearse backup restore and migrations while production still serves

Ensure PostgreSQL and Valkey are healthy, create a fresh dump, validate its checksum, and restore
it into a disposable database:

```bash
"${compose[@]}" up -d postgres valkey
./deploy/backup.sh
backup_file=''
for candidate in "$HOME"/backups/astera-*.sql.gz; do
  [[ -e "$candidate" ]] || continue
  [[ -z "$backup_file" || "$candidate" -nt "$backup_file" ]] && backup_file="$candidate"
done
test -n "$backup_file"
chmod 600 "$backup_file"
gzip -t "$backup_file"
sha256sum "$backup_file" | tee "$backup_file.sha256"

restore_db="astera_restore_${release_sha:0:12}"
docker exec astera-postgres-prod createdb -U astera "$restore_db"
gunzip -c "$backup_file" | docker exec -i astera-postgres-prod \
  psql -v ON_ERROR_STOP=1 -U astera -d "$restore_db"
```

Compare release-relevant counts and invariants between `astera` and the restored database. At a
minimum inspect accounts, live seasons, players, missions and the migration journal; every
migration that backfills or contracts a column needs its own zero-null/assertion query.

Then prove the **new image** can migrate the restored production shape:

```bash
POSTGRES_DB="$restore_db" "${compose[@]}" run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate

docker exec astera-postgres-prod psql -v ON_ERROR_STOP=1 -U astera -d "$restore_db" -c \
  'select count(*) as applied_migrations from drizzle.__drizzle_migrations;'
```

This proves three different things: the dump is complete enough to restore, the old data shape is
valid, and the intended image can perform every pending migration. None can substitute for the
others.

#### 5b. Prove the OLD image survives the NEW schema — the measurement rule 5 needs

Keep the restored, now-migrated database and point the RETAINED image at it. **The schema guard
is one-way** — a new image refuses a database behind its journal, but nothing refuses an old image
a database ahead of it, and `pendingMigrations` clamps at zero precisely so an old replica keeps
booting. That clamp is what makes a rolling migration legal, and it is also what makes this test
the only evidence that the release is expand-only.

```bash
probe='astera-oldimage-probe'
net="$(docker inspect astera-api1-prod \
  --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
pgpw="$(sed -n 's/^POSTGRES_PASSWORD=//p' .env | tail -n 1)"

docker rm -f "$probe" 2>/dev/null || true
docker run -d --rm --name "$probe" --network "$net" -p 127.0.0.1:3399:3399 \
  -e "DATABASE_URL=postgres://astera:$pgpw@astera-postgres-prod:5432/$restore_db" \
  -e "JWT_SECRET=$(sed -n 's/^JWT_SECRET=//p' .env | tail -n 1)" \
  -e ROLE=api -e PORT=3399 \
  "astera-server:rollback-$previous_commit"

probe_health=''
for attempt in $(seq 1 60); do
  probe_health="$(curl -sS http://127.0.0.1:3399/health || true)"
  jq -e '.ok == true' <<< "$probe_health" >/dev/null 2>&1 && break
  sleep 1
done
jq -e '.ok == true' <<< "$probe_health" >/dev/null
docker logs "$probe" 2>&1 | rg -i 'error|migration|behind' || true
curl -sS -o /dev/null -w 'preview: %{http_code}\n' http://127.0.0.1:3399/api/preview
docker stop "$probe"
docker exec astera-postgres-prod dropdb -U astera --force "$restore_db"
```

Required: `.ok == true`, no migration complaint in the log, and `/api/preview` ANSWERS rather than
5xx — a 409 `NO_FRONTIER` on a restored copy with no open galaxy is a valid answer. Read the log
even when health is green: a boot that survived and a boot that was clean are different facts.

**If this passes, the DDL is expand-only and step 6's first row is false.** If it fails, old and
new code cannot both be live, the release forces a stop, and rule 12 applies before anything else
happens.

### 6. Decide whether this release needs a stop

Ask it once, in writing, and answer it from the release rather than from habit. **A stop is
forced only if one of these is true:**

| Forces a stop | How to check it, not guess it |
| --- | --- |
| The release applies DDL **that old code cannot survive** | TWO measurements, not one. Step 5 ran `migrate` against the restored shape with the NEW image: if the applied count did not move there is no DDL at all. If it moved, step 5b booted the OLD image against that migrated database and required `.ok == true`. Expand-only DDL passes and **does not force a stop**; a contraction — a dropped or renamed column, a narrowed type, a `NOT NULL` on something old code still writes empty — fails it and does |
| Old and new server code cannot both be live | A removed or reshaped API route, a changed event `kind`, a payload an old replica would reject. `git diff "$previous_commit..$release_sha" -- apps/server/src/routes \| rg '^-\s+app\.(get\|post\|put\|delete\|patch)'` finds a removed route; `git diff` on the `event_kind` enum finds a kind an old worker would meet as unknown. A NEW enum value that no live season can produce yet is not this |
| The worker must not process events under old code | Follows from a failed 5b or a new event `kind`; nothing else. A new `mission_kind` an old worker can never encounter — because the feature that creates it is gated off in every live season — is not this either |
| A data repair, backfill or season operation is part of the release | Rule 9 keeps season transitions out of a deploy; a repair is an owner operation with its own plan |

Two failure modes, and they are not symmetric. Reading "there is a migration, therefore stop" costs
real people their session for nothing. Reading "it will probably be fine" corrupts a live world.
5b is what turns both guesses into a measurement, and it costs one container and about a minute.

**If none is true, take the rolling path (step 7)** and skip step 8. It needs no approval: it takes
nothing away from anyone.

**If any is true, STOP AND ASK — RULE 12.** Do not continue into step 8 on an instruction to
deploy. Report, in one message: which row is true, the measurement that made it true, the
active-commander count from the snapshot below, and what the release actually delivers to those
players today. A feature gated behind a season boundary they will not reach for days is a very
different trade from a fix they are waiting on, and the person who owns the world is the one who
weighs it. Both paths converge on step 9.

Record what is live either way; the same snapshot is the after-comparison on both paths:

```bash
for port in 3200 3201 3202 3210; do
  curl -fsS "http://127.0.0.1:$port/health" | jq
done

docker exec astera-postgres-prod psql -U astera -d astera -tAc \
 "select (select count(*) from missions where status='in_flight') as missions,
         (select count(*) from mining_runs where status in ('outbound','returning')) as runs,
         (select count(*) from build_orders where status='BUILDING') as builds,
         (select count(*) from players where last_active_at > now() - interval '15 minutes') as active;"
```

That last column is a count of real people mid-session. It is the number a stop costs.

### 7. Rolling path — the default

Nginx balances `least_conn` across `127.0.0.1:3200/3201/3202` with `max_fails=2 fail_timeout=5s`,
so it routes around a replica that is restarting. Replace them **one at a time**, and require each
one healthy and reporting the release SHA before touching the next. Never roll two at once: two
down out of three is a capacity event even when it is not an outage.

```bash
new_image_id="$(docker image inspect astera-server:latest --format '{{.Id}}')"
export ASTERA_GIT_COMMIT="$release_sha"

roll() {
  local name="$1" port="$2" health=''
  docker compose -f docker-compose.prod.yml up -d --no-build --no-deps "$name"
  for attempt in $(seq 1 90); do
    health="$(curl -sS "http://127.0.0.1:$port/health" || true)"
    jq -e '.ok == true' <<< "$health" >/dev/null 2>&1 && break
    sleep 1
  done
  jq -e '.ok == true' <<< "$health" >/dev/null
  test "$(docker inspect "astera-${name}-prod" --format '{{.Image}}')" = "$new_image_id"
  test "$(curl -fsS "http://127.0.0.1:$port/metrics" | jq -er '.service.commit')" = "$release_sha"
  test "$(curl -sS -o /dev/null -w '%{http_code}' https://asteraonline.space/)" = 200
}

roll api1 3200 && sleep 3
roll api2 3201 && sleep 3
roll api3 3202 && sleep 3
roll worker 3210
```

**It is no-downtime, not no-error, and the difference is one request per replica.** Nginx OSS has
no active health check: it ejects an upstream only after `max_fails` failures inside
`fail_timeout`, so the first request to reach a replica in the instant between its container
stopping and nginx noticing gets a 502. Measured on the D117 release, which rolled three replicas
while 15 commanders were playing: exactly one 502, on a `POST /api/planets/:id/collect`.

That request cannot be retried for the player. `proxy_next_upstream` would replay it on a healthy
replica, but these are MUTATIONS and `request_log` is not wired into the write path yet — replaying
a collect or an order without an idempotency key is how one tap becomes two. So the honest
statement is: a rolling release costs at most one failed request per replica, the player sees an
error and taps again, and the fix is idempotency keys rather than a retry directive. Quiescing
does not avoid this either; it turns one failed request into several minutes of them.

The worker is a singleton, so it has a real gap of roughly ten to twenty seconds and there is no
way to roll it. That gap is not user-facing: a scheduled event is claimed with `SKIP LOCKED` and
simply runs that much late, which is the same lateness `WORKER_POLL_MS` already admits. Roll it
LAST, so the APIs are already answering on the new image when it comes back.

Then swap the client by rename rather than by copy. Stage on the SAME filesystem as the live root
or the rename is a copy and the window comes back:

```bash
sudo rm -rf /var/www/astera-next
sudo cp -a "$web_stage" /var/www/astera-next
sudo chown -R www-data:www-data /var/www/astera-next
sudo chmod -R a+rX /var/www/astera-next
test -f /var/www/astera-next/index.html
test "$(cat /var/www/astera-next/release.txt)" = "$release_sha"

sudo rm -rf /var/www/astera-previous
sudo mv /var/www/astera /var/www/astera-previous
sudo mv /var/www/astera-next  /var/www/astera
sudo systemctl reload nginx
```

`/var/www/astera-previous` is the rolling path's rule-10 webroot copy; keep it for the observation
window. The `reload` is not what publishes the files — Nginx stats the root per request — it is
there to drop any open descriptor on the directory that has just been moved aside.

If the vhost itself changed, install and validate it as in step 10 BEFORE the rename, and restore
the saved copy if `nginx -t` fails. A vhost that fails validation on the rolling path is a stop
condition: do not reload a broken configuration over a live site.

Skip step 8 entirely. Continue at step 9.

### 8. Quiesced path — when step 6 forced a stop

The step 6 snapshot is your before-picture. Stop Nginx first so no new mutation can enter, then
stop every application role gracefully. PostgreSQL and Valkey stay up.

```bash
sudo systemctl stop nginx
if sudo ss -ltnp | rg -q ':(80|443)\b'; then
  echo 'public listeners still exist; stop here' >&2
  exit 1
fi

"${compose[@]}" stop api1 api2 api3 worker
docker ps --format '{{.Names}}' | rg '^astera-(api|worker)' && {
  echo 'an application process still spans the migration' >&2
  exit 1
}
```

Trust the listener/process checks, not only a systemd label. A stopped Nginx unit can remain in a
`failed` state; `reset-failed` before the later start is harmless. An unexpected legacy or orphan
application container is a blocker until its image and purpose are identified.

#### 8b. Take the final quiesced backup and migrate production

The final dump is the rollback boundary because no newer player write can exist after it:

```bash
./deploy/backup.sh
final_backup=''
for candidate in "$HOME"/backups/astera-*.sql.gz; do
  [[ -e "$candidate" ]] || continue
  [[ -z "$final_backup" || "$candidate" -nt "$final_backup" ]] && final_backup="$candidate"
done
test -n "$final_backup"
chmod 600 "$final_backup"
gzip -t "$final_backup"
sha256sum "$final_backup" | tee "$final_backup.sha256"
```

For a schema-changing release, restore this exact final dump to the disposable database and run
the migration rehearsal once more. The database is small; the extra downtime is cheaper than
discovering that the only rollback artifact differs from the one tested before quiescence.

```bash
final_restore_db="astera_final_restore_${release_sha:0:10}"
docker exec astera-postgres-prod createdb -U astera "$final_restore_db"
gunzip -c "$final_backup" | docker exec -i astera-postgres-prod \
  psql -v ON_ERROR_STOP=1 -U astera -d "$final_restore_db"
POSTGRES_DB="$final_restore_db" "${compose[@]}" run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate
docker exec astera-postgres-prod psql -v ON_ERROR_STOP=1 -U astera \
  -d "$final_restore_db" -c \
  'select count(*) as applied_migrations from drizzle.__drizzle_migrations;'
docker exec astera-postgres-prod dropdb -U astera --force "$final_restore_db"
```

Apply migrations to production only after that succeeds:

```bash
"${compose[@]}" run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate
```

Run the release-specific post-migration assertions now. A migration command returning zero proves
that its SQL committed; it does not prove a backfill selected every intended row.

#### 8c. Start the exact image

On the rolling path this already happened in step 7; go to step 9.

```bash
"${compose[@]}" up -d --no-build worker api1 api2 api3

for container in astera-api1-prod astera-api2-prod astera-api3-prod astera-worker-prod; do
  test "$(docker inspect "$container" --format '{{.Image}}')" = "$new_image_id"
done

for port in 3200 3201 3202 3210; do
  health=''
  for attempt in $(seq 1 60); do
    health="$(curl -sS "http://127.0.0.1:$port/health" || true)"
    jq -e '.ok == true' <<< "$health" >/dev/null 2>&1 && break
    sleep 1
  done
  jq -e '.ok == true' <<< "$health" >/dev/null
  jq . <<< "$health"
done

for port in 3200 3201 3202 3210; do
  test "$(curl -fsS "http://127.0.0.1:$port/metrics" | jq -er '.service.commit')" \
    = "$release_sha"
done
```

### 9. Require internal acceptance — BOTH PATHS

Expected health contract:

| Process | Required |
| --- | --- |
| API 3200/3201/3202 | `.ok=true`, database/queue/stream `ok`, shared rate limiter `ready` |
| Worker 3210 | `.ok=true`, queue `ok`, `stream="not listening"`, `unknownEvents=0` |
| All four | Same image ID and full runtime commit |

Also require zero failed events and no overdue state before exposing traffic:

```bash
docker exec astera-postgres-prod psql -v ON_ERROR_STOP=1 -U astera -d astera -c \
 "select status, count(*) from scheduled_events group by status order by status;
  select count(*) as overdue_missions
    from missions where status='in_flight' and arrive_at < now() - interval '2 minutes';"
```

`processing` may be a claim interrupted by a stop or by the worker roll, and should return through
the reaper; do not hide it with a restart. `failed`, a growing queue lag, stranded state or an
unknown worker event is a stop and investigation, not an automatic restart condition.

### 10. Install Nginx, publish web, then reopen traffic — QUIESCED PATH ONLY

The rolling path published its client by rename in step 7 and never stopped Nginx. This section is
the in-place replacement, which is why it requires Nginx to be down.

Install the repository vhost and validate the whole host configuration. Restore the saved vhost
if validation fails. Pre-existing warnings must be understood; an unexpected warning is not
automatically safe merely because `nginx -t` exits zero.

```bash
sudo install -o root -g root -m 0644 deploy/nginx/astera.conf \
  /etc/nginx/sites-available/astera
if ! sudo nginx -t; then
  sudo cp -a "$nginx_rollback" /etc/nginx/sites-available/astera
  sudo nginx -t
  exit 1
fi

sudo rsync -a --delete-delay --delay-updates --chmod=D755,F644 \
  "$web_stage"/ /var/www/astera/
sudo chown -R www-data:www-data /var/www/astera

sudo systemctl reset-failed nginx
sudo systemctl start nginx
sudo systemctl is-active --quiet nginx
```

Nginx remains stopped throughout the file replacement, so the public cannot request an
`index.html` from one build and an asset directory from another. `--chmod=D755,F644` is required:
Docker's local output can leave the staging root mode 0700, while Nginx runs as `www-data`.

### 11. Prove the release from outside — BOTH PATHS

```bash
test "$(curl -fsS -H 'Cache-Control: no-cache' \
  https://asteraonline.space/release.txt)" = "$release_sha"

curl -fsS https://asteraonline.space/ \
  | rg -o 'index-[A-Za-z0-9_-]+\.js'
curl -fsS -D - -o /dev/null https://asteraonline.space/api/preview \
  | rg -i '^x-server-time:'
curl -fsS https://asteraonline.space/api/servers | jq
```

`/api/preview` must remain write-free and take no seat. Do not create a test account in a live
galaxy. Without `x-server-time`, phones fall back to their device clock and draw movement at
different instants.

Finally rerun internal health, queue/overdue checks, `host-capacity-preflight.sh`, database
connection metrics, and the live-shard query below. Compare the in-flight/build counts with the
step 6 snapshot. On the rolling path they should be higher, not equal: the world kept running,
and a set of counts that did NOT move while players were active is itself worth investigating. Remove only obsolete **stateless** containers after all checks pass; retain the
old image, web copy, Nginx copy and final dump.

Also inspect the first observation window by status, route and client rather than looking only for
5xx. In particular, a cluster of 404s on routes that existed in the previous client means an
already-open tab is running against the new API. `NO_PLANET` responses concentrated at a season
rollover are expected, but route-not-found responses from an old bundle are a compatibility bug.
Do not dismiss all 4xx as player mistakes.

```bash
sudo awk '$7 ~ /^\/api\// {status[$9]++} END {for (s in status) print s, status[s]}' \
  /var/log/nginx/access.log | sort -n

sudo awk '$7 ~ /^\/api\// && $9 == 404 {key=$1 " " $6 " " $7; count[key]++} \
  END {for (k in count) print count[k], k}' /var/log/nginx/access.log | sort -nr
```

The deployment is complete only at this point. The season remains untouched.

The staging directory was created by the explicit `mktemp` command above and can now be removed:

```bash
rm -rf -- "$web_stage"
```

## Live galaxy acceptance

This query verifies the capacity contract directly rather than inferring it from a healthy API:

```sql
SELECT sh.ordinal,
       sh.code,
       sh.player_cap,
       s.id AS season_id,
       s.ruleset_version,
       count(DISTINCT p.id) FILTER (WHERE p.kind = 'CAPITAL') AS capitals,
       count(DISTINCT p.id) FILTER (WHERE p.kind = 'NEUTRAL') AS neutrals,
       count(DISTINCT n.planet_id) FILTER (WHERE n.tier = 1) AS tier1,
       count(DISTINCT n.planet_id) FILTER (WHERE n.tier = 2) AS tier2,
       count(DISTINCT n.planet_id) FILTER (WHERE n.tier = 3) AS tier3
  FROM shards sh
  JOIN seasons s ON s.shard_id = sh.id AND s.status = 'live'
  LEFT JOIN planets p ON p.season_id = s.id
  LEFT JOIN neutral_planet_state n ON n.planet_id = p.id
 GROUP BY sh.ordinal, sh.code, sh.player_cap, s.id, s.ruleset_version
 ORDER BY sh.ordinal;
```

Required: exactly two rows, ordinals 1 and 2; and `player_cap=300` on both.

**The 51 / 30 / 15 / 6 pool is a SEEDING fact, not a standing one, and only a galaxy nobody has
settled still shows it.** A settlement captures a neutral world: the row becomes a `COLONY`, its
`neutral_planet_state` is detached, and the neutral count falls by one for the rest of the season.
Requiring 51 on a played galaxy fails every deploy into a world where the game has happened. What
must hold is the CONSERVATION — measured, not eyeballed:

```sql
SELECT sh.code, p.kind, count(*) AS worlds,
       count(*) FILTER (WHERE p.player_id IS NOT NULL) AS controlled
  FROM shards sh
  JOIN seasons s ON s.shard_id = sh.id AND s.status = 'live'
  JOIN planets p ON p.season_id = s.id
 GROUP BY sh.code, p.kind ORDER BY sh.code, p.kind;

SELECT count(*) AS orphaned_neutral_state
  FROM neutral_planet_state n JOIN planets p ON p.id = n.planet_id
 WHERE p.kind <> 'NEUTRAL';
```

Require `neutrals + colonies = 51` per live shard, every `CAPITAL` and `COLONY` controlled, every
`NEUTRAL` uncontrolled, and `orphaned_neutral_state = 0`. A fresh galaxy satisfies it at 51/0; a
played one at, say, 28/23. A pool that does NOT add to 51 is a world that has lost or gained a
planet, which is the failure the flat count was reaching for and never actually tested.

`ruleset_version` is whatever `MULTI_WORLD.rulesetVersion` was in the code that CREATED the season,
so it is a fact about the galaxy's birthday rather than an acceptance constant. Seasons opened
before D114 are `2` and stay `2` for their whole life; every season opened by a rollover on D114 or
later is `3`, and that is the boundary the clan feature begins at — `assertClanRuleset` answers
`CLANS_NEXT_SEASON` below it. A deploy therefore does not switch clans on: the rollover that
follows it does. Require the version to match the code that opened the row, and expect a mixed
pair across a rollover. Capital count is the current real population,
not a fixed acceptance value. `/api/servers` must show only the lowest non-full ordinal as `open`;
the next remains `locked` until the frontier fills.

## Manual five-minute season cutoff

This is a separate, explicitly authorized owner operation. It was exercised successfully in
production: active fleets/builds were allowed to settle, late galaxies deferred their freeze, and
rollover waited until every live galaxy was frozen before atomically opening two successors.

Do not use `season wipe --yes` for the normal lifecycle; that skips the scheduled deadline and
afterglow. Do not reuse the one-off legacy ten-galaxy insert from the capacity cutover. Current
seasons already have one `season_end` and one `season_rollover` event each, so shorten those rows
in place.

Take a fresh backup first. Confirm the current code still uses a 5-minute afterglow, then run the
following interactively. It fails unless exactly two live seasons and exactly one pending end and
rollover event per season exist:

```sql
BEGIN;

DO $cutoff$
DECLARE
  live_ids uuid[];
  cutoff_at timestamptz := clock_timestamp() + interval '5 minutes';
  rollover_at timestamptz;
  affected integer;
BEGIN
  rollover_at := cutoff_at + interval '5 minutes';

  SELECT array_agg(id ORDER BY id)
    INTO live_ids
    FROM (
      SELECT id
        FROM seasons
       WHERE status = 'live'
       ORDER BY id
       FOR UPDATE
    ) locked;

  IF coalesce(cardinality(live_ids), 0) <> 2 THEN
    RAISE EXCEPTION 'expected exactly 2 live seasons, found %',
      coalesce(cardinality(live_ids), 0);
  END IF;

  SELECT count(*)
    INTO affected
    FROM scheduled_events
   WHERE season_id = ANY(live_ids)
     AND kind IN ('season_end', 'season_rollover')
     AND status = 'pending';

  IF affected <> 4 THEN
    RAISE EXCEPTION 'expected 4 pending lifecycle events, found %', affected;
  END IF;

  SELECT count(*)
    INTO affected
    FROM scheduled_events
   WHERE season_id = ANY(live_ids)
     AND kind IN ('season_end', 'season_rollover');

  IF affected <> 4 THEN
    RAISE EXCEPTION 'duplicate/non-pending lifecycle events exist: % total', affected;
  END IF;

  UPDATE seasons
     SET ends_at = cutoff_at
   WHERE id = ANY(live_ids);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 2 THEN
    RAISE EXCEPTION 'updated % seasons, expected 2', affected;
  END IF;

  UPDATE scheduled_events
     SET resolve_at = CASE kind
       WHEN 'season_end' THEN cutoff_at
       ELSE rollover_at
     END
   WHERE season_id = ANY(live_ids)
     AND kind IN ('season_end', 'season_rollover')
     AND status = 'pending';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 4 THEN
    RAISE EXCEPTION 'updated % lifecycle events, expected 4', affected;
  END IF;
END
$cutoff$;

SELECT s.id, s.status, s.ends_at, e.kind, e.status, e.resolve_at
  FROM seasons s
  JOIN scheduled_events e ON e.season_id = s.id
 WHERE s.status = 'live'
   AND e.kind IN ('season_end', 'season_rollover')
 ORDER BY s.id, e.resolve_at;

COMMIT;
```

After the cutoff, watch all four health endpoints and lifecycle events. A season may remain `live`
past `ends_at` while a committed mission, mining run, build or strategic build finishes; the
worker retries the freeze every second. Rollover likewise retries until all live seasons are
frozen. Never delete that work to force the deadline.

After rollover require: two new live v2 seasons; old seasons `wiped`; no live missions/builds from
the old world; no failed/processing lifecycle events; one pending end, one pending rollover and
the expected season-act events per successor; and the 300 + 30/15/6 query above. Account identity
and season results survive; disposable player/world rows do not.

## Rollback

The schema guard is **one-way**: a new image refuses to start when the database is behind its
migration journal. It does not prove that an old image is safe against a newer database. Never
assume a previous container will reject an incompatible forward schema.

- **A rolling release, which by definition applied no DDL:** the database was never touched, so
  the rollback is the image and the client and nothing else. Retag the retained
  `astera-server:rollback-$previous_commit` as `astera-server:latest`, roll the four containers
  back one at a time exactly as step 7 rolled them forward, then rename
  `/var/www/astera-previous` back over `/var/www/astera` and reload Nginx. It costs no downtime
  either, and it is the reason the rolling path keeps a previous webroot under its own name
  rather than under the timestamped `/var/www/astera-releases/` copy taken in step 2. Both exist;
  either will do.
- **Before migrations:** retag/restart the retained old image and restore the prior web/Nginx
  files. The database has not changed.
- **After migration but before public traffic:** keep Nginx stopped, stop new processes, recreate
  the production database from the verified final dump, retag the retained image as
  `astera-server:latest`, start the old topology, restore web/Nginx, then run full acceptance.
- **After new writes were accepted:** restoring the pre-release dump discards player decisions.
  Prefer a forward fix or a migration-compatible code revert. A destructive restore requires an
  explicit owner decision about the lost interval.

Never rewrite Git history on the VPS. For a code-only failure, revert forward in Git, push, and
deploy that new SHA through the same gates. Do not prune rollback images or dumps in the same
session that created them.

## Capacity qualification

Capacity qualification is not a production smoke test. Run it against the isolated fixture; the
tool refuses production database names/origins. A normal deploy does not become a 600-player
capacity result merely because four health endpoints are green.

```bash
CAPACITY_PASSWORD='<staging-only-secret>' ./deploy/capacity.sh 300 99300

CAPACITY_PASSWORD='<staging-only-secret>' pnpm capacity:test -- \
  --database-url postgres://astera_capacity:capacity_only@127.0.0.1:5645/astera_capacity \
  --base-urls http://127.0.0.1:3380 \
  --login-base-urls http://127.0.0.1:3300,http://127.0.0.1:3301,http://127.0.0.1:3302 \
  --metrics-urls http://127.0.0.1:3300/metrics,http://127.0.0.1:3301/metrics,http://127.0.0.1:3302/metrics,http://127.0.0.1:3310/metrics \
  --users 300 --connections 300 --scenario normal --duration-seconds 3600 \
  --report artifacts/capacity/normal-300-60m.json

CAPACITY_PASSWORD='<staging-only-secret>' ./deploy/capacity.sh 600 99600

CAPACITY_PASSWORD='<staging-only-secret>' pnpm capacity:test -- \
  --database-url postgres://astera_capacity:capacity_only@127.0.0.1:5645/astera_capacity \
  --base-urls http://127.0.0.1:3380 \
  --login-base-urls http://127.0.0.1:3300,http://127.0.0.1:3301,http://127.0.0.1:3302 \
  --metrics-urls http://127.0.0.1:3300/metrics,http://127.0.0.1:3301/metrics,http://127.0.0.1:3302/metrics,http://127.0.0.1:3310/metrics \
  --users 600 --connections 600 --scenario normal --duration-seconds 3600 \
  --wave-launches 100 --reconnect-at-seconds 1200 \
  --report artifacts/capacity/normal-600-60m.json

CAPACITY_PASSWORD='<staging-only-secret>' pnpm capacity:test -- \
  --database-url postgres://astera_capacity:capacity_only@127.0.0.1:5645/astera_capacity \
  --base-urls http://127.0.0.1:3380 \
  --login-base-urls http://127.0.0.1:3300,http://127.0.0.1:3301,http://127.0.0.1:3302 \
  --metrics-urls http://127.0.0.1:3300/metrics,http://127.0.0.1:3301/metrics,http://127.0.0.1:3302/metrics,http://127.0.0.1:3310/metrics \
  --users 600 --connections 750 --scenario quiet --duration-seconds 600 \
  --report artifacts/capacity/overflow-750-10m.json
```

A report is invalid unless the worktree is clean; HEAD, OCI revision, runtime commit and all four
container image IDs agree; exactly 3 API + 1 worker is observed; every requested metrics endpoint
and client schema parses; semantic samples are non-zero; and host, database reconciliation,
rate-limit, LISTEN/cache and queue gates pass. This is what prevents an HTTP-only tool from
incorrectly printing success.

`capacity:client` is a headed 390×844 hardware-GPU diagnostic, not Android proof. Headless
Chromium normally uses SwiftShader, so its frame result is not an acceptance signal.

## First install

```bash
git clone git@github.com:yildirimsamet/astera-online.git ~/astera
cd ~/astera
cp .env.production.example .env
chmod 600 .env
```

Fill `POSTGRES_PASSWORD` and `JWT_SECRET`, set the loopback ports, and optionally set
`VITE_GA_ID`. Rotating `JWT_SECRET` signs every player out.

Start durable dependencies, build the pinned image, migrate, and bootstrap exactly two empty
galaxies. `bootstrap` takes no arguments in production; `--unattended` is development-only.

```bash
export ASTERA_GIT_COMMIT="$(git rev-parse HEAD)"
compose=(docker compose -f docker-compose.prod.yml)
"${compose[@]}" up -d postgres valkey
"${compose[@]}" build api1
"${compose[@]}" run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate
"${compose[@]}" run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts bootstrap
"${compose[@]}" up -d worker api1 api2 api3
```

Then build/publish the web artifact and run internal plus external acceptance using steps 4 and
8–10 above. A first install has no rollback copy, which makes its backup and acceptance gates more
important, not less.

The TLS certificate must exist before enabling the 443 vhost:

```bash
sudo certbot certonly --webroot -w /var/www/html \
  -d asteraonline.space -d www.asteraonline.space \
  -d api.asteraonline.space -d socket.asteraonline.space
sudo install -o root -g root -m 0644 deploy/nginx/astera.conf \
  /etc/nginx/sites-available/astera
sudo ln -s /etc/nginx/sites-available/astera /etc/nginx/sites-enabled/astera
sudo nginx -t && sudo systemctl reload nginx
```

Certbot renewal needs a deploy hook that reloads Nginx after writing a new certificate. Verify it
with `sudo certbot renew --cert-name asteraonline.space --dry-run`.

## Routine operations

Health, logs and season status:

```bash
cd ~/astera
for port in 3200 3201 3202 3210; do curl -fsS "localhost:$port/health" | jq; done
docker compose -f docker-compose.prod.yml logs -f api1 api2 api3 worker
docker compose -f docker-compose.prod.yml run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts status
```

Nightly backup, retaining the last fourteen dumps:

```bash
./deploy/backup.sh
```

```cron
17 3 * * * cd /home/yildirim/astera && ./deploy/backup.sh >> /home/yildirim/backups/astera-backup.log 2>&1
```

Grant the hand-checked @JoinAstera reward by exact, case-sensitive public display name. The command
is idempotent and only unlocks the grant; the player claims it in the rewards panel. The old
`astera-api-prod` container no longer exists.

It is idempotent ACROSS SEASONS as well (D104): the grant is written against the account, so a
commander paid in an earlier galaxy is reported as already holding it, and one who is between
galaxies with no world at all can still be granted it ready for the next.

```bash
# On the VPS:
docker compose -f docker-compose.prod.yml exec api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts reward 'WARRIOR'

# From another machine over SSH (no pseudo-TTY):
ssh yildirim@hoofywood.com \
  "cd ~/astera && docker compose -f docker-compose.prod.yml exec -T api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts reward 'WARRIOR'"
```

## Remaining operational gaps

- `deploy/deploy.sh` is not a production release gate; the manual sequence remains canonical.
- There is no external alerting or paging for `/health`, queue failure, LISTEN/cache invalidation
  loss, Valkey readiness or unknown worker events.
- There is no explicit client/API version handshake or forced-reload path. Until one exists,
  breaking route changes require a one-release compatibility window for already-open tabs.
- The five-minute cutoff is production-rehearsed but remains an explicit SQL owner operation; it
  is not a first-class fail-closed CLI command.
- Capacity soak is an isolated, long-running qualification and is not part of the ordinary deploy
  sequence. Rerun it before claiming a new capacity result after a capacity-sensitive change.
