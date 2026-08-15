# Architecture

How it is built, and — more usefully — which traps are already paid for.

---

## The one principle

> Every game rule — combat, economy, travel, loot, intel, visibility, scoring — lives in
> `@blindspace/rules`: **pure functions, zero runtime dependencies, no clock, no I/O, no
> ambient randomness.** The server imports it to decide outcomes. The simulator imports it
> to validate balance. The client imports it *only* to predict and render.
>
> **The client is never trusted to determine an outcome.**

Anything needing randomness takes an `Rng` as an argument, which is why every battle is
reproducible from its inputs and every simulated season is repeatable from its seed.

**This is enforced by ESLint, not by discipline.** `packages/rules` may not import a Node
builtin, another workspace package, `Math.random`, `Date.now`, or `new Date`. CI fails if
the rules ever acquire a clock.

---

## Layout

```
packages/rules/    @blindspace/rules    THE source of truth. Zero deps.
packages/sim/      @blindspace/sim      Season simulator + CI regression gate
apps/server/       @blindspace/server   Fastify API + event worker (one image, two roles)
apps/web/                               React + Vite client — playable; R3F lands in phase 5
legacy/                                 Phase 0 JS prototype, still runnable
```

| Package | May depend on | Must never depend on |
|---|---|---|
| `rules` | **Nothing** | Node APIs, DB, clock, network, unseeded randomness |
| `sim` | `rules` | server, web, DB |
| `server` | `rules` | web |
| `web` | `rules` | server internals |

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | Non-negotiable — it is what makes the shared rules package possible |
| Server | Node 22 + Fastify | `inject()` makes API tests need no network |
| API | REST + Zod | 19 endpoints; trivially debuggable, consumable from a future native shell |
| ORM | Drizzle | SQL-first, so `FOR UPDATE` and `SKIP LOCKED` are first-class |
| Database | PostgreSQL 16 | Transactions are the whole point here |
| Realtime | **SSE only** | Client→server is REST; server→client is rare events |
| Client | React 19 + Vite + R3F + Tailwind + Zustand + TanStack Query | Composes 3D and DOM UI in one tree |
| Hosting | Fly.io (app + worker) · Neon (Postgres) | Managed DB — a solo dev should not be doing failover |

Rejected engines and the reasoning: [decisions.md](decisions.md) A2.

---

## The persistence model

**Hybrid: lazy evaluation + scheduled events. No global tick, no per-planet loop.**

| Class | Mechanism | Covers |
|---|---|---|
| **Continuous** | Lazy — computed on read | Resource accumulation, shield regen, asteroid position, fleet position, telescope staleness |
| **Discrete** | Scheduled events + one worker | Fleet arrival → battle, fleet return → loot, probe arrival, radar warning, asteroid impact, season rollover |
| **Instantaneous** | REST inside a transaction | Upgrade, build, launch, scout, assign telescope |

### The lazy tick — the entire offline-progression system

```ts
advance(planet, now):
  minutes = productiveMinutes(planet.lastTick, now, planet.disruptedUntil)
  alloy   = min(cap, alloy + rate × minutes/60)
  shield  = min(maxShield, shield + maxShield × 0.05 × WALL_minutes/60)
  lastTick = now
```

Called at the top of every transaction that touches a planet. **Never on a timer.**
Production for 300 players costs exactly zero background compute.

Shield regen deliberately uses wall-clock minutes rather than productive ones — it is a
separate system, and disruption should not freeze it.

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

`SKIP LOCKED` makes it crash-safe and horizontally scalable with **zero coordination** —
two workers never touch the same row.

`tick()` is a plain method, not something buried in a timer, so tests drive it step by step
rather than racing a scheduler.

---

## Realtime — SSE over LISTEN/NOTIFY

One endpoint, `GET /api/stream`. It carries nothing but events a player could not have
predicted — a battle resolving, a scan detected, a fleet inbound. A few hundred bytes an
hour. Fleet motion and asteroid orbits are computed client-side from timestamps, so they
never touch it.

