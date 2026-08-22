# Balance & Mathematics

Where every number came from and which relationships must never break.

**`packages/rules/src/constants.ts` is authoritative; this file explains it.** If a number
here disagrees with the constant, the constant wins and this file has drifted. Values marked
`PROVISIONAL` are settled by playtest, not by argument.

## The invariants tests enforce

Breaking one of these is not a balance regression — it is a broken game, usually silently.

**`vaultMult < alloyMult`.** If protection compounds faster than the stock it protects, the
vault eventually covers 100% of storage and nothing is ever raidable again, with no other
symptom. The first draft shipped `900 × 1.5^L` against an `alloyMult` of 1.45 and protected
208% of storage at L3, 301% at L14. Now `600 × 1.30^L`, so the protected *fraction* shrinks
as a player grows — 45% at L3, 26% at L8, 14% at L14. That is also the intended design:
beginners nearly fully protected, leaders nearly fully exposed.

**Combat variance is ±8%.** A design constraint, not a preference: if randomness dominated,
intel would be worthless.

**Dominion sums to exactly zero across a battle.** Property-tested over arbitrary fleets and
loot values. Otherwise the ladder creates score from nothing.

**`START` is arithmetic:** `2,060 alloy · 276 crystal` = Core, Refinery and Extractor each
1→2 (1,020 A · 276 C) plus two Wasps (1,040 A). Exactly the opening the design wants a new
commander to finish in one sitting, and not a unit more.

## Economy

```
alloyRate(L)   = 80 × 1.45^L    per hour
crystalRate(L) = 28 × 1.42^L    per hour

upgradeCost(L) = 200 × 1.70^L     alloy
               +  55 × 1.6648^L   crystal   (from level 1)

storageCap     = 12 hours of production at the current level
collectorCap   = 10 hours — what the WORKS hold before they stop   [D16]
vaultProtects  = 450 × 1.30^L alloy, ×28/80 of that for crystal    [PROVISIONAL]
                 un-raidable. NOT the same figure for both: crystal income is
                 35% of alloy income, so one flat floor made crystal            
                 unraidable for the whole opening (D61)
```

Income was doubled from 40/14 (D17), and income was doubled rather than costs cut on purpose:
every relationship here is a *ratio*. Scaling both bases by the same factor leaves
`vaultMult < alloyMult`, the crystal share and `payback = cost / gain` exactly where they
were, and simply runs the clock twice as fast.

### The two piles — D16

```
production → WORKS (cap 10h, raidable at 50%, vault does NOT cover it)
                ↓  collect()
             STORAGE (cap 12h, spendable, vault floor applies)
```

Total accumulation across an absence is 22 hours, not 12 — a long absence is more forgiving
than it was. Nothing accrues past that, so an absence of a day and an absence of a month
produce the same state.

**Twelve hours of storage** means sleeping eight arrives at ~80% of cap: close enough to feel
pressure, not so close that a normal night is punished. **Ten hours for the works** is a night
plus a margin, so a player who sleeps normally wastes nothing.

### The payback curve is the brake

```
payback(L) = cost(L) / marginalGain(L) = 5.56 × 1.1724^L hours
```

| Level | 1 | 5 | 10 | 15 |
|---|---|---|---|---|
| Payback | 6.5h | 12.3h | 27.3h | 60.4h |

Cost grows at 1.70 against production at 1.45, so payback lengthens with level. **That drift
is what stops a 14-day season running away**, and it produces the sunset: investment stays
rational while `payback < remainingHours × 0.4`, which on day 13 means ~9.6 hours — satisfied
by no level past L3. Every player independently stops building on the final day.

**If you change the cost curve, re-derive the season length.** It is not an independent choice.

### The crystal share is derived, not chosen

```
crystal income share = crystalRate(L) / alloyRate(L)   0.343 → 0.261 over a season
crystal cost   share = crystal(L)     / alloy(L)       0.271 → 0.205
                                                       ratio  0.786 at every level
```

Crystal shipped as decoration: charged only from level 4, at 22% of the alloy price, against
an income that is 34% of alloy income. It filled its store on the first night of every account
and wasted from then on, and nothing in the opening consumed it at all.

**The multiplier is derived:** `crystalCostMult = costMult × (crystalMult / alloyMult)`. Two
independently chosen multipliers drift — an earlier 1.58 against a 1.55 alloy curve pushed the
crystal share from 0.21 to 0.37 across ten levels while the income share fell, quietly
inverting which resource was scarce.

