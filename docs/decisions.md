# Decision Log

This file contains only current authority that would be expensive to re-derive. If implementation and this file disagree, investigate the discrepancy before treating the code as correct.

Entries contain only the current rule, optional evidence worth preserving, and what the rule binds. Narrative, incidents, rejected experiments, visual implementation, deployment procedure and volatile balance tables belong in their specialist docs, tests or git history. Decision IDs are stable; removed or merged IDs are intentionally absent and must not be reused.

Precedence inside this file is explicit: master decisions named in a rule own that subject. Numeric values that are tuning rather than invariants live in `@astera/rules` / `docs/balance.md`; this log records a number only when the number itself is the decision.

## Product & game invariants

### D1 · Core tension: information game — LOCKED

Rule: The core game is seeing without being seen. Fleet allocation supports that information game; Telescope, Radar, Explorer and Veil are core systems, and the 3D galaxy is the interface rather than a target list.
Binds: Intel progression, combat complexity, galaxy interaction model.

### D2 · Score = Dominion — LOCKED

Rule: A battle's raw score is `(looted + enemy value destroyed) − own value destroyed`; the transferred Dominion is `round(10,000 × tanh(raw / 10,000))`. Dominion is combat-only and zero-sum, the opponent receives the exact inverse, and one battle can transfer at most 10,000; `fleetPower` is advisory only and never grades combat.
Evidence: Net-worth ranking let builders reach about 2.1× raider wealth and made loot tuning unable to preserve the intended PvP ladder.
Binds: Combat settlement, leaderboard, season results, reports, simulator scoring.

### D5 · Season = 14 days — STRUCTURE LOCKED, NUMBER PROVISIONAL

Rule: Seasons are finite and currently fourteen days. The duration must be re-derived if the progression curve materially changes.
Evidence: Seven days did not expose the intended mid-game; fourteen days gives two weekend windows under the current progression target.
Binds: Season lifecycle, pacing, balance acceptance tests.

### D20 · Galaxy is the primary surface — OWNER DECISION

Rule: The galaxy fills the game surface; management screens open over it rather than replacing it with a conventional tabbed app. Focus is the base interaction and must expose only information the commander is entitled to know, including source and staleness where relevant.
Binds: Galaxy shell, focus system, navigation model, intel presentation.

### D56 · Rehearsal is the real game before account creation — OWNER INSTRUCTION

Rule: `GET /api/preview` is seat-free/write-free and uses the same public-galaxy projection contract as authenticated reads so the fog floor cannot drift. The rehearsal renders production components/contracts, emits only intents, teaches Alloy/Crystal scarcity against `START`, uses the current shared starting-fuel tank, and claim creates `PLANET_START` state before replaying intents through ordinary services/locks/refusals. Claim retry is state-derived/idempotent: the same credentials recover the just-created account, replay occurs only on an untouched world, and a refused replay step does not roll back the account/planet; guided gating restricts commitments but never navigation or exit. Skipping the guidance lands directly on the same final commander-name/password claim step; it never returns a new player to the front door.
Binds: Front door, `publicGalaxy` projection, preview API, rehearsal client, onboarding claim, build services, Zod contracts, D58/D136 opening state.

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

Rule: D142's principle now binds every bottom sheet, the header, the menu and the screens behind them. Four shapes complete the vocabulary and every surface holding that kind of quantity uses the shared component rather than a private copy: `SpendBar` for a price taken out of a store (the deficit is drawn PAST the store's end, because clamping at full width draws a one-unit shortfall and a ten-thousand shortfall identically), `RangeBand` for an uncertain reading (band WIDTH is what the reading is worth), `FlightBar` for a craft's position on its leg, and `Tally` for a small count against a small ceiling. A garrison is measured in POWER, never in hull count: a launch's bet is what leaves carved out of what holds. A ladder of scores is drawn as a comparison off a centre line, never as a column of signed figures. Where a picture already states a fact, the text beside it may only say what the picture cannot.
Evidence: The launch and transfer sheets, the intel screen, the flight roster, the worlds list, the item and build sheets, the rewards chains, the clan roster and standings, the Dominion ladder, and the header's flight bays. Five hand-rolled pip racks and one bare fraction became one `Tally`; three unmet prerequisites painted in threat red became amber under `interface.md` I1; `OrbitSlotCount` printed `2 / 4` above a rack that already drew every socket and now prints only what the rack cannot say.
Fog: `FlightBar` draws an inbound attack as a dashed track with no position, because D123 sends no departure time for another commander's fleet — the shape states the absence rather than inventing a marker. A leaderboard row draws capital identity/tier and permits a focus jump only under current sight or frozen probe memory; tapping an UNKNOWN commander refuses with an undiscovered-location warning instead of moving the camera. An active public claim clock remains available to the settlement flow, but its green map ring is a live reading and appears only while that world is in current sight (`RESOLVED`), never from stale probe memory or UNKNOWN state.
Binds: `docs/interface.md`, `apps/web/src/ui` shape components, every sheet and screen listed above, the i18n `shapes` namespace.

### D145 · One radar shell, one sweep that turns, and a switch for both instruments — OWNER INSTRUCTION

Rule: The radar draws ONE shell plus the rotating sweep disc and the outward broadcast pulse, all at the same reach. While D126's detection and timed-warning radii are provisionally merged, the sweep is not a second boundary; it is the moving face of that one circle. If D126 is deliberately split again, two concentric translucent shells must not be drawn on top of one another as a single smudged object: the warning boundary needs a distinct readable treatment. Every static green alpha is scaled by one shared `RADAR_VISIBILITY` constant so the relationships between them survive a global dim. The moving part is priced separately from the graticule, and the sweep's HEAD is priced separately from its TRAIL: dimming the graticule and the beam as one leaves nothing to notice, and raising the beam and its wedge as one lays a solid triangle over a quarter of the galaxy. The head says where the beam is; the trail only says which way it is going, at half weight. The sweep always rotates at its authored speed on every client. Two glyph switches under the disc readout hide or show each instrument's drawing for the ACTIVE world alone, held as a set of planet ids per instrument — an absence of painting, never an absence of rule or fog. A single galaxy-wide flag is wrong here: `sensors` carries a Telescope shell for every controlled world while only the active world's radar is ever drawn, so one boolean gives two adjacent switches two different reaches. A sensor post with no `planetId` is always drawn, since a shell that cannot be identified cannot be the one that was switched off.
Evidence: Owner report against Radar 3, whose sense reach is 1100 and warn reach 190 — "dış küre kocaman ama içerideki yatay tarama çemberi küçücük". The sweep was also reported as never turning while the broadcast pulse beside it plainly did; all OS-dependent animation branches were removed so tactical timing is consistent between clients.
Black tiles: a NaN reaching `gl_FragColor` through additive blending on a half-float target renders as SOLID BLACK in 2x2 quads that appear and vanish as the camera moves. D126 recorded this for the Telescope shell and fixed it there; the sweep — written afterwards — reproduced it, because the rule lived in one file's prose and nothing checked the next shader against it. Three sources: `fwidth()` returns zero across a flat quad, so `smoothstep(0.0, fwidth(x), …)` is a divide by zero; `atan(0.0, 0.0)` at the hub of a PPI disc is undefined; and `alpha <= eps` discards nothing when alpha is NaN, since every comparison against NaN is false. Every derivative now carries a floor, the hub is cut before any angle is taken, and every alpha guard is negated. `test/sensor-shaders.test.ts` asserts all three against the GLSL source with comments stripped, so the next shader cannot repeat it.
Binds: `SensorRings`, `SensorToggles`, `GalaxyCanvas`, `GalaxyView`, D124's visibility principle, D126's provisional merge and its NaN finding.

### D146 · A colony must be in its commander's own galaxy, and the write must say so — BUG

Rule: `transferPlanetControl` — the primitive shared by settlement and the second strategic hit — verifies that the target world and the receiving commander are in the same season before it writes, and refuses with `WRONG_GALAXY` otherwise. "One account, one commander, one galaxy" had been recorded as DB-enforced since D97 and was enforced nowhere at this seam: `planets` constrains one capital per player and ties `kind` to the controller, and nothing tied a colony to its owner's season.
Evidence: The state it produces is a world that exists and cannot be seen. `commanderTopology` joins on `controllerPlayerId` alone, so a cross-season world enters `planetIds` and rides out on `/api/planets` — the worlds list offers it and the selector switches to it — while `publicWorlds` filters by the caller's season, so the disc never draws it and every surface built on the galaxy payload behaves as though it is absent. Found when a dev tool picked "the nearest unclaimed world" with no season filter; both real callers derive their target from a season-scoped mission and are almost certainly safe today, which argues the guard is cheap rather than that the primitive should stay able to write it.
Not a bug: neutral worlds are named `Neutral T{tier}-{index}` per season (`season.ts`), so each of the 51 caretaker names is unique inside a galaxy and appears once per galaxy across the database. A player sees one galaxy, so the name is unique everywhere it is read. It is still enough to mislead any diagnostic that matches a world by name instead of by id.
Binds: `transferPlanetControl`, settlement, the second strategic hit, `grant-colony`, D97's one-galaxy invariant.

