# Asteroid spawn correction — 2026-10-09

Owner approved implementation of the incident recommendations and local proof. Production
deployment is outside this task. Tests run sequentially at low priority with one worker.

## Requirements and risks recorded before implementation

- Supply averages raw counts from the current hour and the preceding five actual hours.
  Ignore older rows after an outage. Preserve founding-day eligibility, recent smoothing,
  human/bot gates and the existing average over available samples; missing hours do not
  become invented population samples.
- Reject effect restamping if the stored window's duration differs from its own ruleset's
  authored duration. Reject a changed shower whose hour has already been planned, including
  a future half-hour shower in the running hour. The whole transaction must roll back.
  `adopt-event-calendar` remains the operation for a full future calendar replacement.
- Freeze all dynamic asteroid generation parameters with each newly opened hour. Old rows
  without the new snapshot use the immutable pre-release v1 parameters. Preserve RNG order,
  indexes, public IDs, ore claims, birth/expiry times, orbits and mining targets. Include the
  snapshot in cache keys and in operator manual-batch generation.
- Keep 30-minute shower windows and halve v10 multipliers: weekday lunch ×2, evening ×3;
  weekend lunch ×3, evening ×5. Stamp definition v11. Existing opened hours remain frozen.
- At supply 35, the weekday evening becomes 53 shower + 18 normal = 71 new rocks per hour
  instead of 105 + 18 = 123. The weekend evening becomes 88 + 18 = 106 instead of 175 + 18.
  This reduces future arrivals; it does not erase current stock or partially mined rocks.
- The nullable snapshot migration is additive. Rehearse it on a restored production copy,
  prove existing generated rocks unchanged, migrate with the new image, align all three
  APIs and the singleton worker, and explicitly adopt the future calendar. Never wipe a
  season or reset the queue to deploy this change.

Validation will record failing tests before implementation and passing tests after it,
including real PostgreSQL/worker/claims and fresh-process reads rather than mocked services.

## Implementation and local proof

The worker bounds `rollingSupply` by time as well as row count. `restamp` checks a shower's
authored end and refuses changes that overlap an already-written hour. Migration 0146 adds
nullable `generation`; new hour rows write the full Zod-validated snapshot, while older
rows read literal, immutable v1 parameters. Field composition, the hour cache and manual
bonus generation all carry this input. Version 1 retains the original RNG draws, orbit
sampler, isotope hash and public index protocol. Changing one of those algorithms later
requires retaining v1 and adding a version, rather than modifying the existing branch.

The shower definition is now v11, with all four multipliers halved. The events guide and
Wiki already derive their values from the shared configuration. The guide regression now
checks the corresponding ×2/×3/×3/×5 values.

The local incident regression is now part of ordinary CI:
[`asteroid-spawn-regression.test.ts`](../apps/server/test/asteroid-spawn-regression.test.ts).
The dedicated config still requires a localhost `astera_asteroid_repro_*_test` database.

| Scenario | Before correction | After correction |
| --- | --- | --- |
| Weekday evening, eligible 36 / smoothed supply 35 | 105 shower + 18 normal = 123 | 53 shower + 18 normal = 71 |
| First five minutes, same public fixture key | 44 reserved / 56 actually born | 18 reserved / 22 actually born |
| Inactive 50 commanders, five raw 50 samples aged 24–28 hours | Supply 42; 42 real visible rocks | Supply 0; no planned or visible rocks |
| Restamp a future old 60-minute window | New multiplier with old duration; 210 generated rocks | Transaction rejected; rows/jobs unchanged; full adoption gives 30 min / ×3 / 71 rocks |
| Change a future 12:30 shower after its 12:00 hour opens | Changed calendar contradicts frozen hour | Transaction rejected; calendar and hour unchanged |
| Fresh process with doubled ore and different orbit/lifetime/front/isotope settings | Depleted 105 rocks reappear after the ore-only change | 0 revive; all 123 complete specs/claims remain equal, both with stored snapshot and legacy null |
| Open an hour with a different ore table, then restore defaults and start another process | No independent snapshot | Stored altered table is used; all specs/claims remain equal and depletion persists |
| Five reboots + duplicate deliveries to two worker instances | One immutable hour | Same one immutable hour, 71 rocks, one next-hour job |

At exactly five hours old a sample is included; at six hours it is excluded. Missing recent
hours preserve the existing mean over available samples, rather than injecting fabricated
zeros. Contiguous recent samples still smooth 50→0 to 42, and founding-day behavior passes
the existing supply regressions. Thus this is not an instant-online population rewrite.

The historical v10 removal control still yields 105→65→45→63 after removing 40 and 20:
18 distinct normal rocks are born later; no removed index returns. The real mining control
still takes 700 from an 800-ore rock and leaves 100 visible. These behaviors explain why
deletion alone cannot prevent new arrivals or erase partially mined stock.

