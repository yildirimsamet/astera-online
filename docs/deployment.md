# Astera Online — Production deployment

Production: `https://asteraonline.space` · VPS: `ssh yildirim@hoofywood.com` · checkout: `~/astera`.
Use `docker-compose.prod.yml` only. The development Compose uses tmpfs and an unsuitable database password.

This compact runbook consolidates the supplied notes through 10 October 2026. Inspection and rehearsal records are point-in-time evidence, not proof that a release is deployed. Refresh the actual SHA, migration journal, flags and live shards before each release. Repository-relative links below refer to supporting files in the project.

### 15 October radiation bombs: prepared, not deployed

The current local implementation adds migration `0166_radiation_bomb` and the
read index `0168_radiation_source_read_index`, and history retention migration
`0169_radiation_history_retention`; keep the complete intervening
migration journal, including changes belonging to other tasks. Do not renumber
the already deployed prefix. The synthetic 153→170 migration rehearsal and
same-season activation evidence are recorded in
[the radiation bomb review](radiation-bomb-review-2026-10-15.md).

Publish compatible API, worker and web builds together before activation and
refresh already open browser sessions. Old code does not understand the new
strategic inventory, event and notification enum values. The release also needs
the manual-maintenance implementation: damaged ships remain in their hangars,
and radiation cancels paid repair work with its original invoice fully refunded.
Retain a verified private backup and a compatible rollback image as described
below; no production activation has been performed as part of implementation.

For an existing live HP-radiation season, entity radiation/moving monuments must
already be active. After the coordinated migration and image update, preview
the intended shard; apply only as part of an authorized release:

```bash
pnpm season activate-radiation-bombs --shard CODE
pnpm season activate-radiation-bombs --shard CODE --yes
```

Preview writes nothing. Activation preserves the season ruleset and previous
source history, starts home/dock/support exposure and the combined 50 HP/min cap
at a single new epoch, and refunds only repairs at currently irradiated worlds.
There is no retroactive home damage. A shelter that removes actual exposure
keeps its repairs running. Retrying returns `ALREADY_ACTIVE`, without another
refund or epoch reset. New current-ruleset seasons activate automatically.
Once new bomb data exists, rollback must understand that data; clearing the
epoch or starting an old worker is not a supported rollback.

The separate joint-war assembly-pool radiation policy is awaiting the owner's
answer; defence support is already included. Resolve that gameplay decision and
finish the review's remaining regression gates before calling the release ready.

### 13 October tempo: coordinated same-season release

Migration `0155_tempo_slowdown` adds a separate tempo epoch; it does not raise an
existing season's ruleset. New seasons use the reduced tempo immediately. Preserve
every historical NPC row, earned resource and committed player flight/queue timestamp.

The fleet and NPC speed constants change with the image, so **do not roll API/worker
versions while NPC raids or merchant convoys are active**. Rehearse the preview from
the new build against a migrated database copy and the intended shard. In production,
block new launches through maintenance and let the old worker finish both outbound and
returning pirate raids/trade runs. Then stop every API and worker writer before
migrating and applying the cutover. Keep maintenance active during the image switch.

```bash
pnpm season migrate
pnpm season activate-tempo-slowdown --shard CODE
pnpm season activate-tempo-slowdown --shard CODE --yes
```

In a rehearsal copy the new schema is needed before preview. In production migrate
with old writers stopped, preview again, and apply while the galaxy is idle. If the
final preview says `BUSY`, do not start the new API/worker yet; preserve those runs and
complete them with the compatible old worker, keeping new launches blocked, before
retrying. A refused activation writes nothing. The exclusive season lock closes the
check/dispatch race.

The epoch retires pirate contacts that appeared before activation and cancels the
current merchant appearance for new dispatch; the next scheduled window and subsequent
pirates use their `20%` slower orbits. NPC history is retained. The production lazy tick
uses old output before the epoch and new output afterwards, retaining outage, recovery
and leak accounting. Store/Works capacities and accumulated resources are preserved.
Vault leakage also slows `20%` after the epoch, preserving its ratio to production;
pre-cutover leakage retains its previous rate and the total leak budget stays unchanged.
The work rate falls `20%` (`×1.25` duration), including colony repair crews; Beacon grants
`20%` speed. Existing paid orders retain their committed completion timestamps.

Start only the updated API/worker and publish the matching web build. Refresh open
clients so quotes and satellite descriptions use the new values. Repeat activation
returns `ALREADY_ACTIVE` and never resets the epoch. After activation, rollback requires
restoring a compatible database snapshot or code that understands this boundary.

### 12 October monuments: idle same-season motion activation

Migration `0153_monument_motion_fuel` adds a separate motion epoch and per-ship fuel
escrow. Update every API and worker before enabling motion. While all monuments are
idle, preview `pnpm season activate-monument-motion --shard CODE`; apply with `--yes`
only in the authorized release. The transaction also rejects outbound/returning
fleets, probes and open monument clan preparations. It preserves season rules,
target IDs and initial coordinates; retries do not reset the phase. Once moving
missions exist, deleting the epoch or rolling back to static routing is unsupported.
See the [implementation and activation plan](moving-monuments-two-axis-plan-2026-10-12.md)
and [review evidence](moving-monuments-code-review-2026-10-12.md).

### 12 October radiation shielding: explicit idle-season calibration

**Prepared, not deployed or activated.** Migration `0154_monument_radiation_shielding`
adds a separate radiation cutover timestamp and explicit source levels. It tags only
authored historical Easy/Hard base sources; their rates and time windows do not change.
New v18 seasons use level 1 = 9 and level 2 = 12.5 HP/min. Existing live seasons retain
their rates and cannot buy shielding until the explicit cutover below.

Stop workers for the coordinated migration/API update, then start only compatible
workers. Do not create/roll over v18 seasons or activate shielding while an old API
or worker remains. A legacy base source seeded by an old image after migration is
recognized by its exact authored label and original 2/5 rate; arbitrary emitters
are not inferred from intensity alone.

Update all API and worker roles before activation. Adopt the Easy/Hard layout and
activate monument motion first if needed. With every monument idle, preview and
then apply **only in a separately authorized release**:

Publish the compatible web build before activation and refresh existing browser
sessions. The pre-release client has a strict research-ID enum and cannot parse
the new `RADIATION_SHIELDING` row or a wave snapshot carrying it. This feature does
not add a global forced-client-update protocol; publishing assets alone does not
replace JavaScript already running in an open tab. Include that refresh boundary
in the coordinated release before opening the research.

```bash
pnpm season activate-monument-radiation --shard CODE
pnpm season activate-monument-radiation --shard CODE --yes
```

