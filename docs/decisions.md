# Decision Log

This file contains only current authority that would be expensive to re-derive. If implementation and this file disagree, investigate the discrepancy before treating the code as correct.

Entries contain only the current rule, optional evidence worth preserving, and what the rule binds. Narrative, incidents, rejected experiments, visual implementation, deployment procedure and volatile balance tables belong in their specialist docs, tests or git history. Decision IDs are stable; removed or merged IDs are intentionally absent and must not be reused.

Precedence inside this file is explicit: master decisions named in a rule own that subject. Numeric values that are tuning rather than invariants live in `@astera/rules` / `docs/balance.md`; this log records a number only when the number itself is the decision.

## Product & game invariants

### D1 · Core tension: information game — LOCKED

Rule: The core game is seeing without being seen. Fleet allocation supports that information game; Telescope, Radar, Explorer and Veil are core systems, and the 3D galaxy is the interface rather than a target list.
Binds: Intel progression, combat complexity, galaxy interaction model.

### D2 · Score = Dominion — LOCKED

Rule: `raw = looted + enemyDestroyed - ownDestroyed`; Dominion transfer = `round(10,000*tanh(raw/10,000))`. Combat-only, zero-sum, max ±10,000 per battle. `fleetPower` never scores combat.
Binds: Combat settlement, leaderboard, season results, reports, simulator.

### D5 · Season = 14 days — STRUCTURE LOCKED, NUMBER PROVISIONAL

Rule: Seasons are finite and currently fourteen days. The duration must be re-derived if the progression curve materially changes.
Evidence: Seven days did not expose the intended mid-game; fourteen days gives two weekend windows under the current progression target.
Binds: Season lifecycle, pacing, balance acceptance tests.

### D20 · Galaxy is the primary surface — OWNER DECISION

Rule: The galaxy fills the game surface; management screens open over it rather than replacing it with a conventional tabbed app. Focus is the base interaction and must expose only information the commander is entitled to know, including source and staleness where relevant.
Binds: Galaxy shell, focus system, navigation model, intel presentation.

### D56 · Rehearsal is the real game before account creation — OWNER INSTRUCTION

Rule: `/api/preview` is write/seat-free and uses the real public-galaxy projection. Rehearsal uses production contracts, `START` + shared fuel; claim creates `PLANET_START`, then replays intents through normal services. Retry with same credentials recovers the created account; replay only on untouched world. A refused replay step never rolls back account/planet. Guidance/skip changes commitments only, never navigation, exit or final claim.
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

Rule: D148 retires Breacher name; Nullifier inherits its specialist rule: bonus only vs live Aegis, capped by remaining shield, never spills into ships/ground defence. Without shield it must be a poor generic choice.
Binds: Nullifier, Aegis, combat, reports.

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

Rule: Refinery gives guaranteed slow Deuterium; isotope asteroids are faster contested supply. Level is capped by Deuterium Synthesis + Core. Base Deuterium Works/storage exists even at Refinery 0; extra capacity comes from refinery output. Vault protection uses refinery output and is zero at level 0. First Synthesis level requires no Deuterium.
Binds: Deuterium economy.

### D137 · Research tech stays below information advantage — OWNER DECISION

Rule: One pure tech calculation serves server/sim/client; missing tech never silently defaults. Combined military tech product cap=25%; counter cycle stays ~156%. Attacker tech freezes at launch; defender tech reads at combat. Combat doctrines are probe-visible; economy research private.
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