**The base is set at ~0.79 of income parity, and that came from the simulator.** At parity
crystal is spent as fast as it arrives, the stores sit near empty, and **there is nothing left
to raid**: raid returns fell under their floor and the informed archetype dropped to third.
Crystal must be spendable **and** worth stealing.

**The D78 same-total redistribution experiment remains blocked.** Moving the unchanged
total prices of Lance, Bulwark and Hauler to 25%, 30% or 35% crystal reduced cap time,
but candidates broke season gates or missed the cap-time target. Prospector was not
falsely counted in that conclusion: the simulator does not yet model mining craft
purchases, and prints its Prospector spend as zero.

**D82 is a different operation:** every hull's existing crystal component is multiplied
by 1.25 and rounded to the nearest whole resource, so total prices rise while alloy and
all hull statistics remain fixed. Wasp's zero stays zero and therefore opening arithmetic
does not move. This owner-directed surcharge is the authoritative price table below;
the planned research system is a separate future sink and has not been pre-spent here.
Run `pnpm sim` for cap player-hours, final median unused crystal and category distribution;
`--crystal-share=0.25|0.30|0.35` still reproduces only the historical D78 experiment.
The five-seed gate has one explicit owner-accepted D82 exception: seed 7 ARR is pinned
at 0.2962205608319292 instead of weakening the global 0.300 floor (see D82).

## Combat

```
3 rounds · simultaneous fire · ±8% variance
counter cycle: WASP ▸ BULWARK ▸ LANCE ▸ WASP  at 1.6× / 0.625×
support hulls: prey to everything (1.6× taken), deal nothing, shielded while escorted

grade on VALUE destroyed:
  all defenders dead        → DECISIVE  → loot 50% of raidable
  ≥42% of value destroyed   → PARTIAL   → loot 35%
  below that                → REPELLED  → nothing

defenceSalvage  = 60% of destroyed ground units rebuild free
lootBufferShare = 50% — ore still in the works is half as easy to carry off
engagementSeconds = 10 — a raid is over its target this long before it settles [D44]
```

| Hull | Class | ATK | HP | Speed | Cargo | Alloy | Crystal | Yard | HP/1k | ATK/1k |
|---|---|---|---|---|---|---|---|---|---|---|
| Wasp | Skirmisher | 14 | 24 | 435 | 40 | 260 | 0 | 0 | 46.2 | 26.9 |
| Lance | Lance | 46 | 62 | 322 | 50 | 950 | 238 | 2 | 26.1 | 19.4 |
| Bulwark | Bulwark | 26 | 210 | 199 | 70 | 2,500 | 775 | 4 | 32.1 | 4.0 |
| Hauler | Support | 0 | 80 | 284 | **1,800** | 1,150 | 163 | 1 | 30.5 | — |
| Bastion | Bulwark · ground | 34 | 260 | — | — | 1,700 | 475 | 1 | 59.8 | 7.8 |
| Thorn | Skirmisher · ground | 16 | 60 | — | — | 800 | 150 | 0 | 63.2 | 16.8 |
| Prospector | Support · mining | 0 | 70 | *see below* | 1,800 | 700 | 150 | 1 | 82.4 | — |

The Bastion is **1.29× more HP per resource** than the best ship because it can never leave.
That is the entire justification for ground defence existing separately.

**The two ground guns are opposite classes on purpose (D27).** Wasps overwhelm a Bastion and
are held by a Thorn; Lances break a Thorn and shatter against a Bastion. A defender chooses
what to be strong against and an attacker has to find out which — the decision a single ground
hull cannot produce.

> **A known problem in this table is deliberately not fixed.** The Bulwark has 4.2 attack per
> 1,000 resources against the Wasp's 26.9, so at equal budget it loses to the Lance it
> counters. Raising it was measured across the whole range and hands the season to whoever
> accumulates most (D27). It is a durability hull; exchange ratios cannot price 210 hit points.

**The Prospector's live speed is `PROSPECTOR.speed` (330), and the ship-card duplicate in
`HULLS.PROSPECTOR.speed` must equal it.** A Derrick keeps its 1.5× multiplier and lifts the
craft to 495. Across five seeds, fifty spawn slots and 200 rocks per seed, both speeds reached
100% of rocks at spawn and at 25/50/75/90% of their lifetime. The base craft's measured maximum
one-way/round-trip was 7.22/14.44 minutes with a 1.006-revolution lead; boosted was
4.84/9.68 with a 0.666-revolution lead. It uses its own
`launchMinutes` of 0.13 rather than `TRAVEL.baseMinutes` (D48, D74).

