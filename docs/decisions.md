# Decision Log

This file contains only current authority that would be expensive to re-derive. If implementation and this file disagree, investigate the discrepancy before treating the code as correct.

Entries contain only the current rule, optional evidence worth preserving, and what the rule binds. Narrative, incidents, rejected experiments, visual implementation, deployment procedure and volatile balance tables belong in their specialist docs, tests or git history. Decision IDs are stable; removed or merged IDs are intentionally absent and must not be reused.

Precedence inside this file is explicit: master decisions named in a rule own that subject. Numeric values that are tuning rather than invariants live in `@astera/rules` / `docs/balance.md`; this log records a number only when the number itself is the decision.

## Product & game invariants

### D1 · Core tension: information game — LOCKED

Rule: The core game is seeing without being seen. Fleet allocation supports that information game; Telescope, Radar, Explorer and Veil are core systems, and the 3D galaxy is the interface rather than a target list.
Binds: Intel progression, combat complexity, galaxy interaction model.

### D2 · Score = Dominion — LOCKED

Rule: `exchange = securedLoot + enemyPermanentLoss - ownPermanentLoss`; the attacker's Dominion
transfer is exactly `exchange` and the defender receives its exact opposite. It is uncapped,
linear, combat-only and additive: splitting the same realised exchange across battles cannot buy
more score. A large fleet earns nothing merely for being sent, while destroying or losing a
season-sized fleet may cause a season-sized ladder move — the fleet is the bet. Ground defence is
priced net of free salvage; wreckage, fuel, battle grade, `fleetPower`, NPCs, neutral worlds,
trade and strategic strikes never add Dominion of their own. The invariant is zero-sum per scored
battle and across a season cycle; D174 placement can move an existing balance between local
galaxies. The three current terms use raw physical `A + C + D`; D208's economic calibration does
not reprice them. Rulesets before v7 retain their recorded bounded transfers and are never repriced.
Every movement is stored in a durable integer score journal that survives player-facing report,
mission and idle-seat deletion; season freeze reproduces both player and clan caches before ranks
become permanent. Operator battles are explicitly marked competition-exempt rather than inferred
from a zero. Binds: Combat settlement, score journal, leaderboard, season results, reports,
simulator.

### D5 · Season = 14 days — STRUCTURE LOCKED, NUMBER PROVISIONAL

Rule: Seasons are finite and currently fourteen days. The duration must be re-derived if the progression curve materially changes.
Evidence: Seven days did not expose the intended mid-game; fourteen days gives two weekend windows under the current progression target.
Binds: Season lifecycle, pacing, balance acceptance tests.

### D20 · Galaxy is the primary surface — OWNER DECISION

Rule: The galaxy fills the game surface; management screens open over it rather than replacing it with a conventional tabbed app. Focus is the base interaction and must expose only information the commander is entitled to know, including source and staleness where relevant.
Binds: Galaxy shell, focus system, navigation model, intel presentation.

### D172 · Local Academy replaces the guided rehearsal — OWNER DECISION

The first game is authored on the device, using the production screens and shared
rules. Reveal controls progressively. The supplied `tutorial-hand-icon.png` and
a short bubble replace the spotlight; preserve the click gate and scroll support.
The opening glides from the distant view to home over two seconds, starting after
the scene has compiled and painted. The player presses the actual planet to open
management, without Continue. Leave the opening coach 48px above the planet anchor.
Every action hand loops a tap with two expanding fingertip ripples below the image.
Loading covers sit above the hand, which remains hidden until loading ends.
On the opening lesson it stays hidden until the actual camera glide finishes
(or the player deliberately takes over the camera). Reward coaches clear the
whole reward card, including its title, while the hand still points at Claim.
Academy silences and discards all toasts, restoring normal notifications on exit.
Accepted construction or ship orders scroll the menu body to the queue at its top,
once per order, while the coach explains the wait.
The Academy build picker offers only the lesson's authored quantity (two Darts,
one Prospector or Courier), ready for the indicated Build press. The live game's
free quantity picker is unchanged.
Introduction-only lessons frame the element without a hand or detail-sheet press;
brief copy explains its purpose and that no upgrade is required. Only these lessons
offer a continuously scaling Continue. Per the owner's final instruction, no
OS motion-preference queries or conditional animation classes are used anywhere
in the web client. Action lessons
advance on the actual tab, build, dispatch, reward or report-close action, never
an extra Continue. Keep the planet menu open when introducing the next tab;
the player presses that newly revealed tab. The Telescope exercise smoothly
frames the entire sight sphere after the toggle, fitting portrait as well as landscape.
Order: Production (Core, Alloy Refinery, Crystal Extractor upgrades/rewards;
Deuterium Refinery and Foundry introductions), Intel (Uplink, Telescope, Radar,
Veil introductions; press the Telescope sensor toggle to see its reach), Defend
(Vault and Aegis upgrades/rewards; Thorn/Bastion introductions), Fleet (Shipyard
upgrade/reward, Hangar introduction, two Darts), authored pirate victory with a
small ship loss, battle notification/report and rewards, Prospector manufacture
and asteroid trip/reward, research-menu introduction, two more Darts and a Courier,
explaining cargo, then an authored world raid/report and account creation.

Add Vault L1/3/5 and pirate reward chains, Aegis L3/5, and opening tiers needed by
the lessons, retaining existing reward IDs and claims. A completed tutorial reward
cannot be paid again after placement. Replay from Help is local and never changes
the existing commander. Claim sends only a bounded completed-step number, never
client-authored resources or levels; the server seeds that authored checkpoint
atomically with creation and never overwrites a returning player's world. Cached
legacy intent claims stay compatible. Neutrals keep `PLANET_START`; bots use the
Academy exit. Short waits and nearby targets belong to the Academy, not a global
fleet-speed change. Keep a running real queue at exit. Owner waived detailed
balance simulation/calibration; retain affordability, progression, capacity,
boundary, retry/concurrency and once-only reward tests, without widening bands.

### D56 · Rehearsal is the real game before account creation — OWNER INSTRUCTION

Rule: `/api/preview` is write/seat-free and uses the real public-galaxy projection. Rehearsal uses production contracts, `START` + shared fuel; claim creates `PLANET_START`, then replays intents through normal services. Retry with same credentials recovers the created account; replay only on untouched world. A refused replay step never rolls back account/planet. Skip fills missing opening orders without duplicating staged commitments and opens final claim. The front-door form signs in only; new commanders enter training before registering (onboarding review §3).
Binds: Preview, rehearsal, claim, D58/D136.

### D63 · Astera is a real-time game — OWNER INSTRUCTION

Rule: Core interaction is session-scale real time: travel and combat are short enough to observe and react to during play, and timing relationships are derived as ratios rather than inherited from an asynchronous-hours model. Any system whose value depended on multi-hour flight assumptions must be re-derived against the current tempo.
Binds: Travel, Radar timing, disruption, debris lifetime, Telescope commitment, simulator pacing.

### D124 · A rule the player cannot see is not a rule — OWNER INSTRUCTION

Rule: Gameplay rules, especially the information layer, must be perceptible in the 3D galaxy rather than existing only in server payloads or explanatory text. Correct mechanics that cannot be understood by looking are incomplete.
Binds: Fog/intel UX, sensor visualization, strategic counters, interface acceptance.

### D142 · Design must answer before copy does — OWNER INSTRUCTION

Rule: A player should understand what they have, what they lack, what they can do and why they cannot do something primarily by looking; text confirms the picture rather than carrying the whole rule. The frontend is the game surface, not a thin view over backend truth.
Binds: `docs/interface.md`, capacity/research/queue/report presentation, interaction design.

### D144 · The drawing vocabulary is finished, and every surface uses it — OWNER INSTRUCTION

Rule: All UI uses shared shapes: `SpendBar`=cost/deficit (shortfall extends past store end), `RangeBand`=uncertainty width, `FlightBar`=leg position, `Tally`=small count/cap. Garrison shows POWER; score ladders compare from center. Hidden inbound craft with no departure time gets dashed track/no fake marker. UNKNOWN cannot camera-focus; live claim ring shows only in RESOLVED sight. Text adds only facts the picture cannot.
Binds: `docs/interface.md`, shared UI shapes.

### D145 · One radar shell, one sweep that turns, and a switch for both instruments — OWNER INSTRUCTION

Rule: Radar draws one reach shell + rotating sweep + pulse. While D126 radii are merged, sweep is not another boundary. Static alpha uses `RADAR_VISIBILITY`; sweep head/trail are separate and always animate. Telescope/Radar draw toggles are per active-world planet id and hide drawing only, never rules/fog; posts without `planetId` stay drawn. Shader safety: floor derivatives, cut hub before `atan`, use NaN-safe alpha guards; source tests enforce this.
Binds: Sensor UI, D126.

### D146 · A colony must be in its commander's own galaxy, and the write must say so — BUG

Rule: `transferPlanetControl` must verify target world and receiver are in the same season before transfer; otherwise `WRONG_GALAXY`. This guard applies to every caller. Never identify worlds by neutral display name; use id.
Binds: `transferPlanetControl`, settlement, strategic capture, `grant-colony`, D97.

## Economy & progression

### D4 · Three independent work queues — OWNER DECISION

Rule: Per world: CONSTRUCTION for buildings/instruments/satellites; YARD for mobile/ground hulls. Per commander: RESEARCH. Each lane depth=3; cost commits on queue. Construction/Yard cancel=50% refund; Research cannot cancel; system failure=100%. Queued prereqs count; `builtEver` only on completion. Opening Thorn must fit Radar L3 reaction.
Binds: Queues/build services.

### D13 · Vault floor is bounded — LOCKED INVARIANT

Rule: For every resource/level, Vault protection stays below half its storage basis: `protectedHoursPerVault / capHoursPerVault < 0.5`. Protection uses that resource's own production rate.
Binds: Vault, storage, loot, simulator.

### D16 · Manual production collection — OWNER DECISION

Rule: Works accumulates production into a bounded buffer and stops when full; collection transfers it to storage and resumes production. Uncollected Works value remains partly raidable rather than becoming a safe offline bank.
Binds: Production accrual, Works, collection API, raid loot, storage UI.

### D17 · Speed economy by income, not price cuts — OWNER DECISION

Rule: When the whole economy must accelerate, prefer scaling income over uniformly cutting prices so payback, resource shares and Vault ratios remain stable. Any exception must be justified as a product-specific commitment rather than an invisible global retune.
Binds: Economy tuning, `docs/balance.md`, production/cost constants.

### D147 · Asteroid Crystal falls while Crystal-bearing hull demand rises — OWNER INSTRUCTION

Rule: Asteroid Crystal share -30%; removed share becomes Alloy, total ore unchanged. Hull recipes already using Crystal cost +15% Crystal after normal scaling; zero-Crystal stays zero. Isotope replacement remains independent.
Binds: Asteroids, hull prices, economy balance.

### D25 · Four instruments and four satellites — OWNER DECISION

Rule: Ground instruments are Telescope, Radar, Aegis and Veil and may level; orbit satellites are Uplink, Foundry, Derrick and Beacon and are one-time purchases. Uplink is the availability gate for Telescope and Radar; orbit scarcity comes from slots rather than satellite levels.
Binds: Rules catalog, Core slots, instrument/satellite purchase services, UI catalogs.

### D31 · Mined ore lands in Works — OWNER DECISION

Rule: Returning mining value enters Works, bounded independently per resource by the collector ceiling, rather than bypassing collection into storage. Mining therefore participates in throughput, collection risk and raidability instead of becoming a separate safe economy.
Binds: Mining settlement, Works/storage, raid loot, mining preview.

### D36 · Purchasable levels stop where effects stop — MEASURED

Rule: Sell a level only if it changes gameplay. Derive max level from the effect/table when possible. Keep over-cap legacy state; do not delete it. If no further effect exists, UI says no more levels.
Binds: Instrument/research caps, validation, UI, tests.

### D58 · Real opening gets a cushion; rehearsal keeps START — OWNER INSTRUCTION

Rule: New real capital gets `PLANET_START = START + OPENING_BONUS` once. Rehearsal stays on `START`. Claim idempotency, `untouched()` and simulator bootstrap compare against `PLANET_START`.
Binds: Claim, planet creation, rehearsal, simulator.

### D64 · Rewards pay for acts, not attendance — OWNER INSTRUCTION

Rule: Rewards come from authoritative actions, never attendance. Progress is derived; `builtEver` is the historical-construction exception. Resource rewards go unclamped to storage, may overflow and remain raidable; overflow blocks Works collection until space exists. Seasonal chains reset; community/follow reward is once per account.
Binds: Rewards, storage/Works.

### D92 · Deuterium is first-class — OWNER DECISION

Rule: Deuterium is a required third member of resource values and participates in cargo, raid, debris, mining and Wealth arithmetic; there is one ruleset, not a feature-flagged Deuterium fork. Passive supply is provided by the Deuterium Refinery under D135, and starting fuel is governed by D136.
Binds: Resource schemas, migrations/backfill, economy, combat loot, mining, API contracts.

### D93 · Frontier research is discovered from play — OWNER DECISION

Rule: Frontier discovery: Spectrometry=season clock; Dense Fuel Cells=Spectrometry + successful cargo-limited raid; Gravitic Charges=Spectrometry + qualifying Aegis absorption; Death Star Protocol=Gravitic Charges + War act. Dense Fuel Cells gates Propulsion; Gravitic Charges gates Nullifier. Unlocks derive from authoritative history, not mutable flags.
Binds: Research discovery, D134/D140/D148.

### D94 · Runner is a speed-for-cost support hull — SUPERSEDED AT FLEET V2 CUTOVER BY D148

Historical rule: Runner was fast Deuterium support, not cheap Hauler. D148 retires Runner/Hauler; speed-vs-capacity moves to Courier/Wayfarer/Atlas. D8 support protection and support-only launch ban remain.
Binds: Hull/support rules.

### D95 · Breacher attacks shields, not the counter cycle — NAME/CATALOG SUPERSEDED BY D148

Rule: D148 retires Breacher name; Nullifier inherits its specialist rule: bonus only vs live Aegis covering a defending line, capped by remaining shield, never spills into ships/ground defence. Without shield it must be a poor generic choice. An unguarded world never fires a round and is governed by D173, so its idle Aegis gives the Nullifier nothing to shoot.
Binds: Nullifier, Aegis, combat, reports, D173.

### D101 · Economy changes as one ruleset — OWNER INSTRUCTION

Rule: Coupled economy changes ship together at a season/wipe boundary; partial rollout is invalid. Production/storage/Vault use each resource's own rate. Hull value must preserve information/counter structure. Geometry is D129; pacing is D128.
Binds: Economy constants, hull pricing, season bootstrap.

### D128 · Slow progression without killing the opening — OWNER INSTRUCTION

Rule: Target development takes ~6–7 days for an attentive player spending half collected Alloy/Crystal on development; first meaningful production upgrade must repay in the opening session. Exact curves live in balance constants; fixed-goal simulator is acceptance.
Binds: `balance:goal`, `balance:economy`, pacing.

### D134 · Research belongs to the commander — OWNER DECISION

Rule: Research is commander-wide `(project, level)` with one 3-deep lane; colonies do not multiply throughput. Chosen world pays and sets Core speed. Losing it does not cancel/transfer research. Player cannot cancel started work. Lock player before planet. Completed research is not Wealth; live committed resources keep value until completion/failure.
Binds: Research storage/queue, Wealth.

### D135 · Deuterium Refinery is the floor; asteroids are the ceiling — OWNER INSTRUCTION

Rule (the ordering here is SUPERSEDED BY D176; the rest stands): Refinery gives guaranteed slow Deuterium; isotope asteroids are faster contested supply. Level is capped by Deuterium Synthesis + Core. Base Deuterium Works/storage exists even at Refinery 0; extra capacity comes from refinery output. Vault protection uses refinery output and is zero at level 0. First Synthesis level requires no Deuterium.
Binds: Deuterium economy.

### D176 · The deuterium plant is a supply, not a floor — OWNER INSTRUCTION

Rule: `ECON.deuteriumBase` is tripled and `PIRATE.hoardShare.deuterium` goes 0.008 → 0.01125. Owner instruction: *"deuterium rafinerisinin üretim çıktılarını 3 kat arttırmanı istiyorum ve korsan filonun verebileceği max deuterium miktarını ~700 yapmanı istiyorum."* THIS RETIRES THE ORDERING D135 STATED, and it is retired on purpose rather than drifted into. The plant reads L1 10/h · L3 34/h · L6 76/h · L9 128/h · L15 271/h against a miner's ~105 per isotope run, so it is under one miner through plant level 7, passes it at level 8, and ends at about 2.58× it. What the rocks keep is what a plant cannot copy: they are contested, and they arrive in one lump a fleet has to be in position for — the Frontier act now competes on risk and timing rather than on volume. ONLY THE BASE MOVED. `deuteriumMult` stays 1.04, so every level rises by the same factor and the ladder keeps the shape the rest of the economy was measured against; the `× 3` is written as its own factor beside D161's `× 1.15` rather than folded into the swept 4.15, so a later reader can still see which instruction moved which part. The pirate ceiling was raised by the SHARE alone for the same reason a flat cap was rejected when it was cut: the ladder is what the level badge prices, and it runs 64 · 192 · 401 · 699 against the old 45 · 137 · 285 · 497, measured over sixty thousand seeds per level. Deuterium stays a garnish by share — about 1.3% of a hoard's value. THE ACCEPTANCE TESTS WERE RESTATED, NOT WIDENED: `deuterium.test.ts` asserted that the plant never catches the rocks and now asserts exactly where it crosses them, and `pirates.test.ts` keeps its lower bound at nine tenths of the ceiling because twenty thousand seeds reach about 93% of what sixty thousand find. The owner's standing note applies to all of it: *"ekonomi dengesini boşver, şuanda tam düzgün bir denge yok"* — this is a deliberate step away from a balance nobody has settled yet, not a claim that the new numbers are balanced.
Binds: `ECON.deuteriumBase`, `deuteriumRate`, deuterium storage/works/vault floors, `PIRATE.hoardShare`, `pirateHoard`, D135, D136, D150, D161. D204 supersedes only this entry's ~700 pirate ceiling; the 0.01125 share remains current.

