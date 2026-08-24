# Deployment

Production VPS connection: ssh yildirim@hoofywood.com

How Astera Online runs in production, and how a change safely gets there.
Read `docs/architecture.md` first if you have not.

**Live at** `https://asteraonline.space`. The box also hosts HoofyWood and Candely, but
D99/D100's two-galaxy, 600-player host budget assumes those workloads are stopped. The Astera deploy itself
still reaches only the `astera` Compose project, `/var/www/astera` and its own Nginx vhost.

> There are real people in the galaxy. A season is fourteen days of decisions that
> exist nowhere else and are derivable from nothing.

## Short deploy note

**Current go/no-go: do not treat `deploy/deploy.sh` as a production release gate yet.** It
still has four blocking gaps: the web build happens after the API restart, health failures do
not stop the script, the server image tag is mutable, and a backup is created without proving
that it can be restored. Until those are closed, a printed `Deployed` line is not evidence of a
safe release.

Before a production deploy:

1. Require a clean, pushed commit; record its full SHA. Run `pnpm verify`, `pnpm build`, and the
   real-HTTP/browser smoke tools against a scratch database. Any failure is a stop.
2. Build **both** the server image and web artifact from that same SHA before interrupting the
   running application. The image label, runtime `/health` commit and intended SHA must agree.
3. Run the host preflight. For a D99/D100 capacity cutover, stop HoofyWood and Candely explicitly;
   the Astera deploy never has authority to stop them itself.
4. Take a fresh database dump and restore it into a disposable PostgreSQL database. A dump that
   merely exists is not a rollback.

During the deploy, keep the order strict: block writes → stop all APIs and the worker → migrate →
start exactly one worker and three APIs → require `.ok == true` from all four health endpoints →
publish the already-built web artifact atomically → run the external smoke checks. Do not publish
the new web client while any internal health check is red.

Afterwards, verify the running SHA, queue/event state, overdue flights, `/api/preview`,
`x-server-time`, and the web release identity. A season deadline, rollover or wipe is a separate
owner operation and is never part of an ordinary code deploy.

If rollback is needed, keep writes blocked. With no migration, revert forward and redeploy. With
a migration, stop the new processes, restore the already-rehearsed dump, then start the previous
immutable image. Never restore over a world that has accepted newer player writes.

---

## The shape of it

```
          443 ┌────────────────────────────────────────────────┐
   ───────────│ nginx (host, least_conn, SSE unbuffered)       │
              │ / → static · /api → 3200/3201/3202             │
              └───────────────┬────────────────────────────────┘
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                 API-1      API-2      API-3       ROLE=api
                    └─────────┼─────────┘
                              ▼
              ┌───────────────────────────────────┐
              │ PostgreSQL 16                     │
              │ durable world + transactional bus │
              └──────────────┬────────────────────┘
                             ▼
                       Worker-1                    ROLE=worker

              Valkey: disposable shared rate-limit counters
```

**One origin, and it is load-bearing.** `fetch` sends `credentials: 'same-origin'`,
the refresh cookie is `SameSite=Lax`, and there is no CORS. Moving the API to
`api.` breaks two things quietly: every session ends at the first token expiry, and
`x-server-time` becomes unreadable — which drops the client onto the _device_ clock
and draws every fleet, countdown and bombardment at the wrong instant, differently
on each phone (D52). `www.`, `api.` and `socket.` all 301 to the apex. `socket.` is
unused; the only realtime surface is SSE on `/api/stream`, ordinary HTTP.

**One image, two roles.** Three API containers use the host's cores and hold SSE clients;
exactly one worker resolves scheduled moments. Valkey shares only rate-limit counters. Player
state, cache truth and outcomes remain in PostgreSQL.

**The server runs TypeScript.** `@astera/rules` is consumed as source so server,
simulator and browser cannot drift — so `tsx` is a _dependency_ of `apps/server`,
not a dev tool.

**Ports** (all bound to `127.0.0.1`; check `ss -tlnp` before taking a new one):
`3000 · 4000 · 8090 · 5544` candely · `3100 · 3101 · 8100` hoofywood ·
**`3200 · 3201 · 3202` Astera API** · **`3210` worker health** ·
**`5545` Astera PostgreSQL**.

---

## Before you ship

Every gate, in order. A skipped gate is paid for on the box instead.

