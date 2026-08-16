# Balance & Mathematics

Where every number came from, what the simulator proved, and which relationships must
never be broken.

**The constants live in `packages/rules/src/constants.ts`.** That file is authoritative;
this document explains it. Values marked `PROVISIONAL` are settled by playtest, not by
argument.

---

## The invariants that must never break

These are enforced by tests. Breaking one is not a balance regression — it is a broken
game, usually silently.

### `vaultMult < alloyMult` — the one that nearly killed the project

If protection compounds faster than the stock it protects, the vault eventually covers
100% of storage and **nothing in the galaxy is ever raidable again** — with no other
symptom.

The first draft shipped `900 × 1.5^L` against an `alloyMult` of 1.45:

| Level | Vault protects | Storage cap | % protected |
|---|---|---|---|
| 3 | 3,038 | 1,463 | **208%** |
| 8 | 23,066 | 9,380 | **246%** |
| 14 | 262,736 | 87,175 | **301%** |

Now `300 × 1.30^L`, and the protected *fraction* shrinks as a player grows — which is also
the intended design: beginners nearly fully protected, leaders nearly fully exposed.

`packages/rules/test/economy.test.ts` fails if the relationship ever inverts.

### Low combat variance

±8%. If randomness dominated outcomes, intel would be worthless and the core loop would
collapse. This is a design constraint, not a tuning preference.

### Dominion sums to exactly zero across a battle

Property-tested over arbitrary fleets and loot values. If it ever does not, the ladder is
creating or destroying score from nothing.

---

## Economy

```
alloyRate(L)   = 40 × 1.45^L    per hour
crystalRate(L) = 14 × 1.42^L    per hour

upgradeCost(L) = 200 × 1.55^L    alloy
               +  55 × 1.518^L   crystal   (from level 1)

storageCap     = 12 hours of production at the current level
vaultProtects  = 300 × 1.30^L   per resource, un-raidable   [PROVISIONAL]
```

### The payback curve is the brake

```
payback(L) = cost(L) / marginalGain(L) = 11.1 × 1.069^L hours
```

| Level | 1 | 5 | 10 | 15 |
|---|---|---|---|---|
| Payback | 11.9h | 15.4h | 21.6h | 30.2h |

Cost grows at 1.55 against production at 1.45, so payback lengthens with level. **That
drift is what stops a 14-day season running away** — and it is what produces the sunset:
investment stays rational while `payback < remainingHours × 0.4`, which on day 13 means
~10 hours, which no level satisfies. Every player independently stops building on the
final day.

**If you change the cost curve, re-derive the season length.** It is not an independent
choice.

### The crystal share is derived, not chosen

```
crystal income share = crystalRate(L) / alloyRate(L)   ≈ 0.34 → 0.28 over a season
crystal cost   share = crystal(L)     / alloy(L)       ≈ 0.27 → 0.22
                                                          ratio ≈ 0.78 at every level
```

Crystal shipped as a decorative resource. It was charged only from level 4, at 22% of the
alloy price, against an income that is 34% of alloy income — so it arrived half again as
fast as it could be spent, filled its twelve-hour store during the first night of every
account, and wasted from then on. Nothing in the opening consumed it at all: not the Wasp,
not a probe, not the first three upgrades. A resource a player watches accumulate and never
spends is not scarcity, it is decoration.

Two things were wrong and both are now derived rather than picked:

**The multiplier.** `crystalCostMult = costMult × (crystalMult / alloyMult) = 1.518`. Two
independently chosen multipliers drift: the old 1.58 against a 1.55 alloy curve pushed the
crystal share from 0.21 up to 0.37 across ten levels while the income share fell, quietly
inverting which resource was scarce by the late game.

**The base.** Set at ~0.78 of income parity, and that number came from the simulator rather
than from taste. At parity (base 69) crystal is spent as fast as it arrives, the stores sit
near empty, and **there is nothing left to raid**: on seed 7 raid returns fell to RR 1.25,
under the 1.3 floor, and the informed archetype dropped from first to third — selective
raiding pays a fixed scouting cost against a shrinking prize, so it suffers first. At 0.78
all three seeds hold every band and the informed archetype tops every ladder.

Crystal must be spendable **and** worth stealing. `packages/rules/test/invariants.test.ts`
holds both ends.

### Why 12 hours of storage

Sleeping eight hours arrives at ~80% of cap — close enough to feel pressure, not so close
that a normal night is punished. It also means the vault refills to a raidable amount
roughly once per real day.

---

## Combat

