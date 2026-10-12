# Production stability — 12 October 2026

Release base: `81560c305d4cad6e8135d784fb81186726634a02`. Work is isolated in
`fix/prod-stability-20261012`; the owner's original worktree, including its
uncommitted radiation/monument work, must remain untouched. The owner explicitly
authorized fixing, independently testing and deploying this stability release.
Select this pushed branch rather than unrelated local/master commits.

## Evidence and requirements

- Placement transaction startup p95 was 2.56–2.90 s across three replicas (their
  latest 4096 observations), while gameplay pool acquisition p95 was under 1 ms.
  Two placement connections per replica are held through the whole handler.
- A correlated 30-second passive sample showed CPU 5–60%, averaging 23.4%, and
  request bursts accompanied the peaks. RAM ~2.8/11.7 GiB, available ~8.8 GiB,
  swap 1 MiB with no swapping; disk 27%. No production OOM or CPU throttling.
- Traffic accounted for 5324/13750 API requests in a 10-minute sample. A shard
  event refreshes it at 250 and 500 ms. Requests do not consume cancellation
  signals; overlapping invalidations can leave abandoned HTTP requests running.
- At 20:12:34 UTC, research returned HTTP 500 after a three-process deadlock:
  research held the player row and waited for a planet; a planet GET waited for
  the worker; the probe worker held planets and waited for the report's player FK.
- Traffic queries scan 16496 mining rows to find 11 active runs; expressing the
  two active enum states positively lets the existing season/status index work.
  Per-player sensor history is reread and all lane discoveries recomputed on
  every traffic request despite shared snapshot caches.
- Cloudflare proxy traffic began appearing at 11:17:40 UTC. Nginx forwards the
  edge IP as the visitor IP. Heavy traffic and rate refusals predate that switch;
  no observed SSE reconnect storm or evidence that DNS caused the CPU waves.

## Implementation and regression boundaries

1. Serialize research queue writers using one transaction advisory lock per
   commander. Keep a player KEY SHARE lock to fence deletion and interoperate
   with the deployed release's FOR UPDATE during a compatible roll. Do not block
   report FK checks or planet-first worker wealth updates. Cover queue insertion,
   completion, refund, duplicate taps and real probe-report writes under contention.
2. Consolidate ordinary shard traffic refresh into one consistency-delayed pass;
   retain immediate private strategic sight plus its repair read. Prevent refresh
   cancellation/restart storms: one request in flight plus a bounded follow-up
   for an event that arrives after its snapshot. Cover slow HTTP, event bursts,
   first-open/reconnect, visibility, unmount, relocation and time boundaries.
3. Cache only caller-keyed sensor history, with build/control/impact/placement and
   listener reset invalidation. Narrow active-run and claim queries. Preserve
   outbound/returning legs, expired-target returns, discovery timing and fog.
4. Trust CF-Connecting-IP only from Cloudflare's published IPv4/IPv6 prefixes,
   scoped to this game's vhost; retain replacement of untrusted forwarded headers.
   Cover proxied visitors, direct-origin spoofing, stage rendering and CSP/SSE.
5. Qualify the combined changes on an isolated database. Placement capacity stays
   at two unless a bounded representative comparison justifies another budget;
   never remove the transfer lease or load-test production.

## Release gates

Tests must first reproduce regressions, then pass after changes. Ordinary tests,
types and lint run sequentially with nice 10 / one workspace / one Vitest worker.
No long economy simulations are authorized. Exercise a disposable restored copy,
real client and worker, compare latency/query/CPU metrics, preserve a checked
backup plus previous image/webroot/vhost/environment, then roll APIs individually
and the singleton worker. Publish prebuilt web while retaining old hashed assets.
Require all runtime/image/public release identities, health, event integrity,
correct visitor IP and post-deploy observation before considering work complete.

## Implementation and code review

- Research enqueue, completion and recovery now share a transaction advisory
  queue lease plus a player KEY SHARE fence. The real probe-report/wealth-update
  contention regression failed with the previous lock and passed with this one.
  Existing queue, dependency, refund and completion regressions are retained.
- Ordinary shard traffic uses one delayed refresh with 0–250 ms jitter. Private
  strategic sight retains its immediate refresh and delayed repair. Query reads
  join in-flight requests and retain a fresh follow-up after later events; busy
  galaxies, cancellation, removal and replacement are review boundaries.
- Frequently refreshed HTTP readers consume TanStack Query's cancellation signal,
  including both WorldProvider readers found during review. Body cancellation
  remains an abort instead of being converted to a schema error.
- Traffic narrows mining, raid and trade status predicates to the two active
  states, using the existing indexes. Mining claims are bounded to retained
  targets. Traffic computes asteroid discovery only for actual flight targets;
  returning flights to expired rocks retain the original discovery rule.
- Sensor history is bounded and keyed by commander and season. Its writer emits
  a private transactional invalidation when an epoch changes, including the old
  owner on transfer. Existing worker events also invalidate it during the roll.
  Listener reset, ownership/placement and season changes clear affected data.
- Nginx trusts CF-Connecting-IP only from the 22 published Cloudflare ranges in
  the game vhost. An isolated real Nginx test verifies trusted-edge forwarding
  and rejection of direct-client forged CF/X-Forwarded-For headers.

No gameplay rules, durable schema, migrations, season flags, checkout flags or
bot population settings change. Placement capacity remains two unless separate
evidence justifies changing it. The new private event is understood by the new
client; the deployed client's unknown-private-event path safely refreshes reads.

The owner limited further expansion on 13 October: finish review of this patch,
resolve its own regressions, and deploy it separately from their local changes.
They also capped local Node heap at 4 GiB: both lint scripts now use 4096 MiB,
with a failing-then-passing command regression and sequential coverage instructions.
Do not use 6 GiB; heap and total RSS are distinct limits.

Qualification and deployment results will be appended after their gates pass.