### D177 · A flight that arrives at nothing says so — OWNER QUESTION

Rule: When a committed flight reaches a target that is already gone, the arrival writes a `target_gone` notification to the commander who sent it, and the craft fly home exactly as they always did. Owner question: *"korsan filo başkası tarafından yok edilirse; gemilerim geri dönüyor mu? Yoksa hedef'e kadar ulaşıp öyle mi dönüyor?"* — the answer is the second, and it does not change: a launch is committed (D40), so there is no recall and no early turn, the outbound leg is flown in full, the return is measured from the intercept point, and prepaid fuel is not refunded (D136). WHAT CHANGED IS ONLY WHEN THE COMMANDER IS TOLD. Both lanes were silent at the moment the trip became pointless — `raid_result` is written by a fight, so a pirate raid with no fight in it wrote nothing, and a mining run that took zero ore wrote nothing until the drill landed and the haul row said "empty-handed" without saying why. The news existed a whole return leg before it was delivered, which is the interface making the player wait for something it already knew. ONE KIND FOR TWO LANES, because it is one fact to the person who flew it: `targetKind` is `PIRATE` (the crew was wiped first, or the lane no longer carries that pirate at all) or `ASTEROID`/`DEBRIS` (nothing was left to take — zero claimed is the whole test, since `claimOre` takes what remains). IT NAMES THE TARGET AND NEVER THE RIVAL: who got there first is their own raid, and D127 does not hand it over because two commanders aimed at the same thing. The row is `neutral` in `signalOutcome` — every ship is coming back and the fuel was spent at launch, so it is neither a win nor a loss, and without that line a pirate-family row falls through to `win`. ALSO FIXED HERE, because it is the same defect one lane along: the client's `fleet_returned` union never had a `trip: 'pirate'` case, so every pirate homecoming since D150 was parsed by `legacyRaidReturn` — which happens to want the same four fields — and printed the PvP fleet's wording over a lane with no commander in it. That is exactly the failure the `trade` branch beside it was written to document.
Binds: `notification_kind`, `resolvePirateArrival`, `resolveMiningArrival`, `describeNotification`, `signalFamily`/`signalGlyph`/`signalOutcome`, `DESTINATION`, D40, D127, D136, D150, D156.

### D178 · A shower is worth ten by day and five at night — OWNER INSTRUCTION

Rule: `ASTEROID_SHOWER.effect.asteroidSpawnMultiplier` becomes 10 and a new optional `nightEffect` carries 5. Owner instruction: *"gündüz 10x olsun gece 5x kalsın"*. THE NIGHT IS THE CALENDAR'S OWN `lowPriorityWindow` (00:00–08:00 TRT), not a third definition beside it and the merchant's 01:00 `quietWindow` — the same band that already decides how rarely a shower is scheduled there now also decides what it is worth there, stated once. A kind without a `nightEffect` is worth its `effect` at every hour, so nothing else on the calendar moves. THE FIGURE IS STAMPED, NEVER CONSULTED LATER: `effectAt` runs at deal time on a start instant that has already been drawn and consumes no randomness, so the shower's stream stays byte-identical (D149), the occurrence row still carries exactly one number, and every reader keeps reading one number. WHAT THIS MEANS FOR A LIVE SEASON, and it is the operational half of the decision: effects are frozen at deal time, `seedGalaxyEventCalendar` has one caller (season creation) and nothing re-deals a live calendar, so the constants change reaches only seasons dealt after it. `restampFutureOccurrences` — `season restamp`, dry run by default — is the door, and it will only touch a window that has NOT opened. That restriction is arithmetic, not caution: `withAsteroidShowerLanes` appends each shower's rocks after everything already in the field, so a lane's size fixes the INDEX of every rock in every later lane; a rock's public id is an HMAC of its index, `asteroid_claims` is keyed by it and an in-flight `mining_runs.asteroid_index` resolves through it. Resizing a lane whose rocks are in the sky would move a commander's claim, and a drill already on its way, onto a different rock, and nothing would throw. A window that has not opened owns no rocks, and resizing it moves only lanes that own none either. `definitionVersion` goes to 2; nothing compares it against the current constant, so an old row is inert rather than refused.
Binds: `GALAXY_EVENTS.definitions.ASTEROID_SHOWER`, `effectAt`, `plannedEffectFor`, `occurrencesFor`, `restampFutureOccurrences`, `season restamp`, `withAsteroidShowerLanes`, D19, D110, D143, D149, D156, D166.

### D179 · A Death Star is an outage, and it loses nobody a world — OWNER INSTRUCTION

Rule: after sustained player complaint the owner removed both of the strike's teeth. A strike no longer destroys ANY fleet — `DESTROYED_HOME` is gone, with no exemption, so a neutral's garrison survives too and softening a fortified world before settling it stops being a play — and no world is ever released. `endRecovery` is housekeeping again: the `recoveryReliefAt` read, the `releasePlanetControl` call and its lost-the-race fall-through are all deleted, and `releasePlanetControl` itself is gone with its only caller. `MULTI_WORLD.recoveryMinutes` collapses from `{ capital: 2h, colony: 8h }` to a single two hours, because the eight existed only to make D167's deadline answerable and there is no deadline left. WHAT REMAINS IS STILL THE LARGEST SINGLE ACT OF DESTRUCTION IN THE GAME — half the stores, a Core level with whatever it drags down, two Aegis levels, the cancelled scaffolding — measured at ~102,000 against a Core 12 world and ~420,000 against a Core 17 one, with a full store. THE OUTAGE IS NOW THE WHOLE PUNISHMENT AND ALSO A SHIELD: `assertWorldOperational` seals the bays for two hours and `startAttack` refuses a raid on a recovering world, so the surviving fleet is present, safe and useless. PRICED FOR WHAT IS LEFT: `DEATH_STAR.cost` 66,000 → 32,500 (20k/10k/2.5k) and `ANTI_STRATEGIC.cost` 41,000 → 20,500 (11k/8k/1.5k), both owner figures. The battery had to move: answering a strike must cost LESS than making one or an attacker drains a defender by launching, and 41,000 against 32,500 crossed that line. `recovery_relief_at` stays as a column and is written by nothing.
Binds: `applyDeathStarStrike`, `endRecovery`, `resolveTransfer`, `MULTI_WORLD.recoveryMinutes`, `DEATH_STAR.cost`, `ANTI_STRATEGIC.cost`, `strategic-strike.test.ts`, D105, D106, D113, D167.

### D180 · A flight quote carries the ladder and the Beacon, or it does not compile — OWNER REPORT

Rule: the owner asked whether propulsion research was really applied or only mis-displayed. It was applied — the server has always passed both modifiers and `mission.test.ts` proves it — and mis-displayed on four client surfaces, for as long as propulsion has existed. `fleetTravelExact(dist, fleet, boost = 1, tech = {})` handed a plausible wrong number to anyone who forgot the last two arguments: `planRoute`, `planPirateRoute`'s return leg, `TransferSheet`, `SettlementSheet` and `FocusPanel`'s settlement ETA all took the default. At the top of the ladder that is DOUBLE the real minutes, and `settlementCanArrive` turned it into a refusal — telling commanders they could not reach a claim window they could comfortably reach. THE FIX IS THE SIGNATURE. `FlightModifiers { boost, tech }` is one REQUIRED argument on `fleetTravelExact`/`fleetTravelMinutes`, `fleetPace` is the only composer of the two, `fleetSpeed`'s `tech` loses its default, and `UNAIDED` is how a flight that belongs to no commander says so — legitimately only `SETTLEMENT_CLAIM_MINUTES` (a map-wide floor, correct at catalogue speed) and questions a multiplier cannot answer, such as "can this wing move at all". `flightModifiers(view)` is the client's single answer, reading `effectiveOrbit ?? orbit`. Every forgotten call site became a compiler error, which is the only guard that survives the next feature. A KNOWN ASYMMETRY IS PRESERVED, NOT FIXED: `launchSettlement` passes `boost: 1`, so a Beacon does not speed a founding flight; the client now mirrors that exactly rather than correcting it on one side.
Binds: `FlightModifiers`, `UNAIDED`, `fleetPace`, `fleetSpeed`, `flightModifiers`, `planRoute`, `planPirateRoute`, `planTradeRoute`, `reachMinutes`, `flight-modifiers.test.ts`, D25, D121, D137, D152, D156.

### D181 · Cargo Holds lifts every hold, and every store is a quarter deeper — OWNER INSTRUCTION

Rule: two economy changes the owner asked for together. (1) `CARGO_HOLDS` now lifts `transferCargoCapacity` as well as `fleetCargo`. The two still count different ROSTERS — a raid's ceiling counts every hull that flies, a logistics run counts Courier, Wayfarer and Atlas — but they no longer sit on different ladders, because a project called Cargo Holds that leaves an Atlas carrying exactly what it carried yesterday reads as a bug from every seat in the game. One `cargoMult`, floored after the multiply in both, so they cannot round apart; `tech` is REQUIRED on `transferCargoCapacity` for the same reason it is on `fleetSpeed`. `launchTransfer`'s two hold refusals MOVED INSIDE THE TRANSACTION: the answer now depends on a research row another transaction can be completing, and validating it in the pre-transaction preamble broke lock → advance → validate. Clan aid's `clanTransferCargoCapacity` is deliberately NOT changed and is reported as an open inconsistency. (2) `ECON.storageScale` 2.5 → 3.125, a flat +25% of storage at every level, ahead of a fuller look at the economy. It lands on the scale and never on `storageHoursLadder`, which is D171's separation exactly: the ladder is the Vault's authored progression, the scale is what one of its steps is worth in ore. The floor stays `protectedShare` OF the store, so the protected and the raidable piles grow together and `raidable.test.ts`'s band is untouched. `vault-table.test.ts` and `tempo.test.ts` now READ the scale instead of retyping it, so the next economy tweak does not arrive as failing claims about the Vault.
Binds: `transferCargoCapacity`, `cargoMult`, `launchTransfer`, `launchTrade`, `ECON.storageScale`, `storage-lift.test.ts`, `transfer-cargo.test.ts`, D156, D161, D171.

### D182 · The launch sheet's ETA is quoted to the second — OWNER INSTRUCTION

Rule: `durationPrecise` beside `duration`, used only for the launch sheet's one-way figure. A raid arrives at an authoritative instant and the whole game is built on being there for it, so a flight rounded to the whole minute hides up to fifty-nine seconds of the thing a commander is committing to. A separate function rather than a flag, because seconds belong only where somebody is timing something and a boolean would spread them by accident. Minutes-and-seconds under an hour, all three units past it, and the existing days-and-hours shape past a day where the seconds are noise. Seconds are padded so the figure does not change width on a 350px screen.
Binds: `durationPrecise`, `units.hoursMinutesSeconds`, `LaunchSheet`, `duration-precise.test.ts`, D51.


### D204 · Convoy schedule and three reward dials move — OWNER INSTRUCTION

Rule: three reward/supply dials move on the owner's instruction. (1) An
Intergalactic Convoy resource quote is capped by **two frozen hours** of the
origin world's nominal production instead of one; firepower quality, cargo,
ship-drop odds and every other constraint remain unchanged. Newly dealt and
restamped unopened occurrences carry `resourceCapHours: 2`; persisted one-hour
snapshots remain readable and immutable. (2) Every pirate hoard resource rises
by **30%** through the common `PIRATE.hoardValueMult`, **1.4 → 1.82**. The
Alloy/Crystal/Deuterium shares stay 0.55/0.30/0.01125, so composition and the
level ladder do not change. Cargo and combat-grade clamps still apply to what
actually returns. The pirate external-supply allowance rises with the reward,
5% → 6.5%, while admission remains valued at the frozen pre-D204 multiplier;
otherwise rationing would delete/re-index live deterministic pirate targets
instead of merely increasing their rewards. (3) From the shared season clock's 35th hour onward, exactly
**11/50 = 22%** of asteroid indexes are isotope-rich: the deterministic primary
cadence becomes five and the existing one-extra-per-ten-lanes seam remains.
Pre-frontier rocks and the separately rolled 10–25% Deuterium concentration are
unchanged.

The same instruction moves the Convoy's two fixed Türkiye-time windows from
18:00–20:00 / 22:00–24:00 to **07:00–09:00 / 19:00–21:00**. Both remain
half-open two-hour windows. Event kinds are independent: the morning window may
overlap the 07:00 Trade Ship and the evening window may overlap the 20:00
Asteroid Shower. Persisted old-season occurrence times remain immutable; the
new schedule is used when a season calendar is dealt.

Binds: `INTERGALACTIC_CONVOY.resourceCapHours`, persisted convoy effect parsing,
`PIRATE.hoardValueMult`, `pirateHoard`, `DEUTERIUM.isotopeCadence`,
`DEUTERIUM.isotopeRate`, `isotopeProfile`, `monthlySupply`, pirate admission,
fixed Convoy windows, D102, D150, D176, D201.


### D203 · Strategic prices rise and pirate fleets slow down — OWNER INSTRUCTION

Rule: every resource component of `DEATH_STAR.cost` is tripled, from
47,887/23,944/1,984 to **143,661/71,832/5,952**. Every component of
`ANTI_STRATEGIC.cost` rises by 50%, rounded to the nearest whole resource by the
project's price convention, from 28,733/14,367/1,191 to **43,100/21,551/1,787**.
Build times, gates, strike effects and interception behavior do not move. The unequal
raises deliberately change the battery's total share of the weapon from about 60% to
about 30%; it remains strictly cheaper than the weapon it answers.

Only the pirate lane's orbital speed changes: one `PIRATE_SPEED_MULT = 0.75` applies
to both hull-derived endpoints, producing **94.54–126.40 units/minute** without
changing ship speeds, other moving targets, orbit radii, lifetimes, spawn rate,
rosters, rewards or combat. Consequently, a Citadel now outruns the slow end of the
pirate band; this is part of the requested whole-lane reduction rather than a separate
heavy-hull tune.

Binds: `DEATH_STAR.cost`, `ANTI_STRATEGIC.cost`, `PIRATE.speedMin/Max`, strategic
price tests, pirate geometry tests, D155, D179.


### D202 · Convoy presence and precise pirate interaction — OWNER INSTRUCTION

Rule: the Intergalactic Convoy's v1 visible roster is eleven ranks and two columns containing every
mobile Fleet V2 hull exactly once (22 craft); its separately versioned eight-hull reward pool does not
change. The convoy baseline is 2× its previous size, ranks close from 48 to 34 game units and lanes
widen from 36 to 64 for the doubled capital hulls, then owner review replaces the fixed 34 with
size-authored neighbouring gaps, then extends only the consecutive tier 3/4 section by six more
units: 22/28/34/34/41/54/56/68/76/72. Small ranks remain dense and large ranks cannot overlap.
Every craft carries bounded deterministic
longitudinal throttle drift whose maximum cannot reorder ranks. One batched formation wake and one
instanced drive bank supply motion without per-frame React state or per-craft effect draw calls; the
first pulse-ring treatment is explicitly removed after owner review. Its first 16-streak line replacement
is also rejected as childish and too static. The final treatment is four transparent full-length flow
veils in one instanced draw: the geometry remains anchored while vertex waves and domain-warped fragment
noise continuously evolve and travel from the nose toward the rear. Per frame only shader uniforms change.
Focus targets the train's length
midpoint and takes an exact range derived from the final nose-to-tail extent and the camera FOV.
Corsair, Argosy and Paladin declare their corrected native nose as `-X`, reversing the first attempted
quarter turn in every flight scene. An identified pirate replaces the
formation-wide box target with one batched pick sphere per visible hull, leaving the formation's empty
horizontal wedges clickable as galaxy; its existing batched plume is made depth-independent and
brighter so animated engine fire remains visible.
Binds: `INTERGALACTIC_CONVOY.formation`, `convoyFormationSlots`, `IntergalacticConvoy`,
`FLEET_V2_ASSET_MANIFEST`, `FormationWakes`, `FormationLightField`, pirate hit targets, D165, D201.

### D201 · Intergalactic Convoy and the fixed public-event calendar — OWNER INSTRUCTION

