# Architecture

How it is built, and — more usefully — which traps are already paid for.

## The one principle

> Every game rule — combat, economy, travel, loot, intel, visibility, scoring — lives in
> `@astera/rules`: **pure functions, zero runtime dependencies, no clock, no I/O, no
> ambient randomness.** The server imports it to decide outcomes, the simulator to validate
> balance, the client *only* to predict and render.
>
> **The client is never trusted to determine an outcome.**

Anything needing randomness takes an `Rng` as an argument, which is why every battle is
reproducible from its inputs and every simulated season repeatable from its seed. **Enforced
by ESLint, not by discipline** — CI fails if the rules ever acquire a clock.

## Layout

```
packages/rules/    @astera/rules    THE source of truth. Zero deps.
packages/sim/      @astera/sim      Season simulator + CI regression gate
apps/server/       @astera/server   Fastify API + event worker (one image, two roles)
apps/web/                               React + Vite + R3F client
tools/                                  Playwright harnesses that measure the running game
legacy/                                 Phase 0 JS prototype, still runnable
```

| Package | May depend on | Must never depend on |
|---|---|---|
| `rules` | **Nothing** | Node APIs, DB, clock, network, unseeded randomness |
| `sim` | `rules` | server, web, DB |
| `server` | `rules` | web |
| `web` | `rules` | server internals |

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | Non-negotiable — it is what makes the shared rules package possible |
| Server | Node 22 + Fastify | `inject()` makes API tests need no network |
| API | REST + Zod | Trivially debuggable, consumable from a future native shell |
| ORM | Drizzle | SQL-first, so `FOR UPDATE` and `SKIP LOCKED` are first-class |
| Database | PostgreSQL 16 | Transactions are the whole point here |
| Realtime | **SSE only** | Client→server is REST; server→client is rare events |
| Client | React 19 + Vite + R3F + Tailwind + TanStack Query | Composes 3D and DOM UI in one tree |
| Hosting | Fly.io (app + worker) · Neon (Postgres) | A solo dev should not be doing failover |

Rejected engines and the reasoning: `decisions.md` A2.

## The persistence model

**Hybrid: lazy evaluation + scheduled events. No global tick, no per-planet loop.**

| Class | Mechanism | Covers |
|---|---|---|
| **Continuous** | Lazy — computed on read | Resource accumulation, shield regen, asteroid position, fleet position, telescope staleness |
| **Discrete** | Scheduled events + one worker | Fleet arrival → battle, fleet return → loot, probe arrival, radar warning, season rollover |
| **Instantaneous** | REST inside a transaction | Upgrade, build, launch, scout, assign telescope |

### The lazy tick — the entire offline-progression system

```ts
advance(planet, now):
  minutes = productiveMinutes(planet.lastTick, now, planet.disruptedUntil)
  alloy   = min(cap, alloy + rate × minutes/60)
  shield  = min(maxShield, shield + maxShield × 0.05 × WALL_minutes/60)
  lastTick = now
```

Called at the top of every transaction that touches a planet, **never on a timer**.
Production for 300 players costs exactly zero background compute. Shield regen deliberately
uses wall-clock minutes — it is a separate system and disruption should not freeze it.

### The worker loop — the heartbeat

```sql
UPDATE scheduled_events
   SET status='processing', claimed_at=$now, attempts=attempts+1
 WHERE id IN (
   SELECT id FROM scheduled_events
    WHERE status='pending' AND resolve_at <= $now
    ORDER BY resolve_at
      FOR UPDATE SKIP LOCKED
    LIMIT $batch
 )
RETURNING *
```

`SKIP LOCKED` makes it crash-safe and horizontally scalable with **zero coordination**.
`tick()` is a plain method, not something buried in a timer, so tests drive it step by step
rather than racing a scheduler.

**Housekeeping runs before events are claimed and may never stop the queue** (D47). Releasing
a stranded flight is housekeeping; landing everybody's fleets is the job.

## Realtime — SSE over LISTEN/NOTIFY

One endpoint, `GET /api/stream`, carrying only instants a player could not have predicted. Fleet
motion and asteroid orbits are computed client-side from timestamps and never touch it.

**Two topics on one connection — D53.**

| Topic | Carries | Example |
|---|---|---|
| `p:<playerId>` | What happened TO this commander | a battle resolving, a scan detected, a fleet inbound |
| `s:<seasonId>` | What happened IN this galaxy | a fleet left a world, a raid resolved, a drill went out, a world grew |

