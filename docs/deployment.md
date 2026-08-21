# Deployment

How Astera Online runs in production, and how a change safely gets there.
Read `docs/architecture.md` first if you have not.

**Live at** `https://asteraonline.space` on a box shared with two other projects.
Nothing here may reach outside the `astera` compose project or `/var/www/astera`.

> There are real people in the galaxy. A season is fourteen days of decisions that
> exist nowhere else and are derivable from nothing.

---

## The shape of it

```
          443 ┌─────────────────────────────────────────────┐
   ───────────│ nginx (host)                                │
              │   /            → /var/www/astera  (static)  │
              │   /api/        → 127.0.0.1:3200            │
              │   /api/stream  → 127.0.0.1:3200, unbuffered │
              │   /health      → loopback only              │
              └──────────────────┬──────────────────────────┘
              ┌──────────────────▼──────────────────────────┐
              │ astera-api-prod   ROLE=both (API + worker)  │
              └──────────────────┬──────────────────────────┘
              ┌──────────────────▼──────────────────────────┐
              │ astera-postgres-prod   volume astera_pgdata │
              └─────────────────────────────────────────────┘
```

**One origin, and it is load-bearing.** `fetch` sends `credentials: 'same-origin'`,
the refresh cookie is `SameSite=Lax`, and there is no CORS. Moving the API to
`api.` breaks two things quietly: every session ends at the first token expiry, and
`x-server-time` becomes unreadable — which drops the client onto the *device* clock
and draws every fleet, countdown and bombardment at the wrong instant, differently
on each phone (D52). `www.`, `api.` and `socket.` all 301 to the apex. `socket.` is
unused; the only realtime surface is SSE on `/api/stream`, ordinary HTTP.

**One process, both roles.** At one shard of fifty, a second container is a second
thing to watch for no gain.

**The server runs TypeScript.** `@astera/rules` is consumed as source so server,
simulator and browser cannot drift — so `tsx` is a *dependency* of `apps/server`,
not a dev tool.

**Ports** (all bound to `127.0.0.1`; check `ss -tlnp` before taking a new one):
`3000 · 4000 · 8090 · 5544` candely · `3100 · 3101 · 8100` hoofywood ·
**`3200` astera api** · **`5545` astera postgres**.

---

## Before you ship

Every gate, in order. A skipped gate is paid for on the box instead.

| # | Gate | |
|---|---|---|
| 1 | **Review the diff, including your own** | Did a moved docblock land on the right thing? Did the change make an existing comment false — grep the numbers you changed. Does every new test fail against the old code? Revert the fix, watch it go red, put it back. |
| 2 | `pnpm verify` | 0 type errors, 0 lint errors, all suites green **except the two documented `sim` reds** (`CLAUDE.md` names them). Any other red is a stop. |
| 3 | `pnpm build` | **Not optional** — see below. |
| 4 | Drive it running | `tools/loop-check.mjs` (the loop over real HTTP as two commanders), `tools/movement.mjs` (craft actually move on two real screens, nothing drawn twice), `tools/visual.mjs` (the disc comes up). Against an isolated scratch database, never the one you play. Raise `RATE_LIMIT_*` on the throwaway API or the harnesses die on a 429. |
| 5 | Docs in the same pass | Invariant table, a decision, the test counts. A stale doc is worse than no doc. |

**Why the local build is a gate:** `deploy.sh` builds the client *after* it has
already restarted the API. A failing client build therefore leaves the new server
serving the **old** client with the script stopped half-way. Survivable — payload
additions are optional and Zod strips unknown keys — but survivable by accident.

---

## Deploying

The deploy runs **on the box** and fetches `origin/master`, so an unpushed change
does not exist.

```bash
git push origin master
ssh <the box> 'cd ~/astera && ./deploy/deploy.sh'
```

Fetch and hard-reset → build image → start DB and wait for its healthcheck →
**migrate** → restart API → build and publish the client → print `/health`.

**Migrations run before the new image serves.** The server refuses to start against
a database it is ahead of (D47) and that refusal is the good outcome. The reverse
order is the bad one: an old image against a new schema answers every request and
fails every worker tick, so the API looks healthy while no fleet ever lands again.
That ran for an hour once and left no signal anywhere.

The script re-execs itself after the fetch, because `git reset --hard` rewrites it
while bash is part-way through reading it by byte offset — without the re-exec a
deploy that adds a step runs a spliced mixture of two versions.

`--local` deploys the working tree without fetching. Debugging only: what it ships
is not in git, so nobody can tell later what was running.

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

**`git reset --hard` destroys uncommitted work *on the box*.** Check
`git status --short` there before deploying. Untracked files survive (reset is not
`clean`); tracked modifications do not. `.env` is untracked, holds
`POSTGRES_PASSWORD`, `JWT_SECRET` and `VITE_GA_ID`, is never in git and exists in
exactly one place.