## Economy & progression

### D4 · Three independent work queues — OWNER DECISION

Rule: Buildings, instruments and satellites use each world's CONSTRUCTION lane; mobile and ground hulls use that world's YARD lane; research uses one commander-wide RESEARCH lane. Every lane is exactly three orders deep. Cost commits when queued. Construction and Yard orders may be cancelled for a 50% refund; Research is an irreversible commander commitment and cannot be cancelled. System failure refunds 100%, queued prerequisites count as projected state, and `builtEver` increases only on completion. Panic defence is an invariant: the opening Shipyard-tier Thorn must be able to complete inside the tightest Radar L3 reaction window.
Binds: Build services, queue projection, cancellation/refund rules, client prediction, Radar/build-time balance, simulator.

### D13 · Vault floor is bounded — LOCKED INVARIANT

Rule: Vault protection must remain a bounded fraction of the storage it protects; `protectedHoursPerVault / capHoursPerVault < 0.5` must hold for every resource/level. Each resource derives protection from its own production rate.
Evidence: The earlier exponential floor could cover more than the stock it was meant to protect, eventually eliminating raidable value without an obvious failure signal.
Binds: Vault formulas, storage, lootable value, simulator economy.

### D16 · Manual production collection — OWNER DECISION

Rule: Works accumulates production into a bounded buffer and stops when full; collection transfers it to storage and resumes production. Uncollected Works value remains partly raidable rather than becoming a safe offline bank.
Binds: Production accrual, Works, collection API, raid loot, storage UI.

### D17 · Speed economy by income, not price cuts — OWNER DECISION

Rule: When the whole economy must accelerate, prefer scaling income over uniformly cutting prices so payback, resource shares and Vault ratios remain stable. Any exception must be justified as a product-specific commitment rather than an invisible global retune.
Binds: Economy tuning, `docs/balance.md`, production/cost constants.

### D147 · Asteroid Crystal falls while Crystal-bearing hull demand rises — OWNER INSTRUCTION

Rule: The asteroid Crystal-share band is reduced by 30% without reducing total ore, so the removed
share becomes Alloy. Every hull recipe that already consumes Crystal consumes 15% more Crystal
after its ordinary hull-price scaling; a zero-Crystal recipe remains zero. Isotope concentration
continues to replace Alloy independently and does not restore the removed Crystal share.
Binds: Asteroid generation/simulation, hull prices, economy calibration, balance documentation.

### D25 · Four instruments and four satellites — OWNER DECISION

Rule: Ground instruments are Telescope, Radar, Aegis and Veil and may level; orbit satellites are Uplink, Foundry, Derrick and Beacon and are one-time purchases. Uplink is the availability gate for Telescope and Radar; orbit scarcity comes from slots rather than satellite levels.
Binds: Rules catalog, Core slots, instrument/satellite purchase services, UI catalogs.

### D31 · Mined ore lands in Works — OWNER DECISION

Rule: Returning mining value enters Works, bounded independently per resource by the collector ceiling, rather than bypassing collection into storage. Mining therefore participates in throughput, collection risk and raidability instead of becoming a separate safe economy.
Binds: Mining settlement, Works/storage, raid loot, mining preview.

### D36 · Purchasable levels stop where effects stop — MEASURED

Rule: A level may be sold only while it changes gameplay; maximum level is derived from the effect/table wherever possible, and over-cap legacy state is tolerated rather than silently destroyed. If a system intentionally has no further effect, the UI must say there is nothing left to buy.
Evidence: Instrument tables once ended before the purchasable level, charging for levels that produced identical results.
Binds: Instrument/research max-level derivation, purchase validation, UI level controls, tests.

### D58 · Real opening gets a cushion; rehearsal keeps START — OWNER INSTRUCTION

Rule: A newly created starting capital receives `PLANET_START = START + OPENING_BONUS` once, while the rehearsal continues to operate on `START` so its scarcity arithmetic remains true. Claim idempotency/`untouched()` and simulator opening state must compare against `PLANET_START`, not `START`.
Evidence: `START` is fully committed by the guided opening; without the post-claim cushion the new commander reaches the real game with nothing immediately actionable.
Binds: Account claim, planet creation, onboarding rehearsal, `untouched()`, simulator bootstrap.

### D64 · Rewards pay for acts, not attendance — OWNER INSTRUCTION

Rule: Reward chains progress from authoritative player actions, never login streaks, elapsed attendance or tab-open time; progress is derived rather than incremented, with `builtEver` the narrow persisted exception for historical construction. Resource grants are raidable and write the full amount directly to storage without clamping, so a claim may temporarily overflow storage; an overfull store blocks Works collection until room exists rather than swallowing the reward. Ordinary chains are seasonal, while the community/follow reward is once per account and survives wipes/reclaim.
Binds: `packages/rules/src/rewards.ts`, reward claims, storage/Works, planet history, account rewards, simulator assumptions.

### D92 · Deuterium is first-class — OWNER DECISION

Rule: Deuterium is a required third member of resource values and participates in cargo, raid, debris, mining and Wealth arithmetic; there is one ruleset, not a feature-flagged Deuterium fork. Passive supply is provided by the Deuterium Refinery under D135, and starting fuel is governed by D136.
Binds: Resource schemas, migrations/backfill, economy, combat loot, mining, API contracts.

### D93 · Frontier research is discovered from play — OWNER DECISION

Rule: The four Frontier/seasonal discovery projects are earned rather than silently always-open: Spectrometry appears from the season clock; Dense Fuel Cells requires Spectrometry plus a successful cargo-limited raid; Gravitic Charges requires Spectrometry plus a report where Aegis absorbs the qualifying share; Death Star Protocol requires Gravitic Charges and the War act. Under Fleet V2, Dense Fuel Cells opens the Ship Propulsion ladder and Gravitic Charges gates the Nullifier, so neither discovery becomes a paid no-op when Runner and Breacher retire. Research ownership/queue/levels are governed by D134/D140, while economy/doctrine and other projects declared `availableAtMinutes: 0` with no prerequisite are open from the first minute. Discovery is derived from authoritative season/battle history rather than a separate mutable unlock flag.
Binds: Research discovery, season acts, battle/report history, Ship Propulsion/Nullifier/Death Star prerequisites, D134/D140/D141/D148.

### D94 · Runner is a speed-for-cost support hull — SUPERSEDED AT FLEET V2 CUTOVER BY D148

Historical rule: before Fleet V2, Runner is a Deuterium-consuming support hull that buys a shorter exposure window, not a cheaper replacement for Hauler. At the D148 season cutover both named hulls retire; their speed-versus-capacity decision moves to Courier, Wayfarer and Atlas. D8 support protection and the support-only launch prohibition remain locked.
Binds: Hull catalog, cargo/fleet validation, combat support targeting, research gates.

### D95 · Breacher attacks shields, not the counter cycle — NAME/CATALOG SUPERSEDED BY D148

Rule: The named Breacher retires at the D148 season cutover, but its locked specialist behavior transfers to Nullifier: special value applies only against a live Aegis shield, is capped by remaining shield and never spills into ships or ground defence. Without a shield Nullifier must remain a poor generic substitute, so adoption on shieldless targets is a rejection signal.
Binds: Hull catalog, combat resolver, Aegis, Gravitic Charges discovery, reports, simulator.

### D101 · Economy changes as one ruleset — OWNER INSTRUCTION

Rule: Economy relationships that depend on one another must move together at a season/wipe boundary; partial adoption is invalid. Production/storage/Vault relationships use each resource's own rate, hull value continues to preserve the information-over-tech counter structure, geometry is owned by D129 and pacing by D128 rather than by historical Economy-v2 constants.
Binds: Economy constants, hull pricing, season bootstrap, balance simulator.

### D128 · Slow progression without killing the opening — OWNER INSTRUCTION

Rule: The target development package must take roughly six to seven days for an attentive commander reserving half of collected Alloy/Crystal for development, while the first meaningful production upgrade must repay inside the opening session. Exact multipliers and price curves live in balance/constants; the fixed-goal simulator is the acceptance test.
Evidence: The accepted curve measured about 6d 01h 51m for the half-budget target while keeping the first payback near 0.95h; flat global inflation achieved the duration but broke the day-zero payback constraint.
Binds: `pnpm balance:goal`, `pnpm balance:economy`, economy/build constants, season pacing.