The shard topic is the half no event could ever announce, and it is what used to arrive on a poll.
Its payload is **a shard id and a kind — nothing else**: no world, no owner, no heading. What it
says is what the poll it replaced said, sooner. Every fog rule is still enforced in the query it
points at.

**The publishing rule, and it is the whole safety argument:** a shard event fires exactly when the
public payload it points at has changed, and at no other time. A Core crossing a tier publishes; a
Refinery reaching L7 does not. A satellite going up publishes; a Telescope going up does not,
because a ground instrument is private (D15/D25) and a broadcast timed to it would be the one fact
on this channel a refetch could not have shown. Building ships publishes nothing.

The season is the shard key because `/api/traffic`, `/api/galaxy` and `/api/mining` are already
scoped by it, and it is read from the PLAYER row — never from anything a client can influence.

**Not an in-memory emitter.** The API and the worker are separate process groups: the worker
writes the notification, the API holds the player's open connection. An emitter would work
perfectly in local dev — where both are one process — and fail in production, which is the
worst possible failure mode.

**NOTIFY is transactional.** `publish()` is called *inside* the transaction that produced the
event, so the payload is delivered on COMMIT and discarded on rollback. A client can never be
told about a battle that was subsequently undone.

Every subscription returns an unsubscribe function, wired to **both** `close` and `error` on
the raw request. Leaking one leaks a listener per reconnect.

### How a client finds out anything — D52, rewritten at D53

Three mechanisms, in order of precision, and the shortest is not the timer.

1. **The instant the payload already names.** Every flight carries its own arrival, so nothing is
   ever polled for to find out when it lands — the client wakes on it.
2. **The stream.** Anything that happens to this commander, and since D53 anything that happens in
   this galaxy. Measured end to end in a real browser: a bystander sees a stranger's raid ~850ms
   after the launch commits, against the twenty-second poll it replaced.
3. **The timer, which is now a SAFETY NET.** Sixty seconds across the board. It is what runs the
   galaxy if the live channel is down — a dropped socket, a restart, a phone that lost signal.

**And a reconnection is a resync — D72.** The channel carries no cursor and no backlog, so
everything that happened while the socket was down was never delivered and nothing in the payloads
says so. Until D72 the only thing closing that gap was mechanism 3, so a dropped socket left the
disc up to a minute stale with craft parked on their destinations. `api.stream` now reports when
the socket is actually up, and every open AFTER the first re-reads the live set. The first is
exempt on purpose: the queries have only just fetched, and doubling a cold start buys nothing.

**A window on a foreign craft expiring is not an arrival — D72.** A contact carries a bearing
window and the client asks for the next one when it runs out. That wake used to sit in the same
list as real arrivals, which refetch nine payloads; nothing but `traffic` can have changed because
a stranger's window expired, and in a busy galaxy one expires every few seconds — so the most
expensive read in the game was being pulled on a schedule set by other people's traffic.

The client coalesces shard events over 250ms and maps each kind to the one or two reads it moves.
A launch does not refetch `/api/galaxy`: that payload carries a telescope reading per watched world
and a flight cannot change it. Measured: seven events cost 56 invalidations under a blanket
refresh and 2 under the routed one.

Refetching `/api/galaxy` at all is safe for the intel layer, and it is worth saying why since it
looks like it should not be: a telescope read is seeded per `(watchId, timeWindow)`, so asking
again inside a window returns the same answer and cannot buy a confirmation. The write it provokes
(`watches.lastConfirmedAt`) is throttled server-side to a quarter of a minute, which caps it
whatever the client does.

Because the net is now longer than the old poll, **`/health` reports the bus**: whether it is
listening, how much it has delivered, and how long it has been silent. A dead channel and a quiet
galaxy look identical from outside and only one of them is fine. It does not fail the check on its
own — degraded is not down.

### A mutation answers with the world — D53

Every mutation used to return a fragment and the client refetched `/api/planet` to learn what its
own action had done: two round trips for one tap, in a game whose construction is instant on
payment. `planetView()` is the body of `GET /api/planet` as a function, and every mutation returns
it — built in the same transaction under the same row lock, so it is free and authoritative.
A launch returns its `pendingThreads` too, from the same builder the GET uses.

**And the write cancels the reads it is about to overrule — D72.** `setQueryData` is the last word
only if nothing older lands after it. A `GET` issued before the tap resolves afterwards and
overwrites the authoritative answer with the pre-tap world; React Query holds whichever response
arrived last and cannot know which is newer. `useArrivals` invalidates `planet` and `pending` on
every due arrival, so a launch pressed in that second had its new fleet overwritten and the
squadron appeared on the disc and blinked out. Every mutation that writes a payload cancels that
payload's in-flight reads first — which the optimistic path already did on the way in.

