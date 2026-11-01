# Leaderboard / Honor review — 2026-11-01

Owner-authorized scope: both ranking prize tables, current row prizes, the illustrated
Leaderboard menu card, direct Rewards navigation, the approved half-size prize schedule,
and ranked Honor in every competitive main galaxy. Base: published Legacy release
`86a6168b8668c0c27a6604d9d204af893c266735`.

## Confirmed findings and fixes

1. Startup adoption of an older SHADOW season failed with `Missing Honor reference history`
   when a commander had no inventory observation. The new regression failed before the fix.
   Adoption now records genuine current inventory at the opening boundary before validation;
   it does not backdate inventory or award past points. Manual read-only opening still refuses
   missing history. The affected initialization/opening group passed 55 tests.
2. An empty ladder returned before rendering the ranking tabs and reference prizes. A new UI
   regression failed before the fix. Empty galaxies now retain tabs and prize disclosure and
   show the existing empty-galaxy message instead of a search-mismatch message.

## Qualification

- All ordinary rules tests: 196 files / 3,332 passed.
- Related Honor, season, contract and Legacy server tests: 65 files / 641 passed,
  2 existing version-conditional skips. Each worker used its own migrated disposable database.
- Related leaderboard, menu, season, Legacy and localization UI tests: 22 files / 266 passed.
- No economy/season simulations, snowball audits or calibration studies were requested or run.

The live season cutoff, zero/nonpositive eligibility, tied-place pooling, single larger payout,
replay/idempotency and recorded entitlement delivery remain intact. A zero-score `No prize`
is the correct current entitlement, not the reference full package.

## Release contract

No schema migration is added by this release; its baseline journal has 218 entries.
The two live production MAIN seasons were already ACTIVE Honor v4 during inspection.
Existing active policies, scores and opening times must remain unchanged across rollout.

Use a clean pinned commit, retain the current runtime environment (including the worker's
FCM configuration), back up and restore the production data to an isolated rehearsal database,
validate old/new image reads and writes there, then roll the three APIs and worker before
publishing the prepared web assets. Preserve old hashed client assets. Acceptance requires
runtime SHA/image agreement, healthy queues/streams and the matching public release marker.

Older local Legacy copies are privately backed up and superseded by the published Legacy
version. Unrelated local workflow, FocusPanel, research and DM-tool changes remain local by
explicit owner choice and are outside this release.
