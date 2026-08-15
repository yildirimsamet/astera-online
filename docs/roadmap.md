# Roadmap

**Update this at milestones and direction changes — not on every commit.**

A cold agent must be able to answer five questions from this file alone: *What is being
done? What is finished? What is missing? What is the next most important job? What is the
known risk?*

---

## Where we are

| Phase | State |
|---|---|
| 0 · Design validation | ✅ Done |
| 1 · Backend foundation | ✅ Done — `9c169ef` |
| **2 · Intel layer** | **← NEXT. The core gameplay blocker.** |
| 3 · Return moment & re-engagement | Not started |
| 4 · Playable loop (thin client) | Not started |
| 5 · 3D galaxy | Not started |
| 6 · Season lifecycle & leaderboard | Not started |
| 7 · Playtest & balance | Not started |

```
pnpm verify  →  0 type errors · 0 lint errors · 166 tests
                rules 69 · sim 30 · server 67
```

---

## What exists right now

| Area | State |
|---|---|
| `packages/rules` | **Complete.** Economy, combat, travel, intel math, loot, dominion, galaxy generation, disruption. |
| `packages/sim` | **Complete.** Season regression gate runs in CI on 3 seeds. |
| Auth | Guest sign-in, refresh rotation, token-type separation. |
| Planet | Read, upgrade, build units, install satellite. Lazy economy under row locks. |
| Fleet | Launch with validation and abuse guards. Arrival → combat → loot → disruption → return leg. |
| Worker | `SKIP LOCKED` claim, reaper, idempotent resolution, crash-recovery tested. |
| **Intel layer** | **NOT IMPLEMENTED.** `watches` and `scan_events` have zero write sites. |
| Notifications | Rows written; no read endpoint, no SSE. |
| Galaxy / leaderboard | No endpoints. |
| Asteroids | Generated and stored; no impacts scheduled, no Drill. |
| Season lifecycle | `season_end` event kind exists; no handler. |
| Web client | Does not exist. |

**Existing endpoints (9):** `POST /api/auth/guest` · `POST /api/auth/refresh` ·
`GET /api/auth/me` · `GET /api/planet` · `POST /api/planet/upgrade` ·
`POST /api/planet/build` · `POST /api/planet/satellite` · `POST /api/fleet/launch` ·
`GET /health`

**Existing event handlers (2):** `mission_arrival` · `radar_warning`

> **The single most important fact:** everything shipped so far is the *infrastructure* the
> game sits on. The intel layer — which the whole design says **is** the game — has no
> server implementation.

---

## Phase 2 · Intel layer — NEXT

**Goal:** make information a thing players can buy, spend, lose and act on.

### Deliverables

- **Telescope** — `POST /api/intel/watch` (assign a slot), `GET /api/intel` (the feed).
  Reads apply the clarity gradient with **windowed seeding** — this is not optional, see
  below. Persist `lastStatus` / `lastConfirmedAt` on `watches` so staleness is real.
- **Explorer** — `POST /api/intel/probe` creating a `kind='probe'` mission, plus an
  arrival handler that writes a fuzzed report and rolls detection against the target's
  radar level.
- **Radar** — write `scan_events` on probe arrival. Expose the log with bearing at L2+ and
  origin only at L5.
- **Veil** — applied to every telescope read, server-side.
- **Galaxy list** — `GET /api/galaxy` returning planets with **server-side fog**: public
  tier for everyone, telescope tier only where a watch exists and clarity permits.

### Acceptance criteria

- Pulling to refresh **cannot** improve a telescope reading inside its 20-minute window.
- A modified client **cannot** read a field it was not entitled to — verified by asserting
  the API response shape, not the UI.
- A probe report is a **band**, not a number, and the band narrows with probe level.
- Probing a target with radar produces a `scan_event`; watching produces nothing
  observable to the target, ever.
- Telescope status matches ground truth when clarity ≥ +1, and is stale-or-unknown below.

### Do NOT build yet

Asteroids. Drill. Aegis interaction. The 3D map. Any client.

### Gameplay check before calling it done

Does knowing *"his fleet is away"* actually change what the player does next? If the answer
is "not really", the fault is in what the telescope reports, not in the code.