The pure generation test compares all 100 pre-release specs with the recorded SHA-256
`2759085aad824def42d27fd762772ed65a569449bfe7523f6089cd9fe0f931f4`. It also changes every
mutable generation setting while preserving the same output. Server boundary tests reject
unsupported/corrupt snapshots and verify the cache incorporates the complete snapshot.

## Validation record

- Before implementation: four real-service safeguard tests failed, including both restamp
  cases, stale population and the fresh-process ore revival. See
  [RED evidence](evidence/asteroid-spawn-fix-red-2026-10-09.txt).
- The rules tests first failed on mutable generation and the new balance expectations;
  [RED rules evidence](evidence/asteroid-spawn-fix-rules-red-2026-10-09.txt). The focused
  rules run then passed **70/70**; [GREEN evidence](evidence/asteroid-spawn-fix-rules-green-2026-10-09.txt).
- The initial dedicated incident run passed **17/17**. It was then extended to 18 tests
  with the deliberately different newly-written snapshot, and promoted into normal CI.
- The expanded server run passed 147 cases and found one old balance expectation in
  calendar seeding. After updating it to approved v11 values, that case passed; the
  subsequent complete validation is recorded below.
- Ordinary checks run sequentially, with `nice -n 10`, one workspace and one Vitest worker.
  No economy/season simulation or snowball audit was run.

Another local task was actively changing colony-abandonment and shop files. A broad type
check in the shared workspace encountered errors in those unrelated files. Final checks
use `/tmp/astera-asteroid-fix-20261009`, detached at
`8a4ae26856b1610cdc2d8bf0a70cc019e9bdb154`, with only this task's tracked patch/new files
and links to the installed dependencies. All four workspace type checks pass there.
This isolates the tested change without overwriting the other task's files.

## Review extension — 2026-10-10

The second review found an additional calendar-adoption race. `adoptLiveEventCalendar`
calculated its boundary from the command's captured `now`; while it waited for the season
lock, a worker could commit that hour. Adoption could then replace the calendar underneath
an immutable hour. The same mismatch could occur with an unexpectedly preplanned future
hour or an occurrence already processed by the lifecycle worker.

Four integration cases failed before the fix:
[adoption RED evidence](evidence/asteroid-spawn-review-adoption-red-2026-10-10.txt).
The fix rechecks committed hours after obtaining the season lock and advances the boundary
beyond the latest protected hour. It also preserves processed lifecycle occurrences.
A further test exposed an end-only marker: an end may be delivered while its failed start
still waits for retry. Checking only `startProcessedAt` was insufficient;
[end-only RED evidence](evidence/asteroid-spawn-review-lifecycle-red-2026-10-10.txt).
Both markers now protect the occurrence. Only windows after the resulting boundary adopt
v11, with their lifecycle jobs moved together.

The first eight added cases cover both PostgreSQL lock orders for restamp, worker/adoption
concurrency, an unchanged pending half-hour definition, a captured clock before a boundary,
a later preplanned hour, and start-processed/end-only lifecycle occurrences. Lock-barrier
tests wait for actual PostgreSQL blocking relationships; they do not mock the race.

The final review also found that `restamp`, unlike adoption, did not protect a processed
start/end when its asteroid hour job was still delayed. A command captured just before the
boundary could restamp an already-announced occurrence. Both real-service tests failed:
[restamp lifecycle RED evidence](evidence/asteroid-spawn-review-restamp-lifecycle-red-2026-10-10.txt).
A changed shower now rejects either processed marker. An already matching definition
remains a no-op, including with a processed marker.

The incident suite now passes **28/28**. Both test files that directly call `restamp`
pass **49/49** after that final correction:
[final calendar GREEN evidence](evidence/asteroid-spawn-review-restamp-lifecycle-green-2026-10-10.txt).

All four workspace type checks pass in the isolated checkout:
[type-check evidence](evidence/asteroid-spawn-review-typecheck-2026-10-10.txt).
After the final restamp correction, server type checking and lint of both changed files
passed again: [type check](evidence/asteroid-spawn-restamp-final-typecheck-2026-10-10.txt),
[lint](evidence/asteroid-spawn-restamp-final-lint-2026-10-10.txt).
The earlier complete rules/tools, server and web lint scopes also passed.

Final ordinary coverage is **10,724 passed / 30 existing skips** in the isolated checkout:

| Workspace | Files | Passed cases | Skipped cases |
| --- | --- | --- | --- |
| Rules | 111 passed | 2,026 | 0 |
| Server | 211 passed, across sequential batches | 3,072 | 1 |
| Web | 407 passed / 1 skipped | 5,626 | 29 |

