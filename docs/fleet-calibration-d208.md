# D208 fleet calibration — 32 Alloy = 16 Crystal = 1 Deuterium

Recorded 2026-09-13 from the live roster. The reproducible report is generated with:

```sh
pnpm --silent balance:fleet > fleet-calibration.json
```

The calibration value is:

```text
economicCost = Alloy + 2 × Crystal + 32 × Deuterium
```

Thus 32 Alloy, 16 Crystal and 1 Deuterium each contribute 32 units. This is a stable
L12 reference, not a claim that scarcity is constant over a season. The live producer
curves give the following hourly ratios:

| Producer level | Alloy/Deuterium | Crystal/Deuterium |
| ---: | ---: | ---: |
| 3 | 27.903 | 13.952 |
| 6 | 29.906 | 14.953 |
| 12 | 32.052 | 16.026 |
| 18 | 33.379 | 16.689 |

The rounded `32:16:1` rate is therefore correct for the requested L12 comparison. The
live combat-hull isotope rungs `2 / 6 / 20` are the D208 calibration baseline audited
below. The owner clarified that the separate production-deuterium ×2 experiment was
reverted because it broke hierarchical efficiency; it is not an applied owner multiplier
on this baseline and must not be reapplied. A
dynamic rate would describe marginal production more closely at other levels, but would
make ship prices, comparisons and merchant quotes move with progression. D208 deliberately
uses one reference.

## What “more efficient at a higher tier” means

For an ordinary combat hull the primary metric is:

```text
combat efficiency = attack × hit points / economicCost²
```

The square is required because an equal budget buys both more attack and more hit points
when it buys more ships. Higher tiers target relative products `1.00 / 1.06 / 1.12 / 1.18`.
The real three-round resolver, rather than this formula alone, is the acceptance test.

This promise is role-specific. Cargo capacity, speed, build time and exposure are separate
trades. Requiring every stat per cost to rise would make the last tier dominate every use;
combat holds therefore retain their authored `[40,85,180,380]` ladder before the speed tilt.
Dedicated transports are judged by cargo/economicCost and already rise at every tier:

| Transport | Tier | Economic cost | Hold | Hold / cost |
| --- | ---: | ---: | ---: | ---: |
| Courier | 1 | 900 | 1,000 | 1.111 |
| Wayfarer | 2 | 2,684 | 3,400 | 1.267 |
| Atlas | 3 | 7,136 | 9,500 | 1.331 |
| Argosy | 4 | 18,360 | 26,000 | 1.416 |

The least efficient transport still carries 11.67 times as much per economic value as
the most cargo-efficient warship.

## Live combat roster

`Efficiency` below is normalized to the tier-1 hull of the same profile. The Nullifier is
shown against the Ballista because it shares that hull's ordinary stats and pays a 15%
shield-breaker premium.

| Hull | Tier | Profile | A | C | D | Economic cost | Attack | HP | Hold | Fuel mass | Efficiency |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dart | 1 | Raider | 300 | 60 | 0 | 420 | 21 | 77 | 30 | 7 | 1.000 |
| Viper | 2 | Raider | 750 | 180 | 2 | 1,174 | 60 | 223 | 64 | 18 | 1.059 |
| Tempest | 3 | Raider | 1,800 | 450 | 6 | 2,892 | 152 | 564 | 135 | 43 | 1.118 |
| Corsair | 4 | Raider | 4,500 | 1,200 | 20 | 7,540 | 408 | 1,508 | 285 | 111 | 1.181 |
| Pike | 1 | Striker | 300 | 60 | 0 | 420 | 21 | 75 | 40 | 5 | 1.000 |
| Talon | 2 | Striker | 750 | 180 | 2 | 1,174 | 63 | 214 | 85 | 13 | 1.096 |
| Ballista | 3 | Striker | 1,800 | 450 | 6 | 2,892 | 160 | 538 | 180 | 32 | 1.153 |
| Cataclysm | 4 | Striker | 4,500 | 1,200 | 20 | 7,540 | 431 | 1,425 | 380 | 83 | 1.210 |
| Rampart | 1 | Fortress | 375 | 75 | 0 | 525 | 24 | 105 | 50 | 5 | 1.000 |
| Stronghold | 2 | Fortress | 938 | 225 | 3 | 1,484 | 68 | 313 | 106 | 14 | 1.057 |
| Leviathan | 3 | Fortress | 2,250 | 563 | 8 | 3,632 | 168 | 804 | 225 | 32 | 1.120 |
| Citadel | 4 | Fortress | 5,625 | 1,500 | 25 | 9,425 | 436 | 2,205 | 475 | 83 | 1.184 |
| Warden | 1 | Escort | 300 | 60 | 0 | 420 | 20 | 79 | 36 | 6 | 1.000 |
| Sentinel | 2 | Escort | 750 | 180 | 2 | 1,174 | 58 | 232 | 77 | 15 | 1.090 |
| Praetorian | 3 | Escort | 1,800 | 450 | 6 | 2,892 | 145 | 592 | 162 | 36 | 1.146 |
| Paladin | 4 | Escort | 4,500 | 1,200 | 20 | 7,540 | 384 | 1,601 | 342 | 93 | 1.207 |
| Nullifier | 3 | Shield breaker | 2,070 | 518 | 7 | 3,330 | 160 | 538 | 180 | 37 | 0.754 vs Ballista |

