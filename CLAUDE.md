# CLAUDE.md — Astera Online

Cold-agent operating manual. Read first each session. **Keep this file small:** only cross-cutting rules needed to avoid wrong implementation belong here. Rationale/history/measurements live in `docs/`; local traps live in file docblocks.

## Product

Astera Online is a **mobile-first persistent multiplayer space game** for up to 300 real players per galaxy. One commander owns one protected capital and may capture up to three colonies. Holdings are private until discovered.

> **The fleet is the bet. The information is the game. The planet is the stake.**

Design: **simple to play, deep through interactions—not more systems.**
Feel: **fun, utopian, epic; a live NASA photograph you can fly through.**

Every feature should strengthen at least one of: `OWNERSHIP · CURIOSITY · COMPETITION · AMBITION · RISK · OPPORTUNITY · RE-ENGAGEMENT · MEMORABILITY · FUN`.

The game must feel:

- **Alive:** player fleets, mining, battles, and public moments visibly happen.
- **Now:** server-timed moments appear on time; predict/reconcile instead of waiting on avoidable round trips.
- **Beautiful:** when gameplay cost is zero, favor scale, depth, light, and spectacle.

## Core loop

```text
DEVELOP → ACCUMULATE → GATHER INTEL → SPOT OPPORTUNITY → CHOOSE TARGET
→ TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Battle reports create new intel. Economy/buildings support this loop; they are not the loop.

## Source of truth

Higher wins:

1. Locked constraints: mobile-first portrait, three-person team, web first, persistent real-time world, one commander, one capital + up to three colonies, server authority.
2. `docs/game-design.md`
3. `docs/decisions.md`
4. Code
5. `PROVISIONAL` guidance
6. Agent preference

Code is not automatically correct. Confirm the authoritative decision. If locked behavior changes, update docs/invariants with the code.

## Non-negotiables

- Client sends intent and renders state; **server decides outcomes**.
- Fog is enforced in queries, never only UI.
- Ordinary raids never damage buildings. Death Star strikes affect only named levels. Capitals cannot be captured; non-capitals transfer on a second hit.
- Launched fleets cannot be recalled.
- Watching is silent; probing is loud.
- Information has a price and a cost of use; knowing may reveal the knower.
- Combat stays simple and low variance (**±8%**); skill belongs in the information layer.
- Fog hides pre-decision knowledge, **not public live events**.
- A rule the player cannot **see** is not a usable rule (D124). The intel layer must be legible in the 3D galaxy.
- The world is live; the UI never waits for it. Use authoritative times, prediction, reconciliation, broadcasts; polling is fallback (D53).
- Preserve a reason to return after each session; D63’s shorter flights still need playtest validation against this goal.

## Critical gameplay invariants

Rationale/evidence: `docs/decisions.md`. Numbers/simulator history: `docs/balance.md`.

### Score / balance

- Score is **Dominion**, not wealth. Wreckage is Wealth only.
- Battle Dominion transfer: max 10,000 via `round(10_000 * tanh(rawExchange / 10_000))`; sides receive exact opposites.
- Never widen a balance/health band to make a feature pass; fix model/constants.
- Research military effect has a **25% combined product ceiling**; counter cycle remains 156% (D137).
- Combat-relevant doctrine must be probe-visible. Attacker tech freezes at launch; defender tech reads at fight time (D137).
- Price hulls by `atk * hp / value²`; preserve equal-budget power.
- `START` = Core/Refinery/Extractor L2 + the active ruleset's two guided-opening Skirmishers (Wasps before Fleet V2; Darts after D148). `PLANET_START = START + OPENING_BONUS`; `untouched()` uses `PLANET_START` (D58/D148).
- `DEBRIS.share < 1`; ground defence salvage = 60%; ground hulls leave no wreckage.
- Vault protection is < half capacity and uses each resource’s own production floor.
- Deuterium capacity uses both industrial/mining base and refinery contribution (D138).
- Capture never cancels or transfers commander-wide research (D134).

### Combat / fleets

- Support hulls are shielded while combat hulls live.
- Fleet V2 base speed is D148's table ×1.25; `SHIP_PROPULSION` is four rungs of +25% to a ×2 ceiling and reads its own `propulsionMaxLevel`, never the weapon ladder's. Speed takes no share of the 25% combat product ceiling and is not probe-visible. The probe and the Prospector took neither the lift nor the research (D152).
- Probe base speed is D152-era ×0.75 (3,510); the Prospector keeps its rock-tied number. A slower probe pays more for distance, which is what D121's ceiling on FLATNESS wants (D153).
- Two opposing ground-gun classes; cheapest available at Shipyard 0.
- Raid arrives at authoritative `arriveAt`; engagement lasts 10s as real `in_flight` state.
- A fleet reaching target always fires.
- Death Star halves resources, lowers only Core + Core-dependent ceilings + Aegis by two, cancels building scaffolding without refund, and is consumed by its strike (D105/D106/D113).
- Death Star defence fires only on the defender’s **visible timed Radar circle** with Radar 3 + Uplink (D139).
- Strategic weapon and charge are separate typed assets; all strategic-asset flows handle both (D139/D140).
- Fuel is paid once at launch: full fuel or no launch; no later charge/refund. Probes/mining burn no fuel (D136).
- Fuel mass is Hangar bulk × the hull tier's thirst rung — ×1/×2/×4/×5 for tiers 1–4. `FUEL.tierMass` multiplies fuel mass ONLY; `bulk` stays Hangar room and no hull price moves. Tier 1 is excluded, so the opening costs what it always did (D153).
- Flight time = distance / speed; `travelExact` is canonical, no fixed overhead (D121).
- A planet owns at most two Prospectors wherever located; `prospectorRoom` is the single capacity arithmetic and legal overflow is never retroactively deleted (D131).
- Count flight bays under the planet row lock.
- Pirates are the third target class and cost exactly what a raid costs: a bay, both legs of prepaid fuel, doctrine frozen at launch, origin `AWAY` for the trip. One raid per origin world per pirate, DB-enforced (D150).
- **A raid's return follows its commander, never the pad.** `pirate_raids.ownerPlayerId` is who committed the fleet; delivery resolves through `safeHomePlanet`, like every other return leg. A world captured mid-flight must never receive somebody else's squadron, hoard or towed hull (D150).
- `SELECT … FOR UPDATE` cannot lock a row that does not exist. Seed `pirate_state` before locking it, or two first hits on one pirate both fight a full crew and pay the hoard twice (D150).
- A pirate moves **zero Dominion** — `bookBattle` is never called. Its only modifier is a per-level attack `damageMult` on `CombatSide`; never HP, never research (D150).
- Capture pays only on DECISIVE, from the pirate's ORIGINAL roster, and lands even over Hangar capacity; `builtEver` never moves (D133/D150).
- Mutual annihilation pays nothing and flies no return leg.

### Intel / fog

- Public world data is **position only** unless earned (D127).
- Telescope reads are deterministic per `(watchId, timeWindow)`; refresh cannot reroll fog.
- A world's record is **what you last had eyes on**, and a fleet is eyes: every arrival that puts your craft at a world rewrites it (D151). It freezes again the moment the craft leaves, never resolves the world, always carries `seenAt`, and belongs to the visitor alone — the defender learns nothing about the attacker's world. A battle records `silhouetteOf` only; doctrine and the interceptor pad stay probe-only (D127/D151).
- **A probe delivers everything it took.** Stock, deuterium, defence, fleet size, the weapon on the pad, the interceptor charge and the target's combat doctrine all reach the dossier with their age. A reading collected and not shown is the most expensive bug this project can have — the player paid for it.
- `rememberWorld` is the only writer of a world record and the only publisher of `private:memory`; a new craft that reaches worlds goes through it or the map serves a stale record from a warm cache (D151).
- **A published window never names the destination except inside one refetch** (`TRAFFIC.refreshMs`). That floor is the client's poll interval and is shared, not restated: when the two drifted, every probe in the game published the world it was flying to.
- **The radar log is commander-wide**, each row gated by the radar of the world it happened to and naming that world. An `incoming` warning names the defended world too — that is the reader's own world, never a radar product.
- Public recovery/claim clocks remain available through fog, but the green claim
  ring is a current-sight reading and renders only on a `RESOLVED` world.
- No invisible attack development band; only `bashLimit` remains (D127).
- **THREE ZONES, AND `packages/rules/src/sight.ts` IS THE ONLY STATEMENT OF THEM.** A craft is `NONE` outside every circle (it does not exist for that commander), `CONTACT` inside a Radar circle (a moving question mark), `IDENTIFIED` inside a Telescope circle (the craft itself, never its route). Server filter, client crossing solver and every test read `sensorZone`; nothing else may hold an opinion.
- **Radar detects, Telescope identifies.** Radar out-reaches Telescope at every level and is what makes the galaxy visible at all; Telescope is what names what is in it. Radar 0 detects nothing — the free floor belongs to the eye (`SENSOR.baseRadius`), not to hardware nobody bought.
- `sensorSphere` is the only place an instrument level becomes a radius.
- **A pirate is a craft, not a rock: it is never remembered.** Nothing on that lane reads or writes `sensor_epochs`; leaving a commander's circles ends its existence for them, and launching requires live sight. Its orbital elements are the route and are never published; a pirate's window is `PIRATE.bearingMs`, derived from `TRAFFIC.refreshMs` and never typed (D150).
- **There is no departure shroud.** A craft is visible from the first instant of its leg to anyone whose circle covers it. Nothing about where a craft STARTED may enter the answer.
- Telescope reach stays below the galaxy radius; the identifying fog never fully disappears (D126). The Radar's wider ceiling is deliberate — a mote you cannot name is not omniscience.
- Radar `CONTACT` exposes no roster: L4 adds `mass`, L5 names its `silhouette` kind, and its generic formation has no count pips. Telescope `IDENTIFIED` is actual sight: a fleet carries its exact manifest and renders the real hull assets with exact-count pips (D123).
- Every craft, including an engaging fleet and a mining/salvage Prospector, stays zoned. The live bombardment/impact effect and wreckage remain public at any range; an out-of-range engagement carries no craft point, bearing or mass (D52/D123).
- Radar is a **radius**, not a countdown. Use craft position, never route length (D49/D126).
- **PROVISIONAL — the two radar circles are MERGED.** `radarContactRange === radarRange` on the owner's instruction while the visibility engine settles. That suspends D9: a raid inside 2,200 units hands over its whole flight. Splitting the table back is the entire fix; `packages/rules/test/intel.test.ts` asserts the merge so it cannot be forgotten.
- Defender Radar level is read when warning fires.
- Core orbit slots open at 1/3/5/9; Uplink gates only Telescope/Radar.
- Contacts expose bearing windows, never routes/destinations except explicit mining/salvage/landed exceptions.
- Asteroid schedules/indexes stay server-only. A caller receives a rock and its mining route only after one owned sensor sphere has discovered it; discovery persists until the rock is gone.
- `legBelongsTo` is the only ownership definition: outbound → origin, return → target (D72).
- `/api/leaderboard` publishes score/commander identity galaxy-wide, but capital
  identity and tier only under current sight or frozen probe memory (D76/D127).
- Fog belongs in the QUERY. `scan_detected` once carried a bearing the UI merely declined to draw; the payload is the boundary, not the renderer.

### World / queues / research / clans

- One account → one commander → one galaxy; galaxies fill in order; one capital + max three colonies, DB-enforced.
- Three independent queues, depth 3: world-local `CONSTRUCTION`, world-local `YARD`, and commander-wide `RESEARCH`. Cost commits on order; Construction/Yard cancellation refunds half, Research cannot be cancelled, system fault refunds all; gates use projected same-queue state (D4).
- Research belongs to the commander, not the funding planet; capture neither cancels nor transfers it (D134).
- Instruments/research stop where effect tables stop; derive max levels from effects, never duplicate ladders manually (D140/D141).
- Refinery is deuterium floor; rocks are contested ceiling. Plant level is capped by research rung (D135).
- Mined ore lands in `WORKS`, not storage.
- Notifications are idempotent by `(player_id, kind, ref_id)`.
- Broadcast only when referenced **public** payload changes; hidden changes must not leak timing (D53).
- Reports identify the actual fought-over/owned world and use immutable clan snapshots.
- Clans: five seats, one galaxy, one season; friendly fire, 24h exit ceasefire, bounded aid, 10% personal docked-loot share, PvP-derived score; no treasury/buffs/levels/diplomacy (D114).
- Clan membership reveals current teammate/world identity, never another member's sight.
- Clan aid targets another commander and exposes only remaining allowance; loaded transports
  return to their launch world, while empty convoys are one-way ship gifts.
- Lock players before planets; two-planet operations lock planets in ascending ID order (D134).
- Refuse startup if code is ahead of DB (`assertSchemaCurrent`); never race migrations across replicas.

## Client contracts

Detailed UI rules: `docs/interface.md`, `docs/visual-design.md`, i18n files, local docblocks.

- First tap focuses world; second tap on focused owned world opens management (D118).
- Contract-test every route the client parses. Never pre-encode bodies; `send()` serializes.
- Mutations return a complete authoritative planet view equal to GET, in the same transaction (D53).
- Predict only deterministic outcomes; writes cancel reads they supersede.
- Preserve structural identity for equal payloads/Dates; keep `GalaxyView` props stable.
- One fleet = one authoritative clock: use `arriveAt`; moving visuals use `serverNow()`, never device time (D51/D52).
- Stale craft clamps at destination; wake/refetch at authoritative moments. Coasting never passes arrival.
- Owner/stranger visuals share the visual-leg rules in `packages/rules/src/view.ts` (D106).
- Reconnect triggers resync; SSE has no backlog cursor (D72).
- Public effects publish moment + place (`engagement`, `impact`).
- Loading/error/empty are distinct; loading never blocks an already-playable scene.
- Quantities players must judge are **drawn**, not only written (D142).
- A record's age has one definition — `recordAgeMinutes` — and every surface that prints one reads it. The disc label and the launch sheet both state it; neither may show a frozen record as though it were a live reading (D151).
- Research is a commander menu, derived from rules IDs; disabled rows explain the reason and route to the fix (D134/D140/D141).
- User-facing strings live in `apps/web/src/i18n/locales/`; format numbers/dates/clocks through shared formatters. Write Turkish naturally and never naïvely case-fold `İ`.
- Returning players skip onboarding; `/api/preview` is seat-free and writes nothing (D56/D68).
- Camera moves only on explicit instruction; refetch identity changes must not reframe (D69).
- Automatic craft focus follows a craft **out and never home**. A return leg is a new mission row, so `reconcileOwnCraft` reads `leg`/`status` and baselines a homebound craft without ever moving the camera (D153).
- A world's drawn size is a geometric ramp over its **exact Core level** through the three authored sizes (0.44 / 0.82 / 1.40 at Core 1 / 11 / `CORE_TOP_LEVEL`), clamped both ends. The coarse tier keeps only the three `worldWeight` words and D49's ±2 band; every standoff caller reads the level. Dyson shells start at Core 12 and end at the same `CORE_TOP_LEVEL` (D153).
- Read a file’s docblock before editing, especially 3D/harness files.

## Server / engineering / production

- Server computes resources/fleets/combat/travel/cooldowns/loot/progression in transactions using `@astera/rules`.
- Continuous state = lazy evaluation; moments = scheduled events. No global tick/per-planet loop. `WORKER_POLL_MS = 1s` because visible timing matters.
- Do not store formula/time-derived values such as fleet positions, asteroid coordinates, resource ticks.
- Mutation order: **lock → advance economy → validate → mutate → commit → emit**.
- Timed systems must tolerate restarts, retries, duplicates, concurrent arrivals, and mid-transaction failure.
- `packages/rules` has no deps, clock, I/O, or ambient randomness. Put cross-process behavior there.
- Simulator never prices benefits it does not model; interception uses continuous `travelExact`.
- Client/API share one origin. `VITE_GA_ID` is build-time. Register routes inside `app.after()`. Rate-limit refusals are `GameError`s.
- `TRUST_PROXY` only on proxy-only ports.
- Reclaim idle seats while preserving accounts, but never reclaim a world referenced by an airborne mission.
- Run migrations before new app image. `/health` reports; it does not repair. Production uses `docker-compose.prod.yml`.

## How to work

> **IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE**

Decide architecture, libraries, queries, caching, components, internal APIs, tests, and small reversible UX details yourself.

Ask only before changing **core loop, risk/reward, PvP, ownership, seasons, progression, identity, or locked constraints**.

Do not reopen settled questions, polish docs indefinitely, wait for certainty, or redesign working systems speculatively.

If context is lost: `CLAUDE.md → docs/decisions.md → docs/balance.md → code → git log`. Never guess.

### Development discipline

**Tüm geliştirme veya güncellemeleri Test Driven Development methodu ile yapmak zorunlu, şart!.**
**Tek kelime bir kod dahi yazılıyorsa bu method'u uygulamak ZORUNLU, ŞART!**

1. Requirement'ı analiz et
2. Edge case'leri çıkar
3. Önce testleri yaz/güncelle/ekle
4. Testleri çalıştır → FAIL
5. Implementation yaz
6. Testleri çalıştır → PASS
7. Existing test suite çalıştır
8. Refactor (gerekli ise)
9. Tekrar tüm testleri çalıştır

### Change discipline

> **Change only what was asked.**

Forced adjacent change: report why, record it in decision/local comment, and prove it with measurement/test/simulator. Otherwise leave it alone. Update docs with code; remove stale guidance when systems retire.

### Scope

- Name the core-loop problem before adding a system.
- Preserve gameplay; simplify implementation, not the intended game.
- If behind, cut: **asteroids → Radar L4–L5 → Aegis → cosmetics**.
- Never cut **Telescope, Explorer, Radar, Veil**.
- Post-MVP: alliance diplomacy, inter-clan treaties, active deception, fleet interception, combat replay, monetization. D114 clan/chat is the bounded exception.

## Quality bar

> **CODE WITHOUT TESTS IS UNFINISHED WORK.**

```bash
pnpm verify
```

Required: zero type errors, zero lint errors, expected tests green.

`pnpm lint` gives type-aware ESLint a 4 GB Node heap through the root script. The full workspace
regularly exceeds Node's 2 GB default; do not bypass the script with a bare `eslint .` invocation.

- Ban `any`/compiler-silencing casts; parse untrusted boundaries with Zod.
- Diagnose root cause before changing code/tests.
- Test adversarial input, concurrency, failure, and time.
- No silent placeholders in core gameplay.
- Visually verify frontend changes with `node tools/visual.mjs`.

A new system must create a meaningful decision and strengthen interaction/risk/opportunity/curiosity/return reason without unnecessary micromanagement. If uncertain: **PROTOTYPE → PLAY → OBSERVE → DECIDE**.

Regression signals: loop becomes `BUILD → WAIT → COLLECT → UPGRADE`; resources replace players as the fun; intel→decision→action weakens; micromanagement grows; result is technically impressive but emotionally empty.

## Current state

Core game is implemented through D153: shared rules/sim, backend, persistent galaxy, accounts, economy/queues, fleets/combat/loot, intel/Telescope/Radar/Veil, probes, mining/wreckage, public galaxy events/Asteroid Shower, pirate fleets, engagement, notifications/SSE, 3D galaxy, TR/EN, preview/onboarding, deployment, rewards, realtime/camera fixes, clans, deuterium/fuel/hangar, commander-wide research, strategic weapons, fleet-written world records, D152 fleet speed, D153 world-size ramp/tier fuel/probe speed/outbound-only camera follow.

D150 shipped without void wreckage: a pirate battle books its wreck value on the report but leaves no harvestable field, because `debris_fields` still requires a planet. That migration is the deliberate second commit.

Baseline near D140: **0 type errors · 0 lint errors · ~2,900 tests**.

### Current blocker

`pnpm verify` is green except the **D134 separate-Research-queue balance regression**: VFR is LOW on all five fixed seeds. A direct A/B run proves `17c515b` was 69/69 green; applying only the accurate third-lane simulator produces seven failures, while the requested asteroid/hull Crystal changes reduce that set to the five VFR failures. This is not a slow-machine or flaky-test issue.

- Do **not** widen bands.
- Read **D133 before touching Hangar constants**; height was already swept and is not the mechanism.
- Do not tune combat/capacity against this gate.
- Failed levers: `docs/balance.md`.
- **Do not tune against current simulator pacing.** Bots still use async-era `loginsPerDay`; current ARR is indicator-only.

### Largest gap / next

**Real playtesting is the largest gap.**

1. Play two days on real phones; log `docs/playtest-log.md`.
   - probe/Telescope before attacks ≥ 50%
   - sessions ending with something in flight ≥ 80%
   - watch for an “empty at distance” disc; `SENSOR.baseRadius` is the dial
2. Re-derive simulator for real-time pacing.
3. Add asteroid impacts + Drill; generate/store, never schedule.
4. Wire launch idempotency; `request_log` exists but is unused.

## Known issues / traps

- `request_log` exists; launch/order idempotency is unwired.
- `PROVISIONAL`: vault floor, disruption duration, shield curve, season length, asteroid parameters → resolve by playtest.
- SQL hard-codes queue slots `BETWEEN 0 AND 2`; `BUILD.queueDepth` change requires migration.
- Captured colonies keep world-local build orders; commander research stays with its buyer (D134).
- Simulator bots lack skill variance; do not tune ladder spread against them.
- `season_end` exists; handler does not.
- After `packages/rules` changes, restart **both** dev servers.
- Tailwind v4 uses `--color-alloy`, not `--alloy`.
- Three.js camera assumptions matter; `Dust` expects camera outside a 20-unit disc.
- Drizzle `sql` cannot bind JS `Date` through postgres.js.
- Adding an `apps/web` dependency requires Vite restart after re-optimization.
- `RETURNING` does not preserve a subquery `ORDER BY`.

## Docs map

| File                            | Read before                          |
| ------------------------------- | ------------------------------------ |
| `docs/product-vision.md`        | Judging product purpose              |
| `docs/game-design.md`           | Changing system behavior             |
| `docs/decisions.md`             | Reopening settled behavior           |
| `docs/balance.md`               | Changing numbers / simulator tuning  |
| `docs/architecture.md`          | Server architecture                  |
| `docs/deployment.md`            | Shipping / operations                |
| `docs/engineering-standards.md` | Writing code                         |
| `docs/interface.md`             | Screens / interaction                |
| `docs/visual-design.md`         | Art / 3D                             |
| `docs/playtest-log.md`          | Playtesting                          |
| `docs/review-sight.md`          | Touching Telescope/Radar/probe sight |
| `docs/glossary.md`              | Terms                                |

## One thing to remember

> **Build a multiplayer game that leaves players wondering, “What happened?” after they close it.**