The exclusive season lock serializes new launches with the idle check. OUTBOUND,
HOLD and RETURNING monument fleets, travelling probes and ASSEMBLING/ATTACKING/RETURNING
monument clan operations all block activation. `BUSY` writes nothing; never clear
blockers manually. Missing/duplicate/mislevelled base sources refuse activation.
Custom unlevelled emitters and shelters are preserved. On success, old base sources
end at the cutover, new calibrated sources start then, and the research opens in the
same transaction. Repeat runs return `ALREADY_ACTIVE`. Season rules, motion epoch,
target identities, ownership, production (3/8 D/min), fuel contracts and history remain.

Shielding has four levels, requires capital Core 3 and uses the existing commander
research queue. Every dispatch freezes its own level; an existing garrison is never
upgraded mid-stay. After activation or v18 creation, do not remove the cutover timestamp
or run an image that lacks shielding settlement/prediction and the new research ID.
Rehearse restore and cutover on a copy before the authorized release.

### 12 October Aegis: same-season charge and price cutover

Migration `0152_aegis_balance` preserves existing fill ratios and historical
investment while adopting level-1 150 HP, +50% capacity and +60% upgrade cost per
level. All old API/worker writers must be drained before migration; an old writer
would clamp converted charge to the previous maximum. This requires a coordinated
cutover, not a mixed-version roll. Queue invoices/deadlines remain unchanged.
Follow the [Aegis release sequence and rollback limits](aegis-balance-2026-10-12.md)
and the release gates below. No season reset or production deployment is performed
by the repository change.

### 12 October PvE balance: same-season compatibility roll

This change adopts the balance through **new hour snapshots**; it needs no season reset or ruleset bump.
Do not rewrite old hours, pirate handles, rosters, hoards, asteroid ore or flight deadlines.

1. Rehearse `0150_pirate_reward_ledger` on an isolated restore. Retain the normal verified backup/image/webroot.
2. Set `PIRATE_BALANCE_V2_ENABLED=false` for all API and worker processes for the compatibility roll.
3. Stop and drain **every old settlement worker** before migration/backfill. Its old payout code would not update
   the new ledger. The migration totals the hoard loaded in battle reports, excluding salvage and captured ships;
   reports preserve loads lost later in return radiation. Do not claw back historical resources.
4. Apply migration; roll all APIs and the single worker to code that understands optional pirate v2 inputs.
   Start the updated worker with the flag still false. Verify API health, queue settlement and identified pirate
   `hoard`/`lootPaid` responses. Older clients accept the added fields; newer clients keep missing reward data unknown.
5. After every process understands v2, set the flag true and recreate the worker/API containers with that environment.
   The **next unopened hour** adopts armed-only pirate crews and the new payout profile. Reopening an existing hour
   remains a no-op. Old API images reject the new stored lane key, so do not expose v2 hours before step 4 is complete.
6. New asteroid hours use 400/800/1200/1600/2000 total ore, 1–2 hour lives and 12–28% isotope D.
   Older snapshots keep their previous values. Retain the twelve-hour read window through the transition.

After the ledger migration, settlement-worker rollback must already retain the ledger-aware payout code:
an older worker neither reads nor updates `loot_paid`, even while the v2 generation flag is false.
After activation, API rollback must also understand stored v2 snapshots. Retain the compatible image.
Turning the flag off affects future hours only; it does not make an older parser compatible with already stored v2 rows.
No production deployment is claimed by this repository change. Evidence/checks: [PvE task record](pve-rebalance-2026-10-12.md).

## 1. Production contract and non-negotiable gates

| Component | Contract |
| --- | --- |
| Nginx | Only public entry; `/` static, `/api` least-connection balancing |
| APIs | Exactly `astera-api1-prod`, `astera-api2-prod`, `astera-api3-prod`; host ports 3200/3201/3202 |
| Worker | Exactly one `astera-worker-prod`; health port 3210; do not scale casually |
| PostgreSQL 16 | `astera-postgres-prod`, host port 5545; durable world and transactional event bus |
| Valkey | `astera-valkey-prod`; disposable shared rate-limit counters only |
| Network | Published application/database ports bind to `127.0.0.1`; single origin, `SameSite=Lax`, `credentials: 'same-origin'`, no CORS |
| Realtime | SSE `/api/stream`; `api.`, `www.` and `socket.` redirect to apex |
| Shards | Two MAIN galaxies filled in ordinal order, plus WAITING; EU-1/EU-2/WAIT-1 had `player_cap=1000` on 10 October |
| Neutral pool | MAIN seed: 65 worlds, tiers 38/19/8; played MAIN galaxies conserve neutrals + colonies = 65 |

An API without PostgreSQL LISTEN is unready: it loses both realtime and cache invalidations. `stream="not listening"` is expected only on the worker.

Keep `PLACEMENT_POOL_MAX=2` per API (six total), separate from `API_DB_POOL_MAX`; the worker opens no placement connections. Budget gameplay, placement, worker and LISTEN connections against PostgreSQL's ceiling. Compare `database.configuredPlacementPoolMax`, `database.placementTransactionStartMs` p95/p99 and `database.placementTransactionStartErrors` with route latency and gameplay-pool probes before changing capacity. Startup timing includes connection establishment through BEGIN, excluding galaxy lock/handler. Increase only after representative isolated qualification, retaining a rollback to two.

Release gates:

1. Use one clean, pushed full SHA. Checkout, selected `origin/master`, OCI revision, all four runtime commits/image IDs and public `release.txt` must agree.
2. Build server and web before any interruption. Migrate explicitly once with that exact image; never through application startup.
3. Restore a fresh dump to a disposable database and rehearse migrations before production mutation. Retain the previous image by ID, webroot, Nginx configuration, private runtime `.env` and verified dump through observation. Secrets/backups use mode 600; never print or commit credentials.
4. Choose rolling, worker-only interruption or full quiescence from schema locks, actual old/new read/write compatibility, event kinds and feature gates. No DDL does **not** prove compatibility; a successful old-image boot does **not** prove its writes work.
5. A required interruption beyond the ordinary compatible roll needs prior owner authorization. Report the measured reason, recently active commander count, expected cost and immediate benefit before stopping affected roles or applying the associated DDL. Previous release approvals are not blanket approvals.
6. Require valid `.ok=true` health on all four processes, schema/queue/world consistency and external acceptance. Do not treat a successful command or `Deployed` message as acceptance.
7. Validate APIs/worker before web publication. Preserve old hashed assets and API compatibility for already-open tabs; use aliases or a tested reload path before removing old routes.
8. Season changes, wipes, repairs, bot activation and live-world adoption are explicit operations, not hidden deployment side effects.
9. Never restore an old database over newer player writes as routine rollback. Additive rolling migrations normally stay in place; prove any code rollback compatible with both schema and newly stored data.
10. Review changes to `packages/rules/src/galaxy.ts`, `pirates.ts`, `GALAXY.asteroid*` and `GALAXY_EVENTS`. Derived fields can change on the first new-image read without DDL. Stored dynamic hours are protected by their generation snapshots; legacy derived seasons still need fixed-time comparison.