```
3 rounds · simultaneous fire · ±8% variance
counter cycle: WASP ▸ BULWARK ▸ LANCE ▸ WASP  at 1.6× / 0.625×
support hulls: prey to everything (1.6× taken), deal nothing, shielded while escorted

grade on VALUE destroyed:
  all defenders dead        → DECISIVE  → loot 50% of raidable
  ≥60% of value destroyed   → PARTIAL   → loot 25%
  below that                → REPELLED  → nothing

defenceSalvage = 60% of destroyed ground units rebuild free
```

### Hulls

| Hull | Class | ATK | HP | Speed | Cargo | Alloy | Crystal | Yard |
|---|---|---|---|---|---|---|---|---|
| Wasp | Skirmisher | 14 | 24 | 46 | 40 | 260 | 0 | 0 |
| Lance | Lance | 46 | 62 | 34 | 50 | 950 | 190 | 2 |
| Bulwark | Bulwark | 26 | 210 | 21 | 70 | 2,500 | 620 | 4 |
| Hauler | Support | 0 | 80 | 30 | **900** | 1,150 | 130 | 1 |
| Bastion | Bulwark · ground | 34 | 260 | — | — | 1,700 | 380 | 1 |

Bastion is **1.8× more HP per alloy** than any ship, because it can never leave. That is
the entire justification for ground defence existing as a separate thing.

### Loot

```
raidable = max(0, stock − vaultFloor)
loot     = min(raidable × grade, totalCargoCapacity)
```

**The 50% rule *is* the repeat-raid decay system**: successive raids take 50%, then 25%,
then 12.5% of the original pile. Diminishing returns arrive free — no cooldown table, no
extra state.

### Worked example

40 Wasps + 10 Lances (19,900 alloy-equivalent) vs 6 Bulwarks + 8 Bastions (28,600), no
shield:

| Round | Atk dmg | Def dmg | Attacker after | Defender after |
|---|---|---|---|---|
| 1 | 1,184 | 431 | 34 Wasp · 6 Lance | 4 Bulwark · 6 Bastion |
| 2 | 934 | 308 | 29 Wasp · 4 Lance | 3 Bulwark · 4 Bastion |
| 3 | 765 | 214 | **25 Wasp · 3 Lance** | **2 Bulwark · 3 Bastion** |

Defender value loss 63.8% → **PARTIAL**, 25% loot.

Note what the numbers did unprompted: the attacker brought the *correct* counter (Wasps at
1.6× into Bulwark-class) and still only managed a partial, because they were outvalued
1.44 to 1. **Composition earns you a fight above your weight; it does not win one for
free.**

---

## Information

```
clarity      = observerTelescopeLevel − targetVeilLevel
detectChance = clamp(0.25 + 0.18 × (radarL − probeStealthL), 0.05, 0.95)
accuracy     = clamp(0.55 + 0.12 × (probeL − veilL),         0.30, 1.00)

INTERMITTENT: refresh ≤ every 20 min, 25% of refreshes dropped
DEGRADED:     reads UNKNOWN 70% of the time
radar lead:   [L0–L2: none, L3: 5 min, L4: 8, L5: 12]
```

Floors and ceilings guarantee no investment ever buys perfect invisibility or perfect
omniscience. **The fog never fully lifts.**

### The refresh-spam rule

Telescope reads are seeded from `(watchId, floor(now / 20min))`, so a reading is identical
however many times it is requested inside its window.

**Without this, a player defeats the entire fog layer by pulling to refresh** until
`INTERMITTENT` happens to yield a confirmation. This is the easiest way to ship a broken
information game, and it is not obvious from reading the formula.

---

## Other constants

```
travelMinutes = 3 + (distance / slowestShipSpeed) × 1.2
shieldHp(L)   = 700 × 1.42^L, regen 5%/hr        [PROVISIONAL]
disruption    = 180 / 60 / 0 min, cap 240 pending [PROVISIONAL]

abuse guards  bash 3 per attacker per target per 12h
              newcomer grace 4h or Command Core L4
              rank floor: cannot attack below 40% of your Wealth

galaxy        disc radius 1000, ±120 thickness, min separation 90, 200 slots
              8–14 asteroids, period 15–40 min, mass 200–1400, damage = mass × 8
season        14 days, investment horizon share 0.4
```

---

## The simulator

`packages/sim` runs a full 14-day season with five bot archetypes executing the real rules,
deterministically from a seed. **Its regression test runs in CI on three seeds.**

```bash
pnpm sim -- --players=200 --seed=7
```

