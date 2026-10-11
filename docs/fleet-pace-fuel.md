# Slower personal fleets spend less fuel

Owner-approved, 2026-10-11. Work on master without a worktree.

## Requirement and boundaries

- Personal world raids and transfers between owned worlds receive a pace discount:
  full / 75% / 50% / 25% / 10% speed costs 100% / 87.5% / 75% / 62.5% / 55% fuel.
- Apply `(0.5 + 0.5 * pace)` to raw fuel per leg, then round up. The existing
  HOMEWARD half-rate multiplies with this discount. Only returning transfer ships
  pay for the second leg. All fuel remains paid at launch.
- Shared clan strikes retain their existing up-front fuel payment. Tasks without
  a pace control retain full-speed pricing. Existing missions and recalls are not
  repriced or refunded. Keep the twelve-hour slowed-flight ceiling.
- Show actual fuel, full-speed fuel, saved deuterium, selected travel time and extra
  travel time together at the speed control. Explain the benefit at full speed and
  zero savings caused by per-leg rounding. Exact resource figures, localized.
- Recalculate affordability when speed, fleet or return choices change. Reserve
  fuel before deuterium cargo; show any cargo reduction and full-speed fallback.
  Slowing down must not silently add cargo.

## Code and regression risks

- Shared fuel rules; personal launch and transfer services; client navigation
  preview; PaceRow's optional personal-flight comparison; transfer load handling.
- PaceRow also serves clan strikes: comparison must be opt-in and its clan copy
  must not promise a discount. No database schema change. The slowdown review
  adds backward-compatible `pool.paces` to the clan operation response.
- Guard against discounting already rounded fuel, rounding the whole mixed return
  fleet, using an invalid preferred pace after a fleet change, fuel/cargo overdraw,
  stale baselines, and misleading percentage claims on tiny flights.
- Retain resource locks, rollback, concurrency guards, return timing, radiation
  previews, season-end checks and existing recall behavior.

## Verification

TDD: first observe failing rule, persistence and UI regressions; implement; pass;
review; run ordinary workspace checks sequentially with one Vitest worker and
nice -n 10. Cover every pace/lane/leg, boundary and invalid pace, exact fuel
affordability, mixed returns, transaction rollback/concurrency, recall, tiny-flight
rounding, speed/load changes, and localized copy. No long economy simulations.
Visually inspect the personal launch and transfer comparisons at 350px.

## Slowdown review requested by owner

- Inspect selected speed, propulsion/Beacon modifiers, twelve-hour boundaries,
  surviving/selected return groups, recall, season limits and radiation forecasts.
- Joint strikes checked the twelve-hour ceiling only on the combined outbound
  leg, although each contributor can have a longer direct return. Publish legal
  speeds using all planned legs and reject overlong slowed returns at launch.
- The joint-strike radiation preview used full-speed return minutes even when
  launch validation used the selected slow return. Use the same selected pace.
- A forced full-speed fallback must not invite the player to select a slower
  speed when the ladder has no slower legal option.
- Neutral battles and attacks invalidated by protection/ownership changes
  omitted the selected pace from the return timer and row. Preserve it on both
  paths, as on ordinary personal battles.
- The personal HP-radiation preview ended the return ten seconds early. Cover
  ships that survive the two flight legs but die after the engagement delay,
  including full speed, 50% and 10% speed. All three regressions failed before
  the return endpoint was corrected and passed afterwards.
- Parse real joint-strike HTTP payloads with the client schema before staging,
  after staging and after launch; the legal pace ladder is a public contract.
- The selected percentage is retained on normal returns. Research is frozen at
  launch; the existing return planner reads the origin's current Beacon. A Beacon
  change during flight can therefore change the actual return ETA. This review
  preserves that existing satellite rule; it does not add a frozen flight modifier.

## Commit checkpoint, 2026-10-11

- Detailed review completed; the slowdown findings above were reproduced with
  failing regressions before their fixes. No database migration is introduced.
- Rules: all 114 ordinary test files / 2,062 tests passed. The broader server run
  completed 62 files / 1,929 tests without failures before the owner requested
  a commit checkpoint. The unfinished ordinary suite remains a release gate.
- Focused slowdown server regressions: 64 tests across mission, transfer and
  joint-strike start. Focused client regressions after the slowdown audit: 188
  tests. The final radiation fix passed 97 launch/radiation/pace tests. The new
  actual-HTTP joint-strike schema test passed at all three operation stages.
- All four workspace typechecks passed. Root lint is run in sequential server,
  web and package scopes to keep the local PC responsive.
- Personal-flight visual verification covers launch and transfer at 350px and
  1,188px in all six languages, checking exact savings, ETA and overflow.
- Owner requested the commit first, followed by the galaxy daily-online readout
  task and a combined deployment. Finish the ordinary suite, build and release
  qualification on the combined revision. Do not run long economy simulations.