Ruleset 8 replaces random public-event packing with a UTC+03:00, half-open fixed daily calendar:
Trade Ship 01:00–03:00, 07:00–09:00, 15:00–17:00 and 21:00–23:00; Asteroid Shower
02:00–03:00 ×3, 10:00–11:00 ×3, 13:00–14:00 ×5 and 20:00–21:00 ×10; Intergalactic
Convoy 07:00–09:00 and 19:00–21:00 (moved by D204). Only complete windows inside a season are dealt. Fixed
kinds consume no calendar RNG; rulesets 4–5 and 6–7 retain frozen random definitions for explicit
old-season creation and restamping.

The convoy formation centre crosses an isotropic galaxy diameter in exactly 120 minutes and the
visual ranks do not change that gameplay anchor. A launch needs an armed mobile fleet, spends both
legs of fuel, cannot be recalled, engages for five seconds without retaliation or loss, and delivers
at most two frozen hours of the origin world's nominal production subject to firepower and cargo
(raised from one by D204).
Resource quality and ship-drop quality use separate thresholds. Full ship quality is 15%; a drop is
1/2/3 ships at 80/17/3, with tier weights 55/27/13/5 truncated by the launched fleet's maximum tier
and a versioned eight-hull visible pool. A world may launch at most once per occurrence and may have
only one non-done convoy run across occurrences; both rules are database constraints. v1 server bots
do not choose this lane. Like Asteroid Shower and Trade Ship income, Convoy income remains
explicitly outside ARR/VFR, progression, season and every other economy calibration simulation.

**Review corrections, same decision.** Seven of them change stated behaviour and are recorded
here rather than only in the code:

- **The quote guard is an AGE bound, not a reaction-time bound.** A rendezvous with a moving
  target is pinned in absolute time, so hesitating `d` seconds simply leaves `d` less flying to
  do: measured over the shipped geometry the worst-case drift in both the flight's duration and
  its absolute arrival is 0.98 × the delay. A raw five-second tolerance on either figure
  therefore refused the median confirmation for no reason but reading speed.
  `quoteToleranceSeconds` now bounds only the surplus BEYOND what the elapsed time explains, and
  `maxQuoteAgeSeconds` moves 15 → **45** as the one real staleness bound. The client stamps
  `quotedAt` from the press instead of from the five-second tick.
- **The spent occurrence is published.** `convoyOccurrenceSpent` on the planet view says this
  world has already struck the crossing that is up. `convoyLaunchLocked` clears when the fleet
  lands and the quota does not, so without it the control re-armed inside the same window and
  invited a launch the server was always going to refuse (D124).
- **An abandoned outbound run releases the ration it never spent.** `abandoned_at` drops the row
  out of the now-partial `(planet_id, occurrence_id)` unique index: a strike that never fired
  because an arrival event failed permanently is our fault, not one of the commander's decisions.
  Fuel stays spent — D136 refunds nothing, on any path.
- **A moving engagement is a window, never a hold.** `contactPosition` enters the placement solve
  only for a stationary target; `engagement.targetTo` is the payload saying which kind this is.
  The two helpers used to delegate to each other without progress.
- **The formation's orientation is a quaternion**, not `lookAt`: an isotropic route may be
  parallel to world up, and at the far end the group's position IS its target.
- **The offline recap filters the lane in the query** (every returning lane writes
  `fleet_returned`, so a LIMIT taken first could drop every convoy line) and takes at most
  `CONVOY_RECAP_LINES` of the five.
- **`plannedEffectFor` has no default config** and `galaxyEventKindsForRuleset` states the
  merchant's ENTITLEMENT boundary (ruleset 5) separately from its SHAPE boundary
  (`tradeShipRulesetVersion`), which D166 had silently merged.

Binds: `INTERGALACTIC_CONVOY`, fixed galaxy-event planner/config registry, ruleset 8, convoy route,
launch/run lifecycle, per-world uniqueness, reward snapshot, traffic/fog/UI, rollout telemetry,
`convoyOccurrenceSpent`, `intergalactic_convoy_runs.abandoned_at`, `engagementPosition`.

### D200 · Garbage Collector (Hurdacı) — OWNER INSTRUCTION

Special bandında ikinci gemi: tier 3, Tersane 4 + Yıldız Gemisi Mühendisliği 1, fiyatı elle konuldu ve ölçeklenmez: **10.000 alaşım + 5.000 kristal**. Saldırı 0, ambar 0; SUPPORT sınıfı, yani yük gemisi gibi hattın arkasında durur — kendi tarafında savaş gemisi yaşadıkça korunur, hat düşünce vurulup ölür (HP, kademesinin nakliyesiyle aynı: 540). Hız, pivot tur süresi (20 dk): üçgenin ortası, Lance temposu. Yakıt D195'in tek istisnası: değerinden 19,1 /1k içecekti, sahibin talimatıyla elle **10 /1k** (`SALVAGE.fuelMass` = 100).

Kural: katıldığı savaş bittiğinde **hayatta kalan** her Hurdacı, o savaşın enkazından `SALVAGE.perCollector` = **15.000**'e kadar alır; oran enkazın kendi alaşım/kristal/döteryum karışımıdır (`claimDebris`'in aritmetiği). Toplama, savaşın çözüldüğü anda ve aynı transaction'da olur; kalan kısım olağan herkese açık alandır. `settleWreck` tek ifadedir ve üç yol da (oyuncu, bakıcı dünya, korsan) onu okur. `DEBRIS.minimum` taban kuralı **kalana** uygulanır: Hurdacı zaten oradadır, alan çizilmeyecek kadar küçük hurdayı da alır.

Ganimet değildir: Dominion'a girmez (D2), klan payına girmez (D114), ambar tavanını (`fleetCargo`) büyütmez. Dönüş bacağında `missions.salvage` / `pirate_raids.salvage` olarak ganimetin **yanında** taşınır ve depoya iner; sunucu bacaktan vazgeçse (`abandon`) bile iner. Rapor ikisine de gösterir (`battle_reports.salvage`): saldıran için "Enkazdan toplanan" satırı, savunan için sonuç cümlesi — Hurdacı savunanın gördüğü filodaydı (D164). Savunmada toplamaz; evde duran Hurdacı nakliye gibi hattadır ve ölebilir.

Tek başına gidemez: dünya saldırısı savaş gemisi ister (`NOT_A_WARSHIP`), madencilik yalnız Prospector'undur. Korsana tek başına gönderilebilir (D150'de kargo için olduğu gibi "kötü karar, yasak değil") ama ateş etmediği için enkaz yaratamaz; kendi ölümü dışında toplayacak bir şey yoktur. Korsan kadrosu Hurdacı almaz: havuz canlı sezonda sezon anahtarından yeniden türetildiği için yeni gemi havuzu değiştirmemeli — `garbage-collector.test.ts` eski kadroları birebir tutar.

Rozeti kılıç değil kasa: ateş etmeyen gövde "bana mı geliyor" sorusuna hayır der (`rankRow`, `atk` üzerinden). Görsel: burun +z, boyut 1.85, 4.992 üçgen (hata sınırı 0.01 — 0.005'te 7.182'de takılıyor), dama arka planı gömülü render D196'nın floodfill kurtarmasıyla temizlendi.

Bilinen yaklaşım: D199 tahmini, probe'un saydığı silahsız gövdeleri kanadın kademesindeki nakliye olarak modeller; evde park edilmiş Hurdacı gerçek hattı modelden değerli yapar. Bu sapma farklı kademeli nakliyeler için zaten vardı; ölçülmüş tahmin motoru değiştirilmedi.
Binds: `SALVAGE`, `settleWreck`, `salvageCapacity`, `hullFuelMass`, `profileHull`, `poolFor`, `rankRow`, `StatStrip.salvage`, `missions.salvage`, `pirate_raids.salvage`, `battle_reports.salvage`, `settleReturn`, `resolvePirateReturn`, `abandon`, D2, D32, D114, D150, D164, D195.

### D199 · Tek güç birimi ve savunma/filo karşılaştırması

Oyunda "Power" dört farklı şeyi ifade ediyordu: `wealth`, `combatValue`, `fleetPower` ve `fleetValue`. Aynı filo farklı ekranlarda farklı sayılarla görünüyordu ve hiçbirinde bu sayının savaştaki anlamı açık değildi.

Yeni yaklaşımda ölçümler savaş motoruna göre yapılıyor: duvarla eşit ateş gücü yalnızca kısmi kırılma sağlıyor ve yaklaşık %63 kayıp veriyor; temiz zafer için yaklaşık ×1.45 güç gerekiyor. Araştırma, karşı tür, Aegis, yer savunması ve üsse dönen nakliyeler gibi etkenler de ayrıca hesaba katılıyor.

Probe artık hedefin **o anki** ekonomisini, savunmasını, sınıf dağılımını, Aegis ve silahsız nakliye bilgisini bulanıklaştırılmış bantlarla gösteriyor. `forecastLines/forecastLoss` ise "bu filo ne kadar savunmayı aşar?" sorusuna tahmin sunuyor.

Ancak sistem kesin kazanma oranı veya zafer kararı vermiyor; bilgi sağlıyor, kararı oyuncuya bırakıyor. Radar hâlâ ateş gücü değil, kütle ölçüyor.

### D198 · AI Robots

AI Robots, Construction kuyruğundaki tüm bina, instrument ve satellite projelerinin süresini kısaltıyor; tek tek yapı listesi tutmuyor.

Beş seviye etkisi: **0.95 / 0.90 / 0.85 / 0.80 / 0.75**. Yard Automation gemi üretimini, AI Robots ise yapı üretimini hızlandırıyor; birbirlerinin etkisini kullanmıyorlar. AI Robots her seviyede Yard Automation'dan daha pahalı.

İndirim, üretim süresi tavanı uygulandıktan sonra uygulanıyor. `tech` hem bina hem diğer construction hesaplarında zorunlu.

Simülasyonda ARR değişmezken VFR medianı **0.087 → 0.077**'ye düştü; bu nedenle tam araştırma alan tarafından alınmadı, yalnızca Builder botu bir seviye alıyor.

İnceleme sırasında iki eski hata da düzeltildi: build satırı fiyat/timer için farklı seviyeler kullanıyordu ve Academy doğrudan tasarım tablosundan süre okuyordu.

### D197 · Üç küçük borç

**Cargo Holds:** Klan teslimatları da araştırma seviyesindeki `cargoMult`'ı kullanıyor. Böylece kişisel transfer, ticaret ve klan yardımı aynı kapasite kuralına bağlı. Ayrıca Argosy'nin klan transferinde kapasitesinin 0 görünmesine neden olan sabit taşıyıcı listesi düzeltildi.

**Kütle eşikleri:** Radarın medium/heavy eşikleri artık sabit fiyat yerine canlı `HULLS` tablosundan geliyor; böylece fiyat değişince eşikler de otomatik güncelleniyor.

**Gemi triangle ceiling:** Merchant hariç uçan gemiler için **5.000 triangle** sınırı getirildi. 11 gemi sıkıştırıldı; dokuz tanesi 4.999–5.000 aralığına geldi. Merchant ve Death Star özel kaldı.

Ayrıca Corsair ve Argosy görselleri 180° döndürülme kararından geri alındı; perspektifli renderlarda bu görüntüyü bozuyordu.

### D196 · Tier 4 tamamlandı

Tier 4'e üç gemi eklendi:

* **Corsair** — Raider/Skirmisher
* **Paladin** — Escort/Bulwark
* **Argosy** — Transport/Support

Önceden tier 4'te Bulwark'a karşı üst seviye bir karşılık yoktu ve oyuncu daha düşük tier gemisine geri dönmek zorunda kalıyordu. Yeni gemiler counter cycle'ı ve tier 4 rol çeşitliliğini tamamlıyor.

Destek gemileri de tier 4'e çıktığı için `SUPPORT_ROUND_TRIP` ve `SUPPORT_HOLD` dördüncü seviyeye ulaştı. Merchant hızı artık son transport rung'ından otomatik türetiliyor.

İki görsel düzeltme yapıldı: Corsair/Argosy yönleri ayrı ayrı düzeltildi ve transparanı kaybolmuş tier-4 görsellerinin arka planı floodfill ile temizlendi.

### D195b · Nakliye kapasitesi

`SUPPORT_HOLD`:
**[1000, 3400, 9500]**
(eski: [700, 2200, 6000])

Courier başlangıçta maliyetinden daha az taşıdığı için ilk rung oyuncuyu cezalandırıyordu. Yeni değerler kargo/verilen maliyet oranını her seviyede artırıyor.

Raidlerin taşıyabileceği ganimet sürekli olarak gemi kapasitesiyle sınırlıydı; eski değerlerde gelişim arttıkça PvP'den elde edilen pay neredeyse değişmiyordu. Yeni ladder sonrası pay gelişimle birlikte **%7.8 → %10.0 → %11.5** seviyelerine çıkıyor.

Amaç oyuncuyu boş bekletmek yerine gelişimin yeni bir PvP kapasitesi açması. Vault hâlâ bir gecelik üretimi koruyor ve savaş gemileri transportların yerini almıyor.

### D195c · Gemi satırında tier ve kapasite

Gemi adı şu biçime geliyor:

**Dart (Lv1) – 3 in 4 out**

Tier ve kapasite bilgisi isim satırına taşınıyor; class chip alt satırda kalıyor. Böylece geminin adı gereksiz yere sıkışmıyor.

### D195 · Savaş gemilerine kargo, yeni yakıt modeli

Üç karar alındı:

1. **Her savaş gemisinin kargo kapasitesi var.**
   `COMBAT_HOLD = [40, 85, 180, 380]` tier'a göre ölçekleniyor. Böylece savaş gemisiyle raid tamamen anlamsız değil, ancak ciddi ganimet için transport hâlâ gerekli.

2. **Yakıt geminin değerine ve hızına göre hesaplanıyor.**
   Tier'a özel yakıt istisnası kaldırıldı. Yakıt artık gemi değeri ve round-trip süresinden türetiliyor.

3. **Tier yükseldikçe uzmanlaşma artıyor.**
   `ROLE_SPREAD = [0.8, 1, 1.2, 1.45]`. Saldırı/zırh dağılımı daha keskin hale geliyor ancak `atk × hp` sabit kaldığı için eşit bütçe yaklaşık eşit toplam güç sağlıyor.

Eski sistemde tier 1 aşırı yakıt verimliydi ve oyuncuyu üst tier'ları üretmekten caydırıyordu. Yeni sistemde yakıt/verim eğrisi monoton hale geldi; counter cycle korunurken VFR de **0.072–0.079 → 0.083–0.102** aralığına yükseldi.

### D191 · Instrument fiyatları

`instrumentCost` tekrar instrument ID'sini kullanıyor. Böylece Telescope, Radar, Aegis ve Veil artık yanlışlıkla aynı fiyatı paylaşmıyor.

Telescope, diğer detectorlara göre **3:2** oranında daha pahalı kalıyor. Fiyat seviyesini genel olarak artırmak yerine sadece yanlış kaybolan fiyat farkı geri getirildi; çünkü tüm seviyeyi pahalılaştırmak ARR'yi düşürüyordu.

Ayrıca bunu koruması gereken testin aslında aynı anda hem "Telescope daha pahalı" hem "iki fiyat eşit" demesi nedeniyle hatayı gizlediği tespit edildi.

### D194 · Sezon değişikliğinin testlere etkisi

Sezon **30 gün ve opsiyonel bitişli** hale gelmişti. Eski testlerin çoğu 14 günlük sezonu varsaydığı için bozuldu; özelliklerin kendisi bozuk değildi.

Testler artık sezon süresini `TEST_SEASON_DAYS` üzerinden açıkça kullanıyor. Günlük oranlarla sabit gün sayısını çarpan testler düzeltildi.

İnceleme sırasında iki bağımsız hata da bulundu:

* Radar mass testi gerçek kurala göre değil, eski fiyatlara göre doğrulanıyordu.
* Combat hull'ların kargosunun sıfırlanması sonucu yalnız savaş gemisiyle yapılan raidlerin ganimeti sıfıra düşmüştü.

Sonuç olarak yeni tasarımda **bir raid gerçekten ganimet istiyorsa kargo kapasitesi getirmeli**; aksi halde boş dönebiliyor.

### D193 · Vault bir iş gününü değil, geceyi korur

`ECON.protectedShare`: **0.15 → 0.10**

Yeni `protectedHoursCap = 8`.

Amaç "uyurken kaynak güvende, işe gittiğinde bir kısmı riskte" kuralını doğrudan saat üzerinden tanımlamak. Sabit yüzde tek başına kullanıldığında yüksek Vault seviyelerinde sonunda bütün iş gününü koruyordu.

Raid sonrası hedefin üretiminin yaklaşık yarım saati alınabiliyor; daha büyük agresif loot payı, oyunu gelişim odaklı olmaktan çıkarabileceği için reddedildi.

Sonuç:

* VFR: **0.095–0.109 → 0.106–0.112**
* SV: **0.125–0.133**
* Raid: **2.74/player/day**
* ARR: **~0.22**, hâlâ açık problem.

