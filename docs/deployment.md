# Deployment

How Astera Online runs in production: the box, the containers, the proxy, the
certificates and the things an operator does by hand. Read `docs/architecture.md`
first if you have not; this file is only the part that is true of the server
rather than of the game.

**It is not the release checklist.** How a change gets from a branch onto this box
— the gates, the ordering, the blast radius on live players — is `docs/deploy.md`.

**Live at** `https://asteraonline.space` on a shared box that also runs two other
projects. Nothing here may reach outside the `astera` compose project or
`/var/www/astera`.

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
                                 │
              ┌──────────────────▼──────────────────────────┐
              │ astera-api-prod      ROLE=both              │
              │   Fastify + the event worker, one process   │
              └──────────────────┬──────────────────────────┘
                                 │
              ┌──────────────────▼──────────────────────────┐
              │ astera-postgres-prod   volume astera_pgdata │
              └─────────────────────────────────────────────┘
```

**One origin.** The client is served from the same host that answers `/api`, and
that is not a convenience. `fetch` sends `credentials: 'same-origin'`, the refresh
cookie is `SameSite=Lax`, and the server registers no CORS. Moving the API to
`api.asteraonline.space` without changing the client breaks two things quietly:
every session ends at the first token expiry, and `x-server-time` becomes
unreadable — which drops the client back onto the *device* clock and draws every
fleet, countdown and bombardment at the wrong instant, differently on each phone
(D52). `www.`, `api.` and `socket.` all 301 to the apex; the DNS records are kept
because a name that resolves and answers nothing is worse than one that redirects.

`socket.` is not used at all. The only realtime surface is server-sent events on
`/api/stream`, which is ordinary HTTP on this origin.

**One process, both roles.** `ROLE=both` runs the API and the event worker
together. The split is real and the image supports it — see *Splitting the
worker* below — but at one shard of fifty players a second container is a second
thing to watch for no measurable gain.

**The server runs TypeScript.** `@astera/rules` is consumed as source (`main` is
`./src/index.ts`) so that the server, the simulator and the browser cannot drift,
which means production needs a TypeScript runtime. `tsx` is therefore a
*dependency* of `apps/server`, not a dev tool. It works because pnpm links the
workspace package as a symlink and Node resolves the real path — outside
`node_modules`, where tsx will transpile it.

---

## Ports on this box

Everything binds to `127.0.0.1`. Check with `ss -tlnp` before taking a new one.

| Port | Owner |
|---|---|
| 3000 · 4000 · 8090 · 5544 | candely |
| 3100 · 3101 · 8100 | hoofywood |
| **3200** | **astera api** |
| **5545** | **astera postgres** |

---

## First install

```bash
git clone git@github.com:yildirimsamet/astera-online.git ~/astera
cd ~/astera
cp .env.production.example .env && chmod 600 .env
# fill in POSTGRES_PASSWORD and JWT_SECRET — the file says how to generate them
```

Bring the stack up and open the world:

```bash
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts migrate
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts bootstrap
docker compose -f docker-compose.prod.yml up -d api
```

**`bootstrap` takes no arguments in production.** `--unattended N` places inert
commanders and is a development aid; a live galaxy is empty until real people
enter it. Ten galaxies open, EU-1 is the frontier, the other nine are `locked`
until it fills (D21).

The certificate must exist before nginx is given the 443 blocks, or `nginx -t`
fails on a missing file:

```bash
sudo certbot certonly --webroot -w /var/www/html \
  -d asteraonline.space -d www.asteraonline.space \
  -d api.asteraonline.space -d socket.asteraonline.space
sudo cp deploy/nginx/astera.conf /etc/nginx/sites-available/astera
sudo ln -s /etc/nginx/sites-available/astera /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`certonly --webroot` is used rather than `--nginx` on purpose: it issues the
certificate without rewriting the vhost, so the file in this repo stays the file
on the server.