### D134 · Research belongs to the commander — OWNER DECISION

Rule: Research is stored once per seasonal commander as `(project, level)` and queued in one three-deep commander lane, so extra colonies never multiply throughput. A selected world funds an order and supplies its Core speed; losing that world neither cancels the order nor transfers it to the captor. A started project cannot be cancelled by the player. Research completion/queue paths lock player before planet. Completed research is excluded from Wealth because it is not planet-held value; resources committed to a live order retain their value until completion or system failure.
Binds: `player_research`, `research_orders`, research queue/completion, lock ordering, colonies, Wealth, D140 research surface.

### D135 · Deuterium Refinery is the floor; asteroids are the ceiling — OWNER INSTRUCTION

Rule: The Deuterium Refinery is guaranteed slow supply while isotope asteroids remain the faster contested ceiling; plant level is bounded by both Deuterium Synthesis and the normal Core ceiling. Deuterium Works/storage capacity is the always-available industrial base plus capacity derived from the Refinery's own production, so a world with Refinery 0 can still hold mined isotope fuel; Vault protection derives only from Refinery production and is zero without a plant. The first Synthesis rung is open from the first minute and cannot require Deuterium, avoiding a source-before-gate deadlock.
Evidence: Before a passive source, the median simulated commander finished a season with about ten Deuterium; a plant-only storage ceiling would also make mined isotope fuel uncollectable on worlds without a Refinery.
Binds: Building/research rules, Deuterium production, Works/storage/Vault, mining settlement, simulator.

### D137 · Research tech stays below information advantage — OWNER DECISION

Rule: Research effects have one pure rules implementation consumed by server, simulator and prediction; no caller may silently default missing tech. The combined military technology product is capped at 25% while the counter cycle remains about 156%, attacker tech is frozen at launch and defender tech is read at combat, and combat doctrines are probe-visible while economy ladders stay private.
Evidence: Giving ATK and HP 25% each creates a 56% combined advantage, close enough to erode the information/counter-cycle premise; the ceiling therefore applies to their product, not each stat independently.
Binds: `tech.ts`, hull effective stats, combat, mission snapshots, probes, prediction, simulator.

### D148 · Fleet V2 is an authored tiered hull catalog — OWNER INSTRUCTION

Rule: At one season boundary, Wasp, Lance, Bulwark, Hauler, Runner and Breacher retire as sold ordinary space hulls and all eighteen supplied Fleet V2 craft become separate fixed-profile hulls. Players choose fleet composition rather than allocating stat points or installing modules. The visible Skirmisher → Bulwark → Lance → Skirmisher counter cycle, three-round combat, D8 support protection and D95 shield-only no-spill specialization remain. The guided opening builds exactly two Darts. Tiers 3 and 4 require commander research; higher tiers receive bounded cost-to-stat efficiency and smaller specialization penalties, but lower tiers retain exclusive or stronger reasons to exist through speed, price, build time, price-derived bulk, cargo role or the absence of a higher-tier counterpart. Wasp/Lance/Bulwark doctrines and Weapons General retire; Engineering, Power, Armor and Propulsion replace their Fleet role while Emplacement Doctrine remains the unchanged Bastion/Thorn progression. Power × Armor research remains inside D137's 25% product ceiling; bounded Propulsion affects only Fleet V2 missions quoted after completion. Probe, Death Star, Prospector, Bastion, Thorn and Aegis are unchanged and receive no Fleet V2 research effect. The catalog never translates live missions in place and activates only through an offline season rollover after the old season's active units, missions, research and reports are wiped.
Evidence: The six-hull ordinary catalog made fleet size dominate too many choices; the owner supplied two distinct offensive and defensive hulls at tiers 1–3, one of each at tier 4, three cargo hulls and one shield specialist specifically to create attack/hull/speed/capacity and research trade-offs without adding combat micromanagement.
Binds: Hull/research catalogs, pricing/bulk/fuel/travel, combat/counters/Aegis, opening, rewards, neutral fleets, simulator, API/Zod contracts, shipyard/fleet/report UI, i18n, 2D/3D assets, season rollover, D8/D11/D36/D93/D95/D101/D133/D136/D137/D140/D141.

### D152 · The fleet flies a quarter faster, and Propulsion doubles it — OWNER INSTRUCTION

Rule: Every mobile Fleet V2 hull's authored base speed is D148's figure ×1.25, rounded to a whole unit; the probe and the Prospector keep their own numbers. `SHIP_PROPULSION` becomes a four-rung ladder of +25% each — ×1.25 / ×1.50 / ×1.75 / ×2.00 — reading its own `RESEARCH_TECH.propulsionMaxLevel` rather than the weapon ladder's, because speed takes no share of D137's 25% combat product ceiling and must not inherit the length that ceiling is split across. Nothing else moves: prices are `atk × hp / value²` and do not read speed, fuel is mass × distance and explicitly not speed (T6), the counter cycle is untouched, and Propulsion is still not a `COMBAT_RESEARCH_PROJECT` — a probe does not report it.
Evidence: The old ladder sold +2% a rung to a ceiling of +10%, priced beside `SHIP_POWER`. A commander who bought all five arrived about twelve seconds earlier across the neighbourhood they actually watch, which is D124's rule failing in the open: a rule the player cannot see is not a usable rule. A quarter per rung is legible from the number itself.
Scope: The lift is uniform, so every relation the D148 table was authored around survives it — Raider over Striker over Fortress, Courier faster and Wayfarer fatter, Tempest the combat speed ceiling. `SETTLEMENT_CLAIM_MINUTES` is derived from the settlement fleet and follows the Courier down from 34 to 27 minutes; the claim window and the flight that has to cross it moved by the same factor, so D111's "every capital can settle every neutral" invariant holds unchanged.
The probe and the drill are excluded, by instruction and by their own arithmetic: `PROBE.speed` is calibrated against `GALAXY_SPAN` so the distance gradient of looking stays what D121 measured, and `PROSPECTOR.speed` is calibrated against ROCK speed so a drill keeps D74's interception lead. This is D101's "hull speeds no, the Prospector and the rocks yes" list read the other way round.
Forced adjacent change, in the season gate: two assertions in `packages/sim/test/season.test.ts` were knife-edge fixtures that the shifted `strategicRng` stream flipped, and both were restated against measurement rather than nudged. (1) `transferredResources > 0` on some run: a transfer needs a colony, a spare transport after the settlement spent two Couriers, and a 5% roll — only six of thirty seeds produced one at all, so the five-seed fixture passed on a one-in-five chance. It now runs the same five seeds at `colonyTransferChance: 1`, where 18 of those 30 seeds transfer. The mechanism improved rather than regressed: the same thirty seeds go from 31 colonies and six transferring runs to 38 and nine. (2) Turtle ≤ Grinder median Dominion was asserted per seed for a measure whose spread this file already documents as pooled; the turtle out-earns the grinder on four of thirty seeds before the change and two after. Pooled across the five fixture seeds the turtle sits at 0.670 of the grinder's median before and 0.615 after, and the grinder's pooled median rank improves from 36.5 to 32.5 — faster hulls pay the player who chose the target more than the one who waited for it. `packages/rules/test/foundations.test.ts` also had a flat 500-unit fixture that became exactly three minutes at the Dart's new speed; the distance is now derived from the hull so it cannot go stale again.
Binds: `HULLS` speed column, `RESEARCH_TECH.propulsionPerLevel`/`propulsionMaxLevel`, `propulsionSide`, `RESEARCH_MAX_LEVEL.SHIP_PROPULSION` and the Propulsion cost ladder, `SETTLEMENT_CLAIM_MINUTES`, research panel gains text, TR/EN research strings, `docs/balance.md` Fleet V2 table, D74/D101/D111/D121/D124/D137/D148.

### D153 · The disc grows every level, the fleet drinks, and the camera follows a craft out — OWNER INSTRUCTION

Rule: Four changes, each answering a report from the map rather than from a model.

(1) A world's DRAWN SIZE reads its exact Core level. `worldRadius` runs a geometric ramp through
the three authored sizes — 0.44 at Core 1, 0.82 at Core 11, 1.40 at `CORE_TOP_LEVEL` — clamped at
both ends, so the 3.2× spread and all three tuned numbers survive while no single level is a step
over 7%. The coarse tier keeps its two jobs untouched: the three `worldWeight` words, and D49's ±2
attack band. Every standoff caller reads the level, because a standoff off a tier is now the wrong
distance for eight levels out of nine.

