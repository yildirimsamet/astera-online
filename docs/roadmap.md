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
| 2 · Intel layer | ✅ Done — `2afdf97` |
| 3 · Return moment & re-engagement | ✅ Done |
| 4 · Playable loop (thin client) | ✅ Done — the game can be played |
| **4.5 · Play it for two days in real gaps** | **← NEXT. Not a build phase.** |
| 5 · 3D galaxy | Not started |
| 6 · Season lifecycle & leaderboard | Not started |
| 7 · Playtest & balance | Not started |

```
pnpm verify  →  0 type errors · 0 lint errors · 292 tests
                rules 82 · sim 30 · server 147 · web 33
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
| Return moment | `GET /api/session/return` capped at 5 entries, advancing `lastSeenAt`; unlock cascade derived from history. |
| Notifications | List, mark-seen, and SSE over Postgres LISTEN/NOTIFY. |
| Asteroids | Generated and stored; no impacts scheduled, no Drill. |
| Season lifecycle | `season_end` event kind exists; no handler. |
| Onboarding | `POST /api/season/join`, `GET /api/season`, and a season CLI. Until Phase 4 a galaxy could only be created from inside a test. |
| Web client | **Playable.** React + Vite + Tailwind + TanStack Query. Entry, planet, galaxy, intel, target and launch sheets, return overlay, live in-flight strip, SSE. |

**Existing endpoints (22):** auth ×3 · `GET /api/season` · `POST /api/season/join` ·
`GET /api/planet` · planet upgrade/build/satellite · `POST /api/fleet/launch` ·
`GET /api/intel` · `POST /api/intel/watch` · `POST /api/intel/probe` · `GET /api/galaxy` ·
`GET /api/leaderboard` · `GET /api/session/return` · `GET /api/session/pending` ·
`GET /api/session/unlocks` · `GET /api/notifications` · `POST /api/notifications/seen` ·
`GET /api/stream` · `GET /health`

**Event kinds handled (2):** `mission_arrival` (attack, return **and probe**) ·
`radar_warning`

> **The single most important fact:** the loop is playable end to end. What it has never
> had is a player. Everything below this line is now blocked on somebody actually living
> with it for a couple of days — not on more features.

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

## Phase 3 · Return moment & re-engagement — DONE

**Delivered:** `GET /api/session/return` — the "while you were gone" payload, three kinds
of line (what I did · what accrued · what's new), capped at five entries, advancing
`lastSeenAt` so a second read correctly reports nothing. `pending[]` carries what is still
in flight, which is how Design Law #1 is actually delivered rather than merely asserted.
Notifications list and mark-seen. SSE at `GET /api/stream` over Postgres LISTEN/NOTIFY.

**The unlock cascade is derived, not stored.** What is unlocked comes from history —
a battle resolving unlocks the telescope, being attacked or scanned unlocks radar, watching
someone unlocks the explorer, being scanned unlocks the veil. Only *what has already been
announced* is stored, so the overlay can say "new" exactly once and the cascade can never
drift out of sync with the events that justify it.

**A real bug this phase surfaced: there were two clocks.** `battleReports.createdAt` used
the database's `defaultNow()` while everything else used the injected clock. In production
they agree closely enough to hide it; with a fixed clock the "while you were gone" window
never closed, so every read replayed the same news forever. All timestamps now come from
the injected clock — `clock.ts` says there is exactly one clock in this system, and now
there is.

**Acceptance criteria — met and asserted:**

- A second read in a row reports nothing new.
- Each unlock is announced exactly once.
- The telescope unlocks even when the first fleet is annihilated — no dead end.
- An *undetected* scan unlocks nothing; you never learned about it.
- A player cannot mark another player's notifications seen — ids from a client are a
  filter, never an authorisation.
- NOTIFY is transactional: an event from a rolled-back transaction is never delivered.

## Phase 4 · Playable loop — thin client — DONE

**Delivered:** React + Vite + Tailwind + TanStack Query. Three screens plus the return
overlay, the target and launch sheets, a live in-flight strip, and SSE. Deliberately
**not** the 3D map — a list-based galaxy is enough to test whether the core decision is
worth making, and the Phase 0 text prototype already proved that shape works.

The attack flow leads with the exposure line, as required:
**"6 units defending home · Exposed for 26m"**, above everything else on the sheet.

**Two things had to be built on the server before any of it was reachable:**

1. **Onboarding did not exist.** `joinSeason` and `createSeason` were only ever called
   from tests, so a real player could not get a planet and a galaxy could not be created
   outside a test run. Now: `POST /api/season/join` (idempotent — a returning player
   lands on the same planet), `GET /api/season`, and `pnpm season create|migrate|status`.
2. **`GET /api/session/pending`.** The return payload advances `lastSeenAt` and may be
   read once per session, so it cannot drive a live countdown. Design Law #1 needs a
   surface that can be read as often as it is looked at.

### The bug the client found

**The return payload leaked the entire radar ladder.** `pending[]` listed every inbound
attack unconditionally, with its exact ETA — so a player with *no radar at all* was told
a fleet was coming and precisely how long they had. That is what Radar L3 exists to sell,
and it silently reversed D9: a forty-minute flight gave forty minutes of notice.

It shipped in Phase 3 and the test covering it **asserted the leak**. An inbound attack is
now listed only when `radarDetectsFleets(level)` and `minutesRemaining <= lead(level)` —
the same instant the warning notification fires. Three tests replaced the one.

Found by building the strip that displays it, which is the whole argument for this phase.

### Product bugs found by playing it

- A brand-new commander's first screen was the return overlay reading **"0m · Nothing
  happened. The galaxy did not notice you were away"** — the worst possible opening for a
  game about being watched. The overlay now appears only when there is a return to report.
- The in-flight strip covered the last row of every list. The shell is now a real app
  shell: fixed bar, scrolling middle, fixed tabs.
- The intel screen for a player who owns no instruments was three empty boxes. It now
  shows what knowing costs — the one thing a blind commander needs, at the moment they
  feel its absence.

**Acceptance:** the developer plays it for two days in real gaps and the loop holds.
**That has not happened yet. It is the next job, and it is not a build job.**

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
