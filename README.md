# Blindspace

> The fleet is the bet. The information is the game. The planet is the stake.

An asynchronous multiplayer space strategy game where the core tension is
*seeing and being seen*. One planet each, real 3D coordinates, fleets that
physically travel, and combat that resolves while you are asleep.

**Design docs:** [Game Design Document](https://claude.ai/code/artifact/a905cdce-d370-463b-9295-6eb838ff0bee)
· [Build Plan](https://claude.ai/code/artifact/8791cf82-01e2-47e5-add8-56941a6374ac)

## Layout

```
packages/rules/   @blindspace/rules   THE source of truth for every game rule
packages/sim/     @blindspace/sim     headless season simulator + regression gate
apps/server/      @blindspace/server  Fastify API + event worker (one image, two roles)
apps/web/         @blindspace/web     React + Vite client — the playable loop
legacy/                               Phase 0 JS prototype, kept runnable
```

### The one architectural principle

Every game rule — combat, economy, travel, loot, intel, visibility, scoring —
lives in `@blindspace/rules` as pure functions with **zero dependencies, no
clock, no I/O, and no ambient randomness**. The server imports it to decide
outcomes. The simulator imports it to validate balance. The client imports it
only to predict and render.

**The client is never trusted to determine an outcome.**

Anything needing randomness takes an `Rng` as an argument, which is why every
battle is reproducible from its inputs and every simulated season is repeatable
from its seed.

## Commands

```bash
pnpm install
docker compose up -d      # Postgres on :5433 — two databases, blindspace and blindspace_test

pnpm verify               # typecheck + lint + all 292 tests
pnpm typecheck
pnpm lint
pnpm test

pnpm sim                  # look at a season by hand
pnpm sim -- --players=200 --seed=7

pnpm --filter @blindspace/server db:generate   # after a schema change
```

### Playing it

A galaxy has to exist before anyone can join one.

```bash
cp .env.example .env
docker compose up -d
pnpm season migrate
pnpm season create --shard EU-1 --seed 4242 --unattended 8

pnpm dev                  # API on :3100, client on :5173
```

`--unattended N` places N inert commanders, already past newcomer grace, so a solo
developer has something to scout and raid. They never act. **Anything they appear to
teach you about balance is a lie.**

### On a phone

```bash
pnpm phone                # prints the LAN URL and a QR code to scan
```

The dev server binds to `0.0.0.0` and proxies the API through the same address, so
there is nothing else to start. The address comes from DHCP and changes; `pnpm phone`
resolves it and skips the half-dozen Docker bridge addresses that look identical in
`ifconfig`.

**Add it to the home screen.** There is a web manifest, so it installs and runs without
browser chrome. On a game played one-handed in four-minute sessions, the address bar is
a third of the difference between "a website" and "an app" — and the playtest happens
on a phone.

If it will not load: check the phone is on the same network, and that the router does
not have client isolation enabled.

```bash
pnpm shots ./out          # drive the running client and photograph every screen
```

## Testing strategy

| Layer | Covers | Count |
|---|---|---|
| Rule units + properties | Combat, economy curves, travel, clarity gradient, detection, dominion — plus invariants asserted over *all* inputs with fast-check | 82 |
| **Season regression** | A full 14-day season on three seeds, asserting the balance invariants stay in band | 30 |
| Persistence & API | Real Postgres. Double-spend, deadlock ordering, the lazy tick, crash recovery, token-type confusion, fog enforced in the response, onboarding | 147 |
| Client | The fog as rendered, the launch preview, token refresh, the return overlay, the resource ticker | 33 |

The client tests are deliberately narrow: they cover what carries gameplay meaning —
that an unwatched planet never renders as `UNKNOWN`, that the exposure preview equals
what the server will compute, that a stale reading never loses its age — and nothing
about how a button looks.

Lint enforces the architectural boundary mechanically: `packages/rules` may not import
a Node builtin, another workspace package, `Math.random`, `Date.now`, or `new Date`.
If the rules ever acquire a clock, CI fails.

The season regression is the one that matters. A balance regression — someone
nudges a constant and the vault silently starts protecting 200% of storage
again — is invisible to unit tests and catastrophic in production. It is the
only thing that catches it.

## Balance invariants

Measured every simulated day; each names the lever that moves it.

| | Healthy | Meaning |
|---|---|---|
| `ARR` | 0.30–0.55 | Share of Wealth that is actually losable |
| `VFR` | 0.25–0.65 | **Raidable** stock as a share of raidable capacity |
| `TI` | −0.40–0.55 | Passive players' share of an active player's ladder position |
| `RR` | 1.3–3.5 | Dominion gained per unit spent gaining it |
| `SV` | 0.10–0.30 | Daily Wealth churn — the re-login driver |
| `TAX` | 0.10–0.45 | Share of a peaceful player's output taken by raiders |

---

## What the simulator found

Seven bugs and one structural problem, all resolved. One new problem found on the way
out, listed last, which needs real players rather than more simulation.

### 1. The vault curve was inverted — fixed

`vaultMult 1.50` exceeded `alloyMult 1.45`, so vault protection compounded faster than
the stock it protected. From level 3 onward the vault covered **208–301% of everything a
player could hold**. Nothing in the galaxy was raidable, all season, and no diagnostic
caught it because `VFR` was measuring raw fill rather than *raidable* fill.

Fixed to `vaultBase 300, vaultMult 1.30`, with the constraint written into `rules.mjs`
as a comment that must not be violated. `VFR` now measures raidable stock.

### 2. Haulers evaporated in round one — fixed

80 HP, taking 1.6× from every hull class. Attackers arrived with no cargo and raiding
could not pay for itself. Support hulls are now shielded while any combat hull on their
side survives, which is also a better mechanic: **bring enough escort to cover the cargo
you brought.**

### 3. No newcomer grace in the prototype — fixed

A new player was farmed to zero fleet and 57 alloy inside 45 minutes. Three testers
would have bounced before seeing the game. Grace is now 4 hours or Command Core L4.

### 4. Telescope unlock was a dead end — fixed

The unlock fired on a *surviving* fleet return, so a player who lost their first fleet
never got a telescope at all. It now fires on the first battle resolving either way —
losing the fleet and only then being handed a telescope is the better lesson.

### 5. Combat was graded on ATK×HP — fixed

`fleetPower` ignores the counter matrix, so 26 Wasps (power 8.7) and 1 Bastion
(power 8.8) read as equal while the Wasps annihilate it without a casualty.
Outcomes are now graded on **resource value destroyed** — correct, and legible to
the player as "you wrecked 64% of what he'd spent on defence".

### 6. Nobody built defence — fixed

23 Bastions across 140 planets. The bots bought buildings first and defence from the
leftovers, which meant it never got bought: buildings compound, so at the margin they
always look like the better purchase. **95% of all attacks resolved DECISIVE** — and
if blind raiding never fails, there is nothing for information to reduce. Defence is
now bought first, sized as insurance on what you are holding.

### 7. Raiding was 5% of the economy — resolved, three changes

An alloy invested compounds ~16× over a 336-hour season; an alloy stolen returns 1×.
Sweeping `lootDecisive` from 0.4 to 0.9 left the raid tax at 0.05 — the dial was
provably inert. Three changes, in this order:

**DISRUPTION.** A successful raid knocks the target's surface works offline — 180 min
on DECISIVE, 60 on PARTIAL, refreshing rather than stacking, capped at 240 min pending.
Buildings are never damaged, so the ownership pillar holds, but the victim now loses
*compounding* rather than merely stock. Raid tax 0.06 → 0.18.

**DOMINION replaces Empire Value as the ladder.**

```
Dominion = (looted from players + value of enemy units destroyed)
         - (looted from you     + value of your units destroyed)
```

Exactly zero-sum across the galaxy. Only combat generates it. It rewards winning
fights *efficiently*, which is what scouting buys — and it scores defence, because
repelling a raid destroys the attacker's ships. A turtle who is never attacked scores
exactly 0, so no anti-turtle machinery is needed anywhere else in the design. Empire
Value survives as **Wealth**: displayed, never ranked.

**DURABLE DEFENCE.** 60% of destroyed Bastions rebuild free from wreckage. Only safe
*after* the ladder moved to Dominion — under a wealth ladder this recreates the turtle
exploit. It restores genuine uncertainty to the attack decision, which moved the
measured value of scouting from break-even to **6-19x per raid**.

### Where it landed

Four seeds, 140 players, 14 days. The informed archetype tops the ladder every time:

```
GRINDER  median rank  12-15    median dominion  +22,400 .. +28,300   <- informed
FARMER   median rank  42-76    median dominion   -2,400 ..  +4,800
TURTLE   median rank  55-61    median dominion         0
RAIDER   median rank  93-101   median dominion   -5,100 .. -11,000   <- blind
CASUAL   median rank  93-120   median dominion   -8,900 .. -17,000
```

Blind aggression now loses money. Passive accumulation scores nothing. Information
wins. That is the shape the design was aiming at.

### 8. **The casual player gets farmed.** Still open.

The 2-logins-per-day archetype finishes at -10k to -17k Dominion on every seed, and
that is the stated target user. The vault floor, bash limits and newcomer grace are
not enough on their own. This is a tuning problem, not a structural one — it needs
real players and belongs at the top of the Phase 4 agenda. Candidate levers: scale
the vault floor by time since last login, or shorten disruption against players who
have been offline a long time.

### Known simulator limitations

The bots have no skill variance, so the spread between best and median player is
far narrower than a real shard would produce. Do not tune against ladder spread
using this tool.

---

## Phase 0 artefacts

`legacy/` holds the original JavaScript prototype and simulator that produced the
findings above. `legacy/prototype-standalone.html` is a single self-contained file
that runs on wall-clock time — open it, play for five minutes, close it, and come
back in three hours. It is still the fastest way to feel whether the core decision
works.