**Renewal needs a reload, and nothing was doing it.** certbot writes the new
certificate and stops; nginx goes on serving the one it loaded at startup. The
renewal then succeeds, the timer reports success, and the site begins serving an
expired certificate about thirty days later with nothing anywhere saying so.
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` fixes it for every
certificate on the box — this one, candely's and hoofywood's, none of which had a
hook. It is global rather than per-certificate because one nginx serves all of
them, and a reload is graceful.

Verify with `sudo certbot renew --cert-name asteraonline.space --dry-run`. It
prints "unable to obtain fresh authorizations" — that is staging reusing
authorizations, not a fault; what matters is the line that follows it. The
challenge path itself is worth checking directly on all four names:

```bash
echo ok | sudo tee /var/www/html/.well-known/acme-challenge/probe
for h in asteraonline.space www.asteraonline.space api.asteraonline.space socket.asteraonline.space; do
  curl -s http://$h/.well-known/acme-challenge/probe; done
sudo rm /var/www/html/.well-known/acme-challenge/probe
```

---

## Deploying a change

> **The checklist lives in `docs/deploy.md`** — what has to be green before a
> change is pushed, what a restart costs the people currently playing, and what to
> read afterwards to prove it cost them nothing. This section is only the mechanism.

```bash
cd ~/astera && ./deploy/deploy.sh
```

Fetches `origin/master`, builds, **migrates, then** restarts, publishes the
client to `/var/www/astera`, and prints `/health`.

**The order is the point.** Migrations run before the new image serves traffic,
because the server refuses to start against a database it is ahead of (D47) — and
that refusal is the good outcome. The reverse order is the bad one: an old image
against a new schema answers every request and fails every worker tick, so the API
looks healthy while no fleet in the galaxy ever lands again. That ran for an hour
once and left no signal anywhere.

`./deploy/deploy.sh --local` deploys the working tree without fetching.

---

## Watching it

```bash
curl -s localhost:3200/health | jq
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml run --rm --no-deps api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts status
```

`/health` checks the database, the event queue **and** the live channel. It
answers 503 for a stalled queue, an abandoned event, a stranded flight or an
unreachable database.

> **It reports; it must never restart.** Compose does not restart an unhealthy
> container and nothing should be wired up to make it. Every 503 it produces
> describes state that a restart would clear without fixing — and clearing it
> destroys the only evidence of what went wrong. Point an uptime monitor at it,
> and read it.

`stream: "not listening"` does not fail the check on its own. A galaxy running on
its sixty-second polls is degraded, not down, and taking a healthy deployment out
of rotation over a liveness channel is the worse outcome.

The endpoint is loopback-only in nginx: the queue lag, the failed-event count and
the stranded-flight count are internal state and no player's business.

---

## Backups

```bash
./deploy/backup.sh                    # one dump into ~/backups
crontab -e
  17 3 * * * cd ~/astera && ./deploy/backup.sh >> ~/backups/astera-backup.log 2>&1
```

Keeps the last fourteen. A season is fourteen days of decisions that exist
nowhere else and are derivable from nothing; losing the volume without a dump
loses the players, not just the rows.

Restore:

```bash
gunzip -c ~/backups/astera-<stamp>.sql.gz | \
  docker exec -i astera-postgres-prod psql -U astera -d astera
```

---

## Analytics

`VITE_GA_ID` in `.env`, beside everything else. Empty is the default and means the
built client installs no tag, makes no third-party request and defines no globals.

**It is inlined into the bundle at build time**, so changing it needs a redeploy
rather than a container restart — the client is a directory of static files with no
environment to read. `deploy.sh` reads it from `.env`, passes it to `docker build`
as a build argument, and prints which of the two it did.

Two events are reported, both GA4's own names: `sign_up` and `login`, with `method`
separating the front-door form from the rehearsal claim. That second number is the
conversion the whole onboarding exists for. Nothing about a player is sent — no
name, no id, no custom dimension.

## Granting the @JoinAstera bonus

A player follows the account and sends their commander name by direct message. You
read it and run, on the box:

```bash
docker compose -f docker-compose.prod.yml exec api \
  apps/server/node_modules/.bin/tsx apps/server/src/cli/season.ts reward 'Vantage'
