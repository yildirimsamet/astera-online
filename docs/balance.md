# Balance & Mathematics

Where every number came from and which relationships must never break.

**`packages/rules/src/constants.ts` is authoritative; this file explains it.** If a number here
disagrees with the constant, the constant wins and this file has drifted. `PROVISIONAL` values are
settled by playtest, not by argument.

`docs/economy-v2.json` holds the full generated tables (every building, instrument, satellite, hull
and research project, level 1 to max). Regenerate it and the progression validation with
`node tools/economy-v2-model.mjs --json`.

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

**Dominion sums to exactly zero across a battle.** Property-tested. Otherwise the ladder creates
score from nothing.

**`START` is arithmetic:** `723 alloy · 69 crystal` = Core, Refinery and Extractor each 1→2 plus two
Wasps. Exactly the opening a new commander can finish in one sitting, and not a unit more.

---

## Economy

```
alloyRate(L)   = 132 × L × 1.10^L   per hour
crystalRate(L) =  48 × L × 1.09^L   per hour
deuteriumRate  = 0                          — mined only, never passive

upgradeCost(L→L+1) = { alloy:   52.000 × 1.5600^L
                       crystal: 15.054 × 1.5458^L }   charged from L0

storageHours(vault)   = 12 + 0.8 × vault
worksHours            = 10                  — the uncollected buffer
protectedHours(vault) = 2 + 0.3 × vault
vaultProtects         = per resource, max(openingFloor, protectedHours × that rate)
                        openingFloorAlloy 840; crystal floor from the income ratio
deuteriumCap          = half the crystal cap of the same kind
```

**Production carries a linear factor, and that is the whole shape.** `base × L × g^L` (OGame's form)
is the only common shape that both doubles output at L1→L2 — the day-zero dopamine a 14-day season
needs — and decays to +16% per level by L18, which is the brake. A pure exponential has one growth
rate for ever.

**The Vault sets storage capacity as well as the floor**, because `upgradeCost` grows at 1.56 while a
flat store grows at `L × 1.10^L` and they cross. Storage is 12 h at Vault 0 and 24.8 h at Vault 16;
`costAlloy / storageCap` peaks at 0.86 at L20, so the ceiling never binds.

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
| Payback | 0.6 h | 4.3 h | 14.3 h | 48.8 h | 91.1 h |

Cost grows at 1.56 against production at 1.10, so payback lengthens with level. **That drift is what
stops a 14-day season running away**, and it produces the sunset: every player independently stops
building on the last day, with no rule announcing it. **If you change the cost curve, re-derive the
season length.**

### The crystal share is derived, not chosen

Crystal cost share is held at **0.796 of the crystal income share at every level**. Not at parity: at
parity crystal is spent as fast as it arrives, the stores sit near empty and there is nothing left to
raid. Crystal must be spendable **and** worth stealing.

---

## Build time — two queues

```
buildMinutes(item) = min(360, costTotal / throughput)      360 min = 6 h hard ceiling

  construction   240 × (1 + 0.22 × core)      buildings, instruments, satellites, research
  shipyard       312 × (1 + 0.35 × shipyard)  mobile hulls
  ground        1200 × (1 + 0.35 × shipyard)  Thorn, Bastion
  research       ×4 on the construction rate

queueDepth 3 per queue · cancelRefund 0.5 · system abandonment refunds in full
```

| Level | 1 | 8 | 12 | 14 | 18 | 20 |
|---|---|---|---|---|---|---|
| Build | 21 s | 3.5 m | 15.6 m | 33.7 m | 2.7 h | 6.0 h |

Wasp at Shipyard 0: 46 s. Thorn at Shipyard 0: 45 s.

**Time is priced in resources**, so no price change can leave a build time behind, and one formula
covers everything. `defBase` is derived from the radar promise, not chosen — see the invariants above.

**Rules that are not obvious.** Gates read the projected state of *the same queue*, so Core 1→2 may be
followed immediately by Refinery 1→2 — but a Shipyard in CONSTRUCTION cannot unlock a hull in YARD,
because the two queues run in parallel and neither is ahead of the other. Disruption stops the works,
never construction. Committed resources stay in Wealth. `builtEver` rises only on completion.
Cancelling an order whose removal would change the meaning of a later one is refused.

---

## Combat

```
3 rounds · simultaneous fire · ±8% variance
counter cycle: WASP ▸ BULWARK ▸ LANCE ▸ WASP   at 1.6× / 0.625×
support hulls: prey to everything, deal nothing, shielded while escorted

grade on VALUE destroyed:
  all defenders dead        → DECISIVE → loot 70%
  ≥42% of value destroyed   → PARTIAL  → loot 35%
  below that                → REPELLED → nothing

defenceSalvage 0.60 · lootBufferShare 0.50 · engagementSeconds 10
```

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
| Prospector | Support · mining | 0 | 150 | 825 | 1,800 | 650 | 200 | 0 | 1 | — |

**The table is priced on `atk · hp / value²`** — equal-budget power when damage is spread across a
force. Not attack-per-resource, which is the quantity that made the old Bulwark lose every
equal-budget matchup including against the Lance it counters. **A tech tier buys about 15%; the
counter cycle buys 156%.** Information beats tech, by construction.

Ground hulls are paid 1.6× for never leaving: they cannot loot and cannot take Dominion. The two sit
in **opposite counter classes** so that "how much defence" becomes "what *kind*" — a question only the
information layer can answer.

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
oneWayMinutes = 1 + (distance / slowestHullSpeed) × 1.2

GALAXY radius 2500 · thickness 300 · minSeparation 225      (web SCALE 50)
```

**The disc is 2.5× the pre-v2 radius, and that restored a density the balance had quietly lost.** The
numbers were tuned on a 50-planet galaxy; production runs 351 on the same disc, so every commander's
neighbours had become 2.5× too close.

| Config | nearest | 10th nearest | 25th nearest |
|---|---|---|---|
| 50 @ 1000 — where the balance was tuned | 163 | 510 | 1004 |
| 351 @ 1000 — production before v2 | 104 | 204 | 302 |
| **351 @ 2500** — now | 260 | **510** | 754 |

Measured tempo: a Wasp reaches its 10th-nearest world in **11 min round trip**, its 25th in **16 min**.
A Bulwark siege across the whole disc is **three hours**.

---

## Information

```
clarity      = observerTelescopeLevel − targetVeilLevel
detectChance = clamp(0.25 + 0.18 × (radarL − probeStealthL), 0.05, 0.95)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)