### Loot

The proposed 3× combat-cargo change is blocked by the season gate (D80) and is not
authoritative. Loot remains capped by what exists, the outcome share and the cargo
of the surviving fleet; an annihilated squadron returns nothing. Haulers remain
shielded while any combat hull survives.

```
raidable = max(0, storage − vaultFloor) + works × lootBufferShare
loot     = min(raidable × grade, totalCargoCapacity)
```

**The 65% rule *is* the repeat-raid decay system**: successive decisive raids take 65%, then
22.75%, then 7.96% of the original pile. Diminishing returns arrive free, with no cooldown table and no
extra state.

## Information

```
clarity      = observerTelescopeLevel − targetVeilLevel
detectChance = clamp(0.25 + 0.18 × (radarL − probeStealthL), 0.05, 0.95)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)

INTERMITTENT: refresh ≤ every 20 min, 25% of refreshes dropped
DEGRADED:     reads UNKNOWN 70% of the time
```

Floors and ceilings guarantee that no investment buys perfect invisibility or perfect
omniscience. **The fog never fully lifts.**

### The telescope — D18

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Watch slots | 1 | 1 | 2 | 2 | 3 |
| Range (units) | 420 | 640 | 950 | 1,400 | ∞ |
| Re-point cooldown | 5h | 4h | 3h | 2h | 1h |

The disc has radius 1000, so the furthest two planets can be is a little over 2000 apart. On a
50-world galaxy L1 reaches about six neighbours, L2 thirteen, L3 twenty-five. **Range is what
makes "who are my neighbours" a real question.** Cooldown is charged on re-pointing only.

### The radar — D49

| Level | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Reach (units) | — | — | 200 | 340 | 500 |
| Also | catches probes | + bearing | | + ship estimate | + names the origin |

**The warning fires when a fleet crosses inside the circle**, so how much notice it buys falls
out of the attacker's own speed. Against a typical 800-unit leg at L5 since D63: Wasp 3.1 min,
Lance 3.8, Hauler in tow 4.4, Bulwark siege 5.0. Notice is `oneWay × range / distance`, so a
long flight can never hand over its whole duration (D9).

**Those minutes no longer buy an evacuation, and are not meant to.** At D63's tempo the radar
sells the window to ARM rather than the window to flee: construction is instant and a Kirpi is
800 alloy at Shipyard 0, so three minutes is exactly enough to put a gun on the ground. The
ladder is unchanged; what it promises is not.

### The refresh-spam rule

Telescope reads are seeded from `(watchId, floor(now / 20min))`, so a reading is identical
however many times it is requested inside its window. **Without this a player defeats the
entire fog layer by pulling to refresh** until `INTERMITTENT` yields a confirmation. It is the
easiest way to ship a broken information game and it is not obvious from the formula.

### Probes

`50 alloy · 50 crystal · speed 90`, rationed by flight bays. Charging a little of *both*
resources keeps a probe a decision after the opening; alloy alone is the resource nobody is
ever short of.

## Hardware — two kinds, D25

**Four INSTRUMENTS on the ground**, levelled, no slot:

```
instrumentCost(id, L) = upgradeCost(L) × mult
  TELESCOPE ×3 · RADAR ×2 · AEGIS ×2 · VEIL ×2

shieldHp(L) = 40 × 1.42^L, regen 40%/hr       [PROVISIONAL]
```

`SHIELD.base` was cut from 700 in D22 and **must stay near a fleet's own hit points**. The old
figure was only survivable because almost nobody could afford an Aegis; once satellites stopped
being rationed, adoption went 18% → 67% and raid returns collapsed to 0.60–0.73.

**Four SATELLITES in orbit**, one slot each, bought once, never raised:

| Satellite | Alloy | Crystal | Effect |
|---|---|---|---|
| Uplink | 1,500 | 500 | Gates the Telescope and the Radar. Nothing else gates anything |
| Foundry | 9,000 | 3,000 | ×1.06 on everything the works produce |
| Derrick | 9,000 | 3,000 | ×2.6 mining hold, ×1.5 mining speed |
| Beacon | 11,000 | 3,500 | ×1.3 speed for every fleet that leaves here |

Slots come from the Command Core at L1, L3, L5 and L9.

**`SATELLITES.FOUNDRY.production` stays at 1.06.** It compounds twice — bots buy ground defence
as a ratio of the stock it raises — so at +8% TURTLE tops the ladder on every gate seed.