```

That writes the grant. The PLAYER still claims it from the rewards panel, so the
resources arrive while they are looking at them and the ordinary claim path does
the locking and the once-only key.

**Idempotent.** Running it twice for the same commander writes nothing the second
time and says so, which matters because you will run it twice — the input is a
message read on a phone.

**Type the name exactly as they wrote it.** The lookup does not case-fold the
display name, deliberately: `İ` does not fold to `i` in Postgres any more than it
does in JavaScript, and roughly half this game's players are Turkish. The account
USERNAME is matched case-insensitively as well, so either will do for an ASCII
name.

**There is no HTTP route for this**, and that is the point — an admin endpoint
would mean an admin credential living in the environment of a public API for the
sake of a few dozen manual grants a season.

## Idle seats

A commander who has not opened the game for `SERVERS.idleDays` (three) has their
world reclaimed and their seat handed back to the galaxy. The worker does it on a
ten-minute clock; there is nothing to run by hand.

**The account survives.** Only the season presence goes: the record folds into
`accounts.lifetime` exactly as a wipe folds it, and the commander signs back in,
finds no planet, and is taken to the server list to join whatever galaxy is open.

**It never touches a world with a flight in the air that names it** — including a
raid somebody launched at it a minute ago — and defers those to a later sweep.

`/health` reports `idleSeats`: how many are eligible **right now**, without
touching any of them. A number that stays high across several checks means the
sweep has stopped running, which nothing else would show — a galaxy silting up
with inert worlds looks from the outside exactly like a busy one.

```bash
curl -s localhost:3200/health | jq '.checks.idleSeats'
```

To see who is about to go, and how long they have been away:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U astera -d astera -c \
  "select a.username, p.last_active_at, now() - p.last_active_at as away
     from players p join accounts a on a.id = p.account_id
    order by p.last_active_at;"
```

## Rate limits

Three buckets, all keyed by caller address. `TRUST_PROXY=true` is what makes that
address the caller rather than nginx — without it the whole internet shares one
bucket and the first burst locks every player out at once. It is safe only
because the API port is published on loopback, so nothing but the proxy can set
`X-Forwarded-For`.

| Bucket | Default | Why it exists |
|---|---|---|
| global, 1 min | 300 | A net under everything. Real play peaks around forty. |
| login, 10 min | 20 | The only brute-force defence there is — sessions are stateless JWTs and there is no lockout. Every attempt also burns a full scrypt, including for a name that does not exist. |
| signup, 1 hour | 6 | `/api/onboarding/claim` is unauthenticated and takes a **seat**. Fifty seats a galaxy, filled strictly in order — that ordering is the only mitigation the empty-shard risk has. |

`/health` is exempt: its callers are machines on a fixed cadence, and a 429 there
reads as an outage rather than as "slow down".

A refusal is `RATE_LIMITED` plus `{ seconds }`, in the same shape as every other
refusal, so it localises off `i18n/errors.ts` (D55).

---

## Splitting the worker

When one process is no longer enough, add a second service to
`docker-compose.prod.yml` with `ROLE: worker`, and set the existing one to
`ROLE: api`. Both run the same image. Two things to know before doing it:

- Only the API needs `bus.start()`, and it is already conditional on the role.
- The event queue claims with `SKIP LOCKED`, so N workers is safe by
  construction; the reaper returns anything a dead claim was holding.

---

## What is still missing

- **`season_end` has no handler.** The event kind exists; nothing consumes it.
  `endsAt` is decorative — the season stays `live` past its date, the game carries
  on and the interface shows a clamped zero. The first live season is fourteen
  days from bootstrap, so the handler is due before then.
- **`request_log` is unused.** Idempotency keys are not wired into the launch path.
- **No alerting.** `/health` is truthful and nothing reads it on a schedule.

---

## A warning paid for once

**Do not create a test account in a live galaxy.** Deleting one afterwards is not
a single `DELETE`: nothing in the schema cascades, so the rows have to come out in
dependency order — and a mission aimed at the test planet belongs to somebody
ELSE. Removing it stranded a real commander's two Wasps at a `location` naming a
mission that no longer existed, where no safety net could reach them: `abandon()`
reads the event, `sweepStranded` reads the mission, and both were gone.

The repair is to bring anything home whose location names a mission that no longer
exists:

```sql
WITH stranded AS (
  DELETE FROM units u
  WHERE u.location <> 'home' AND u.location NOT IN (SELECT id::text FROM missions)
  RETURNING u.planet_id, u.hull, u.count)
INSERT INTO units (planet_id, hull, location, count)
SELECT planet_id, hull, 'home', count FROM stranded
ON CONFLICT (planet_id, hull, location) DO UPDATE SET count = units.count + EXCLUDED.count;
```

Verify the deployment against `/api/preview` and the rehearsal instead — they
write nothing and take no seat, which is what D56 built them for.
