# Performance optimization — 11 October 2026

Owner request: reduce latency and improve performance incrementally, without regressions.
Preserve gameplay, placement isolation, fog, visual quality and deployment defaults.

## 1. Placement pool

The two-connection lease pool holds a connection throughout each authenticated HTTP
handler. The existing gameplay-pool probe does not measure this queue. Make the
lease budget configurable, retain the default of two, and measure actual transaction
startup without adding probe connections or queries. Startup includes pool queuing,
connection establishment and BEGIN; it must not be described as pure queue time.

Changes: environment parsing, placement wrapper, bounded runtime metrics, metrics
endpoint, compose configuration and deployment guidance. No schema changes.

Cases: default and configured concurrency; invalid/zero/fractional/oversized budgets;
queued requests eventually proceed; handler failures release leases and are not
counted as connection failures; public routes and SSE bypass the wrapper; stale
placement still fails; a shared lease still prevents relocation during a handler;
projection placement reconciliation still runs.

Risk: increasing this budget raises PostgreSQL connection demand and can move the
bottleneck into the gameplay pool. Keep production at two until representative
load measurements justify a change. Do not shorten the lease or remove its queries.

Validation: first observe new tests fail, then run them with existing placement,
transfer and stream regressions. Finish with sequential typecheck, lint and ordinary
workspace tests, one worker per workspace. Long economy/season audits are excluded.

## 2. Worker scheduling

Drain another full, successful batch immediately, yielding between batches so
shutdown and HTTP can run. Keep handlers sequential and preserve claim ordering.
Keep the existing poll interval as the idle/error fallback; never spin on an empty
batch or consume all retry attempts in an immediate failure loop. Read the clock
again at claim time so a repair cannot leave the due cutoff stale.

Cases: more than one batch; an exactly full last batch followed by empty; a failed
handler or failed claim; stop during a handler; a timer firing during a batch;
fresh claim timestamps after maintenance. Changes stay in the worker loop and its
tests; no queue SQL, event kinds, gameplay rules or poll defaults change.

Maintenance detachment is deferred: repair ordering and the existing single-tick
contract need separate validation. Backlog draining and a fresh cutoff remove
avoidable waits without introducing new concurrent gameplay writers.

## Validation record

New placement tests failed for the absent configuration/metrics and the hardcoded
two-connection limit. After implementation, 43 placement/transfer/stream tests passed.
New worker tests failed for the extra poll between batches and the stale claim
cutoff. After implementation, 59 worker, bot and Silent Space tests passed.

The pre-existing `astera_test` database had migration/schema drift (the account's
`first_game_shield_available` column was missing). Validation uses a freshly migrated
isolated `astera_perf_20261011_test` database instead; development data is untouched.

## 3. Telescope confirmation N+1

`readTelescopes` already batches fleet/instrument reads, but confirms each eligible
watch with a separate awaited UPDATE. Collect the same readings and send one
parameterized UPDATE for all confirmations. Keep UNKNOWN readings unwritten, the
15-second granularity, watch identity/slot/target, eligibility and RNG seeds intact.
No additional reads, connections, gameplay rules, caches or dependencies.

Cases: three watches produce one write; mixed HOME/AWAY results map to the correct
slot; UNKNOWN and empty results produce no writes; 14,999ms produces no write and
15,000ms does; retargeting while an old confirmation waits must not populate the
new target's history. Lock touched watch rows in primary-key order and recheck
target, observer, detached state and confirmation granularity after waiting.

Changes: telescope confirmation persistence and real-Postgres regression tests with
a Drizzle SQL logger. The larger `/api/planets` repeated commander/research reads
remain a separate candidate because lazy economy and world locks must be preserved.

The original implementation was observed issuing three UPDATEs for three watches
and overwriting history after a concurrent retarget. The batch implementation passed
117 telescope/galaxy/placement/scheduling tests (one existing skip), including the
SQL count, exact throttle boundary, UNKNOWN handling and concurrent-retarget case.
The regression also compares total SQL count for one versus three watches with the
same fleet-truth branch; confirmation query count must remain constant.

Additional concurrency checks passed for detaching a watch, a newer confirmation
committing while an older one waited, and two simultaneous readers. These exercise
PostgreSQL row locking rather than mocked query-builder calls.

Paired loopback measurement against HEAD's original `readTelescopes`, 80 samples
per version and watch count after 10 warm-up rounds, alternating call order:

| Watches | SQL before → after | UPDATEs before → after | Median ms before → after | p95 ms before → after |
| --- | --- | --- | --- | --- |
| 1 | 7 → 7 | 1 → 1 | 4.75 → 4.68 | 6.31 → 5.78 |
| 3 | 9 → 7 | 3 → 1 | 5.54 → 4.84 | 7.12 → 5.96 |

Each read started with unconfirmed watches; reset/setup time was excluded. Same
fixture, clock, PostgreSQL and query logger for both versions. This is a bounded
local measurement, not a production percentile or proof under load. Raw report:
`/tmp/astera-telescope-benchmark-20261011.json`.

## Remaining backend query findings

| Path | Finding | Constraint for the next change |
| --- | --- | --- |
| `/api/planets` → `planetView` | Serial per-world projections repeat player, active research, research discovery and capital Core reads. | Keep ascending UPDATE world locks and lazy economy; share commander reads within the request's transaction. |
| `planetView` strategic assets | Death Star and Interceptor use two reads of the same table per world. | Read both types once and preserve each pad's ordering/status filters. |
| `readTelescopes` → `instrumentLevels` / `fleetTruthFor` | Already batches worlds into IN queries; not a database N+1. | Preserve eligibility, current ownership and effective hardware. |
| `/api/galaxy` season / monuments | Awaited prerequisites delay independent reads; a waterfall rather than N+1. | Preserve the season/placement boundary and monument snapshot validation. |

Only the telescope confirmation path has a measured one-versus-three SQL regression
in this change. The other findings are static inspection, not production profiling.

## Next candidates

Worker maintenance isolation, initial client download and duplicate reads. Each
requires its own failing regression tests and measurements before implementation.
Large SSE/fog/cache rewrites need separate evidence and are not bundled here.
