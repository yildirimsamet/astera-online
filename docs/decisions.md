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

### D149 · Public galaxy events are immutable seasonal moments — OWNER INSTRUCTION

Rule: Each season has a hidden deterministic public-event calendar. Asteroid Shower: 60m, ×5 new asteroid arrival only, exactly 5 starts per full Türkiye day, ≥120m gap after end; 00:00–08:00 is low-priority (target 1, max 2), not blackout. Ending affects future arrivals only. Players see active events, never future calendar/hidden coordinates.
Binds: Event scheduler, asteroids, D143.

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

Rule: Pirates are deterministic NPC fleets on closed seeded orbits; they never attack or move Dominion. Raid needs live sight, bay/fuel, frozen doctrine, max one origin-world attempt per pirate. Visibility is NONE/CONTACT/IDENTIFIED only: no memory, route or orbit disclosure. Combat modifier is attack-only `damageMult`. DECISIVE may pay survivor-cargo-capped hoard, two-sided debris and one hull drawn from the crew actually fought; mutual kill pays nothing. Persist raid + cumulative losses/destruction; seed `pirate_state` before `FOR UPDATE` so first-hit concurrency is safe. Void debris owns `x/y/z`; returns follow commander via safe home, not origin ownership. Engagement uses shared `ENGAGEMENT_STANDOFF=2.2`; pirate reports omit world/Aegis fiction and include `damageMult` + captured hull. Commander ownership, not the origin pad, decides which mission strip draws a raid and whose own-craft exclusion hides it. A live engagement publishes its flash at any range as one `effectOnly` row per side, carrying the rendezvous and never the attacker's hold, while craft visibility stays on the three zones. Committing a fleet at a pirate uses `LaunchSheet`, the same surface a world raid uses; the rail only describes and offers. The outbound leg stays server-solved per hull and the two legs are summed rather than doubled.
Binds: Pirates, combat, debris, returns, reports, traffic fog, launch surface.

### D151 · A fleet is eyes — OWNER INSTRUCTION

Rule: REMEMBERED is the last time observer had a craft at that world, not probe-only memory. Raid/neutral battle/strategic strike/settlement arrivals write `silhouetteOf`; transfer/clan-transfer do not. Memory stays frozen, visitor-only, newest-look wins and keeps `seenAt`. Battle visits never infer probe-only doctrine/interceptor data. `rememberWorld` is the single writer and publishes private-memory invalidation; record age uses one shared calculation.
Binds: World memory, D127.

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

Rule: Neutral claim duration = rounded-up maximum valid settlement flight across `GALAXY_SPAN`, derived from settlement fleet speed/geometry, never hard-coded. Geometry or travel-speed changes automatically change the window so every valid capital can compete.
Binds: Settlement claim, travel/geometry, simulator.

### D112 · Expired claim windows reopen; live windows never extend — OWNER INSTRUCTION

Rule: A decisive conventional raid opens a neutral claim window only when none exists or the previous one expired. Repeated raids cannot extend an active window; each window remains public and first atomically valid settlement wins.
Binds: Neutral combat, claim state, settlement validation, simulator.

### D113 · Death Star is the authoritative strategic strike — OWNER INSTRUCTION

Rule: Death Star needs Core 12; craft also Shipyard 5 and 60m build. Hit destroys home ships/ground, halves stored+Works, Core-1, Aegis-2, clears shield, cancels BUILDING queue without refund, recovery=2h; away craft/research/orbit survive. Core loss clamps buildings to `CORE_CEILING`. Capture only if launch-stamped against recovering neutral/colony with reserved cap; never capitals. Funded research stays with buyer.
Binds: Strategic strike.

### D114 · Clans stay a thin seasonal coordination layer — OWNER INSTRUCTION

Rule: Clan is seasonal, same-galaxy, max 5. Members share identity/worlds, chat and friendly-fire protection; sensors/intel stay private. No shared radar, buffs, clan tech/treasury or cross-season power. Aid/share/history mature after configured delay; leaving applies ceasefire/join limits. Resource aid deposits then ships return; empty convoy gifts ships. Arrival revalidates membership/control/allowance; quotes expose allowance/expiry only. Battle/report clan identity freezes at launch; anti-abuse quota may rebind only inside its live window. Private SSE sends invalidation only.
Binds: Clans, aid, anti-abuse, privacy.

## Interface authority that changes gameplay understanding

### D140 · Research is commander-wide and has its own surface — OWNER INSTRUCTION

Rule: Research has a commander-level surface with the single commander-wide active slot, groups Frontier/Industry/Doctrine/Strategic, and shows absolute finish time for long work. Max level is last effectful rung. Dependency links route here, not to a planet tab.
Binds: Research UI, D134/D137.

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
