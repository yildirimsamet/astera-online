# Blindspace — documentation

Start with [`../CLAUDE.md`](../CLAUDE.md). It is the operating manual: mission, principles,
current state, roadmap, and how to work on this project. Everything here is the detail
behind it.

---

## Your first thirty minutes

If you have never seen this project before, do these in order.

**1. Understand what it is (10 min)** — read [`../CLAUDE.md`](../CLAUDE.md), then
[product-vision.md](product-vision.md). If you only remember one sentence, remember this
one:

> The fleet is the bet. The information is the game. The planet is the stake.

**2. Get it running (5 min)**

```bash
pnpm install
docker compose up -d      # Postgres on :5433
pnpm verify               # typecheck + lint + all tests — must be fully green
```

**3. See the game's maths actually run (5 min)**

```bash
pnpm sim -- --players=200 --seed=7
```

That is a full 14-day season played by bots using the real rules. It prints the balance
invariants and the final ladder.

**4. Play the Phase 0 prototype (10 min)** — open `legacy/prototype-standalone.html` in a
browser. It runs on **wall-clock time**: play for five minutes, close it, come back in a few
hours. It is still the fastest way to feel what the game is trying to be.

**5. Before writing any code** — read [engineering-standards.md](engineering-standards.md)
and [working-agreement.md](working-agreement.md). They are short and they are binding.

---

## The documents

| # | Document | Answers |
|---|---|---|
| 1 | [product-vision.md](product-vision.md) | What are we making, for whom, and why this and not something else? |
| 2 | [game-design.md](game-design.md) | How does the game work, system by system? |
| 3 | [decisions.md](decisions.md) | What is locked, why, and what breaks if you change it? |
| 4 | [balance.md](balance.md) | Where did every number come from? What did the simulator prove? |
| 5 | [architecture.md](architecture.md) | How is it built, and which platform traps are already paid for? |
| 6 | [engineering-standards.md](engineering-standards.md) | **Typing, lint, testing. Project law.** |
| 7 | [working-agreement.md](working-agreement.md) | How to decide things, and when to stop and ask. |
| 8 | [roadmap.md](roadmap.md) | What is done, what is next, what "done" means for each phase. |
| — | [glossary.md](glossary.md) | Dominion? Clarity? Veil? Salvage? Look them up here. |

**In a hurry?** `CLAUDE.md` → `roadmap.md` → `decisions.md`. That is enough to contribute
correctly.

**Lost context mid-task?** `CLAUDE.md` → `roadmap.md` → `decisions.md` → the code →
`git log`. Never re-invent lost context by guessing.

---

## The two rules that matter most

**1. The client never decides an outcome.** Every game rule lives in `@blindspace/rules` —
pure functions, zero dependencies, no clock, no I/O, no ambient randomness. ESLint enforces
this; CI fails if it is broken.

**2. Code without tests is code that was never written.** See
[engineering-standards.md](engineering-standards.md).

---

## External references

Two published artifacts hold the long-form versions. They are **historical records of the
design process**; where they disagree with [decisions.md](decisions.md),
**`decisions.md` wins.**

- **Game Design Document** — https://claude.ai/code/artifact/a905cdce-d370-463b-9295-6eb838ff0bee
- **Build Plan** (product lock + technical architecture) — https://claude.ai/code/artifact/8791cf82-01e2-47e5-add8-56941a6374ac

---

## What is deliberately *not* documented

Trivial implementation details, temporary debugging notes, anything obvious from reading the
code, every small refactor, every UI tweak.

Documentation exists to **preserve context**, not to mirror the codebase.
