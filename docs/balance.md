# Balance & Mathematics

Where every number came from and which relationships must never break.

**`packages/rules/src/constants.ts` is authoritative; this file explains it.** If a number here
disagrees with the constant, the constant wins and this file has drifted. `PROVISIONAL` values are
settled by playtest, not by argument.

`docs/economy-v2.json` and `tools/economy-v2-model.mjs` preserve the Economy v2 baseline used for
comparison. The active tempo profile and its current tables come from `packages/rules/src/tempo.ts`
and `pnpm balance:economy`; `pnpm balance:goal` validates the fixed progression target.

**Where the shapes came from.** OGame's production (`30 · L · 1.1^L`), cost growth near 1.5,
build time as cost over a throughput, and 30% debris are the genre's proven forms, re-derived here
for a 14-day round rather than copied. Travian's speed servers supplied the rule that a short round
is not the same game faster — travel is tuned separately from economy, which is why hull speeds and
the disc moved together while prices did not. Lanchester supplied the quantity the hull table is
priced on.

---

## The invariants tests enforce

Breaking one is not a balance regression — it is a broken game, usually silently.

**`protectedHoursPerVault / capHoursPerVault < 0.5`.** At most half a store may ever be safe. The
old form of this rule was `vaultMult < alloyMult`; both guard the same silent failure, where
protection outgrows the stock it protects until nothing in the galaxy is raidable. The first draft
shipped 1.50 against 1.45 and killed the PvP economy for a whole season before the simulator caught it.

**`upgradeCost(L).alloy < storageCap(L, vault)`.** If one upgrade costs more than a full store can
hold, the player cannot buy it and progression stops for a reason nothing in the interface explains.
The pre-v2 curves crossed at L10 — this bug shipped.

**`crystalCostMult` is derived**, never picked: `costMult × (crystalMult / alloyMult)`. Two
hand-chosen multipliers drift and silently invert which resource is scarce.

**One ground gun finishes faster than a Radar L3 warning.** Construction is no longer instant, so a
warning is only worth something if a gun fits inside it. Measured: a Thorn at Shipyard 0 takes 45 s
against a 2.0-minute warning.

**Combat variance is ±8%.** If randomness dominated, intel would be worthless.

**Dominion is the uncapped realised raw-resource exchange and sums to exactly zero across every scored
battle.** `secured loot + enemy permanent loss - own permanent loss` is booked directly to the
attacker and its exact negative to the defender. It is additive and property-tested: splitting the
same realised exchange cannot manufacture score. A season-sized fleet loss may erase a
season-sized lead by design — fleet value is the stake — while a large fleet merely sent against a
small target earns only what it actually takes or destroys. Rulesets before v7 keep the historical
10,000-asymptote transfers already written to them. Current score terms use physical `A + C + D`;
D208's `A + 2C + 32D` value is reserved for fleet calibration, fuel and new merchant quotes.

**`START` is arithmetic:** it buys Core, Refinery and Extractor each 1→2 plus the active ruleset's
two guided-opening Darts, and not a unit more. D148 rederived it as `852 alloy · 72 crystal`;
`PLANET_START` is `1,259 alloy · 218 crystal · 40 deuterium` after the unchanged opening bonus.

---

## Economy

```
alloyRate(L)   = 83.16 × L × 1.10^L   per hour        — D161: was 92.4 (×0.90)
crystalRate(L) = 36.96 × L × 1.09^L   per hour        — D161: was 33.6 (×1.10)
deuteriumRate(L) = 3.34 × L × 1.04^L  per hour        — D161: was 2.905 (×1.15)

upgradeCost(L→L+1) = { alloy:   54.600 × 1.5400^L
                       crystal: 15.807 × 1.5260^L }   charged from L0

storageHours(vault)   = 14.667 + 0.978 × vault        — D161: both ÷ 0.9
worksHours            = 10                  — the uncollected buffer
protectedHours(vault) = 1.650 + 0.220 × vault         — D161: was 2.200 + 0.330
vaultProtects         = per resource, max(openingFloor, protectedHours × that rate)
                        openingFloorAlloy 662; crystal floor from the income ratio
deuteriumCap          = half the crystal cap of the same kind
```

**D161 — the owner's rate pass, and its two forced neighbours.** Alloy ×0.90, crystal ×1.10,
deuterium ×1.15, on the three bases only: the shape, the growth terms and the relative ladders are
untouched. Alloy was the resource nobody ran out of, crystal gated every upgrade, and deuterium —
which is also fuel — decided whether a session could end with something in the air.

Two things had to move with it and both were caught by tests rather than chosen:

- **Storage hours ÷ 0.9.** A store is denominated in hours of production, so a tenth off alloy income
  took a tenth off every alloy store while `upgradeCost` stayed where it was. At L20 that put a
  307,331-alloy upgrade against a 305,258-alloy store — the exact crossing the invariant above
  exists to prevent, and it appeared immediately. Dividing by the same 0.9 restores the measured
  margin exactly: `costAlloy / storageCap` peaks at 0.906 at L20 again.
- **The reward table's crystal share, ~35% → ~44%**, because `rewards.test.ts` pins it to
  `crystalBase / alloyBase` rather than to a literal. The full table now pays 14,600 alloy and
  6,555 crystal.

**`crystalCostBase` deliberately did NOT follow, and that was measured.** Re-deriving it at the old
0.79 of income (0.2895 → 0.3538) pushes `paybackHours(1)` from 0.98 to 1.03 and breaks the day-zero
promise that the first upgrade repays inside one session. So the charged share falls to 0.65 of the
income share — inside the 0.6–1.0 band `invariants.test.ts` enforces, and on the loose side of it,
which is the direction this pass was asking for: crystal was supposed to get easier.

**The vault floor was cut with it (D161).** `protectedHoursBase` 2 → 1.5, `protectedHoursPerVault`
0.3 → 0.2, `openingFloorAlloy` 840 → 630, answering *"yağmalanabilir miktar bir şekilde artmalı"*.
The vault is the right dial and the loot share is not: a wider `lootDecisive` pays the attacker more
for the same fight, while a lower floor changes what is at stake for the DEFENDER. Against the new
store the protected share of a full store falls from a sixth to about a ninth at Vault 0, and from a
quarter to under a sixth at Vault 10 — the old pair grew faster than the store it sat in, so raiding
got worse as a season went on. `raidable.test.ts` holds the new ceiling at 0.18 for every Vault level.

**None of D161 has been through the simulator.** These figures are not tuned against the standing
D134 VFR blocker and must not be read as evidence about it.

