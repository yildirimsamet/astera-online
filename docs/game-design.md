# Game Design

How the game works, system by system. Every system is listed with **the decision it
creates** — because a system that creates no decision does not belong here.

Formulas and constants: [balance.md](balance.md). Why each choice was made:
[decisions.md](decisions.md). Unfamiliar terms: [glossary.md](glossary.md).

> ⚠ **This document describes the intended design, not the current implementation.**
> Several systems here — the whole intel layer, asteroids, the season lifecycle — are
> designed and specified but **not yet built**. For what actually exists today, see
> [roadmap.md](roadmap.md).

---

## The loop

```
DEVELOP → ACCUMULATE → GATHER INFORMATION → SPOT OPPORTUNITY → CHOOSE TARGET
   → TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Step 9 feeds step 3. **The battle report is the most accurate intel in the game**, which
is what closes the loop: every fight teaches you something about a person you will fight
again.

### The session (4–6 minutes)

Open → the **return overlay** answers *"what happened?"* in under three seconds → check
intel → make one or two commitments → close with something in flight.

### The season (14 days, four acts)

| Act | Days | The galaxy feels like | The player is |
|---|---|---|---|
| Land grab | 1–3 | Everyone poor and blind, raids cheap | Learning who the neighbours are |
| The war | 4–9 | Vision matters most, veils go up | Choosing an identity |
| Consolidation | 10–13 | Fleets expensive, one bad read costs a day | Making fewer, better-informed attacks |
| **The sunset** | 14 | Upgrades no longer repay before the wipe | Hoarding — and so is everyone else |

The sunset is **engineered, not scripted**: because payback is ~8–24h and the season ends,
investment stops being rational on the final day. Every player independently reaches the
same conclusion, so the whole galaxy is simultaneously rich and undefended. The economy
produces the finale.

---

## Ownership — the planet

One planet per player. Named, at fixed 3D coordinates, **structurally indestructible**.

Raids and asteroids take shields, satellites, units, stock and *production time*. They
never touch buildings. This is the mechanical guarantee behind ownership: **you can be
robbed and set back; you cannot be un-made.**

Across seasons, the account keeps **record and cosmetics only, never power**. On a
200-player shard, inherited power would end competition within two seasons. What carries
over is who you *are*, not what you *have*.

---

## Progression — six buildings

The **Command Core** is the level ceiling: no other building may exceed it. That produces
one clean recurring decision — *raise the ceiling, or fill it in?* — and gives every player
a single legible "how developed am I" number.

| Building | Does | The decision it creates |
|---|---|---|
| **Command Core** | Level ceiling for everything else | Breadth now, or depth now? |
| **Alloy Refinery** | Alloy/hr and alloy storage | The default safe investment |
| **Crystal Extractor** | Crystal/hr and crystal storage | Slow, but gates everything interesting |
| **Vault** | Protected, un-raidable stock | Pure safety, zero yield — insurance you hope to waste |
| **Shipyard** | Unlocks hulls, sets probe stealth | Reach vs growth |
| **Orbital Ring** | Satellite slots | The identity choice |

Six numbers, one portrait screen, no scrolling. **This is a hard cap.**

**Construction is instant on payment.** No timers, no queues — see
[decisions.md](decisions.md) for why, and why it makes the panic session better.

---

## Economy — two resources

**Alloy** (common, builds everything) and **Crystal** (scarce, gates advanced hulls,
satellites and high building levels).

One resource makes every decision linear ("how much?"). Three creates bookkeeping without
a third real choice. Two creates *composition* pressure — the minimum viable interesting
economy.

**Storage caps at 12 hours of production.** Sleeping eight hours means arriving at ~80% —
close enough to feel the pressure, not so close that a normal night is punished.

### Why players hold raidable stock at all

Holding liquid resources is *strictly dominated* by spending them: score is identical the
instant you press the button, but the spender out-earns the hoarder from then on and
carries no raid exposure. **Hoarding for score is not a viable strategy.**

Players nonetheless sit on growing piles constantly, because **upgrade costs are lumpy**.
At level 10 an upgrade costs ~7 hours of production. The vault fills, gets spent to
near-zero, refills. That involuntary sawtooth — not any score incentive — is what makes
raiding worth doing. **Cost lumpiness is a hard requirement, not a tuning preference.**

---

## Fleet — four hulls

| Hull | Class | Mathematical job | Cost of using it |
|---|---|---|---|
| **Wasp** | Skirmisher | Cheapest attack per alloy, fastest → shortest exposure window. 1.6× into Bulwark-class, so it is the anti-turtle tool | 24 HP evaporates against Lances |
| **Lance** | Lance | Highest raw attack. 1.6× into Wasps — the answer to a swarm | 0.625× into Bulwark-class; useless against a fortified planet |
| **Bulwark** | Bulwark | 8.75 HP per alloy — the durability anchor. 1.6× into Lances | Speed 21 nearly doubles your exposure on any route |
| **Hauler** | Support | 900 cargo. **You cannot bring loot home without them, and they contribute nothing to the fight** | Every Hauler slot is a combat slot you did not bring |
| **Bastion** | Bulwark, ground | 1.8× more HP per alloy than any ship, because it can never leave | Cannot attack. Every alloy here is reach you gave up |

Counter cycle: **`WASP ▸ BULWARK ▸ LANCE ▸ WASP`** at 1.6× / 0.625×. Support hulls are prey
to everything and deal nothing.

**A fleet travels at the speed of its slowest ship**, so composition is a *time* decision
as well as a combat decision. Heavy fleets win fights and lose windows.

### The Hauler is the most important ship in the design

It is the mechanism that stops "send everything" from being universally correct. A pure
combat fleet wins the battle and carries almost nothing home; a hauler-heavy fleet carries
everything and loses. The optimal ratio depends on what you believe is in the target's
vault — **which is exactly the thing you had to scout to find out.** Loot capacity is
where the information layer cashes out into a number.

Support hulls are **shielded from fire while any combat hull on their side survives**.
This creates the escort decision: bring enough combat hulls to cover the cargo you brought.

---

## Combat

Three rounds, simultaneous fire, ±8% variance, no player input, no combat screen.

Variance is deliberately small: the whole game is built on information reducing
uncertainty. **If randomness dominated outcomes, intel would be worthless.**

Graded on **resource value destroyed**, not on `ATK × HP` — that metric ignores the counter
matrix, so 26 Wasps and 1 Bastion read as equal "power" while one annihilates the other.

| Grade | Condition | Loot |
|---|---|---|
| `DECISIVE` | No defending units survive | 50% of raidable stock |
| `PARTIAL` | ≥60% of defender value destroyed | 25% |
| `REPELLED` | Below that | Nothing |

Three grades rather than win/lose: binary outcomes make marginal attacks worthless and
punish good-but-imperfect reads.

### The defence chain

```
Aegis shield → ground defence → home fleet → loot phase → disruption
```

**60% of destroyed Bastions rebuild free from wreckage.** Durable defence puts genuine
uncertainty back into the attack decision — with consumable defence, ~95% of attacks
resolved DECISIVE, and if blind raiding never fails there is nothing for information to
reduce.

### Disruption

A successful raid knocks the target's surface works offline: 180 min on DECISIVE, 60 on
PARTIAL. Refreshes rather than stacks, capped at 240 min pending.

**Buildings are never damaged** — the ownership pillar holds — but the victim now loses
*compounding* rather than merely stock. This is the only thing in the design that makes
raiding competitive with building over a season. See [balance.md](balance.md).

---

## The information layer — this is the game

Everything above exists so that this has stakes.

### The ladder of knowing

| Tier | Costs | Detectable | Tells you | Latency |
|---|---|---|---|---|
| **Public** | Nothing | No | Planet exists, owner, coordinates, Core tier | Live |
| **Telescope** | A satellite slot | **No** — you are never told who is watching | Fleet `HOME` / `AWAY` / `UNKNOWN`; return ETA at clarity ≥ +2 | Live to 20 min stale |
| **Explorer** | Ships + flight time | **Yes** — radar can catch the probe | Stock, defence, fleet size, at an accuracy tier | One shot |
| **Combat** | Ships, permanently | Obviously | Ground truth | Perfect |

Telescope is cheap, silent, and tells you **when**. Explorer is costly, loud, and tells you
**what**. Neither substitutes for the other, so both stay live all season.

> **The most valuable fact in the game is "is their fleet home?"** Opportunity and fear are
> the same mechanic seen from two ends. Every other piece of intel is context for that bit.

### Telescope vs Veil — the clarity gradient

```
Clarity = observerTelescopeLevel − targetVeilLevel

  ≥ +2   FULL          status + return ETA, live
    +1   CLEAR         status only, live
     0   INTERMITTENT  shown, refreshes only every 20 min, 25% of refreshes dropped
    −1   DEGRADED      reads UNKNOWN 70% of the time
  ≤ −2   BLIND         always UNKNOWN