(2) The dyson ladder starts at Core 12 rather than 9, and ends where the size ramp ends. One rung
per level, a ring every three, `CORE_TOP_LEVEL` shared with the ramp so the two ladders cannot
disagree about the top of the game.

(3) Fuel mass is Hangar bulk × the hull tier's own thirst rung: ×1, ×2, ×4, ×5 for tiers 1–4.
`FUEL.tierMass` multiplies fuel mass only — `bulk` remains Hangar room and nothing in the hull
table moves. Tier 1 is excluded by instruction, so the opening costs exactly what it did. Prices,
combat, the counter cycle and D137's 25% product ceiling are untouched, and fuel is still
explicitly not a function of speed (T6 · D152).

(4) Probe base speed ×0.75, 4,680 → 3,510. Every mobile Fleet V2 hull keeps D152's lift; the
Prospector keeps its rock-tied number.

(5) Automatic craft focus follows a craft OUT and never home. `reconcileOwnCraft` is the single
statement of it, off the `leg` every own thread already carries and the `status` every mining row
already carries. A homebound craft is still baselined into `seen` — a return must never move the
camera at all, not move it once and then stop.

Evidence: (1) The two old transitions were +86% at Core 3 → 4 and +71% at Core 9 → 10, so the whole
public development signal arrived twice a season and the eight levels between said nothing —
"8'den 9'a geçince çok bariz bir fark oluşuyor". Geometric rather than linear because the eye reads
size as a ratio: linear steps would grow a small world by a tenth and a large one by a thirtieth
for the same level, stalling the gradient exactly where the game gets interesting. Reading the exact
level costs nothing new — `publicGalaxy` has published `coreLevel` since the dyson rings, because a
ring count stepping every three levels and a colour stepping every one cannot be drawn from a tier.
(2) Nine was already the second revision of "this should be on the more solid players", and it put a
megastructure on a world barely past the middle of the ladder — which is also what made Core 9 the
largest visual event in the game. Twelve separates the two signals: the world grows a little at
every level, and the structure is the later one. (3) Fuel is mass × distance and mass was bulk,
which is derived from hull VALUE — so a late fleet cost more to move only in proportion to what it
cost to build, and a refinery that covered the opening covered the endgame. Deuterium went from
being the lesson of the first hour to a rounding error, which is the one outcome T6 exists to
prevent. (4) D152 lifted the fleet a quarter and left the probe out, so the distance between "how
fast can I look" and "how fast can I hit" grew by a quarter in the scout's favour on top of D121's
×12; the cut and the lift close the same gap from both ends. D121's ceiling is a ceiling on
FLATNESS, not on speed — with no fixed launch term the gradient is exactly
`GALAXY_SPAN / minSeparation` and a slower probe simply pays more for distance, which is the
direction that rule wants. At 3,510 it still outruns every hull by more than an order of magnitude
and the retarget hour still outlasts the widest round trip. (5) The server does not turn a mission
round: it closes the outbound row and inserts a fresh one linked by `parentMissionId`, so every
craft reached the follow rule a second time as a brand-new identity and seized the screen on the way
home — mid-menu, mid-inspection, once per craft, and with several in the air it never stopped.

Scope: Forced adjacent changes, all three restated against measurement rather than nudged.
`packages/sim/test/fleet-v2-balance.test.ts` asserted T4 research open at day 12; the weapon ladder
is priced in deuterium from its second rung, so a thirstier fleet slows it — the leading grinder now
reaches `SHIP_POWER` 4 on day 13 of a fourteen-day season, still inside the sunset act the test is
named for. The assertion is now derived from `SEASON.days` so it states the act rather than the day,
and CLAUDE.md's own caution applies: the bots still log in on async-era assumptions, so a one-day
question belongs to playtesting. `apps/web/test/bombardment.test.ts` pinned two absolute radii (1.4
for "a heavyweight", 0.44 for home) against fixtures that declared only a tier; both worlds now sit
at the ends of the ladder, where those two numbers are what the disc actually draws. `worldRadius`
is also total on a non-finite level, because it feeds position buffers and one NaN takes the scene
down — the same answer an unread world gets.

Binds: `worldRadius`/`CORE_TOP_LEVEL`/`RADIUS_LEVEL`, `worldWeight`, every `surfaceStandoff`/
`orbitStandoff` caller (traffic, radar, worker, `planetNodes`), `SHELL_STAGE`/`FIRST_LEVEL` in
`DysonShells`, `FUEL.tierMass`, `fuelMass`/`hullFuelMass`/`missionFuel`/`hullFuelRate` and every
launch, transfer, clan-aid, settlement and pirate flow that quotes them, `PROBE.speed`,
`reconcileOwnCraft`, `docs/balance.md`, D44/D49/D52/D74/D101/D111/D121/D123/D124/D127/D136/D137/
D148/D152.

### D149 · Public galaxy events are immutable seasonal moments — OWNER INSTRUCTION

Rule: A new season receives a hidden, deterministic calendar of public galaxy-event occurrences;
continuous gameplay effect is derived from the occurrence clock while start/end delivery uses the
scheduled worker idempotently. Asteroid Shower v1 lasts 60 minutes, raises only new asteroid arrival
to ×5, occurs exactly five times per full Türkiye calendar day and leaves 120 minutes after its end
before another shower may begin. Türkiye `[00:00, 08:00)` is low priority, not a blackout: a
five-event day targets one start there and may contain at most two. Ending a shower restores normal
arrival immediately but never deletes already-arrived asteroids or cancels mining flights. Future
event kinds share persisted occurrences, effect snapshots and lifecycle delivery; incompatibility
pairs belong to typed config. Players may read active events, never the future calendar or hidden
asteroid coordinates.
Binds: Galaxy-event scheduler/config, season seeding, scheduled worker, asteroid field/mining,
Signals/Chronicle, active-event API, SSE invalidation, rollout and D143 fog.

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

### D14 · No newcomer immunity — OWNER DECISION

Rule: There is no time-based newcomer grace period or development-tier attack band. Protection comes from fog/information cost plus `ABUSE.bashLimit`; server refusal after a fleet is prepared must not depend on hidden development state.
Binds: Attack validation, anti-abuse, D127 world disclosure, onboarding expectations.

### D18 · Telescope is reach plus commitment — OWNER DECISION

Rule: Telescope is constrained by level-based watch slots, reach and a repoint commitment; filling unused capacity is distinct from switching an existing watch. Watching is silent, and no maxed Telescope may remove the entire fog layer by itself.
Binds: Telescope watch service, sensor reach, Uplink gate, D126 sensor ceiling.

### D19 · Asteroid mining is an earned race — OWNER DECISION

Rule: Asteroid value comes from rock state while orbital motion is independent; interception is solved in exact continuous time and must be reproducible from deterministic field state plus the clock. First valid arrival takes what it can carry. Asteroid discovery persists until the rock is gone. Mining/salvage craft obey the ordinary sensor zones: absent outside every circle, anonymous in Radar, identified in Telescope. An identified mining run exposes route/clock only after the caller discovered its target; an identified salvage run may expose its route/clock because the debris field is already public.
Binds: Asteroid generation/discovery, intercept solver, Prospector missions, traffic fog, simulator.

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

Rule: A raid arrives at `arriveAt`, remains in flight for exactly 10 seconds, then resolves combat; `arriveAt` itself does not move. The bombardment is a galaxy-visible public moment. The attacking craft is separate: absent outside sensor reach, an anonymous contact in Radar, an identified silhouette in Telescope, and exact only to its owner. An effect-only observer receives no real orbit point, approach bearing or mass.
Binds: Mission/event scheduling, combat resolution, public engagement projection, client bombardment timing.

### D45 · The game must report its actions — OWNER INSTRUCTION

Rule: Player-significant server actions emit explicit, idempotent notifications/reports with authoritative instants rather than rounded snapshots. Notification kinds and payloads are contract-tested, and unlock/report producers have one authoritative writer.
Binds: Notifications, Signals, battle/probe reports, contract tests, client routing.

### D52 · Battle is public; the clock is server-authored — OWNER INSTRUCTION

Rule: Live combat/strategic effects are galaxy-wide, deterministic from mission identity and authoritative server time; a fleet that reaches its target performs its engagement regardless of which clients are watching. Public effect does not mean public craft intel: the squadron itself still obeys D123. Animation, prediction and countdowns use the shared server-time offset, and liveness work must never block the event loop.
Binds: Combat events, traffic, server clock, client animation, worker.

### D53 · Galaxy invalidation is event-driven — OWNER INSTRUCTION

Rule: Cross-client galaxy state refreshes from scoped SSE invalidation when readable payload changes, with a slow safety poll only as repair; broadcasts carry no private world/owner/position data. Mutations return the authoritative state they changed when practical, and the client predicts only constraints it can prove safely.
Binds: SSE stream, shard invalidation, public projections, mutation responses, client cache/prediction.

