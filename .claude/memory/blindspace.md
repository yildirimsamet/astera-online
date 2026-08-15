---
name: blindspace
description: "Blindspace — the user's solo-dev multiplayer space game at ~/Desktop/Coding/MyProjects/blindspace; read its CLAUDE.md before doing anything"
metadata: 
  node_type: memory
  type: project
  originSessionId: 553ba8c9-2b15-4a5b-838b-03e499d77bd8
  modified: 2026-08-15T16:44:48.635Z
---

**Blindspace** lives at `/home/yildirim/Desktop/Coding/MyProjects/blindspace` (git repo, pnpm
monorepo). A mobile-first async multiplayer space game where the core tension is *seeing and
being seen*: one planet each, fleets that physically travel, combat resolving while both
players are offline.

> The fleet is the bet. The information is the game. The planet is the stake.

## Read the repo, do not reconstruct from memory

`blindspace/CLAUDE.md` is the operating manual and auto-loads. `blindspace/docs/` holds the
detail: `product-vision`, `game-design`, `decisions`, `balance`, `architecture`,
`engineering-standards`, `working-agreement`, `roadmap`, `glossary`.

**Those files are the source of truth and outrank anything remembered here.** They were
audited against the code. Do not re-derive product mission, locked decisions, balance
numbers or current state from memory — read them.

## The phase this project is in

**Design is finished. Execution is not.** The long design-interview phase (which produced a
GDD, a simulator and a text prototype) ended at commit `01aaf3a`. Do **not** reopen settled
design questions, keep improving the GDD, or restart the interview format.

As of Phase 3 (`67afeb8`): rules, simulator, backend, intel layer and the return moment are
built and tested — 249 tests, 0 lint errors, 0 type errors. **There is no client, so nobody
can play it.** The next job is a thin React client, deliberately not the 3D map.

## The thing that must not be lost

The goal is not to finish features. It is a small game that makes a player think **"I wonder
what happened"** after closing it.

**Why:** the project has a large written record precisely so context loss does not cost
another design cycle; reconstructing it from memory would produce a subtly different game.

**How to apply:** read `CLAUDE.md` first, then `docs/roadmap.md` for the next job. See
[[user-execution-mode]] and [[user-code-quality-bar]] for how this user wants work done.