`deploy/deploy.sh` remains noncanonical for production. Later notes record individual improvements, but do not establish all required gates (worktree review, immutable identity, restore rehearsal, prebuilt client, blocking acceptance and external checks). Use the manual sequence.

## 2. Qualify, inventory and retain rollback

Use root `pnpm verify`/`pnpm lint` (maximum 4 GiB Node heap on the owner's PC), plus `pnpm build`. Do not use 6 GiB or raise the heap ceiling. Run checks sequentially; use the complete sequential lint grouping in `docs/engineering-standards.md` when necessary. Review the complete diff and migration journal; changed public response contracts require `apps/server/test/contract.test.ts` coverage. Run `tools/loop-check.mjs`, `tools/movement.mjs` and `tools/visual.mjs` only against an isolated disposable API/database. Raise rate limits only there. `visual:baseline` is the write-free exception for an existing dev stack; shared-state timeouts or stale selectors do not establish a product regression.

Economy/season simulations, snowball audits and calibration run **only on explicit request**. Ordinary verification or “all tests” does not authorize them. Defaults exclude them; explicit long-run commands are `pnpm verify --include-long-tests` and `pnpm test:long`; `--exclude-sims` remains compatible.

A red gate needs a clean-baseline comparison of exact failing tests/messages, not “known red.” An identical baseline set may be recorded under the existing baseline policy; a new/changed failure blocks release unless specifically resolved or accepted. Never widen balance bands to pass. Historical bot failures describe real behavior, not harmless simulator indicators; old failure counts are not current evidence.

```bash
git status --short
git fetch origin
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)"
pnpm verify
pnpm build
```

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

Review every tracked and untracked VPS entry before checkout/reset. Preserve `.env`, `.env.bak.*` and unknown files; never use `git clean`. Retain artifacts under unique names without overwriting a previous rollback.

```bash
previous_commit="$(curl -fsS http://127.0.0.1:3200/metrics | jq -er '.service.commit')"
previous_image_id="$(docker inspect astera-api1-prod --format '{{.Image}}')"
docker tag "$previous_image_id" "astera-server:rollback-$previous_commit"
```

```bash
rollback_stamp="$(date -u +%Y%m%d-%H%M%S)"
web_rollback="/var/www/astera-releases/pre-${release_sha:0:12}-$rollback_stamp"
nginx_rollback="/etc/nginx/sites-available/astera.pre-${release_sha:0:12}-$rollback_stamp"
sudo install -d -m 0755 /var/www/astera-releases
sudo cp -a /var/www/astera "$web_rollback"
sudo cp -a /etc/nginx/sites-available/astera "$nginx_rollback"
```

Also make a private mode-600 runtime `.env` backup. Compose reads `~/astera/.env`; changing `.env.production.example` or a separate `.env.production` does not change production.

HoofyWood and Candely must remain stopped for the certified host budget; preserve their containers/volumes. If they are running, resolve the capacity conflict before proceeding. Run `./deploy/host-capacity-preflight.sh` and require zero failures: 3 APIs + 1 worker, memory ceilings, six-core/10-GiB/20-GiB host floors, PostgreSQL ceiling 100, container/Nginx file limits and `worker_connections >= 8192`. `./deploy/configure-capacity-host.sh` is a one-time mutating adjustment, not a routine gate.

## 3. Pin and build both artifacts

Only after the worktree review:

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

Build the web privately. `VITE_GA_ID` is compiled in and requires a rebuild when changed. Keep the staging directory until external acceptance.

```bash
web_stage="$(mktemp -d "/tmp/astera-web-${release_sha:0:12}.XXXXXXXX")"
ga_id="$(sed -n 's/^VITE_GA_ID=//p' .env | tail -n 1)"

docker build --target web-dist \
  --build-arg "VITE_GA_ID=$ga_id" \
  --output "type=local,dest=$web_stage" .

test -f "$web_stage/index.html"
printf '%s\n' "$release_sha" > "$web_stage/release.txt"
find "$web_stage" -type f \
  ! -name 'index.html' \
  \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' \
     -o -name '*.webmanifest' -o -name '*.html' \) \
  -size +1k -exec gzip -9 -k -f {} +
```

## 4. Rehearse backup, migration and compatibility

Confirm PostgreSQL/Valkey healthy. Use a fresh consistent private release dump; avoid retention pruning during preparation. The ordinary helper is below; preserve release backups outside its rotating set.

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

Record the original journal and compare durable counts/invariants: accounts, live seasons, players, worlds, missions and queue rows. Add zero-null/backfill assertions for affected columns. Compare against the dump's snapshot, accounting for ongoing production writes rather than requiring a moving live database to match.

Run the candidate migration on the restore:

```bash
POSTGRES_DB="$restore_db" "${compose[@]}" run -T --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate </dev/null

docker exec astera-postgres-prod psql -v ON_ERROR_STOP=1 -U astera -d "$restore_db" -c \
  'select count(*) as applied_migrations from drizzle.__drizzle_migrations;'
```

Boot the retained old image against the migrated restore (isolated loopback port/database), require health, inspect logs and exercise affected **reads and writes**. `/api/preview` must answer without 5xx; `409 NO_FRONTIER` can be valid on a copy. Also exercise the new image/client and affected worker event handlers. Never attach a rehearsal worker to production.

Compare preserved targets and durable counts before starting the restore's worker. Then keep the
compatible candidate worker running while probing both API images: pending events age during the
rehearsal, and an API correctly reports an unhealthy queue if no worker drains that isolated copy.

The schema guard is one-way: new code rejects a journal behind it; old code may boot against an incompatible newer schema because `pendingMigrations` clamps at zero. In particular, health does not exercise the `season_cycles.ordinal` or result-cycle INSERT paths. Measure locking and backfill effects as well as boot compatibility. Delete only the identified disposable probe/database after evidence is retained.

For asteroid changes, compare complete specs/public IDs, claims and active mining targets at the same DB/key/time before migration and after the new image. Require exact same-platform equality; cross-Node last-bit test-encoding differences do not justify changing live geometry.

## 5. Select the path and capture the live snapshot

| Condition | Path |
| --- | --- |
| Mixed versions compatible; migrations, if any, preserve affected reads/writes and fit lock budget | Rolling; migrate before new processes boot |
| Only worker/CLI writers are incompatible, APIs remain safe | Owner-approved worker interruption around migration; use feature-specific order below |
| APIs incompatible, unsafe locks, incompatible live payloads or world repair/reset | Owner-approved quiesced plan; do not improvise |

New enum values matter when a live producer can emit them. A migration backfill may emit new jobs even if its SQL is additive. Keep incompatible feature producers gated until every consumer understands them. Review old-client routes, payloads, worker kinds and CLI writes; migration count alone selects no path.

Record health, in-flight work and recently active commanders immediately before rollout:

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

The 15-minute activity count is an operational proxy, not an exact count of open sessions. Retain it for the owner decision and post-release comparison.

## 6. Rolling deployment

If pending migrations passed the compatibility/lock rehearsal, apply them once with the pinned new image **before** rolling:

```bash
"${compose[@]}" run -T --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate </dev/null
```

For remote `ssh ... 'bash -s'` heredocs, both `-T` and `</dev/null` are required: disabling the TTY does not stop a child consuming the rest of the script. Use the package-local `tsx`; the production image does not install root `tsx`.

Run release-specific post-migration assertions. Apply staged flags/feature prerequisites from section 11 before rolling. Replace one API at a time, require health/image/SHA before the next, and normally roll the singleton worker last. Abort immediately on a failed gate; the snippets are an ordered runbook, not a script to paste without error handling.

```bash
new_image_id="$(docker image inspect astera-server:latest --format '{{.Id}}')"
export ASTERA_GIT_COMMIT="$release_sha"

roll() {
  local name="$1" port="$2" health=''
  docker compose -f docker-compose.prod.yml up -d --no-build --no-deps "$name" || return 1
  for attempt in $(seq 1 90); do
    health="$(curl -sS "http://127.0.0.1:$port/health" || true)"
    jq -e '.ok == true' <<< "$health" >/dev/null 2>&1 && break
    sleep 1
  done
  jq -e '.ok == true' <<< "$health" >/dev/null || return 1
  test "$(docker inspect "astera-${name}-prod" --format '{{.Image}}')" = "$new_image_id" || return 1
  test "$(curl -fsS "http://127.0.0.1:$port/metrics" | jq -er '.service.commit')" = "$release_sha" || return 1
  test "$(curl -sS -o /dev/null -w '%{http_code}' https://asteraonline.space/)" = 200
}

roll api1 3200 || exit 1
sleep 3
roll api2 3201 || exit 1
sleep 3
roll api3 3202 || exit 1
sleep 3
roll worker 3210 || exit 1
```

Nginx uses `least_conn`, `max_fails=2 fail_timeout=5s`; passive failure detection can produce transient 502s during replacement. The source recorded one such failure in a prior rollout; it does not establish a universal one-request upper bound. Do not enable automatic mutation replay without working idempotency keys (`request_log` is not wired into that path). A worker restart briefly delays queued events; inspect recovery rather than hiding failures with restarts.

Run internal acceptance (section 8), complete any required staged activation, then publish (section 9).

### Full quiescence, only when authorized

1. Have server/web artifacts, rollback copies, rehearsal evidence and pre-stop snapshot ready.
2. Stop Nginx and verify no 80/443 listener, then gracefully stop `api1 api2 api3 worker`; verify no legacy/orphan application process remains. Keep PostgreSQL/Valkey up.
3. Alternatively serve a prebuilt maintenance page with Nginx still running. Verify it through HTTPS (`curl -kfsS --resolve asteraonline.space:443:127.0.0.1 https://asteraonline.space/`); HTTP alone may only test a redirect. A page is not quiescence: stop and verify every writer. `/api` returns upstream errors unless explicitly intercepted.
4. Take a **new final dump after all writers stop**, checksum it and restore/rehearse this exact dump for a schema-changing release. This is the rollback boundary.
5. Run migrations once with the new image and `-T ... </dev/null>`, then release-specific assertions. Start the exact new worker/APIs and require section 8 acceptance before reopening.
6. Publish the prepared web and validated vhost while Nginx is stopped, then start Nginx; with maintenance mode, switch back only after acceptance.

Use an abort handler matched to the current phase. Before migration, restore the old serving state; after incompatible migration, follow the verified rollback plan before starting old roles. Never blindly restart old code against a changed schema. Keep maintenance/rollback directories uniquely named.

## 8. Internal and galaxy acceptance

| Process | Required |
| --- | --- |
| API 3200/3201/3202 | Valid `.ok=true`, database/queue/stream `ok`, shared limiter `ready` |
| Worker 3210 | Valid `.ok=true`, queue `ok`, `stream="not listening"`, `unknownEvents=0` |
| All four | Intended image ID, full runtime SHA, current schema (`pendingMigrations=0`) and intended flags |

```bash
docker exec astera-postgres-prod psql -v ON_ERROR_STOP=1 -U astera -d astera -c \
 "select status, count(*) from scheduled_events group by status order by status;
  select count(*) as overdue_missions
    from missions where status='in_flight' and arrive_at < now() - interval '2 minutes';"
```

A stopped worker's `processing` claims should recover through the reaper. Failed/unknown events, growing lag or stranded work require investigation, not repeated restarts.

Inspect live MAIN and WAITING rows separately; exactly two MAIN galaxies does not mean only two total live rows. The latest supplied capacity inspection is 1000 on EU-1/EU-2/WAIT-1; refresh it without silently changing capacity. Historical 300/350 assertions and old 51-world pools are not current gates.

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

Require each season's intended creation ruleset, allowing mixed rulesets across rollover. A code deploy alone does not upgrade a season. MAIN joins expose only the lowest non-full ordinal as `open`; later galaxies stay `locked`. EU-2 is human-only: zero joined bot profiles.

For each current MAIN galaxy require neutrals + colonies = 65; all capitals/colonies controlled, neutrals uncontrolled and `orphaned_neutral_state=0`. Fresh MAIN galaxies have tiers 38/19/8; played galaxies need conservation, not 65 remaining neutrals. WAITING has no 65-world acceptance constant.

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

When checking capacity/slot changes, distinguish occupied addresses (all worlds) from seated commanders (capitals). Noncapital worlds inside a capital slot window can reduce usable addresses; do not infer free spawn slots from player count alone.

## 9. Publish web and verify externally

Preserve old hashed assets for open tabs. Stage on the same filesystem as `/var/www/astera`; do not copy over a live mixed artifact. The source's two-rename sequence below keeps files together but has a brief missing-root interval; it is not a single atomic exchange. If strict uninterrupted publication is required, use a separately validated atomic publication mechanism.

Use unique/verified staging and previous paths; do not delete unknown rollback directories.

```bash
test ! -e /var/www/astera-next
sudo cp -a "$web_stage" /var/www/astera-next
# Open tabs may still import chunks from older builds. Carry their immutable
# assets into the candidate without overwriting the current build's assets.
sudo rsync -a --ignore-existing /var/www/astera/assets/ /var/www/astera-next/assets/
sudo chown -R www-data:www-data /var/www/astera-next
sudo chmod -R a+rX /var/www/astera-next
test -f /var/www/astera-next/index.html
test "$(cat /var/www/astera-next/release.txt)" = "$release_sha"

test ! -e /var/www/astera-previous
sudo mv /var/www/astera /var/www/astera-previous
sudo mv /var/www/astera-next  /var/www/astera
sudo systemctl reload nginx
```

If those paths already exist, preserve/rename them deliberately before continuing. Verify no stale `index.html.gz` is in the candidate.

**Forward CSP order: new webroot before new vhost. Rollback: old vhost before old webroot.** A nonce-requiring `'strict-dynamic'` vhost with an old nonce-free page produces a blank game despite green health. Validate Nginx before reload; restore the retained vhost if validation fails. The example's reload alone does not install a changed vhost.

If the vhost changes, install and validate it **AFTER the rename**, then reload Nginx.

For quiesced in-place publication, keep Nginx stopped, validate/install `deploy/nginx/astera.conf`, run `sudo bash deploy/publish-web.sh "$web_stage" /var/www/astera`, ensure `www-data` access (`D755,F644`), then start Nginx. The helper retains old hashed assets and discards a precompressed index.

External gates:

```bash
test "$(curl -fsS -H 'Cache-Control: no-cache' \
  https://asteraonline.space/release.txt)" = "$release_sha"

curl -fsS https://asteraonline.space/ \
  | rg -o 'index-[A-Za-z0-9_-]+\.js'
curl -fsS -D - -o /dev/null https://asteraonline.space/api/preview \
  | rg -i '^x-server-time:'
curl -fsS https://asteraonline.space/api/servers | jq
```

Require `ngx_http_sub_module` (`nginx -V`), no served `__CSP_NONCE__`, no `index.html.gz` bypass, identical nonce in CSP header and document, and a different nonce on the next request. On Debian/Ubuntu, use an Nginx build with the sub module (e.g. `nginx-full`). Check actual values, not just successful extraction.

Open a clean browser with console visible: no CSP violations, publisher/footer pages reachable and privacy notice before analytics/advertising cookies. Also test an already-open old client. `/api/preview` must remain write-free and seat-free; do not create production test accounts. Require `x-server-time` so device clocks do not distort movement.

Rerun all health, queue, overdue, connection-budget, live-shard and host-preflight checks. Compare work counts with the pre-roll snapshot, allowing normal completions and new activity; counts need not monotonically increase. Observe statuses by route/client, including old-route 404 clusters. Rollover `NO_PLANET` differs from a removed-route compatibility bug.

Retain rollback artifacts through the observation window. Remove only identified obsolete stateless containers and the explicitly created web staging directory after acceptance. Record SHA, image IDs, schema, rehearsal/lock results, cutovers and acceptance; only then is deployment complete.

## 10. Rollback boundaries

| State | Permitted response |
| --- | --- |
| Code-only compatible rollout | Retag retained image as `astera-server:latest`, set expected rollback SHA/image for checks, roll safely, restore matching vhost/web/environment |
| Additive migration with compatible old code/data | Retain schema; prove old reads, writes and newly stored data remain compatible before code rollback |
| Quiesced, migration applied, no later writes | Stop new roles; restore verified final dump and matched old image/config/web; run full acceptance before reopening |
| New player writes accepted | Forward fix or proven compatible code revert; destructive restore requires explicit owner decision about lost interval |
| New Polar intent, adopted calendar or monument deal | Apply the stricter feature boundary in section 11 |

Restore a changed vhost, validate and reload it **before** putting an old nonce-free webroot back. Do not rewrite Git history on the VPS; permanent code reversions are new pushed commits through the same gates. Never prune release backups/images in their creation session.

## 11. Feature-specific rollout and rollback constraints

These apply only when the selected diff/journal requires them. Do not replay historical migrations, wipes, approvals or activations merely because they appear here.

### Polar cosmetic wave two

Production mapping: `config/polar-cosmetics.production.json`, 36 paid extras / 46 offers total (nine planets, bundle, 36 extras). Four free standards — Vanguard, Orbital Guard, Bastion, Meridian — remain unmapped. Rings/standards: EUR 1.99 or TRY 49; engines: EUR 2.49 or TRY 69. Retain existing planet/bundle IDs/prices and matching revised Inferno/Nebula/Prism thumbnails. Details: [Polar evidence](polar-wave2-integration-2026-10-10.md).

1. Retain private runtime `.env`, image, web and vhost. Roll the new compatible image with the existing **20-extra mapping** first. Require all four roles healthy on it; retain `astera-server:polar-wave2-compatible-<release sha>` as the receiver rollback floor.
2. Replace **only** runtime `POLAR_COSMETIC_PRODUCTS` with the 36-extra production mapping. Preserve `POLAR_ENV=production`, live token, enabled checkout flag, return URL, existing `POLAR_PRODUCT_*` IDs and webhook secret. No sandbox IDs.
3. Recreate API1 → API2 → API3 → worker using Compose; `docker restart` keeps old environment. Preserve the raw webhook endpoint/subscription: `order.paid`, `order.refunded`, `checkout.expired`.
4. Require `/api/skins/polar-pricing` to expose 46 offers with regional prices; test old-tab inventory compatibility before publishing store/client/price pages. New clients send known cosmetic IDs; old clients receive the frozen prior view, without losing stored rights. Check a new item per category and free standards; use sandbox payment/refund/redelivery evidence, not a real card for smoke.

The 10 October inspection found the provider secret matched VPS `.env` while running processes held an older value. Reconfirm and use the provider-confirmed configuration; do not copy stale process environments wholesale.

Before any new-item intent, rollback must pair old image/web with old mapping (old parser rejects new IDs). **After even a pending new-item checkout intent exists, never downgrade the webhook receiver below wave-two compatibility.** The old receiver may mark a webhook seen before ignoring the new item, defeating retries. Close new sales using the retained compatible image with old mapping/web, or forward-fix; existing intents contain the product needed for fulfilment/refund. Disabling checkout does not cancel hosted pending checkouts. Never delete intents, entitlements or receipts as rollback.

### Asteroid snapshots and calendar adoption

Migration `0146_asteroid_generation_snapshot` adds nullable JSONB `asteroid_spawn_hours.generation`, without backfill/new event kind. Inventory all pending journal entries rather than assuming 0146 is the only one. Rehearse exact geometry/ID/claim/target preservation and measure locks. For the documented 0146 rollout, use a private one-off `DATABASE_URL` with `lock_timeout=1000&statement_timeout=30000`, preserving existing query parameters and normal runtime URL. Never print credentials. A held reader must cause a nonzero migration exit and unchanged journal; inspect/retry after release, without killing player transactions or silently extending timeout.

New hours freeze full generation settings/algorithm. Null snapshots retain immutable pre-release v1 behavior; keep RNG order, IDs, ore, birth/expiry and claims unchanged. Preserve that fallback byte-for-byte. Generation or algorithm changes require explicit old-image compatibility proof. Population smoothing uses current raw eligibility plus the preceding five **actual** hours, not stale rows across outages. Raw eligibility includes eligible humans + floor(active non-retired bots / 2); `eligible_players` is raw, `active_players` may be smoothed after founding day.

Latest supplied adjustment is **definition v12**, superseding the v10/v11 tables:

| Türkiye time | Weekday | Weekend |
| --- | --- | --- |
| Lunch | 12:30–13:00 ×2 | 13:00–13:30 ×2 |
| Evening | 20:00–20:30 ×2 | 20:00–20:30 ×4 |

Base arrivals: 0.75 rocks per eligible active commander/hour. Half the shower **bonus** is reserved for its first 10 minutes; the remainder samples the whole window, rounded per lane. New hours use 1–2 hour lifetimes; older hour snapshots retain 2.5–5 hours. At smoothed population 32: ordinary hour 24; half-hour ×2 gives 24 shower + 12 ordinary (6 reserved); ×4 gives 48 + 12 (18 reserved). These are arrivals, not total visible stock.

Existing stored hours remain frozen. Existing five-minute and null snapshots retain old birth times/IDs/ore/targets; derived v5–v11 calendars retain five-minute distribution, v4 and earlier uniform distribution. Do not rewrite/deplete/refill them through changed constants.

After migrating and proving every API/worker on the matching image, perform the separately authorized calendar operation for **all live fixed-calendar shards**, including WAIT-1:

```bash
"${compose[@]}" exec api1 apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts \
  adopt-event-calendar
"${compose[@]}" exec api1 apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts \
  adopt-event-calendar --yes
```

Review the dry-run counts and each actual cutover. Adoption protects committed/future-planned hours, opened windows and processed lifecycle markers after acquiring the season lock; the cutover may be later than the next hour. Investigate distant boundaries without clearing protected rows. It preserves a retained occurrence's whole window, including a half-hour shower whose containing hour is already planned, and end-processed/start-pending occurrences.

For legacy-to-dynamic adoption it snapshots `asteroid_legacy_calendar`, sets `asteroid_dynamic_from`, preserves existing derived IDs/claims/flights, suppresses legacy births from cutover and starts hourly planning. Future shower/convoy windows/jobs adopt current definitions; opened windows and merchant rows remain untouched.

Publish the matching guide only after reported cutovers **and retained old showers extending past them** end. The active-event chip correctly displays the actual old stored multiplier meanwhile. Observe a new hour per shard: exactly one row, one next-hour job, non-null generation with `frontLoadMinutes: 10`, v12 effects, expected measured-population lanes, unchanged depleted claims/mining targets and no failed/stranded work. Repeat adoption must be a no-op.

Do not use `restamp`, `sync-events`, a wipe or queue reset for this rollout. Routine later deploys do not repeat adoption unless definitions change.

Rollback retains the additive column and frozen hours/claims. Image rollback does not reverse stored calendars: restore reviewed future windows/jobs only at an unplanned boundary, preserving opened/planned hours and processed occurrences. Never restore a whole older DB over player activity. Supporting detail: [asteroid fix](asteroid-spawn-fix-2026-10-09.md).

### Easy / Hard monuments

Migration `0147_monument_difficulty` gives existing rows `LEGACY`, preserving old layout/dispatch until adoption. New ruleset-16 seasons deal eight targets (four Hard/four Easy) at cube corners on the sphere. Existing-season adoption preserves the first five IDs/honoree identities.

Deploy migration, all APIs, worker **and updated clients** before activation: old APIs can accept prohibited combat reinforcements; old clients accept only five ordinals. Merely publishing web does not update already-open tabs. Verify that client compatibility prerequisite before adopting; do not downgrade to the five-target build afterward without a compatibility change.

At each explicitly named galaxy's quiet window:

```bash
pnpm --filter @astera/server season adopt-monuments --shard EU-1
pnpm --filter @astera/server season adopt-monuments --shard EU-1 --yes
```

Preview first; apply rechecks under exclusive season lock. `BUSY` refuses without writes if player control, outbound/held/returning monument fleets, probes or preparing/attacking joint operations exist. Wait; never clear blockers manually. `ALREADY_UPDATED` is a no-op. Repeat separately for another galaxy.

Adoption preserves closed radiation history, closes old active clouds at cutover, starts new clouds then, updates neutral garrisons plus respawn templates, clears stale pending loss/respawn jobs and refreshes reads. Past flights are not repriced. The cancelled rate update stays cancelled: **4 HP/minute, 10 deuterium/minute**; no rate adoption. Details: [monument update](monument-fairness-plan-2026-10-10.md).

### Silent Space

Specification: `docs/handoffs/sessiz-uzay-entegrasyon-plani.md`. Keep `SILENT_SPACE_ENABLED=false` during mixed API versions. After all-role/web acceptance, recreate only the worker with `SILENT_SPACE_ENABLED=true`, `SILENT_SPACE_BATCH=5`, `SILENT_SPACE_MAX_SHARDS=16`.

D212 migrations 0143 (`last_progress_at`, backfilled from `last_active_at`) and 0144 (`pirate_raids.recalled_at`) are additive. Estimate the first 30-hour eligibility wave from the actual predicate, not “last login” shorthand:

```sql
SELECT count(*) FROM players p
JOIN seasons s ON s.id=p.season_id JOIN shards h ON h.id=s.shard_id
WHERE h.role='MAIN' AND s.status='live'
AND greatest(p.last_progress_at,p.joined_at,p.main_entered_at)
    <= now()-interval '30 hours';
```

Batch 5 per five minutes permits 60/hour; maximum batch is 20. Do not change `WORKER_POLL_MS`; the maintenance lease retains due time across restarts. Check first/subsequent maintenance, audit/outbox, placement/world consistency, late fleets and queues. Unexpected errors: disable transfers and forward-fix; keep existing WAITING placements playable, without old-DB restore.

MAIN colony departure sites return to neutrals; eligible returns reuse them and may exceed player capacity, capitals have a safe fallback, new joins stay capped. HTTP shared placement leases/exclusive transfer fencing and `/me`/`placement_changed` reconciliation must prevent stale-world writes. The notice records explicit return intent; season reset still applies.

### Compatibility switches when crossing older boundaries

| Feature | Required staged activation |
| --- | --- |
| `FIRST_GAME_SHIELD_ENABLED` / migration 0142 | Migrate; persist/export false; roll all four and verify false; persist/export true; roll all four again before guides. Existing accounts retain 24h; only new human registrations gain one-time 72h entitlement, consumed transactionally at first placement, not reset by wipes. No historical backfill. |
| `PIRATE_SPAWN_INCREASE_ENABLED` (D211) | First roll false everywhere so all code can resolve new handles without exposing them; then true everywhere in a second roll. Never expose a lane while old consumers remain. |
| `PIRATE_SPAWN_SURGE_ENABLED` | Same two-phase rule for the third lane; nested under the increase switch. |
| `RECOVERY_SHIELD_ENABLED` / migration 0078 | First roll false, then activate after all code understands nullable shield fields. Disabling also stops honoring already-granted recovery shields; first-day shield is separate. |

Verify both runtime SHA/image and flag values at each phase; ordinary future releases use one roll once compatibility is universal. Existing stored flight `arrive_at`, launched mining `hold_each`, queue `ready_at`, claim deadlines and shield deadlines remain authoritative; newly computed returns/claims/defeats may use new rules immediately. The 0141 priority migration adds nullable claim-priority fields: new qualifying decisive claims reserve 60 minutes for their raider; pre-existing null claims remain public.

### Historical migrations that need more than green health

| Boundary | Preserve this constraint if still pending |
| --- | --- |
| 0064 result cycle | Check no account/cycle duplicates; rehearse IDs/counts/activity/coordinates/periods. Old worker INSERT misses new NOT NULL cycle field: approved worker stop → migrate → new worker with transfers off → APIs/web. |
| 0079–0086 season archive | `season_cycles.ordinal SET NOT NULL` has no default; old worker/CLI INSERT fails even with ON CONFLICT. Approved worker stop → migrate → new healthy worker → APIs/web. 0081 updates every planet and takes row locks. |
| 0089–0093 faults/dynamic fields | Migration arms `fault_spawn` for live Core 6+ colonies; old worker can consume unknown jobs. Approved worker stop → migrate → all APIs → new worker. Activate `asteroid_hour` only after all roles through calendar adoption; do not reset live seasons. |
| 0127–0140 initial monuments | Keep applied 0138/0139 identities/order. Measure 0130 deuterium double-precision lock/rewrite on restore. Approved worker stop → migrate → APIs → new worker; no ruleset-16 creation/rollover until all know monument event kinds. Old images are unsafe with active monument fleets. |

Historical five-monument acceptance is valid only for the LEGACY deal; adopted/new eight-target galaxies follow the Easy/Hard section. Do not replay old batches or rely on historical journal totals.

## 12. Separate owner operations

Use fresh backups, a restored-copy rehearsal, dry run and explicit target where supplied. Never use these commands to repair a failing deployment gate.

### Season cutoff, emergency wipe and forward rulesets

Normal cutoff shortens existing lifecycle rows; `season wipe --yes` skips that lifecycle. Verify the current afterglow is still five minutes. The guarded transaction below expects exactly two live seasons and four pending lifecycle rows. **It predates WAITING live seasons**: if inventory includes WAIT-1 it must fail; do not weaken its count checks or silently omit a shard. Prepare/rehearse an explicit MAIN/WAITING lifecycle plan for the actual world before applying a cutoff.

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

After cutoff, monitor all health/lifecycle rows. Committed missions/mining/builds/strategic builds may defer freeze; worker retries each second and rollover waits for all applicable seasons. Never delete work to meet a deadline. Accept the intended successor ruleset/current seed contract, old seasons wiped, no old live work, no failed/processing lifecycle jobs, and one pending end/rollover plus expected acts per successor. Account identity, results and both-channel `chat_archive` survive; disposable world rows do not.

Emergency wipe requires explicit acceptance of destroying remaining seasonal jobs/worlds. Prove maintenance, stop **all three APIs and worker**, verify no writers, take/checksum the final backup, then:

```bash
"${compose[@]}" run -T --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts wipe --yes </dev/null
```

Verify expected old counts, exactly EU-1/EU-2 opened, intended ruleset, no frozen seasons, valid windows/lifecycle rows and no failed/processing jobs. Start healthy worker then APIs; restore web last. A persistent `delete from planets` FK error with all writers stopped requires checking `pg_constraint` against `wipeAllServers` child-before-parent coverage and a tested fix; never disable constraints/delete tables manually.

Forward boundaries:

- Fleet V2 v3→v4 has **no live hull translator**. Drain/freeze and finish afterglow, quiesce all roles, take final dump, rehearse new migrations + `wipe --yes --seed <recorded seed>` on restore, and run `fleet-v2-cutover.test.ts` / `season-lifecycle.test.ts`. Require two v4 successors, 65 neutrals each, no old hull/player/mission/research/report rows and expected lifecycle jobs. Then execute the matching offline cutover. Once new writes exist, use a forward fix; no partial galaxy activation/hull mapping.
- Ruleset 8: migration 0075, convoy-aware worker/server and strict client **before** new seasons. Do not backfill v7. With active convoy runs, close new launches and keep capable arrival/return worker until every run is `done`; retain additive enum/table.
- Ruleset 11: migration 0112 nullable `battle_reports.fleet_escape`, escape-aware server/worker/web before creation. v10 remains gated off; WAITING copies source ruleset. Older code on v11 fights full raids, so rollback changes gameplay even if schema-compatible.
- Event counts depend on the authored schedule, duration and start alignment. Historical exact-14-day 70-row and aligned-30-day 120/120/60 expectations are not universal current gates. Print per-kind counts, first start/last end, unique dedupe keys, positive windows contained within season and paired lifecycle jobs. `wipe` has no `--starts-at`; arbitrary-minute starts can omit partial windows. Never fabricate events or move joined seasons to meet old counts.

Observe new events for Chronicle, notification and shard invalidation delivery; delayed workers must not change clock-derived effects. Convoy canary metrics: `runtime.routes["POST /api/intergalactic-convoy/launch"]`, `runtime.refusals[...]`, `runtime.operations["intergalactic-convoy.launch"]`; aggregate process-local counters across replicas.

### Legacy calendar commands

For compatible legacy definitions only, `restamp --shard EU-1 --kind ASTEROID_SHOWER` updates unopened eligible windows; `sync-events` with the same target appends missing not-yet-ended windows. Both dry-run by default; review counts before `--yes`, after matching code is deployed. Always name a kind; no blanket lane operation.

`restamp` must refuse changed duration, an already-planned containing hour and changed windows with processed lifecycle markers. Resizing an exposed lane can silently shift asteroid indexes, HMAC IDs, claims and mining targets. `sync-events` appends sequence numbers without renumbering but can instantly expose past-due births inside an open shower; run outside shower windows unless that visible change is intended. These commands are **not substitutes** for current `adopt-event-calendar`, and must not append new shower/convoy definitions beside unadopted old ones.

### Bots

Activation is separate: migrate bot schema (0057, 0115 when pending), synchronize the owner's fixed roster through `bots sync`, inspect `pnpm bots list`, then set `BOTS_ENABLED=true` and recreate the worker only. Sync preserves identities, applies 100 supplied names/countries, refuses human-name collisions/excess pool, does not reactivate retired accounts and never prints random passwords.

EU-2 remains human-only. Inspect health seated/awake and per-galaxy human/target/bot counts. Documented behavior: target 25 bots at 100 humans subject to `BOTS_PER_GALAXY`, maximum four joins/galaxy/30 minutes, five-minute human activity demand, one-hour minimum bot session and no awake bots 01:00–08:00 TRT. Disable through false + worker recreation; worlds remain. `pnpm bots retire "<name>"` retires without destroying holdings. Preserve existing configuration on ordinary deploys; historical defaults do not override it.

### Account deletion and manual Silent Space transfer

Use package-local CLI through `"${compose[@]}" exec api1 apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts`:

| Operation | Dry run, then separately append `--yes` |
| --- | --- |
| Requested account erasure | `delete-account 'ExactName'` |
| Requested manual transfer | `silent-space 'ExactName'` |

Rehearse a fresh backup first, verify resolved identity (display names may collide), counts and MAIN conservation. Erasure deletes the account plus both sides' battle reports/probe/watch history; count collateral history before applying. Captured colonies return to their original seeded neutral slot/tier/profile/name; nonseeded departure addresses stay empty. Refusals: `WORLD_BUSY`, `BOT_ACCOUNT` (retire instead), `ANNOUNCEMENT_AUTHOR`, `TRANSFER_HISTORY`, `RETURN_QUEUED`; never bypass them.

Manual transfer waives only activity age. World IDs, buildings, stock, fleet and research move; ordinary in-game return remains available under current placement policy. `FLIGHT`, `EVENT`, `EFFECT`, `UNITS`, `CAPACITY`, `CONTENTION` refuse without writes. Wait for completion, never clear blockers. Rehearsal snapshots can show overdue `EVENT` solely because time advanced after the dump. MAIN pool remains 65 and orphaned state zero; WAITING pool is not 65. Historical return-address anecdotes do not override the current activation policy.

## 13. First install, routine operations and capacity

First install: clone `git@github.com:yildirimsamet/astera-online.git` into `~/astera`, copy `.env.production.example` to mode-600 `.env`, set `POSTGRES_PASSWORD`, `JWT_SECRET`, loopback ports and optional GA ID. Rotating JWT secret signs everyone out. Pin/build the image, start PostgreSQL/Valkey, run explicit migrate then `bootstrap` (no production arguments; `--unattended` is development-only), start worker/APIs, build/publish web and run all acceptance.

Require Nginx sub module and TLS certificate before enabling 443. Certbot webroot `/var/www/html` must serve the challenge; certificate covers apex, `www.`, `api.`, `socket.`. Install/enable `deploy/nginx/astera.conf`, validate before reload, configure renewal reload hook and verify `sudo certbot renew --cert-name asteraonline.space --dry-run`.

Routine commands:

```bash
cd ~/astera
for port in 3200 3201 3202 3210; do curl -fsS "localhost:$port/health" | jq; done
docker compose -f docker-compose.prod.yml logs -f api1 api2 api3 worker
docker compose -f docker-compose.prod.yml run -T --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts status </dev/null
```

Nightly backup: `./deploy/backup.sh` (retains fourteen dumps). Cron:

```cron
17 3 * * * cd /home/yildirim/astera && ./deploy/backup.sh >> /home/yildirim/backups/astera-backup.log 2>&1
```

Grant the hand-checked @JoinAstera reward with package CLI `reward 'ExactCaseSensitiveName'`. It unlocks an account-level, cross-season idempotent grant for in-game claim, including between seasons. Use `api1`, not removed `astera-api-prod`; SSH `exec` uses `-T`.

Capacity qualification runs only on isolated fixtures, never production. Existing benchmark profiles: normal 300 users/connections for 3600s; normal 600/600 for 3600s with 100 wave launches and reconnect at 1200s; quiet 600 users/750 connections for 600s. Use `deploy/capacity.sh` / `pnpm capacity:test`, the staging-only secret, dedicated `astera_capacity` DB on 5645, balanced API 3380, login/metrics replicas 3300/3301/3302 and worker metrics 3310. Preserve JSON reports. These historical profiles do not certify today's 1000-seat setting.

A valid result needs clean/pinned source, matching OCI/runtime/images, exactly 3 APIs/1 worker, all metrics/client schemas parsed, nonzero semantic samples and passing host, DB reconciliation, rate-limit, LISTEN/cache and queue gates. `capacity:client` is headed 390×844 hardware-GPU diagnostics; headless SwiftShader or emulation is not Android/iPhone hardware proof. Capacity soak is separate from ordinary deployment; obtain explicit authorization for long studies under the owner test rule.

## 14. Release-specific acceptance and retained evidence

- The 10 October full-master preparation included asteroid correction, store/inventory, Polar wave two, ring simplifications, colony abandonment, monument recall, temporary session recovery and chat explanations. `komutan-gemisi` and `ui-v2` worktrees were excluded. Qualify the actual selected diff independently.
- Combined release order: ordinary gates → restored-copy/lock/compatibility proof → pending migrations → all-role compatibility roll with old Polar mapping → retain receiver floor → new mapping and second roll → applicable calendar adoption → wait for cutovers/retained showers → web publication → feature/external acceptance. Apply monument adoption separately after its client prerequisites.
- Destructive gameplay smoke belongs on the restore, not real commanders. Check store/inventory, regional pricing pages, session recovery, colony abandonment, monument recall and old-client behavior.
- Static shop showcase is client-only: transparent 512×512 WebP (95,750 bytes), no showcase Canvas/lazy scene/breathing animation; retain full product previews. Check artifact SHA-256, TR/EN at 350px and desktop, stable loading/failure bounds and working Shop/Inventory links. It alone requires no migration, Polar remapping or calendar adoption, but all release identities still match.
- Historical preflight: 10 October 08:38 UTC production was `8a4ae26856b1610cdc2d8bf0a70cc019e9bdb154`, healthy, 20 recently active commanders/16 missions; refresh before use. Restore and actual-image rehearsal proved 0146 compatibility and lock timeout, exact stored-object preservation, idempotent adoption, 46 offers and ordinary tests (10,949 passed/30 skips). These are preparation evidence, not deployment or current-population proof. Later 0147/v12 changes require their own qualification. See [full preflight](evidence/full-release-preflight-2026-10-10.json) and [stage plan](deployment-stage-rollout.md).

Remaining gaps: manual canonical release gate; no external paging for health/queue/LISTEN/Valkey/unknown events; no general old-client version handshake (cosmetic inventory alone declares IDs); manual SQL cutoff lacks a first-class fail-closed CLI; isolated capacity soak is outside ordinary deploy.

Deployment sürecini gereksiz uzatma. Gerekli kontrol testler vs tabiki yapman önemli.