`EventBus` (`src/stream/bus.ts`) holds one dedicated Postgres connection issuing `LISTEN`,
and fans out to subscribed SSE responses.

**Not an in-memory emitter.** The API and the worker are separate process groups: the worker
writes the notification, the API holds the player's open connection. An emitter would work
perfectly in local dev — where both are one process — and fail in production. That is the
worst possible failure mode, so it was never an option.

**NOTIFY is transactional.** `publish()` is called *inside* the transaction that produced the
event, so the payload is delivered on `COMMIT` and discarded on rollback. A client can never
be told about a battle that was subsequently undone.

Every SSE subscription returns an unsubscribe function, and the route wires it to **both**
`close` and `error` on the raw request. Leaking one leaks a listener per reconnect.

---

## Why a fleet can never disappear

This is the worst bug this architecture could have: a player loses hours of committed
resources with no explanation and no recourse. Every path is covered and tested.

| Failure | What happens |
|---|---|
| Process dies mid-flight | Nothing is in memory. The mission row and its event row are durable; the startup sweep resolves them in order. |
| Process dies *during* resolution | The transaction rolls back. The event returns to `pending` because the status write was inside it. |
| Worker hangs, row stuck in `processing` | The reaper resets claims older than 5 minutes back to `pending`. |
| Event processed twice | Resolution is idempotent: `UPDATE missions SET status='resolved' WHERE id=$1 AND status='in_flight' RETURNING *`. Zero rows means someone else did it. |
| Server down six hours | Everything overdue resolves on restart, in `resolve_at` order, with correct timestamps. |
| Two workers running | `SKIP LOCKED`. No coordination needed. |

Covered by `apps/server/test/worker.test.ts`, including an explicit SIGKILL-mid-event
scenario.

---

## Concurrency

Every mutating action uses the same shape:

