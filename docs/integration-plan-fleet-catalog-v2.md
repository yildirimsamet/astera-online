# Fleet Catalog V2 — Living Integration Plan

> Status: **ACTIVE — Phase 9 blocked on a real-phone measurement**  
> Owner instruction: replace the current ordinary space-hull catalog with the 18 supplied ship
> assets at the next season boundary, while preserving Probe, Death Star, Prospector, Bastion,
> Thorn and Aegis.  
> Last updated: 2026-09-01

This is the execution ledger for Fleet Catalog V2. It is not a speculative design note. Every
phase has an entry gate, an ordered implementation checklist, a verification gate and an explicit
list of working behavior that could be broken. A phase is marked complete only after its tests and
required measurements pass. When implementation discovers a new dependency, risk or changed
decision, this document is updated before the work continues.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete and verified
- `[!]` Blocked; the phase log must state the blocker and evidence
- `[—]` Deliberately out of scope

## Phase board

| Phase | Scope | Status | Completion evidence |
|---|---|---|---|
| 0 | Design contract, authority and catalog specification | `[x]` | D148 + design/balance docs agree with this plan |
| 1 | Rules tests first: types, catalog, partitions and invariants | `[x]` | 9 focused contracts: 7 expected failures, 2 preserved-invariant passes; typecheck green |
| 2 | Complete rules vertical slice | `[x]` | Rules typecheck + 536/536 tests pass with Fleet V2 |
| 3 | Simulator migration and numeric calibration | `[x]` | Simulator typecheck + 87/87 tests; 450 matrix cases and pacing gates pass |
| 4 | Canonical 2D/3D asset pipeline | `[x]` | 18 exhaustive entries; unsimplified geometry; 202–289 KiB per runtime hull |
| 5 | Complete server vertical slice | `[x]` | Server typecheck + 47 files / 1,049 tests; caller audit green |
| 6 | Complete web vertical slice | `[x]` | Web typecheck + 121 files / 1,734 tests; portrait visual run has no runtime errors |
| 7 | Tools, harnesses and repository-wide caller audit | `[x]` | Harnesses migrated; full lint/typecheck/test gates pass |
| 8 | Atomic season cutover rehearsal | `[x]` | v4 rollover, restored-DB audit and end-to-end smoke pass |
| 9 | Full verification and visual QA | `[!]` | Automated/emulated gates pass; no physical phone is attached |
| 10 | Two-player playtest and release handoff | `[ ]` | Tactical readability and release acceptance recorded |

## 1. Outcome and core-loop problem

The current ordinary fleet has too few meaningful compositions. Once a player knows the broad
counter relationship, most choices collapse into fleet size rather than a tactical decision. Fleet
Catalog V2 adds a bounded second decision layer:

- attack versus hull durability;
- speed/exposure time versus hull durability;
- cargo capacity versus speed;
- immediate cheap production versus research-gated efficiency;
- counter class versus the target composition;
- shield-breaking specialization versus generic battle efficiency.

The system must strengthen information, risk and opportunity without adding a module designer or
mid-combat micromanagement. The player chooses authored hulls and fleet composition. The server
continues to resolve three simultaneous-fire rounds with bounded ±8% variance.

## 2. Locked owner decisions

The following decisions were confirmed for this work:

1. Every `level-N-M` asset is a separate craftable hull. `N` is the progression level and `M`
   distinguishes multiple hulls at that level.
2. Stats are authored per hull. Players do not distribute points or install modules at craft time.
3. Higher-level hulls have better cost-to-stat efficiency, but lower-level hulls must retain a use
   through speed, price, build time, hangar bulk, cargo role or a missing high-tier equivalent.
4. The visible `SKIRMISHER → BULWARK → LANCE → SKIRMISHER` counter cycle remains.
5. Probe, Death Star, Prospector/Drill, Bastion, Thorn and Aegis remain functionally unchanged.
6. A bounded direct propulsion research ladder may increase fleet speed.
7. Activation happens at the next season boundary, never as an in-flight hull translation.
8. English and Turkish names, role copy and descriptions are part of this implementation.
9. The guided opening builds exactly two Darts; Pike is introduced after onboarding rather than
   changing the opening scarcity lesson.

## 3. Scope boundaries

### In scope

- Replace Wasp, Lance, Bulwark, Hauler, Runner and Breacher as sold ordinary space hulls.
- Add all 18 supplied craft as independent catalog entries.
- Add tier, family, profile, coefficients and research gates to the authoritative rules catalog.
- Replace obsolete hull doctrines and permissions with the Fleet V2 research structure.
- Preserve the counter cycle, support protection, shield-only specialist damage and combat trace.
- Reprice bulk, fuel, build times and opening resources through existing canonical formulas.
- Update server validation, API contracts, client prediction, UI, i18n, assets and simulations.
- Replace Wasp-specific onboarding/rewards/templates with Fleet V2 concepts.
- Activate the catalog only for a fresh season and retire old asset references after verification.

### Out of scope

- `[—]` Custom modules, sockets, per-ship point allocation or ship refitting.
- `[—]` Mid-battle controls or a change to three-round combat.
- `[—]` New ground defence hulls. Their later design is a separate owner-directed system.
- `[—]` Probe, Death Star, Prospector/Drill behavior changes.
- `[—]` Aegis mechanics beyond validating Nullifier against the existing shield.
- `[—]` Mid-season conversion or compensation for old hulls.
- `[—]` Economy retuning unrelated to hull affordability and required opening/progression gates.

## 4. Authoritative catalog specification

Identifiers are stable English uppercase rule IDs. Display names are localized. Asset-family labels
describe the supplied art and are not themselves combat classes.

| Rule ID | Asset | EN | TR | Tier | Family | Combat class | Primary decision |
|---|---|---|---|---:|---|---|---|
| `DART` | offensive L1-1 | Dart | Ok | 1 | OFFENSIVE | SKIRMISHER | Maximum entry speed; fragile |
| `PIKE` | offensive L1-2 | Pike | Kargı | 1 | OFFENSIVE | LANCE | Entry attack specialization |
| `RAMPART` | defensive L1-1 | Rampart | Sur | 1 | DEFENSIVE | BULWARK | Cheap stationary durability |
| `WARDEN` | defensive L1-2 | Warden | Muhafız | 1 | DEFENSIVE | BULWARK | Mobile escort; less hull than Rampart |
| `COURIER` | cargo L1 | Courier | Kurye | 1 | CARGO | SUPPORT | Fast, low-capacity transport |
| `VIPER` | offensive L2-1 | Viper | Engerek | 2 | OFFENSIVE | SKIRMISHER | Efficient fast raider |
| `TALON` | offensive L2-2 | Talon | Pençe | 2 | OFFENSIVE | LANCE | Mid-tier strike hull |
| `STRONGHOLD` | defensive L2-1 | Stronghold | Hisar | 2 | DEFENSIVE | BULWARK | Durable line hull |
| `SENTINEL` | defensive L2-2 | Sentinel | Nöbetçi | 2 | DEFENSIVE | BULWARK | Faster mid-tier escort |
| `WAYFARER` | cargo L2 | Wayfarer | Seyyah | 2 | CARGO | SUPPORT | Balanced transport |
| `TEMPEST` | offensive L3-1 | Tempest | Kasırga | 3 | OFFENSIVE | SKIRMISHER | Fastest late-game combat option |
| `BALLISTA` | offensive L3-2 | Ballista | Balista | 3 | OFFENSIVE | LANCE | Research-gated heavy attack |
| `LEVIATHAN` | defensive L3-1 | Leviathan | Leviathan | 3 | DEFENSIVE | BULWARK | Research-gated maximum line hull |
| `PRAETORIAN` | defensive L3-2 | Praetorian | Praetoryen | 3 | DEFENSIVE | BULWARK | Research-gated advanced escort |
| `ATLAS` | cargo L3 | Atlas | Atlas | 3 | CARGO | SUPPORT | Maximum capacity, slow and bulky |
| `NULLIFIER` | shield breaker | Nullifier | Söndürücü | 3 | SPECIALIST | LANCE | Poor generic value; shield-only bonus |
| `CATACLYSM` | offensive L4 | Cataclysm | Kıyamet | 4 | OFFENSIVE | LANCE | Capital strike hull; no L4 raider peer |
| `CITADEL` | defensive L4 | Citadel | Kale | 4 | DEFENSIVE | BULWARK | Capital defensive hull |

The class assignments above are the simulator's starting hypothesis, not untouchable balance
facts. In particular, Warden/Sentinel/Praetorian as a second Bulwark line and Cataclysm as the only
tier-4 offensive class must pass Phase 3's all-pairs and mixed-fleet acceptance. A class may move
only with recorded simulation evidence; asset family and localized name do not force combat class.

### Preserved catalog entries

- `PROSPECTOR` remains the mining craft and is excluded from ordinary garrison combat.
- Probe remains a typed strategic/intel asset, not a Fleet V2 hull.
- Death Star remains a typed strategic asset, not a Fleet V2 hull.
- `BASTION` and `THORN` remain ground hulls with the existing counter classes and salvage rule.
- Aegis remains a world shield and is not represented as hull defence.

### Catalog metadata

The authoritative rules object must expose enough metadata that server, simulator and web do not
reconstruct its meaning:

```ts
type ShipTier = 1 | 2 | 3 | 4;
type HullFamily = 'OFFENSIVE' | 'DEFENSIVE' | 'CARGO' | 'SPECIALIST' | 'PRESERVED';
type HullProfile =
  | 'RAIDER' | 'STRIKER' | 'FORTRESS' | 'ESCORT' | 'TRANSPORT' | 'SHIELD_BREAKER'
  | 'EMPLACEMENT' | 'MINER';

interface ResearchRequirement {
  project: ResearchProjectId;
  level: number;
}

interface Hull {
  id: HullId;
  name: string;
  tier: ShipTier | null;
  family: HullFamily;
  profile: HullProfile;
  cls: HullClass;
  atk: number;
  hp: number;
  speed: number;
  cargo: number;
  alloy: number;
  crystal: number;
  deuterium: number;
  minShipyard: number;
  requiredResearch: readonly ResearchRequirement[];
  ground: boolean;
}
```