### D59 · Probe scouting is explicitly rationed — OWNER DECISION

Rule: Probes are intentionally much faster than combat craft but may be launched by one commander at a given target only once per enforced cooldown window across all controlled worlds. The API exposes the next permitted instant so the client can disable the action before a refusal.
Binds: Probe launch validation, intel API, cooldown constants, UI controls.

### D72 · Realtime client state has one ownership/resync contract — ENGINEERING INVARIANT

Rule: `legBelongsTo` is the single ownership definition for movement payloads; a foreign leg must never appear in an owner's pending state with private route/roster while also appearing as public traffic. Reopening SSE after the first connection is a resync, mutation flows cancel stale reads that could overwrite newer answers, equal `Date` instants structurally share, and route geometry is allocated once/mutated in place/disposed on removal. Landing windows may not coast through their destination, and a stranger's bearing-window expiry is not treated as an owned arrival.
Binds: Pending/traffic/mining queries, SSE reconnect, React Query structural sharing, optimistic mutations, route geometry, arrival timers.

### D73 · Raids interrupt production, not the session — OWNER INSTRUCTION

Rule: DECISIVE raids disrupt Works for 15 minutes, PARTIAL raids for 5 minutes and REPELLED raids for none; the hard ceiling is 15 minutes from now. Repeated qualifying raids refresh the applicable window but never stack it, and the authoritative end is `disruptedUntil`.
Binds: Combat settlement, Works production, notifications, planet view.

### D74 · Prospector ownership is capped — OWNER INSTRUCTION

Rule: A world may own at most two Prospectors across every location/ingress path; the authoritative speed is single-sourced in rules and must remain reachable against the generated asteroid field. The cap is enforced server-side, not by price or UI.
Evidence: Five-seed sweeps across spawn slots and rock lifetimes found 100% reachability for the current base/boosted speed model.
Binds: Prospector build/transfer, asteroid solver, rules constants, simulator.

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

Rule: Battle/strategic reports expose enough authoritative detail for the recipient to understand result, casualties, salvage, downtime, wreckage and relevant cargo/shield limits without leaking the opponent's hidden survivors. A newly resolved ordinary battle freezes the calculation trace in its rounds: both bounded shot rolls, Aegis before/after, attack power that passed the shield and the casualties removed after simultaneous fire. The report states the fixed counter/research/HP/carry/support recipe and exact result/loot thresholds beside those actual figures; legacy reports leave unavailable trace fields unknown rather than reconstructing them from mutable world state. Every Signals kind has a defined destination in the client.
Binds: Report schemas, notifications/Signals routing, combat settlement, client report UI.

### D123 · Radar detects; Telescope sight resolves the formation — OWNER INSTRUCTION

Rule: Every craft has three zones, defined only by `packages/rules/src/sight.ts`: outside every owned sensor sphere it is absent, inside a Radar sphere it is an anonymous moving contact, and inside a Telescope sphere the craft itself is identified. An identified fleet exposes its exact hulls and counts in the focus surface and renders them with the same hull assets/exact-count pips as an owned formation; its owner, origin, destination and cargo remain hidden. The same zoning applies during engagement and to mining/salvage. There is no departure shroud; a craft is visible from the first instant its current position enters a sphere. Live bombardment/strategic impact effects remain galaxy-wide public moments without disclosing a hidden craft's point, bearing or mass. A mining route is exposed only when the craft is identified and the caller has discovered its target under D143.
Binds: `services/traffic`, `/api/galaxy`, Telescope, Radar, public events.

### D125 · Blind traffic becomes unknown, not absent — OWNER INSTRUCTION

Rule: Blind traffic is absent outside every owned sensor sphere and becomes an anonymous moving `unknown` contact inside Radar reach. `/api/galaxy` returns the caller's own Radar/Telescope spheres so the client can draw them and refetch when a published contact crosses between CONTACT and IDENTIFIED; a five-second traffic cadence discovers entries from NONE without advance disclosure.
Binds: Galaxy traffic contract, sensor reach, client crossing prediction, D124 presentation.

### D126 · Radar has two radii — OWNER DECISION

Rule: Radar's position-based contact radius detects a craft and its timed-warning radius says when a hostile craft is inbound; neither is inferred from total leg length. They are provisionally merged (`radarContactRange === radarRange`) while the visibility engine settles, suspending D9's narrower warning window. Telescope reach is finite at every rung and capped by its own 1,600-unit top rung, below the 2,000-unit galaxy radius; Radar deliberately reaches farther but identifies nothing by itself below its disclosure rungs.
Evidence: An unbounded max Telescope resolved the entire live galaxy. A provisional merged Radar table keeps the two products consistent until their ranges are split again; rules tests assert the merge so restoring D9 is explicit.
Binds: Radar sensing/warnings, Telescope watches, sensor projection, D125 crossings, D129 geometry, strategic interception.

### D127 · The map is earned, not given — OWNER INSTRUCTION

