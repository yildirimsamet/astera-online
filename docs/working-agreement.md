# Working Agreement

How to make decisions on this project, and when to stop and ask.

---

## Operating mode: ship, don't loop

The project is out of the design phase. **Default behaviour is to move it forward.**

```
IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE
```

Research is a tool. Documentation is a tool. Architecture is a tool. **None of them is the
product.** The product is a playable game.

### Do not

- Re-research questions that are already settled in [decisions.md](decisions.md).
- Keep improving the design documents.
- Wait for every uncertainty to resolve before writing code.
- Ask for approval on small technical choices.
- Redesign a working system because something better might exist.
- Treat feature count as progress.
- Simplify gameplay because it is technically easier.
- Quietly drop core gameplay because it is hard.

---

## The decision tree

For every problem:

1. **Check the source of truth.**
2. Decision already made → **implement it.**
3. Decision follows clearly from existing design → **make the call yourself.**
4. Small, low-risk, reversible → **pick the simplest workable option and continue.**
5. Materially changes core gameplay, product vision, or a locked decision → **ask.**
6. Otherwise → **implement → test → play → fix → continue.**

### Source of truth hierarchy

1. Locked product constraints
2. Approved core game design — [game-design.md](game-design.md)
3. Decision log — [decisions.md](decisions.md)
4. Current implementation
5. Temporary assumptions (anything `PROVISIONAL`)
6. Agent preference — **lowest**

**If the implementation disagrees with the design, the implementation is not automatically
right.** Work out which decision is authoritative and why the code diverged. If the change
is genuinely correct, update the source-of-truth document *first*, then the code.

---

## Decide yourself

Architecture · folder structure · library choice · query optimisation · caching ·
component design · internal API shape · test implementation · small UX details · naming ·
refactors · error handling · logging.

Make the call, document it only if it has a product or gameplay consequence, and continue.

## Ask first

Anything that changes:

- the core loop
- the risk/reward structure
- the PvP model
- the ownership model
- the season structure
- the player's main progression model
- the game's identity
- a locked constraint

These are the decisions that are expensive to reverse and that define what the product
*is*.

---

## Technical done ≠ gameplay done

A feature is finished when **all three** hold:

```
TECHNICAL CORRECTNESS  +  GAMEPLAY CORRECTNESS  +  UX QUALITY
```

Compiling, passing tests, writing to the database and existing in the UI is the first
third. "Telescope is implemented" is a statement about code, not about the game.

For any new or materially changed system, answer:

1. What decision does it create? 2. Why should the player care? 3. What does it interact
with? 4. How does success feel? 5. What does failure cost? 6. Does it create an
opportunity? 7. Does it create curiosity? 8. Does it raise the chance of coming back?
9. Does it add micro-management? 10. Would the game be better without it?

Weak answers mean it is not done. **But do not make perfect theoretical answers a
precondition for building** — when in doubt, `PROTOTYPE → PLAY → OBSERVE → DECIDE`.

---

## Product regression — fix it, don't excuse it

The game is drifting if:

- it becomes `BUILD → WAIT → COLLECT → UPGRADE → REPEAT`
- resource collection becomes the main fun
- other players stop mattering
- the intel → decision → action chain weakens
- risk disappears
- opportunity moments vanish
- ownership of the planet fades
- micro-management creeps in
- it becomes technically impressive but emotionally empty
- new systems make older ones pointless

Any of these is a **product regression**, not an acceptable MVP compromise. Fix it.

### Do not regress

Never silently remove, weaken, bypass, simplify or disable an existing core system to solve
a new problem. If a change requires altering a gameplay decision:

1. Identify which decision it affects.
2. Establish why it needs to change.
3. Update the source-of-truth document.
4. *Then* change the implementation.

Never change product direction for the sake of an easier implementation.

---

## Scope control

MVP is **SMALL + POLISHED + FUN**.

Before adding anything: *"which core-loop problem does this actually solve?"* No answer →
it does not go in, however cool it is.

But equally: **do not abandon core gameplay because it is hard.** Ask instead:

> What is the simplest version that preserves the intended gameplay?

**Simple implementation ≠ simplified gameplay.** Prefer the first always. The second is
only ever a deliberate, documented product decision.

---

## Reversibility

If something is uncertain, and the decision does not change core gameplay, is low-risk,
and is reversible — **pick the simplest workable option and move.**

Prefer `SIMPLE + REVERSIBLE + TESTABLE` over waiting for certainty.

---

## Research policy

Research only when: a genuinely unknown technical question blocks a correct decision · a
current library/API detail is needed · security or performance depends on it · a
design question genuinely needs outside data.

