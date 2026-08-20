# Glossary

Terms that appear across the code and docs without explanation. In rough order of how
often you will hit them.


## Score and standing

**Dominion** — The season ladder. `(looted + enemy value destroyed) − (lost + own value
destroyed)`. Zero-sum across the galaxy; only combat generates it. A player who never fights
scores exactly 0.

**Wealth** — Net worth: everything you own, valued at what it cost. **Displayed, never
ranked.** It was the ladder for most of the design phase until the simulator killed it.


## The information layer

**Clarity** — `observerTelescopeLevel − targetVeilLevel`. Determines what a telescope
actually shows, across five states.

**FULL / CLEAR / INTERMITTENT / DEGRADED / BLIND** — The five clarity states. `INTERMITTENT`
(clarity 0) is the interesting one: real information that may be stale.

**Veil** — The ground instrument that degrades enemy telescopes watching you. It **hides, it
never lies** — status becomes `UNKNOWN`, never a false `HOME`.

**Probe / Explorer** — An active, costly, *detectable* scouting mission. Returns stock,
defence and fleet size as a **band**, not a number. Accuracy improves with probe level.

**Band** — A probe result expressed as a range (`30k–80k`) rather than a figure. A cheap
scout gives you a wide band; an expensive one gives you near-truth.

**Windowed seeding** — Telescope reads are seeded from `(watchId, floor(now / 20min))`, so
a reading is identical however many times it is requested inside its window. Without it, a
player defeats the fog by pulling to refresh.

**Radar reach** — How far from your world a radar catches an inbound fleet. L3: 200 units,
L4: 340, L5: 500. It is a CIRCLE, not a countdown, so how much warning it buys depends on how
fast the attacker chose to fly — a slow fleet is telegraphed and a fast one is not. D49.

**The panic session** — The player receives *"Incoming fleet · ETA 9 min"* and has three
real options: spend the stock, launch their own fleet out, or stand and fight. They cannot
recall.


## Combat and fleet

**Wasp / Lance / Bulwark** — The three combat hulls, forming the counter cycle
`WASP ▸ BULWARK ▸ LANCE ▸ WASP` at 1.6× / 0.625×.

**Hauler** — The cargo hull. 1,800 cargo, zero attack. **You cannot bring loot home without
them.** Shielded from fire while any combat hull on your side survives.

**Bastion** — The heavy ground gun. Cannot travel, 1.35× more HP per resource than any ship,
and 60% of destroyed ground units rebuild free.

**DECISIVE / PARTIAL / REPELLED** — The three battle grades, by share of defender *value*
destroyed. Loot 50% / 25% / 0% of raidable stock.

**Salvage** — The 60% of destroyed ground defence that rebuilds free. It exists so that
blind raiding can actually fail.

**Exposure window** — `oneWayTravel × 2`. How long your planet is weakened after a launch.
The UI leads with this number.

**Development tier** — `ceil(coreLevel / 3)`, public on every world in the galaxy. It decides
the silhouette the disc draws and, since D49, **who you may attack**: a world may fight
anything within ±2 tiers of itself.


**Ground defence** — the two guns that never leave a planet: the **Bastion** (heavy,
Bulwark-class, breaks Lances, overwhelmed by swarms) and the **Thorn** (light, cheap,
Skirmisher-class, tears into heavy hulls, picked apart by Lances). Opposite classes on
purpose, so what a planet is strong *against* is a choice the defender makes and a question
the attacker has to answer. D27.

**Flight bay** — one of the slots a planet has for craft that are away. Every raid, probe
and mining run holds one for its whole round trip; the Command Core opens them at
`3 + floor(core / 3)`. A dark bay is the game's only return hook. D28.

**Wreckage / debris field** — what a battle leaves at the defender's planet: a tenth of the
resource value of every non-ground hull destroyed on both sides, public to the whole galaxy,
gone in three hours. Anyone can fly craft out and take what is left, and it is Wealth only — the
Dominion ladder never sees it. D32.

## Economy

**Alloy / Crystal** — The two resources. Alloy builds everything; crystal is scarce and
gates advanced hulls, satellites and high building levels.

**Vault floor** — The flat, absolute amount of each resource that cannot be looted. Small
players are nearly fully protected; large players nearly fully exposed.

**Raidable stock** — `max(0, stock − vaultFloor)`. The only part of a treasury that can be
taken.

**Disruption** — A successful raid knocks the target's surface works offline (180 min
DECISIVE / 60 PARTIAL). The victim loses *compounding*, not just stock. Buildings are never
damaged.

**Lumpiness** — Upgrade costs being large relative to income, which forces players to sit on
growing piles between purchases. This — not any score incentive — is what makes raiding
worth doing.

**Payback** — Hours for an upgrade to repay its own cost. Lengthens with level, which is the
brake that stops a 14-day season running away.

**The sunset** — Day 14, when payback exceeds remaining season time and every player
independently stops investing. The whole galaxy ends up simultaneously rich and undefended.


## Systems and architecture

**Command Core** — The main building. It is the level ceiling: no other building may exceed
it.

**Instrument** — One of the four on the GROUND: Telescope, Radar, Aegis, Veil. Levelled,
takes no orbit slot, capped by the Command Core like any building. D25.

**Satellite** — One of the four in ORBIT: Uplink, Foundry, Derrick, Beacon. Takes a slot,
bought once, and has no levels at all. Each changes a different number across the whole
planet, which is where player identity comes from. D25.

**Orbit slot** — Opened by the Command Core at L1, L3, L5 and L9. Four slots against four
satellites is not a checklist: the fourth is a Core 9 planet, so most worlds run one, two
or three all season. The Orbital Ring, which used to sell these, was retired in D22.

**Lazy tick / lazy evaluation** — Continuous state (resources, shields) is computed on read
rather than on a timer. Production for 300 players costs zero background compute.

**Scheduled event** — A row in `scheduled_events` for anything that must happen at a moment
even if nobody is watching: fleet arrival, radar warning, asteroid impact, season end.

**`SKIP LOCKED`** — The Postgres clause that lets multiple workers claim events with zero
coordination and never touch the same row.

**The reaper** — Returns abandoned claims (a worker that was killed mid-event) to the queue
after 5 minutes.

**Mission** — A fleet in flight. Holds `departAt` / `arriveAt`; position is never stored,
because the client interpolates it.

**Return leg** — The journey home. Its `origin` is the planet that was raided and its
`target` is the attacker's home — it travels *backwards*, which has already caused one bug.


## Design vocabulary

**Design Law #1** — A player must never reach a state where nothing is pending. Outranks
every other rule.

**Design Law #2** — Every system unlocks at the moment the player feels its absence. No
tutorial exists.

**The Return Test** — The project's acceptance gate. Understood in 60 seconds, one
irreversible commitment inside six minutes, exits with an unresolved thread, and on return
≥2 things changed the player did not cause.

**The unlock cascade** — The order systems appear in: fleet → telescope → radar → explorer
→ veil → satellite slots, each triggered by the player feeling its absence.

**Product regression** — The game drifting toward a generic base-builder. Symptoms are listed
in `CLAUDE.md`.

**Archetypes** — The simulator's five bot behaviours: `TURTLE`, `RAIDER`, `FARMER`,
`CASUAL`, `GRINDER`. `GRINDER` is the informed player, and the design's central claim is
that it should top the ladder.

**The six invariants** — `ARR`, `VFR`, `TI`, `RR`, `SV`, `TAX`. Balance health checks
measured every simulated day. Defined in [balance.md](balance.md).