INTERMITTENT: refresh ≤ every 20 min, 25% of refreshes dropped
DEGRADED:     reads UNKNOWN 70% of the time
```

Floors and ceilings guarantee that no investment buys perfect invisibility or perfect omniscience.
**The fog never fully lifts.**

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Telescope range | 500 | 725 | 1,025 | 1,525 | ∞ |
| Watch slots | 1 | 1 | 2 | 2 | 3 |
| Re-point cooldown | 5 h | 4 h | 3 h | 2 h | 1 h |
| Radar reach | — | — | 190 | 360 | 570 |

**Telescope range scales with the disc; radar range does not.** The telescope answers *how many worlds
are inside my circle* — a share of the galaxy. The radar answers *how many minutes of warning do I
get* — a function of the attacker's speed. Scaling both by the same factor is the obvious mistake.

**Telescope reads are seeded from `(watchId, floor(now / 20min))`**, so a reading is identical however
many times it is requested inside its window. Without this a player defeats the entire fog layer by
pulling to refresh. It is the easiest way to ship a broken information game.

Probes: `50 alloy · 30 crystal · speed 260`, rationed by flight bays.

---

## Hardware

```
instrumentCost(id, L) = upgradeCost(L × 2) × mult      TELESCOPE ×3 · RADAR/AEGIS/VEIL ×2
shieldHp(L)           = 60 × 1.5^L, regen 35%/hour
```

`INSTRUMENT_LEVEL_WORTH` is **2**. At 1 the whole information layer is bought out by day two, which
makes the fog uniform and therefore decorative. At 2 the four instruments cost about one L15 building
step, while Telescope L1 still costs 156 alloy and the door stays open.

| Satellite | Alloy | Crystal | Effect |
|---|---|---|---|
| Uplink | 900 | 300 | Gates the Telescope and the Radar. Nothing else gates anything |
| Foundry | 2,000 | 700 | ×1.06 on everything the works produce |
| Derrick | 2,200 | 800 | ×2.6 mining hold, ×1.5 mining speed |
| Beacon | 3,000 | 1,000 | ×1.3 speed for every fleet that leaves |

Slots come from the Command Core at L1, L3, L5 and L9.

**`FOUNDRY.production` stays at 1.06.** It compounds twice — bots buy ground defence as a ratio of the
stock it raises — so at +8% TURTLE tops the ladder on every gate seed.

**These are priced well below the pre-v2 ratio to a building step, and that was measured.** Restoring
the old multiple moved `ARR` by 0.006 and cost `VFR` on one seed and the Core band on another.

---

## Other constants

```
disruption    20 / 7 / 0 min, cap 25 pending          [PROVISIONAL]
abuse         bash 3 per attacker per target per 12 h · tier band ±2
season        14 days · investment horizon 0.70 · acts at 4/14, 8/14, 12/14
opening       START 723/69 · OPENING_BONUS 580/210 · PLANET_START 1303/279
strategic     settlement 2 Haulers + 2,000/1,000 · Death Star 28,000/9,000/2,600, 60 min
research      Isotope 900 C · Dense Fuel 1,400 C + 150 D · Gravitic 1,900 C + 350 D
              Death Star Protocol 11,000 A + 3,600 C + 900 D