Never use research to: re-evaluate a settled decision · keep improving the design · delay
implementation · eliminate every small uncertainty.

Default workflow is `ANALYZE → PROTOTYPE → PLAY → DECIDE → IMPLEMENT`. Research fits inside
that loop, never replaces it.

---

## Fun validation without an analysis loop

Validating fun matters. **Looping on it does not.** At every milestone:

```
SHIP → PLAY → IDENTIFY CONCRETE PROBLEMS → FIX THE HIGHEST-IMPACT ONES → CONTINUE
```

Only solve concrete, observable problems.

> ❌ *"Maybe combat could be deeper."*
>
> ✅ *"When I send two similarly-sized fleets, nothing I decide beforehand changes the
> outcome — so target information needs to tell me something that alters my choice."*

Always a specific gameplay problem, never abstract perfection.

---

## Milestone gate

At every major milestone, evaluate three things separately:

**TECH** — correct? tests pass? edge cases handled?
**DESIGN** — does it produce the intended gameplay behaviour? does it strengthen the loop?
**FUN** — is it actually enjoyable? does it give a reason to continue?

If `TECH = yes`, `DESIGN = yes`, `FUN = no` — **do not mark it done.** But that is also not
grounds for a project-wide redesign. Fix the highest-impact concrete problem and continue.

---

## Actually play it

Do not judge fun by reading code. Play it, in real gaps, over real days. Test specifically:

first login · first upgrade · first discovery · first scout · first telescope reading ·
first target selection · first attack · dispatching a fleet · waiting · seeing the result ·
winning · losing · being left defenceless · going offline · coming back.

At each moment ask both:

> *"If I were the player, why would I continue right now?"*
> *"If I were the player, why would I close this right now?"*

---

## Documentation discipline

**Document** — important gameplay decisions · important architecture decisions ·
source-of-truth changes · core assumptions · significant trade-offs · known critical risks ·
roadmap changes · deliberate bug/limitation decisions.

**Do not document** — trivial implementation details · temporary debugging notes · anything
obvious from the code · every small refactor · every UI tweak.

The goal is **documentation that preserves context**, not documentation for its own sake.

---

## Context loss protocol

When a significant part of context is gone, do **not** guess. In order:

1. Read `CLAUDE.md`.
2. Check [roadmap.md](roadmap.md) for current state.
3. Check [decisions.md](decisions.md) for what is locked.
4. Read the relevant implementation.
5. Check `git log` / `git diff` if needed.

Never re-invent product mission, core experience, the loop, locked constraints, important
decisions, current state, current milestone, or known risks. They are all written down.

---

## Prioritisation

1. Core gameplay blocker
2. Critical correctness / data integrity / security
3. Core UX blocker
4. Core gameplay quality
5. Performance / scalability risk
6. Important polish
7. Secondary features
8. Cosmetic improvements

**Strengthening the core loop beats increasing the feature count.**

---

## Testing

Test **risk coverage, not line coverage**. Concentrate on the deterministic,
server-authoritative parts: combat resolution, loot, resource transactions, travel, timing,
fleet state, concurrency, idempotency, season transitions.

When a test fails, **find the root cause before touching anything.** Several Phase 1
failures were bad test arrangements; several were real bugs that looked like bad tests.
Never bend a test to fit the code without establishing which one is actually wrong.

---

## No silent placeholders

Placeholders are fine during development. **Letting them become permanent is not.**

Before MVP, these must be gone or explicitly documented as known limitations: fake server
logic · client-side authority · hardcoded gameplay values · fake combat results · fake
rewards · fake persistence · temporary UI · TODO'd core logic.

---

## When stuck

Break it into smaller pieces → check the source of truth → find the smallest workable
solution → prototype if needed → test → evaluate → continue.

**Do not turn being stuck into "let me research a bit more."**

---

## The north star

At the end of MVP, what exists must not be *"a lot of features in a working prototype."*

It must be:

> **A small multiplayer game that makes the player want to check it again.**

The player should bond with their planet, wonder about other players, watch for
opportunities, take risks, wait for outcomes, be genuinely annoyed when they lose,
satisfied when they win, curious about what happened while they were gone, and face a new
decision when they return.

Some time after closing the app, they should think:

> **"I wonder what happened."**

That is the retention loop. Everything else serves it.

```
SIMPLE TO PLAY. DEEP UNDER THE SURFACE.
SMALL. POLISHED. FUN.
TECHNICAL QUALITY SUPPORTS GAMEPLAY. GAMEPLAY DEFINES THE PRODUCT.
BUILD. PLAY. LEARN. FIX. SHIP.
```