---

## Phase 3 · Return moment & re-engagement

**Goal:** deliver Design Law #1. Without this, nothing pulls the player back.

- `GET /api/notifications` + mark-seen.
- **`GET /api/session/return`** — the "while you were gone" payload: what I did, what
  accrued, what's new. Max five entries.
- `GET /api/stream` — SSE for battle results, scan alerts, inbound warnings.
- The **unlock cascade**, server-side: telescope on first battle resolving *either way*,
  radar on first incoming scan or attack, explorer on first ambiguous reading, veil on
  first successful scan against you.

**Acceptance:** close the client, return two hours later, and **≥2 things changed that the
player did not cause** — with at least one of them being intel, not just resources.

---

## Phase 4 · Playable loop — thin client

**Goal:** actually play the game. This is the earliest point at which the design can be
judged rather than argued about.

Deliberately **not** the 3D map. A list-based galaxy is enough to test whether the core
decision is worth making — the Phase 0 text prototype already proved that shape works.

```
LOGIN → PLANET → DEVELOP → GATHER INFO → CHOOSE TARGET → DISPATCH
      → TRAVEL → OUTCOME → RETURN → NEW DECISION
```

React + Vite + Tailwind + TanStack Query. Three screens plus the return overlay. The attack
flow must lead with the exposure line: **"Home defence after launch: 4 units. Exposed for
28 minutes."**

**Acceptance:** the developer plays it for two days in real gaps and the loop holds.
Then: **play it.** Not read it — play it.

---

## Phase 5 · 3D galaxy

R3F disc, instanced planets (1 draw call), camera + gestures, HOME button, DOM labels,
semantic LOD, client-side fleet interpolation from timestamps.

**Acceptance:** 300 planets at 60 fps on a mid-range Android. HOME recovers the camera
from any state.

> **Hard fence: 3 weeks.** Points, lines, labels, one emissive material. **No models, no
> textures, no custom shaders, no post-processing.** This is the most seductive and least
> load-bearing part of the project. If it runs over, it ships as-is and the time comes out
> of polish — never out of the intel layer.

---

## Phase 6 · Season lifecycle & leaderboard

`season_end` handler (freeze → wipe → write account record), Dominion ladder endpoint, the
three display-only vanity boards, cross-season account record.

**Acceptance:** a season runs to completion unattended and the wipe preserves record and
cosmetics only — **never power**.

---

## Phase 7 · Playtest & balance

One full season, 20–40 invited players, live invariant dashboard.

**Targets:** D3 retention ≥ 25% · **scouted-before-attacking ≥ 50% by day 3** ·
casual-player Dominion no worse than −2k.

The middle one is the project's real KPI. If players never scout, the information layer
failed and this is a mediocre raid game with extra steps.

**Build no features in this phase.** It is for numbers.

---

## Deferred, deliberately

**Should build if time allows:** Aegis shield interaction with asteroids · asteroid impacts
and Drill · Radar L4–L5 · vanity boards · planet skins and custom names · season closing
reel.

**Post-MVP:** Capacitor mobile shell · web push · Tauri desktop · fleet interception ·
active deception · combat replay · alliances · chat · multiple shards · monetisation.

**Cut order if behind:** asteroids → Radar L4–L5 → Aegis → cosmetics.
**Never cut any part of telescope / explorer / radar / veil.**

---

## MVP completion gate

Not done until all four hold.

**Product** — core experience present · planet feels owned · other players matter ·
information → decision → action loop works · risk/reward meaningful · reasons to check back
exist.

**Gameplay** — loop playable end to end · progression, economy, intel, fleet, combat,
defence, loot, offline progression and season all work · critical edge cases handled.

**UX** — a new player understands the point · main actions findable · no needless
micro-management · portrait flow usable · success and loss are legible.

**Engineering** — production build works · critical tests pass · server authority intact ·
async operations safe · transactions consistent · known races handled · performance
acceptable · no known critical security holes.

**Quality** — no critical placeholders · no half-finished core features · no major known
bugs · end-to-end flow tested on a real device.

Then, before saying "done": **a fresh-player test.** Watch someone who has never seen it
take their first session. Fix what that reveals.