On top of that, the deterministic spends are **predicted on the tap** and reconciled with the
answer. That does not weaken "the client never decides an outcome": the server still validates
inside a row lock and overwrites the prediction, exactly as the works have been projected since
D16. A predictor DECLINES whenever the answer is not certain — the Core ceiling, the Shipyard gate,
the Uplink prerequisite, the Prospector cap counted across craft that are away. It predicts only
what the player is looking at; caps, rates and slots arrive with the real answer.

### Two clocks, and only one of them is authoritative — D52

The disc is drawn by comparing server timestamps against "now", and the client's "now" is a
phone. Every response carries `x-server-time` (epoch milliseconds, off the injected clock); the
client keeps a smoothed, round-trip-debiased offset and every animation, interpolation and
countdown reads `serverNow()`. `Date.now()` is correct only for durations that never leave the
device — an animation's own elapsed time, a debounce, a round trip.

A scheduled moment is late by at most one `WORKER_POLL_MS`, which is why it is **one second**:
that latency is directly visible as a squadron holding over a world it has finished bombarding.

## Why a fleet can never disappear

The worst bug this architecture could have: a player loses hours of committed resources with
no explanation and no recourse. Every path is covered and tested.

| Failure | What happens |
|---|---|
| Process dies mid-flight | Nothing is in memory. The mission row and its event row are durable; the startup sweep resolves them in order |
| Process dies *during* resolution | The transaction rolls back and the event returns to `pending`, because the status write was inside it |
| Worker hangs, row stuck in `processing` | The reaper resets claims older than five minutes |
| Event processed twice | Resolution is idempotent: a conditional status update returning zero rows means someone else did it |
| Event fails permanently | `abandon()` cancels the mission and brings the craft home; `/health` reports `failedEvents` (D28) |
| **The event row is simply gone** | `sweepStranded` releases the mission through the same `abandon` path, matched on the event's own KIND (D46) |
| Server down six hours | Everything overdue resolves on restart, in `resolve_at` order, with correct timestamps |
| Two workers running | `SKIP LOCKED`. No coordination needed |

Covered by `apps/server/test/worker.test.ts`, including an explicit SIGKILL-mid-event scenario.

## Concurrency

```
BEGIN
  SELECT * FROM planets WHERE id = $1 FOR UPDATE   -- pessimistic
  advance(planet, now())                            -- lazy tick INSIDE the lock
  assertLegal(action, planet, rules)                -- shared rules decide
  applyMutation()
  INSERT scheduled_events / missions as needed
  publish(tx, playerId, kind)                       -- fires on COMMIT, discarded on rollback
COMMIT
```

**The lazy tick lives inside the lock.** That is what makes double-spending impossible: a
second transaction blocks there, then re-reads post-commit state and fails its own
affordability check.

| Race | Prevented by |
|---|---|
| Double-spend | Row lock + tick inside it |
| Fleet duplication | Unit decrement and mission insert in one transaction |
| Loot from nothing | Battle, loot, disruption and both ledgers commit together |
| **Deadlock on mutual raids** | **Locks always acquired in ascending planet id order** |
| Event resolved twice | Conditional status update returning zero rows |
| Two launches taking one flight bay | The count is read under the planet row lock (D28) |
| **One account taking two planets** | Unique index on `players.account_id` — the check and the insert cannot be made atomic in application code, so two tabs joining two galaxies both pass a prior existence check (D21) |
| Two commanders on one world | Unique index on `(season_id, slot_index)`; the loser re-picks against the smaller free set |
| Two registrations of one name | Unique index on `accounts.username` |

**None of those inspect a driver error code.** Every one is expressed as an insert that
returns no row, so a lost race is a value to test rather than an exception to classify — and
nothing depends on postgres.js's error shape.

**A wipe deletes child rows before parents, by hand.** None of these foreign keys declare a
cascade, and a cascade that does not exist is the kind of thing that works in review and
fails at 3am.

Isolation is READ COMMITTED with explicit row locks. Serializable would work but costs retry
handling for no benefit.

## Data model

Eighteen tables, and **nothing stores a value derivable from a formula and a clock**:

`accounts` · `shards` · `seasons` · `players` · `planets` · `buildings` · `satellites` ·
`units` · `missions` · `scheduled_events` · `battle_reports` · `scan_events` ·
`probe_reports` · `watches` · `asteroid_claims` · `mining_runs` · `notifications` ·
`request_log`