```
BEGIN
  SELECT * FROM planets WHERE id = $1 FOR UPDATE   -- pessimistic
  advance(planet, now())                            -- lazy tick INSIDE the lock
  assertLegal(action, planet, rules)                -- shared rules decide
  applyMutation()
  INSERT scheduled_events / missions as needed
  publish(tx, playerId, kind)     -- pg_notify: fires on COMMIT, discarded on rollback
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

Isolation is READ COMMITTED with explicit row locks. Serializable would work but costs
retry handling for no benefit — every contended path already takes an explicit lock.

---

## Data model

Seventeen tables. **Nothing stores a value derivable from a formula and a clock.**

`accounts` · `shards` · `seasons` · `players` · `planets` · `buildings` · `satellites` ·
`units` · `missions` · `scheduled_events` · `battle_reports` · `scan_events` ·
`probe_reports` · `watches` · `asteroids` · `notifications` · `request_log`

Schema: `apps/server/src/db/schema.ts`. Migrations: `apps/server/drizzle/`.

### Three things worth knowing

**Time model.** Everything in the database is `timestamptz`. The rules work in minutes
since season start. `apps/server/src/clock.ts` is the **only** place those two meet — if a
minute-valued number appears anywhere else, it came through there.

**Unit ownership.** `units` rows are authoritative, with `location` = `'home'` or a mission
id. A fleet in flight is still owned by its planet (so it still counts toward Wealth) but is
demonstrably not defending it. The mission's `fleet` jsonb is a snapshot for the battle
report and is never read for state.

**`probe_reports` and `scan_events` are separate on purpose.** They describe the same event
from opposite sides: one names the target and its contents (the observer's intel), the other
names the origin (the defender's radar log). Merging them would put fog enforcement one
mistaken `select *` away from telling a defender exactly who scanned them.

---

## Platform traps already paid for

These cost real debugging time. Do not rediscover them.

### There must be exactly one clock

`clock.ts` is the only bridge between wall time and game time, and **every** timestamp
written to the database must come from the injected clock — never from `defaultNow()`.

This shipped broken once. `battle_reports.createdAt` used `defaultNow()` while everything
else used the injected clock. In production the two agree closely enough to hide it; under a
fixed clock in tests, the "while you were gone" window never closed and every read replayed
the same news forever. If you add a table with a timestamp, pass the time in.

### Drizzle's `sql` template cannot bind a JS `Date` through postgres.js

It throws `The "string" argument must be of type string`. Every raw-SQL query in the queue
failed identically until this was isolated.

**Use the query builder** (it handles Dates correctly), or `.toISOString()` with an
explicit `::timestamptz` cast. Only `claimDue` needs raw SQL at all, because the builder
cannot express `FOR UPDATE SKIP LOCKED` inside a subquery.

### `RETURNING` does not preserve a subquery's `ORDER BY`

PostgreSQL makes no such guarantee. The `ORDER BY` decides *which* rows are claimed;
processing order must be re-established in code. Two arrivals at the same planet must
resolve oldest-first.

### A return leg travels backwards

Its `originPlanetId` is the planet that was raided; its `targetPlanetId` is the attacker's
home, which is where the ships live. Reading `originPlanetId` as "home" settles against the
wrong planet — fleets never come home and units stay stranded in mission locations.

### `Object.values()` / `Object.entries()` on a `Partial<Record<K,V>>`

Typed as `V[]`, which hides that a value can be undefined at runtime. Use the key-list
helpers (`fleetEntries`, `satelliteEntries`) instead — they keep the types honest.

### ZodError is not a Fastify validation error

It must be handled explicitly in the error handler, or every malformed request returns 500
instead of 400.

---

## Security posture

- The client sends **intent** (`launch 40 Wasps at planet 88`) and receives outcomes. It
  never computes one.
- **The fog is enforced in the query, not the UI.** Intel responses are filtered
  server-side against the observer's clarity, so a modified client cannot read a field it
  was not entitled to.
- Battle RNG is seeded from the mission id, so any report is reproducible and auditable.
- Access tokens and refresh tokens carry a `typ` claim that is checked. Without it, a
  30-day cookie would double as an API credential.
- Nothing further in MVP. On a 200-player shard, social visibility catches more than code
  would.

---

## Testing strategy

| Layer | Covers | Count |
|---|---|---|
| Rule units | Combat, economy curves, travel, clarity gradient, detection, dominion | 55 |
| Properties (fast-check) | Invariants over *all* inputs: dominion sums to zero, loot never exceeds cargo, counts never go negative | 14 |
| **Season regression** | A full 14-day season on three seeds, asserting balance invariants stay in band | 30 |
| Persistence | Real Postgres. Double-spend, deadlock ordering, lazy tick, crash recovery | 32 |
| Auth | Token-type confusion, forged signatures, expiry, malformed headers | 20 |
| Missions | Launch validation, abuse guards, radar-warning timing | 15 |
| Intel | Clarity gradient, refresh-spam resistance, probe bands, radar disclosure tiers | 31 |
| Galaxy | Fog asserted against raw JSON, not the UI | 10 |
| Session | Unlock cascade, return payload, notification scoping, LISTEN/NOTIFY | 29 |

**Test risk coverage, not line coverage.** The season regression is the one that matters
most — it catches a class of bug that is invisible to unit tests and catastrophic in
production.

When a test fails: **find the root cause first.** Several failures during Phase 1 were bad
test arrangements rather than bad code, and several were real bugs that looked like bad
tests. Never bend a test to fit the code without establishing which one is wrong.

---

## Commands

```bash
pnpm install
docker compose up -d      # Postgres on :5433

pnpm verify               # typecheck + lint + all tests
pnpm sim -- --players=200 --seed=7

pnpm --filter @blindspace/server db:generate   # after a schema change
pnpm --filter @blindspace/server dev
```
