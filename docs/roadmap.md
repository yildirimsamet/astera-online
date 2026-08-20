# Roadmap

**Update at milestones and direction changes, not on every commit.** A cold agent must be
able to answer five questions from this file alone: what is finished, what is missing, what
is next, why, and what the known risk is.

## Where we are

| Phase | State |
|---|---|
| 0 · Design validation | Done — rules module, season simulator, wall-clock prototype |
| 1 · Backend foundation | Done |
| 2 · Intel layer | Done |
| 3 · Return moment | Done, then replaced by Signals (D23) |
| 4 · Playable loop | Done — proved the loop; the shell was wrong |
| 5 · The galaxy is the game | Done — D20 |
| 6 · Accounts and ten galaxies | Done — D21 |
| 7 · The owner's interface pass | Done — D22–D26 |
| 8 · The OGame pass | Done — D27–D33 |
| 9 · Mining, wreckage, engagement, notifications, radar | Done — D34–D50 |
| 9.5 · One live galaxy, seen the same way by everyone | Done — D51–D52. Public battle, server clock, nothing waits |
| **10 · Play it for two days in real gaps** | **NEXT. Bigger than anything below it** |
| 11 · Season lifecycle | Partly done — the wipe exists, the scheduled end does not |
| 12 · Playtest & balance | Not started |

```
pnpm verify  →  0 type errors · 0 lint errors · 1,176 tests
                rules 221 · sim 47 · server 434 · web 474
```

**Two season-gate assertions are red, and they moved at D52a** — `ARR` on seeds 42 and 99
(0.298 / 0.299 against 0.308–0.326). Pooled `TAX` and the seed-4242 ladder, which were the
red pair for four phases, now both pass: the blind attacker's valuation counted storage
only while claiming to count the works too, so unscouted targets were under-valued and
blind raiding was suppressed. Nothing was tuned. See `balance.md` § Current reading.

Full inventory of what exists is in `CLAUDE.md` § Current state. The endpoint list is in
`apps/server/src/routes/` and the routes the client parses are enumerated in
`apps/server/test/contract.test.ts`.

> **The single most important fact:** the loop is playable end to end and has never had a
> player. Everything below is blocked on somebody living with it for a couple of days, not
> on more features.

## Next, in order

**1 · Play it for two days in real gaps.** On a phone, with real absences. Follow
`playtest-log.md`. Then fix what that reveals.
Every number a simulator cannot see is waiting on this: `DEBRIS.share`, `DEBRIS.decayMinutes`,
the flight-bay base, mining throughput, and every mining constant.
**Done when:** two days are logged, and the two numbers `playtest-log.md` names are recorded.

**2 · Find why the gate went red, then give `TAX` headroom and re-derive `ARR`.**
`TAX` reads 0.0717 against a floor of 0.10 and the informed archetype loses one seed. Until
this is done, nothing in the un-losable-sink family can be measured at all (D33), and neither
band may be widened to admit a feature.
**Done when:** the five-seed gate is green again and the cause is written down.

**3 · Season lifecycle.** A `season_end` handler and a freeze, so a season finishes on its own
rather than when someone runs a command. `wipeAllServers` and the account record already exist.
**Done when:** a season ends on schedule, the ladder freezes, and the wipe is scheduled rather
than manual.

**4 · Asteroid impacts and the Drill.** Generated and stored, never scheduled.

**5 · Idempotency keys on the launch path.** `request_log` exists and is unused.

## Deferred, deliberately

**If time allows:** Aegis interaction with asteroids · vanity boards · planet skins and custom
names · a season closing reel.

**Post-MVP:** Capacitor mobile shell · web push · Tauri desktop · fleet interception · active
deception · combat replay · alliances · chat · monetisation.

**Cut order if behind:** asteroids → Radar L4–L5 → Aegis → cosmetics.
**Never cut any part of telescope / explorer / radar / veil.** Those four are the game.

## MVP completion gate

Not done until all five hold.

- **Product** — the core experience is present; the planet feels owned; other players matter;
  the information → decision → action loop works; risk and reward are meaningful; there are
  reasons to check back.
- **Gameplay** — the loop is playable end to end; progression, economy, intel, fleet, combat,
  defence, loot, offline progression and the season all work; critical edge cases are handled.
- **UX** — a new player understands the point; the main actions are findable; no needless
  micro-management; the portrait flow is usable; success and loss are legible.
- **Engineering** — the production build works; server authority is intact; async operations
  are safe; transactions are consistent; known races are handled; no known critical security
  holes.
- **Quality** — no critical placeholders, no half-finished core features, no major known bugs,
  and the end-to-end flow tested on a real device.

Then, before saying "done": **a fresh-player test.** Watch someone who has never seen it take
their first session, and fix what that reveals.