| #   | Gate                                    |                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Review the diff, including your own** | Did a moved docblock land on the right thing? Did the change make an existing comment false — grep the numbers you changed. Does every new test fail against the old code? Revert the fix, watch it go red, put it back.                                                                                                                |
| 2   | `pnpm verify`                           | 0 type errors, 0 lint errors, every suite and the five-seed simulation gate green. Any red is a stop.                                                                                                                                                                                                                                   |
| 3   | `pnpm build`                            | **Not optional** — see below.                                                                                                                                                                                                                                                                                                           |
| 4   | Drive it running                        | `tools/loop-check.mjs` (the loop over real HTTP as two commanders), `tools/movement.mjs` (craft actually move on two real screens, nothing drawn twice), `tools/visual.mjs` (the disc comes up). Against an isolated scratch database, never the one you play. Raise `RATE_LIMIT_*` on the throwaway API or the harnesses die on a 429. |
| 5   | Docs in the same pass                   | Invariant table, a decision, the test counts. A stale doc is worse than no doc.                                                                                                                                                                                                                                                         |

For a D99 production cutover, the host gate is additional and blocking:

```bash
./deploy/configure-capacity-host.sh   # one-time; Nginx worker_connections → 8192
./deploy/host-capacity-preflight.sh   # read-only; must report zero failures
```

The preflight deliberately fails while HoofyWood/Candely containers are running, while Nginx or
container file limits are too low, or while the six-core/10-GiB/20-GiB resource floor is absent.

**Why the local build is a gate:** `deploy.sh` builds the client _after_ it has
already restarted the API. A failing client build therefore leaves the new server
serving the **old** client with the script stopped half-way. Survivable — payload
additions are optional and Zod strips unknown keys — but survivable by accident.

---

## Deploying

