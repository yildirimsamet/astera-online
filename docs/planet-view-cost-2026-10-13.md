# Planet response cost and lock duration

Base: deployed `3caa271d`. Isolated branch `fix/planet-view-cost-20261013`.

## Requirements and boundaries

Reduce duplicate database work in private planet responses; release gameplay
transactions before pure response calculation where the caller owns the transaction.
Keep response schemas, lazy economy, resource accounting, ownership/season checks,
placement lease, sorted multi-world locking and mutation atomicity unchanged.
No schema, pool-size, Redis, frontend, balance or game-rule changes planned.

The original working tree contains owner changes and must remain byte-identical.
Checks run sequentially, one worker, nice 10, Node heap <=4096 MiB. No long economy
simulations. Disposable local PG16 on loopback5546; never truncate the owner's DB.

## Findings and implementation

- Two-world response read player_research four times; single-world view read units
  three times. Captured as failing integration regressions before implementation.
- Commander facts are shared explicitly only within one list response transaction.
  No global or cross-request cache. Never reuse a pre-mutation snapshot after writes.
- Load full unit inventory for views only; command/worker loaders retain home-only
  queries. Reuse the already-read fault rows and inventory for dock rendering.
- One strategic-assets read covers both weapon types with unchanged ordering.
- Separate database capture from pure projection. GET handlers and transaction-owning
  commands render from committed captured facts, with no post-commit DB reads.
- A list uses one clock instant; commander data is fenced by player and season IDs.
- `planetView(tx, ...)` remains for transaction-supplied callers. In particular,
  idempotent clan commands MUST materialize and persist their response within their
  existing transaction. Moving rendering outside it would change retry semantics.
  These callers still benefit from all single-world query reductions.

## Risks / test matrix

- Same response shape and field values, including research discovery/queued levels,
  capital Core gates, home/away/docked units, strategic queues and fault timestamps.
- Fresh post-mutation inventory and resources; rollback never publishes a success.
- Foreign-world access refused; capture/secession/placement races retain fences.
- Concurrent collect/build and worker interactions: no double spending or deadlock.
- Real SQL statement budgets and render-after-COMMIT order; no timing-based flaky
  pass criteria. Compare old/new at identical fixed workload separately.
- Existing contract, economy, research, multi-world, dock, clan, worker, placement
  and full ordinary regressions, then types/lint and code review.

## Release qualification

Record query counts, transaction/lock time, latency and pool p95/p99 at identical
load. No claimed CPU percentage improvement from unmatched live traffic. Deploy
only after checks and comparison pass; use established rolling release and rollback
procedure. Observe production tails after deployment, preserve report, remove task
worktrees. Pending results must be reported explicitly rather than assumed green.

## Initial fixed workload evidence

Local PG16, same 4-world fixture and clock, 5 bursts of 12 concurrent requests per
route (60 observations), unchanged placement pool 2. These are local timings, not
production promises. Gameplay SQL excludes placement's separate connection.

| Route | SQL/request old → new | Mean transaction ms old → new | Response p95 ms old → new |
| --- | --- | --- | --- |
| /api/planet | 41 → 28 | 30.80 → 23.22 | 229.11 → 181.17 |
| /api/planets (4 worlds) | 158 → 79 | 124.32 → 71.96 | 790.91 → 478.38 |

Transaction timing is client BEGIN-dispatch to COMMIT-dispatch, including lock wait;
it is NOT an exact row-lock holding duration. No CPU measurement was taken here.
Placement distributions are cumulative within each run (including warmup and the
previous route); compare response-specific metrics above for precise route claims.
The local burst p95 remains above the aspirational100ms target; no complete-tail
resolution claim is justified. Evidence: /tmp/astera-planet-view-evidence/*bench.json.

## Season lifecycle lock order

Final review found a pre-existing inversion in GET /api/planets and
GET /api/planets/:planetId: explicit world locks were acquired before planetView
requested the season SHARE lock. A season-first lifecycle writer could then wait
for the same world, forming a deadlock cycle. The isolated PG/HTTP probe failed
with55P03 on both routes when the season holder tried world UPDATE NOWAIT.

Both routes now acquire season SHARE before any world lock, with requireLive=false
preserving reads of frozen seasons. Actual PostgreSQL waiter regressions assert
that the season holder can still lock its world while the GET waits. This adds one
small indexed season read per affected request. The original benchmark list SQL
budget79 preceded this final safety fix; final budget is80 and requires a final
measurement. The single legacy /api/planet budget28 is unchanged.