Loot hâlâ cargo-capped; yani çok zenginleşen hedeflerden alınabilecek miktar otomatik büyümüyor. Gelecekteki kaldıraç Vault değil, cargo ladder.

### D192 · Fleet harcaması gelişime göre artar

Sabit askeri harcama oranı yerine `militaryShareAt(archetype, coreLevel)` kullanılıyor.

Gelişim ilerledikçe oyuncu daha fazla fleet harcıyor:

* erken oyun: yapı/ekonomi ağırlıklı
* orta oyun: yaklaşık **%40**
* Core 12+: yaklaşık **%50**

Değerler aşamalı değil, interpolasyonlu; böylece Core seviyesine geçildiği anda bot davranışında yapay sıçrama oluşmuyor.

Test edilen orta değerlerde **%40** kritik eşik oldu:

* %30 → VFR 0.083, düşük
* %36 → 0.089, düşük
* **%40 → 0.097, uygun**
* %44 → 0.098

Archetype eğilimi doğrudan çarpılmıyor; stage ile harmanlanıyor. Böylece Turtle gibi düşük askeri bütçeli profiller gerekli savunma gemilerini yine alabiliyor.

### D190 · Production buffer ve Vault açıklaması

`collectorHours = 10`.

On saat, gecelik üretim + küçük marj sağlıyor ve çalışan oyuncunun gün içinde kontrol etmesini anlamlı kılıyor.

Vault'un iki işi açıkça gösteriliyor:

1. Depolama kapasitesini artırmak.
2. Raid'den korunmuş miktarı belirlemek.

İki değer de **saat** cinsinden gösteriliyor. Örneğin:

* Vault 0: **16 saat depo · 2 saat korumalı**
* Vault 6: **47 saat depo · 7 saat korumalı**
* Vault 14: **105 saat depo · 16 saat korumalı**

Gezegen ekranı artık her kaynak için **stored / capacity** gösteriyor. Aynı bar içinde korunan bölüm de işaretleniyor. Böylece Vault'un yalnızca "korunan miktar" olmadığı, doğrudan depolama kapasitesini de büyüttüğü görsel olarak anlaşılıyor.

### D189 · Simülasyonda karar aralığı 10 dakika

`DECISION_MINUTES = 10`.

Önceden 2 dakikalık tick, 90 dakikalık akşam oyununu yapay biçimde 45 ayrı oturuma bölüyor ve raid sayısını şişiriyordu.

10 dakika, oyundaki en hızlı anlamlı değişimlerin altında kalırken değişiklik olmayan anlarda sahte kararlar üretmiyor.

Sonuç:

* Raid: **2.71/player/day**
* VFR: **0.095–0.109**
* SV: **0.135–0.140**
* TAX: **0.040–0.099**
* ARR: **0.217–0.221**

Suite yeşil olsa da ARR hedefin altında kaldı; artık bu değer gerçek bir ölçüm olarak kabul edilmeli.

İki olası ARR kaldıracı ölçüldü fakat uygulanmadı:

* Vault'un daha fazla üretimi koruması
* Çok pahalı instrument seviyeleri

### D188 · Aktivite archetype'lara bağlandı

Oyuncu profillerinin aktivitesi artık archetype'a göre atanıyor.

Temel profil:

* sabah 10 dk
* öğle 15 dk
* ikindi 15 dk
* akşam 90 dk
* hafta sonu 130 dk

Bunun yanında daha aktif ve daha az aktif varyantlar var.

Eski sistem oyuncu ID'sine göre rastgele takvim veriyordu; bu nedenle "Grinder" bazen Casual aktivitesi alabiliyordu ve ölçümler geçersizleşiyordu.

Yeni sistem gerçek archetype ile gerçek takvimi eşliyor.

Fakat bu değişiklik ARR'yi **0.223–0.232**'ye ve TAX'ı bazı seed'lerde hedef altına çekti. Ayrıca 2 dakikalık karar sistemi raid sayısını **6.7/player/day** gibi gerçek dışı seviyelere çıkardığı için default henüz değiştirilmedi.

### D186 · Büyük hold daha yavaş

Cargo gemileri tekrar gerçek bir hız ladder'ına sahip:

`SUPPORT_ROUND_TRIP = [17, 22, 32]`

Courier hızlı ve küçük, Atlas daha yavaş ve büyük. Merchant'ın hızı ladder'ın son seviyesinden türetiliyor.

Önceden tüm destek gemileri aynı hızdaydı; bu durumda küçük gemiler anlamsızlaşıyordu.

Ayrıca iki testin başlıkları ladder'ı savunurken gövdeleri yanlışlıkla eşit hız bekliyordu. Testler gerçek tasarıma göre düzeltildi.

### D185 · Shipyard iki farklı ürün satar

Shipyard'ın ilk **6 seviyesi** gemi tier'larını açıyor ve mevcut fiyatlama korunuyor.

6'nın üstünde yeni tier açılmadığı için Shipyard artık **throughput** satıyor. Bu seviyelerde maliyet sabit production-hour karşılığıyla ilerliyor.

Eski modelde geometrik fiyat artışı ile doğrusal throughput artışı çarpışıyordu; üst seviyeler bir sezonluk üretimin yüzlerce katına çıkıyordu.

Yeni iki aşamalı modelde:

* tier açan seviyeler gerçek ilerleme maliyeti taşıyor,
* sonrası aynı marjinal etki için aynı miktarda üretim zamanı istiyor.

Bu, kaybedilen filonun daha hızlı yeniden kurulmasını sağlıyor ve 90 dakikalık oyun oturumunda daha fazla sortie mümkün kılıyor.

### D184 · Hangar kaldırıldı

Hangar tamamen kaldırıldı.

Filo artık kapasite tavanına değil:

* gemi maliyetine,
* uçuş yakıtına,
* savaşta kayıplara

bağlı.

Yer savunması ise kapasite limitini koruyor.

Hangar'ın fiyatı geometrik büyürken sağladığı kapasite yalnızca lineer artıyordu; yüksek seviyeler sezon üretiminin katlarını maliyete çıkarıyordu. Yeniden fiyatlandırmak yerine mekanik tamamen kaldırıldı.

`bulk` artık Hangar kapasitesi değil; geminin yakıt kütlesi ve yer savunmasının yükü olarak kullanılıyor.

Bunun yan etkisi bot ekonomisinde ortaya çıktı: Hangar kalkınca bot filoya sürekli harcama yapıyor ve bazı araştırmaları artık alamıyor. Araştırma rezervi ekleme denemesi başka metrikleri bozduğu için geri alındı; bot harcama modeli ayrı bir kalibrasyon konusu olarak bırakıldı.

### D183 · On üç owner düzeltmesi

Bu geçişteki ana kararlar:

**Ekonomi**

* Trade rate: **90:30:1 → 90:45:10**
* Trade mekanizması artık bölünmeyen oranlarda da "artık bırakmadan" çalışıyor.
* Rate gösterimi tam sayılarla korunuyor.

**Fleet değeri**

* Force karşılaştırmalarında `fleetValue` yerine ateş gücünü temsil eden `combatValue` kullanılıyor.
* Böylece savaşmayan Atlas gibi transportlar fleet power'ını yapay biçimde yükseltmiyor.
* Yakıt göstergesi de bu force karşılaştırmasının yanında gösteriliyor.

**Yeni oyuncu koruması**

* Her commander için sezonun ilk **24 saati** newcomer shield var.
* Oyuncu saldırıyı başlatırsa shield kayboluyor.
* Koruma tüm dünyalarda görünür: `PROTECTED`.
* Probe görüşü bu shield'dan etkilenmiyor.

**Rivals**

* Her commander için en fazla **5 rival** tutuluyor.
* Slot oyuncunun rengini belirliyor; slot temizlenmedikçe renk değişmiyor.
* Liste doluysa yeni rival eklenemiyor.

**Mining**

* Yakın mesafe mining artık kısa bir cooldown taşıyor.
* `craftReadyAt` API'de yayınlanıyor ve oyuncuya countdown gösteriliyor.

**Pirate ETA**

* Eski ETA zaman geçtikçe belirgin biçimde sapabiliyordu.
* Launch artık `quotedMinutes` taşıyor ve fazla eski tahminleri reddediyor.

**UI ve yüzey düzeltmeleri**

* Prospector Hold üçüncü seviye UI'da doğru gösteriliyor.
* Kuyruktaki araştırmalar "Researching / In queue" olarak ifade ediliyor.
* İstenen planet tabı uygun olmayan panellerde düşürülüyor.
* Clan profili roster gösteriyor.
* Ownership bağlantıları gerektiğinde nearest-neighbour fallback kullanıyor.
* Pirate rail gücü kendi ekseninde gösteriyor.
* Academy pirate eğitimi gerçek engagement bilgisini kullanıyor.

**Temizlenen eski hatalar**
Rival kayıtları silinen commander'ların ardından kalıyor, commander başka galaxye taşındığında eski rival slotları boşa çıkmıyor, `PROTECTED` dünyalarda saldırı butonu görünmeye devam ediyor ve bazı yüzeyler rakibi world yerine commander üzerinden tutarsız çözümlüyordu. Bunların tamamı düzeltildi.

Oyuncunun kendi koruması ve kalan süresi kalıcı HUD'da gösterilir. Saldırı onayı da kalkanı düşürmenin sonucunu son kez açıklar.

Binds: `tech.ts`, combat, probes, prediction.

### D148 · Fleet V2 is an authored tiered hull catalog — OWNER INSTRUCTION

Rule: Fleet V2 replaces six old hulls with 18 fixed-profile hulls at a season boundary; no stat allocation/modules. Keep 3-round counter cycle, D8 protection and D95 shield specialization. Opening builds 2 Darts. T3/T4 need research; lower tiers keep niches. Fleet research becomes Engineering/Power/Armor/Propulsion; old fleet doctrines retire. Probe, Death Star, Prospector, Bastion, Thorn, Aegis stay outside Fleet V2 effects. No live-state translation.
Binds: Fleet/research catalogs, rollover.

### D152 · The fleet flies a quarter faster, and Propulsion doubles it — OWNER INSTRUCTION

Rule: Mobile Fleet V2 base speed = D148 ×1.25, rounded. Probe/Prospector excluded. `SHIP_PROPULSION` has 4 levels: ×1.25/1.50/1.75/2.00 and its own max-level constant. Speed changes no price, fuel, counter or D137 combat cap; Propulsion is not probe-visible combat research. Settlement claim duration re-derives from settlement fleet speed.
Binds: Hull speed, Propulsion, D111/D148.

### D153 · The disc grows every level, the fleet drinks, and the camera follows a craft out — OWNER INSTRUCTION

Rule: (1) `worldRadius` uses exact Core level: 0.44@1, 0.82@11, 1.40@top, geometric/clamped; standoffs use level. (2) Dyson starts Core 12, ring/3 levels. (3) Fuel mass=`bulk × tierMass`, tiers ×1/2/4/5; speed irrelevant. (4) Probe speed=3510; Prospector unchanged. (5) Auto-focus follows own outbound craft only, never returns.
Binds: Radius/Dyson/fuel/probe/focus.

### D154 · The galaxy states what it is looking at — OWNER INSTRUCTION

Rule: (1) The disc caption is the shard CODE alone — no "disc" label, no galaxy name — and carries two population figures: the live `SERVERS.onlineWindowMinutes` count and a `SERVERS.dayWindowMinutes` (24h) count off the same `players.lastActiveAt` index, refreshed by the existing one-minute `/api/season` read rather than by a broadcast. (2) Every drawn craft with a hull tier wears a badge under it: the family glyph (sword/shield/crate; SPECIALIST reads as sword) then one gold star per tier. It follows exact sight only — never a Radar silhouette's synthetic roster — and hulls outside the tier ladder (probe, Prospector, ground guns) wear none. (3) A posed hull's exhaust, wake and drive glow are offset by `hullPoseLift`, the same lift the hull is drawn at. (4) An active Asteroid Shower triples the local shooting-star pool for its duration; the meteors carry no information and no server cost. (5) The craft sheet states `hullBulk` as a sixth figure and the card stat block is a fixed 3×2 grid. (6) A wreck's camera subject is its own coordinates, so a void field is focusable.
Binds: Disc readout, `/api/season`, `rank.ts`/Fleets, `Meteors`, `StatStrip`, wreck focus.

### D149 · Public galaxy events are immutable seasonal moments — OWNER INSTRUCTION

Rule: Each season has a hidden deterministic public-event calendar. Asteroid Shower: 60m, ×5 new asteroid arrival only, exactly 5 starts per full Türkiye day, ≥120m gap after end; 00:00–08:00 is low-priority (target 1, max 2), not blackout. Ending affects future arrivals only. Players see active events, never future calendar/hidden coordinates.
Binds: Event scheduler, asteroids, D143.

### D161 · The three passive rates move, and the vault shrinks — OWNER INSTRUCTION

Rule: Owner instruction, two halves of one balance pass. **The rates:** alloy income ×0.90, crystal ×1.10, deuterium ×1.15, written as those factors on `ECON.alloyBase`/`crystalBase`/`deuteriumBase` so the dial that was turned stays readable. The SHAPE is untouched — same `base × L × growth^L`, same growth terms, same ladders — only the three heights. Alloy was the resource nobody ran out of while crystal gated every upgrade and deuterium, which is also fuel and therefore decides whether a session ends with something in the air, was the tightest of the three. **The vault:** `protectedHoursBase` 2 → 1.5, `protectedHoursPerVault` 0.3 → 0.2, `openingFloorAlloy` 840 → 630, answering *"yağmalanabilir miktar bir şekilde artmalı — kasa hacmini küçültsek nasıl olur?"* The vault is the right dial and the loot share is not: a wider `lootDecisive` pays the attacker more for the same fight, while a lower floor changes what is AT STAKE for the defender, which is the side of the trade the complaint is about. The protected share of a full store falls from a sixth to about a ninth at Vault 0 and from a QUARTER to under a sixth at Vault 10; the old pair grew faster than the store it sat in, so raiding got worse as a season went on. **Two forced adjacent changes, both measured:** `capHours`/`capHoursPerVault` are divided by the same 0.9, because a store denominated in hours of production shrank with alloy income while `upgradeCost` did not, and `tempo.test.ts` caught the crossing immediately — at L20 an upgrade cost 307,331 alloy against a 305,258 store, the exact failure `ECON.capHours` exists to prevent; and the reward table's crystal follows the INCOME share from ~35% to ~44%, which `rewards.test.ts` enforces against `crystalBase / alloyBase`. `ECON.crystalCostBase` deliberately did NOT follow: re-deriving it at the old 0.79 of income pushes `paybackHours(1)` from 0.98 to 1.03 and breaks the day-zero promise that the first upgrade repays inside a session, so the charged share falls to 0.65 of income — inside the 0.6–1.0 band `invariants.test.ts` holds, and on the loose side, which is the direction this pass wanted. The simulator was not re-run; these figures are not tuned against the standing D134 VFR blocker and must not be read as evidence about it.
Binds: `ECON`, storage/vault, reward table, loot exposure, D16, D61, D134, D135.

### D166 · Four merchants a day, and one of them at night — OWNER INSTRUCTION

Rule: `TRADE_SHIP` moves from three windows a day to **four**, with **exactly one inside 01:00–08:00 Türkiye time** — *"günde 4 kez … 3 aktif zamanlarda 1 gece."* The calendar's shared `lowPriorityWindow` could not express that: it is a target SHARE with a ceiling plus an `overflowWeight` coin flip, which is right for a shower nobody has to attend and wrong for a promise made to the commander who plays after midnight. So a definition may now carry its own `quietWindow` — its own hours and an EXACT count — and the shower keeps the shared heuristic untouched, including its `rng()` draw, so its stream stays byte-identical (D149). `repeatCooldownMinutes` fell 180 → 60 with the count, and it had to: the gap is `duration + cooldown`, four starts at the old 360 need all 1,440 minutes of a day, and at 240 they need 960. Two forced repairs came with it: a kind whose night opens at 01:00 leaves 00:00–01:00 outside both bands, so a season FRAGMENT landing in that hour had nowhere legal to open and failed the whole calendar — the night band stretches to cover a fragment, never a whole day; and `latestStartExclusive` is now floored, because a season's start minute can carry a fraction and `X.5 − duration + 1` admitted a start whose window ended half a minute past the season. `TRADE_SHIP.version` 1 → 2 and `MULTI_WORLD.rulesetVersion`/`tradeShipRulesetVersion` 5 → 6: a live season keeps the calendar it was dealt.
Binds: `GALAXY_EVENTS`, `galaxyEvents.ts` planner, trade lane, D149, D156.

### D156 · The merchant trades at one published rate, with no brake but the convoy — OWNER INSTRUCTION

