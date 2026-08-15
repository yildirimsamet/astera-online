# CLAUDE.md — Blindspace

> Read this first, every session. It is the operating manual, not the design doc.
> Detail lives in `docs/`. This file exists so that a cold agent — or a future you
> with no memory of this project — can act correctly within five minutes.

---

## PRODUCT MISSION

Build a **small, fast, mobile-first multiplayer space game** that a solo developer can
actually finish, and that makes a player think **"I wonder what happened"** after they
close it.

This is explicitly **not** a 4X, not an MMO, not an OGame clone, not AAA. Feature count
is not progress. The product is a playable game that pulls people back.

## CORE PLAYER EXPERIENCE

The player owns one planet in a galaxy of ~200 real people. They cannot see what others
hold. Others cannot see what they hold. **Everything either side does about that is the
game.**

Nine emotions are **gameplay requirements**, not marketing copy. Every system must serve
at least one, and the strong ones must serve several:

`OWNERSHIP` · `CURIOSITY` · `COMPETITION` · `AMBITION` · `RISK / FEAR OF LOSS` ·
`OPPORTUNITY` · `RE-ENGAGEMENT` · `MEMORABILITY` · `FUN`

## DESIGN NORTH STAR

**SIMPLE TO PLAY. DEEP UNDER THE SURFACE.**

Few systems, learned fast. Depth comes from how those systems *interact*, never from
adding more of them. If you are about to add complexity to create depth, you are about
to make a mistake — strengthen a relationship between existing systems instead.

One sentence that settles most arguments:

> **The fleet is the bet. The information is the game. The planet is the stake.**

## CORE GAMEPLAY LOOP