```

**The interesting state is `INTERMITTENT`**: real information that may be stale. The player
sees *"fleet HOME — 18 min ago"* and must decide whether that is still true. Matching a
rival's Veil is not a wall you bounce off; it is a fog you have to reason inside.

The Veil **hides, it never lies** — status becomes `UNKNOWN`, never a false `HOME`. Active
deception is post-MVP, and `UNKNOWN` already lets players bluff on their own at zero cost.

### Explorer

```
detectChance = clamp(0.25 + 0.18 × (radarL − probeStealthL), 0.05, 0.95)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)
```

Reports are **bands, not numbers**. A cheap scout says "somewhere between 30k and 80k"; an
expensive one says 61,000. Those are genuinely different decisions, which is what makes
probe level worth paying for. Floors and ceilings guarantee that no investment ever buys
perfect invisibility or perfect omniscience — **the fog never fully lifts.**

### Radar

| Level | Detects | Message |
|---|---|---|
| L1 | Probes | "Scan detected." |
| L2 | + bearing | "Scan detected from galactic north-west." |
| **L3** | **Incoming fleets** | "Incoming fleet. ETA 9 min." |
| L4 | + size estimate | "…est. 60–90 ships." |
| L5 | + exact origin & composition | "GRIMHOLD · 74 Wasp, 20 Lance, 12 Hauler." |

The warning fires at **`arriveAt − lead(radarLevel)`**, not at launch: a 40-minute flight
must not give 40 minutes of notice. Higher radar buys a longer fuse; the panic window
stays tight.

**Radar L3 is the highest-value ten lines of code in the project.** A push saying
*"Incoming fleet · ETA 9 minutes"* converts a passive loss into an active decision, because
the player still has three real options: **spend the stock** so there is nothing to take,
**launch their own fleet out** so it survives, or **stand and fight**. They cannot recall.
Every choice costs something. This is the most intense thing an async game can do, and it
needs no realtime infrastructure at all.

---

## Satellites — the identity choice

`slots = 1 + floor(ringLevel / 2)`. Realistic season ceiling is **4 slots against 5 types**.
Nobody runs everything, and that scarcity is where player identity comes from.

| Satellite | Effect | Gives up |
|---|---|---|
| **Telescope** | Watch L planets; ETA at L3+ | Everything else — knowledge without protection |
| **Radar** | Probe detection; inbound warning at L3+ | Reach — radar wins nothing on offence |
| **Aegis** | Shield HP, 5%/hr regen; absorbs asteroid impacts | Vision entirely — safe and blind |
| **Veil** | Degrades enemy telescopes | Your own vision slots |
| **Drill** | Mines passing asteroids | Both safety and sight, for economy |

Four archetypes fall out without being classes anyone selects:

**The Watcher** (Telescope ×2 · Radar) attacks rarely and never misses — loses to anyone
who simply out-builds them. **The Ghost** (Veil ×2 · Radar) is unreadable — loses to probes,
which the Veil does not stop. **The Fortress** (Aegis ×2 · Radar) cannot be profitably
raided — loses to repeat raids inside the 20h shield-regen window. **The Prospector**
(Drill ×2 · Aegis) is crystal-rich and completely blind.

Satellites are destroyed with a 10% chance each when ground defence is fully broken, so an
identity build is never a riskless permanent investment.

---

## Galaxy, travel, and the world

**A thin disc**, radius 1000, ±120 thickness — legible on a portrait phone at any zoom, and
it looks like a galaxy. Designed skeleton, randomised placement, **deterministic from the
season seed** so the client can regenerate the static layout instead of downloading it.

Each player has 8–15 planets within 12 minutes' travel. That set is their world for the
season; the rest of the galaxy is aspirational.

```
travelMinutes = 3 + (distance / slowestShipSpeed) × 1.2
```

Distance is the real map boundary — no artificial range cap is needed, because a
cross-galaxy round trip in Bulwarks already costs two hours of being undefended.

**Asteroids** orbit analytically — position is a pure function of the clock, never stored,
never simulated. Impacts are solved once at season generation and announced 40 minutes
ahead. This is what makes a living galaxy cost zero server work and zero realtime
bandwidth. The emergent bit the game never mentions: an impact strips a known player's
shield at a known minute, which makes the following 41 minutes the best raid window
available to anyone paying attention.

---

## Competition — Dominion

```
Dominion = (looted from players + value of enemy units destroyed)
         − (looted from you     + value of your units destroyed)