**Instruments stay cheap and the reason is measured (D30).** All four at maximum cost 42,219,
less than one building step at L10→L11. Every attempt to fix that fails the gate, because
raising the price of one un-losable holding pushes wealth into another one.

## Other constants

```
travelMinutes = 3 + (distance / slowestShipSpeed) × 1.2
disruption    = 15 / 5 / 0 min, cap 15 pending   [PROVISIONAL]

abuse guards  bash 3 per attacker per target per 12h
              tier band: ±2 development tiers   [D49]
              NO newcomer grace   [D14]

galaxy        disc radius 1000, ±120 thickness, min separation 90
              10 galaxies × 50 worlds, filled strictly in order   [D21]
season        14 days, investment horizon share 0.4
debris        10% of destroyed non-ground value, decays over 3h   [PROVISIONAL, D37]
              no field at all below DEBRIS.minimum (200) — a skirmish leaves nothing
```

### Asteroids — D19

```
spawn         3.375 new rocks per hour         [PROVISIONAL]  D81: +25% from 2.7
              ~15 rocks in the disc at any moment (rate x mean life), was ~12
orbit         radius 200–950, closed, constant speed 140–300 units/min
life          3–6 hours in the disc, then gone for good
ore by level  [—, 800, 1600, 3200, 6000, 11000]
level weights [—, 0.40, 0.27, 0.18, 0.10, 0.05]
crystal share 0.25–0.65, rolled per rock
```

Speed is **independent of level**, so a rich rock is not automatically a slow one, and the orbit
is **closed**, so a craft slower than a rock still has a meeting on a later pass. Interception is
a root find rather than a speed comparison.

Ore was cut by roughly seven from the first pass, which had sized rocks against the field's own
total and never compared them to a refinery: one Prospector brought home 3,651 an hour against a
planet's entire 156.

**There is no impact system.** Asteroid impacts remain on the deferred list in `roadmap.md`.

## The simulator

`packages/sim` runs a full 14-day season with five bot archetypes executing the real rules,
deterministically from a seed. **Its regression test runs in CI on five seeds at 50 players** —
the size the game actually ships. It used to run three seeds at 120, which never reaches a
player, and that mattered: at 50 the pre-OGame baseline failed `informedArchetypeWins` on seed
99 and nothing at 120 showed it.

Which invariants are asserted per seed and which are pooled is decided by **measured spread**:
`ARR` (6%), `SV` (4%) and `VFR` (17%) per seed; `RR` (28%), `TAX` (52%) and `TI` (unstable at
n=50 by construction) pooled. A real regression moves every seed together, so the pooled median
still catches it; what it stops catching is one unlucky galaxy.

```bash
pnpm sim -- --players=50 --seed=7
```

### The six health invariants

| | Healthy | Means | Lever if out of band |
|---|---|---|---|
| `ARR` | 0.30–0.55 | Share of Wealth that is actually losable | Building vs ship cost balance |
| `VFR` | 0.16–0.65 | **Raidable** stock as a share of raidable capacity | Upgrade lumpiness. LOW = nothing worth raiding |
| `TI` | −0.40–0.55 | Passive players' share of an active player's ladder position | Loot grades, Bastion efficiency, disruption |
| `RR` | 1.3–3.5 | Dominion gained per unit spent gaining it | Loot grades, salvage, hull HP |
| `SV` | 0.10–0.30 | Daily Wealth churn — the re-login driver | Loot %, travel times |
| `TAX` | 0.10–0.45 | Share of a peaceful player's output taken by raiders | Disruption duration, loot %, attack frequency |

Two of these were **redefined after they failed to catch the bug they existed for**: `VFR`
measured raw stock ÷ cap and read a healthy 0.50 all season while the vault protected 100% of
it; `TAX` used a median, which always read 0.00 because most players are not raided on any
given day. **A diagnostic that cannot fail is not a diagnostic.**

### Current reading — five-seed regression gate green

The current pooled five-seed regression gate is green. Individual single-seed CLI runs can
still print a red daily `TI`; that diagnostic is pooled across all five seeds by the actual
gate and must not be mistaken for a failing regression assertion.

**THE CAUSE OF THE OLD RED WAS A MODELLING BUG, NOT A BALANCE PROBLEM.** For four phases the
red pair was pooled `TAX` at 0.0717 against a floor of 0.10 (per seed: 42:0.079 · 7:0.138 ·
99:0.072 · 4242:0.065 · 1337:0.052) and the informed archetype losing seed 4242 to RAIDER.
**Both now pass, and nothing was tuned to make them.**