```
DEVELOP → ACCUMULATE → GATHER INFORMATION → SPOT OPPORTUNITY → CHOOSE TARGET
   → TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Step 9 feeds step 3: **the battle report is the most accurate intel in the game.**
Economy, buildings and progression are *infrastructure* for this loop. They are not the
loop. If they become the main activity, the product has regressed.

---

## NON-NEGOTIABLE GAMEPLAY PRINCIPLES

1. **The client never decides an outcome.** It renders and sends intent. Nothing else.
2. **Buildings are never destroyed.** Raids and asteroids take shields, satellites,
   units, stock and *production time*. You can be robbed; you cannot be un-made.
3. **A launched fleet cannot be recalled.** Commitment must be irreversible or the risk
   is theatre.
4. **Watching is silent; probing is loud.** You are never told who is watching you. You
   *are* told when someone probed you. That asymmetry produces the dread.
5. **Information must have a price and a cost of use.** The cost of knowing is being
   known.
6. **Every session must end with something in flight.** A state where nothing is pending
   is a state with no reason to return. (See `DO NOT BREAK`.)
7. **Combat stays simple on purpose.** It is the resolution mechanic, not the skill
   expression. The skill lives in the information layer. This is the scope trade that
   pays for everything else.
8. **Low combat variance (±8%).** If randomness dominates outcomes, intel is worthless
   and the core loop collapses.

---

## SOURCE OF TRUTH / DECISION HIERARCHY

When two things disagree, the higher one wins:

1. **Locked product constraints** — mobile-first portrait, solo-dev scope, web MVP
   first, async persistent world, one planet per player, server-authoritative.
2. **Approved core game design** — `docs/game-design.md` and the published GDD.
3. **Decision log** — `docs/decisions.md`. Every locked decision, why, and what it binds.
4. **Current implementation** — the code.
5. **Temporary assumptions** — anything marked PROVISIONAL.
6. **Agent preference** — lowest. Yours included.

**If the implementation disagrees with the design, the implementation is not
automatically right.** Find out which decision is the source of truth and why the code
diverged. If the change is genuinely correct, update the source-of-truth doc *first*,
then the code.

---

## DO NOT BREAK

These have already been decided, tested, and paid for in iteration. Do not silently
re-litigate them.

| Rule | Why it exists |
|---|---|
| **Score is Dominion, not net worth** | The simulator proved wealth ladders reward passive play: builders finished at 2.1× raiders' net worth and no loot % changed it. `docs/balance.md` |
| **`vaultMult` must stay below `alloyMult`** | Violating it makes the vault protect 100% of storage and silently kills all PvP. It shipped broken once. Enforced by a test. |
| **Support hulls are shielded while combat hulls live** | Otherwise Haulers die in round 1, attackers arrive with no cargo, and raiding cannot pay for itself. |
| **Ground defence is durable (60% salvage)** | Consumable defence made 95% of attacks DECISIVE, and if blind raiding never fails there is nothing for information to reduce. |
| **Construction is instant — no build timers** | "A bar filled up" is the weakest return hook available, and timers invite pay-to-skip. Also makes the panic session real. |
| **Telescope reads are seeded per `(watchId, timeWindow)`** | Otherwise a player defeats the entire fog layer by pulling to refresh. **Easiest way to ship a broken information game.** |
| **Radar warns at `arriveAt − lead`, not at launch** | A 40-minute flight must not give 40 minutes of notice. |
| **`packages/rules` has zero deps, no clock, no I/O, no ambient randomness** | It is the single source of truth shared by server, simulator and client. Enforced by ESLint; CI fails if broken. |

---

## ANTI-SCOPE-CREEP RULES

- Before adding anything: **"which core-loop problem does this solve?"** No answer → out.
- Never remove or weaken core gameplay because it is hard to build. Ask instead:
  *what is the simplest version that preserves the intended gameplay?*
- **Simple implementation ≠ simplified gameplay.** Prefer the first. The second is only
  ever a deliberate, documented product decision.
- Cut order if behind: asteroids → Radar L4–L5 → Aegis → cosmetics.
  **Never cut any part of telescope / explorer / radar / veil.** Those four are the game.
- Post-MVP and staying there: alliances, chat, active deception, fleet interception,
  combat replay, multiple planets, monetisation.

---

## QUALITY BAR

A feature is done when **all three** hold:

```
TECHNICAL CORRECTNESS  +  GAMEPLAY CORRECTNESS  +  UX QUALITY
```

Compiling, passing tests and existing in the UI is only the first third.

### The engineering law

> **CODE WITHOUT TESTS IS CODE THAT WAS NEVER WRITTEN. IT IS UNFINISHED WORK.**

```bash
pnpm verify        # 0 type errors · 0 lint errors · all tests green
```

Non-negotiable, in full detail in [`docs/engineering-standards.md`](docs/engineering-standards.md):

- **Everything is typed. `any` is banned.** No casts to silence the compiler. Parse
  untrusted input with Zod at the boundary; never let unparsed data reach a service.
- **Zero lint errors, always.** Type-aware `strictTypeChecked`. If a rule is wrong, change
  the rule deliberately — never learn to ignore its output.
- **Test edge cases, not just the happy path.** Boundaries, malformed input, adversarial
  input, concurrency, failure, time. Risk coverage, never line coverage.
- **When a test fails, find the root cause first.** Never bend a test to fit the code, or
  code to fit a wrong test. Several failures here have been bad arrangements; several have
  been real bugs that looked like bad tests. Establish which before changing either.
- **Many tests failing identically is one bug, not many.**

**No silent placeholders.** Fake server logic, client authority, hardcoded gameplay
values, fake combat results, fake persistence and TODO'd core logic must be gone before
MVP or explicitly documented as a known limitation. A `TODO` in core gameplay logic is a
bug that has not been filed yet.

---

## GAMEPLAY VALIDATION RULES

Run any new or materially changed system through this. Weak answers mean it is not done,
even if the tests pass:

1. What decision does it create? 2. Why should the player care? 3. What does it interact
with? 4. How does success feel? 5. What does failure cost? 6. Does it create an
opportunity? 7. Does it create curiosity? 8. Does it raise the chance of coming back?
9. Does it add micro-management? 10. Would the game be better without it?

**Do not turn perfect theoretical answers into a precondition for building.** When in
doubt: `PROTOTYPE → PLAY → OBSERVE → DECIDE`.

### Product regression signals — fix, don't excuse as "fine for MVP"

The game is drifting if: it becomes `BUILD → WAIT → COLLECT → UPGRADE → REPEAT`;
resource collection becomes the main fun; other players stop mattering; the
intel → decision → action chain weakens; risk disappears; opportunity moments vanish;
ownership of the planet fades; micro-management creeps in; it becomes technically
impressive but emotionally empty; or new systems make old ones pointless.

---

## ENGINEERING / PERFORMANCE RULES

- **Server-authoritative.** Resources, fleet state, combat, travel, cooldowns, loot and
  progression are decided server-side, inside a transaction, using `@blindspace/rules`.
- **The fog is enforced in the query, not the UI.** A modified client must not be able to
  read a field it was not entitled to.
- **Lazy evaluation for anything continuous; scheduled events for anything that must
  happen at a moment. There is no global tick and no per-planet loop.**
- **Nothing is stored that a formula and a clock can derive** — no fleet positions, no
  asteroid coordinates, no resource tick rows.
- Every mutating action: lock the planet row → advance economy *inside* the lock →
  validate against the rules → mutate → commit → emit.
- **Two-planet operations lock in ascending id order.** Otherwise mutual raids deadlock.
- Watch for: N+1 queries, unbounded queries, duplicate jobs, race conditions, oversized
  payloads, needless re-renders, heavy 3D scenes, memory leaks.
- Performance is designed in, not added later — but never kill core gameplay for it.

## ASYNC WORLD RULES

The world runs while the player is offline. For every timed system ask:

> What happens on server restart? If the job runs twice? If two fleets land at once? If
> the request is retried? If the transaction dies halfway?

"Works under normal conditions" is not a passing grade. Idempotency, retry, and crash
recovery are part of the feature, not a follow-up.

Known platform traps already paid for (see `docs/architecture.md`):
- Drizzle's `sql` template **cannot bind a JS `Date`** through postgres.js.
- `RETURNING` does **not** preserve a subquery's `ORDER BY`.

---

## CURRENT PROJECT STATE

*Updated at milestones and direction changes — not on every commit.*

**Phase 0 (design validation) — DONE.** Rules module, season simulator, wall-clock text
prototype. Found and fixed 7 balance/design bugs; the findings are in `docs/balance.md`.

**Phase 1 (backend foundation) — DONE.** `9c169ef`.

```
pnpm verify  →  0 type errors · 0 lint errors · 166 tests
                rules 69 · sim 30 · server 67