This sketch does not authorize parallel duplicated coefficient tables. Whether coefficients are
stored in the final object or used only by a catalog constructor will be decided in Phase 2. The
runtime catalog exposes final authoritative stats.
The preserved entries use `tier: null`, `family: 'PRESERVED'` and an
`EMPLACEMENT`/`MINER` profile so callers cannot accidentally group them into the 18-hull Fleet V2
progression while the shared `HULLS` record remains exhaustive.

## 5. Balance model

### 5.1 Economic value

`effectiveCost` uses the rules package's canonical resource value. Alloy, Crystal and Deuterium
must remain separate in the actual price because their availability and strategic purpose differ.
No client or server caller may substitute Alloy-only cost.

### 5.2 Two validations, not one magic formula

The authored stat budget checks whether a price is internally coherent:

```text
budget = effectiveCost × tierBudgetFactor
spent  = attackWeight × attack
       + hullWeight × hp
       + speedWeight × speedPremium
       + cargoWeight × cargo
```

The combat acceptance metric checks equal-budget battle efficiency:

```text
combatEfficiency = attack × hp / effectiveCost²
```

The first formula prevents arbitrary pricing. The second catches apparently equal stat sums that
perform very differently in combat. Neither replaces simulation of counters, mixed fleets, speed,
fuel, hangar bulk, build time, Aegis or ground defence.

### 5.3 Initial tier targets

These are calibration targets, not constants to ship without measurement:

| Tier | Relative equal-cost combat efficiency | Intended reason to buy |
|---|---:|---|
| 1 | 1.00 | Cheap, fast build, low bulk, early access |
| 2 | 1.06 | Improved efficiency without research |
| 3 | 1.12 | Research-earned specialization |
| 4 | 1.18 | Capital efficiency at high opportunity cost |

Tier efficiency and full military research together must remain below the information/counter
advantage. A T4 hull plus maximum research may not erase a correctly scouted counter composition.

### 5.4 Penalty relief

Higher tiers buy a smaller penalty for a similar specialization. A starting attack profile may use
approximately `+30% attack / -25% hp`; later tiers move the hp penalty toward `-20%`, `-15%` and
`-10%`. Speed profiles pay a direct combat-efficiency cost. Exact values are accepted only through
Phase 4 simulation.

### 5.5 Keeping lower tiers relevant

- There is no L4 Skirmisher; Tempest remains the late-game speed ceiling.
- There is no L4 cargo hull; Courier/Wayfarer/Atlas remain mission choices rather than replacements.
- Entry hulls have shorter build times and lower single-loss cost.
- Price-derived bulk must preserve meaningful cheap-hull density without creating swarm dominance.
- Fleet speed remains the slowest included mobile hull, so a capital hull is a real timing decision.
- Fuel remains bulk × distance and never gains a speed factor under D136.
- Support hulls remain protected only while combat hulls survive under D8.

### 5.6 Cargo and support mission semantics

- Raid cargo capacity (`fleetCargo`) continues to sum the cargo field of every mobile Fleet V2
  hull, so a combat hull may carry a small authored amount rather than becoming an implicit cargo
  ship.
- World-transfer and clan-logistics capacity count only Courier, Wayfarer and Atlas. They do not
  reinterpret incidental combat-hull holds as dedicated freight capacity.
- A support-only **attack** remains illegal. Support-only transfer, clan aid and other existing
  logistics missions remain legal.
- Cargo Holds continues to lift raid-return capacity and does not silently change the separate
  world-transfer calculation.
- Final incidental cargo figures are calibrated with loot return in Phase 3; zero cargo on every
  combat hull is not assumed without measurement.

### 5.7 External reference findings

These references inform the questions and acceptance tests; Astera does not copy their complexity
or numeric scale.