Rule: A trade ship is a public galaxy-event kind (D149). D201 owns its current fixed schedule, D208 owns its current rate, and historical calendar definitions remain frozen. Unlike a pirate, which stays behind D123's three sensor zones, its orbital elements ARE published to every commander for the occurrence that is live right now, and only that one: it is an announced public moment, not a fogged craft — the deliberate exception to D127's default that a world's position is earned — and fog hides pre-decision knowledge, never a public live event; the future calendar never leaves the server. It swaps resources at one fixed rate — **32 alloy = 16 crystal = 1 deuterium** (`TRADE.rate = { alloy: 1, crystal: 2, deuterium: 32 }`, read as value units per resource unit) — the rounded L12 production reference selected in D208. D156's original 90:30:1 calibration is historical and no longer current; persisted occurrences retain the rate they were dealt. There is no quota, no fee and no per-world convoy limit — owner instruction: cargo capacity, a flight bay and prepaid fuel (D136) are the only brakes, and `trade_runs` deliberately carries no unique index on `(planet_id, occurrence_id)`. `quoteTrade` states `requiredHold = max(outboundVolume, returnVolume)` and `launchTrade` refuses against that figure rather than against the offer alone, because a small offer buying a large haul must fly a convoy sized for the haul home. Speed is fixed at half the Atlas's catalogue figure ÷ `TRAVEL.distanceFactor` (`TRADE.speed`), never the rock band — D155's mistake, guarded against before it could repeat: the Atlas is the slowest cargo hull in the game, so every hold leads the merchant and interception is never a lap of waiting. No combat occurs at the rendezvous and no Dominion moves. The simulator does not model this lane, so its balance may never be read against the standing D134 VFR blocker, and its numbers may not be tuned to make that gate pass.
Binds: Trade ship, galaxy event calendar, `packages/rules/src/trade.ts`, D123, D127, D134, D135, D136, D149, D150, D155.

### D158 · A pirate found once is never lost again — OWNER INSTRUCTION

Rule: Pirates are REMEMBERED like asteroids, reversing D150's refusal on the owner's instruction ("korsan filolar, asteroid gibi"). Once a commander's `sensor_epochs` history has ever contained a pirate's orbit, that pirate stays on their disc, in their `/api/pirates` list and legal to raid for the rest of its life — the rock lane's D143 discovery rule, applied to the pirate lane through the same rows and the same analytic orbit/sphere solve (`orbitDiscoveredAt`, generalised from `asteroidDiscoveredAt` so the two lanes cannot drift). The reason is D124's: a raid takes minutes to assemble against a target on a closed orbit, and an opportunity that vanishes while the commander is choosing hulls is not a decision. MEMORY IS A FLOOR, NOT A LIFT: `pirateZone` returns live `sensorZone` wherever a circle covers the pirate and only floors a discovered one at CONTACT, so the crew, the level and the `damageMult` remain live Telescope readings and the mass/silhouette remain live Radar ones — "Radar detects, Telescope identifies" is intact and no manifest is ever handed over at range. Discovery is earned at the epoch's identify reach, the same reach a rock is discovered at. Orbital elements are still never published; a remembered pirate is published exactly as a fleet is — a point and one `PIRATE.bearingMs` window. A seat-free visitor has no history and therefore no memory.
Binds: Pirates, traffic fog, `/api/pirates`, pirate raid launch guard, `sensor_epochs`, D123, D143, D150.

### D160 · A pirate you identified once stays identified — OWNER INSTRUCTION

Rule: D158's memory floor rises from CONTACT to IDENTIFIED. Owner instruction: *"görüş alanımdan çıkan korsanları ? olarak değil, görmek istiyorum. Aynı asteroidlerde olduğu gibi."* `pirateZone` now returns IDENTIFIED for any pirate this commander's `sensor_epochs` history has ever contained, wherever it is now, and falls back to live `sensorZone` only for one it has never held. THE SAFETY ARGUMENT IS THAT THE READING WAS ALREADY PAID FOR: `refreshSensorEpoch` writes the TELESCOPE radius alone into `sensor_epochs.reach`, so "discovered" has always meant "was inside an identifying circle" — D160 hands back a reading the commander bought and never sells one they did not. "Radar detects, Telescope identifies" is therefore intact: a pirate no telescope has ever held is exactly what it was, CONTACT inside a radar circle and NONE outside every circle, at every range. WHAT MEMORY IS NOT IS SIGHT, and every surface says so: `remembered` is published on both the `/api/pirates` entry and the traffic contact whenever live `sensorZone` is NONE, and the rail states it before offering the raid. THE DISC DOES NOT FADE IT (D166, owner instruction reversing that half of D160): every craft is drawn at full strength, wake and light field included, because a dimmed ship reads as a rendering fault rather than as a sentence about sight — and the numbers behind it are current anyway. THAT FLAG IS ABOUT SIGHT AND NOT ABOUT AGE: the position and the crew stay CURRENT out of range, because an orbit is a solved function of time and the roster is the lane's live state — precisely how a discovered rock keeps reporting its remaining ore to a commander with no eyes on it (D143). So another commander wearing a pirate down is visible to everyone who has found it, and D151 is not in tension with this: its subject is a WORLD record, which really is a snapshot an arriving craft took. `pirateSightZone` is the one statement of the floor, called by `pirateZone` and by `projectGalaxyTraffic` (which arrives with the lane's discovery answer precomputed and must not re-derive it), and `pirateDiscovered` is the one clamped discovery question, so the disc and the launch gate cannot disagree at the expiry boundary. Orbital elements are still never published, and the raid guard is unchanged: anything not NONE may be flown at.
Binds: Pirates, traffic fog, `/api/pirates`, pirate rail, disc rendering, D123, D124, D143, D150, D151, D158.

## Combat, intel & movement

### D6 · Clarity gradient — LOCKED

Rule: Telescope versus Veil resolves through a graded clarity model from FULL to BLIND rather than a binary visible/hidden wall. Even zero clarity is meaningful state and may represent uncertainty/staleness rather than fabricated certainty.
Binds: Telescope, Veil, intel projections, probe/watch presentation.

### D7 · Ground defence is durable — LOCKED

Rule: Ground defence survives ordinary combat according to the salvage rule instead of being a disposable one-fight resource. This durability is acceptable because Dominion, not Wealth, is the competitive score.
Evidence: Disposable defence produced roughly 95% decisive attacks; durable defence materially restored the value of scouting before committing.
Binds: Combat casualties, ground salvage, reports, simulator, Dominion.

### D8 · Support hull protection — LOCKED

Rule: Support hulls are protected while combat hulls survive and become valid casualties afterward. Escorting cargo is therefore a composition decision rather than a round-one coin flip.
Binds: Combat target ordering, Hauler/Runner, reports, simulator.

### D10 · Veil hides, never lies — LOCKED MVP

Rule: Hidden information is represented as UNKNOWN or reduced clarity, never as a fabricated normal/home state. Deception may add false information only as a separate explicit mechanic, not as a side effect of fog.
Binds: Veil, intel schemas, galaxy/focus rendering, client fallbacks.

### D11 · Combat stays simple — LOCKED

Rule: Combat resolves in three simultaneous-fire rounds with the counter cycle and bounded ±8% variance, with no mid-fight player input. Randomness may not become large enough to overwhelm information and composition.
Binds: Combat resolver, hull counter matrix, reports, simulator.

### D14 · No newcomer immunity — SUPERSEDED BY D183 AND D168

Historical rule: there was no time-based newcomer grace period or development-tier attack band. D183 now gives every commander a visible 24-hour shield that is spent when they choose to attack; D168 separately restores a commander-wide development-tier attack band.
Binds: Attack validation, anti-abuse, D127 world disclosure, onboarding expectations.

### D18 · Telescope is reach plus commitment — OWNER DECISION

Rule: Telescope is constrained by level-based watch slots, reach and a repoint commitment; filling unused capacity is distinct from switching an existing watch. Watching is silent, and no maxed Telescope may remove the entire fog layer by itself.
Binds: Telescope watch service, sensor reach, Uplink gate, D126 sensor ceiling.

### D19 · Asteroid mining is an earned race — OWNER DECISION

Rule: Asteroid state determines value; orbit is independent. Interception uses exact deterministic continuous time. First valid arrival mines up to cargo. Discovery lasts until rock ends. Mining/salvage craft use normal NONE/Radar/Telescope zones. Mining route/clock requires identified craft + discovered target; salvage may expose route because debris is public.
Binds: Mining, sensors, intercept.

### D27 · Ground defence has opposing classes — MEASURED

Rule: Ground defence must offer at least two meaningfully opposed classes; no attacking hull may hard-counter everything, every hull must remain counterable, and an entry ground option remains available at the opening Shipyard tier. The choice must be about composition, not only total defence value.
Binds: Ground hull catalog, counter matrix, combat balance, Core ground capacity.

### D28 · Flight bays are the concurrency limit — OWNER DECISION

Rule: Outbound operations consume flight bays; bay capacity derives from Core, and ownership follows the active leg's controlling world. Counting/enforcement occurs under lock, failed missions release capacity, and recovery paths must not strand a bay.
Binds: Mission launch/return, mining, probes, transfers, event recovery, Core.

### D32 · Battles create public debris — OWNER DECISION

Rule: Destroyed non-ground fleet value can create a time-limited public debris field at the battle location; ground salvage is separate. Debris contributes to Wealth when claimed but never to Dominion because it was not value transferred directly by combat scoring.
Binds: Combat settlement, debris fields, salvage/mining, Wealth, Dominion, Chronicle.

### D44 · Raid is a live engagement — OWNER INSTRUCTION

Rule: Raid reaches `arriveAt`, stays in engagement exactly 10s, then resolves; `arriveAt` never shifts. Bombardment is public. Craft intel still follows sensors: absent / Radar anonymous / Telescope identified / owner exact. Public effect alone reveals no real orbit point, bearing or mass.
Binds: Raid timing, combat, public effects.

### D45 · The game must report its actions — OWNER INSTRUCTION

Rule: Player-significant server actions emit explicit, idempotent notifications/reports with authoritative instants rather than rounded snapshots. Notification kinds and payloads are contract-tested, and unlock/report producers have one authoritative writer.
Binds: Notifications, Signals, battle/probe reports, contract tests, client routing.

### D52 · Battle is public; the clock is server-authored — OWNER INSTRUCTION

Rule: Live combat/strategic effects are galaxy-wide and derive from mission id + authoritative server time. Engagement happens even with no watching client. Public effect does not reveal craft beyond D123. Animation/countdowns use shared server-time offset; liveness work must not block event loop.
Binds: Events, server clock, traffic, worker.

### D53 · Galaxy invalidation is event-driven — OWNER INSTRUCTION

Rule: Readable galaxy changes trigger scoped SSE invalidation; slow polling is repair only. Broadcasts contain no private world/owner/position data. Mutations return changed authoritative state when practical; client predicts only provably safe constraints.
Binds: SSE, projections, cache/prediction.

### D59 · Probe scouting is explicitly rationed — OWNER DECISION

Rule: Probes are intentionally much faster than combat craft but may be launched by one commander at a given target only once per enforced cooldown window across all controlled worlds. The API exposes the next permitted instant so the client can disable the action before a refusal.
Binds: Probe launch validation, intel API, cooldown constants, UI controls.

### D72 · Realtime client state has one ownership/resync contract — ENGINEERING INVARIANT

Rule: `legBelongsTo` is the only movement-ownership test; foreign legs never enter private pending state. SSE reconnect after first connect means resync. Mutations cancel stale reads. Equal dates structurally share. Route geometry is create-once/mutate/dispose. Landing cannot coast past target; foreign bearing expiry is not own arrival.
Binds: Realtime movement/client state.

### D73 · Raids interrupt production, not the session — OWNER INSTRUCTION

Rule: DECISIVE raids disrupt Works for 15 minutes, PARTIAL raids for 5 minutes and REPELLED raids for none; the hard ceiling is 15 minutes from now. Repeated qualifying raids refresh the applicable window but never stack it, and the authoritative end is `disruptedUntil`.
Binds: Combat settlement, Works production, notifications, planet view.

### D74 · Prospector ownership is capped — OWNER INSTRUCTION

Rule: Each world may own max 2 Prospectors across all ingress/location paths. Cap is server-enforced. Prospector speed is single-sourced in rules and must keep generated asteroid field reachable.
Binds: Prospector build/transfer, asteroid solver, simulator.

### D83 · Fixed-destination arrivals are exact — LOCKED INVARIANT

Rule: Fixed-destination missions land at the continuous travel instant derived from distance and speed; countdown rounding never changes settlement time. All surfaces that refer to the same mission use the same `arriveAt`.
Binds: Travel, mission events, countdowns, reports, server clock.

### D115 · Formations draw every ship — OWNER INSTRUCTION

Rule: Fleet visualization may not omit ships to satisfy a marker cap; if large formations become expensive, optimize with instancing/sampling rather than changing represented fleet truth. Combat-effect sampling may be bounded independently from ship presence.
Binds: Fleet formations, bombardment visualization, performance work.

### D117 · Laden Prospectors return at one-third speed — OWNER INSTRUCTION

Rule: A loaded mining/salvage return leg uses one-third of normal Prospector speed, expressed in the shared `homeAt`; it is a slower visible return, not a separate cooldown. Every countdown, season-end guard and simulator read uses the same return-speed rule.
Binds: Mining/salvage settlement, Prospector timing, flight bays, simulator.

### D120 · Visual legs stay continuous — OWNER DECISION

Rule: Route clearance applies only at mission endpoints through shared surface standoff; unrelated worlds never bend or pause a leg. Server public traffic, owner interpolation and mining/salvage paths use identical endpoint definitions.
Binds: Travel geometry, public traffic, owner pending missions, mining/salvage interpolation.

### D121 · Travel is distance ÷ speed — OWNER DECISION

Rule: All ordinary craft travel uses the single exact distance/speed model with zero launch overhead; moving-target mining still solves interception but adds no artificial pre-flight delay. Travel timing is continuous and must not depend on minute rounding.
Binds: Shared travel rules, fleet/probe/mining launch, event scheduling, simulator.

### D121a · Reports explain themselves — OWNER DECISION

Rule: Reports must explain result, casualties, salvage, downtime, wreckage and relevant cargo/shield limits without exposing hidden survivors. New battle reports freeze round trace: shot rolls, Aegis before/after, post-shield attack and simultaneous-fire casualties. Legacy missing trace stays unknown, never reconstructed from current state. Every Signal has a client destination.
Binds: Reports/Signals.

### D123 · Radar detects; Telescope sight resolves the formation — OWNER INSTRUCTION

Rule: `sight.ts` owns craft zones: NONE outside sensors; CONTACT in Radar; IDENTIFIED in Telescope. Identified fleets reveal exact hulls/counts; owner, origin, destination and cargo stay hidden. Same rule during engagement/mining/salvage; no departure shroud. Public effects reveal no hidden point/bearing/mass. Mining route also needs D143 target discovery.
Binds: Traffic, galaxy, sensors.

### D125 · Blind traffic becomes unknown, not absent — OWNER INSTRUCTION

Rule: Traffic outside all sensors is absent; inside Radar it is anonymous `unknown`. `/api/galaxy` returns own Radar/Telescope spheres so client can draw them and refetch CONTACT↔IDENTIFIED crossings. A 5s traffic cadence discovers NONE→visible without advance leak.
Binds: Galaxy traffic, sensors, D124.

### D126 · Radar has two radii — OWNER DECISION

Rule: Radar has contact radius and inbound-warning radius, both position-based. They are provisionally equal (`radarContactRange === radarRange`), so D9's narrow warning is suspended until explicitly restored. Telescope is always finite; max=1600 inside galaxy radius 2000. Radar may reach farther but does not identify craft by itself.
Binds: Sensors, warnings, D125/D129.

### D127 · The map is earned, not given — OWNER INSTRUCTION

Rule: UNKNOWN shows only world position + anonymous silhouette. REMEMBERED shows newest frozen LOOK: owner, Core level, satellites, dome; D151 defines LOOK. RESOLVED shows live entitled state in Telescope reach. Memory stays frozen until another visit. Veil alters reading, not reach. No development attack band; `ABUSE.bashLimit` handles farming.
Binds: Galaxy fog/memory, attack validation.

### D129 · One gameplay sphere — OWNER DECISION

Rule: The authoritative galaxy is one sphere of radius 2000 centered at the origin, with no separate gameplay thickness; widest crossing is 4000. World placement, asteroid orbits, sensor/travel geometry and derived coordinates must stay inside and use that same sphere; scenery layers do not define gameplay coordinates.
Binds: World generation, asteroid orbit contract, travel/sensors, settlement span, 3D coordinate transforms.

### D143 · Asteroid targets are earned through local sensors — OWNER INSTRUCTION

Rule: Asteroid is discovered when its orbit enters any controlled-world sensor sphere: free reach=500, expanded by Uplink-gated Telescope. Discovery lasts until expiry/depletion, survives hardware loss and is not retroactive after upgrades. Schedule/key/index stay private; APIs use opaque ids and gate route/launch. Crossings are solved analytically; server gives exact next field-change time, not ticks. Orbit-distribution changes deploy only at season boundary.
Binds: Asteroid discovery/mining.

### D131 · Prospector cap belongs to the world; miners are not garrison — OWNER DECISION

Rule: Prospector capacity is checked at every player-controlled ingress, while overflow created by capture/reroute/system paths is legal and blocks only new ingress. Prospectors do not participate in ordinary garrison combat, but strategic Death Star destruction still reaches home miners.
Binds: Build/transfer/capture, garrison construction, combat, strategic strike, simulator.

