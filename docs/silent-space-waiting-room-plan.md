# Silent Space as a waiting room — D212 plan (owner, 2026-10-07)

## Requirement

1. **Departure.** A MAIN commander who, for 30 hours, has started none of: an attack, a building
   upgrade, a research, a ship or ground-defence production order is moved to Silent Space. All four
   are joined with AND: any one of them keeps the commander in MAIN. Login no longer counts.
2. **Waiting room.** In Silent Space: no attacks, no asteroid mining, no pirate raids, resource
   production at 50 %. Staying there must never be the better way to grow.

Owner answers (AskUserQuestion, 2026-10-07):

- "Production 50 % slower" = resource production rate ×0.5. Store and works ceilings unchanged.
  Build, research and yard durations unchanged.
- "Attack" = every combat launch: world attack (player or neutral), Death Star, clan joint war
  wave, monument wave, pirate raid, Intergalactic Convoy strike.
- Also closed in Silent Space: debris harvest, merchant trade runs, Intergalactic Convoy strike.

## Decisions taken without asking (small, reversible)

- New nullable column `players.last_progress_at`, stamped with server time in the same transaction
  that commits the order. `build_orders.started_at` cannot be used: it is the queue start, so a
  third queued order would look like activity hours after the player left.
- Counts: build orders `BUILDING`, `HULL` (ships and ground defence), `INSTRUMENT`, `SATELLITE`;
  Death Star and Interceptor builds; research orders; the combat launches above.
  Does not count: login, collect, repair, transfer, probe, mining, harvest, trade, clan aid,
  clan support, settlement, chat, cancel.
- Due instant: `max(last_progress_at, joined_at, main_entered_at) + 30 h`. A newcomer and a
  commander returning from Silent Space each get a full 30 hours.
- Migration backfill: `last_progress_at = last_active_at`. Commanders already absent 30 h+ leave on
  the first sweeps; everyone who logged in recently gets 30 hours from that login.
- Seated, awake bots stamp `last_progress_at` with `last_active_at` (they are the population).
- `INACTIVITY_MS` (48 h) stays for the return application expiry and the clan successor cutoff.
- Banned launches are refused with `SILENT_SPACE_LOCKED` (409). Flights already in the air at deploy
  finish normally. Transfer, probe, settlement, clan aid and support stay open.
- Monument waves are closed in Silent Space (a held monument pays production).
- Pirates, asteroids, merchants and convoys keep spawning there: visible but locked, so the player
  sees what returning gives back.
- MAIN warning: Now line entry `silentSpace` in the last 12 hours before departure.

## Edge cases

- Exactly 30 h → moved; 30 h − 1 ms → stays (inclusive like D174).
- Null `last_progress_at` (new player) → joined/main-entered time decides.
- Queued order completing later does not refresh the timer; placing it does.
- Cancel after placing does not undo the stamp (cancel refunds only half).
- Production change applies from the next tick; the transfer ticks every world at the old rate
  before it moves (existing `loadLocked` in `transferCommander`).
- Probe of a Silent Space world reads the halved stock (intel must not lie).
- Concurrency: stamp is a single-row `UPDATE players` in paths that already update `players`
  (wealth, shield) after their planet locks — no new lock order.

## Mirrors (each gets a test or a "not affected" note)

| Place | Change |
| --- | --- |
| `packages/rules/src/inactivity.ts` | `SILENT_SPACE`, `silentSpaceDue`, `silentSpaceDueAt` |
| `packages/rules/src/economy.ts` | `advanceEconomy` `pace` input (rate only) |
| server schema + migration | `last_progress_at` |
| `services/progress.ts` (new) | `markProgress` |
| build, research, strategic, mission, clanWar, monument, pirateRaid, intergalacticConvoyRaid | stamp |
| mission, strategic, clanWar, monument, pirateRaid, intergalacticConvoyRaid, mining, trade | refuse in Silent Space |
| `silentSpace.ts`, `commanderTransfer.ts` | new eligibility |
| `planet.ts` / `planetView.ts` / `intel.ts` | `silentSpace` flag, halved rates, `silentSpaceAt` |
| bots `sweep.ts` | stamp for awake bots |
| web: schemas, faults/launch lock, focus sheets, NowLine, SilentSpaceNotice, gains, errors, 6 locales | copy + gating |
| wiki `season.silent-space`, `docs/game-design.md` D174/D212 | text |
| `packages/sim` | not affected (no Silent Space model) |

## Review fixes (2026-10-08)

- The away recap ("what accrued while you were gone") and the outage toll on the fault sheet
  used the full rate; both now apply the Silent Space pace. A probe of a Silent Space world reads
  the halved works (`standingAt`), tested against the owner's own tick.
- Monument quotes and joint-war monument marks are refused in Silent Space too (tested).
- Settlement needs a claim window, which only a neutral battle opens; with attacks closed it is
  closed in practice. Mining, trade and collecting do not reset the 30-hour clock (owner's list).