A balance regression — someone nudges a constant and the vault silently starts protecting
200% of storage again — is invisible to unit tests and catastrophic in production. A full
simulated season is the only thing that catches it, and it costs a few seconds.

### The six health invariants

| | Healthy | Means | Lever if out of band |
|---|---|---|---|
| `ARR` | 0.30–0.55 | Share of Wealth that is actually losable | Building vs ship cost balance |
| `VFR` | 0.25–0.65 | **Raidable** stock as a share of raidable capacity | Upgrade lumpiness. LOW = nothing worth raiding |
| `TI` | −0.40–0.55 | Passive players' share of an active player's ladder position | Loot grades, Bastion efficiency, disruption |
| `RR` | 1.3–3.5 | Dominion gained per unit spent gaining it | Loot grades, salvage, hull HP |
| `SV` | 0.10–0.30 | Daily Wealth churn — the re-login driver | Loot %, travel times |
| `TAX` | 0.10–0.45 | Share of a peaceful player's output taken by raiders | Disruption duration, loot %, attack frequency |

Two of these were **redefined after they failed to catch the bug they existed for**:

- `VFR` originally measured raw stock ÷ cap, and read a healthy 0.50 all season while the
  vault protected 100% of it. It now measures *raidable* fill.
- `TAX` originally used a median, which always read 0.00 because most players are not
  raided on any given day. It now uses a mean and counts production denied by disruption.

**A diagnostic that cannot fail is not a diagnostic.**

---

## What the simulator proved

### 1. The vault curve inversion
Covered above. Found on the very first run.

### 2. Haulers evaporated in round one
80 HP taking 1.6× from everything. Attackers arrived with no cargo and raiding could not
pay for itself. → **D8**.

### 3. Nobody built defence
23 Bastions across 140 planets. The bots bought buildings first and defence from the
leftovers, which meant it never got bought — buildings compound, so at the margin they
always look like the better purchase. **95% of attacks resolved DECISIVE.** → **D7**.

### 4. Grading on `ATK × HP` mis-scored every countered fight
26 Wasps (power 8.7) and 1 Bastion (power 8.8) read as equal while the Wasps annihilate it
without a casualty. → **D12**.

### 5. A spendable resource is a lootable resource

Raising the crystal price of upgrades to income parity fixed the dead-resource problem and
broke raiding in the same move — stock that gets spent is stock that is not in the store
when a fleet arrives. RR fell under its floor and the informed archetype lost the ladder on
seed 7 while every other invariant stayed green, which is exactly the failure shape a unit
test cannot see. The settled value is a compromise between the two, found by running it.

### 6. Raiding was 5% of the economy — the big one

An alloy invested compounds ~16× over a 336-hour season; an alloy stolen returns 1×.
Across a season, raiding moved 1.44M of value against a ~30M economy.

**The loot dial was provably inert:**

| `lootDecisive` | 0.4 | 0.5 | 0.6 | 0.75 | 0.9 |
|---|---|---|---|---|---|
| Raid Tax | 0.05 | 0.05 | 0.05 | 0.06 | 0.05 |
| Turtle Index | 2.20 | 1.99 | 2.02 | 2.18 | 1.99 |

Doubling loot changed nothing. Neither did the storage cap. This is why **D2 + D3 + D7**
exist, and why "just raise the loot percentage" is not a valid future suggestion.

### Where it landed

Four seeds, 140 players, 14 days — the informed archetype tops the ladder every time:

```
GRINDER  median rank  12–15    median dominion  +22,400 .. +28,300   ← informed
FARMER   median rank  42–76    median dominion   −2,400 ..  +4,800
TURTLE   median rank  55–61    median dominion         0
RAIDER   median rank  93–101   median dominion   −5,100 .. −11,000   ← blind
CASUAL   median rank  93–120   median dominion   −8,900 .. −17,000
```

Blind aggression loses money. Passive accumulation scores nothing. Information wins.

---

## Known limitations of the tool

**The bots have no skill variance**, so ladder spread reads far narrower than a real shard
would produce. **Do not tune ladder spread against the simulator.**

## The one open balance problem

**The casual archetype (2 logins/day) finishes at −10k to −19k Dominion on every seed** —
and that is the stated target user. The vault floor, bash limits and newcomer grace are not
enough on their own.

This is a tuning problem, not a structural one, and it needs real players rather than more
simulation. Candidate levers, none yet tried:

- Scale the vault floor by time since last login.
- Shorten disruption against players who have been offline a long time.
- Widen the rank floor for infrequent players.

**Top of the playtest agenda.**
