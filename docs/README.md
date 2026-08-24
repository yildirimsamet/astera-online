# Astera Online — documentation

Start with [`../CLAUDE.md`](../CLAUDE.md). It is the operating manual: mission, principles,
invariants, current state and how to work here. Everything in this folder is the detail behind
it.

**These documents are living reference, not an archive.** Keep them short and current. When
you add something, remove what it replaced.

## First thirty minutes

**1 · Understand what it is.** [`../CLAUDE.md`](../CLAUDE.md), then
[product-vision.md](product-vision.md). If you remember one sentence:

> The fleet is the bet. The information is the game. The planet is the stake.

**2 · Get it running.**

```bash
pnpm install
docker compose up -d      # Postgres on :5433
pnpm verify               # typecheck + lint + all tests
pnpm season migrate && pnpm season bootstrap
pnpm dev                  # server + web
```

**3 · See the maths run.** `pnpm sim -- --players=50 --seed=7` plays a full 14-day season with
bots using the real rules, and prints the balance invariants and the final ladder.

**4 · Feel the shape.** Open `legacy/prototype-standalone.html`. It runs on **wall-clock
time**: play five minutes, close it, come back in a few hours. Still the fastest way to feel
what the game is trying to be.

**5 · Before writing any code**, read
[engineering-standards.md](engineering-standards.md). It is short and it is binding.

## The documents

| Document | Answers |
|---|---|
| [product-vision.md](product-vision.md) | What are we making, for whom, and why this and not something else? |
| [game-design.md](game-design.md) | How does the game work, system by system? |
| [decisions.md](decisions.md) | What is locked, why, and what breaks if you change it? |
| [balance.md](balance.md) | Where did every number come from, and what did the simulator prove? |
| [architecture.md](architecture.md) | How is it built, and which platform traps are already paid for? |
| [engineering-standards.md](engineering-standards.md) | **Typing, lint, testing. Project law.** |
| [interface.md](interface.md) | How the screens are built and why |
| [visual-design.md](visual-design.md) | Art direction, the asset inventory, and what is missing |
| [playtest-log.md](playtest-log.md) | How to run a real play session, and what to record |
| [deployment.md](deployment.md) | How it ships, and what must never happen in the wrong order |
| [visual-quality.md](visual-quality.md) | What a frame has to look like before it counts as done |
| [glossary.md](glossary.md) | Dominion? Clarity? Veil? Salvage? |
| [economy-v2.json](economy-v2.json) | Generated: every level of every building, hull and project. `node tools/economy-v2-model.mjs --json` |

**In a hurry:** `CLAUDE.md` → `decisions.md` → `balance.md`.
**Lost context mid-task:** add the code and `git log` to the end of that list. Never re-invent
lost context by guessing.

## The two rules that matter most

1. **The client never decides an outcome.** Every game rule lives in `@astera/rules` — pure
   functions, zero dependencies, no clock, no I/O, no ambient randomness. ESLint enforces it.
2. **Code without tests is code that was never written.**

## What is deliberately not documented

Trivial implementation details, temporary debugging notes, anything obvious from reading the
code, every small refactor, every UI tweak. Documentation exists to **preserve context**, not
to mirror the codebase.
