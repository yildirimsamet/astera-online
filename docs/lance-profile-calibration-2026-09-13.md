# Attack-led Lance calibration — 2026-09-13, revised 2026-09-14

Calibration began against `56fe1cb` and was revised on 2026-09-14 before release qualification.
Owner requested attack above HP for every Lance without repricing ships or changing
efficiency. The current 30% price uplift is retained; production deuterium is not doubled.
Earlier [D208 tables](fleet-calibration-d208.md) are historical, not this roster.

## Selected profile

| Hull | Historical attack / HP | First attack-led | Revised attack / HP | Unchanged Alloy / Crystal / Deuterium |
| --- | ---: | ---: | ---: | ---: |
| Pike | 21 / 75 | 41 / 39 | 42 / 38 | 390 / 78 / 0 |
| Talon | 63 / 214 | 119 / 113 | 120 / 111 | 975 / 234 / 2 |
| Ballista | 160 / 538 | 301 / 285 | 305 / 282 | 2,340 / 585 / 6 |
| Cataclysm | 431 / 1,425 | 807 / 762 | 816 / 754 | 5,850 / 1,560 / 20 |
| Nullifier | 160 / 538 | 301 / 285 | 305 / 282 | 2,691 / 674 / 7 |

The 2026-09-14 follow-up uses
`LANCE_ATTACK_HP_RATIO = [1.08, 1.081, 1.082, 1.083]`. Reciprocal factors preserve
the **unrounded** attack × HP product exactly; independent integer rounding changes
the historical product by at most 1.334% (Pike). All existing same-tier and
hierarchical efficiency bands pass unchanged. Each ordinary Lance costs the same
as its Raider counterpart, with roughly twice the attack and half the hull.
Other hulls, cargo, speed, fuel mass, work time and recipes are unchanged.
Nullifier still costs more than Ballista and buys shield-only damage, not generic power.

## Actual engine verification

Measured with `calibrationReport({ seasons: false, samples: 64 })`, using the real
`resolveCombat` engine, economic value `A + 2C + 32D` and budgets 50k / 240k / 1m.
No unlock investment or automatic resource conversion is credited.

- 1,734 ordered equal-budget combat pairs: zero strong/weak counter-sign failures.
- Maximum attacker research at 240k: zero counter-sign failures.
- All 12 adjacent same-profile tier checks have positive mean permanent-loss exchange
  and greater mean attacker retained value; all small-budget checks pass as well.
- 8,100 physical-wallet raid rows and 96 specialist rows were computed as diagnostics,
  **not** unconditional win guarantees for arbitrary fleets, shields or wallets.
- At all three budgets with no shield, Nullifier's mean exchange never exceeds
  Ballista's against Bastion, Thorn, Leviathan or Atlas. Against Atlas both clear it;
  the paid specialist does not become a better generic purchase.

At 1m, the Lance progression results are:

| Higher → lower | Mean exchange | Mean attacker retained | Mutual annihilation / 64 |
| --- | ---: | ---: | ---: |
| Talon → Pike | +7,366.50 | 0.68% | 45 |
| Ballista → Talon | +6,773.63 | 0.72% | 45 |
| Cataclysm → Ballista | +6,706.88 | 0.66% | 46 |

Important trade-off: attack above HP plus simultaneous fire makes Lance mirrors
very destructive. The tier advantage is a **mean economic advantage**, not reliable
survival. At the mean roll, 30 Talons versus 30 Talons erase both sides. The engine
grades the cleared defender DECISIVE, but no surviving attacker means no raid loot
or return fleet. A caretaker-world DECISIVE still opens the separate neutral claim
window; a later settlement fleet may take it. Forecast grades and survival/loss
estimates must be read separately. The rejected 1.10–1.40 ladder and the two wider
2026-09-14 candidates destroyed the upper-tier advantage through one-salvo
saturation; they are not the implementation.

At a 240k mirror budget over 1,000 seeds, mutual annihilation measured 100% for
Pike, 93.7% for Talon, 94.0% for Ballista and 94.6% for Cataclysm. This is accepted
as the high-lethality identity of an attack-led pure Lance mirror, not treated as
a resource-growth route: it returns no raid loot, creates only the ordinary public
wreck fraction and keeps player Dominion zero-sum.

Reproduce the complete isolated report (no seasons):

```sh
pnpm exec tsx tools/fleet-calibration.ts --no-seasons
```

Rules source SHA-256 at measurement:

- `economy-profile.ts`: `a9e178d4f510cb3362e8773568addaf0b5fdcef3d9423d29a5c0a0dc2399711b`
- `combat.ts`: `deb5f30a28c4d8fb5500331bd6d9ed8ecc5035076b3aef90a26264bda32e8cc8`
- `hulls.ts`: `8e9ea3a2545f5ab2d68aee9a28ba5e4d016fbad2e8ef79158f398bc3103a5d71`

## Verification scope and remaining failures

TR/EN Vocabulary descriptions were brought in line with actual hull roles, equal
prices, speed ties, cargo roster, Vault purchase coverage and capital-Core colony
gates. This is a text/rules change, not a layout redesign.

Targeted fleet/combat rules passed (112 tests in the final focused check); the final
forecast/profile pass has 28 passing tests. The existing Fleet V2 balance suite has
10 passes and one pre-existing skip. The final i18n/Vocabulary/research/probe UI
pass has 146 passing tests. Workspace typecheck and root `pnpm lint` passed.
The old forecast fixture's half-again assumption no longer applies to the
new Lance profile: it is kept on the unchanged Viper profile with its original
numeric band, while Lance mirrors are checked against actual engine grades.

The full verification suite is **not claimed green**: stale economy/calibration
fixtures still assume pre-30% prices, old passive production or old Escort recipes
(including `fuel.test.ts`, `garbage-collector.test.ts` and non-matrix
`packages/sim/test/fleet-calibration.test.ts` cases). Those were not loosened or
fixed, as requested. The full simulator run retained 104 passes, 11 skips and 11
known-red economy/season fixtures. Independently edited mining files are not part
of this task's result.

Visual smoke check: the standard write-free baseline reached the rehearsal but
timed out taking its screenshot under software WebGL. A separate 350×812 TR
rehearsal capture at DPR 1 succeeded with zero page errors after pausing the
already-rendered scene; screenshot: `/tmp/astera-lance-visual.wKL73oOX/phone-350.png`.
This checks the preview surface, not every authenticated hull detail sheet.

The full server run has 1,590 passes and 31 failures across eight files. The failures
are stale pre-30% price/time/fuel/Core fixtures plus snowball strategies whose pure
Lance fleets now die, miss a claim window or exceed the measurement horizon. Those
failed routes are a stricter outcome, not a path to faster growth. Combat matrices,
pirate handle compatibility, neutral capture invariants, bots, queues and the other
server contracts passed. No claim is made that `pnpm verify` is fully green.