Rule: UNKNOWN exposes only a world's existence/position as the same anonymous silhouette for every world—no owner/name, pin, rings, satellites, dome or development signal. REMEMBERED exposes only the newest LOOK's frozen owner, Core level, satellite set and dome state (D151 widened "look" from probe-only to any arriving craft of the observer's); RESOLVED exposes live entitled state inside current Telescope sensor reach. Development/owner/hardware are therefore earned intel, the record does not update until something of the observer's is there again, Veil changes readings rather than reach, the development attack band is retired and `ABUSE.bashLimit` remains the anti-farming refusal.
Binds: `/api/galaxy`, probe reports/memories, world rendering, attack validation, Telescope, Veil, leaderboard/Chronicle disclosure.

### D129 · One gameplay sphere — OWNER DECISION

Rule: The authoritative galaxy is one sphere of radius 2000 centered at the origin, with no separate gameplay thickness; widest crossing is 4000. World placement, asteroid orbits, sensor/travel geometry and derived coordinates must stay inside and use that same sphere; scenery layers do not define gameplay coordinates.
Binds: World generation, asteroid orbit contract, travel/sensors, settlement span, 3D coordinate transforms.

### D143 · Asteroid targets are earned through local sensors — OWNER INSTRUCTION

Rule: A commander discovers an asteroid the first time its exact 3D orbit enters the spherical sensor reach of any controlled world; the free reach is 500 and an effective Uplink-gated Telescope expands it through the ordinary sensor ladder. Discovery is remembered until that rock expires or is depleted, never awarded retroactively by a later upgrade, and survives temporary hardware loss. The season schedule/key and raw indexes stay server-only; APIs expose caller-filtered trajectories under opaque ids, apply the same gate at launch and hide mining routes to undiscovered targets. Crossings are solved analytically and the server supplies the exact next field-change instant instead of ticking or broadcasting every contact. This ruleset must begin at a season boundary because changing a deterministic orbit distribution during a live season moves existing targets.
Evidence: A linear orbit-radius draw produced about 7.6× p90:p10 naked-eye opportunity imbalance across uniformly distributed worlds. The measured fourth-power draw reduces it to about 2.1×; at the current field rate the median commander sees about 22 unique rocks (3 isotope-rich) in an eight-hour L0 session over days 2–8.
Binds: Private asteroid generation/ids, `sensor_epochs`, `/api/mining`, launch validation, mining traffic, exact client wake-up, Telescope copy, season deployment.

### D131 · Prospector cap belongs to the world; miners are not garrison — OWNER DECISION

Rule: Prospector capacity is checked at every player-controlled ingress, while overflow created by capture/reroute/system paths is legal and blocks only new ingress. Prospectors do not participate in ordinary garrison combat, but strategic Death Star destruction still reaches home miners.
Binds: Build/transfer/capture, garrison construction, combat, strategic strike, simulator.

### D133 · Hangar caps fleet; Core caps ground — OWNER INSTRUCTION

Rule: Mobile fleet capacity is a separate Hangar pool measured in price-derived `bulk`; ground defence uses a separate Core-derived pool, and neither cap deletes overflow created by capture, survivors, reroute or Core loss. Capacity must preserve the hull pricing/counter relationships instead of introducing a hand-tuned second value axis.
Evidence: Simulation suggests a fleet ceiling can compress some advantage of scouting even while fixing unbounded accumulation; this remains a real-playtest watch item, not permission to remove the cap or widen acceptance bands.
Binds: Hangar/Core, hull build validation, ground defence, capture/strike overflow, simulator/playtest.

### D136 · Every ordinary launch prepays fuel — OWNER INSTRUCTION

Rule: A mission prepays Deuterium for every planned leg at launch using fleet bulk × distance; speed is not a fuel factor, and if Deuterium is also cargo the origin must cover `cargo + fuel` together rather than validating each independently. System-added reroutes charge nothing extra and cancellation refunds no fuel; probes, mining/salvage and Death Stars are exempt. The real starting capital and rehearsal both receive the shared starting-fuel tank so the guided launch cannot deadlock while Alloy/Crystal scarcity remains the lesson.
Binds: Launch quotes/validation, transfer/raid/clan-aid routes, `PLANET_START`, rehearsal seed, Deuterium Refinery, UI fuel preview.

### D138 · Same type, new meaning requires a caller audit — ENGINEERING INVARIANT

Rule: When a change alters what a value means without changing its TypeScript type, compiler success and old green tests are not sufficient; every reader/caller must be audited explicitly. Prefer parameter/type names that cannot accept the old meaning and contract tests that tie every reader of the quantity to one authoritative figure, so duplicated interpretations fail against each other instead of agreeing on the same bug.
Evidence: A Deuterium-capacity semantic change left eleven same-typed callers on the old input and produced a 24× server/client disagreement while existing tests still passed.
Binds: Rules API signature changes, server/client/simulator callers, migrations/refactors, cross-surface contract tests.

### D139 · Strategic interception fires on Radar L3+ or Telescope sight — OWNER INSTRUCTION

Rule: An Interception Grid requires effective Radar 3+ to build and consumes one target-world charge to destroy the first Death Star that either crosses that target's timed Radar L3+ interception boundary or enters effective Telescope sight from any world the defender controls. Radar L1/L2 have no interception circle and the wide clockless contact ring never fires the grid. The immediate eight-second launch/collision is visible to both participants and to other commanders whose Telescope identifies the collision point. Strategic stockpiling permits two Death Stars built sequentially so bait-then-strike remains the attacker answer; charges transfer with worlds and successful interceptions are Chronicle-worthy events with reports for both sides.
Binds: Radar events, Telescope sight, strategic assets, Death Star lifecycle, traffic fog, reports, research, Chronicle, world transfer.

### D150 · Pirate fleets are the galaxy's third target class — OWNER INSTRUCTION

Rule: Deterministic NPC pirate fleets ride their own closed orbits on an independent seeded lane and are raided like a world: one raid per origin world per pirate, flight bay and prepaid fuel charged as any launch (D28/D136), doctrine frozen at launch (D137). Pirates never attack anything and never move Dominion — `bookBattle` is not called and the swing is zero. Their only combat modifier is a per-level attack `damageMult` carried through `CombatSide`, never research and never HP, so D11's low-variance model and D137's 25% product ceiling are untouched. Visibility is craft-zone only (`sensorZone` on the pirate's current point): NONE/CONTACT/IDENTIFIED, no orbital elements, no raw index, no route, and no persistent discovery memory — a pirate that leaves a commander's circles ceases to exist for them, so `sensor_epochs` is not read or written on this lane. Launch requires live sight. Victory pays hoard capped by `fleetCargo(survivors)`, two-sided wreckage under `DEBRIS.share`, and — only on DECISIVE — a level-weighted chance at one hull drawn from the crew that raid actually fought — never from the launch roster, or the commander who cleaned up the last Dart could tow home a Cataclysm somebody else destroyed — which lands home even over Hangar capacity (D133) and never increments `builtEver`. Mutual annihilation pays nothing and flies no return leg. Only non-derivable mutation persists: cumulative losses and destruction (`pirate_state`), plus the raid row itself.
Evidence: Straight-pass targets can only be met by a faster craft, which is what forced asteroid speeds down until the field looked frozen (`galaxy.ts`); a closed orbit returns, so a fleet of any speed can find a rendezvous.
Scope: This pulls "fleet interception" forward from the CLAUDE.md post-MVP list. Recorded deliberately, not silently.
Forced adjacent change: `interceptAsteroid`'s scan/bisection solver is extracted to a shared `interceptOrbit`, and the orbit trigonometry and fourth-power radius draw to `orbitPosition` / `orbitRadius` on a shared `OrbitElements`, because a second copy of any of them is the "honoured in one place, forgotten in the other" failure this codebase has already shipped. `invariants.test.ts`'s generated-field reachability sweep and the rest of the rules suite stayed green unchanged across the extraction (573 tests).
Void wreckage: a pirate battle leaves a real harvestable field at the rendezvous, priced from both sides' losses exactly as a player battle is. `debris_fields.planet_id` is nullable and every field carries its own `x/y/z`, populated for world battles too so no reader branches on which kind it is holding; `pirate_raid_id` is the third anchor `reclaim` finds a void field through, and the CHECK insists on exactly one. `launchHarvest`, `projectVisibleDebris` and `Wrecks` read the field's position rather than dereferencing a planet, which also fixes a wreck vanishing whenever its world was outside the caller's payload.
Ownership follows the commander on every surface, not only in the delivery — CORRECTION: `resolvePirateReturn` was taught to resolve through `owner_player_id`, and the two surfaces that DRAW the flight were not. `pendingThreads` selected raids whose `planet_id` the caller controls and `traffic`'s own-craft exclusion asked the same question, so a colony captured mid-flight moved the raider's own squadron into the captor's mission strip and simultaneously out of the exclusion that keeps a commander from seeing an anonymous copy of their own fleet. The three layers made it worse rather than better: `pendingThreads` is the OWNER surface — exact manifest, whole leg, and the only place a launched raid is drawn at all — so the captor was handed a full-fidelity reading of a squadron they had never had eyes on, obtained by taking a world rather than by looking at anything, while the raider was put on the stranger side of their own fleet. Both now read `owner_player_id`; `traffic` keeps the pad as the fallback only on the seat-free path where there is no commander to ask about, which is `missions`' own shape. The `planets` join stays on `planet_id` because the squadron is parked at the pad and flies its leg from there whoever holds it, and the one-raid-per-world-per-pirate gate stays on `planet_id` too, because that is a fact about the WORLD and is what the unique index enforces.
Public flash — OWNER INSTRUCTION: a live engagement publishes its bombardment to every commander at any range; sensors decide only whether the CRAFT is drawn beside it. D52 gave world battles that and the pirate lane refused it, on the reasoning that empty space has no public address to hang the effect on. That did not survive its own consequence: the fight leaves a `debris_fields` row at exactly that point and wreckage is public to everybody at any range (D32), drawn on the disc and counted in the readout — so the coordinate was already going out, durably, for the whole decay window, and withholding the ten seconds that produced it hid nothing while costing the disc one of its few genuinely public moments. Each side publishes its own `effectOnly` row under its own id, so a commander whose circles cover one of them sees that craft and the other's fire as a flash only. Both rows carry the RENDEZVOUS and never the attacker's hold: the hold sits one `ENGAGEMENT_STANDOFF` back along the approach and would hand over the bearing of the raider's own world, which is the same refusal the world case makes when it publishes a planet's centre instead of the orbit point. Both window ends are that one point, so there is no bearing to extrapolate, and `concealedEngagementDirection` invents the firing direction from the event id. `concealedVolley` states the two figures the effect needs — how far back the fire comes from, how wide it scatters — with or without a world; they used to be read off the target's planet node, which is why a rendezvous drew nothing.
Return delivery: the squadron follows the COMMANDER, not the pad. `pirate_raids.owner_player_id` records who committed the fleet, and `resolvePirateReturn` resolves its destination through `safeHomePlanet(owner, origin)` exactly as `settleReturn`, the neutral paths and the transfer reroute already do — so a colony captured while the raid is airborne can no longer deliver the fleet, the hoard and the towed hull to the commander who just took it. The kill credit on `pirate_state.destroyed_by_player_id`, the away stack's `units.owner_player_id`, the arrival's wealth recompute and the `fleet_returned` notification all read the same column. Wealth counts units by the world they sit on, so a captor carried the parked stack on their books for the flight and both commanders are settled on delivery.
First-hit lock: `pirate_state` is seeded with `ON CONFLICT DO NOTHING` immediately before the `FOR UPDATE`, because `SELECT ... FOR UPDATE` cannot lock a row that does not exist yet. On an UNTOUCHED pirate two overlapping arrivals therefore both read the full crew, both fought it, and the second wrote its own casualties over the first's — cumulative losses lost, and the hoard and capture roll paid twice. A seeded row with no losses and no `destroyed_at` is indistinguishable from no row to `livingRosterOf`, `destroyedAt` and `standing`, so this creates state without creating meaning. The single worker resolves events one at a time and hid this; `claimDue`'s `FOR UPDATE SKIP LOCKED` exists precisely to allow a second replica, so `concurrency.test.ts` now runs the two arrivals in genuinely parallel transactions instead of through one `tick()`.
Attacker bombardment: the volley's `radius` is what scatters its aim, so `volleyFor` and `Bombardment` both refuse zero — a pirate raid handed `{ radius: 0 }` drew no engagement at all, losing the one moment of the trip the player waited for. `bombardmentTarget` in `scene.ts` is the single statement of what a leg fires at and how big it is; a world states its own drawn radius and a pirate states `null`, meaning "no world here", so the caller supplies its own formation footprint. It briefly stated a constant `PIRATE_TARGET_RADIUS` instead, which was wrong in scale (three world units, more than twice the largest planet in the game) and wrong in kind (the public path had always used the formation, so one battle was drawn two ways depending on who was watching).
Engagement geometry — CORRECTION, D106 applied to this lane: the gap the two formations hold across has exactly one statement, `ENGAGEMENT_STANDOFF` in `packages/rules/src/view.ts`, and both the server's published hold and the attacker's own leg read it. The client had shipped a second one — `PIRATE_STANDOFF`, six world units against the server's 1.6 — so the owner watched their own squadron hold nearly four times further out than every other commander saw it hold, and the fog was being enforced at a point the owner's craft was not drawn at. Compounding it, `contactPosition` sent every engaged contact through `engagementHold`, which falls back to the target itself when no world is drawn there — and a rendezvous never has one — so the pirate was placed on its attacker's hold point and the attacker on the rendezvous: the two swapped places, each was then asked to look at the coordinate it was standing on, and three.js resolves a zero-length `lookAt` as world +Z. Both formations snapped to a compass bearing mid-battle and fired into empty space. `engagementPosition` is now the one answer and tells the two payload shapes apart by the WINDOW, not by the contact's kind: a real approach window is still solved out to orbit (D44), a window with no length is the server saying "I am standing exactly here" and is drawn as published. The refusal to point a craft at itself lives in `isHeading`, called inside `easeHeading`, because a caller that forgets is a formation silently facing the wrong way. The standoff is 2.2 on the owner's instruction — half the 4.4 the disagreement above was actually putting on screen — which also lands inside the 0.88–2.8 band `orbitStandoff` spans across the world-size ramp, so a pirate fight reads as the same kind of event as a siege rather than a different one.
The report — CORRECTION: a pirate battle was rendered by the world template, and the template dereferenced facts that do not exist out there. `opponentPlanet` is an empty string because there is no world on the far side, so the list row opened with a blank and a dangling separator, the header drew an arrow to nothing, the verdict sentence read "did not hold." with no subject, and the wreckage line sent a commander to collect their salvage "over ." Every round printed an Aegis verdict about a structure that cannot exist at a rendezvous (`settleArrival` passes `shield: 0` for exactly that reason) and the DECISIVE legend named a shield at zero — a condition the reader could never have met or failed. Meanwhile the two facts that actually decided the fight were absent: the level's `damageMult`, which is the entire difference between a pirate and a player fleet of the same roster, and `captured_hull`, the only door in the game into a hull you did not build — it reached the player as a toast and a `fleet_returned` line, both long gone by the time anyone opens the report, which is where a commander goes to find out what a fight was worth. Both were already stored and already joined; only the reading was missing, and `report.pirate` now carries them. A pirate report has no `defender_player_id` and is shown to exactly one commander who bought every fact in it by fighting, so nothing here touches the fog.
Measured, with an instrument: `tools/pirate-study.ts` (`pnpm study:pirates`) reads the shipped constants and regenerates both tables in `docs/balance.md`. Across five seeds a commander meets a median of 23 distinct pirates per eight-hour session at the naked eye (p10 14, p90 29) and 58 at Radar 3 — sensor investment roughly triples opportunity. `E[net]` is positive for a wing sized for the target at every level and negative for the same budget with nothing that shoots, which is the gap the decision lives in; a fixed fleet stops paying between L2 and L3. Every pirate is reachable by a Dart from the centre, the mid band and the rim, asserted at 100% rather than at a majority.
Binds: `packages/rules/src/pirates.ts`, `combat.ts` `CombatSide`, `galaxy.ts` `interceptOrbit`, `pirate_state`/`pirate_raids`/`battle_reports` schema, pirate field/raid services, traffic fog, `pendingThreads`, reports, notifications, reclaim, season lifecycle, `/api/pirates`, galaxy client.

### D151 · A fleet is eyes — OWNER INSTRUCTION

Rule: The galaxy's REMEMBERED record is what an observer LAST HAD EYES ON, not what a probe once saw. Every arrival that puts a craft of the observer's at a world the fog was hiding writes that world's silhouette to their record at the instant it was there — an ordinary raid, a raid that bounces off recovery/occupation protection, a battle with a neutral, a strategic strike (written after the strike, so it is the world the weapon left), and a settlement, whose interesting case is the FAILED one: a claim window that closed under the transports still flew them to a world somebody else now holds. A `transfer` and a `clan_transfer` are excluded: one lands on your own world and the other on a teammate's, whose identity and worlds D114 already publishes live to the whole clan. The silhouette is `silhouetteOf` and nothing more: flag, clan, kind, Core level, orbital hardware, dome. The two readings only a probe takes — combat doctrine and the interceptor pad — are never inferred from a battle, because a raid is not a scan. Nothing else about D127 moves: the record stays frozen between visits, never resolves the world, always carries its `seenAt`, and belongs to the visitor alone — the DEFENDER learns nothing about the attacker's world, since sight is bought by GOING somewhere. Newest look wins regardless of which craft took it.
Evidence: Live-galaxy chat, repeatedly: "sorry, it showed as an empty world, I sent a fleet and it turned out to be yours." Every one of those was D127 working as specified, and every one was a commander who had paid a fleet for a reading the map then refused to keep — against CLAUDE.md's own standard that a reading collected and not shown is the most expensive bug this project can have.
Forced adjacent change: `probe_world_memories` stops being a pointer into `probe_reports` and carries its own `silhouette` plus a `source` of PROBE/BATTLE, with `report_id` nullable (0053). The upsert's newest-wins predicate compared `(seen_at, report_id)` as a SQL row, which is NULL the moment either side has no report — so the tie-break coalesces to text and a battle record can actually replace an older probe one. `rememberWorld` is the single writer for both lanes and publishes `private:memory`, which invalidates the player-keyed `remembered` projection and routes the client to one read; without it the record existed and the map served the old one until a TTL.
Legibility: `recordAgeMinutes` is the one definition of a record's age, and all three surfaces read it. The disc label printed a bare duration from its own copy of the subtraction and now names what is old; the launch sheet — the last screen before a fleet stops being recallable — carried no age at all and now states it in its eyebrow. Neither adds a fact the player had not already bought; both state the provenance of the facts already on the screen.
Binds: `probe_world_memories` schema/migration 0053, `rememberWorld`/`rememberVisitedWorld`, `rememberedWorlds`, `onMissionArrival` arrival paths, `publishWorldMemory`, projection invalidation, `readsForPrivateEvent`, `/api/galaxy` REMEMBERED branch, `recordAgeMinutes`, disc label, launch sheet, D127.

## World, season & social

### D21 · Account identity and seasonal placement — OWNER DECISION

Rule: Authentication is username/password with lowercase uniqueness and scrypt; email/recovery are not part of the account model. One account has one seasonal commander in one galaxy; that commander owns a capital and may own colonies under D97, while admission/capacity are governed by D99–D100.
Binds: Auth, account/player schema, season placement, server admission.

### D60 · Population is a live aggregate — OWNER INSTRUCTION

Rule: `/api/season` carries the public online count using the same presence window as server selection; it is refreshed independently of shard gameplay invalidations because presence has no single publishable event. Presence writes are rate-limited so aggregate freshness does not create a shard-event storm.
Binds: Season API, presence tracking, server list, galaxy HUD.

### D68 · Returning devices lead with sign-in — OWNER DECISION

Rule: Signing out returns with sign-in emphasized, and a device-local returning hint may change which front-door action is prominent. The hint never authorizes or blocks anything; both sign-in and rehearsal remain reachable and the server remains the sole authority on account/placement.
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

Rule: The leaderboard contains the caller's whole galaxy, orders by rounded Dominion descending with deterministic join/id tiebreakers, and is about competitive score rather than development. D127 governs world/development fields: current sight publishes current capital identity/tier, REMEMBERED publishes the frozen probe tier, and UNKNOWN omits capital identity/tier. Commander names remain interactive, but an UNKNOWN row produces an undiscovered-location warning and never requests camera focus.
Binds: `/api/leaderboard`, Dominion, SSE score invalidation, D127.

### D77 · Galaxy chat is seasonal and server-authored — OWNER INSTRUCTION

Rule: Chat is scoped to one season, author identity and timestamp are server-authored, reads are cursor-paginated, writes are transactionally rate-limited and unread state counts only other commanders after the durable read marker. Realtime events announce only that the scoped chat projection changed and reveal no message payload publicly.
Binds: Chat tables/API, season wipe, SSE, unread badge, identity.

### D85 · Season freeze is atomic and permanent — FRONTIER PREREQUISITE

Rule: Season freeze serializes on the season row with lock order season → planet, refuses to finalize while flight/mining state remains unresolved, then server-side blocks all world mutations while leaving the frozen galaxy readable. Final results are immutable account-scoped records using the live ladder's ordering and survive deletion of seasonal player/world rows.
Binds: Season-end event, mutation locks, `season_results`, launch end guards, frozen API behavior.

### D86 · Season ending is a story, not a claim — OWNER DECISION

Rule: A frozen season presents the server-authored result as a recap over the still-readable galaxy; closing it is acknowledgement, never a reward claim. “Explore the final galaxy” exists only during that frozen season's five-minute readable afterglow; a historical recap opened over an already-live successor closes through its prominent close control and carries no galaxy action. The recap grants no resources, unlocks, research or inherited power and remains reachable as history.
Binds: Season API/result payload, recap UI, acknowledgement storage, progression boundaries.

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

Rule: A seasonal commander owns one protected CAPITAL and up to three COLONY worlds, with colony capacity derived from the highest controlled Core and never reduced retroactively; neutral worlds are acquired through ordinary combat plus a public settlement race. Capitals cannot be abandoned/captured, colonies may transfer/capture under the strategic rules, and same-commander transfers move mobile ships/resources but not ground defence. A same-commander transfer is one-way whether its hold is empty or loaded. It reroutes home only if the destination changes owner or fills its Hangar/Prospector capacity while the fleet is airborne, and the commander is notified when that return begins.
Binds: Ownership schema, colony capacity, neutral claims, transfers, Wealth, strategic capture.

### D99 · A galaxy admits 300 commanders — OWNER INSTRUCTION

Rule: New production seasons use a 300-commander stored capacity and deterministic neutral supply sized for that topology; existing seasons keep the capacity they were created with. 300-seat admission is allowed only after the production HTTP/SSE/worker/mobile/soak certification defined in deployment testing passes.
Binds: Season bootstrap, admission, world generation, load certification, deployment docs.

### D100 · Production opens at most two galaxies — OWNER INSTRUCTION

Rule: Production exposes at most two current 300-seat galaxies and fills them strictly by ordinal; the second opens admission only after the first is full. Older higher-ordinal rows may remain for referenced history but are not selectable/admissible production worlds.
Binds: Server selection, admission, bootstrap/rollover, historical shard rows.

### D102 · Isotope concentration is deterministic — OWNER INSTRUCTION

Rule: Isotope eligibility keeps its deterministic base-plus-bonus seam cadence, currently 11 eligible indexes per 90 via one extra seed-shifted seam per ten lanes; concentration is independently derived as a whole-percent 10–25% value from season seed + asteroid index without consuming shared galaxy RNG. Deuterium replaces Alloy rather than increasing total ore, and server/simulator/entitled clients must derive the same result. Concentration changes do not implicitly change isotope cadence or D110's overall asteroid-arrival cadence.
Binds: Asteroid generation, isotope reads, mining settlement, simulator.

### D103 · Rival commits on first shared interaction — OWNER DECISION

Rule: A Rival may change only until the first recorded probe, battle or Death Star impact between the pair; that first shared interaction commits the Rival for the season. Strategic strikes enter the same durable encounter history with an idempotent value/damage record.
Binds: Rival service, probe/battle/strategic history, season results/recap.

### D105 · Strategic impacts remain reconstructible during the public effect — OWNER DECISION

Rule: Death Star impact is a server-clock public event keyed by mission identity; after resolution the anonymous contact persists for the bounded impact-effect window so reconnecting/restored clients can reconstruct the same effect. Public reconstruction never reveals owner/origin and ends at the strict effect boundary.
Binds: Strategic traffic, SSE/resync, client effects, server clock.

### D110 · Asteroid arrival increases without moving the old field — OWNER INSTRUCTION

Rule: Asteroid supply is increased by 15% through a second deterministic arrival lane while the original deterministic lane remains unchanged. Balance edits to supply must not move/delete targets that would otherwise have existed.
Binds: Asteroid generator, season seed/indexing, simulator.

### D111 · Claim duration derives from the widest settlement flight — OWNER DECISION

Rule: Neutral claim duration is derived from the maximum valid two-Hauler settlement flight across `GALAXY_SPAN`, rounded up, rather than hard-coded. Any change to galaxy geometry, travel or Hauler speed automatically changes the window; current D129 geometry yields the derived value.
Evidence: A fixed 30-minute window excluded more than half of valid capital-neutral pairs after the earlier galaxy expansion, turning distance into a hidden eligibility gate rather than a race advantage.
Binds: Strategic rules, neutral claim UI/API, geometry/travel constants, simulator.

### D112 · Expired claim windows reopen; live windows never extend — OWNER INSTRUCTION

Rule: A decisive conventional raid opens a neutral claim window only when none exists or the previous one expired. Repeated raids cannot extend an active window; each window remains public and first atomically valid settlement wins.
Binds: Neutral combat, claim state, settlement validation, simulator.

### D113 · Death Star is the authoritative strategic strike — OWNER INSTRUCTION

Rule: Death Star Protocol and craft require Core 12; the craft also requires Shipyard 5 and builds for 60 minutes. Impact destroys all home ships/ground guns, halves stored and in-process resources, reduces Core by one and Aegis by two, clears shield, cancels queued BUILDING orders without refund and imposes two-hour recovery; away craft, commander research and orbit hardware survive, and Core loss clamps any building above `CORE_CEILING`, including the Deuterium Refinery. Control may transfer only for a Death Star stamped at launch as a capture attempt against a neutral/player colony already in recovery (with capacity reserved); capitals never transfer. A research order funded there remains with the commander who bought it and never completes into the captor's account.
Binds: Strategic research/assets, combat/economy settlement, building/research queues, Core ceilings, recovery/capture, colony capacity, UI explanation.

### D114 · Clans stay a thin seasonal coordination layer — OWNER INSTRUCTION

Rule: A clan is seasonal, galaxy-local and capped at five; membership immediately grants current member/world identity, private chat and friendly-fire protection, while every commander's Telescope/Radar spheres and the intel earned through them remain private. Aid/shares/score-history mature after the defined delay and former members receive ceasefire/join restrictions; there is no shared radar, combat buff, clan research/levels, treasury or cross-season power. Aid is physical: a convoy carrying resources deposits them and returns its ships to the launch world, while an empty convoy is an irreversible ship gift. Self-aid is invalid, arrival revalidates membership/control and the applicable gift prerequisites/allowance, and quotes expose only remaining allowance plus next expiry—not aggregate production/capacity or other private state. Historical battle/report clan identity is an immutable launch-time snapshot while anti-abuse quota commitments may rebind within their live anti-bypass window; private clan SSE invalidates only scoped reads and never publishes private payload.
Binds: Clan membership, combat/anti-abuse, aid transfers/quotes, chat, score/history, SSE/privacy, season rollover.

## Interface authority that changes gameplay understanding

### D140 · Research is commander-wide and has its own surface — OWNER INSTRUCTION

Rule: Research lives on a commander-level surface, exposes the single commander-wide active slot, groups projects by Frontier/Industry/Doctrine/Strategic, and shows absolute completion time for long queued work. Maximum sellable level is derived from the last rung that changes the effect, and dependency navigation must route to this surface rather than a planet tab.
Binds: Research panel/navigation, queue projection, research max levels, D134/D137.

### D141 · Everything the server sells must be reachable — OWNER INSTRUCTION

Rule: IDs accepted by server boundaries are generated from authoritative rules catalogs rather than hand-copied enums, and every server-sold building/hull/instrument/satellite/research/strategic action must have a reachable player control. A locked row must state the reason and provide a route to resolve it; capacity/state that governs a purchase must be visible before the user commits.
Binds: Route schemas, contract tests, catalogs, planet/research/clan surfaces, capacity components.

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

## Known authority gaps

- **D127 vs Chronicle:** Chronicle `core_tier` milestones can reveal named-world development galaxy-wide. Whether a public milestone legitimately overrides D127's earned-map rule is unresolved.
- **A11 terminology:** “unlock” is used both for history-derived discovery/announcement and for hard availability gates such as Uplink/research prerequisites. Until names are split in code/docs, agents must preserve the distinction above rather than merging their storage semantics.