Rule: A trade ship is the calendar's second public event kind (D149) — three appearances per Türkiye day, three hours each, drawn from its own RNG stream so a new lane can never re-deal the Asteroid Shower's; `galaxyEventsRulesetVersion` stays at 4 so the shower keeps seeding on every live season, and the merchant is gated on its own `MULTI_WORLD.tradeShipRulesetVersion = 5` boundary so new seasons alone grow it (D149's calendar immutability, kept literally). Unlike a pirate, which stays behind D123's three sensor zones, its orbital elements ARE published to every commander for the occurrence that is live right now, and only that one: it is an announced public moment, not a fogged craft — the deliberate exception to D127's default that a world's position is earned — and fog hides pre-decision knowledge, never a public live event; the future calendar never leaves the server. It swaps resources at one fixed rate — 90 alloy = 30 crystal = 1 deuterium (`TRADE.rate = { alloy: 1, crystal: 3, deuterium: 90 }`, read as units per resource unit) — set from the measured 3:1 alloy:crystal production parity at the L12 fixed-goal pace (`alloyRate(12)`/`crystalRate(12)` ≈ 3,480/1,134 per hour) with deuterium priced inside the measured 60–160 alloy-equivalent production band, so the rate is generous without making an isotope asteroid worthless against D135's Refinery-floor/rock-ceiling rule; the owner's first proposal of 20:10:1 priced deuterium 3–8× cheaper than producing it. There is no quota, no fee and no per-world convoy limit — owner instruction: cargo capacity, a flight bay and prepaid fuel (D136) are the only brakes, and `trade_runs` deliberately carries no unique index on `(planet_id, occurrence_id)`. `quoteTrade` states `requiredHold = max(outboundVolume, returnVolume)` and `launchTrade` refuses against that figure rather than against the offer alone, because a small offer buying a large haul must fly a convoy sized for the haul home. Speed is fixed at half the Atlas's catalogue figure ÷ `TRAVEL.distanceFactor` (`TRADE.speed`), never the rock band — D155's mistake, guarded against before it could repeat: the Atlas is the slowest cargo hull in the game, so every hold leads the merchant and interception is never a lap of waiting. No combat occurs at the rendezvous and no Dominion moves. The simulator does not model this lane, so its balance may never be read against the standing D134 VFR blocker, and its numbers may not be tuned to make that gate pass.
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

### D14 · No newcomer immunity — OWNER DECISION

Rule: There is no time-based newcomer grace period or development-tier attack band. Protection comes from fog/information cost plus `ABUSE.bashLimit`; server refusal after a fleet is prepared must not depend on hidden development state.
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

Rule: `PIRATE.speedMin/Max` are the hull table's own figures divided by `TRAVEL.distanceFactor` — a Cataclysm's pace to a Dart's pace — so every Skirmisher outruns every pirate and a heavy line cannot lead one. The old 200–420 band was measured against rock speed, but a rock is chased by a Prospector and a pirate is chased by a warship: on one scale it was 240–504, faster than every ship in the game, so `interceptOrbit`'s earliest meeting was the far side of the orbit after a lap of waiting rather than a lead. `pirates.test.ts` asserts both anchors against `HULLS` and holds the median lead under a quarter revolution, the ceiling the rock lane has carried since D40/D121. `/api/pirates` publishes each `reach` row's rendezvous point; it is `distance` and `minutes` stated rather than implied, for a pirate in current sight from a world the caller owns, and the orbital elements stay server-private. The disc draws every open-space aim point through one list (`rendezvousMarks`): a mining interception, an outbound raid's rendezvous, and — while the launch sheet is open — where the selected wing would meet it. Marks never survive the sheet that proposed them, and never mark a target that is an address.
Binds: Pirate lane geometry, `/api/pirates`, launch sheet, disc marks, D40, D124, D142, D150.

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

Rule: Leaderboard contains the caller's whole galaxy, sorted by rounded Dominion with deterministic ties. D127 controls capital intel: current sight=current identity/tier; REMEMBERED=frozen tier; UNKNOWN=no capital identity/tier. UNKNOWN commander click warns and never moves camera.
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

Rule: Isotope eligibility is deterministic, currently 11/90 indexes. Concentration is separate deterministic whole-percent 10–25% from season seed + asteroid index and consumes no shared galaxy RNG. Deuterium replaces Alloy; total ore unchanged. Changing concentration must not alter isotope cadence or D110 arrival cadence.
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

## Known authority gaps

- **D127 vs Chronicle:** Chronicle `core_tier` milestones can reveal named-world development galaxy-wide. Whether a public milestone legitimately overrides D127's earned-map rule is unresolved.
- **A11 terminology:** “unlock” is used both for history-derived discovery/announcement and for hard availability gates such as Uplink/research prerequisites. Until names are split in code/docs, agents must preserve the distinction above rather than merging their storage semantics.