---

## Not hurting the people playing

**Know who is in there first.** `streamTopics` is how many people are looking at the
disc this second; the counts are committed decisions mid-air. None of it is a reason
not to deploy — it is what you compare against afterwards.

```bash
curl -sS http://127.0.0.1:3200/health
docker exec astera-postgres-prod psql -U astera -d astera -tAc \
 "select (select count(*) from missions where status='in_flight') as missions,
         (select count(*) from mining_runs where status in ('outbound','returning')) as runs,
         (select count(*) from players where last_active_at > now() - interval '15 minutes') as active;"
```

| What a restart does | Why it is safe |
|---|---|
| API unreachable a few seconds | The client reports `UNREACHABLE` — "lost contact, try again" — not a refusal |
| Every SSE connection drops | Clients reconnect on a jittered backoff, and since D72 a reconnection **re-reads the whole live set** |
| Worker stops mid-tick | `SIGTERM` → graceful close that waits for the in-flight tick |
| A flight was due during it | Every event carries the instant it was meant to fire at; the worker drains overdue events in `resolve_at` order on startup. Late, never lost |
| Players still on the OLD client | They keep it until they reload — so the new server must answer it correctly |

**Both directions have to work.** Adding an *optional* field is safe: Zod strips
unknown keys, so an old client ignores it. **Removing, renaming or retyping a field
is not safe in one deploy** — ship the addition, let clients turn over, remove later.
Any route whose shape moves must be in `apps/server/test/contract.test.ts`, the only
thing standing between a moved payload and a route that answers 200, typechecks,
passes both suites and goes dark.

**Never create a test account in a live galaxy.** Nothing in the schema cascades, and
a mission aimed at the test planet belongs to somebody *else* — deleting one stranded
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

| Read | Wanted | If not |
|---|---|---|
| The commit | The one you pushed | The fetch did not take |
| `scheduled_events` | Only `pending` and `done` | `processing` = a claim the restart interrupted; the reaper returns it in five minutes. `failed` = a stranded flight |
| Overdue missions | `0` | An arrival has passed and the mission is still in the air. The worker is not draining — the failure that leaves no other signal |
| `stream` | `ok` | Degraded, not down: the galaxy runs on its sixty-second polls. Not a rollback |

From outside, because the above is loopback-only:

```bash
curl -s https://asteraonline.space/ | grep -o 'index-[A-Za-z0-9_-]*\.js'      # the new bundle
curl -s -o /dev/null -D - https://asteraonline.space/api/preview | grep -i x-server-time
```

Without `x-server-time` the client falls back to the device clock and draws the
galaxy at the wrong instant on every phone (D52).

> **`/health` reports; it never restarts anything.** Nothing may be wired to restart
> on a 503: every 503 describes state a restart would clear without fixing, and
> clearing it destroys the only evidence. Point a monitor at it and *read* it.

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
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts bootstrap
docker compose -f docker-compose.prod.yml up -d api
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
curl -s localhost:3200/health | jq
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts status
```

**Analytics.** `VITE_GA_ID` in `.env`; empty means no tag, no third-party request, no
globals. **Inlined at build time**, so changing it needs a redeploy, not a restart.
Two events, GA4's own: `sign_up` and `login`, with `method` separating the front door
from the rehearsal claim. Nothing about a player is sent.

**The @JoinAstera bonus.** A human reads a DM and runs, on the box:

```bash
docker compose -f docker-compose.prod.yml exec api \
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

| Bucket | Default | Why |
|---|---|---|
| global, 1 min | 300 | A net under everything. Real play peaks near forty |
| login, 10 min | 20 | The only brute-force defence — stateless JWTs, no lockout. Every attempt burns a full scrypt, including for a name that does not exist |
| signup, 1 hour | 6 | `/api/onboarding/claim` is unauthenticated and takes a **seat**. Fifty a galaxy, filled in order — that ordering is the empty-shard risk's only mitigation |

`/health` is exempt: a 429 there reads as an outage. A refusal is `RATE_LIMITED` plus
`{ seconds }`, localised off `i18n/errors.ts` (D55).

**Splitting the worker,** when one process is no longer enough: add a second service
with `ROLE: worker` and set the existing one to `ROLE: api`. Only the API needs
`bus.start()` and that is already conditional; the queue claims with `SKIP LOCKED`,
so N workers is safe by construction.

---

## Still missing

- **`season_end` has no handler.** The event kind exists, nothing consumes it, and
  `endsAt` is decorative — the season stays `live` past its date.
- **`request_log` is unused.** Idempotency keys are not wired into the launch path.
- **No alerting.** `/health` is truthful and nothing reads it on a schedule.