### D133 · Hangar caps fleet; Core caps ground — OWNER INSTRUCTION

Rule: Mobile fleet uses separate Hangar capacity measured by price-derived `bulk`; ground defence uses Core capacity. Capture/survivor/reroute/Core-loss overflow is legal and never deleted, but new ingress/build must respect cap. Capacity must not create a second hand-tuned hull value axis.
Binds: Hangar/Core capacity, capture, combat.

### D136 · Every ordinary launch prepays fuel — OWNER INSTRUCTION

Rule: Ordinary missions prepay Deuterium for every planned leg at launch using fleet fuel mass × distance; speed is irrelevant. If Deuterium is cargo, origin must cover cargo+fuel together. System reroutes cost no extra; cancellation refunds no fuel. Probes, mining/salvage and Death Stars are exempt. Real/rehearsal starts include shared launch fuel.
Binds: Launch fuel, D58.

### D138 · Same type, new meaning requires a caller audit — ENGINEERING INVARIANT

Rule: If semantics change but TypeScript type does not, compiler/tests are insufficient: audit every caller. Prefer names/types that reject the old meaning and cross-surface contract tests tied to one authoritative value.
Binds: Rules API changes, server/client/sim callers, migrations.

### D139 · Strategic interception fires on Radar L3+ or Telescope sight — OWNER INSTRUCTION

Rule: Interception Grid requires effective Radar 3+. One charge destroys the first Death Star entering target's timed Radar L3+ boundary or any defender Telescope sight. Radar L1/L2 and contact-only ring never fire it. Intercept lasts 8s and is visible to participants + Telescope witnesses. Two-Death-Star stockpile preserves bait→strike; charges follow world; success creates reports/Chronicle event.
Binds: Strategic interception.

### D150 · Pirate fleets are the galaxy's third target class — OWNER INSTRUCTION

Rule: Pirates are deterministic NPC fleets on closed seeded orbits; they never attack or move Dominion. Raid needs sight, bay/fuel, frozen doctrine, max one origin-world attempt per pirate. Visibility is NONE/CONTACT/IDENTIFIED only, with no route or orbit disclosure — and, since **D158**, with discovery memory: “no memory” was this decision's rule and is no longer, though nothing else here moved. Combat modifier is attack-only `damageMult`. DECISIVE may pay survivor-cargo-capped hoard, two-sided debris and one hull drawn from the crew actually fought; mutual kill pays nothing. Persist raid + cumulative losses/destruction; seed `pirate_state` before `FOR UPDATE` so first-hit concurrency is safe. Void debris owns `x/y/z`; returns follow commander via safe home, not origin ownership. Engagement uses shared `ENGAGEMENT_STANDOFF=2.2`; pirate reports omit world/Aegis fiction and include `damageMult` + captured hull. Commander ownership, not the origin pad, decides which mission strip draws a raid and whose own-craft exclusion hides it. A live engagement publishes its flash at any range as one `effectOnly` row per side, carrying the rendezvous and never the attacker's hold, while craft visibility stays on the three zones. Committing a fleet at a pirate uses `LaunchSheet`, the same surface a world raid uses; the rail only describes and offers. The outbound leg stays server-solved per hull and the two legs are summed rather than doubled.
Binds: Pirates, combat, debris, returns, reports, traffic fog, launch surface, D158.

### D151 · A fleet is eyes — OWNER INSTRUCTION

Rule: REMEMBERED is the last time observer had a craft at that world, not probe-only memory. Raid/neutral battle/strategic strike/settlement arrivals write `silhouetteOf`; transfer/clan-transfer do not. Memory stays frozen, visitor-only, newest-look wins and keeps `seenAt`. Battle visits never infer probe-only doctrine/interceptor data. `rememberWorld` is the single writer and publishes private-memory invalidation; record age uses one shared calculation.
Binds: World memory, D127.

### D155 · A pirate is chased at fleet speed, and the meeting point is drawn — OWNER INSTRUCTION

Rule (speed figures superseded by D203; the derived-band and geometry rules stand): `PIRATE.speedMin/Max` are derived from the hull table and divided by `TRAVEL.distanceFactor`. D155 used a Cataclysm's full pace through a Dart's full pace, so every Skirmisher outran every pirate and a heavy line could not lead one. The old 200–420 band was measured against rock speed, but a rock is chased by a Prospector and a pirate is chased by a warship: on one scale it was 240–504, faster than every ship in the game, so `interceptOrbit`'s earliest meeting was the far side of the orbit after a lap of waiting rather than a lead. `pirates.test.ts` asserts both anchors against `HULLS` and holds the median lead under a quarter revolution, the ceiling the rock lane has carried since D40/D121. `/api/pirates` publishes each `reach` row's rendezvous point; it is `distance` and `minutes` stated rather than implied, for a pirate in current sight from a world the caller owns, and the orbital elements stay server-private. The disc draws every open-space aim point through one list (`rendezvousMarks`): a mining interception, an outbound raid's rendezvous, and — while the launch sheet is open — where the selected wing would meet it. Marks never survive the sheet that proposed them, and never mark a target that is an address.
Binds: Pirate lane geometry, `/api/pirates`, launch sheet, disc marks, D40, D124, D142, D150.

Correction (2026-09-07): the shared solver's 12-second scan could miss an entire
reachable close pass: a Citadel meeting a nearby pirate in 4.7 seconds was sent
44.78 minutes away; a Prospector's 0.16-second meeting became 1.89 minutes.
`interceptOrbit` now takes orbit elements internally and partitions the squared
reach equation at every extremum, derived from its analytic second derivative,
before solving the earliest meeting. Pirate elements remain server-private. The
merchant callers change with the shared signature so preview and launch keep one
solver. `orbit-interception.test.ts` covers both missed passes, tilted late-season
orbits, tangencies/near misses, coincidence and expiry. Speed, return rules and
already committed missions are unchanged.

## World, season & social

### D21 · Account identity and seasonal placement — OWNER DECISION

Rule: Authentication is username/password with lowercase uniqueness and scrypt; email/recovery are not part of the account model. One account has one seasonal commander in one galaxy; that commander owns a capital and may own colonies under D97, while admission/capacity are governed by D99–D100.
Binds: Auth, account/player schema, season placement, server admission.

### D60 · Population is a live aggregate — OWNER INSTRUCTION

Rule: `/api/season` carries the public online count using the same presence window as server selection; it is refreshed independently of shard gameplay invalidations because presence has no single publishable event. Presence writes are rate-limited so aggregate freshness does not create a shard-event storm.
Binds: Season API, presence tracking, server list, galaxy HUD.

### D68 · Returning devices lead with sign-in — OWNER DECISION

Rule: Signing out opens sign-in. A device-local returning hint puts sign-in first on the front door, with an equally visible training control for a new person sharing that device (onboarding review §3). The hint never authorizes or blocks anything; both sign-in and rehearsal remain reachable and the server remains the sole authority on account/placement.
Binds: Front door, logout, returning-device hint, onboarding routing.

### D69 · Camera moves only on instruction — OWNER DECISION

Rule: Camera reframing is keyed to stable focus identity, not live-query array churn; losing a followed subject releases free-look at the current pose instead of recentering. World changes may never move the camera without an explicit user instruction/focus change.
Binds: Galaxy camera/follow logic, focus identity, live refetch behavior.

### D70 · Three inactive days returns the seasonal seat — OWNER INSTRUCTION

Rule: After three days of inactivity the seasonal presence may be reclaimed while the account/lifetime record survives and can rejoin later. Reclaim is forbidden while any airborne/reference state names the world, re-checks activity under row lock, isolates each cleanup transaction and must never stop the event worker.
Binds: Inactivity housekeeping, account lifetime, mission FKs, season placement, `/health`.

### D75 · Account display name is commander identity — OWNER INSTRUCTION

Rule: `accounts.displayName` is the canonical visible person identity; seasonal/player/world names are context, not alternate public identities. Identity may only be joined into a projection after that projection's fog rules already entitle the viewer to know the commander.
Binds: Galaxy labels, reports, notifications, leaderboard, intel projections.

### D76 · Dominion ladder ranks the local galaxy — OWNER INSTRUCTION

Rule: Leaderboard contains every current competition-eligible commander in the caller's galaxy,
independent of the shard's admission cap, sorted by exact integer Dominion with deterministic ties.
Operator accounts are absent even to themselves. D127 controls capital intel: current
sight=current identity/tier; REMEMBERED=frozen tier; UNKNOWN=no capital identity/tier. UNKNOWN
commander click warns and never moves camera.
Binds: Leaderboard, Dominion, D127.

### D77 · Galaxy chat is seasonal and server-authored — OWNER INSTRUCTION

Rule: Chat is scoped to one season, author identity and timestamp are server-authored, reads are cursor-paginated, writes are transactionally rate-limited and unread state counts only other commanders after the durable read marker. Realtime events announce only that the scoped chat projection changed and reveal no message payload publicly.
Binds: Chat tables/API, season wipe, SSE, unread badge, identity.

### D85 · Season freeze is atomic and permanent — FRONTIER PREREQUISITE

Rule: Season freeze locks season then planet, refuses while flight/mining remains unresolved, then blocks all world mutations while galaxy stays readable. Final results are immutable account records using live-ladder ordering and survive deletion of seasonal rows.
Binds: Season end, locks, `season_results`.

### D86 · Season ending is a story, not a claim — OWNER DECISION

Rule: Frozen season shows server-authored recap over readable final galaxy. Closing is acknowledgement, never reward claim. “Explore final galaxy” exists only during 5-minute frozen afterglow; historical recap over a live successor only closes. Recap grants no resources/research/unlocks/power and remains in history.
Binds: Season recap/history.

### D87 · Latest season record crosses the wipe — OWNER DECISION

Rule: `/api/auth/me` includes the account's newest season result even when no seasonal planet exists, so login can route correctly across rollover/reclaim in one authoritative read. Only the latest result is part of session bootstrap; a full archive is a separate history surface.
Binds: Auth/session payload, season results, rollover, server selection.

### D88 · Five-minute afterglow; one atomic rollover — OWNER DECISION

Rule: A season remains frozen/readable for five minutes after `endsAt`, then rollover folds lifetime state, marks old seasons wiped, deletes seasonal world state, creates successors and schedules their lifecycle inside one transaction. Clients react to a minimal rollover invalidation by reopening authoritative session state.
Binds: Season events, rollover transaction, account lifetime, SSE, CLI wipe.

### D96 · Chronicle records only public transitions — OWNER DECISION

Rule: Chronicle is an idempotent season feed of public transitions only; it may snapshot only facts that are already legitimately public at the event moment and never private research, probes, cargo, hidden composition or loot. Natural clock-derived decay does not need synthetic history rows.
Binds: Chronicle writers, combat/mining/season transitions, SSE, D127 disclosure.

### D97 · One capital and up to three colonies — OWNER INSTRUCTION

Rule: Each seasonal commander has 1 uncapturable CAPITAL + up to 3 COLONIES; colony cap derives from highest controlled Core and never shrinks retroactively. Neutrals require combat + public settlement race. Same-owner transfer moves ships/resources, never ground defence, and is one-way. If destination ownership/capacity changes in flight, reroute home and notify.
Binds: Ownership, colonies, transfers.

### D99 · A galaxy admits 300 commanders — OWNER INSTRUCTION

Rule: New production seasons use a 300-commander stored capacity and deterministic neutral supply sized for that topology; existing seasons keep the capacity they were created with. 300-seat admission is allowed only after the production HTTP/SSE/worker/mobile/soak certification defined in deployment testing passes.
Binds: Season bootstrap, admission, world generation, load certification, deployment docs.

### D100 · Production opens at most two galaxies — OWNER INSTRUCTION

Rule: Production exposes at most two current 300-seat galaxies and fills them strictly by ordinal; the second opens admission only after the first is full. Older higher-ordinal rows may remain for referenced history but are not selectable/admissible production worlds.
Binds: Server selection, admission, bootstrap/rollover, historical shard rows.

### D102 · Isotope concentration is deterministic — OWNER INSTRUCTION

Rule: Isotope eligibility is deterministic, currently 11/50 indexes (22% after D204; formerly 11/90). Concentration is separate deterministic whole-percent 10–25% from season seed + asteroid index and consumes no shared galaxy RNG. Deuterium replaces Alloy; total ore unchanged. Changing concentration must not alter isotope cadence or D110 arrival cadence.
Binds: Asteroids, mining, simulator.

### D103 · The Rival mark is free to move — OWNER INSTRUCTION

Rule: A Rival may be marked, cleared by a second press of the same control, and re-marked at any time. Nothing commits it: the first shared probe, battle or strike between the pair used to freeze the choice for the season, and that lock is retired — players disliked it and the mark is a bookmark, not a contract. Encounter history (battles, strategic impacts with their idempotent value/damage record, probe readings) is still recorded and still feeds reports, the dossier and the recap; nothing reads it to refuse a change.
Binds: Rival service, `/api/rival`, planet focus control, season payload.

### D105 · Strategic impacts remain reconstructible during the public effect — OWNER DECISION

Rule: Death Star impact is a server-clock public event keyed by mission identity; after resolution the anonymous contact persists for the bounded impact-effect window so reconnecting/restored clients can reconstruct the same effect. Public reconstruction never reveals owner/origin and ends at the strict effect boundary.
Binds: Strategic traffic, SSE/resync, client effects, server clock.

### D110 · Asteroid arrival increases without moving the old field — OWNER INSTRUCTION

Rule: Asteroid supply is increased by 15% through a second deterministic arrival lane while the original deterministic lane remains unchanged. Balance edits to supply must not move/delete targets that would otherwise have existed.
Binds: Asteroid generator, season seed/indexing, simulator.

### D111 · Claim duration derives from the widest settlement flight — OWNER DECISION

Rule: Neutral claim duration = rounded-up maximum valid settlement flight across `GALAXY_SPAN`, derived from settlement fleet speed/geometry, never hard-coded. Geometry or travel-speed changes automatically change the window so every valid capital can compete.
Binds: Settlement claim, travel/geometry, simulator.

### D112 · Expired claim windows reopen; live windows never extend — OWNER INSTRUCTION

Rule: A decisive conventional raid opens a neutral claim window only when none exists or the previous one expired. Repeated raids cannot extend an active window; each window remains public and first atomically valid settlement wins.
Binds: Neutral combat, claim state, settlement validation, simulator.

### D113 · Death Star is the authoritative strategic strike — OWNER INSTRUCTION

Rule: Death Star needs Core 12; craft also Shipyard 5 and 60m build. Hit destroys home ships/ground, halves stored+Works, Core-1, Aegis-2, clears shield, cancels BUILDING queue without refund, recovery=2h; away craft/research/orbit survive. Core loss clamps buildings to `CORE_CEILING`. Capture only if launch-stamped against recovering neutral/colony with reserved cap; never capitals. Funded research stays with buyer.
Binds: Strategic strike.

### D167 · A Death Star loses a world for somebody; it never takes one — OWNER INSTRUCTION

Rule: The strategic weapon stops being an acquisition and becomes a deadline. D98/D105/D113's second-strike capture is retired outright: `deathStarCapture`, the colony-slot reservation at launch and `RECOVERY_WINDOW_TOO_SHORT` are all gone, and no impact ever calls `transferPlanetControl`. What a strike does instead is darken the target for the WORLD'S OWN window — `recoveryMinutesFor`, two hours for a capital (unchanged since D113) and **eight for a colony** — and `endRecovery` becomes a verdict rather than housekeeping: a colony whose commander landed no ship inside that window is handed to `releasePlanetControl`, which clears the controller, restores `kind: NEUTRAL` and writes a `neutral_planet_state` row with `claimUntil` NULL, so it is open to any settler AT ONCE with no claim race. **Buildings, satellites, research and whatever stock the strike left are untouched** — the world changes hands, not shape, and whoever settles it inherits what is standing (owner call). A CAPITAL IS NEVER RELEASED: "capitals cannot be captured" is a locked constraint and a long enough outage would be that rule reinterpreted rather than kept. The answer is `planets.recovery_relief_at`, stamped by a transfer arrival carrying craft while the window is open and CLEARED BY EVERY STRIKE, so a commander who saved a colony an hour ago must save it again — the owner's shape in as many words. Recovery still blocks attacks (`WORLD_RECOVERING`) and still permits transfers IN (`launchTransfer` guards only the origin), which is what makes the deadline answerable. `DEATH_STAR.cost` rises to 40,000 / 25,000 / 6,000 and is written by hand rather than through `scalePrice`: the weapon is priced against what it does, and what it now does is put somebody else's colony on the table for the whole galaxy. Consequence accepted at decision time: the attacker pays 71,000 and opens a world they do not own, garrison and half-stock intact, to whoever reaches it first.
Binds: `strategic.ts`, `endRecovery`, `releasePlanetControl`, `movement.ts` transfer arrival, `planets.recovery_relief_at`, focus-rail strike guide, D98, D105, D106, D113.

### D114 · Clans stay a thin seasonal coordination layer — OWNER INSTRUCTION