```

**Exactly zero-sum across the galaxy. Only combat generates it.** It rewards winning
fights *efficiently*, which is precisely what scouting buys.

It also **scores defence**: repelling a raid destroys the attacker's ships, which is
Dominion for the defender. A fortress that is never attacked scores zero; a fortress that
is attacked and holds, climbs.

A player who never fights scores exactly 0 and sits mid-table however rich they are —
which is why **no anti-turtle machinery is needed anywhere else in the design.**

Net worth survives as **Wealth**: displayed, never ranked. See [balance.md](balance.md)
for the measurement that killed it as a ladder.

---

## The return moment

The single most important screen in the game. It must answer *"what happened?"* before the
player asks.

```
┌─────────────────────────────────────────────┐
│  WHILE YOU WERE GONE            3h 06m      │
├─────────────────────────────────────────────┤
│  ⚔  Your fleet returned.                    │
│     +8,400 alloy.  1 ship lost.       [>]   │
│  ⛏  +21,300 alloy accumulated.              │
│  ★  TELESCOPE UNLOCKED                      │
│     You may watch one planet. Choose one.   │
└─────────────────────────────────────────────┘
```

Three kinds of line: **what I did** (resolved), **what accrued** (passive), **what's new**
(unlock). Never more than five entries. Never a wall of logs.

And critically — **the return does not close the loop, it re-opens it.** The player picks a
planet to watch, and the very next thing they see is *"GRIMHOLD — fleet departed orbit,
40 min ago."* A new unresolved thread, created by the act of returning.

## Notifications — four types only

`incoming fleet` · `fleet returned` · `raided while away` · `scan detected`

Explicitly excluded: "your storage is full", "we miss you", daily login bonuses, streak
warnings. Every one of those is a dark pattern.

## The unlock cascade

No tutorial exists. Each system unlocks at the moment the player feels its absence:

| The feeling | Unlocks | Trigger |
|---|---|---|
| "I want to do something." | Fleet + Attack | t = 0 |
| "Where did his fleet go?" | **Telescope** | First fleet resolves — win *or* lose |
| "Was someone poking at me?" | **Radar** | First incoming scan or attack |
| "I can't tell if he's rich." | **Explorer** | First ambiguous telescope reading |
| "I don't want to be seen." | **Veil** | First successful scan against you |
| "I can't run all of these." | **Satellite slots** | Orbital Ring L2 |

The telescope unlock fires on the first battle resolving *either way*. Losing your first
fleet and only then being handed a telescope is the better lesson.
