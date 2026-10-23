# Repair inventory in probes and bulk selection

Owner request: include workshop ships in probe ship counts, and add one control to
select damaged ships before moving them to the workshop. Develop separately from
the deployed battle release. Do not deploy this task without a later owner instruction.
Base: production `54e290147ebed4584be870a79a967c94ccd4b66a`.

## Verified causes and intended behavior

`resolveProbe` only adds `home` unit rows to `fleetSize`; `dock:<lot>` rows are
excluded from both inventory and away status. Workshop ships are physically on the
world, so the ship count must include them, whether waiting or currently repairing.
They must still contribute no defence, class composition or active unarmed count.
Use canonical unit counts once; do not add ship-damage metadata as a second count.
Away fleets and ships on another world stay outside the local ship-count band.
Keep existing probe accuracy, independent RNG streams, frozen snapshots and delivery
rules. No migration or public response shape change is needed.

The manual Repair Station starts all quantities at zero and only has per-row Max.
Add a repair-mode Select all action for the visible damaged groups; select complete
available counts, including fractional wounds, and skip busy repair lots. Selecting
never sends a request or starts a paid repair. Existing confirmation, exact health
quotes, idempotency, radiation closure, queue/resource checks and the 50-group
request ceiling remain authoritative. Above that ceiling, retain the explicit
selection-limit warning and disabled commit; never truncate a selection silently.
Scrap remains explicit and confirmed. Clear and planet/tab changes reset selection;
new arrivals stay unselected until the user chooses them, and health changes still
invalidate a stale quote.

## Files and checks

- Server: `services/intel.ts`; real database probe/workshop regressions.
- Web: `screens/RepairStation.tsx` and `lib/probeScale.ts`; existing surface-local `repairStation.selectAll`
  translations already exist in all six languages. The own-world comparison must
  count docked ships too, and exclude critical home ships from defensive power,
  matching the target reading. Two failing regressions preceded this additional fix.
- UI regressions: mixed hulls/health groups, partial selection, clear/reselect,
  sub-bp damage, healthy exclusion, busy rows, empty list, pending request,
  changed health/inventory, tab/planet changes and the request limit.
- Server regressions: all docked, mixed home/dock, running/queued repair, away fleet,
  other worlds, partial moves/returns, completed repair, empty inventory and a blurred
  probe. Verify physical count conservation and unchanged actual defensive power.

Follow test-first red/green. Run focused connected server and UI suites, client
contract regression, type/lint checks and actual 350/1280 px TR/EN visual checks.
Local checks run sequentially with one worker/CPU; combined test+database memory is
bounded at 2 GiB. No long economy or season studies are part of this task.

## Review findings and evidence

The own-world probe comparison also omitted docked ships and counted critical home
ships as defensive power. Two new failing `probe-scale` tests reproduced both;
`yardstickOf` now uses the same physical inventory and combat-eligibility boundary
as the target reading. Workshop ships remain outside power and class/cargo readings.

The first partial-selection UI test dispatched a change without focusing the input,
leaving a draft that an actual click would blur. It now uses real user typing and
retains all full-count/clear assertions; the browser also fills a partial value,
selects all and clears it. Two unsupported Testing Library `exact` options were
caught by TypeScript and removed; accessible string names already match exactly.

The complete selected server run passed 10 files / 260 tests, retaining one existing
skipped intel test. This includes all 102 real server/client contract tests, full
intel, repair, manual-maintenance and maintenance API/review coverage. The final UI
run passed 12 files / 236 tests. Seven new real-DB tests cover workshop inventory;
eight new component tests cover bulk selection; two new comparison tests cover the
own-world issues. Initial red logs and all final outputs are under ignored `out/`.

The standard `node tools/visual.mjs out/repair-intel-visual --ship-maintenance` entry now also verifies
partial-to-all selection and clear. All six languages passed at 350 and 1280 px:
72 measured states, no page errors, overflow or clipped/hidden footer controls.
TR/EN phone captures were inspected directly. The local database is stopped; it
was bounded at 512 MiB, with the one-worker runner bounded at 1.5 GiB (2 GiB total).
The separate visual scope has a 2.5 GiB total cap and one CPU for Vite plus browser.

Server and web full typechecks passed on the isolated VPS check worktree. Changed
files are linted through root `pnpm lint --stdin --stdin-filename`, which uses ESLint's
real typed `lintText` path without rescanning unrelated files. VPS checks retain
hard container ceilings and Node's existing maximum 4 GiB heap.

Default-flags production web build smoke passed. All seven changed code/test/tool
files passed typed lint. Final server typecheck passed after the test cleanup.
The strengthened bulk-request assertion passed all eight component cases and a
scoped check extending the unchanged web TypeScript configuration. It asserts the
complete selected fleet directly, avoiding a matcher that introduced an unsafe
`any` assignment. No rule or compiler check was disabled.

The final review found no remaining confirmed defect in the changed flows.
No database migration, ruleset change, dependency change or live setting is needed.
This task has not been deployed; production remains a separate operation.

## Deployment preflight: existing Aegis/Honor failure

Before this deployment, all live roles reported `failedEvents=1`. A previously
exhausted mission-arrival handler failed on `Invalid Honor shield absorption`.
The battle transaction rolled back and the existing abandonment transaction
cancelled the attack and returned all 42 ships; its return notification exists,
there are no units at the old mission location and no battle report was committed.
Do not replay this cancelled attack or alter ships, loot, ownership or scores.

The issue belongs to the preceding random-fire engine: summed per-shot floating
absorption can exceed actual charge by an ulp. A deterministic 42-Warden/seed40
regression returned `100.00000000000001` against charge100. New rules regressions
also reproduced overflow at real Aegis charges and with joint/supported forces.
The engine now bounds this accounting field by the actual entry charge. It changes
no shot, hull damage, shield depletion, RNG, loss, retreat or outcome. Honor's strict
invalid-input guard remains intact.

Both the engine and actual Honor adapter regression failed before this correction.
Afterward the full ordinary rules suite passed 157 files / 2,876 tests; the complete
Honor battle-evidence file passed 12 tests. All three newly affected files passed
root typed lint, and the rules typecheck passed.

Deployment must preserve the existing five Compose inputs and append an image pin
for the three APIs and worker. Current API/worker54 already share the private-report
projection, so mixed old/new versions are compatible. A normal worker-first roll
can prevent further instances of this producer bug before rolling the APIs. Archive
and acknowledge only the individually verified, safely cancelled failed event as
an explicit operational action; retain its original error/attempt history, do not
requeue it, and require all health/queue/world gates green afterward. Retain a fresh
private dump, old image, webroot and exact environment before any live action.