Dart, Thorn, Bastion, Prospector and Garbage Collector retain their owner-set or special
fixtures. The Nullifier's lower ordinary efficiency is intentional: its invoice premium
buys damage against Aegis, rather than free conventional firepower. At a 50,000 budget and
Aegis L10 it improves mean economic exchange over Ballista by 2,220 against Bastion, 4,788
against Thorn and 10,110 against Leviathan. With no shield it is always worse; as fleet
budgets grow, the fixed shield becomes a smaller part of the fight. It is therefore a niche
choice rather than a universal upgrade.

## Simulation coverage and result

The final audit used 64 deterministic samples per isolated row and resolved **657,088**
isolated battles. It also ran 12 event-free 14/30-day seasons containing **92,056** real
player attacks. Merchant, Asteroid Shower and Intergalactic Convoy are excluded from season
simulation by design.

| Check | Rows | Result |
| --- | ---: | --- |
| All 17×17 ordered combat pairs, 3 budgets, neutral/max equal research | 1,734 | 0 counter-direction failures |
| Adjacent same-profile progression at 1,000,000 budget | 12 | 12/12 higher tiers gain exchange and retain more value |
| One, three and twelve higher-tier hulls against equal-budget lower tier | 36 | 36/36 pass |
| Max-tech attacker against every defender pairing | 289 | 0 counter-direction failures |
| Physical component wallets, fuel, shields, packets and both directions | 8,100 | Diagnostic grid completed; 720 rows have an unaffordable empty packet |
| Nullifier/Ballista specialist cases | 96 | Shield premium is a real opportunity cost and produces a bounded niche |

The physical grid does not impose “higher tier always wins” on arbitrary compositions. That
would erase the counter game and the value of shields. In the comparable same-packet rows at
wallet scales 4 and 16, every one of the 180 shieldless higher-tier attacks wins its economic
exchange. Aegis L6 overturns 24/180 and Aegis L10 overturns 132/180; those are paid wall effects,
not a tier inversion. Small wallets also expose whole-ship and isotope/fuel granularity, which
is why the acceptance rule uses available economic budget and separately audits physical wallets.

The 1,000,000-budget adjacent-profile exchanges were all positive. The smallest mean advantage
was Stronghold over Rampart at 36,438 economic units; the largest was Talon over Pike at 79,102.

## Season impact

This is not an adversarial fastest-colony bound. A real-server solo route at seed
4242 founded its first T1 colony **52.59 minutes after Academy exit**, with paid
ships, real seeded positions, five probes and two raids, without merchant,
additional grants or another player's help. The current capital Core 2→6
base timers sum to only 24.88 minutes; an Academy graduate can fund that gate,
the two founding Couriers and the charge from the shipped package and accessible
rewards. Taking someone else's public claim does not require clearing its garrison
personally. See `docs/snowball-audit-2026-09-13.md`; the 4.52-day average-bot first
colony below must never be presented as proof against a sub-hour opportunistic capture.

Values are medians within each cohort. `Before` is the pre-D208 snapshot from the same seeds;
`Current` uses the final D208 roster together with the current D209 colony model, including
persistent neutral shield charge. The 300-player cohort contains two seeds, so its displayed
median is their midpoint.