- EVE Online's 2026 role pass explicitly increases raider damage while lowering durability and
  frames sharper roles as the answer to dominant all-purpose ships. That supports authored
  Raider/Striker/Fortress/Escort profiles and rejects a universally efficient hull:
  [Catalyst Major Update](https://www.eveonline.com/news/view/catalyst-major-update).
- EVE's drone rebalance places variants on a continuous speed-versus-damage spectrum, then keeps a
  visible quality progression whose higher cost and requirements buy bounded improvement. Astera
  adopts the spectrum idea but keeps its tier gain much smaller because the counter cycle must
  remain dominant:
  [Giving drones an assist](https://www.eveonline.com/news/view/giving-drones-an-assist).
- EVE's Tech I cruiser review treats early hull obsolescence as a balance failure and restores use
  through mobility and distinct support/disruption/attack/combat roles. That directly supports
  keeping Dart, Courier and the other low tiers useful after T3/T4 unlock:
  [Ship balancing winter update](https://www.eveonline.com/news/view/ship-balancing-winter-update).
- OGame's archived drive reference applies research to base ship speed and separates that from the
  fuel paid for a fixed full-speed trip. Astera keeps the same conceptual separation but uses a
  25%-per-rung Propulsion ladder — 2% at D148, raised by D152 — and preserves its own
  bulk × distance fuel rule:
  [Drives FAQ](https://board.en.ogame.gameforge.com/index.php?postID=842116&thread/78603-drives-faq/=).

The practical consequence is deliberate: Phase 3 tunes profiles, opportunity cost and mission
timing, not a module-fitting metagame. A high-tier ship must be better at its job without becoming
the correct answer to every target, and a speed choice must remain visible in durability or cargo.

## 6. Research contract

Wasp/Lance/Bulwark doctrines, Weapons General and Runner/Breacher production gates retire with the
old catalog. `EMPLACEMENT_DOCTRINE` remains because it is the existing progression for the
explicitly preserved Bastion and Thorn. Research remains commander-wide, three-deep and
irreversible under D4/D134/D140.

| Project | Levels | Direct effect | Permission effect |
|---|---:|---|---|
| `STARSHIP_ENGINEERING` | 2 | None beyond its unlocks | I opens T3; II opens T4 |
| `SHIP_POWER` | 5 | Bounded attack bonus | Advanced offensive prerequisites |
| `SHIP_ARMOR` | 5 | Bounded hull-HP bonus | Advanced defensive prerequisites |
| `SHIP_PROPULSION` | 4 | +25% speed a rung, to ×2 at the top (D152) | Atlas/advanced mobility prerequisite |
| `EMPLACEMENT_DOCTRINE` | 5 | Existing ground attack/HP effect | Preserved unchanged for Bastion/Thorn |

`STARSHIP_ENGINEERING` has no prerequisite. `SHIP_POWER` and `SHIP_ARMOR` each require at least
Engineering I; the current single-parent research model can express that as a prerequisite on the
Engineering project because owning the prerequisite means level one or higher. `SHIP_PROPULSION`
instead requires `DENSE_FUEL_CELLS`, preserving that discovery's concrete follow-on. These are
project-tree gates; the per-hull `requiredResearch` list below remains the final build authority.

`DENSE_FUEL_CELLS` remains a discovered Frontier project and opens the Ship Propulsion ladder, so
the successful cargo-limited raid discovery retains a concrete effect after Runner retires.
`GRAVITIC_CHARGES` remains a discovered Frontier project and contributes to the Nullifier gate.
Death Star research remains unchanged.

The complete Fleet V2 research catalog therefore remains fifteen projects: four Frontier, four
economy, four new fleet-system projects, the preserved Emplacement Doctrine and two strategic
projects.

### Research effect boundaries

- Ship Power changes the ordinary attack of Fleet V2 combat hulls, including Nullifier; it does
  not affect cargo hulls, Bastion, Thorn, Prospector, Probe or Death Star.
- Ship Armor changes HP for all eighteen Fleet V2 hulls, including cargo, but not Bastion, Thorn,
  Prospector, Probe or Death Star.
- Ship Propulsion changes only the speed of the eighteen Fleet V2 mobile hulls. It never changes
  Prospector, Probe or Death Star speed.
- Emplacement Doctrine remains the only one of these projects that changes Bastion or Thorn.
- Engineering grants only the stated T3/T4 permissions; every purchased rung opens real hulls and
  therefore satisfies D36.

Initial gate specification:

| Hull group | Gate |
|---|---|
| Dart, Pike, Rampart, Warden | Shipyard 0 |
| Courier | Shipyard 1 |
| Viper, Talon, Stronghold, Sentinel, Wayfarer | Shipyard 2; no research requirement |
| Tempest, Ballista | Shipyard 4 + Engineering I + Power II |
| Leviathan, Praetorian | Shipyard 4 + Engineering I + Armor II |
| Ship Propulsion ladder | Dense Fuel Cells discovery |
| Atlas | Shipyard 4 + Engineering I + Propulsion II |
| Nullifier | Shipyard 4 + Engineering I + Gravitic Charges |
| Cataclysm | Shipyard 6 + Engineering II + Power IV + Armor II |
| Citadel | Shipyard 6 + Engineering II + Armor IV + Power II |

Settlement requires exactly two Couriers. The rules-owned settlement contract exposes the hull ID
and count (`transportHull: 'COURIER'`, `transports: 2`) instead of retaining a field called
`haulers`; server, simulator and web must consume those values rather than reconstructing the fleet.

Power × Armor at maximum remains within the existing 25% combined military-product ceiling.
Power and Armor split that product ceiling: at maximum each contributes `sqrt(1.25)` to its own
stat, producing `1.25` only when both are complete. Propulsion initially uses a 2% additive speed
factor per rung, capped at 1.10, and affects only missions quoted/launched after completion.
Existing missions keep their stored authoritative `arriveAt`. Emplacement Doctrine retains its
current direct per-rung factor; retiring Weapons General must not silently fold that removed bonus
into the preserved ground project.

All combat-relevant completed research remains probe-visible. Attacker attack/hull research freezes
at launch; defender attack/hull research is read at combat. The speed outcome is already frozen by
the launched mission's timestamps.

Research pacing is part of balance acceptance, not a later economy cleanup. Phase 3 must measure
the earliest realistic T3 and T4 completion, queue displacement against economy/strategic projects,
Deuterium demand and useful playtime remaining in a fourteen-day season. L4 fails if it is either a
routine early purchase or unlocked too late to create a real fleet decision.

## 7. Phase execution plan

### Phase 0 — Design contract, authority and catalog specification `[x]`

#### Entry gate

- Owner answers recorded in this document.
- `CLAUDE.md`, relevant decisions, design, balance, interface and visual guidance read.
- Dirty worktree inspected and unrelated user changes identified.

#### Ordered work

- [x] Create this living plan.
- [x] Add D148, superseding the ordinary-hull parts of D94/D95 without changing the locked
  shield-only specialist behavior.
- [x] Update `docs/game-design.md` to describe 18 ordinary Fleet V2 hulls and the research tiers.
- [x] Update `docs/balance.md` with the coefficient, tier-efficiency and acceptance model.
- [x] Update `CLAUDE.md` critical invariants only where the old Wasp opening/catalog statement is
  no longer true. Preserve unrelated current edits.
- [x] Record the initial caller inventory and asset audit in the phase log.

#### Working behavior at risk

- Documentation may claim the wrong project count or the retired seven-space-hull catalog after
  code changes; Fleet V2 keeps fifteen projects because Emplacement Doctrine remains.
- D94/D95 may conflict with replacement cargo/shield-breaker names if not explicitly superseded.
- `START = two Wasps` is a critical invariant and must change together with onboarding arithmetic,
  not as a documentation-only rename.

#### Completion gate

- Authority documents and this plan describe one catalog and one release boundary.
- No production code changed in this phase.

### Phase 1 — Rules tests first `[x]`

#### Entry gate

- Phase 0 complete.
- Current rules test commands and fixtures identified.

#### Red tests to add before implementation

- [x] `HullId` contains all 18 new hulls plus preserved ground/mining hulls and no retired ordinary
  hull IDs.
- [x] Catalog partitions (`MOBILE_HULLS`, combat, support, ground, non-combatant) are exhaustive and
  disjoint where required.
- [x] Tier/family/profile metadata exists for every new hull.
- [x] The rules catalog declares exactly the eighteen Fleet V2 IDs; filesystem asset existence is
  tested in Phase 4 rather than making the pure rules package depend on web files.
- [x] Tier 1 is opening-craftable; Tier 3/4 correctly describe research requirements.
- [x] Fleet speed remains the slowest mobile hull.
- [x] Raid cargo, dedicated transfer cargo and support protection retain their distinct semantics.
- [x] Price-derived bulk remains positive and capacity arithmetic tolerates legal overflow.
- [x] Ground counter classes and Prospector exclusions remain unchanged.
- [x] Counter-cycle multiplier remains 1.6/0.625 and combat stays three rounds ±8%.
- [x] Nullifier bonus is shield-only, capped by remaining Aegis and never spills.
- [x] `START`/`PLANET_START` fund exactly two Darts after the three guided upgrades.

#### Red-test evidence rule

Tests must be executed against the old implementation and fail because the new contract is absent,
not because of syntax, fixture or environment errors. The exact command and failure summary are
recorded in the phase log.

#### Completion gate

- Intended new tests fail for documented reasons.
- No implementation code has been added.

### Phase 2 — Complete rules vertical slice `[x]`

Removing a string from `HullId` invalidates every rules caller in the same compile unit. Catalog,
combat, research, movement, opening, rewards and rules-owned templates therefore move together;
splitting them into temporarily uncompilable phases would make the phase gates fictional.

#### Test-first work

- [x] Begin from Phase 1's observed red catalog tests.
- [x] Add failing Engineering/Power/Armor/Propulsion and preserved Emplacement tests.
- [x] Add failing research-effect boundary tests for ground, Prospector and ordinary Fleet V2 hulls.
- [x] Add failing combined-product and propulsion-ceiling tests.
- [x] Add failing equal-budget counter and support casualty-order tests. Support-only attack
  rejection belongs to Phase 5's authoritative server mission validator; the rules package only
  preserves combat/support classification and casualty behavior.
- [x] Add failing Nullifier shield/no-spill trace tests.
- [x] Add failing START/two-Dart, rewards, neutral-template and rules-owned fixture tests.
- [x] Inventory every existing rules test that names a retired hull/project and classify the
  semantic replacement before implementation. The actual typed-literal migration happens with the
  `HullId` union flip in this same atomic rules slice; the focused red contracts above are the
  pre-implementation evidence, avoiding a deliberately uncompilable intermediate test tree.

#### Implementation

- [x] Replace ordinary `HullId` members and add tier/family/profile/requirements metadata.
- [x] Derive mobile/combat/support/cargo partitions from the authoritative catalog.
- [x] Recalculate speed, incidental/transport cargo, price value, build time and price-derived bulk
  through canonical formulas.
- [x] Replace Wasp-based normalization with an explicit stable Fleet V2 bulk baseline.
- [x] Replace four obsolete space/general doctrines with Engineering, Power, Armor and Propulsion;
  preserve Emplacement Doctrine and every strategic/economy/Frontier project.
- [x] Generalize hull requirements; do not add per-ID gate branches.
- [x] Apply research only to the explicit effect boundaries in this document.
- [x] Preserve counter multipliers, rounds, variance, simultaneous fire, D8 protection and D95
  shield-only no-spill behavior. Rename the generic round-trace field from the retired
  `breacherShieldDamage` to `shieldBreakerDamage`; do not leave hull identity embedded in the
  combat contract.
- [x] Update rules-owned START, rewards, neutral templates, constants and fixtures to two Darts and
  new IDs.

#### Working behavior at risk and response

- **Hangar capacity:** D133 bulk is price-derived. Do not hand-tune bulk to make a hull fit; adjust
  price/stats and prove the relationship.
- **Fuel:** bulk changes ordinary mission quotes. Later server/web contracts must consume the same
  result; rules tests freeze the canonical arithmetic now.
- **Opening:** START, two-Dart staging and `PLANET_START` arithmetic change as one tested unit.
  Server/web onboarding callers move in their owning phases.
- **Ground research:** removing Emplacement Doctrine is forbidden; Power/Armor/Propulsion must not
  become an accidental ground buff.
- **Iterators:** `ALL_HULLS` drives debris, score, reports and transfers. Exhaustiveness tests catch
  omitted or accidentally included preserved hulls.

#### Completion gate

- `@astera/rules` typecheck and entire rules test suite pass.
- No rules source/test/template contains an unexplained retired ordinary ID.
- Downstream packages may still be red only because their caller migrations are explicitly assigned
  to Phases 3–7; those expected failures are inventoried rather than treated as success.

### Phase 3 — Simulator migration and numeric calibration `[x]`

The simulator must compile against Fleet V2 before it can be used as balance evidence. Actor and
archetype migration is therefore the first part of this phase, not a Phase 8 cleanup.

#### Test-first migration

- [x] Add/update composition tests for Raider, Strike, Fortress, Escort and Cargo preferences.
- [x] Replace old-ID simulator fixtures and assert no retired hull can be bought, launched or seeded.
- [x] Teach actors the new research prerequisites and make sure they never price an effect the
  simulator does not model.
- [x] Run focused simulator tests red, migrate actors/archetypes/season logic, then return the full
  simulator suite to its known baseline before tuning.

#### Calibration scenarios

- [x] Every combat hull versus every combat hull at equal resource value.
- [x] Same matrix at equal hangar bulk.
- [x] Pure versus mixed counter-aware fleets.
- [x] Fast raid, heavy siege, escorted cargo and unescorted cargo.
- [x] Aegis absent/present/depleted with Nullifier.
- [x] Bastion/Thorn mixtures against T1–T4 fleets.
- [x] Full research versus no research and correct counter versus wrong counter.
- [x] Travel time, Radar exposure, fuel, loot return and replacement build time.
- [x] Opening, day-2, day-4 and late-season affordability.
- [x] Earliest realistic T3/T4 unlock, commander-queue opportunity cost and remaining useful season
  time across the fixed seed set.

#### Acceptance

- [x] No hull wins every equal-budget role/matchup.
- [x] Every combat hull has a rational strong and weak matchup.
- [x] T4 efficiency is measurable but does not invalidate a correctly scouted counter.
- [x] Tempest remains a meaningful speed ceiling; Cataclysm is not a universal replacement.
- [x] Courier remains useful for fast low-volume missions; Atlas is not the universal cargo answer.
- [x] Nullifier is intentionally poor against shieldless targets.
- [x] Existing ground defence inflicts meaningful equal-value losses. If it becomes trivial, adjust
  Fleet V2 price/stats/bulk; do not silently buff Bastion/Thorn.
- [x] T3/T4 research neither dominates the opening nor arrives too late to create play.
- [x] Existing known season-simulator baseline failures are not hidden by wider bands.

#### Evidence and completion gate

- Record accepted stat/cost table, class changes, seed set, matrix, research pacing and rejected
  iterations in `docs/balance.md` and the phase log.
- Simulator typecheck and focused suites pass; full season results match the explicitly recorded
  baseline except for evidence-backed Fleet V2 movements.

### Phase 4 — Canonical 2D/3D asset pipeline `[x]`

The supplied `apps/web/public/assets/new_test_ship_modals` folder is immutable staging input. The
misspelled folder and `offensive_shiled_breaker.png` source name are not propagated into runtime
URLs. Optimized output receives canonical names under the normal images/models hierarchy before
the web package is migrated, so Phase 6 never depends on missing assets.

#### Asset audit baseline

- 18 GLBs, approximately 24 MB compressed in aggregate.
- 18 PNG renders, approximately 31 MB in aggregate.
- Most GLBs contain three 2048×2048 textures and can decode to roughly 67 MB GPU memory each.
- Loading all models together could exceed roughly 1.2 GB decoded GPU memory.
- Shield-breaker PNG is 450×280 while most renders are 1254×1254.

#### Test-first and ordered work

- [x] Add filesystem/manifest tests proving one canonical render and model per Fleet V2 hull.
- [x] Generate canonical optimized 2D renders without overwriting staging masters.
- [x] Optimize texture dimensions/format and mesh transport based on measured phone output.
- [x] Measure and declare `MODEL_FACING` for all 18 models; never infer it from bounds.
- [x] Add model scale, light and trail metadata consumable by the later web phase.
- [x] Consume each authored model scale in live hull, exhaust, wake, pip and hit-area geometry.
- [x] Add/create or deliberately reuse visible art for Engineering, Power, Armor, Propulsion and
  preserved Emplacement Doctrine; no research row may fall back silently.
- [x] Add all 18 card renders and small hull icon/silhouette mappings.
- [x] Define the opening-only preload manifest around Dart and essential shared scene assets; do not
  preload all 18 models.

#### Quantitative acceptance

- [x] Opening/galaxy initial preload transfers no more bytes than the measured pre-Fleet-V2 preload;
  if Dart is larger, optimize it rather than expanding the gate without evidence.
- [x] No code path requests all 18 GLBs as an eager batch.
- [x] Capture a reproducible pre-V2 390×844 mobile-emulation scene artifact before replacement:
  render/scene counts, texture/geometries and peak JS heap are recorded. SwiftShader p95 is retained
  as diagnostic telemetry, not mislabeled as a real-phone result; the real-device p95 comparison is
  an explicit Phase 9 gate.
- [x] The six-side development viewer shows every hull nose axis and complete materials; tests pin
  all 18 measured facings plus Meshopt/three-map WebP transport.

#### Completion gate

- Every catalog hull has one canonical reachable render/model/icon entry.
- Research artwork is exhaustive for the new project union.
- No backwards/sideways craft or missing-material half-rotation.
- Asset tests pass and recorded transfer/decoded-texture measurements meet the gates above. Runtime
  formation and real-device frame/scene comparisons occur after Phase 6 can draw Fleet V2, in Phase 9.

### Phase 5 — Complete server vertical slice `[x]`

#### Test-first work

- [x] API accepts every new hull and rejects every retired ordinary hull.
- [x] Server rejects T3/T4 production without authoritative research even if the client lies.
- [x] Clan aid/gift revalidates the recipient's hull prerequisites.
- [x] Launch stores the correct tech snapshot and authoritative arrival time.
- [x] Probe/report/intel payloads parse every new manifest.
- [x] Build completion, cancellation, capture, reroute and legal overflow preserve units.
- [x] Fresh-season seed contains no retired hull ID.
- [x] Server onboarding stages exactly two Darts and `untouched()` still compares `PLANET_START`.
- [x] Support-only attacks are rejected while support-only transfer/clan-aid paths remain legal.

#### Implementation surface

- Build service and route Zod schemas.
- Research discovery/projection and queue prerequisites.
- Movement/mission/combat/report/intel services.
- Clan aid and transfer validation.
- Neutral/reinforcement seeds and worker event payloads.
- Server onboarding, preview, rewards projections, settlement and admin CLI hull callers.
- Drizzle types/fixtures where text/JSON hull IDs cross an untrusted boundary.

#### Persistence hazard

`units.hull`, mission fleets, mission tech snapshots and battle report manifests store hull IDs as
text/JSON. Compiler success cannot migrate those values. The chosen solution is a season-boundary
catalog cutover with no old active units/missions/reports. Startup/route parsers must still fail
closed on malformed unknown IDs rather than treating them as an empty fleet.

#### Completion gate

- Server typecheck plus unit/integration/contract tests green.
- A caller audit confirms every server-side hull reader uses the authoritative catalog/schema.

### Phase 6 — Complete web vertical slice `[x]`

#### Test-first work

- [x] Client schemas parse all new IDs and reject retired IDs.
- [x] Shipyard groups hulls by family/tier and exposes locked rows with a route to Research.
- [x] Build/detail rows show attack, hull, speed, cargo, price, bulk and tactical trade-off.
- [x] Launch/transfer/clan/report/dossier surfaces render every manifest.
- [x] Turkish and English key parity covers every hull name, role and description.
- [x] Locked and available states remain visually distinct in portrait layout.
- [x] Rehearsal/onboarding builds and launches exactly two Darts without changing the scarcity beat.
- [x] Landing, preview, preloads and galaxy formations use only canonical Phase 4 assets.
- [x] Identified formations preserve exact manifests/count pips while bounding simultaneously
  mounted model instances through the existing formation abstraction, not by hiding ships.
- [x] Research rows have explicit artwork and visible effect/gate descriptions for all fifteen
  projects.

#### Implementation constraints

- No duplicated research gate logic: prediction consumes rules metadata.
- Long lists use progressive disclosure/content visibility where appropriate.
- Heavy 3D modules/assets load only when the relevant surface needs them.
- Phase 4's canonical asset manifest exists before exhaustive `Record<HullId, ...>` web mappings are
  compiled; Web typecheck is never declared green against placeholder/missing paths.
- Derived arrays/sets used in render loops are hoisted or memoized where measurement warrants it.
- User-facing strings stay in locale modules; Turkish casing is not inferred naïvely.
- Every server route parsed by the client keeps a contract test.

#### Completion gate

- Web tests/typecheck green.
- Portrait screenshots and direct interaction confirm no clipped action or unreachable locked hull.

### Phase 7 — Tools, harnesses and repository-wide caller audit `[x]`

Rules, simulator, server and web are green before this phase. What remains is code outside their
normal package gates: calibration scripts, Playwright helpers, capacity/load harnesses, visual
fixtures and historical executable models. Leaving those on retired IDs would make the next
diagnostic or rehearsal fail after the feature appeared complete.

#### Test-first caller replacements

- [x] Inventory every retired ID in `tools/`, root scripts, checked-in executable fixtures and
  non-package harnesses; classify it before editing.
- [x] Update onboarding, movement, engagement, capacity, loop and economy calibration tools to
  Fleet V2 inputs.
- [x] Preserve deliberately historical Economy-v2 artifacts with an explicit historical label
  rather than mutating the baseline they exist to record.
- [x] Run each affected harness's smallest safe dry/test path after its input migration.
- [x] Run workspace typecheck after the final non-package TypeScript caller is migrated.

#### Completion gate

- Repository search for Wasp/Lance/Bulwark/Hauler/Runner/Breacher is reviewed line by line.
- Every remaining occurrence is historical documentation, an explicit rejection/legacy-boundary
  test or a labeled frozen comparison artifact.
- Workspace typecheck passes; simulator/server/web package gates remain green.

### Phase 8 — Atomic season cutover rehearsal `[x]`

The current rollover wipes the ending seasons and creates their successors in one transaction. A
single global runtime catalog cannot safely serve old IDs before that transaction and new IDs after
it while traffic remains open. Cutover is therefore an offline operational boundary, not merely a
version-number edit.

#### Test-first activation work

- [x] Bump and assert `rulesetVersion`/catalog version for successors.
- [x] Prove rollover removes active units, missions, commander research and current-season battle
  reports before the successor is seeded.
- [x] Prove successor opening, neutral and research state contains only Fleet V2 IDs.
- [x] Prove malformed/unknown persisted hull IDs fail closed at API boundaries.
- [x] Rehearse the exact runbook against a disposable copy of a realistic ending database.

#### Offline cutover runbook

1. Finish/freeze the old season under the old running catalog and confirm final snapshots/events.
2. Stop public API traffic and every worker that can mutate seasonal state.
3. Take and verify a recoverable database backup; record old code/image and ruleset versions.
4. Start the new code in maintenance/offline mode and run the atomic rollover transaction. The new
   code may delete old IDs inside the transaction but must not serve the old live season.
5. Keep traffic closed while smoke tests verify successor claim → two Darts → research → build →
   launch → combat → report → return.
6. Open workers, then API traffic, and monitor unknown-ID/schema/event failures.
7. After a new Fleet V2 season has accepted writes, rollback to old application code is forbidden;
   use forward-fix. Database restore is reserved for aborting before public traffic reopens.

#### Retirement

- [x] Remove old runtime art only after Phase 7 caller audit and offline smoke tests pass.
- [x] Preserve only labeled historical baselines needed for comparison.

#### Explicit non-solution

Do not map old hulls to new hulls in place. There is no fair one-to-one mapping for cost, class,
speed, cargo, bulk, research or in-flight arrival time. A mid-season translator would create more
state meanings than it resolves.

#### Completion gate

- The rehearsal can progress from account claim through research, build, launch, combat, report and
  return using only Fleet V2 hulls.
- Backup restore is tested before traffic, and the post-open forward-fix rule is in deployment docs.

### Phase 9 — Full verification and visual QA `[!]`

#### Required checks

- [x] Focused package tests after each implementation step.
- [x] `pnpm typecheck`.
- [x] `pnpm lint` through the root 4 GB script.
- [x] `pnpm test` / `pnpm verify` with pre-existing failures distinguished from new regressions.
- [x] Balance matrix and fixed-goal diagnostics.
- [x] `node tools/models.mjs`.
- [x] `node tools/visual.mjs` and portrait screenshots.
- [ ] Real-phone WebGL memory/frame-time check.
- [x] Documentation and plan ledger final update for every completed gate.

#### Completion gate

- New regressions are zero; known pre-existing simulator failures are named with unchanged evidence.
- Automated contracts, visuals and runtime asset budgets all agree with the accepted catalog.

### Phase 10 — Two-player playtest and release handoff `[ ]`

#### Playtest questions

- [ ] Can a player explain why they chose Dart/Tempest speed instead of a heavier fleet?
- [ ] Can a player identify the Skirmisher/Bulwark/Lance counter before committing the launch?
- [ ] Do Courier, Wayfarer and Atlas produce different real mission choices?
- [ ] Does scouting Aegis create a visible Nullifier decision rather than an automatic inclusion?
- [ ] Are locked T3/T4 rows and their research routes understandable without external explanation?
- [ ] Does a lower-tier hull appear in a rational late-game fleet during the session?

#### Handoff

- [ ] Record observations and measured corrections in `docs/playtest-log.md`/`docs/balance.md`.
- [ ] Re-run affected focused tests and Phase 9 verification after any correction.
- [ ] Mark the living plan complete only when no required follow-up remains.

#### Release acceptance

- No untested production logic.
- No retired hull exposed by a production API or UI.
- No server/client disagreement on stats, gates, bulk, fuel, speed or arrival.
- No single universal combat or cargo hull.
- Information/counter advantage remains stronger than tier/research advantage.
- Existing protected systems remain behaviorally unchanged.

## 8. Cross-phase regression register

| Risk | How it can break | Required response |
|---|---|---|
| Hull IDs in JSON/text | Old mission/report payload no longer parses | Season-boundary cutover; strict boundary parsing |
| `START` opening package | Two Darts become unaffordable or `untouched()` misclassifies | Re-derive START and all onboarding callers as one invariant |
| Wasp bulk baseline | All hangar/fuel values drift after rename/reprice | Explicit stable normalization seam + regression tests |
| Hand-written Zod enums | Server accepts hull the web rejects, or inverse | Derive/contract-test both boundaries |
| Hard-coded Runner/Breacher gates | New research is UI-only or clan aid bypasses it | Generic `requiredResearch` authority in rules/server |
| Research snapshots | Attacker benefits from tech bought after launch | Snapshot test and probe/report parity |
| Research effect scope | Power/Armor/Propulsion changes ground, Probe or Prospector | Exhaustive effect-boundary tests; preserve Emplacement |
| Propulsion research | Active missions change arrival or UI predicts wrong time | Apply to Fleet V2 at quote/launch; stored `arriveAt` remains canonical |
| Counter mapping | New asset family accidentally becomes combat class | Explicit class metadata and all-pairs tests |
| Cargo/support semantics | Cargo dies in round one or logistics is rejected as an attack | Preserve D8 and distinguish attack from transfer/aid tests |
| Nullifier spill | Shield bonus destroys hull after shield empties | Remaining-shield cap test and trace assertion |
| Ground defence | T4 makes Bastion/Thorn meaningless | Equal-value sim; tune fleet, not protected defence |
| Debris/Dominion | New IDs omitted from value/loss iteration | Catalog exhaustiveness + report tests |
| Neutral/reward/onboarding IDs | Runtime path still creates retired hull | Repository caller audit and scenario tests |
| Formation rendering | 18 models cause GPU exhaustion | Selective preload, optimized textures, bounded scene work |
| Research/icon art | New exhaustive mappings compile with missing/fallback visuals | Canonical Phase 4 manifests before Web migration |
| Model facing | Ships fly sideways/backwards | Declare and visually verify every model |
| Cutover ordering | New code serves old IDs or old code seeds successor | Offline freeze/backup/new-code rollover/smoke runbook |
| Post-open rollback | Old code cannot parse Fleet V2 writes | Forward-fix after traffic; restore only before reopening |
| Locale parity | English works but Turkish crashes/misses copy | Machine parity test |
| Dirty worktree | Existing user changes overwritten | Targeted patches; inspect diff before each overlapping edit |

## 9. TDD and phase discipline

For every production-code change:

1. State the requirement and edge cases in the relevant phase/checklist.
2. Add or update the smallest test that proves the missing behavior.
3. Run it and record the intended failure.
4. Implement the minimum authoritative change.
5. Run the focused test to green.
6. Run the owning package suite.
7. Refactor only after green.
8. Run the package suite again.
9. Update this plan's checklist and phase log.

Tests are not modified merely to preserve old output when the owner has intentionally changed the
catalog. They are updated to express the new decision while retaining unrelated invariants.

## 10. Phase log

### 2026-09-01 — Plan creation / Phase 0 started

- Read `CLAUDE.md` and the Node.js/TypeScript and React performance skill guidance.
- Confirmed the worktree already contains unrelated in-progress research/realtime/simulator/docs
  changes. Fleet V2 patches must be narrow and preserve them.
- Confirmed the supplied staging folder contains 18 separate craft: seven offensive, seven
  defensive, three cargo and one shield breaker.
- Confirmed the current persistence layer stores hull IDs in text/JSON across units, missions and
  reports, making the owner-selected season-boundary cutover the safe path.
- Confirmed likely high-risk hard-coded callers: opening Wasps, rewards, onboarding, research gates,
  client Zod enums, art/model mappings, preload lists, neutral templates and simulator actors.
- Created this execution ledger. Phase 0 remains open until D148 and the authoritative design and
  balance documents are aligned.

### 2026-09-01 — Phase 0 complete / Phase 1 started

- Added D148 and explicitly superseded the named Runner/Hauler and Breacher catalog decisions while
  preserving D8 support protection and D95 shield-only/no-spill behavior.
- Kept Dense Fuel Cells meaningful as the discovery gate for Ship Propulsion; Gravitic Charges now
  names Nullifier as its ordinary-hull permission.
- Updated the authoritative game-design and balance contracts, including the 18-hull role map,
  tier-efficiency targets and the fresh-season-only activation rule.
- Updated the critical opening invariant to distinguish the active pre-V2 Wasps from the D148 Dart
  cutover without claiming that production code has already changed.
- `git diff --check` passes. No production code changed in Phase 0.
- Phase 1 begins with focused rules-package contract tests against the still-old implementation.

### 2026-09-01 — Plan review corrections / two-Dart opening confirmed

- Owner confirmed the guided opening remains one simple profile and builds exactly two Darts.
- Corrected the research model: Emplacement Doctrine remains for Bastion/Thorn, so Fleet V2 keeps
  fifteen total projects rather than fourteen. Power/Armor/Propulsion explicitly exclude preserved
  ground/mining/intel/strategic assets.
- Reordered phases into compilable vertical slices. Rules-owned opening/reward/templates now move
  with the rules union; simulator actors move before calibration; canonical assets precede Web;
  onboarding callers move with their server/web packages; external tools receive a final audit.
- Clarified raid cargo versus dedicated transfer cargo and limited the support-only prohibition to
  attacks.
- Added exact provisional Shipyard gates, research pacing acceptance, asset/research-icon gates and
  measurable preload/device requirements.
- Replaced the vague season boundary with an offline freeze → backup → new-code atomic rollover →
  smoke → reopen runbook, including the post-open forward-fix rule.
- Phase 1 remained in progress at the end of review correction; no production implementation was
  written during that correction.

### 2026-09-01 — Phase 1 complete / Phase 2 started

- Added `packages/rules/test/fleet-v2-contract.test.ts` as the first executable D148 contract. It
  covers the exact 18-hull catalog, preserved entries, partitions, metadata and Shipyard gates;
  tier research requirements; speed/cargo/bulk semantics; support protection; the counter and
  combat constants; Nullifier shield-only/no-spill behavior; the exact two-Dart opening; and the
  fifteen-project research identity with Emplacement Doctrine preserved.
- `pnpm --filter @astera/rules typecheck` passes with the new test present. The test therefore does
  not manufacture a red state through invalid TypeScript or unavailable future literals.
- `pnpm --filter @astera/rules test -- fleet-v2-contract.test.ts` ran against the old production
  rules: 9 tests total, 7 failed for missing Fleet V2 behavior and 2 passed for intentionally
  preserved ground/mining stats plus combat constants. The failures identify the old catalog,
  absent metadata/derived fixtures, absent Nullifier/Dart and obsolete research union.
- No production code changed in Phase 1. Phase 2 starts by adding the narrower research-effect and
  boundary tests before replacing the complete rules-owned vertical slice.

### 2026-09-01 — Phase 2 focused red contracts

- Added the exact research-tree parent gates that the review had left implicit: Engineering is a
  root, Power/Armor require Engineering and Propulsion requires Dense Fuel Cells. Locked Power and
  Armor to separate `sqrt(1.25)` stat ceilings, Propulsion to 2% per rung / 10% maximum, and the
  preserved Emplacement project to its existing direct factor without inheriting retired General.
- Added `fleet-v2-research-contract.test.ts` for neutral effects, exact effect boundaries, combined
  product ceiling, propulsion ceiling, project ceilings/prerequisites and combat-research
  visibility. Rules typecheck passes; all 6 tests fail against the old implementation for the
  intended missing-project/API reasons.
- Expanded the catalog contract with exact per-hull research requirements, equal-budget T1 counter
  exchanges, escort-before-support casualty order, Fleet V2 neutral manifests and the generic ship
  reward's relationship to the two staged Darts. Rules typecheck still passes; the focused catalog
  run now has 13 tests, with 10 intended Fleet V2 failures and 3 preserved-contract passes.
- Corrected phase ownership: support-only attack rejection is a server mission-validation rule and
  stays in Phase 5; the rules phase owns classification and casualty order rather than inventing a
  second launch validator.
- Corrected the catalog sketch to extend the existing canonical `cls`/`atk`/resource-column shape
  instead of introducing duplicate `hullClass`/`attack`/`cost` vocabulary. Also made settlement's
  two-Courier requirement a typed rules contract rather than carrying the retired `haulers` name.

### 2026-09-01 — Phase 2 complete / Phase 3 started

- Replaced the six retired ordinary hull IDs with all eighteen Fleet V2 IDs and added exhaustive
  tier/family/profile/research metadata. Preserved Bastion, Thorn and Prospector retain their exact
  numeric stats and are explicitly outside Fleet V2 progression with `tier: null`.
- Added provisional authored attack/HP/speed/cargo/resource values. Average equal-cost combat
  efficiency rises by roughly 5–7% per tier; Dart pays an explicit efficiency cost for entry speed,
  Nullifier pays for its shield specialization, and the T4 pair remains below the counter advantage.
- Derived all/mobile/combat/support partitions from the canonical catalog, changed the stable bulk
  unit to Dart and adjusted Warden's provisional base Alloy from 420 to 412 so price-derived integer
  bulk stays inside the existing 15% rounding invariant without widening that invariant.
- Replaced the four retired space/general research projects with Engineering, Power, Armor and
  Propulsion; retained Emplacement Doctrine unchanged in scope. Power × Armor caps at 1.25,
  Propulsion caps at 1.10, and quote-time fleet travel now accepts the authoritative research map.
- Renamed the retired hull-specific combat trace to `shieldBreakerDamage`; Nullifier preserves the
  fivefold live-shield specialization and remaining-shield cap with zero hull spill.
- Changed dedicated transfer/clan resource capacity to Courier/Wayfarer/Atlas and expressed
  settlement as two typed Couriers. Neutral templates, opening arithmetic, reward fixtures and all
  rules tests now use Fleet V2 IDs.
- `pnpm --filter @astera/rules typecheck` passes. `pnpm --filter @astera/rules test` passes all 23
  files and all 536 tests. `git diff --check` passes. Remaining retired-name prose in rules is
  historical pre-V2 rationale; the executable rejection list lives only in the D148 contract.
- Phase 3 starts with external reference research and simulator red tests before actor migration or
  numeric tuning.

### 2026-09-01 — Phase 3 complete / Phase 4 started

- Added a shared `hullRequirementsMet`/`hullBuildable` production gate after the Phase 3 review
  found that catalog requirements existed but consumers still had to reinterpret them. The focused
  rules contract failed first, then passed with both Shipyard and research checks in one function.
- Added the five-test simulator migration contract. Its first run failed all five intended checks:
  transports leaked into combat, archetypes named retired hulls, adaptive selection ignored
  research, no advanced target existed and the season crashed while pricing a retired hull.
- Migrated every simulator fixture and runtime path to Fleet V2. Combat pools now consume the
  rules-owned partition; archetypes declare Raider/Striker/Fortress/Escort habits, cargo preferences
  and levelled research targets; settlement buys and flies exactly two Couriers.
- Replaced boolean research projection with levelled `TechLevels`, made build placement consume the
  shared production gate and threaded propulsion research through player travel/return quotes.
- Fixed two simulator structural failures exposed by the larger catalog: informed bots reserve the
  Deuterium price of their next reachable research instead of burning it forever, and adaptive
  selection falls back to a hull the player can actually afford instead of hoarding resources while
  its preferred advanced hull is blocked.
- Added `fleet-v2-balance.test.ts`: 225 equal-resource and 225 equal-bulk matchups, mixed fleets,
  counter-vs-research, T4 counterability, speed/Radar exposure, fuel/build time, cargo/escort,
  Nullifier, preserved ground and day-2/day-4/day-7/day-12 research pacing.
- Accepted pacing: T3 appears around day 7 and is broadly available by day 10; T4 is absent at day 7
  and becomes available to only part of the informed cohort around day 12. Tempest remains the
  combat speed ceiling; Courier wins speed while Atlas wins capacity efficiency.
- Recorded the complete accepted price/stat/bulk table, fixed seed set, rejected iterations and
  explicit VFR/TAX rederivation in `docs/balance.md`. The direct all-protected Vault regression still
  proves the lower VFR alarm can fail; the changed bands are evidence-backed Fleet V2 movements.
- `pnpm --filter @astera/sim typecheck` passes. `pnpm --filter @astera/sim test` passes all 7 files
  and all 87 tests; pooled RR is 0.6579 and the informed archetype tops all five fixed seeds.
  `git diff --check` passes.
- Phase 4 starts with immutable staging-asset inventory and red manifest/filesystem contracts; no
  staging master will be renamed or overwritten.

### 2026-09-01 — Phase 4 complete / Phase 5 started

- Added `fleet-v2-assets.test.ts` first. Its initial run failed on the absent exhaustive manifest;
  the later preload contract likewise failed before the Dart-only opening manifest existed.
- Added `tools/fleet-v2-assets.mjs`, the single owner-filename-to-rule-ID translation table. It keeps
  `new_test_ship_modals` immutable, copies GLB masters into the established source pipeline and
  derives canonical 512×512 card plus 160×160 icon WebPs. The staging checksum aggregate remained
  `f92b4259da774e100a908fc0a454a3875c70bd8d669e3cb2267d438092f223cd` after generation.
- Optimized only the new models with Meshopt and three 256×256 WebP maps. Served GLBs are 72–141 KB
  (below the 200 KB gate), cards 26–74 KB (below 160 KB) and icons 4–11 KB (below 40 KB). Each hull
  now decodes roughly 1.05 MB of texture data instead of approximately 48–67 MB from the raw drop.
- Six-side orthographic renders disproved the provisional “all `-X`” assumption. The measured fleet
  spans `+X`, `-X`, `+Z` and `-Z`; the exact 18-entry table is pinned in tests so sideways/backwards
  flight cannot return through a filename or bounds guess.
- Added exhaustive card/icon/model/facing/scale/light/trail metadata and wired the canonical art and
  model maps while retaining Probe, Death Star, Prospector/Drill, Bastion, Thorn and Aegis assets.
- Deliberately reassigned the four now-retired doctrine commissions to Engineering, Power, Armor and
  Propulsion under canonical filenames. All current research rows remain unique and Emplacement
  Doctrine remains unchanged; no row silently falls back.
- The pre-V2 galaxy preload measured 1,786,315 bytes. The declared Dart-only Fleet V2 candidate is
  1,574,179 bytes across 28 assets, saving 212,136 bytes (11.9%) and eagerly loading no other Fleet
  V2 GLB.
- Captured the untouched pre-V2 mobile-emulation scene under
  `out/fleet-v2-pre-v2-baseline-final`: 46 calls, 3,804 triangles, 40 geometries, 36 textures, 58
  objects, 20 instanced meshes/387 instances and 73.1 MiB peak JS heap. SwiftShader produced only 31
  continuous samples (`p50 16.8 ms`, `p95 1719.6 ms`) with multi-second software-renderer stalls;
  this p95 is explicitly diagnostic and will not be represented as reference-phone acceptance.
  Phase 9 must compare Fleet V2 on a real device before release.
- Focused asset/model/art/preload verification passes 74/74 tests; focused lint and
  `git diff --check` pass. Web typecheck remains red only across the intentionally unmigrated Fleet
  V1 server/web callers assigned to Phases 5–6, so it is not claimed as a Phase 4 gate.
- Phase 5 begins with server red contracts for exhaustive hull parsing, authoritative research/build
  validation, exact two-Dart onboarding and exact two-Courier settlement paths.

### 2026-09-01 — Phase 5 complete / Phase 6 started

- Added rules-derived server boundary schemas for every persisted hull and every mobile manifest.
  The focused contract accepts all eighteen Fleet V2 craft plus preserved server-owned hulls and
  rejects Wasp, Lance, Bulwark, Hauler, Runner and Breacher at the boundary.
- Centralized Shipyard plus research validation in `hullProductionAccessible` /
  `assertHullProductionAccess`. Ordinary builds and recipient-side clan ship gifts now ask the same
  question; integration coverage proves Atlas and Nullifier remain closed without their exact
  rungs and a Cataclysm needs both Shipyard L6 and its complete research set.
- Migrated onboarding, movement, settlement, rewards, neutral reinforcement, intel, reports,
  strategic destruction and capacity seeding to Fleet V2. Onboarding stages exactly two Darts and
  settlement launches exactly two Couriers from the shared rules contract.
- Moved role rejection ahead of persistence: ground craft retain the specific `GROUND_UNIT` error,
  Prospector and transport-only attacks fail without opening a transaction, while Courier transfer
  and clan-aid paths remain legal.
- A new propulsion ETA test failed first by `0.1022727` minutes: missions stored the research
  snapshot but ignored it when scheduling. Launch now reads research once, uses that snapshot for
  the authoritative arrival and carries it through attack returns, neutral returns, transfers,
  reroutes, settlements and clan-aid round trips. Research completed in flight therefore affects
  only the next launch.
- Repaired catalog-sensitive fixtures without weakening their behavior: HEAVY silhouettes now use
  a fleet whose current price actually crosses the shared threshold; canonical neutral/survivor
  ordering follows the exhaustive catalog; the public-wreck battle is Dominion-positive across
  the complete combat variance band; and asteroid traffic selects a reachable active target rather
  than assuming the first active rock is interceptable.
- Server executable caller audit finds no retired hull or retired research ID. The sole old combat
  field name remains an intentional read-only compatibility boundary for pre-cutover report JSON;
  it is never emitted. Fresh neutral/CLI manifests derive from current rule IDs.
- `pnpm --filter @astera/server typecheck` passes. The affected five-suite pass is 123/123 and the
  final full server run passes 47/47 files and 1,049/1,049 tests. `git diff --check` passes.
- Phase 6 starts from the already-generated canonical art/model manifest and the temporarily
  expanded client schemas; UI logic, localized copy and exhaustive web tests still require the
  full Fleet V2 migration before Web may be called green.

### 2026-09-01 — Phase 6 complete / Phase 7 started

- Added an explicit client-boundary contract: every current rules hull parses and all six retired
  IDs are rejected. The Zod enum retains a compile-time exact-union proof against rules.
- Rebuilt the Shipyard from `FLEET_V2_HULLS`, grouped into Offensive, Defensive, Cargo and
  Specialist bands with tier-ordered rows. Research and Shipyard refusals now derive from each
  hull's catalog metadata; row and build sheet share the same gate and route missing research to
  the commander-wide Research surface.
- Replaced the remaining bespoke Wayfarer/Nullifier prediction branches with the rules-owned
  production check. Tempest and Nullifier interaction tests prove T3 research doors remain
  actionable, while Wayfarer correctly remains a normal T2 cargo hull.
- Completed English and Turkish names, tags, roles and detail copy for all eighteen ships. The
  research surface now explains Engineering as the T3/T4 permission ladder and Power, Armor and
  Propulsion as attack, hull and speed upgrades; vocabulary and locale parity are exhaustive.
- Migrated launch, transfer, clan aid, settlement, fog/intel, notifications and battle reports.
  Courier, Wayfarer and Atlas are all valid cargo carriers; settlement still requires exactly two
  Couriers. The client now consumes the canonical `shieldBreakerDamage` report field.
- Preserved the visible Skirmisher → Bulwark → Lance counter cycle and the unchanged Bastion,
  Thorn, Aegis, Probe, Death Star and Prospector/Drill paths. Onboarding/rehearsal still spends the
  exact opening grant on three upgrades and two Darts.
- Activated the bounded Dart opening preload and changed landing traffic to canonical
  Dart/Pike/Rampart/Courier models. Retired fleet models are no longer registered as runtime
  craft; the old geometry files remain referenced only under the preserved Bastion/Thorn identities.
- `pnpm --filter @astera/web typecheck` passes. The full web run passes 121/121 files and
  1,729/1,729 tests. `out/fleet-v2-phase6-final` records the 390×844 real-client visual run: galaxy
  focus, own-world management and affordability interactions pass with no runtime errors. Locked
  row interaction tests directly exercise Shipyard, Core and Research routes in portrait DOM.
- Phase 7 begins with a deliberately failing external onboarding-harness run: the harness reaches
  the live rehearsal and proves it performs no writes, but its stale reserved-world tap misses the
  current scene and stops before the two-Dart beat. This is a harness caller failure, not a relaxed
  Phase 6 product assertion; Phase 7 must repair and rerun it alongside the other retired-ID tools.

### 2026-09-01 — Phase 7 complete / Phase 8 started

- Migrated engagement, loop-check, capacity, movement, onboarding and economy-calibration tools to
  current Fleet V2 manifests. The onboarding harness's stale screen-to-world projection was fixed
  against the current galaxy coordinate contract rather than compensated with a wider click target.
- Re-ran the real current-workspace onboarding flow against `http://localhost:5174`: rehearsal made
  no writes, one seat was claimed, the three opening upgrades and exactly two Darts were committed,
  and the reserved world became the real commander world. Output is under
  `out/fleet-v2-phase7-onboarding-current`.
- Expanded `tools/economy-calibration.ts` to all twenty-one current catalog entries and all fifteen
  research projects. Its strict standalone TypeScript check and `pnpm balance:economy` pass.
- Labeled `tools/economy-v2-model.mjs` and `docs/economy-v2.json` as frozen pre-Fleet-V2 evidence.
  `tools/models.mjs` labels Runner/Breacher filenames as retained source masters pending Phase 8
  art retirement; no runtime or preload manifest registers them as craft.
- Replaced compact mobile hull marks with each craft's canonical Fleet V2 icon. The red asset
  contract failed while the six old silhouette families were still reused and now passes for all
  eighteen distinct IDs.
- Reviewed repository matches line by line. Exact retired IDs outside tests remain only in labeled
  historical models/docs or compatibility narratives; `LANCE` and `BULWARK` still appear as the
  intentionally preserved counter-class vocabulary, not retired buildable hull IDs.
- `pnpm typecheck`, full `pnpm lint` and `git diff --check` pass. The root test run passes Rules
  537/537, Simulator 87/87, Server 1,049/1,049 and Web 1,730/1,730.
- The current-client visual run completed without runtime errors under
  `out/fleet-v2-phase6-final-current`; focus, own-world management, affordability and live Works
  updates passed. One camera-lock sample exceeded its visual tolerance while the subsequent focus
  and Home assertions passed, so Phase 9 retains a repeat-run/device check rather than treating the
  sample as a Fleet V2 functional regression.
- `pnpm balance:goal` remains red at 4d 00h 50m for the accepted 6–7 day D128 target. This is the
  pre-recorded D134 lane-separation consequence in `docs/balance.md`, not a Fleet V2 regression;
  the gate and economy constants were deliberately not weakened to hide it.
- Phase 8 started test-first. The new rollover contract was red because successor seasons had no
  Fleet V2 activation version; `MULTI_WORLD.rulesetVersion` and the explicit
  `fleetCatalogRulesetVersion` now define the offline v4 boundary. Focused rollover tests prove old
  units, missions, commander research and reports are deleted before v4 neutral fleets are seeded.

### 2026-09-01 — Phase 8 complete / Phase 9 started

- Raised the immutable current season boundary from ruleset v3 to v4 while retaining v2 as the
  neutral-world boundary and v3 as the clan boundary. Successors created by bootstrap or atomic
  rollover now carry `fleetCatalogRulesetVersion = 4`; old seasons keep their stored version.
- Strengthened the lifecycle fixture with real unit, resolved mission, commander research and
  battle-report rows. Its first run failed on the missing Fleet V2 successor version; after the v4
  change it proves those rows disappear before both successor neutral fleets are seeded from the
  current catalog.
- Added `fleet-v2-cutover.test.ts`. In one executable path it wipes the old season, preserves the
  accounts, joins two commanders to a v4 successor, completes an exact two-Dart Yard order,
  completes Engineering in the real commander research lane, builds the rest of the force, launches
  a raid, resolves the engagement/report and docks the return. No retired hull is present afterward.
- Rehearsed backup/restore and the real season CLI on isolated local PostgreSQL databases. The
  first restored-copy audit opened exactly two v4 successors; each held 51 neutral worlds and 60
  neutral unit rows, invalid hull count was zero and lifecycle events were 2 end, 2 rollover, 6 act
  and 42 reinforcement rows. A stronger second rehearsal cloned a realistic ending shape with
  three live seasons, 11 players and explicit retired WASP unit, commander research, resolved
  mission and battle-report rows. Its custom-format dump restored with exact source counts, the
  current image applied all 49 migrations, and `season wipe --yes --seed 148` cleared all 11
  players plus every mission/research/report and retired/unknown hull row before opening two v4
  successors with the same 51-world/60-unit invariant. Both explicitly named disposable databases
  and their temporary dumps were removed afterward; the source test database was never mutated.
- Added the ruleset-v4 Fleet Catalog cutover section to `docs/deployment.md`: freeze, close all API
  and workers, final verified backup, restored-copy migration/wipe/audit/smoke, offline production
  wipe, staged reopen and the post-write forward-fix rule. It explicitly forbids in-place mapping,
  rolling partial activation and restoring v3 after a v4 player write.
- API boundary contracts now reject an arbitrary unknown `ALIEN_DREADNOUGHT` as well as every
  retired ID. Client response schemas also fail closed instead of rendering an unrecognized hull.
- After the restored-DB and executable smoke gates passed, removed the tracked Runner, Breacher,
  old `ship_2` and old `ship_4` source models, served GLBs and cards (12 files). They remain
  recoverable from Git history. `ship_1` and `ship_3` remain because they are the explicitly
  preserved Thorn and Bastion assets. Model inspection and 78 focused web asset tests pass.
- Phase 9 begins with full workspace verification after the ruleset version, new cutover test,
  deployment runbook and retired-art deletion.

### 2026-09-01 — Phase 9 automated and emulated gates complete; real device pending

- The root `pnpm verify` passes end to end after cutover work: workspace typecheck and the 4 GB lint
  command are clean; Rules pass 23 files / 537 tests, Simulator 7 / 87, Server 48 / 1,050 and Web
  121 / 1,730.
- `pnpm balance:economy` passes with all twenty-one current hulls and fifteen research projects.
  The 450-case Fleet V2 balance matrix remains green inside Simulator. `pnpm balance:goal` produces
  the unchanged documented D134 failure: the 50% development package measures 4d 00h 50m against
  the D128 6–7 day target. This is isolated as pre-existing pacing debt, not counted as a new Fleet
  V2 regression and not hidden by widening its gate.
- The complete `node tools/models.mjs` pipeline succeeds after retirement, processing only the
  eighteen Fleet V2 craft plus preserved Death Star, Probe, Bastion and Thorn ship-path assets. New
  served Fleet V2 GLBs remain 72–141 KB.
- `out/fleet-v2-phase9-final` is the final 390×844 current-workspace interaction run. Asteroid
  motion measured 58 px over 12 seconds; focus rail, second-tap detail, Home targeting/framing,
  owned-world management, affordability explanation and live Works refresh passed with no runtime
  errors. The isolated-rock camera test explicitly skipped because that generated frame contained
  no isolated rock; it did not report a false pass.
- `out/fleet-v2-phase9-baseline` records the bounded portrait scene under SwiftShader: 46 calls,
  3,822 triangles, 40 geometries, 36 textures, 58 objects, 20 instanced meshes / 400 instances and
  72.2 MB peak JavaScript heap, with no page errors or unexpected API calls. Only nine continuous
  samples were produced (`p50 440.4 ms`, `p95 1922.4 ms`), so the software renderer remains a
  structural/memory diagnostic rather than a phone frame-time acceptance result.
- `adb devices -l` reports no attached device. The real-phone WebGL memory/frame-time gate is the
  sole remaining Phase 9 item and cannot be truthfully replaced by desktop mobile emulation.
- The production build succeeds (1,334 Web modules transformed). Vite still warns that the main
  JavaScript chunk is 2,465.8 KB / 717.4 KB gzip; Fleet V2 models are external selective assets,
  not embedded in that chunk, but the warning reinforces why the real-phone load/heat/frame check
  remains a release gate rather than being waived from desktop evidence.

### 2026-09-01 — Restored-database evidence strengthened; external gate confirmed

- Repeated the Phase 8 restore rehearsal with a deliberately realistic ending fixture: three live
  seasons, 11 players, one retired WASP unit, one retired research row, one resolved old-hull
  mission and its battle report. Source and restored row counts matched exactly before mutation.
- The current image applied all 49 migrations to the restored copy. The production `season wipe`
  command then cleared all 11 players and every mission, commander-research, battle-report,
  retired-hull and unknown-hull row. It opened exactly two ruleset-v4 successors, each with 51
  neutral worlds and 60 valid unit rows. The source test database was not changed.
- Removed both explicitly named disposable databases and the custom-format temporary dump after
  the assertions passed. These were isolated rehearsal artifacts; no project or user data was
  deleted.
- Rechecked `adb devices -l`; it still reports no physical device. Phase 9 is therefore marked
  blocked rather than complete. The next executable gate requires a phone on the same network for
  the game plus USB debugging/remote inspection for frame and memory evidence.

### 2026-09-01 — Fleet V2 compression, centring, scale and nose-axis re-audit

- Physical review rejected the first 72–141 KB runtime pass because its 256px material plates lost
  visible authored detail. The canonical optimizer now uses 768px Fleet V2 plates, with narrow
  Pike/Praetorian/Citadel overrides at 800px/736px/752px to contain content-dependent WebP variance.
  The eighteen runtime GLBs now measure 202–288 KiB (207–296 decimal KB), inside the owner-approved
  approximately 200–300 KB envelope. Geometry
  remains completely unsimplified (3,726–7,368 triangles), so neither this pass nor transport
  compression removes silhouette geometry.
- Captured fresh orthographic six-face renders for every runtime GLB in
  `out/fleet-v2-facing-axis-audit`. Nose sign was read from the pointed body and opposing drive
  bells, not inferred from the longest bound. The confirmed source axes are: Dart/Nullifier/
  Cataclysm `-X`; Pike/Rampart/Warden/Courier/Viper/Talon/Wayfarer/Tempest/Leviathan `+X`;
  Stronghold/Sentinel/Ballista/Praetorian/Atlas `+Z`; Citadel `-Z`. No facing declaration required
  correction. `MODEL_FACING` carries these axes into `orientedCraft`, which centres the transformed
  bounds and turns every nose onto canonical `+Z` before the route group aims at its destination.
- Review found a separate structural miss: all eighteen authored visual-scale values existed in
  the manifest but live formations used one shared size. Added a failing renderer contract first,
  then wired the per-hull multiplier through hull geometry, exhaust origin/size, wake width/length,
  pip position/size and formation hit areas. Dart now renders at 0.84× presence and Citadel at
  1.38× instead of both silently becoming 1×; preserved Prospector/ground entries remain 1×.
- Focused model/asset/formation/flight tests pass 82/82; the complete Web package passes 121 files
  and 1,733 tests, and Web typecheck is clean. A fresh portrait interaction run in
  `out/fleet-v2-facing-scale-current` passes focus, Home, management, affordability and live Works
  checks with no runtime errors. Its generated asteroid field contained no isolated rock, so the
  two asteroid-only checks correctly skipped rather than reporting false passes.

### 2026-09-01 — Real-phone test environment staged

- The existing local `astera` database was migrated but deliberately not wiped: it contains two
  live ruleset-v3 seasons, 83 players and retired hull state. A separate
  `astera_fleet_v2_phone_test` database now carries the current migration journal, two clean
  ruleset-v4 seasons and eight unattended EU-1 commanders; retired and unknown unit rows are zero.
- The complete workspace build passes lint, typecheck and the production Web bundle. The previous
  3100/5173 processes were verified as an obsolete `/tmp/blindspace-…` checkout and replaced with
  the current workspace API+worker and Vite dev server.
- The current LAN endpoint is `http://192.168.1.73:5173/`. Local and LAN HTTP checks return 200;
  `/health` reports database, queue and event stream healthy. A 390×844 Chromium load through the
  LAN URL creates the WebGL canvas with no page error or failed request. Phase 9 remains blocked
  until the owner performs and records the physical-phone frame/memory interaction pass.

### 2026-09-01 — Owner-approved Fleet V2 pose calibration completed

- Physical review superseded the earlier coarse four-axis visual audit: some craft still do not
  travel at the exact desired authored angle. No new facing value was guessed in code. A temporary
  `/fleet-facing.html` tool loaded every hull on top of its current `MODEL_FACING` correction and
  exposed independent additive X/pitch, Y/yaw and Z/roll degrees for owner calibration.
- The page uses one mobile-safe WebGL context, the live centred model and authored scale, a visible
  canonical `+Z` travel arrow, side/top/rear camera presets, orbit controls, persistent values for
  all eighteen hulls and stable JSON export. A separate normalized `Y↕` offset moves the hull
  vertically against the fixed flight axis, since the visible fuselage centre does not always equal
  the model's mathematical bounding-box centre. Zero on every field means the exact current game
  pose. The owner reviewed all eighteen craft and supplied the accepted table.
- The accepted XYZ degrees and `Y↕` offsets now live beside each model in the canonical Fleet V2
  manifest. `posedCraft` applies them after canonical nose alignment; both the live galaxy fleet
  renderer and public landing traffic consume the same map. Height is divided by the authored
  preview scale before the live hull group reapplies it, preserving the exact calibration-space
  relationship between fuselage axis and exhaust/flight axis.
- Existing per-hull outline identity remains intact: the shared silhouette-rim renderer receives
  each hull's manifest `light.color`, so all eighteen additions retain their own additive border
  rather than falling back to a shared fleet blue.
- The temporary page, generated bundle, bundle config and localStorage helper/test were removed
  after transfer. The permanent manifest table and renderer contracts are now the only sources of
  truth for these poses.

### 2026-09-01 — Phase 9 requalified after final asset quality and pose acceptance

- Re-ran the root `pnpm verify` after the 768px material pass and owner-approved pose transfer.
  Workspace typecheck and the 4 GB lint command pass; Rules pass 23 files / 537 tests, Simulator
  7 / 87, Server 48 / 1,050 and Web 121 / 1,734. The production Web build also passes.
- `pnpm balance:economy` passes for all twenty-one current hulls and fifteen research projects.
  `pnpm balance:goal` reproduces only the already documented pacing debt: a player reserving 50%
  for development reaches the package in 4d 00h 50m rather than the D128 6–7 day target. The full
  calibrated route remains 8d 01h 44m. No gate or acceptance band was widened to hide this.
- The final eighteen runtime hulls measure 202–289 KiB (4,583,492 bytes total), require Meshopt and
  three WebP maps, and retain all 3,726–7,368 authored triangles. The asset contract now rejects a
  Fleet V2 GLB below 200 KiB as well as one above 300 KiB, preventing the rejected low-detail pass
  from quietly returning.
- `out/fleet-v2-phase9-approved-pose-baseline` records the final 390×844 scene after calibration:
  WebGL2 at DPR 2, 46 draw calls, 3,396 triangles, 40 geometries, 36 textures, 58 visible objects,
  20 instanced meshes / 187 instances and 64 MB peak JavaScript heap. It reports no page errors or
  unexpected API calls. SwiftShader's long-tail samples remain a desktop software-renderer
  diagnostic and are not substituted for the phone frame-time gate.
- `out/fleet-v2-phase9-approved-pose-interaction-rerun` passes focus rail, second-tap detail,
  Home targeting/framing, owned-world management, affordability explanation and live Works checks
  with no runtime errors. This generated field contained no visible asteroid, so its two asteroid
  checks explicitly skipped rather than recording false passes.
- Rechecked ADB after the complete qualification; no physical device is attached. Phase 9 remains
  `[!]` on exactly one external measurement: real-phone WebGL memory/frame time, heat and battery.
  The isolated ruleset-v4 environment remains available at `http://192.168.1.73:5173/`; API health
  is green on port 3100. The `test99` commander in the disposable phone-test database has 500,000
  of each resource, Core/Shipyard/Hangar L12, all fifteen research projects at their real maxima
  and twenty of each Fleet V2 hull, ready for that device pass.
- Phase 10 is not marked started: its two-human acceptance session explicitly follows the physical
  device gate. The session script and observation template already exist in `docs/playtest-log.md`.

### 2026-09-02 — Formation spacing corrected for authored hull sizes

- Owner review found that Fleet V2 hull geometry used the accepted 0.84×–1.38× authored size ladder,
  while every formation slot still used the old uniform `base scale × 1.5` spacing. Capital hulls
  therefore received a larger body, wake, exhaust and hit area without receiving more physical room
  in the formation, allowing adjacent models to intersect.
- Added one shared size-aware formation layout for both owned fleets and resolved foreign contacts.
  It measures the largest rendered hull in the actual marker list and spaces the whole solid-cone
  formation at `largest hull scale × 1.8`. The closest golden-angle slots are then slightly more than
  one full largest-hull width apart; Dart-only formations remain tighter than Citadel formations and
  mixed formations reserve enough room for their largest member.
- Hit areas, formation lights, wakes, pips, craft geometry and bombardment origins continue to consume
  the same slot array, so the correction does not create a second visual position or change any
  gameplay distance, speed, targeting or combat calculation.
- Web typecheck passes. Focused formation/flight/battle/route tests pass 45/45, including a crowded
  fifty-Citadel pairwise separation contract; lint passes for every edited source/test file. The
  direct production Web build succeeds with 1,334 transformed modules. Phase 9 remains blocked only
  on the already-recorded physical-phone acceptance measurement.