Ordinary validation is composed from sequential batches to avoid repeating unaffected
tests. The completed rules run covers 111 files / 2,026 cases. The interrupted server
run retains 59 unaffected completed files / 1,787 passed cases and one existing skip.
Neither that interrupted parent command nor the earlier interrupted run is a completed
green invocation. The changed function's two direct caller test files were rerun after
the final guard. All remaining 150 ordinary server files and the full web suite passed
on the final source. The
[batch inventory](evidence/asteroid-spawn-review-retained-ordinary-2026-10-10.json)
records which files are retained and which are rerun. Economy simulations and the
snowball audit remain excluded.

The [coverage ledger](evidence/asteroid-spawn-final-ordinary-coverage-2026-10-10.json)
checks that all 211 ordinary server files are covered exactly once across the retained,
rerun and remaining groups. Evidence: [completed rules and retained server output](evidence/asteroid-spawn-review-partial-ordinary-tests-2026-10-10.txt),
[remaining server run](evidence/asteroid-spawn-final-server-remaining-ordinary-2026-10-10.txt),
[full web run](evidence/asteroid-spawn-final-web-ordinary-2026-10-10.txt), and
[sequential step exit codes](evidence/asteroid-spawn-final-sequential-completion-2026-10-10.json).
The [source comparison](evidence/asteroid-spawn-reviewed-source-comparison-2026-10-10.json)
records the 25 code/test/migration files that are byte-identical between the tested checkout
and the shared workspace. This qualification covers the asteroid change, not the other
tasks' concurrent uncommitted changes.

## Manual operator-command rehearsal

A separate disposable local database was cloned from the incident fixture. This check used
the actual `season.ts` CLI outside Vitest and the latest reviewed source. Before migration,
the new column and its journal entry were removed only from that disposable clone. The
pending-migration guard refused boot, and the migration CLI applied 0146 successfully.
All **299 existing complete rock specs and 105 claims** were identical before and after;
calendar and queue rows were also unchanged.

A deliberately preplanned future hour and old calendar were then added to the clone.
The unsafe `restamp` command rejected the change without writing anything. Calendar adoption
reported a cutover after the frozen hour: **14:00 Türkiye time**, rather than 13:00. Its dry
run wrote nothing; `--yes` changed only the future evening window to v11, ×5 for 30 minutes.
All **515 complete rock specs, 105 claims and protected lifecycle jobs** remained identical.
Repeating `--yes`, including once more with the final reviewed code, removed and inserted
zero windows and left the complete stored state unchanged.

After the final restamp lifecycle guard, the actual CLI rejection and adoption repeat were
run again. Both unchanged-state checks passed:
[final CLI rejection](evidence/asteroid-spawn-manual-final-restamp-2026-10-10.txt),
[final adoption repeat](evidence/asteroid-spawn-manual-final-adoption-repeat-2026-10-10.txt).

See [manual CLI evidence](evidence/asteroid-spawn-manual-cli-2026-10-10.txt) and
[step exit codes](evidence/asteroid-spawn-manual-cli-completion-2026-10-10.json).
The manual fixture contained no active mining flights. The real 700-from-800 mining arrival
and mining-target preservation are covered by PostgreSQL integration tests; the manual
rehearsal does not establish production-flight behavior or production migration timing.

## Remaining deployment and compatibility checks

The fixed 12-hour field read horizon still assumes the shipped 2.5–5-hour lifetimes. A future
lifetime increase beyond that horizon needs a separate retention/read-window review; merely
storing a larger value does not extend the DB query. Algorithm changes likewise require a
new version while retaining v1. Neither parameter changes in this release.

The production backup/retained Docker-image migration rehearsal remains unperformed. Local
PostgreSQL integration and fresh-process tests are evidence for the logic, not evidence of
production lock timing or old-image boot compatibility. Perform the restored-backup and
retained-image checks in the deployment note before a production rollout.

## Repeat the incident proof without parallel test load

```bash
# Create a disposable database once. Do not use the development or production database.
docker exec astera-pg createdb -U astera astera_asteroid_repro_fix_local_test
DATABASE_URL=postgres://astera:astera@127.0.0.1:5433/astera_asteroid_repro_fix_local_test \
  nice -n 10 pnpm --filter @astera/server exec vitest run \
  --config vitest.asteroid-repro.config.ts --reporter=verbose \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

All incident tests are now expected to pass; there is no intentionally failing diagnostic
left outside ordinary CI. This task did not connect to production or perform a migration,
adoption, restart or deployment there. See the
[release note](deployment.md#asteroid-spawn-correction--2026-10-09) for the production order
and restored-backup acceptance checks. A production restore/migration timing rehearsal
has not been performed by these local tests.