**Production carries a linear factor, and that is the whole shape.** `base × L × g^L` (OGame's form)
is the only common shape that both doubles output at L1→L2 — the day-zero dopamine a 14-day season
needs — and decays to +16% per level by L18, which is the brake. A pure exponential has one growth
rate for ever.

**The Vault sets storage capacity as well as the floor**, because `upgradeCost` grows at 1.54 while a
flat store grows at `L × 1.10^L` and they eventually cross. Storage is 13.2 h at Vault 0 and 27.3 h
at Vault 16; `costAlloy / storageCap` peaks at 0.906 at L20, so every legal upgrade remains reachable
without turning most stored stock into empty, unraidable headroom. The ten-hour works remains the
offline cap.

**Ten hours of works is the single number that decides whether a casual player is excluded.**
Measured over a season: two logins a day wastes 28.8% of production against an active player's 6.5%.
That gap is the effort gradient.

### The payback curve is the brake

```
paybackHours(L) = totalCost(L) / (alloyRate(L+1) − alloyRate(L))
worthInvesting  = paybackHours(L) < hoursRemaining × 0.70
```

| Level | 1 | 8 | 12 | 16 | 18 |
|---|---|---|---|---|---|
| Payback | 0.9 h | 5.8 h | 18.3 h | 59.6 h | 108.3 h |

Cost grows at 1.54 against production at 1.10, so payback lengthens with level. **That drift is what
stops a 14-day season running away**, and it produces the sunset: every player independently stops
building on the last day, with no rule announcing it. **If you change the cost curve, re-derive the
season length.**

### The crystal share is derived, not chosen

Crystal cost share is held at **0.796 of the crystal income share at every level**. Not at parity: at
parity crystal is spent as fast as it arrives, the stores sit near empty and there is nothing left to
raid. Crystal must be spendable **and** worth stealing.

---

## Build time — three independent lanes

```
buildMinutes(item) = min(480, costTotal / throughput)      480 min = 8 h hard ceiling

  construction    40 × (1 + 0.20 × core)      buildings, instruments, satellites
  shipyard       260 × (1 + 0.35 × shipyard)  mobile hulls
  ground        1320 × (1 + 0.35 × shipyard)  Thorn, Bastion
  research       ×0.62 on the construction workload

queueDepth 3 per queue · Construction/Yard cancelRefund 0.5 · Research cannot be cancelled · system abandonment refunds in full
```

| Reaching level | 2 | 8 | 12 | 13 | 15 | 18 | 20 |
|---|---|---|---|---|---|---|---|
| Build | 2.3 m | 14.9 m | 1.04 h | 1.50 h | 3.17 h | 8.0 h | 8.0 h |

Dart at Shipyard 0: 1.2 m. Thorn at Shipyard 0: 51 s.

**Time is priced in resources**, so no price change can leave a build time behind, and one formula
covers everything. `defBase` is derived from the radar promise, not chosen — see the invariants above.

**Rules that are not obvious.** Gates read the projected state of *the same lane*, so Core 1→2 may be
followed immediately by Refinery 1→2 — but a Shipyard in CONSTRUCTION cannot unlock a hull in YARD,
because the lanes run in parallel and neither is ahead of the other. RESEARCH is commander-wide and
never occupies either world lane. Disruption stops the works, never queued work. Committed resources
stay in Wealth. `builtEver` rises only on completion. Construction/Yard cancellation is refused when
removing an order would change the meaning of a later one; Research cannot be cancelled at all.

---

## Combat

**The Death Star is hand-priced (D203).** 143,661 alloy · 71,832 crystal · 5,952
deuterium, exactly three times the preceding 47,887 / 23,944 / 1,984 table. It is
written out rather than run through `scalePrice`; tempo changes do not move it. The
Interception Grid charge is 43,100 / 21,551 / 1,787, a 50% component-wise increase
with nearest-integer rounding. The battery totals 66,438 against the weapon's 221,445
(30.0%) and remains strictly cheaper. Build times remain 60 and 30 minutes.

```
3 rounds · simultaneous fire · ±8% variance
counter cycle: SKIRMISHER ▸ BULWARK ▸ LANCE ▸ SKIRMISHER   at 1.6× / 0.625×
support hulls: prey to everything, deal nothing, shielded while escorted

grade on VALUE destroyed:
  all defenders dead        → DECISIVE → loot 70%
  ≥42% of value destroyed   → PARTIAL  → loot 35%
  below that                → REPELLED → nothing

defenceSalvage 0.60 · lootBufferShare 0.50 · engagementSeconds 10
```

### Pre-Fleet V2 executable baseline

This table documents the currently executable catalog and retires at the D148 season cutover. It
is retained during implementation so measured before/after comparisons have a stable source; it
must not be copied forward as the Fleet V2 price table.

| Hull | Class | ATK | HP | Speed | Cargo | Alloy | Crystal | Deut | Yard | atk·hp/V²×10⁶ |
|---|---|---|---|---|---|---|---|---|---|---|
| Wasp | Skirmisher | 15 | 25 | 130 | 45 | 240 | 0 | 0 | 0 | 6,510 |
| Lance | Lance | 78 | 112 | 100 | 60 | 820 | 260 | 0 | 2 | 7,490 |
| Bulwark | Bulwark | 106 | 662 | 65 | 90 | 2,150 | 730 | 0 | 4 | 8,460 |
| Hauler | Support | 0 | 210 | 85 | **2,200** | 1,100 | 200 | 0 | 1 | — |
| Runner | Support | 0 | 120 | 125 | 380 | 560 | 250 | 90 | 2 | — |
| Breacher | Lance | 55 | 300 | 78 | 0 | 1,250 | 550 | 200 | 3 | 4,125 |
| Bastion | Bulwark · ground | 118 | 906 | — | — | 2,400 | 800 | 0 | 1 | 10,440 |
| Thorn | Skirmisher · ground | 49 | 174 | — | — | 700 | 200 | 0 | 0 | 10,526 |
| Prospector | Support · mining | 0 | 150 | 825 | 300 | 650 | 200 | 0 | 1 | — |

**The table is priced on `atk · hp / value²`** — equal-budget power when damage is spread across a
force. Not attack-per-resource, which is the quantity that made the old Bulwark lose every
equal-budget matchup including against the Lance it counters. **A tech tier buys about 15%; the
counter cycle buys 156%.** Information beats tech, by construction.

These are the design-baseline prices used for the equal-budget derivation. The active tempo applies
`1.25×` to ordinary hull resources and, by owner instruction, an additional `1.15×` to the Crystal
component of every Crystal-bearing hull. A zero-Crystal hull such as the Wasp remains at zero; this
is a resource-mix adjustment, not permission to silently change combat stats.

Ground hulls are paid 1.6× for never leaving: they cannot loot and cannot take Dominion. The two sit
in **opposite counter classes** so that "how much defence" becomes "what *kind*" — a question only the
information layer can answer.

### D208 live fleet calibration

The current `32 : 16 : 1` calibration, complete live roster, simulator scope and
known season alarms are recorded in [`fleet-calibration-d208.md`](fleet-calibration-d208.md).
All earlier Fleet V2 tables below are historical evidence; they are not the live catalogue.

### Fleet V2 pricing contract (D148)

Fleet V2 keeps `atk · hp / value²` as the equal-budget combat check, but does not pretend it prices
speed, cargo, build time or strategic exposure. Each hull first receives a weighted authored stat
budget from its full Alloy/Crystal/Deuterium value; the all-pairs simulator then validates real
combat and mission outcomes.

Initial relative equal-cost combat-efficiency targets are 1.00 / 1.06 / 1.12 / 1.18 for tiers
1–4. These are calibration targets, not constants. Higher tiers reduce the penalty paired with a
similar specialization; speed profiles deliberately accept lower raw combat efficiency. Full tier
efficiency and Power × Armor research must remain below the 1.6/0.625 information/counter
relationship. Propulsion is evaluated separately through arrival time, Radar exposure and the
slowest-hull fleet rule.

Acceptance requires all-pairs equal-resource and equal-bulk matrices, mixed fleets, shielded and
shieldless Nullifier runs, cargo returns, fuel/travel/build-time costs and Bastion/Thorn fixtures.
No hull may win every role. If tier-4 hulls trivialize unchanged ground defence, Fleet V2 price,
stats or bulk move; D7/D27 ground values are not silently buffed inside this scope.

#### Historical Fleet V2 table — Phase 3 (superseded by D208)

Prices below are the executable post-tempo values; bulk remains price-derived in Dart units.
The Speed column is post-D152: D148's authored figure ×1.25, rounded to a whole unit. The lift is
uniform, so every efficiency figure and every profile relation in this table is unchanged by it —
`atk · hp / value²` does not read speed. The Prospector took no factor; the probe took none at
D152 and then ×0.75 at D153, closing the same gap from the other end (D152/D153).

| Hull | T | Profile | Class | ATK | HP | Speed | Cargo | Alloy | Crystal | D | Yard | Bulk | Efficiency ×10⁶ |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Dart | 1 | Raider | Skirmisher | 18 | 19 | 200 | 35 | 300 | 0 | 0 | 0 | 1 | 3,800 |
| Pike | 1 | Striker | Lance | 58 | 21 | 144 | 25 | 400 | 129 | 0 | 0 | 2 | 4,352 |
| Rampart | 1 | Fortress | Bulwark | 14 | 148 | 75 | 20 | 500 | 201 | 0 | 0 | 2 | 4,217 |
| Warden | 1 | Escort | Bulwark | 31 | 70 | 131 | 35 | 515 | 158 | 31 | 0 | 2 | 4,378 |
| Courier | 1 | Transport | Support | 0 | 90 | 181 | 700 | 625 | 216 | 63 | 1 | 3 | — |
| Viper | 2 | Raider | Skirmisher | 50 | 89 | 213 | 55 | 750 | 187 | 63 | 2 | 3 | 4,450 |
| Talon | 2 | Striker | Lance | 125 | 79 | 150 | 45 | 1,063 | 331 | 100 | 2 | 5 | 4,424 |
| Stronghold | 2 | Fortress | Bulwark | 45 | 617 | 81 | 50 | 1,750 | 647 | 100 | 2 | 8 | 4,453 |
| Sentinel | 2 | Escort | Bulwark | 118 | 198 | 138 | 65 | 1,500 | 604 | 188 | 2 | 8 | 4,448 |
| Wayfarer | 2 | Transport | Support | 0 | 260 | 138 | 2,200 | 1,125 | 431 | 250 | 2 | 6 | — |
| Tempest | 3 | Raider | Skirmisher | 155 | 204 | 231 | 80 | 1,750 | 647 | 200 | 4 | 9 | 4,688 |
| Ballista | 3 | Striker | Lance | 290 | 212 | 156 | 70 | 2,250 | 1,006 | 350 | 4 | 12 | 4,728 |
| Leviathan | 3 | Fortress | Bulwark | 180 | 941 | 88 | 100 | 4,000 | 1,653 | 350 | 4 | 20 | 4,700 |
| Praetorian | 3 | Escort | Bulwark | 240 | 451 | 144 | 110 | 3,125 | 1,294 | 375 | 4 | 16 | 4,710 |
| Atlas | 3 | Transport | Support | 0 | 800 | 94 | 6,000 | 2,625 | 1,366 | 500 | 4 | 15 | — |
| Nullifier | 3 | Shield Breaker | Lance | 140 | 308 | 119 | 20 | 2,000 | 1,150 | 350 | 4 | 12 | 3,520 |
| Cataclysm | 4 | Striker | Lance | 800 | 448 | 106 | 160 | 5,250 | 2,444 | 813 | 6 | 28 | 4,952 |
| Citadel | 4 | Fortress | Bulwark | 300 | 1,656 | 56 | 180 | 6,250 | 3,019 | 750 | 6 | 33 | 4,949 |

**Fuel mass is bulk × the tier's thirst rung (D153):** ×1, ×2, ×4, ×5 for tiers 1–4. Bulk stays
Hangar room and is unchanged, so nothing in this table moves; `missionFuel` is fuel mass × distance
÷ `FUEL.scale`, rounded up per leg. Tier 1 is excluded by instruction, so `PLANET_START.deuterium`
still buys the same run of opening launches. The measured consequence is that the weapon ladder,
priced in deuterium from its second rung, now competes with flying: on the D148 pacing fixture the
leading grinder reaches `SHIP_POWER` 4 on day 13 rather than day 12 of a fourteen-day season. Real
playtesting owns that number — the bots still log in on async-era assumptions.

The 225-pair equal-resource matrix and the same 225 pairs at equal bulk both preserve every strong
and weak edge of the counter cycle. A no-research Dart still trades up into a Rampart while a
max-Power/max-Armor Pike trades down into it. The preserved Bastion/Thorn equal-value fixture
destroys more than half the attacking value; neither ground hull was changed. Tempest remains the
combat speed ceiling. Courier crosses faster, while Atlas carries more per resource, so neither
transport dominates both mission axes.

### Loot

```
raidable = max(0, storage − vaultFloor) + works × 0.50
loot     = min(raidable × gradeShare, surviving cargo)
```

**The 70% rule is the repeat-raid decay system**: successive decisive raids take 70%, then 21%, then
6.3% of the original pile. Diminishing returns arrive free, with no cooldown table and no extra state.

### Debris

```
share 0.30 of destroyed NON-GROUND hull value, both sides
decay 40 minutes · no field below 250
```

30% is OGame's own default. A partly-refunded loss is a loss people will take, which is what makes
commanders throw fleets at each other in the last days instead of hoarding them. Ground hulls
contribute nothing — they already have 60% salvage, and counting them twice makes a fortress profit
from being attacked. **Debris is strictly downstream of combat: if raiding stops, debris stops.**

---

## Travel and the world

```
oneWayMinutes = (distance / slowestHullSpeed) × 1.2

GALAXY sphere radius 2000 · maximum crossing 4000 · minSeparation 225      (web SCALE 50)
```

**The playable boundary is a real 3D sphere.** Candidate radii use cube-root sampling, so equal-volume
shells receive equal populations; all three axes have the same gameplay scale. At the 300-capital
layout, the sphere creates the following five-seed neighbourhood means:

| Config | nearest | 10th nearest | 25th nearest |
|---|---|---|---|
| 50 @ 1000 — where the balance was tuned | 163 | 510 | 1004 |
| 351 @ 1000 — production before v2 | 104 | 204 | 302 |
| **300 @ sphere R2000** — now | **323** | **707** | **994** |

Measured Fleet V2 tempo: a Dart reaches the production layout's 10th-nearest world in **10.6 min
round trip**, its 25th in **14.9 min**. A Citadel round trip across the full diameter is about
**3 h 33 min**.

**The settlement claim window is DERIVED from this table, not chosen against it (D111).**
`SETTLEMENT_CLAIM_MINUTES` is the two-Courier flight across `GALAXY_SPAN` — one diameter,
`2·radius` = 4,000 units — rounded up: **34 minutes**. There is no figure to tune. It was
typed as `30`, which was exactly right at radius 1000 and became wrong the moment the disc
moved, and the 2.5× pass listed every constant that took the factor without listing this one.

| At sphere radius 2000 | 30-min window | derived window |
|---|---|---|
| Settleable (capital, neutral) pairs | **47.8%** | 100% |
| Five-seed median capital→neutral · 1,899 units | 15.7 min | reaches |
| Five-seed worst capital→neutral · 3,950 units | 32.7 min — misses | reaches |

**What the change costs the season gate: nothing measurable.** Five seeds, 50 players, the
10/5/2 fixture, D111 and D112 together against unmodified master:

| | baseline | after |
|---|---|---|
| ARR (per seed, band 0.30-0.55) | .336 .331 .320 .325 .332 | .353 .337 .324 .325 .326 |
| VFR (per seed, band 0.16-0.65) | .180 .190 .198 .193 .184 | .184 .187 .182 .193 .185 |
| SV (per seed, band 0.10-0.30) | .212 .222 .225 .223 .220 | .205 .218 .222 .221 .220 |
| TI (pooled, band -0.40-0.55) | median -0.256 | median -0.187 |
| Neutral raids | 83 | 79 |
| **Settlements completed** | **8** | **31** |

Every band holds on every seed, PvP raid volume stays inside its 15% baseline check, and the
informed archetype still tops the ladder on all five. The one thing that moved is the thing
the change is for. Colonisation nearly quadrupling is not a balance result to trust on its
own — these bots act on `loginsPerDay` and the simulator still models an async game — but it
is the right direction and it moved nothing else.

---

## Information

```
clarity      = observerTelescopeLevel − targetVeilLevel
detectChance = clamp(0.15 + 0.13 × (radarL − probeStealthL), 0.05, 0.80)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)

INTERMITTENT: refresh ≤ every 20 min, 25% of refreshes dropped
DEGRADED:     reads UNKNOWN 70% of the time
```

Floors and ceilings guarantee that no investment buys perfect invisibility or perfect omniscience.
**The fog never fully lifts.**

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Telescope range | 950 | 1,150 | 1,250 | 1,450 | 1,600 |
| Watch slots | 1 | 1 | 2 | 2 | 3 |
| Re-point cooldown | 5 h | 4 h | 3 h | 2 h | 1 h |
| Telescope identify | 950 | 1,150 | 1,250 | 1,450 | 1,600 |
| Radar detect / timed warning *(provisionally merged)* | 1,200 | 1,450 | 1,700 | 1,900 | 2,200 |

The Telescope's moving-contact reach is capped at **1,600**, 80% of the sphere radius; comparing it
only with the 4,000 diameter is insufficient because a radius-sized sensor at the origin already
sees every valid coordinate. Radar out-reaches it at every rung. Its detection and timed-warning
tables are temporarily the same; splitting them restores the narrower surprise window recorded by D9.

**Telescope reads are seeded from `(watchId, floor(now / 20min))`**, so a reading is identical however
many times it is requested inside its window. Without this a player defeats the entire fog layer by
pulling to refresh. It is the easiest way to ship a broken information game.

Probes: `50 alloy · 30 crystal · speed 3,510` (×0.75 at D153), rationed by flight bays and by one launch per
target world per commander per hour (D121).

### What the disc itself gives away — the sensor horizon (D123)

```
identify(world) = sensorSphere(world, telescopeL, radarL).identify  naked-eye floor 750
detect(world)   = sensorSphere(world, telescopeL, radarL).detect    Radar L0 = 0
zone(craft)     = best sensorZone across every controlled world     NONE / CONTACT / IDENTIFIED
mass           = LIGHT < 8,000 ≤ MEDIUM < 40,000 ≤ HEAVY           in total hull value
```

**These are the numbers that decide whether scouting is worth anything.** Before D123 a public
contact carried its full roster and was published to every commander in the season, so the
Telescope sold nothing a logged-in player did not already have and Radar L4 and L5 sold
nothing at all. The measured consequence is the one the design cannot allow: at equal budget
the counter cycle is worth 156% and doubling the fleet is worth more than 200%, so with
information free, mass is strictly dominant.

**`baseRadius` is PROVISIONAL and it is the one number here a test cannot settle.** Too small
and the disc reads as dead, which breaks the Alive north star; too large and the ladder above
it never binds. The instrument is `node tools/visual.mjs` and a phone, not the suite.

**There is no departure shroud.** Visibility depends only on the craft's current position; the
payload withholds route intent rather than deleting the craft at the start of its leg.

**The mass buckets are read against `fleetValue`**, which is what the hull table is priced on,
so they move with prices instead of drifting away from them. Three steps rather than a ramp,
for the same reason `worldWeight` has three: a continuous size is a number no eye separates.

---

## Hardware

```
instrumentCost(id, L) = upgradeCost(L × 2) × mult      TELESCOPE ×3 · RADAR/AEGIS/VEIL ×2
shieldHp(L)           = 60 × 1.5^L, regen 35%/hour
```

`INSTRUMENT_LEVEL_WORTH` is **2**. At 1 the whole information layer is bought out by day two, which
makes the fog uniform and therefore decorative. At 2 the four instruments cost about one L15 building
step, while Telescope L1 still costs 165 alloy and the door stays open.

| Satellite | Alloy | Crystal | Effect |
|---|---|---|---|
| Uplink | 1,125 | 375 | Gates the Telescope and the Radar. Nothing else gates anything |
| Foundry | 3,400 | 1,190 | ×1.06 on everything the works produce |
| Derrick | 3,740 | 1,360 | ×2.6 mining hold, ×1.5 mining speed |
| Beacon | 5,100 | 1,700 | ×1.3 speed for every fleet that leaves |

Slots come from the Command Core at L1, L3, L5 and L9.

**`FOUNDRY.production` stays at 1.06.** It compounds twice — bots buy ground defence as a ratio of the
stock it raises — so at +8% TURTLE tops the ladder on every gate seed.

**These are priced well below the pre-v2 ratio to a building step, and that was measured.** Restoring
the old multiple moved `ARR` by 0.006 and cost `VFR` on one seed and the Core band on another.

---

## Other constants

```
disruption    20 / 7 / 0 min, cap 25 pending          [PROVISIONAL]
abuse         bash 3 per attacker per target per 12 h
season        14 days · investment horizon 0.70 · acts at 4/14, 8/14, 12/14
opening       START 870/78 · OPENING_BONUS 407/146 · PLANET_START 1,277/224
strategic     settlement 2 Couriers + 3,400/1,700 · Death Star 143,661/71,832/5,952, 60 min
              Interception Grid 43,100/21,551/1,787, 30 min
              both Death Star gates Core 12 · Shipyard 5 · recovery 2 h
research      Isotope 1,530 C · Dense Fuel 2,380 C + 195 D · Gravitic 3,230 C + 455 D
              Death Star Protocol 18,700 A + 6,120 C + 1,170 D
clan          5 seats · Core 7 · create 8,500 A + 5,100 C · adapt 12 h
              aid ×1.10, +1 aid-only bay · receiver limit 4 h A/C + 20% D cap / 24 h
              raid share 10% · purse 2 h A/C + 10% D cap · protected ceiling 49%
              personal bash 3 + clan bash 5 per target commander / 12 h
```

**The clan economy is bounded at both entry and receipt (D114).** Creation removes the
equivalent of a meaningful Core-7 decision, with extra Crystal deliberately targeting the
resource that accumulates late. Aid is valued per resource — cargo plus full hull build cost —
so sending ships cannot tunnel around the receiver's limit. The four-hour receiver window is
large enough to repair a mistake or seed a formation but too small to make five production
accounts behave like one treasury.

The loot share never creates resources. For five eligible members and 1,000 returned Alloy,
the pool is 100 and each offer is 20; only the offers that fit a purse are removed from the
attacker's landing. Rounding and blocked shares stay with the attacker. The purse's two-hour
production ceiling and the stricter `vault protection + unclaimed ≤ 49% of storage` ceiling
keep claimable safety below the design's half-store raidable invariant. Existing shares are
never deleted if a later world loss lowers the ceiling; new credits simply stop.

**The Death Star's economic effect remains explicitly unmeasured.** The reachability
figures below belong to the older, cheaper weapon and are retained only as history; D203's
3× price invalidates them as a current affordability claim:

| | |
|---|---|
| At Core 12 + Shipyard 5 by day 7 | 36 of 50, every seed |
| …by day 9, and unchanged thereafter | 41 of 50, every seed |
| War act opens | day 4 of 14 |
| Median end-of-season Crystal | 42,000–72,000 against a 15,000 craft |

Those rows no longer prove the current weapon is reachable on the same dates. Its one-hour
build and travel speed are unchanged; only the price moved.

**The simulator cannot speak to any of this.** It has never built a Death Star on any seed:
its bots reach one through `GRAVITIC_CHARGES`, which needs a GRINDER to raid a shielded
defender, and that has happened once in 750 bot-seasons. `packages/sim/test/strategic.test.ts`
drives the strategic layer directly instead.

### Asteroids

```
spawn         0.0345 per player per hour — 10.35/h and ~39 rocks visible at 300 players
orbit         radius 400–1900, closed 3D orbit, constant speed 350–750 units/min
life          2.5–5 hours, then gone for good
ore by level  [—, 800, 1600, 3200, 6000, 11000]   weights [—, .40, .27, .18, .10, .05]
crystal share 0.175–0.455, rolled per rock (30% below the former 0.25–0.65 band)
isotope       one seeded rock per 5 after hour 35, plus a bonus seam every 10 lanes = 11/50 (22%)
              10–25% Deuterium concentration, replacing Alloy; Crystal share remains intact
shower        5 starts/full Türkiye day · 60 min · ×5 new arrivals · 120 min post-end cooldown
quiet hours   Türkiye 00:00–08:00 target 1 of 5 starts, hard cap 2; not a blackout
```

The Crystal reduction does not reduce total ore. The removed share becomes Alloy; isotope
concentration still replaces Alloy independently after the Alloy/Crystal split.

**Spawn is per-capita or mining dies at scale.** A flat rate tuned at 50 players is six times thinner
at 300 and the field becomes irrelevant. At 0.030 a contesting commander draws about a quarter of a
day-1 income from rocks and under 2% of a day-7 one: a catch-up lever early, a race prize later.

The shower adds four independent deterministic arrival lanes while active; it does not multiply
the existing population, ore per rock, life or mining speed. Five non-overlapping one-hour windows
at ×5 imply an average daily arrival multiplier of `1 + (5 - 1) × 5 / 24 ≈ 1.83`. This is a material
economy/capacity increase and must pass simulator/playtest and 300-player qualification; the number
is not permission to loosen an existing health band.

Speed is **independent of level**, so a rich rock is not automatically a slow one, and the orbit is
**closed**, so a craft slower than a rock still has a meeting on a later pass. Interception is a root
find, not a speed comparison.

### Pirates (D150 · D155)

```
spawn         0.02 per seat per hour — 6/h at 300 seats, ~18 alive at any moment
orbit         radius 400–2000, closed 3D orbit, constant speed 94.54–126.40 units/min
              = 75% of Cataclysm and Dart speed ÷ TRAVEL.distanceFactor (D155/D203)
period        ~19.9 min at the inner edge to ~132.9 min at the outer, derived from the two
life          2–4 hours, then gone for good
level weights [—, .45, .30, .18, .07]                       levels 1–4
roster        2–5 ships, one guaranteed COMBAT hull AT the level, rest free below it
damage        ×0.50 / 0.65 / 0.75 / 0.85 on ATTACK only — never on hp
capture       0.75 / 0.50 / 0.35 / 0.30, DECISIVE only, weighted by roster count
hoard         fleetValue(roster) × 1.82, split 55% Alloy / 30% Crystal / 1.125% Deuterium
window        PIRATE.bearingMs = TRAFFIC.refreshMs × 2 = 10s — DERIVED, never typed
```

**What a commander actually meets.** Regenerate with `pnpm study:pirates`
(`tools/pirate-study.ts`), which reads the shipped constants rather than restating them.
Measured over the generated world positions of five seeds, counting distinct pirates that
enter a world's circles during an eight-hour session. Sixty-seven pirates are alive at some
point in that window.

| Instruments | p10 | median | p90 | share of the window |
| ----------- | --- | ------ | --- | ------------------- |
| naked eye | 13 | 21 | 27 | 31% |
| Radar 3 | 50 | 56 | 61 | 83% |
| Telescope 5 · Radar 5 | 60 | 64 | 66 | 95% |

The naked-eye p90:p10 spread is 2.1x, the same range the fourth-power orbit draw was adopted
to hold for asteroids — it is the same draw. **Sensor investment roughly triples
opportunity**, which is the point: the pirate lane is the first system where a Radar pays out
in targets rather than in warnings. A world sitting exactly at the galaxy centre is the
degenerate case and sees very few, because no orbit of radius ≥ 400 passes within 750 of the
origin unless its own radius is under 750; real capitals are off-centre.

**Every pirate is reachable, from anywhere, at either end of the hull catalog.** A closed
orbit comes back round, so the rendezvous exists whether the craft is faster or slower than
the pirate — that is what separates this from a straight-pass rock, which only a faster craft
can meet (`galaxy.ts`, `interceptOrbit`). Measured at 100% from the centre, the mid band and
the rim: flights of 3.6–23.4 minutes at the Dart's post-D152 speed of 200, and 12.4–74.2 at
the Citadel's 56, which is the slowest mobile hull the game sells.
`packages/rules/test/pirates.test.ts` asserts it at 100% rather than at a majority, because a
visible target you cannot reach is a refusal at the launch screen for something the disc is
actively showing you.

**Reachable was never the same as catchable, and for one release it was not (D155).** The
speed band above read 200–420 and justified itself as "deliberately under the rocks" — rocks
run 350–750. The comparison was against the wrong craft. A rock is chased by a Prospector at
825; a pirate is chased by a warship at 106–231, and a hull's catalogue figure is divided by
`TRAVEL.distanceFactor` to reach units per minute. On that one scale the old band was
**240–504: faster than every ship in the game**. `interceptOrbit` still answered — a closed
orbit always comes back round — but the earliest meeting was then a lap of waiting rather
than a lead, and the owner reported the symptom the rock lane produced before D40: the fleet
sets off somewhere unrelated.

Measured over the generated lane, 288 rendezvous from four origins:

| Chaser → target | median lead | share past the target | tail |
| --------------- | ----------- | --------------------- | ---- |
| Prospector → rock (D74, reference) | 0.232 laps · 83° | 13% | < 1 lap |
| Dart → pirate, old 200–420 band | 0.340 laps · 122° | 74% | — |
| Dart → pirate, D155 band | **0.138 laps · 50°** | 12% | 0.455 laps |
| Dart → pirate, D203 ×0.75 band | **0.121 laps · 43°** | 0% | 0.391 laps |

The ceiling asserted in `pirates.test.ts` is the rock lane's own — median under a quarter
revolution, worst case under one — so a future change to either the lane or the hull ladder
re-measures the geometry instead of assuming it. D203 slows both pirate endpoints by the
same 25%; every Skirmisher still outruns the full band, and a Citadel now also outruns its
slow end.

**"Profitable" is an equation, and it is measured rather than asserted.** `hoardValueMult` is
swept so this is positive for a fleet composed for the target and negative for one that is
not — the decision lives in that gap:

```
E[net] = min(hoard, fleetCargo(survivors))                       loot
       + (flyingValue(attackerLosses) + flyingValue(pirateLosses)) × DEBRIS.share   wreckage
       + captureChance[level] × E[fleetValue(one hull)]           the ship
       − fleetValue(attackerLosses)                               the cost
       − missionFuel(fleet, |origin − rendezvous|, legs: 2)       the fuel
```

Average net per raid, from the same tool:

| Composition | L1 | L2 | L3 | L4 |
| ----------- | -- | -- | -- | -- |
| sized for the target | 2,208 | 4,904 | 9,029 | 16,298 |
| sized, but no hold | 1,560 | 4,471 | 8,286 | 15,556 |
| sized, but no guns | −644 | −2,493 | −6,428 | −20,642 |
| fixed 40 Darts + 2 Couriers | 2,192 | 4,252 | 3,716 | −9,398 |

Re-measured after the owner's pirate tunes: `captureChance` raised to 0.75/0.5/0.35/0.3, and
`hoardShare.deuterium` cut twice — to 0.075, then to **0.008**, which is a ceiling rather than
a trim. It is set so the richest level-4 roster the generator can draw pays about 500
deuterium; the measured ceilings run 45 · 137 · 285 · 497. A flat cap was rejected because it
would have paid the same 500 at levels 2, 3 and 4 and flattened the one number a commander
prices the fight against.

**D178 · the shower is 10x by day and 5x at night.** Owner instruction. The night keeps exactly
the density it always had (5x through the calendar's own 00:00–08:00 TRT band) and the day is worth
twice that — a raise where somebody is awake to fly at it, and no change to the hours where a
denser sky mostly expires unseen. The bonus lane is `round(asteroidSpawnPerHour x (multiplier - 1)
x duration / 60)`, so an hour-long shower adds ~93 rocks by day against ~41 at night. The figure is
stamped per occurrence at deal time and consumes no randomness, so no window moves and no existing
rock changes; a season already dealt keeps its frozen figures until `season restamp` raises the
windows that have not opened yet.

**D176 raised that ceiling to about 700**, on owner instruction and by moving the share alone:
**0.008 → 0.01125**, measured against the same sixty thousand seeds per level, where the richest
level-4 roster is worth 44,404. The ladder keeps its shape and every level rises with it —
64 · 192 · 401 · 699 against the old 45 · 137 · 285 · 497 — so the level badge still prices the
fight. Deuterium remains a garnish by share: about 1.3% of a hoard's total value against alloy's
55% and crystal's 30%. The self-funding worry D136 raises was already moot at 0.008 and is no
less moot now — a two-leg pirate raid burns single-digit to low-double-digit deuterium against a
median level-4 hoard of 240 — but that is a statement about how cheap fuel is at this fleet
size, not a licence to grow the share again without re-measuring both.

**D204 raises every pirate resource by 30%.** The shared multiplier moves 1.4 → **1.82**;
the 0.55/0.30/0.01125 shares do not move. On the current hull roster, sixty thousand seeds per
level put the sampled Deuterium maxima at 70 · 165 · 390 · 986, preserving the level ladder.
These are raw hoards: battle grade and surviving cargo can still bind the delivered reward.
The monthly pirate allowance moves from 5% to 6.5% with the same factor, but admission is still
priced on the former ×1.4 hoard. That keeps existing deterministic pirate membership/indexes
stable while leaving enough safety-ceiling room for the larger hoards.

D204 changes the reward altitude but not the composition test: the measured lane still pays a
fleet built for every target level and still punishes an all-cargo fleet at every level. That sign
gap is the property this table exists to hold.

The shares sum to 0.86125, so a raw hoard is worth `1.82 × 0.86125 ≈ 1.5675` times the pirate
hulls' resource value before rounding. `pirate-study.ts` reads that shipped multiplier directly.

Two things that table has to keep saying. Bringing no hold leaves part of the prize behind —
cargo room is bought with combat power, so how much to bring is the raid decision from
`game-design.md` moved onto a target that cannot shoot first. And the fixed fleet now stops
paying somewhere between L3 and L4, which is what makes the level badge a number a commander
prices themselves against rather than decoration.

**Dials that may be turned, and dials that may not.** This is a brand-new resource tap sitting
on top of the standing VFR blocker, so the list is explicit. **Turnable:** spawn rate, fleet
size band, level weights, `hoardValueMult`, orbit speed band, life band, one-raid-per-world,
the flight bay, fuel. **Not turnable, for this or for any feature:** loot grade multipliers,
hull HP, `defenceSalvage`, the Hangar constants, and any acceptance band. Widening one of
those to make pirates pay is the move `CLAUDE.md` forbids outright.

Pirates move **no Dominion**: `bookBattle` is never called and the report's swing is stored as
zero, so the zero-sum property `invariants.test.ts` asserts is untouched by the whole lane.

### Trade ship (D156)

```
rate     32 alloy = 16 crystal = 1 deuterium — TRADE.rate = { alloy: 1, crystal: 2, deuterium: 32 } (D208)
         rounded L12 production reference; historical rulesets 5–7 retain D183's 1/2/9
speed    47 ÷ TRAVEL.distanceFactor (1.2) = 39.17 units/min — half the Atlas's catalogue 94,
         on the Atlas's own scale, never the rocks' 350–750 (D155's lesson, applied before it
         could repeat)
orbit    radius 600–1,600 — narrower than the rocks'/pirates' 400–2,000, because a public
         position has no sensor opportunity left to equalise, only distance fairness
window   fixed 01–03, 07–09, 15–17 and 21–23 Türkiye windows in ruleset 8; 120 minutes each
season   `MULTI_WORLD.rulesetVersion = 8`; rulesets 4–7 keep their frozen random calendars
dock     10s alongside before the return leg — the same shape as a raid's engagement window
```

**The rate is the measured production parity, not a round number.** At the L12 fixed-goal pace
this file's own Economy formulas give `alloyRate(12)` ≈ 3,480/h against `crystalRate(12)` ≈
1,134/h — a 3.07:1 ratio, which is where the 1:3 alloy:crystal price comes from directly.
Deuterium has no passive rate (`deuteriumRate = 0`, mined only, see Economy above), so its price
was set by comparison instead: the owner measured it against the roughly 60–160 alloy-equivalent
a Prospector run at an isotope rock nets per hour and priced it inside that band — generous enough
to matter against a starved Refinery queue without making the isotope rock a wasted trip under
D135's "Refinery is the floor, rocks are the ceiling" rule. This comparison is the owner's own
measurement rather than a checked-in tool's output — there is no `tools/trade-study.ts` the way
`tools/pirate-study.ts` backs the pirate numbers above, and it should not be treated as more
precise than "generous, inside the band" until one exists. The owner's first proposal — 20 alloy :
10 crystal : 1 deuterium — priced deuterium 3–8× cheaper than producing it: a single five-Atlas
convoy would have returned one to three DAYS of a developed world's own refinery output, which is
the finding that reopened the rate, not the 3:1 ratio itself.

**The worst-case round trip sits inside the window, with room to spare.** A rim world at 2,000 and
a merchant at 1,600 on the opposite side of the sphere are 3,600 units apart. The Atlas — the
slowest cargo hull, so this is also the slowest anyone can be caught making this trip — covers
that in 46 minutes, so the full round trip is 92 minutes against a 120-minute window, leaving the
10-second dock paid for. A sufficiently late launch is still honestly refused. `trade.test.ts`
asserts this bound.

**Dials that may be turned, and dials that may not.** **Turnable:** the daily appearance count,
the window length, the orbit band, the rate itself if the production-parity measurement moves,
and — should abuse ever be reported — a merchant fee or a per-world convoy cap, both of which the
owner has ruled out for now rather than forever. **Not turnable, for this or for any feature:**
health/acceptance bands, loot grade multipliers, hull prices, and the Hangar constants. Widening
one of those to make the rate land is the move `CLAUDE.md` forbids outright.

**The simulator does not model this lane or the Intergalactic Convoy.** Both public-event incomes
are explicitly excluded from ARR, VFR, progression and season calibration; feature correctness
tests cover caps, cargo, fuel, probability and exactly-once behavior without adding income to the
model. The merchant remains excluded for the same reason the simulator does not model the pirate
lane's real-time pacing: bots still run on async-era `loginsPerDay`, and a trade ship's whole
appeal is timing one convoy against a two-hour window inside a single login. Reading `VFR`
against this lane, or tuning the rate to move the standing D134 blocker, would be pricing a
benefit the model cannot see — exactly what this file's own "simulator never prices benefits it
does not model" rule forbids.

No Dominion moves on this lane either: `launchTrade` never calls `bookBattle`, so the zero-sum
property `invariants.test.ts` asserts is untouched by a fourth target class the same way it was
by the third.

---

## What the simulator cannot currently answer about D127

**`RR` is red and the reading is not interpretable.** Raid return — Dominion gained per unit
spent gaining it — sits at **0.89–0.99** against a band of **1.3–3.5** after D127 made the map
private. The band was not widened and must not be: `CLAUDE.md` is explicit that a health band is
never loosened to admit a feature.

Two fixes to the model were made first, and both are keepers:

- **A blind attacker is now genuinely blind.** The bot's unscouted estimate read `capsOf(q)` —
  the target's own building levels — so the "blind" attacker could see exactly how developed
  every world was and pick the richest. That was true while development was public. Correcting
  it brought `TI` back into band and restored Gravitic Charges discovery, both of which had gone
  red purely because the model was measuring a game with no fog in it.
- **A scouting archetype now scouts 90% of the time**, up from 70%. Skipping a probe was a
  plausible shortcut when the map narrowed the choice for free; with an unprobed world reduced
  to a point it is throwing a fleet at a coordinate.

**The second change made `RR` WORSE — 0.995 to 0.889 — and that is the finding.** A bot takes one
action per session, so a probe replaces a raid outright: scouting more means raiding less while
still paying for the fleet. The shipped game stopped charging that price at D121, which made
probes 36× faster specifically so a look costs a flight bay and about twenty seconds rather than
a turn. **The model prices scouting as a lost session and the game does not, so it cannot
evaluate a change whose entire purpose is to make scouting necessary.**

Three things follow.

1. **Do not tune constants against this number.** Loot grades, `defenceSalvage` and hull HP are
   the listed levers for `RR` and every one of them would be moved to fix an artifact.
2. **The bot session model is the fix**, and it is the "re-derive the simulator for real-time
   pacing" item that was already on the list. A probe should cost a bay and a short flight, not
   an action.
3. **The real question is a playtest question.** Whether raiding pays under D127 depends on
   whether players scout, and `docs/playtest-log.md` exists to measure exactly that: attacks
   preceded by a probe or telescope reading, target at or above 50%. No bot mix can answer it.

## The simulator

### Fixed-goal pacing calibration

The full season simulator answers population questions; it is a poor instrument for deciding how
long one explicit development route takes. Two smaller tools isolate that question from bot policy:

```bash
pnpm balance:economy   # formula, price, timer and storage relationships
pnpm balance:goal      # one attentive commander's exact target route
```

The fixed goal is Core/Refinery/Extractor L12, Vault L10, Telescope/Radar L5, all four satellites
and all four research projects. The route also buys the hidden prerequisites the checklist needs:
Shipyard L1 and two Prospectors. It runs the real three lanes, projected gates, manual collection,
level-dependent production, storage/works caps, Foundry output, building rewards and research clocks.
Dense Fuel and Gravitic discovery events are assumed to have been earned at their earliest legal
opportunity; inventing fake battles would make this economy diagnostic less honest, not more.

On the current working tempo, an eight-hour player reserving every collected unit for the checklist
finishes the non-research development package at **2d 02h 45m**. The complete checklist reads **8d 01h 44m**
only under the explicit assumption that two Derrick Prospectors deliver a net 300 Deuterium/day.
That final figure is therefore a Deuterium result, not proof that passive economy pacing is eight
days. Reserving 75%, 50%, 35% and 25% of collected Alloy/Crystal for the checklist moves the
development package to about **2d 06h 43m, 4d 00h 50m, 5d 10h and 7d 01h 22m** respectively.
The accepted D128 gate remains six to seven days at 50%, so `pnpm balance:goal` now fails by measured
design consequence after D134 moved Research out of Construction. Do not hide that conflict by
widening the gate or guessing at economy constants; it needs an explicit pacing decision.

The special-material assumption is plausible for one highly active miner but impossible as a
population average. Across five deterministic fields, the average supply is about 89,182 Deuterium
by day 8; even with perfect collection this funds all four projects for only **42–57 commanders**.
A single finisher needs roughly seven full rich-rock returns from two Derrick Prospectors and 2.0% of the
whole field supply. Do not tune Alloy/Crystal against the eight-day aggregate until the intended
split between development completion and the research tail is stated separately.

`packages/sim` runs a full 14-day season with five bot archetypes executing the real rules,
deterministically from a seed. **Its regression test runs on five seeds at 50 players** — the size the
game actually ships. Which invariants are asserted per seed and which are pooled is decided by
measured spread: `ARR`, `VFR` and `SV` per seed; `TI`, `RR` and `TAX` pooled.

```bash
pnpm sim -- --players=50 --seed=7
```

| | Healthy | Means | Lever if out of band |
|---|---|---|---|
| `ARR` | 0.275–0.55 | Share of Wealth that is actually losable | Building vs ship cost balance |
| `VFR` | 0.09–0.65 | **Raidable** stock as a share of raidable capacity | Upgrade lumpiness. LOW = nothing worth raiding |
| `TI` | −0.55–0.55 | Passive players' share of an active player's ladder position | Loot grades, Bastion efficiency, disruption |
| `RR` | 0–<2 | Dominion gained per unit spent gaining it; pooled by total exchange volume | Loot grades, salvage, hull HP |
| `SV` | 0.10–0.30 | Daily Wealth churn — the re-login driver | Loot %, travel times |
| `TAX` | 0.04–0.45 | Share of a peaceful player's output taken by raiders | Disruption, loot %, attack frequency |

Two of these were **redefined after they failed to catch the bug they existed for**: `VFR` measured raw
stock ÷ cap and read a healthy 0.50 all season while the vault protected 100% of it; `TAX` used a
median, which always read 0.00 because most players are not raided on any given day. **A diagnostic
that cannot fail is not a diagnostic.**

### What the pre-Fleet-V2 economy pass measured

**The gate is green on all five seeds**, with the bands unchanged. `ARR` was the last metric to come
in, and the thing that moved it was **modelling the build queue in the simulator** — a queue
rate-limits how fast resources become buildings, so they sit in the store, which is the losable side.
Five constant-level levers were tried first and none of them moved it: expressing the whole Vault
floor in hours (cost `TI` and the informed archetype), `protectedHoursBase` 2→5 (same), satellites
re-priced to the old ratio (+0.006, cost `VFR`), every archetype's military share +0.15 (unmoved), and
`costMult` 1.56→1.50 (Core hit 20 on every seed).

`ARR` passes as a **median over settled days** and dips to 0.26–0.27 around days 7–10. The mid-game is
building-heavy and the median masks it. Worth watching with real players.

**Simulator bots have no skill variance. Do not tune ladder spread against the simulator.**

### What Fleet V2 Phase 3 measured

The fixed seeds are `42, 7, 99, 4242, 1337`, 50 players and the historical 10/5/2 neutral fixture.
All 225 equal-value and 225 equal-bulk pure matchups pass, as do mixed counters, cargo escort,
Nullifier, preserved-ground, research-vs-counter and mission-cost fixtures. The full simulator passes
87 tests. Pooled RR is **0.658** (per-seed **0.643–0.680**), below the accepted 2× failure edge, and
the informed archetype tops the Dominion ladder on every seed.

Fleet research is a new recurring resource sink, so the old VFR snapshot is not the same economy:
settled medians now measure **0.111–0.128**. The VFR floor is rederived to **0.09**, retaining roughly
20% margin; the direct “Vault protects everything” regression still fails below it. Durable profiles
also move the peaceful-player TAX baseline to a pooled **0.060**; its floor is **0.04**, one-third
below the measured value. These movements are explicit calibration results, not bands widened to
hide a failing constant.

On seed 42 without the strategic layer, T3 first becomes producible around day 7; all six informed
bots can produce it by day 10. T4 is absent on day 7, becomes producible for part of the informed
cohort around day 12 and remains non-universal. That leaves a late-season use window without making
the opening a race to capitals.

Rejected simulator iterations are retained as design evidence: direct advanced-hull selection with
no research-fuel reserve stranded informed bots near zero Deuterium and left roughly 120k Alloy
unspent; restricting the adaptive mix to actually affordable hulls and reserving the next reachable
research price fixed it. A 120–240 minute intelligence lifetime caused repeated rescans rather than
informed attacks; 480 minutes restored the value of reports. Raising every archetype's attack chance
did not improve TAX and made the seed-99 turtle dominate, so that attempt was reverted rather than
being accepted as “more war.”

## 2026-09-08 — owner-authorized temporary simulator skips

While integrating Silent Space, an unchanged `f1fa09d` archive reproduced six
simulator failures: ARR LOW on seeds 42/7/99/4242/1337 (0.229/0.237/0.221/0.220/0.216),
and Fleet V2 research pacing's day-4 `SHIP_POWER <= 1` assertion. This replaces the
manual's stale description of the current failures as five VFR failures.

The owner explicitly requested recording and skipping these known failures so
integration can proceed. Only the five ARR cases in `season.test.ts` and the one
research pacing case in `fleet-v2-balance.test.ts` are skipped. Assertions, balance
bands and gameplay constants are unchanged. VFR, SV and all other simulator gates
remain active. Remove these skips when the pacing/balance work resolves the six
failures; a green suite with skips is not evidence that these balance issues are fixed.

## 2026-09-10 — the real population, measured (D188)

Five seeds, 50 players, 14 days. `by-archetype` is the audience brief: GRINDER on `heavy`,
CASUAL on `half`, the rest on `average`.

| | old `loginsPerDay` | `by-archetype` | band |
|---|---|---|---|
| ARR | 0.272–0.282 | **0.223–0.232** | ≥ 0.275 |
| VFR | 0.128–0.157 | 0.122–0.140 | ≥ 0.09 ✓ |
| SV | 0.145–0.156 | 0.122–0.124 | ✓ |
| TAX | 0.098–0.129 | **0.037–0.070** | ≥ 0.04 |
| TI | −0.010…−0.666 | 0.000 | ✓ (its normal reading) |
| Gravitic Charges | **0 / 30** | **30 / 30** | — |
| raids, 5 seeds | 4,175 | **23,323** | — |

**READ THE LAST ROW BEFORE TUNING ANYTHING.** 23,323 raids is 6.7 per player per day. That is
not a balance signal, it is `nextDecision` waking a player every two minutes while awake — a
ninety-minute evening is forty-five complete sessions, each able to launch. Every figure in
the `by-archetype` column is inflated by that, ARR and TAX included. **Fix the cadence first;
re-derive the bands after.** Tuning against this column would be tuning against a model that
is wrong in a second place.

The one row that is trustworthy today is Gravitic Charges, because it is a threshold rather
than a rate: the informed archetype could not afford its own research under a model that
spent 70% of the store ten times a day, and can under one that logs in four times.

## 2026-09-10 — the D185 sweep, and why it found nothing else

D184 and D185 removed the same defect twice — a ladder whose EFFECT grows by a flat rung
while its PRICE grows geometrically, so the top of it is unbuyable and therefore dead. Both
were found by accident. This is the deliberate sweep of everything else, so nobody has to run
it again.

**THE TEST THAT SEPARATES A DEFECT FROM THE DESIGN.** Not "does the price grow geometrically" —
most of them do, correctly. The question is whether the thing it buys EARNS. A producer's
price is geometric because its income is: paying twice as much at twice the income is flat in
the real numéraire, which is hours of production, and the growing repayment horizon is the
authored progression. A ladder that earns NOTHING has no repayment to grow against, so a
geometric price on it is just a wall. `season.ts` said this in passing years ago — *"a Hangar
earns nothing on its own — it lifts a ceiling — so `worthInvesting`, which prices an upgrade
against the hours of production left to repay it, cannot judge one."* That sentence is the
whole diagnostic.

**MEASURED, against a 30-day season's 2,262,063 resources:**

| Ladder | Earns? | Top of the ladder | Verdict |
|---|---|---|---|
| Core | gate on everything | L16 = 14% cumulative, L20 = 79% | fine — a real stretch, reachable |
| Refinery / Extractor | yes, directly | priced off their own delta | fine by construction |
| Deuterium Plant | yes | effect delta rises with price | fine |
| Vault | no, but enables | L16 = 21%, L20 = 116% | fine — the unreachable rungs are ones a 30-day season has no use for (210 hours of store) |
| Instruments ×4 | no | all four at L5 = 12% | fine — and this is the figure `INSTRUMENT_LEVEL_WORTH` was tuned to produce |
| ~~Hangar~~ | no | L8 alone = 196% | **removed, D184** |
| ~~Shipyard past its gate~~ | no | whole tail = 30,376% | **repriced, D185** |

So the defect was confined to the two ladders whose entire product was a non-earning ceiling
with a flat marginal benefit. No third instance exists.

**ONE UNRELATED THING THE SWEEP SURFACED, NOT FIXED HERE.** `instrumentCost(_id, level)` does
not read its `id`: Telescope, Radar, Aegis and Veil are priced identically at every rung. The
live `INSTRUMENT_COST_MULT` (3 / 2 / 2 / 2) is no longer consulted. Since Radar out-reaches
Telescope at every level, equal pricing makes Radar the dominant buy and quietly removes the
choice D22 priced open. Reported rather than changed — it is an owner decision about the
information layer.

## 2026-09-09 — D183 measurements, and one baseline correction

**The pirate ETA drifts by laps, not by seconds.** Swept 20,000 `interceptOrbit`
solves across the pirate orbit band (radius 400–2,000, speed `PIRATE.speedMin`–
`speedMax`) at five hull speeds, comparing a solve at minute 100 with one at 100.5:
295 of them — about 1.5% — moved more than a minute, and the worst ran 5.1 minutes
to 56.3. It jumps rather than slides because the solver returns the FIRST meeting
and a wing slower than the pirate waits for the orbit to come round; a fleet
leaving a moment late misses that narrow window and is quoted the next lap. This is
the measurement behind `PIRATE.quoteToleranceMinutes` and the `quotedMinutes` the
launch now carries. The probe script was temporary and is not kept: it is four
lines of `interceptOrbit` over a generated field and is cheaper to rewrite than to
maintain.

**The merchant rate is not freely tunable.** `balanceTake` moves the split in
`leadStride` steps: one on D208's divisible `1 · 2 · 32`, coarser on persisted
D183 `1 · 2 · 9` occurrences. Any future rate must preserve whole resources and
zero hidden remainder; `trade-balance.test.ts` sweeps both ends.

**Correction to the standing skip note above.** The current tree fails FIVE VFR
cases (0.072–0.079 against a floor of 0.09) with the six ARR/pacing cases skipped —
not the ARR failures the 2026-09-08 note describes as live. Verified by stashing
only the D183 rules changes and re-running: the VFR figures are identical with and
without them, so this is the pre-existing state of the economy branch and not
something D183 moved. D183 touches no production constant, no storage figure and no
upgrade cost; the merchant rate is the one economy number it changes and the
simulator does not model that lane.


## 2026-09-09 — three bots-turn failures, traced and closed

`bots-turn.test.ts` failed three cases on this branch before D183 and after it —
"never lifts its Core past the ceiling", "does not offer a raid to a world that owns
no warship" and "always leaves scouting open, even with nothing on the pad".
Verified as pre-existing by removing only the `newcomerShieldUntil` stamp from
`joinSeason` and re-running: identical failures.

**One cause, and no rule was wrong.** `ensureBotSeats` joins with
`ACADEMY_STEPS.length` completed, so `academyExitCheckpoint` hands every seat a
graduate's opening: fleet `{ DART: 3, WARDEN: 1, PROSPECTOR: 1, COURIER: 1 }` and a
CORE upgrade already in the construction queue — the checkpoint's building pick
falls back to `'CORE'` once the three opening buildings are past level 2. So

  · the two `openLanes` tests inherited warships and a Prospector while asserting a
    world that has neither, and
  · the Core-ceiling test counted the CORE order SEATING created, never one a bot
    turn made. The gate itself reads `buildings.CORE + queuedCount(CONSTRUCTION,
    CORE)` and holds — worth stating plainly, because "bots exceed the owner's Core
    ceiling" would be a live gameplay defect and it is not one.

Closed by clearing the seat's units and build orders in the fixture, which is the
same move `seedWorld` makes for the newcomer shield: a test states the world it is
reasoning about instead of inheriting a later feature's starting state into an
assertion about a different rule. No assertion changed meaning.

**Every other fixture that flies a hostile launch was moved to `joinSettled`.**
`seedWorld` clears the shield already; the files that build their own commanders —
`multi-world.test.ts`, `account-deletion.test.ts`, `fleet-v2-cutover.test.ts` — now
import `joinSettled as joinSeason`, one line each. A test that is ABOUT the shield
asks for it back with `giveNewcomerShield`, which keeps "this commander is new" a
statement a test makes rather than a default it inherits.

## D195 · The hull table measured, and one inverted ladder found (2026-09-10)

The owner asked for three things: a hold on every combat hull, fuel scaled by price and
speed, and a sharper attack/armour trade at every tier. Measuring the catalogue against the
existing model first is what made the pass worth doing — it found a defect none of the three
would have surfaced on its own.

### The defect: power per unit of fuel, by tier

| line | t1 | t2 | t3 | t4 |
|---|---|---|---|---|
| RAIDER | **13.40** | 10.62 | **8.24** | — |
| STRIKER | 13.45 | 10.69 | 8.26 | 10.64 |
| FORTRESS | 12.40 | 9.48 | 8.24 | 10.18 |

`hullFuelMass` was `bulk × FUEL.tierMass` with rungs ×1/×2/×4/×5, and tier 1 was excluded by
D153 to protect the opening. `bulk` is derived from hull value on a shallower curve than the
thirst rungs, so the two curves crossed: the ENTRY hull came out the most fuel-efficient
warship in the game and the middle of the catalogue the least. The owner named the
consequence before seeing the table — *"bu sefer tier 1 kârlı diye full ondan üretiyorlar"*.

### After: fuel as a fraction of hull value

`ceil(value × 0.0127 × (20 / referenceRoundTrip))`, floor 1. Value already carries power
(D148 prices the catalogue at `atk × hp / value²`), so the relation cannot invert.

| line | t1 | t2 | t3 | t4 |
|---|---|---|---|---|
| RAIDER | 5.74 | 6.64 | 6.76 | — |
| STRIKER | 7.94 | 8.91 | 9.10 | 9.36 |
| FORTRESS | 10.04 | 11.06 | 11.38 | 11.70 |

Monotone in every line, and the Dart is now the worst of them — which is the point.
`FUEL.perValue` was set so the catalogue's total fuel bill barely moves: **454 → 446**. This
is a redistribution between hulls, not a tax and not a rebate.

### The spread, and why it is not a bonus

`ROLE_SPREAD = [0.8, 1, 1.2, 1.45]` scales each hull's deviation from an even split. One
factor multiplies `atk` and divides `hp`, so `atk × hp` is exactly `power²` at every rung.

| tier | a/h spread | equal-budget spread | mean eff (×1e6) |
|---|---|---|---|
| 1 | 1.225 | 1.0267 | 12,316 |
| 2 | 1.349 | 1.0148 | 12,857 |
| 3 | 1.421 | 1.0054 | 13,468 |
| 4 | 1.531 | 1.0004 | 14,350 |

**A product bonus was measured and rejected.** Paying for specialisation makes the extremes
strictly better than the middle: the whole Skirmisher line sits at role 1.000 and would earn
nothing, and every Escort would be dominated by a Fortress of its own counter class. Two dead
branches, one of them a third of the counter cycle.

Counter cycle re-measured at equal budget, 40 seeds, tiers 1–3: the favoured class keeps
**98–100%** of its value and the reverse matchup **0–2%**. Unchanged.

### Season bands, 5 seeds × 50 players × 14 days, `by-archetype`

| | before D195 | after |
|---|---|---|
| ARR | 0.217–0.221 | 0.212–0.224, median 0.217 (LOW, skipped by authorisation) |
| **VFR** | **0.072–0.079, five seeds LOW** | **0.083–0.102, median 0.093 OK** |
| SV | 0.135–0.140 | 0.128–0.135 |
| TAX | 0.040–0.099 | 0.037–0.079 |
| RR | — | 0.58–0.92 |

VFR moved because warships that can carry made raidable wealth reachable — a consequence,
not a lever that was pulled at it. Two seeds still read under 0.09 and were not tuned for.
ARR is untouched by all three changes, which is consistent with every earlier sweep: it is
behaviour-driven, not economy-driven.

### Bent tests found

Four, each with a title describing the design and an assertion locking in its absence.

- `transfer-cargo.test.ts` — docblock: *"a raid's ceiling counts every hull that flies"*.
  Assertion: a Dart moves NEITHER capacity. True only because every warship's hold was zero.
- `academy-world.test.ts` — asserted `lootAlloy === 0` for the pirate lesson, so the tutorial
  taught that beating a pirate is worth nothing. The hoard was always there; there was
  nothing to put it in.
- `fuel.test.ts` — *"charges mass, not composition"*, which stopped being the rule.
- `capacity.test.ts` — *"leaves bulk behind, because fuel is still measured in it"*.

## D195b · The transport ladder, and a hole at the top of the roster (2026-09-10)

### Transports, before and after

| | price | cargo before | cargo after | crg/1k₡ before | after | crg/fuel | crg/min |
|---|---|---|---|---|---|---|---|
| COURIER t1 | 750 | 700 | **1,000** | 933 | **1,333** | 58 → 83 | 328 → 468 |
| WAYFARER t2 | 1,912 | 2,200 | **3,400** | 1,151 | **1,778** | 96 → 148 | 509 → 786 |
| ATLAS t3 | 4,648 | 6,000 | **9,500** | 1,291 | **2,044** | 162 → 257 | 806 → 1,276 |

A transport still carries ~9x more per unit of price than the best warship, so D195's combat
holds remain a floor under a raid's worth rather than a substitute for logistics.

`hp` per 1,000 spent is FLAT across the three (120 / 118 / 116) and was left alone: a support
hull is shielded while any combat hull on its side lives, so its armour only decides what
happens after the line is already gone.

### THE TIER-4 ROSTER IS THREE HULLS SHORT — open, reported, not acted on

| tier | Skirmisher | Lance | Bulwark/Fortress | Bulwark/Escort | Transport |
|---|---|---|---|---|---|
| 1 | Dart | Pike | Rampart | Warden | Courier |
| 2 | Viper | Talon | Stronghold | Sentinel | Wayfarer |
| 3 | Tempest | Ballista, Nullifier | Leviathan | Praetorian | Atlas |
| **4** | **— none —** | Cataclysm | Citadel | **— none —** | **— none —** |

**The Skirmisher is the structural one.** The counter cycle is Skirmisher > Bulwark > Lance,
and tier 4 has no answer to a Bulwark. Measured at equal budget over 40 seeds against a
Citadel wall, share of attacker value surviving:

| attacker | keeps |
|---|---|
| Cataclysm (t4 Lance) | **1%** |
| Nullifier (t3 Lance) | 0% |
| Praetorian (t3 Escort) | 46% |
| **Tempest (t3 Skirmisher)** | **88%** |

So a tier-4 commander's winning move against the commonest late defence is to build a hull
they unlocked two tiers ago. The cycle survives across tiers — it is not broken — but reaching
the top tier makes the catalogue SMALLER, which is the same defect shape D195 removed from
fuel.

**The Escort is a choice problem.** Tier 4 has the widest specialisation spread (1.531) and
nothing in the middle of it: maximum attack (Cataclysm, a/h 0.303) or maximum armour (Citadel,
0.198). The tier that is supposed to make the sharpest choice offers the fewest.

**The Transport is the D195b asymmetry.** Combat runs to tier 4; logistics stops at 3.

**CLOSED AT D196** — the art arrived and all three shipped. What follows is the measurement that justified them, kept because it is the evidence the tier needed filling.

BLOCKED ON ART, NOT ON RULES (at the time of writing). Each needs three files — `assets/models/ships/<id>.glb`,
`assets/images/ships/<id>.webp`, `assets/images/ships/icons/<id>.webp`. The staging folder
already shows the pattern and the gap: every lower tier has `offensive_lvl_N-1`/`-2` and
`defensive_lvl_N-1`/`-2`, tier 4 has one of each, and `cargo_lvl_4` does not exist. Reusing
`atlas.glb` was rejected: `FLEET_V2_ASSET_MANIFEST` sizes a hull by tier (D165) and the intel
layer is built on Telescope IDENTIFY naming a silhouette, so two hulls sharing one model breaks
both.

### The Gravitic Charges fixture — an instrument capped by the Core (2026-09-11)

`research.test.ts > discovers Gravitic Charges only after an Aegis meaningfully absorbs a raid`
failed at `shieldAbsorbed / normalDamage` = 0.167 against its own 0.25 bar. Root cause found,
fixture corrected, **assertion untouched**.

**It was not D195.** Neutralising `ROLE_SPREAD` to `[1,1,1,1]` gave 0.166 — the same figure.
The attacker is a Skirmisher (role 1.000, so `sharp` is exactly 1) and the defender is a ground
gun (hard-coded branch), so nothing D195 touched enters this battle.

**The fixture passed in isolation, which is what pointed at the world rather than the rule.**
`resolveCombat({ DART: 30 }, { BASTION: 3 }, 1000)` in `packages/rules` alone: 3 rounds,
REPELLED, damage 2,614, absorbed 1,000, **ratio 0.383**. The same fixture on the server gave
0.167 against the same 2,614 damage — absorbed ~437 — and rewriting the shield from 1,000 to
3,000 moved it to 0.170, i.e. by eighteen units. The shield was ~440 whatever the test wrote.

**Root cause: `effectiveInstruments` is `min(instruments[id], levels.CORE)`.** An instrument is
capped by the Core exactly as a building is, so `giveInstrument(target, 'AEGIS', 10)` on a world
whose Core is far lower buys an Aegis of that Core, and `advanceEconomy`'s
`shield: Math.min(maxShield, …)` then clamps to `shieldHp` of THAT level. The test bought
hardware the world could not hold, and had been asserting against a shield that never existed.

**Fix: raise the target's Core before `levelWorld`.** Before, because `levelWorld` lifts every
world to the tallest Core in the fixture — raising only the target puts the two commanders
outside D168's ±1 band and the raid is refused before a shot is fired. That intermediate
failure is worth recording: it is the correct rule catching an incorrect fixture.

The RULE was never wrong in either direction: `graviticInsight` is `shieldInsight.length > 0`
and fires on any absorption at all, so the 0.25 is the test's own definition of "meaningfully".
Nothing in the game moved; `research.test.ts` is 52/52.


### The last ten server failures, root-caused (2026-09-11)

All three causes were fixtures or a deliberate switch. **No assertion was lowered and no rule
moved.**

**Nine × `return-queue` / `return-api` — a season length the fixture did not name.**
`season_cycles` is keyed on the EXACT `(startsAt, endsAt)` pair, so two seasons share a cycle
only when both figures match. `seedWorld` pins `TEST_SEASON_DAYS` (14); these files' own
`createSeason` calls passed no `days` and so took `ECONOMY_PROFILE.seasonDays` (30). The two
ended on different days, landed in different cycles, and `lockQueueCommander`'s cycle-matched
lookup for a live target found nothing — `RETURN_TARGET_UNAVAILABLE` on every case. D194
fallout: the constant was introduced to pin fixtures when the live season grew, and these two
calls were never told. Fixed by passing `days: TEST_SEASON_DAYS`; both suites 12/12.

**One × `research` — an instrument capped by the Core.** Recorded above.

**One × `waiting-servers` — NOT A BUG, AND IT MUST STAY RED FOR NOW.**
`seedGalaxyEventCalendar` returns early at `galaxyEvents.ts:171`:
`if (!ECONOMY_PROFILE.tradeShip && !ECONOMY_PROFILE.asteroidShower) return;` — and both are
`false`, which is the owner's own measurement state: *"tüccar ve asteroid yağmurunu
production'a çıkarken kapatmayacağız; şu anda ekonomi hesaplarını bu eventler hariç
yapıyoruz"*. So the season calendar is deliberately empty and the test correctly detects it.
Proven by flipping both to `true` and re-running: **4/4 green**, then restored.

Leave it failing. It is the tripwire that says the switches are still off, and it goes green
by itself the moment they are flipped for production. Anything else would be muting the one
reminder that the shipping state has not been restored.

**RESOLVED 2026-09-12 (D200 session), owner instruction:** *"asteroid shower, tradeShip
eventleri açılacak! sadece ekonomi testlerine dahil edilmeyecek."* Both switches are `true`
and the tripwire is green. The measurement half never needed them off: the simulator mines
the base asteroid field and deals no calendar, shower lane or merchant, so ARR/VFR readings
are unchanged by the flip. `packages/sim/test/economy-scope.test.ts` now holds that
construction explicitly.

## D196 · What the complete tier cost, measured (2026-09-11)

Server 1433/1434 (the deliberate calendar tripwire), rules 976/976, web 2,711 passing with
every failure in the parallel wiki work. The simulator moved, and both movements are recorded
here rather than tuned away.

### VFR slipped back under the floor

| | VFR seeds | median | verdict |
|---|---|---|---|
| session start | 0.072–0.079 | — | five seeds LOW |
| after D195b | 0.095 0.083 0.093 0.102 0.085 | 0.093 | OK |
| after D196 | 0.089 0.077 0.087 0.097 0.077 | **0.087** | **LOW, 4/5 seeds** |

Every seed moved down together, so it is not noise. `raidableNow / raidableCeiling` measures
how full a store is against what it could hold, and D196 gave a developed commander three more
expensive things to spend on — a richer catalogue drains stores faster. **The band was not
widened.** The lever `LEVERS.VFR` names is upgrade lumpiness, untouched here.

VFR has been within ±0.02 of its floor for this entire branch: D195b lifted it just over, D196
nudged it just under. It is a knife-edge reading, not a cliff D196 fell off.

### ARR and VFR are the same sentence

ARR sits at 0.217 against a 0.275 floor and did not move with any of D195, D195b or D196 —
three separate sweeps, no response. Both metrics say one thing: **the simulated commanders
convert ore into buildings and ships almost immediately, so there is never much sitting in a
store to raid.** ARR reads it as "little of my wealth is at risk"; VFR reads it as "my store is
empty". One behaviour, two alarms. Neither is an economy dial — the economy has been swept
three times — and the open question is whether bots that never accumulate are unrealistic, or
whether the game gives a player nothing worth saving for. That is a playtest question.

### The informed archetype: a seed flip, not a regression

`informedArchetypeWins` fails on seed 42 alone. Measured across all five:

| seed | top | GRINDER | |
|---|---|---|---|
| 42 | TURTLE 8.0 | 12.5 | MISS |
| 7 · 99 · 4242 · 1337 | GRINDER 3.5–4.0 | 3.5–4.0 | OK |

Four of five, with GRINDER at 3.5 against a TURTLE at 9–11 — a wide margin, not a contest.
The cause is mechanical: three hulls inserted into `COMBAT_HULLS` changed the order the sim
iterates it in, which perturbs every seeded sequence downstream. The test's own docblock
already says this metric "swings hard between seeds" at six GRINDER samples. Recorded, not
tuned against.

### RAIDER is last on every seed, and that one IS systematic

Median rank 45 of 50 on all five seeds. The archetype "attacks constantly and scouts never",
so losing is partly by design — information is the game — but 45th is severe, and it is the
same story ARR and VFR tell from the other side: raiding does not pay against building. Open.

### One asset note

The three new meshes are 9.7k–10.2k triangles. `visual-design.md` states a ≤3k budget for ship
meshes; the existing catalogue already runs 3.7k–6.2k and `trade_ship.glb` is 10.2k, so the new
hulls are in line with what ships rather than with what the document says. The document and the
catalogue disagree, and the document is the one that is stale.

## D197 · Three debts, and what each one actually was (2026-09-11)

**Clan aid was off the cargo ladder, and blind to the Argosy.** `clanTransferCargoCapacity`
took no `tech`, so Cargo Holds lifted a commander's own transfers and a trade convoy and not a
teammate's delivery — the same research, two answers. It also named its three carriers by hand,
which made D196's fourth invisible: an Argosy loaded for a clanmate measured as a hold of zero,
so the largest transport in the game could move ore between your own worlds and not to an ally.
Both closed; the refusal moved inside the transaction, where the sender's research is readable.

**The mass bands were right and unmoored.** `SENSOR.massMedium/massHeavy` were derived from
`ECONOMY_TEMPO.hullPrice`, which stopped pricing hulls at the economy cutover. Swept across the
catalogue the numbers were still sensible at every rung — one craft LIGHT, a week-1 wing MEDIUM,
a late commitment HEAVY — so nothing was broken and nothing would have warned anybody when it
did break. Now `SENSOR.massWing` (10) craft of tier 2 and tier 4, computed off `HULLS`. Every
verdict across the realistic wings is unchanged; the difference is that the next price change
takes the buckets with it.

**Ship triangles: a ceiling, applied per model.**

| | before | after |
|---|---|---|
| corsair · citadel · atlas · sentinel | 10,132 · 7,368 · 5,850 · 5,807 | 5,000 each |
| cataclysm · praetorian · stronghold · ballista · dart | 7,351 · 6,181 · 5,812 · 5,049 · 5,078 | 4,999–5,000 |
| **argosy** | 9,692 | **5,630** |
| **paladin** | 10,188 | **5,734** |
| trade_ship (exempt by instruction) | 10,219 | 10,219 |
| death_star (own policy row) | 17,461 | 7,515 |

The Argosy and Paladin stop above the ceiling because meshoptimizer will not cut further inside
the 0.005 error bound — the bound doing exactly its job on the two most detailed hulls in the
game. File sizes all land in the 182–286 KB envelope the fleet already occupied.

`docs/visual-design.md` said ≤3k and had said it while the catalogue ran 3.7k–10.2k. The line
now states the number the pipeline enforces, so the document and the build agree for the first
time.

### D197 addendum · the model floor the ceiling broke

`fleet-v2-assets.test.ts` held every hull model between 200 and 300 KB. The floor was never a
size requirement — it guards against a model that lost its material maps, and it was written
when every hull shipped its authored geometry, so a small file could only be a broken one.
`SHIP_TRIANGLE_CEILING` made geometry a POLICY: the Corsair went 10,132 triangles to 5,000 and
its correct, fully-textured file is 182 KB. The floor is now 120 KB, which still catches a
stripped file; what it stood in for is asserted directly by the neighbouring test, which opens
each GLB and requires meshopt geometry and three WebP maps.

## D198 · What AI Robots costs, measured (2026-09-11)

A research that shortens every CONSTRUCTION order pushes the wrong way on the metric this
project has been short on for three passes: ARR is low because simulated commanders convert
ore into structures the moment they can afford them, so nothing accumulates to be raided.
Building FASTER is the same direction. So it was measured before it was believed.

**Method.** Five gate seeds, 50 players, 14 days, `by-archetype` calendars — the standard
harness. Two runs: the shipped archetypes, then the same archetypes with `AI_ROBOTS: 5` added
to all five, which is the worst case (the whole field buys the ladder out).

| seed | ARR base | ARR robots | VFR base | VFR robots |
| --- | --- | --- | --- | --- |
| 42 | 0.224 | 0.222 | 0.089 | 0.077 |
| 7 | 0.206 | 0.212 | 0.077 | 0.068 |
| 99 | 0.226 | 0.222 | 0.087 | 0.077 |
| 4242 | 0.217 | 0.217 | **0.097** | 0.089 |
| 1337 | 0.212 | 0.213 | 0.077 | 0.074 |
| **median** | **0.217** | **0.217** | **0.087** | **0.077** |

**ARR does not move.** Not a little — the median is identical and the per-seed spread is
inside the run-to-run noise this harness already shows. That is worth stating plainly because
the prediction was the opposite: a faster queue does not change the SHARE of a commander's
wealth a raid takes, because D195b's finding still holds — the hold is the binding constraint
on every raid in the game, so what a raid comes home with is a statement about `COMBAT_HOLD`
and `SUPPORT_HOLD` and nothing else.

**VFR falls about a ninth**, 0.087 → 0.077, and seed 4242 — the one seed in band — drops to
0.089 and joins the other four under the floor. This is the expected direction and the
expected mechanism: ore spends less time sitting in a store when the thing it is queued for
lands sooner. It is a real cost and it is recorded here rather than tuned against, because
VFR's lever is upgrade lumpiness and nothing in this decision touches it.

**The shipped reading is unchanged.** No archetype has ever held an economy ladder in
`researchTargets` — not Yard Automation, not Prospector Holds, not Cargo Holds — so the gate
runs at exactly the numbers in the "base" column above and D198 moves no test. The table is an
experiment answering "what if", not a regression. If the owner ever wants the economy ladders
modelled, this is the size of the answer for one of them.

**The live bots do buy it.** `BOT_PERSONAS.BUILDER` takes one rung, beside the Yard rung it
already took; a server-played commander that never touches a project the game sells is a worse
lie than a slightly faster builder.

## D2 v7 · Linear Dominion cutover measurement (2026-09-11)

The cutover changed only how a realised PvP exchange is transferred; it did not tune combat,
loot, hull prices or simulator policy. Across the settled portion of all five standard seeds:

| seed | absolute Dominion volume | largest single transfer |
|---:|---:|---:|
| 42 | 11,124,467 | 67,814 |
| 7 | 12,074,194 | 92,346 |
| 99 | 11,206,193 | 104,948 |
| 4242 | 10,436,398 | 79,437 |
| 1337 | 11,276,700 | 97,956 |

Every seed produces a transfer well above the retired 10,000 asymptote, while the aggregate
raider return ratio remains 0.8466 and the exact two-ledger/property tests remain zero-sum. This
is the intended result: the old ceiling is gone without changing the underlying battle economy.

The simulator suite still reports D196's already-recorded four VFR lows and the seed-42 informed
archetype miss. Those readings predate this cutover, remain open, and were deliberately not tuned
away as part of Dominion.
