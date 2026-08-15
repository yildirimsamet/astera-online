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
| 2 · Intel layer | ✅ Done |
| **3 · Return moment & re-engagement** | **← NEXT. The core gameplay blocker.** |
| 4 · Playable loop (thin client) | Not started |
| 5 · 3D galaxy | Not started |
| 6 · Season lifecycle & leaderboard | Not started |
| 7 · Playtest & balance | Not started |

```
pnpm verify  →  0 type errors · 0 lint errors · 220 tests
                rules 82 · sim 30 · server 108
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
| **Intel layer** | **Complete.** Telescope + clarity gradient + windowed seeding, probes with detection and banded reports, radar log filtered by level, veil applied server-side. |
| Galaxy / leaderboard | `GET /api/galaxy` with fog enforced in the response; Dominion ladder. |
| Notifications | Rows written (including `scan_detected`); **no read endpoint, no SSE.** |
| Asteroids | Generated and stored; no impacts scheduled, no Drill. |
| Season lifecycle | `season_end` event kind exists; no handler. |
| Web client | Does not exist. |

**Existing endpoints (14):** auth ×3 · `GET /api/planet` · planet upgrade/build/satellite ·
`POST /api/fleet/launch` · `GET /api/intel` · `POST /api/intel/watch` ·
`POST /api/intel/probe` · `GET /api/galaxy` · `GET /api/leaderboard` · `GET /health`

**Event kinds handled (2):** `mission_arrival` (attack, return **and probe**) ·
`radar_warning`

> **The single most important fact:** every core system now exists and is tested, but a
> player cannot *see* any of it. There is no notification read endpoint, no SSE, no return
> payload and no client. **The game works and nobody can play it.**

---

## Phase 2 · Intel layer — DONE

**Delivered:** telescope assignment capped by telescope level; reads applying the clarity
gradient with **windowed seeding**; `watches` persisting `lastStatus` / `lastConfirmedAt`
so staleness is real; probes as a `kind='probe'` mission with cost, flight time, banded
reports and a seeded detection roll; `scan_events` written on every probe arrival;
`probe_reports` as a separate table so the observer's intel and the target's radar log can
never leak into one another; radar log filtered by level (bearing at L2, origin only at
L5); veil applied to every read server-side; `GET /api/galaxy` with the fog enforced in
the response.

**Acceptance criteria — all met and asserted in tests:**

- Refreshing cannot improve a reading inside its 20-minute window — 20 consecutive reads
  return identical answers.
- A planet you are not watching has **no `fleet` key at all** in the API response. Not
  `UNKNOWN` — absent. Asserted against raw JSON, not the UI.
- Probe reports are bands, and the band narrows with Shipyard level.
- Watching leaves no trace even against maximum radar; probing always writes a scan row.
- Radar below L5 never contains the origin anywhere in the payload.

**Two test-quality problems found and fixed while building it:**
`seedWorld()` truncates, so calling it mid-test destroyed the planets under test — that
had made one test meaningless. And two detection tests bet on a 95% roll seeded from a
random UUID, so they would have failed roughly one CI run in twenty; the read-filter tests
now arrange their scan directly, and the detection claim is measured over eight probes.

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