Rule: Clan is seasonal, same-galaxy, max 5. Members share identity/worlds, chat and friendly-fire protection; sensors/intel stay private. No shared radar, buffs, clan tech/treasury or cross-season power. Aid/share/history mature after configured delay; leaving applies ceasefire/join limits. Resource aid deposits then ships return; empty convoy gifts ships. Arrival revalidates membership/control/allowance; quotes expose allowance/expiry only. Battle/report clan identity freezes at launch; anti-abuse quota may rebind only inside its live window. Private SSE sends invalidation only.
Binds: Clans, aid, anti-abuse, privacy.

### D159 · The server plays commanders of its own — OWNER INSTRUCTION

Rule: A live galaxy with three hundred seats and five to ten people reads as abandoned, and the missing thing is MOVEMENT rather than a number — D154's 24-hour figure already answers "is this alive" and did not fix it. So the server seats `BOTS.perGalaxy` commanders (12) in every live galaxy: ordinary `accounts` + `players` + capital worlds, acting only through the services a phone calls, with `expectedPlayerId` supplied, so no bay, queue depth, fuel bill, bash limit or lock ordering can be bypassed. **The owner types every name** (`pnpm bots add`); nothing generates one and a short roster is a logged warning, never an invented commander — a "Bot-07" beside a real name ends the illusion in one glance. They never chat, never join a clan, never claim a reward, never build a Death Star and never settle a colony: every one of those is a surface where a script is noticed, and none of them puts a craft in the sky. Presence is the same column everything else reads: an awake bot's `players.lastActiveAt` is stamped by the sweep, so `/api/season` and `/api/servers` count them without one line changing on the web side. A Türkiye shift roster (`BOTS.awakeByLocalHour`, off the pinned `GALAXY_EVENTS.calendar.utcOffsetMinutes`) keeps 01:00–08:00 a BLACKOUT and holds 4–12 awake at every other minute — both structural: the count for a slot IS the curve, and the edge jitter may only ever add a commander to a minute. Restraint towards people lives in the bot and not in the rules, because D127 deliberately left only `bashLimit`: a raid needs a world record no older than `BOTS.recordFreshMinutes` (D151's definition, so the fog binds the server's own commanders and a bot with nothing to go on spends its flight on a probe), a commander inside `newPlayerGraceHours` is not a target, nor is one more than `playerCoreFloorGap` Core levels below, and `playerRaidsPerDay` caps repeats; bot-held worlds carry `botTargetBias` so most of the violence stays between them. "Exempt from rewards" needs no code — every reward is claimed and none of them opens that screen — and `BOTS.coreCeiling` is what keeps them off the podium. Driven by a fixed-cadence sweep inside the worker tick beside `reclaimIdleSeats`, on its own clock and its own `try/catch`, with NO new `event_kind`: a missed turn costs one commander one upgrade, and housekeeping may never stop the event queue. `BOTS.turnsPerSweep` is a latency budget rather than a rate: at rest the roster produces under one due turn a minute, but a cold start has every commander due at once and `WORKER_POLL_MS` is one second because visible timing matters (D52) — a tick that stops to play twelve sessions is a tick during which nobody's raid lands. `BOTS_ENABLED` is off by default and read only by `ROLE=worker|both`. `reclaim.ts` is untouched: a bot that goes quiet for three days is reclaimed like anybody else, and `ensureBotSeats` puts it back when the system returns.
Binds: `apps/server/src/services/bots/*`, `bot_profiles`, worker tick, presence/population figures, D21, D53, D124, D127, D151, D154.

## Interface authority that changes gameplay understanding

### D140 · Research is commander-wide and has its own surface — OWNER INSTRUCTION

Rule: Research has a commander-level surface with the single commander-wide active slot, groups Frontier/Industry/Doctrine/Strategic, and shows absolute finish time for long work. Max level is last effectful rung. Dependency links route here, not to a planet tab.
Binds: Research UI, D134/D137.

### D162 · A warning you can see is a warning you can look at — OWNER REPORT

Rule: An inbound raid warning names the CONTACT it is about, so the mission strip can focus the craft the disc is already drawing. Owner report: *"görüş alanımda da olsa, radar alanımda da olsa… alttaki radar'da gelen uyarıya tıklayınca focus olmalı. Çünkü bana neyin geldiği söyleniyor zaten."* The strip's only handle on a craft was `path`, which a defender is deliberately never given (D123), so the one row a commander most wants to look at did nothing when pressed. `PendingThread.contactId` is the mission uuid — the same key `/api/galaxy/traffic` already publishes for that craft, on a payload that already flags which contact is coming for the caller — so it discloses no new fact and only JOINS two rows the client was handed separately. THE FOG STAYS IN THE CONTACT QUERY: where no circle covers the craft there is no contact carrying that id, the row offers no focus, and nothing about origin, heading or route is added at any radar level. The detail line follows the same rule — it reads the roster or mass off the contact the caller can already see, and only says the origin is behind fog when the craft itself is unseen.
Binds: `pendingThreads`, mission strip, galaxy focus, D9, D53, D123, D126.

### D163 · The planet glyph is the camera move; the transfer gets its own mark — OWNER INSTRUCTION

Rule: The disc's control grid grows to five marks and the planet glyph changes job. It used to open the worlds sheet while "zoom in on the active planet" was a TEXT BUTTON inside that sheet — two taps and a read for the most frequent camera move in the game, behind a glyph that already looked exactly like it. The planet mark now performs that move directly (clear focus, focus the active world, raise the home signal) and opens nothing; the sheet it used to open is reached by a new transfer mark, and the four original marks keep their positions because a control that moves between sessions has to be re-found every time. Inside the sheet the transfer is one sentence: two dropdowns reading `from → to` and a single commit button, replacing a segmented source picker at the top plus one of three identical "send here" buttons further down — the two halves of one decision separated by three world rows, with nothing on screen saying they were the same decision. The destination list excludes the source, because the server refuses `SELF_TRANSFER` and an option that always fails teaches a rule wrongly. The world list keeps its own tap (go there: camera and active world together) and the sheet no longer moves the camera on its own.
Binds: `DiscControls`, `WorldsPanel`, `GalaxyView`, D118, D142, and the compact-design directive.

### D164 · A defender is shown the whole force that arrived — OWNER INSTRUCTION

Rule: A battle report hands the DEFENDER the attacker's complete committed roster (`theirFleet`, read from the already-stored `battle_reports.attacker_fleet`), not just the wreckage. Owner instruction: *"hiç ateş etmemiş olsalar bile saldıranın geldiği tüm filoyu savunan raporunda görebilmeli."* D121's rule that a report states losses and never survivors held one thing back that was never fog: the hulls that arrived and did not shoot. A Courier has `atk: 0`, joins no firing line and usually flies home whole, so a commander could be robbed by a convoy and read a report the convoy did not appear in — the wreckage is a floor on a force, and it omits by construction exactly the hulls a defender most needs to have seen. IT CROSSES NO LINE BECAUSE THIS FLEET WAS IN FRONT OF THEM: it spent its engagement in orbit over the reader's own world, and D151 already lets an arriving fleet rewrite the visitor's world record for the same reason. ONE DIRECTION ONLY: what was standing at the target is a probe's product (D127), so an attacker's copy of the field is `{}` and their side of the sheet keeps D121a's floor/complete framing. The defender's section is replaced rather than softened — "at least this much" is a claim about a bounded reading and this reading has no bound — and it draws the same `SurvivorBar` the reader's own force draws, with the colours inverted (`side="theirs"`): the survivors are a squadron flying home with your ore and carry the threat hue, what the defence destroyed carries the gain hue. A report written before the roster was stored carries an empty one and falls back to the wreckage.
Binds: `readBattleReports`, battle report sheet, `SurvivorBar`, D120, D121, D121a, D127, D151.

### D165 · A wing is packed by its own footprint and ordered by weight — OWNER REPORT

Rule: `formationLayout` spends the room a squadron occupies by FOOTPRINT rather than by count, and places the heaviest hull at the point. Owner report, against a wing of one capital and nineteen Darts: *"aralarında saçma salak gereksiz boşluklar var."* Every slot used to sit on one grid whose spacing was the largest hull in the formation × `FORMATION_SPACING`, which was nearly free while the authored sizes ran 0.84–1.38 and became the picture the moment size was re-authored as a hull's TIER (0.7 · 1.25 · 1.85 · 3.0, a 4.3× spread): a Dart then sat alone in a hole three of its own lengths across, and the more mixed a fleet the emptier it looked. The spiral's radius now advances with `sqrt` of the room already spent — one unit per craft reproduces the old arrangement exactly, so a single-hull wing is untouched at the spacing it was tuned at — and each craft spends `(size / largest) ** FOOTPRINT_EXPONENT`, with the exponent at 1.6 rather than a strict area's 2 because heaviest-first puts a capital's spiral neighbours among the small craft behind it, and at a strict share those advance the radius too slowly to clear it. 1.6 is where a mixed wing's tightest pair returns to exactly the clearance a single-hull wing already has; the test measures both and compares them rather than trusting the constant. Measured over 400 mixed fleets the formation's extent falls from 13.3 to 8.1 spacings. THE SLOT LIST STAYS IN THE CALLER'S ORDER — pips, drive lights, rank badges and a volley all index it against the marker list. A hull's drawn size is its tier and the ordering is the rule the tests state: no hull is ever drawn smaller than a hull of a lower tier.
Binds: `formationLayout`, `slotAt`, `FLEET_V2_ASSET_MANIFEST` scales, squadron rendering, D20, D40, D115, D123.

### D168 · The development band returns at ±1 tier, measured on the commander — OWNER INSTRUCTION

Rule: A raid is refused unless the two COMMANDERS' development tiers are at most `ABUSE.tierBand` (1) apart — inclusive of your own, so tier 3 reaches 2, 3 and 4. Each side is measured on the tallest Command Core it holds anywhere (`peakCoreLevels`), never on the world the fleet leaves from or the world it is aimed at. Owner instruction: *"Sadece en fazla 1 level üstüne veya altına savaşabilirsin. Gezegen'den çıkan filoya bakılmayacak. User bazında bakılacak."* THE FLOOR TIER FIGHTS ITS OWN — the owner confirmed `|a - b| <= 1` with no special case at the bottom, so a season that opens with everybody at tier 1 still opens with PvP; a tier that could not fight itself would also be asymmetric, since tier 2 may hit tier 1. WHY THE COMMANDER AND NOT THE PLANET: a planet-measured band is bought off with a colony — settle a world, leave its Core at 1, and a finished commander has a legal pad aimed at every beginner in reach while the beginner reads a tier 1 world and sees a fair fight. The commander is the thing being matched, so the commander is what is measured; the same reading protects a large commander's small colony from a raid its owner could not answer in kind. THIS REVERSES D127, WHICH REMOVED THE ±2 BAND, and it inherits D127's cost rather than refuting it: development is private (D127) and peak development is not published at all, so this is a rule the player cannot fully check before committing. Three things hold that cost down. The refusal is raised BEFORE anything is spent — ahead of `prepareClanAttack`, so no fuel is debited, no bay taken, no clan or bash lock acquired — it carries its own code rather than a generic no — TWO codes, because the band has two sides and one sentence cannot serve both: `TIER_BAND` for a target too far above (*"Bu komutanın toplam gücü senden fazla yüksek"*) and `TIER_BAND_WEAK` for one too far below, since telling a commander who aimed at a beginner that the beginner outweighs them is false and sends them to fix the wrong thing — and it outranks `BASH_LIMIT` in the refusal order, because telling a player to wait out a twelve-hour window that will not make the fight legal sends them away and back for the same answer. `withinTierBand` is the single statement of the arithmetic, read by the gate and by `raidCandidates` so the server's own commanders never offer themselves a target the gate would refuse. Bots keep their own manners (newcomer grace, `playerCoreFloorGap`, `playerRaidsPerDay`) on top of it. UNCHANGED: pirate raids (D150 — no `canAttack`, no bash limit), Death Star strikes, transfers, clan aid and settlement, and neutral worlds, which have no commander to measure. STILL OWED, and the reason D124 is only half satisfied: no surface yet states a commander's peak tier or marks an out-of-band world before the launch sheet is opened. Until it does, the band is legible only in the refusal.
Binds: `canAttack`, `withinTierBand`, `ABUSE.tierBand`, `peakCoreLevels`, `launchAttack`, `raidCandidates`, D14, D49, D124, D127, D150.

### D170 · The player owns the resolution; the disc owns its own size — OWNER REPORT