```

### Asteroids

```
spawn         0.030 per player per hour — 9/h and ~34 rocks visible at 300 players
orbit         radius 500–2375, closed, constant speed 350–750 units/min
life          2.5–5 hours, then gone for good
ore by level  [—, 800, 1600, 3200, 6000, 11000]   weights [—, .40, .27, .18, .10, .05]
crystal share 0.25–0.65, rolled per rock
isotope       one seeded rock per 9 after hour 35, plus a bonus seam every 10 lanes
              10–25% Deuterium concentration, replacing Alloy; Crystal share remains intact
```

**Spawn is per-capita or mining dies at scale.** A flat rate tuned at 50 players is six times thinner
at 300 and the field becomes irrelevant. At 0.030 a contesting commander draws about a quarter of a
day-1 income from rocks and under 2% of a day-7 one: a catch-up lever early, a race prize later.

Speed is **independent of level**, so a rich rock is not automatically a slow one, and the orbit is
**closed**, so a craft slower than a rock still has a meeting on a later pass. Interception is a root
find, not a speed comparison.

---

## The simulator

`packages/sim` runs a full 14-day season with five bot archetypes executing the real rules,
deterministically from a seed. **Its regression test runs on five seeds at 50 players** — the size the
game actually ships. Which invariants are asserted per seed and which are pooled is decided by
measured spread: `ARR`, `VFR` and `SV` per seed; `TI`, `RR` and `TAX` pooled.

```bash
pnpm sim -- --players=50 --seed=7
```

| | Healthy | Means | Lever if out of band |
|---|---|---|---|
| `ARR` | 0.30–0.55 | Share of Wealth that is actually losable | Building vs ship cost balance |
| `VFR` | 0.16–0.65 | **Raidable** stock as a share of raidable capacity | Upgrade lumpiness. LOW = nothing worth raiding |
| `TI` | −0.40–0.55 | Passive players' share of an active player's ladder position | Loot grades, Bastion efficiency, disruption |
| `RR` | 1.3–3.5 | Dominion gained per unit spent gaining it; pooled by total exchange volume | Loot grades, salvage, hull HP |
| `SV` | 0.10–0.30 | Daily Wealth churn — the re-login driver | Loot %, travel times |
| `TAX` | 0.10–0.45 | Share of a peaceful player's output taken by raiders | Disruption, loot %, attack frequency |

Two of these were **redefined after they failed to catch the bug they existed for**: `VFR` measured raw
stock ÷ cap and read a healthy 0.50 all season while the vault protected 100% of it; `TAX` used a
median, which always read 0.00 because most players are not raided on any given day. **A diagnostic
that cannot fail is not a diagnostic.**

### What the v2 pass measured

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
