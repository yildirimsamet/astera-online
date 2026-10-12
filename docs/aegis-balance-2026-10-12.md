# Aegis balance — 12 October 2026

Owner-approved table: level 1 holds 150 HP; capacity grows by 1.5 per level.
Upgrade 0→1 costs 197 alloy / 148 crystal / 0 deuterium; each next upgrade
costs 1.6 times the opening price, rounded from the unrounded exponential.
Only Aegis changes; Telescope, Radar, Veil and Nullifier retain their rules.

Requirements and regression surfaces:

- Hold every authored capacity and price through level 20; absent Aegis has zero HP.
- Existing installed levels must adopt the new capacity in the current season.
- Migration must cover capitals, colonies, neutral worlds and Core-capped hardware.
- Preserve resource balances, lazy economy anchors, EMP/Core outages, flight timing,
  completed battle reports and probe snapshots.
- Preserve committed queue prices, deadlines and cancellation refunds. New orders
  use new prices. Old-price completions must remain consistent with wealth accounting.
- Owner confirmed: preserve existing charge ratio and historical investment value;
  no retrospective resource refund. `satellites.aegis_invested_value` records the
  legacy catalogue total, then each completed upgrade adds its paid order invoice.
- API, worker, UI predictions, gains and wiki use shared rules; test their integration.
- Test the migration on an isolated test database, including repeated migration runs.
- Old writers clamp charge to the old maximum: deployment requires a coordinated
  stop of old APIs/worker, explicit migration and start of matching new processes.
  No production operation is performed by this development task.

TDD: write regression expectations first, observe failures, implement, run focused
checks and the ordinary workspace checks sequentially with one Vitest worker.
Long economy/season simulations are outside this task's authorization.

## Same-season release sequence

Follow `docs/deployment.md` release gates with a reviewed immutable build and a
verified backup/restore rehearsal. This change must not use a mixed-version roll.

1. Build both artifacts before interrupting service. Rehearse migration 0152 on
   the isolated restore; compare per-world installed/effective levels, fill ratios,
   inventories, lazy tick anchors, pending invoices and wealth before/after.
2. At the authorized cutover, stop/drain all three old APIs and the single worker.
   Do not let old writers restart after the conversion; they cap charge to old HP.
3. Run the migration command once with the exact new server image. Drizzle applies
   the DDL and both updates in one transaction and records the migration. All
   existing worlds with Aegis are converted; no level, resource or deadline changes.
4. Start matching updated APIs and worker, then publish the rebuilt web bundle.
   Verify health, representative world capacities/doluluk, wealth and queue handling.
   Request a browser refresh for tabs retaining the previous rules bundle.

Scheduled battles retain arrival deadlines and resolve against the new shield at
contact. Past reports/probe readings remain snapshots of when they were recorded.
No season reset or ruleset bump is needed. Downtime still contributes ordinary lazy
production/regeneration after restart; EMP keeps its existing regeneration blackout.

Rollback to the pre-cutover application is not safe after new-price orders have
been placed: it ignores paid investment and clamps increased shield capacities.
Retain a compatible rollback build. Do not restore a pre-release database over
player writes or blindly repeat the charge conversion outside the migration ledger.

Local verification uses the dedicated `astera_aegis_20261012_1150_test` database;
the pre-existing shared test database has unrelated schema drift (missing the
first-game shield column). It is neither repaired nor used for this task's checks.

## Local verification

- Rules regressions: 251 tests passed across the new Aegis table and affected
  economy/foundation/invariant suites. The literal table covers levels 1–20,
  level 21, absent hardware and cumulative new investment.
- Server regressions: 122 tests passed across Aegis migration, build queue and
  API contract suites. The 12 migration cases passed again against the final
  migration journal, including retained charge, Core caps, EMP, historical
  investment, old invoices, cancellation and repeated application.
- Web: the new Aegis gain and English/Turkish wiki-table cases passed. The full
  gain and prediction suites passed (38 and 42 tests respectively); the broad
  web attempt completed 40 files before being stopped to keep verification
  within this task. A separate existing monument wiki assertion fails against
  the concurrently edited monument explanation; it is not changed here.
- Broad rules attempt: 2,114 passed; the existing public-event calendar test
  expects ruleset 16 while the separate monument work sets 17. That test and
  monument implementation remain outside this change.
- Broad server attempt completed 57 files before interruption. Its asteroid
  cutover test hit the 30-second timeout; an isolated rerun passed in 1.9 seconds
  without code or timeout changes. This is not a claim that every server or web
  test completed.
- Final lint of the 14 source/test files containing Aegis changes passed, using
  the root script's 6 GB Node heap and low priority. The final sequential
  workspace typecheck reports only concurrent changes in `rules/src/radiation.ts`
  and `server/src/services/clanWar.ts`; those errors are not repaired here.
- Migration snapshots form the current 0150 → 0152 → 0153 chain. Aegis's 0152
  introduces only its investment column; the separate 0153 owns monument schema.

All checks run sequentially at low priority with one Vitest worker. No long
simulations, shared test-database repair or production changes were performed.