Rule: Players reported the phone getting hot, so the device pixel ratio becomes a player-facing control and everything on the disc is re-sized on the owner's eye. THE HEAT IS PER PIXEL, NOT PER OBJECT. The D90 baseline is 31 draw calls and 3,154 triangles, which is nothing for any supported phone; the cost is a multisampled half-float scene target, a luminance pass, a mipmap chain and a composite, and every one of them scales with the SQUARE of the ratio. So `lib/quality.ts` is three rungs — `high` 2.0, `balanced` 1.5, `low` 1.0 — stored per device beside the music switch, offered in the menu, and passed to the Canvas as a CLAMP (`[1, cap]`) so a preset can only ever lower what a screen already asks for and never supersample a desktop. **`balanced` is the new default**, measured at 585×1141 against 780×1688: 44% of every per-pixel cost, gone. The composer is KEYED on the cap, because `EffectComposer` re-sizes on the CSS box while `postprocessing` multiplies by the pixel ratio at that moment — a ratio change moves no dependency, so without the key the scene renders into buffers built for the old ratio and the picture comes out scaled and cropped rather than merely slower. WHAT IS NOT A DIAL: bloom, because everything bright is drawn additively on the assumption bloom does the last step, and because it is a blur over exactly the high-contrast pixels that alias when resolution drops — turning it off would spend the saving twice; and draw distance, which removes the part that is already free and hides the information the intel game is played with (D124). MULTISAMPLING WENT UP RATHER THAN DOWN, to 4/4/2. The owner's report after the first drop was that a rock's tail and the hairline on a world's limb came apart into steps: both are thin GEOMETRY under one pixel of coverage, which is the one thing multisampling fixes and the one thing a post-process pass would fix only by softening the whole picture. TONE MAPPING WAS TRIED AND REVERTED. `onCreated` carried a `gl.toneMapping = ACESFilmicToneMapping` that never ran — the composer forces `NoToneMapping` while mounted — so the shipped image has never had a mapping; adding a real one darkened the background galaxy and the central dust cloud out of the frame, because every colour in `galaxy/` was authored by eye against a linear passthrough and a filmic toe takes the faint end first. A mapping goes in with a re-grade of those values or not at all; the dead line is deleted so nobody reads it as already in force. THE SIZES, each through ONE factor so the ladders keep their shape: worlds ×1.25 (`WEIGHT_SCALE`, the dial D166's docblock promised), craft ×2 (`CRAFT_SCALE` 0.8 → 1.6, which carries the probe, the drill, the strategic weapon and — as a stated fraction of it — the merchant, because doubling only the two classes named would have drawn the Death Star smaller than an ordinary squadron), and rocks ×1.5 (`ASTEROID_SCALE`, doubled first and taken back a quarter on a second look). THE ROCKS NOW CROSS A LINE THAT USED TO HOLD: the richest rock draws about 6% larger than a Core-1 world, so `scene.ts`'s old promise that a rock is "well under two thirds of the smallest world" is gone and recorded as gone; a newcomer's world is the only one affected and Core 4 up still clears every rock. AND AN UNREAD WORLD WAS TOO DARK TO FIND — its dimming compounds three times (stance × `UNRESOLVED_BODY_LIGHT` × `HIDDEN_PLANET_BRIGHTNESS`), landing a `dark` world near a twelfth of full brightness while its own warm limb sat four times higher and read as a rim around nothing. The middle factor moves 0.22 → 0.35; the world reaches an eighth of a world under live sight, so ignorance is still plainly darkness, and nothing new is revealed because the silhouette was already public (D123/D127).
Binds: `lib/quality.ts`, `GalaxyCanvas` dpr/multisampling/composer key, `MenuPanel`, `WEIGHT_SCALE`, `CRAFT_SCALE`, `ASTEROID_SCALE`, `UNRESOLVED_BODY_LIGHT`, `docs/visual-quality.md` counters, D49, D53, D123, D124, D126, D127, D153, D165, D166.

### D173 · An Aegis covers defenders; it cannot become the defender — OWNER INSTRUCTION

Rule: A player world with zero combat hulls and zero ground guns is an undefended walkover even when an Aegis is installed and charged. Owner instruction after Yasin's production raid: *"Sıfır kişi varsa bu WIN sayılır ve yağmalanabilir kaynakları almaları lazım."* The resolver runs zero rounds, grades the raid DECISIVE, leaves the idle shield charge untouched and sends the ordinary decisive loot home subject to the attacker's cargo capacity. Prospectors remain outside the garrison and survive the raid, but they do not prevent the walkover. Nullifier's D95 shield-only bonus still applies when an Aegis covers an actual defending line; with no line there is no combat and no shot. This supersedes the earlier bare-Aegis ruling recorded in the battle-report analysis.
Binds: `resolveCombat`, player-raid settlement, Aegis, Nullifier, Prospector, loot, battle reports, D8, D95, D121.

### D205 · The Academy follows the live menu, and obsolete Hangar bulk stays hidden — OWNER INSTRUCTION

Rule: The Vault belongs to Production, so its Academy build and reward lessons run after Foundry and before the Intel introduction; Defend begins with Aegis. Academy tab routing derives its boundaries from the authored menu-introduction steps rather than fixed numeric offsets, and a locally saved checkpoint from the prior order is rejected instead of being reinterpreted as another lesson. In the Telescope exercise, the three demonstration worlds remain visible for one second before the lesson advances; the former five-second hold is removed. D184 removed the mobile-fleet Hangar ceiling, so a mobile hull's legacy `hullBulk` is hidden from its Fleet craft sheet; fixed ground emplacements retain bulk because they still consume real ground capacity. This supersedes D154(5) for mobile hull sheets only.
Binds: `ACADEMY_STEPS`, `academyGroup`, Academy Telescope timing/storage, Fleet `BuildSheet`, D154, D172, D184.

### D206 · Strategic crafting is temporarily hidden behind one release switch — OWNER INSTRUCTION

Rule: Death Star crafting and the anti-strategic battery are temporarily unavailable without deleting their implementation. `FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED = false` is the single reopening switch. While false, the two planet-menu surfaces stay mounted but carry `display: none`; the two direct permission rows (`DEATH_STAR_PROTOCOL` and `INTERCEPTION_GRID`) do the same in Research. `GRAVITIC_CHARGES` remains visible because it also unlocks the Nullifier, and `STRATEGIC_STOCKPILE` remains authored as the separate capacity project. Authenticated POSTs to the Death Star and interceptor build routes return the same `STRATEGIC_UNAVAILABLE` 404 before body, ownership, prerequisite or resource evaluation. Existing launch/resolution state is not deleted and the Death Star launch route is unchanged, so reopening does not require data repair.
Binds: `FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED`, Death Star forge, interceptor battery, ResearchPanel, strategic build routes.

### D207 · The Escort is the faster Bulwark — OWNER INSTRUCTION

Rule: `profileHull` read a combat hull's round trip off its CLASS alone (Skirmisher 15 / Lance 20 / Bulwark 25 minutes), so every Escort flew at its tier's Fortress pace (121) while being the smaller hull — the "trades part of the fortress hull for speed" half of D148 was dead. Owner: *"Evet escort hızlanmalı"*, then *"Biraz daha hızlandırsak yanlış mı olur?"*. The Escort now flies `ESCORT_ROUND_TRIP` = **18 minutes (~168)**: quicker than a Striker, still below the Raider (speed is that line's identity); the Fortress stays at 25. The same trip tilts D195's hold down and fuel up (Warden 50→36 cargo, 4→6 fuel; Paladin 475→342, 59→82). Prices, attack and armour are unchanged.
Measured (five 50-player seeds, VFR): Escort 25 → 0.088–0.092; 18 → 0.080–0.101, with seeds 7 and 1337 under the 0.085 floor. On the owner's instruction (*"Testleri kod'a göre fixle"*) the per-seed VFR assertion joins ARR's temporary skip; the band is not widened. TURTLE's per-bot composition check is pooled because one raided turtle lost every Warden.
Binds: `profileHull`, `ESCORT_ROUND_TRIP`, `hullFuelMass`, combat holds, D148, D152, D195.

### D208 · Fleet calibration and the merchant share the L12 production reference — OWNER INSTRUCTION

Rule: The owner selected **32 Alloy = 16 Crystal = 1 Deuterium** as the resource value and trade equality, then instructed: *"Gemileri kalibre et ve tüccar kurunu da 32:16:1 yap"*. The executable unit weights are `A + 2C + 32D`; three piles of 32 Alloy, 16 Crystal and 1 Deuterium therefore each value to 32. This is the rounded L12 producer reading (exactly about `32.052 : 16.026 : 1`), used as a stable comparison and merchant price. It is not a dynamic scarcity oracle: the producer ratio changes with level, unlocks and demand.

Ordinary combat efficiency is `atk × hp / economicCost²` at targets **1.00 / 1.06 / 1.12 / 1.18** for tiers 1–4. Tier 1 and the owner-set ground/special hulls remain fixed. Later combat recipes use isotope rungs `2 / 6 / 20`, the audited D208 calibration baseline. The owner clarified that the separate production-deuterium ×2 experiment was reverted for breaking hierarchical efficiency; this baseline must not be described as an applied owner ×2 multiplier. Combat holds retain `[40,85,180,380]` before the existing trip tilt because cargo is a secondary profile trade, not a second combat-efficiency reward. Transport holds remain `[1000,3400,9500,26000]`, because they already improve per economic cost; a measured 50% increase added excess loot without repairing an inversion. Fuel reads the same economic cost and retains the speed tilt. Nullifier's 15% invoice premium pays for shield-only damage, so its ordinary product is based on the non-premium recipe; otherwise the ability would be free at equal budget.

The acceptance rule is role-specific. A higher tier must improve resource efficiency inside the same profile, at large and small economic budgets. A correct lower-tier counter may still defeat a higher-tier wrong class; preserving that is the information game. The audit uses the live three-round resolver over every ordered pair, neutral/max/asymmetric research, discrete fleets, fixed physical wallets without conversion, mixed packets, shield levels, cargo, fuel, salvage, ground fixtures and event-free 14/30-day seasons. `tools/fleet-calibration.ts` records source hashes and assumptions.

Newly dealt fixed merchant occurrences use unit values `1:2:32` and conserve those units. Persisted occurrences are not rewritten. Ruleset 5–7 random-calendar definitions are explicitly frozen at D183's `1:2:9`; the current fixed definition advances to version 4. Ship price reductions also cannot re-index the derived pirate lane: admission liability is frozen at the pre-D208 component table, while current rewards and wreckage continue to use current hull recipes.

Dominion is outside this cutover. Runtime `fleetValue` and secured-loot scoring still sum physical units as `A + C + D`, so changed recipes and battle casualties affect Dominion indirectly, while the `32:16:1` weights do not reprice a score entry. The merchant calls no Dominion booking path. This boundary preserves the current ruleset and recorded journal, but it also means documentation must not call present Dominion a `32:16:1` economic value: changing that meaning requires a separately versioned score migration and new health-band calibration.

Binds: `RESOURCE_VALUE`, `resourceValue`, `profileHull`, `hullFuelMass`, `TRADE.rate`, fixed merchant definition v4, historical galaxy-event configs, `pirateAdmissionCost`, `runFleetCalibration`, `tools/fleet-calibration.ts`.

### D209 · Colonies are earned: guarded caretakers, a fixed capture stock, capital-Core gates — OWNER INSTRUCTION

Context: the first ruleset-8 season (opened 2026-09-12 18:55 UTC) had commanders at Core 8 with two colonies, three of them T2, inside three hours. A read-only production ledger found no duplication: every level and hull matched a paid order, and spend + holdings stayed under the income ceiling. The speed came from rules: a settler inherited the caretaker's full stores (T2 12,763 / 6,381 / 3,191) plus the founding cargo, tier 1 had no guard, tier 2's guard was 8 Darts and 2 Pikes, and the seasonal reward purse paid ~10× production in the opening. Full record: `docs/handoff-colony-economy-2026-09-13.md`.

Rule:
- **Caretaker garrisons** (`MULTI_WORLD.neutral`, buildings unchanged): T1 DART 12 + THORN 1; T2 DART 10, PIKE 10, VIPER 5, STRONGHOLD 5 + THORN 2, BASTION 2, Aegis 2; T3 VIPER 10, STRONGHOLD 10, TEMPEST 3, BALLISTA 3, SENTINEL 3, LEVIATHAN 3, PRAETORIAN 3 + THORN 5, BASTION 3, Aegis 4. The owner asked for five Bastions on T3; 5 Thorns + 5 Bastions is 120 of Core 8's 100 ground room, and the owner chose three. The dome is `instruments.AEGIS`, read by seeding, reinforcement and the simulator — never a tier literal.
- **Reinforcement is free and whole** for T2 (6 h) and T3 (4 h): guard and dome are topped up to the template without spending stores (the new guards cost more than a caretaker can hold). Buildings still rebuild from stores, and a shortfall no longer blocks the guard. An open claim is waited out like a recovery. T1 never re-arms.
- **A settled world opens on `captureStock` and nothing else**: T1 1,000 / 500 / 0, T2 5,000 / 2,500 / 1,000, T3 15,000 / 5,000 / 3,000. Stores are SET, works emptied, and the whole founding charge (cargo and fee) is spent on success; a lost race still refunds both. `transferPlanetControl` deletes caretaker-owned (NULL owner) units instead of handing them over — before this a guard that stood during a claim became the settler's free fleet.
- **Colony slots open at CAPITAL Core 6 / 9 / 12** (`colonyCoreThresholds`, `colonyCapacity`, `nextColonyCore`), counted off the capital only — never a captured world's Core.
- **Research is gated and timed by the capital's Core** (`researchCoreLevel`, published as `researchCore`), whichever world funds the order. Capture writes no research.
- **The galaxy seeds 38 / 19 / 8 caretaker worlds** (65).
- **Seasonal rewards are halved** (floor of half each D208 tier; the account Twitter grant is unchanged). The Academy claims nine rewards, so `academyExitGrant` returns exactly what its claimed lessons paid on the world a commander joins with; a graduate opens on 2,518 / 1,691 instead of 295 / 602.
- **The Uplink costs 1,000 / 500 and builds in 5 minutes** before AI Robots (`UPLINK_BUILD_MINUTES`, `satelliteMinutes`). `satelliteMinutes` is a third construction quote beside `buildMinutes` and `buildingMinutes`; the robot discount still applies (D198).
- **Legibility (D124):** when a colony cannot be founded, a note above the control names the first unmet requirement with its number (`settlementBlock`); before any raid only the Core/slot reason is shown. A research card's Core fix opens the capital's planet sheet.

Rejected in the same session: the production-deuterium ×2 experiment, from the D208 baseline `2 / 6 / 20` to `4 / 12 / 40`. Measured with power unchanged, it put T2 below T1 per economic value (Raider 0.95, Fortress 0.93) and left T4 only level with T1. The owner confirmed this experiment was reverted; `2 / 6 / 20` remains the live calibration baseline, not an applied owner ×2 multiplier.

Deliberately unchanged: a caretaker's raidable seeded stores; `neutralThreat(1)` still reads `UNGUARDED` (not rendered); level rewards still read the viewed world's buildings; T1's `captureStock` carries no deuterium, so a new T1 colony cannot launch until fuel is shipped in. Economy health bands were not re-measured for this change.

Binds: `MULTI_WORLD.neutral`, `neutralCounts`, `colonyCoreThresholds`, `colonyCapacity`, `nextColonyCore`, `createNeutralWorld`, `reinforceNeutral`, `resolveSettlement`, `transferPlanetControl`, `colonyStanding.capitalCore`, `researchCoreLevel`, `REWARD_CHAINS`, `academyExitGrant`, `SATELLITES.UPLINK`, `UPLINK_BUILD_MINUTES`, `satelliteMinutes`, `settlementBlock`, `researchNeedWorld`, simulator strategic layer.

### D141 · Everything the server sells must be reachable — OWNER INSTRUCTION

Rule: Server boundary IDs come from authoritative rules catalogs, not copied enums. Every server-sold building/hull/instrument/satellite/research/strategic action must have a reachable control. Locked rows explain why and link to resolution; governing capacity/state is visible before commit.
Binds: Contracts, catalogs, player surfaces.

## Architecture invariants

### A1 · One source of truth — LOCKED

Rule: `@astera/rules` is pure and dependency-free: no I/O, ambient clock or hidden randomness. Server outcomes and simulator balance use it directly; the client may predict/render but never invent authoritative rules.
Binds: Rules package, server services, simulator, client prediction, CI/lint boundaries.

### A2 · React Three Fiber — LOCKED

Rule: The web client uses React Three Fiber so 3D and DOM share the TypeScript/React tree and the same rules/contracts; native packaging wraps the same build rather than introducing a second gameplay client.
Evidence: Shared TypeScript and one 3D/DOM tree were the deciding constraints; separate-engine stacks would violate A1 or duplicate contracts.
Binds: Web renderer, UI composition, native wrappers.

### A3 · Hybrid persistence — LOCKED

Rule: Continuous state is lazily derived from stored anchors plus the clock; exact future moments are represented by scheduled events. There is no global tick or per-planet background loop.
Binds: Resources, fleet/asteroid motion, event worker, database load model.

### A4 · REST client-to-server; SSE server-to-client — LOCKED MVP

Rule: Client commands/reads use REST and realtime invalidation uses SSE. Motion itself is timestamp-derived client-side rather than streamed frame-by-frame.
Binds: API transport, `/api/stream`, client data layer, network architecture.

### A5 · Persist only non-derivable state — LOCKED

Rule: State exactly derivable from formulas, anchors and the clock is not stored as snapshots/ticks. Missions store timing anchors and asteroid orbits store deterministic orbital parameters; positions and resource tick rows are derived.
Binds: Database schema, mission/asteroid models, resource accrual, migrations.

### A8 · REST + Zod contracts — LOCKED

Rule: REST boundaries use shared Zod schemas end-to-end; endpoint count is not an architectural invariant and must not be documented as one. Every parsed client route belongs in the contract test matrix.
Binds: API routes, client schemas, contract tests, native shell compatibility.

### A9 · Drizzle / SQL locking — LOCKED

Rule: Persistence remains SQL-first through Drizzle, with explicit `FOR UPDATE` / `SKIP LOCKED` and transaction ordering treated as first-class domain tools.
Binds: Database services, worker claims, concurrency-sensitive mutations.

### A10 · Postgres LISTEN/NOTIFY distributes committed invalidations — LOCKED

Rule: Cross-process invalidation uses Postgres LISTEN/NOTIFY; `publish()` is called inside the state-changing transaction so notifications exist only after commit and never on rollback. In-memory emitters are not production authority across API/worker replicas.
Binds: Event worker, API replicas, SSE fan-out, transaction helpers.

### A11 · Unlock announcements are derived — LOCKED, TERMINOLOGY NEEDS CLARITY

Rule: Historical discovery/unlock announcements are derived from authoritative history; only acknowledgement such as `players.unlocksSeen` is persisted. Explicit availability gates owned by current hardware/research rules are separate constraints and must not be conflated with those derived announcements.
Binds: Unlock/discovery services, `players.unlocksSeen`, D25 Uplink gates, research availability.

### A12 · `probe_reports` ≠ `scan_events` — LOCKED

Rule: Probe report content/target history and scan-event origin/history remain separate records because they represent opposite sides of the same action and have different fog/privacy semantics.
Binds: Intel persistence, probe delivery, fog enforcement, history queries.

### A13 · Exactly one clock — LOCKED INVARIANT

Rule: Every authoritative timestamp written by application logic comes from the injected clock; database/default ambient time is not allowed for gameplay events. Client display converts through the shared server-time relationship rather than mixing device and server epochs.
Binds: Database writes, event scheduling, tests, countdowns/projections.

### D174 · Silent Space relocation and eligible return order — OWNER INSTRUCTION

48-hour authenticated presence inactivity moves the whole commander and all developed
worlds into a compatible, playable WAITING galaxy. MAIN colony sites are replenished with
initial-template neutrals. Returning colonies use pooled departure sites only while still
unowned, retaining the returner's own development. Unused sites stay neutral and capturable.
Returns may exceed the MAIN player cap. Prefer a vacant capital address; otherwise allocate
a safe new capital position. New registrations remain capped. Never take another player's
colony to admit a return. Oldest eligible application first; blocked applications retain
sequence and are rechecked. Five-minute maintenance, five successful moves per pass.
Normal season reset and clan exit rules remain. See the final handoff plan for acceptance.

### Economy redesign · Scarce colonies, independent capital progression — OWNER APPROVED (2026-09-09)

The owner rejected widespread first-colony ownership that could turn a 300-player
galaxy into 700–1000 worlds. Colonies are scarce, valuable, contestable possessions;
every player need not own one. The average player's day 2–3 milestone means economic
and military readiness to compete, not guaranteed acquisition. Earlier low-activity
acquisition dates are not ownership guarantees either. Capital-only progression must
support T3, T4 and meaningful PvP. The owner's further emphasis is that the audience's
limited screen time must not weaken PvP or competition: meeting development dates alone
does not pass the economy if players cannot fund and sustain meaningful operations.
A second world must not automatically double economic
power; investment, defence and logistics compete with the same development/fleet budget.
The current 51-neutral pool is a reference, not an approved final count. No new upkeep,
ownership penalty, direct raid capture or production constant changes have been implemented
by this decision. The existing D167 ownership mechanism is unchanged. Candidate
economy implementation/measurements: `docs/astera-economy-design-v1.md` and
`tools/colony-investment-study.ts`.

## Known authority gaps

- **D127 vs Chronicle:** Chronicle `core_tier` milestones can reveal named-world development galaxy-wide. Whether a public milestone legitimately overrides D127's earned-map rule is unresolved.
- **A11 terminology:** “unlock” is used both for history-derived discovery/announcement and for hard availability gates such as Uplink/research prerequisites. Until names are split in code/docs, agents must preserve the distinction above rather than merging their storage semantics.