Schema: `apps/server/src/db/schema.ts`. Migrations: `apps/server/drizzle/`.

**Time model.** Everything in the database is `timestamptz`; the rules work in minutes since
season start. `apps/server/src/clock.ts` is the **only** place those two meet.

**Unit ownership.** `units` rows are authoritative, with `location` = `'home'` or a mission
id. A fleet in flight is still owned by its planet (so it still counts toward Wealth) but is
demonstrably not defending it. The mission's `fleet` jsonb is a snapshot for the battle report
and is never read for state.

**`shards` is ten rows.** `ordinal` carries the fill order and is the whole of the
sequential-fill rule; `players.account_id` is unique across every season, which is the whole
of the one-planet rule (D21).

## Platform traps already paid for

These cost real debugging time. Do not rediscover them.

**There must be exactly one clock.** Every timestamp written to the database comes from the
injected clock, never `defaultNow()`. This shipped broken once: `battle_reports.createdAt`
used the database clock, which agrees closely enough in production to hide it, and under a
fixed clock the "while you were gone" window never closed.

**Drizzle's `sql` template cannot bind a JS `Date` through postgres.js.** It throws `The
"string" argument must be of type string`, and every raw-SQL query in the queue failed
identically until this was isolated. Use the query builder, or `.toISOString()` with an
explicit `::timestamptz` cast. Only `claimDue` needs raw SQL at all, because the builder
cannot express `FOR UPDATE SKIP LOCKED` inside a subquery.

**`RETURNING` does not preserve a subquery's `ORDER BY`.** The `ORDER BY` decides *which*
rows are claimed; processing order must be re-established in code. Two arrivals at the same
planet must resolve oldest-first.

**A return leg travels backwards.** Its `originPlanetId` is the planet that was raided and
its `targetPlanetId` is the attacker's home. Reading `originPlanetId` as "home" settles
against the wrong planet, and fleets never come home.

**`Object.values()` / `Object.entries()` on a `Partial<Record<K,V>>`** is typed `V[]`, which
hides that a value can be undefined at runtime. Use `fleetEntries` / `satelliteEntries`.

**ZodError is not a Fastify validation error.** It must be handled explicitly in the error
handler, or every malformed request returns 500 instead of 400.

**`db:generate` writes a migration for an EMPTY database.** Every `NOT NULL` column and
`UNIQUE` index it emits will fail on the first existing row, so read the generated SQL and
rewrite it as add-nullable → backfill → constrain. `0007_accounts_and_servers.sql` is the
worked example. **The server refuses to boot against a database it is ahead of** (D47).

## Security posture

- The client sends **intent** and receives outcomes. It never computes one.
- **The fog is enforced in the query, not the UI.** Asserted against the API response shape,
  never the rendering.
- Battle RNG is seeded from the mission id, so any report is reproducible and auditable.
- Access and refresh tokens carry a `typ` claim that is checked. Without it a 30-day cookie
  doubles as an API credential.
- **Passwords are scrypt (`node:crypto`), 16384/8/1, salted per row, with cost parameters
  stored in the row** so they can be raised without locking anyone out. Verification is
  `timingSafeEqual`; a malformed stored value is a failed login rather than a thrown request.
- **A failed login says one thing.** "No such commander" and "wrong password" are the same
  code and sentence, and a missing account still burns a real hash against a decoy —
  otherwise the endpoint enumerates who plays this game, by text or by clock.
- **Sign-out clears the cookie and nothing else.** Stateless JWTs; the refresh token stays
  valid until it expires. A known limitation, not an oversight (D21).
- Nothing further in MVP. On a 50-player galaxy, social visibility catches more than code.

## Commands

```bash
pnpm install
docker compose up -d      # Postgres on :5433

pnpm verify               # typecheck + lint + all tests
pnpm sim -- --players=50 --seed=7

pnpm --filter @astera/server db:generate   # after a schema change
pnpm dev                                       # server + web together

node tools/visual.mjs out/visual               # drive and measure the running client

# The world. `bootstrap` is idempotent — running it twice creates nothing.
pnpm season migrate
pnpm season bootstrap                  # ten galaxies of fifty
pnpm season bootstrap --unattended 12  # DEV ONLY: inert commanders to scout
pnpm season status                     # every galaxy, its population, who is on it
pnpm season wipe --yes                 # END EVERYTHING and open fresh galaxies
```