A blind attacker values a target from how developed it looks, and the docblock over that
expression said — correctly, since D16 — that the guess "counts the works as well as the
store, because a target's storage is now a transient that empties minutes after its owner
logs in". The expression counted `storageCap` alone. The scouted branch had been updated for
D16; the blind branch had not. So every unscouted target was under-valued by roughly the
collector ceiling, blind raiding was suppressed across the whole galaxy, and the archetype
that suffered most was the one that raids without scouting first.

That is why `TAX` sat low and why the informed archetype's edge was inconsistent: both were
reading a galaxy with less raiding in it than the rules describe. Found by a code review, as
a comment that disagreed with the line beneath it.

**The tier band remains a measurable no-op in the simulator** — every bot finishes at Core
7–10 (tiers 3–4) and a ±2 band admits every pairing; disabling the check reproduces the same
numbers. That was true before D52a and is still true.

`ARR` remains a first-class diagnostic, but no current gate band is red.

`TAX` had reached exactly its floor under D27 and has never had headroom since; D30 measured a
10% instrument-curve change tipping it, and D33 measured a sink worth 2% of Wealth tipping
`ARR`. **Neither band may be widened to admit a feature.**

## What the simulator proved

> Findings 1–4 were measured on the pre-D17 economy. The conclusions stand and are why the
> current constants look the way they do; the absolute figures inside them are historical.

1. **The vault curve inversion.** Found on the very first run. → D13.
2. **Haulers evaporated in round one.** 80 HP taking 1.6× from everything, so attackers arrived
   with no cargo and raiding could not pay for itself. → D8.
3. **Nobody built defence.** 23 Bastions across 140 planets, and 95% of attacks resolved
   DECISIVE. The bots bought buildings first and defence from the leftovers, because buildings
   compound and always look like the better purchase at the margin. → D7.
4. **Grading on `ATK × HP` mis-scored every countered fight.** → D12.
5. **A spendable resource is a lootable resource.** Raising crystal costs to income parity fixed
   the dead-resource problem and broke raiding in the same move — stock that gets spent is not in
   the store when a fleet arrives. Exactly the failure shape a unit test cannot see.
6. **Raiding was 5% of the economy, and the loot dial is provably inert:**

| `lootDecisive` | 0.4 | 0.5 | 0.6 | 0.75 | 0.9 |
|---|---|---|---|---|---|
| Raid Tax | 0.05 | 0.05 | 0.05 | 0.06 | 0.05 |
| Turtle Index | 2.20 | 1.99 | 2.02 | 2.18 | 1.99 |

Doubling loot changed nothing. Neither did the storage cap. This is why D2, D3 and D7 exist, and
why "just raise the loot percentage" is not a valid suggestion. `COMBAT.defenceSalvage` was later
swept 0.60 → 0.20 and is inert for the same reason: **a lever that changes what a loss COSTS
cannot fix a problem in what an attack ACHIEVES.**

## Known limitations of the tool

**The bots have no skill variance**, so ladder spread reads far narrower than a real shard.
**Do not tune ladder spread against the simulator.**

**The bots are competent, not optimal, on purpose.** Only `GRINDER` reasons about its fleet. A
galaxy of optimal players is exactly as wrong as a galaxy of idiots — if everybody fields the
right ships, nothing is left for information to buy and the design's central claim becomes
untestable.

**There is not one asteroid in it.** Mining, the Derrick, wreckage and the whole D19 economy are
invisible to every number here. **The simulator must not price what it refuses to simulate.**

**`TI` is unstable at small galaxy sizes.** It divides passive Dominion by active Dominion and
the denominator can approach zero; on seed 1337 at 50 players it read 28.79. A division artefact,
not a signal.

## The one open balance problem

**The casual archetype is the stated target user and its outcome is not stable.** At 50 players
it finishes anywhere from +15,547 to −8,664 Dominion depending on seed. The spread is the
problem: whether a two-logins-a-day player has a good season is currently decided by who happens
to live near them.

The vault floor, the bash limit and the tier band are the only structural protection — newcomer
grace was removed by owner decision (D14), so a fresh account is attackable from its first
minute.

A tuning problem, not a structural one, and it needs real players rather than more simulation.
Candidate levers, none yet tried:

- **Halve disruption against players who have been offline a long time.** Disruption denies
  compounding and `TAX` counts denied production, so this targets what actually buries an
  infrequent player without weakening raiding. Uses `lastSeenAt`, which already exists.
- Scale the vault floor by time since last login.
- Widen the tier band for infrequent players.

**Top of the playtest agenda.**