| Cohort | Metric | Before | Current | Health band |
| --- | --- | ---: | ---: | --- |
| 50 players / 14 days | ARR | 0.2180 | 0.2204 | **below** 0.275–0.55 |
|  | VFR | 0.0867 | 0.0880 | inside 0.085–0.65 |
|  | RR | 0.7578 | 0.7797 | inside 0–2 |
|  | SV | 0.1318 | 0.1259 | inside 0.10–0.30 |
|  | TAX | 0.0454 | 0.0434 | inside 0.04–0.45 |
| 50 players / 30 days | ARR | 0.2645 | 0.2590 | **below** 0.275–0.55 |
|  | VFR | 0.2727 | 0.2557 | inside 0.085–0.65 |
|  | RR | 0.9793 | 1.0814 | inside 0–2 |
|  | SV | 0.0501 | 0.0499 | **below** 0.10–0.30 |
|  | TAX | 0.1339 | 0.1515 | inside 0.04–0.45 |
| 300 players / 30 days | ARR | 0.2712 | 0.2673 | **below** 0.275–0.55 |
|  | VFR | 0.2738 | 0.2710 | inside 0.085–0.65 |
|  | RR | 1.0096 | 1.1166 | inside 0–2 |
|  | SV | 0.0487 | 0.0465 | **below** 0.10–0.30 |
|  | TAX | 0.1850 | 0.1960 | inside 0.04–0.45 |

The pooled TI median is 0 in every cohort and remains inside its band. One 50-player seed (7)
reports 15.748 because its denominator is near zero; this is the documented small-cohort TI
artifact, not a result shared by the 300-player runs (both are 0). The table still does not
justify declaring overall season health fixed: ARR remains below its floor in every cohort and
30-day SV remains low. The 14-day VFR median passes, although seeds 7 and 1337 are below its
floor. TAX is inside its band in all three cohorts. These alarms remain open and their bands were
not widened.

In both current 300-player runs the first neutral colony was captured at minute 6,519/6,527
(day 4.52/4.53), and all 65 neutrals were captured by approximately day 19.6. The calibrated
model therefore does not reproduce a one-to-two-hour colony rush. This is deterministic model
evidence, not a guarantee about adversarial production behaviour.

## Dominion boundary

D208 changes battle outcomes and ship recipes, so it affects Dominion **indirectly** through
which ships die, how much raw recipe value is lost and how much loot returns. The merchant itself
moves no Dominion.

The `32:16:1` weights are not used directly by Dominion in this cutover. Runtime `fleetValue`,
secured-loot scoring and the recorded battle journal still use physical `A + C + D` units.
Consequently one Deuterium represents 32 Alloy of L12 production effort in calibration but one
raw unit in current Dominion. This preserves the current ruleset and historical score journal,
but means Dominion should not be described as `32:16:1` economic value. Repricing it requires a
separate ruleset boundary, report/journal migration policy and a fresh season-band calibration.

## Source fingerprints

```text
valuation.ts                 03e641b18e8c348f3568fb4722463ef938eda6d4262c8a5ee38ed14703e68d43
hulls.ts                     ed3a1a5031680122a76b064dcb760fe93f2cfd5f7523496ca6f513ff647e4ae1
combat.ts                    deb5f30a28c4d8fb5500331bd6d9ed8ecc5035076b3aef90a26264bda32e8cc8
economy.ts                   778632ad4e44fd9f78575eed17aacd1b2522d13a20750f86a5c7194cb8c596ed
economy-profile.ts           25d14e34bd2d34c07f40c3ce1f58e29d309c64ad9b0ace74b8cf79753b9319ff
constants.ts                 044cb7618d5cf8b5554bf8e5aed49549bc4c1ed8ca968f657a9350adb33b3353
fuel.ts                      a240ba94ebd1058d6a54c6e8860e36879029a4ada605a7da896b3a30100cfd5b
tech.ts                      f8efd293778790645ceb0f6cb069133acb3e67b862314b17498845676bc17717
loot.ts                      969805cfa2fda1f9009e9f003efeb6e83af5151cf3225c6bf005fb7c05a29f7f
salvage.ts                   b6e6300b7cff8738bb1bfabe232bcb779c0f7b182483975bdd82b81e63ea3e39
score.ts                     ecaea2c3b2eebcf8ef5af50a5c3b8e7f55c10c8301adc07f714861a834c489b0
pirates.ts                   984ffa3b80efd7bb133af7235b88b65468fffdc57a2506734bcbd85a22c9ab32
pirate-admission-prices.ts   3fbbb19819b9a6d23436b3e49c8d9080316f060e24557be6ce7e47f80bd1aaee
fleet-calibration.ts         67e545326e39ee35200b3005cef927ff226251d8e076991fda7259de30f07019
fleet-calibration-tool.ts    e7d792281b21a12ebb99275ee9930050f2d11f39d97da9562dd1850681bb548d
season.ts                    2878ed0907a18d0a9815135300befa3cc19c632e9027d229e746380536240d5f
```

Checkpoint preparation removed one extra blank line at the end of
`pirate-admission-prices.ts`; its measured pre-cleanup hash was
`20dc1eb2ba2e1fa38266760a36cab3dc3ef6f5ce9211aa03051886dbe37cdced`.
The fingerprint above identifies the committed bytes; prices and runtime logic are unchanged.