```

| Area | State |
|---|---|
| `packages/rules` | Complete. Economy, combat, travel, intel math, loot, dominion, galaxy gen, disruption. |
| `packages/sim` | Complete. Season regression gate runs in CI on 3 seeds. |
| Auth | Guest sign-in, refresh rotation, token-type separation. |
| Planet | Read, upgrade, build units, install satellite. Lazy economy under row locks. |
| Fleet | Launch with validation and abuse guards. Arrival → combat → loot → disruption → return leg. |
| Worker | `SKIP LOCKED` claim, reaper, idempotent resolution, crash-recovery tested. |
| **Intel layer** | **NOT IMPLEMENTED.** `watches` and `scan_events` have zero write sites. No telescope, no probe, no scan detection, no veil effect. |
| Notifications | Rows are written; no read endpoint, no SSE. |
| Galaxy / leaderboard | No endpoints. |
| Asteroids | Generated and stored; no impacts scheduled, no Drill. |
| Season lifecycle | `season_end` event kind exists; no handler. |
| Web client | Does not exist. |

**The single most important gap: the intel layer is the game, and it has no server
implementation.** Everything currently shipped is the infrastructure it sits on.

## CURRENT ROADMAP

Next task is at the top. Full detail and acceptance criteria in `docs/roadmap.md`.

1. **Intel layer (server)** — telescope reads with windowed seeding, probe dispatch and
   arrival, radar scan detection, veil applied to reads, galaxy list endpoint with
   server-side fog. *This is the core gameplay blocker.*
2. **Return moment** — notifications read endpoint, SSE stream, "while you were gone"
   payload. Without this, Design Law #1 has no delivery mechanism.
3. **Playable loop end to end** — a thin web client good enough to actually play:
   planet → galaxy → intel → launch → return. Not the 3D map yet.
4. **3D galaxy** — R3F disc, instanced planets, camera + gestures. Timeboxed to 3 weeks.
5. **Season lifecycle + leaderboard** — Dominion ladder, freeze, wipe, account record.
6. **Play it, fix the highest-impact problems, repeat.**

## KNOWN RISKS

| Risk | Severity | Mitigation |
|---|---|---|
| **Information is invisible.** The whole game lives in a data layer with no physical presence. If the intel feed reads as a boring list, there is no game. | Highest | Disproportionate UX effort on the intel screen and return overlay. Test with people who are not you. |
| **Empty shard.** Async PvP with 12 players is nothing. | High | Do not open a second shard until the first fills. Pre-fill season 1 by invitation. |
| **Nobody scouts.** Players skip the intel layer and raid whoever is nearest — the game degrades into a worse OGame. | High | Track scout-before-attack rate; target ≥50% by day 3. |
| **3D scope creep.** The galaxy view is the most seductive and least load-bearing part. | High | Hard 3-week fence. Points, lines, labels. No models, textures or shaders. |
| **Casual players get farmed.** The 2-logins/day archetype finishes at −10k to −19k Dominion, and that is the target user. | Open | Needs real players, not more simulation. Top of the playtest agenda. |
| **Solo burnout.** Month four is where solo projects die. | Real | Ship something two people can play early, even if ugly. |

## KNOWN OPEN ISSUES

- **Casual-player farming** (above) — the only unresolved *design* problem.
- `request_log` table exists but idempotency keys are not wired into the launch path.
- `PROVISIONAL` constants — vault floor, disruption duration, shield curve, season
  length, asteroid params. Settled by playtest, not by argument. Marked in
  `packages/rules/src/constants.ts`.
- Simulator bots have no skill variance, so ladder spread reads far narrower than a real
  shard. **Do not tune ladder spread against the simulator.**

---

## HOW TO WORK ON THIS

Default behaviour is **move the project forward**.

```
IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE
```

**Decide for yourself:** architecture, folder structure, libraries, queries, caching,
component design, internal APIs, test design, small UX details.

**Ask the user only when** a change alters the core loop, the risk/reward structure, the
PvP model, the ownership model, the season structure, the progression model, the game's
identity, or a locked constraint.

**Do not:** re-research settled questions, keep improving the GDD, wait for every
uncertainty to resolve before building, or redesign a working system because something
better might exist. If a decision is small, low-risk and reversible — pick the simplest
workable option and move.

**When context is lost:** read this file → `docs/roadmap.md` → `docs/decisions.md` →
the code → `git log`. Never re-invent lost context by guessing.

---

## THE DOCS

| File | Read it when |
|---|---|
| [`docs/README.md`](docs/README.md) | You are new — it has a 30-minute onboarding path |
| [`docs/product-vision.md`](docs/product-vision.md) | You need to know *why* this game exists |
| [`docs/game-design.md`](docs/game-design.md) | You need to know how a system is meant to work |
| [`docs/decisions.md`](docs/decisions.md) | Before changing anything that feels settled |
| [`docs/balance.md`](docs/balance.md) | Before touching a number |
| [`docs/architecture.md`](docs/architecture.md) | Before writing server code — it lists traps already paid for |
| [`docs/engineering-standards.md`](docs/engineering-standards.md) | **Before writing any code at all** |
| [`docs/working-agreement.md`](docs/working-agreement.md) | When unsure whether to decide or ask |
| [`docs/roadmap.md`](docs/roadmap.md) | To find the next job and what "done" means for it |
| [`docs/glossary.md`](docs/glossary.md) | Dominion? Clarity? Veil? Salvage? |

---

## THE ONE THING TO REMEMBER

The goal is not to finish the features.

> **It is to make a small multiplayer game that leaves the player, some time after closing
> it, thinking: "I wonder what happened."**