> **Current warning:** this script is not a production release gate yet. Close the four blockers
> in [Short deploy note](#short-deploy-note) before using it for a live release.

The deploy runs **on the box** and fetches `origin/master`, so an unpushed change
does not exist.

```bash
git push origin master
ssh <the box> 'cd ~/astera && ./deploy/deploy.sh'
```

Fetch and hard-reset → run the host preflight → build one image → start PostgreSQL and Valkey →
**stop every old API/worker** → **migrate** → start one worker and three APIs → validate and reload
the three-upstream Nginx vhost → build and publish the client → print all four `/health` views.

**No application process runs across a migration.** The server refuses to start
against a database it is ahead of (D47), and that refusal is the good outcome. The
old process must stop too: a compatible-looking migration can add a scheduled event
kind that the old worker does not know, and that worker deliberately completes
unknown events so they cannot spin forever. Leaving it alive during the migration
can therefore erase a newly backfilled public moment before the new worker starts.
The short maintenance window is the honest cost of a schema-changing deploy. The
reverse order is worse: an old image against a new schema can answer requests while
every worker tick fails, so the API looks healthy while no fleet ever lands again.

The script re-execs itself after the fetch, because `git reset --hard` rewrites it
while bash is part-way through reading it by byte offset — without the re-exec a
deploy that adds a step runs a spliced mixture of two versions.

`--local` deploys the working tree without fetching. Debugging only: what it ships
is not in git, so nobody can tell later what was running.

---

## D99/D100 capacity rehearsal and cutover

The isolated fixture refuses a production database name and the load tool refuses production
origins. Every invocation reseeds exactly two seasons; users 1–300 enter EU-1 and users 301–600
enter EU-2. Each season always contains exactly 30/15/6 neutral worlds. First certify one shard:

```bash
CAPACITY_PASSWORD='<staging-only-secret>' ./deploy/capacity.sh 300 99300

CAPACITY_PASSWORD='<staging-only-secret>' pnpm capacity:test -- \
  --database-url postgres://astera_capacity:capacity_only@127.0.0.1:5645/astera_capacity \
  --base-urls http://127.0.0.1:3380 \
  --login-base-urls http://127.0.0.1:3300,http://127.0.0.1:3301,http://127.0.0.1:3302 \
  --metrics-urls http://127.0.0.1:3300/metrics,http://127.0.0.1:3301/metrics,http://127.0.0.1:3302/metrics,http://127.0.0.1:3310/metrics \
  --users 300 --connections 300 --scenario normal --duration-seconds 3600 \
  --report artifacts/capacity/normal-300-60m.json

# Reseed both shards at their production ceiling before the host-wide runs.
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

A report is invalid unless `worktreeDirty=false`; HEAD, OCI revision, runtime commit and all four
running app-container image ids agree; exactly 3 API + 1 worker instance is observed; every
requested metrics endpoint and client response schema parses; semantic samples are non-zero; host
CPU/RAM gates and DB reconciliation pass. An HTTP-only green summary is not a capacity result.

`capacity:client` is a useful 390×844 hardware-GPU diagnostic, not Android proof. Run it headed;
headless Chromium normally uses SwiftShader and its frame result is not an acceptance signal.

```bash
VITE_VISUAL_TEST=1 ASTERA_API=http://127.0.0.1:3380 pnpm --filter @astera/web dev
CAPACITY_PASSWORD='<staging-only-secret>' pnpm capacity:client -- --headed --duration-seconds 60
```

The production VPS has the required resources only when the other two product stacks are out of
the capacity budget. Record their current state and confirm their own backup/restart procedures,
then stop them explicitly; the Astera deploy never does this on its own:

```bash
docker ps --format '{{.Names}} {{.Status}}' > ~/pre-astera-d99-containers.txt
(cd ~/candely && docker compose stop)
(cd ~/hoofywood && docker compose -f docker-compose.prod.yml stop)

cd ~/astera
./deploy/host-capacity-preflight.sh
./deploy/backup.sh
./deploy/deploy.sh

# Restore the other stacks if the dedicated-host decision is rolled back:
(cd ~/candely && docker compose up -d)
(cd ~/hoofywood && docker compose -f docker-compose.prod.yml up -d)
```

Ending the current season cohort is a separate manual decision. It is not a deploy step, a direct
`wipe`, or a rollback mechanism. The five-minute deadline operation is not implemented or
rehearsed yet; do not improvise it on production. Once implemented, it must update every live
season and its `season_end`/rollover events atomically, then let the ordinary
freeze/recap/afterglow path run.

An empty new galaxy has no capitals yet; it must have a 300-seat admission ceiling and 30/15/6
neutral worlds. Verify every live shard directly before opening signups:

```sql
SELECT sh.code, sh.player_cap,
       count(*) FILTER (WHERE n.tier = 1) AS tier1,
       count(*) FILTER (WHERE n.tier = 2) AS tier2,
       count(*) FILTER (WHERE n.tier = 3) AS tier3
  FROM shards sh
  JOIN seasons s ON s.shard_id = sh.id AND s.status = 'live'
  LEFT JOIN planets p ON p.season_id = s.id
  LEFT JOIN neutral_planet_state n ON n.planet_id = p.id
 GROUP BY sh.code, sh.player_cap
 ORDER BY min(sh.ordinal);
```

Wanted on each row: `player_cap=300`, `tier1=30`, `tier2=15`, `tier3=6`.

---

## Not losing the world

**A deploy with no migration cannot alter a row.** Postgres is a separate container
on a named volume that the deploy only starts and waits for. So the first question
is always:

```bash
git diff --stat origin/master -- apps/server/src/db/schema.ts apps/server/drizzle/
```

**Back up anyway, every time.** Seconds, a few hundred KB. The nightly cron dump can
be up to twenty-four hours old — which is a day of real decisions.

```bash
./deploy/backup.sh                                    # keeps the last fourteen
crontab -e →  17 3 * * * cd ~/astera && ./deploy/backup.sh >> ~/backups/astera-backup.log 2>&1
gunzip -c ~/backups/astera-<stamp>.sql.gz | docker exec -i astera-postgres-prod psql -U astera -d astera
```

**`git reset --hard` destroys uncommitted work _on the box_.** Check
`git status --short` there before deploying. Untracked files survive (reset is not
`clean`); tracked modifications do not. `.env` is untracked, holds
`POSTGRES_PASSWORD`, `JWT_SECRET` and `VITE_GA_ID`, is never in git and exists in
exactly one place.

---

## Not hurting the people playing

**Know who is in there first.** The sum of `stream.active` across the three API metrics
views is how many people are looking at the disc this second; the counts below are committed
decisions mid-air. None of it is a reason not to deploy — it is what you compare against
afterwards.

```bash
for port in 3200 3201 3202 3210; do curl -sS "http://127.0.0.1:$port/health" | jq; done
docker exec astera-postgres-prod psql -U astera -d astera -tAc \
 "select (select count(*) from missions where status='in_flight') as missions,
         (select count(*) from mining_runs where status in ('outbound','returning')) as runs,
         (select count(*) from players where last_active_at > now() - interval '15 minutes') as active;"
```

| What a restart does             | Why it is safe                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| API unreachable a few seconds   | The client reports `UNREACHABLE` — "lost contact, try again" — not a refusal                                                                 |
| Every SSE connection drops      | Clients reconnect with jitter, resume new events immediately and spread one catch-up read over 0–5 seconds                                   |
| Worker stops mid-tick           | `SIGTERM` → graceful close that waits for the in-flight tick                                                                                 |
| A flight was due during it      | Every event carries the instant it was meant to fire at; the worker drains overdue events in `resolve_at` order on startup. Late, never lost |
| Players still on the OLD client | They keep it until they reload — so the new server must answer it correctly                                                                  |

**Both directions have to work.** Adding an _optional_ field is safe: Zod strips
unknown keys, so an old client ignores it. **Removing, renaming or retyping a field
is not safe in one deploy** — ship the addition, let clients turn over, remove later.
Any route whose shape moves must be in `apps/server/test/contract.test.ts`, the only
thing standing between a moved payload and a route that answers 200, typechecks,
passes both suites and goes dark.

**Never create a test account in a live galaxy.** Nothing in the schema cascades, and
a mission aimed at the test planet belongs to somebody _else_ — deleting one stranded
a real commander's two Wasps where no safety net could reach them (`abandon()` reads
the event, `sweepStranded` reads the mission, both were gone). Verify against
`/api/preview` and the rehearsal instead: they write nothing and take no seat (D56).
A seat spent on a throwaway commander is spent for the season.

The repair, if it happens again:

```sql
WITH stranded AS (
  DELETE FROM units u
  WHERE u.location <> 'home' AND u.location NOT IN (SELECT id::text FROM missions)
  RETURNING u.planet_id, u.hull, u.count)
INSERT INTO units (planet_id, hull, location, count)
SELECT planet_id, hull, 'home', count FROM stranded
ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = units.count + EXCLUDED.count;
```

---

## After it lands

`/health` says the API is serving. It does not say the restart cost nobody anything.

```bash
cd ~/astera && git log --oneline -1
docker exec astera-postgres-prod psql -U astera -d astera -tAc \
 "select status, count(*) from scheduled_events group by status order by status;"
docker exec astera-postgres-prod psql -U astera -d astera -tAc \
 "select count(*) filter (where arrive_at < now() - interval '2 minutes') as overdue,
         count(*) as in_flight from missions where status='in_flight';"
```

| Read               | Wanted                    | If not                                                                                                                          |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| The commit         | The one you pushed        | The fetch did not take                                                                                                          |
| `scheduled_events` | Only `pending` and `done` | `processing` = a claim the restart interrupted; the reaper returns it in five minutes. `failed` = a stranded flight             |
| Overdue missions   | `0`                       | An arrival has passed and the mission is still in the air. The worker is not draining — the failure that leaves no other signal |
| `stream`           | `ok`                      | Degraded, not down: the galaxy runs on its sixty-second polls. Not a rollback                                                   |

From outside, because the above is loopback-only:

```bash
curl -s https://asteraonline.space/ | grep -o 'index-[A-Za-z0-9_-]*\.js'      # the new bundle
curl -s -o /dev/null -D - https://asteraonline.space/api/preview | grep -i x-server-time
```

Without `x-server-time` the client falls back to the device clock and draws the
galaxy at the wrong instant on every phone (D52).

> **`/health` reports; it never restarts anything.** Nothing may be wired to restart
> on a 503: every 503 describes state a restart would clear without fixing, and
> clearing it destroys the only evidence. Point a monitor at it and _read_ it.

---

## Going back

**Revert forward. Never rewrite history on the box** — the next deploy hard-resets
it back to whatever you were escaping.

```bash
git revert <bad-commit> && git push origin master
ssh <the box> 'cd ~/astera && ./deploy/deploy.sh'
```

**A revert does not undo a migration.** Migrations are forward-only and the server
refuses to start against a database it is ahead of, so reverting past one takes the
API down rather than rolling it back. The way back is the dump you took first.
A client-only revert is free.

---

## First install

```bash
git clone git@github.com:yildirimsamet/astera-online.git ~/astera && cd ~/astera
cp .env.production.example .env && chmod 600 .env    # POSTGRES_PASSWORD, JWT_SECRET
docker compose -f docker-compose.prod.yml up -d postgres valkey
docker compose -f docker-compose.prod.yml build api1
docker compose -f docker-compose.prod.yml run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate
docker compose -f docker-compose.prod.yml run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts bootstrap
docker compose -f docker-compose.prod.yml up -d worker api1 api2 api3
```

`bootstrap` takes **no arguments** in production; `--unattended N` is a development
aid and a live galaxy is empty until real people enter it.

The certificate must exist before nginx gets the 443 blocks or `nginx -t` fails:

```bash
sudo certbot certonly --webroot -w /var/www/html \
  -d asteraonline.space -d www.asteraonline.space -d api.asteraonline.space -d socket.asteraonline.space
sudo cp deploy/nginx/astera.conf /etc/nginx/sites-available/astera
sudo ln -s /etc/nginx/sites-available/astera /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`certonly --webroot` rather than `--nginx`, so the vhost in this repo stays the
vhost on the server.

**Renewal needs a reload and nothing was doing it.** certbot writes the new
certificate and stops; nginx serves the one it loaded at startup, the timer reports
success, and the site serves an expired certificate thirty days later with nothing
saying so. `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` fixes it for every
certificate on the box. Verify with
`sudo certbot renew --cert-name asteraonline.space --dry-run`.

---

## Operating

**Watching:**

```bash
for port in 3200 3201 3202 3210; do curl -s "localhost:$port/health" | jq; done
docker compose -f docker-compose.prod.yml logs -f api1 api2 api3 worker
docker compose -f docker-compose.prod.yml run --rm --no-deps api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts status
```

**Analytics.** `VITE_GA_ID` in `.env`; empty means no tag, no third-party request, no
globals. **Inlined at build time**, so changing it needs a redeploy, not a restart.
Two events, GA4's own: `sign_up` and `login`, with `method` separating the front door
from the rehearsal claim. Nothing about a player is sent.

**The @JoinAstera bonus.** A human reads a DM and runs, on the box:

```bash
docker compose -f docker-compose.prod.yml exec api1 \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts reward 'Vantage'
```

That writes the grant; the player still claims it from the rewards panel, so the
ordinary path does the locking and the once-only key. Idempotent — you will run it
twice. **Type the name exactly as they wrote it:** the display name is deliberately
not case-folded, because `İ` does not fold to `i` in Postgres any more than in
JavaScript and half this game's players are Turkish. There is no HTTP route for it,
so no admin credential lives in a public API's environment.

**Idle seats.** A commander who has not opened the game for three days has their world
reclaimed and their seat returned; the worker does it on a ten-minute clock. The
account survives — only the season presence goes, folding into `accounts.lifetime`.
It never touches a world with a flight in the air that names it. `/health` reports
`idleSeats`, how many are eligible right now without touching any: a number that stays
high means the sweep has stopped, which nothing else would show.

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U astera -d astera -c \
  "select a.username, p.last_active_at, now() - p.last_active_at as away
     from players p join accounts a on a.id = p.account_id order by p.last_active_at;"
```

**Rate limits.** Three buckets keyed by caller address. `TRUST_PROXY=true` is what
makes that the caller rather than nginx — without it the whole internet shares one
bucket and the first burst locks every player out. Safe only because the API port is
loopback, so nothing but the proxy can set `X-Forwarded-For`.

| Bucket         | Default | Why                                                                                                                                                                |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| global, 1 min  | 300     | A net under everything. Real play peaks near forty                                                                                                                 |
| login, 10 min  | 20      | The only brute-force defence — stateless JWTs, no lockout. Every attempt burns a full scrypt, including for a name that does not exist                             |
| signup, 1 hour | 6       | `/api/onboarding/claim` is unauthenticated and takes a **seat**. Three hundred a galaxy, filled in order — that ordering is the empty-shard risk's only mitigation |

`/health` is exempt: a 429 there reads as an outage. A refusal is `RATE_LIMITED` plus
`{ seconds }`, localised off `i18n/errors.ts` (D55).

**The worker is a singleton by deployment rule.** `SKIP LOCKED` keeps redelivery safe, but a
second production worker would duplicate housekeeping and spend the connection/CPU budget without
buying API capacity. Scale the three stateless API replicas; do not scale `worker` casually.

---

## Still missing

- **`request_log` is unused.** Idempotency keys are not wired into the launch path.
- **No external alerting.** `/health` now fails for queue/data failures, an API LISTEN gap, an
  unavailable configured shared limiter and an unknown worker event, but nothing production-side
  reads it on a schedule or pages the team yet.
- **The production deploy script is not a release gate yet.** It still builds the web client after
  restarting the API, permits dirty/untracked input through `--local`, publishes before blocking
  health/external smoke, uses a mutable server tag and has no verified backup-restore rollback.
- **The five-minute live-season cutoff is still a reviewed plan, not an implemented/rehearsed
  operation.** It must update the whole live cohort and its end/rollover events atomically.
