# Deployment

How Astera Online runs in production. Read `docs/architecture.md` first if you
have not; this file is only the part that is true of the server rather than of
the game.

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

---

## Deploying a change

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
