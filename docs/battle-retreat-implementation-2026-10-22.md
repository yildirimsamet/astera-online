# Shared random-fire and damaged-ship retreat — implementation plan

Owner-approved 22 October 2026. Worktree: `blindspace-battle-retreat`, based on verified
production `527e6ca853e34c9834db9c0c4e4eec6f548145dd`. Do not deploy without first
notifying the owner. Unrelated original-worktree changes must not enter this release.

## Requirements

- Three simultaneous-fire rounds. Each eligible armed ship shoots one uniformly random
  living enemy, combat/ground targets before cargo; skip predicted kills within the
  volley and hit cargo in that SAME round once the combat pool empties. No single-shot
  overkill spills. Shuffle shooters; canonical physical order independent of input maps
  and contribution array order. Splitting identical waves must not buy extra protection.
- Only end rounds one and two: independent chance for each living mobile ship below
  its side's inclusive hull-HP threshold. No healing, shield refill or later targeting/
  firing for a ship that retreats. Ground guns cannot retreat. Cargo contributes no power.
- Freeze combined side power at battle entry using participating physical `combatValue`
  (including ground guns on planets). A planet's excluded home ships never enter the
  battle. At monuments critical ships remain targets and count in the entry ratio,
  exactly as in the approved simulation; firing/capture eligibility is separate.
  Equality and ratio<1.5: both 25% chance / HP<=25%;
  1.5<=ratio<2: weak33%/HP<=30%, strong20%/HP<=30%;
  2<=ratio<3: weak55%/HP<=55%, strong15%/HP<=30%;
  ratio>=3: weak70%/HP<=70%, strong10%/HP<=25%.
- Base personal shield = researched maximum hull HP * 0.25, existing shield-research
  ladder retained (L4 => 50% hull shield). Full at battle start, never between rounds.
  Radiation bypasses it and zero HP still destroys a ship. Ground has no personal shield.
- Before-battle automatic fleet escape ratio 3 -> 4, inclusive; retain posture, ship
  floor, fuel and decisive standing-result conditions. Separate from damaged-ship retreat.
- Physical survivors ALWAYS include retreated ships, preserving return/dock ownership,
  damage and conservation. Deaths/loss values/score/wreck creation count physical
  destruction only. Only collectors still present may recover the wreck. Active survivors (physical minus retreated) decide battle grade/control. Cargo
  of ships that left the fighting does not loot on planets.
- Monuments: winner's retreated ships rejoin HOLD with wounds; loser's physical survivors
  all return. Cargo yields only to an active armed attacker. Cargo-only vs cargo-only:
  no shots, defender holds. Escaped warships cannot hold/capture by themselves.

## Changes and risk map

1. `packages/rules/src`: shared per-ship engine behind solo/joint/supported/monument
   entrypoints; side policy; shield/escape constants; result and immutable round retreat
   telemetry. Keep explicit old `shipShields:false` replay arithmetic for historical
   golden tests, not an alternative production battle implementation.
2. Planet settlement: `worker/handlers.ts`, `clanWarSettlement.ts`, support settlement:
   retain physical return fleets and each owner's wounds; active loot cargo, destroyed-only
   accounting. Host, support and attacker ownership must never mix. Ground salvage and
   Aegis/Nullifier need explicit regression coverage.
3. Monument settlement/control/report: current physical splitting can remain if result
   survivors stay physical. Control must exclude retreats. Fix cargo-yield explanation so
   it does not label retreated warships as cargo. Preserve HP fractions, deuterium/fuel
   splits, capacity selection, and return event generation/idempotency.
4. Reports/API/client: store retreat telemetry in existing JSON rounds (no schema migration),
   publish own retreat hulls and, per owner's later instruction, the enemy's total
   escaped count; do not expose other active enemy surviving force or
   owner research/wounds. Old reports default empty. Show retreat beside real losses;
   update six research descriptions and EN/TR Wiki, base shield facts and escape threshold.
5. Shared forecasts, neutral/pirate fights, academy/bots also call this engine and must
   compile and retain their context-specific loot/capture rules. No economy/season study.

## TDD and acceptance

Write failing policy/base-shield/4x, simultaneous fire, same-round cargo, two retreat
windows, no-heal, owner accounting and monument-control tests first. Then implement.
Cross-check actual engine against the independent approved simulator; test both orientations,
all four tier families, mixed research/wounds, empty/cargo sides and ground/Aegis.
Exercise solo/joint vs solo/supported planets, solo/joint vs solo/multiple monument holds,
return/idempotency and report/API contracts on an isolated `_test` Postgres database.
Run checks sequentially, one worker/CPU and hard memory ceilings (Node <=1536 MiB heap,
local checks <=2 GiB total; smaller test runner alongside bounded Postgres;
VPS tests/types bounded separately to 3 GiB, with one worker per isolated test database;
full web lint uses the standard 4 GiB Node heap inside a 4.5 GiB VPS-only hard limit). Never use live DB
for tests. Finish review, typecheck, lint, builds and visual report verification before
release. Prepare a reviewable commit; notify owner before production deployment.

## Review findings and evidence

- Physical survival alone was still used for collector capacity in four server paths
  and the pirate profit forecast. A retreated collector incorrectly recovered 273 alloy
  and 108 crystal in the seeded reproduction. The new regression failed before the fix;
  every settlement and joint salvage split now uses active collectors.
- A decisive pirate battle still drew captured ships from the entry crew. A controlled
  server settlement with no enemy deaths nevertheless awarded a Ballista. The regression
  failed, then passed after restricting the draw to actual deaths and requiring an active
  returning claimant. No escaped ship is duplicated as a reward.
- Monument capture and pirate overrun used an initial per-hull eligible count as a proxy
  for the identity of surviving ships. A healthy/wounded pair of the same hull could
  leave only a radiation-critical survivor and incorrectly capture. A real seeded battle
  reproduced ATTACKER instead of DEFENDER. The engine now returns the actual active
  combat-eligible survivors; both consumers use those identities. Firing eligibility
  remains frozen at battle entry; new battle damage does not retroactively remove shots.
- Mutual retreat at monuments left defender waves in HOLD despite EMPTY control.
  Reproduction failed on the wave status; settlement now returns both surviving sides.
- Pure forecasts now require an active attacker. Pirate cargo overrun preserves fled
  defenders and their exact damage. Solo server entrypoints retain real owner IDs, so
  private retreat reports cannot silently lose the caller's own count.
- The independent oracle initially caught a mismatch for radiation-critical defenders:
  retreat power must include the physical entry line, as approved. Eligibility is used
  for firing/capture separately. The corrected engine matches the independent study.
- Existing tests that assumed concentrated fire or certain annihilation were reviewed
  against the new physics. Persistence checks now conserve every ship and every wound;
  report tests use a three-shot/two-target fixture that deterministically destroys one
  ground gun and earns PARTIAL. No casualty requirement was removed from tests whose
  purpose is destruction, salvage, scoring or ownership.

Checks are recorded under ignored `out/`. The complete ordinary rules suite passed
156 files / 2,869 tests. The latest selected report/monument/solo-joint-supported
server regressions passed 6 files / 243 tests. Selected UI regressions passed
7 files / 275 tests; the later wiped-attacker explanation regression failed before
its six-language copy fix, then passed 18 report-case tests. The independent
production/model oracle passed all three sweeps, including mixed research, fractional
wounds, cargo, all mobile hulls, split waves and both battle contexts. Visual checks
passed TR/EN at 350/1280 px, with real hull, research and battle/monument components,
no page errors or overflow. The visual fixture's new monument wound needed its
required `remainderBp: 0`; the parser correctly rejected the incomplete fixture.

The first broad server pass exposed an obsolete collector fixture: 300 Darts firing
randomly into 60 Darts can leave no attacker wreck. Two defending Corsairs ensure
real single-shot attacker deaths; the assertions still require actual wreck and
salvage. A radar distance sweep also exceeded the 30-second default on the bounded
VPS; it is rerun with the same assertions and a 60-second runner timeout.
The first pass's 94 completed successful files were inventoried. Remaining files
(including both failures) were split between two independent `_test` databases on
the VPS, each with one Vitest worker and 2 GiB hard limit; simulation remained
single-threaded. The final per-file union covers all 372 ordinary server test files / 4,730 successful tests;
all initial failures have a successful rerun. Three existing skipped tests remain
skipped. Tool-dependent shell tests passed unchanged on the bounded host. All four workspace typechecks passed. Full web coverage is 592 successful files /
7,365 successful tests, with the pre-existing one file / 29 skipped tests retained.
Five tooling-dependent files initially failed only because the minimal Node container
had no Docker/Git/rsync; all five passed (29 tests) on the bounded host with those
prerequisites, without source or assertion changes. Rules, tools and simulation lint
passed. Full web lint exceeded its artificial 3 GiB container cap even when split;
the web and server VPS lint groups use 4.5 GiB hard memory, retaining root's
4 GiB Node heap.
Local checks stay at 2 GiB total (the visual browser/Vite pair peaked within 2.8 GiB),
and simulations remain single-threaded at <=2 GiB.

The bot judgement test's old four-Dart expectation also became stale: with the new
shield, two Darts suffice. The revised test passed all 20 judgement scenarios and
additionally resolves the proposed wing, proves cargo survives normal fire, and
checks the actual overrun result. The event-bus reconnect test had a cache-priming
heartbeat race under simultaneous VPS database load; unchanged assertions passed
all five scenarios against an isolated, bounded local database. No event-bus code
or heartbeat interval was changed. Two Honor fixtures also assumed deterministic
physical kills from the old targeting model. The joint debit fixture now guarantees
a real attacker loss with one Harpoon and still asserts the exact loss debit. The
season reward fixture uses equal full fleets with researched attack/armour and
retains the positive-score and idempotent reward checks. Both complete files passed
(seven tests each); a separate 1,024-seed check confirmed their required physical
loss conditions. All lint groups and all four workspace typechecks passed with zero errors,
including the final server recheck after these fixture updates. No deployment is
claimed by this record.

### Report review and later owner clarification

The owner explicitly requested disclosure of the enemy's total escaped count. New reports
publish `theirRetreatedCount` (also per round), never raw stack/player retreat telemetry.
Own `yourRetreated` remains a hull map. Legacy missing telemetry remains absent rather
than claiming zero recorded escapes. DECISIVE still means the defending force left the
battle through destruction or retreat. The casualty list is a complete defending roster
only when no defender retreated. The report's explanation, Aegis wording, random-shot
formula, partial threshold and active round counts must agree with these rules.

Owner-specific physical casualty rows were also needed: the old per-round report used
whole-side losses beside a personal starting roster in joint/supported battles. A failing
owner-conservation regression preceded the fix. New round JSON records `casualties` with
owner IDs; the API replaces only the reader's side's casualties with that reader's total
and strips both raw `casualties` and `retreats` from every public round.

Roll APIs before the worker: the old API spreads raw round JSON and therefore must never
serve a newly written private-owner telemetry row. Keep the new report projection during
any worker rollback. Historical worker output remains readable by the new API. A full
backend rollback needs a compatibility patch retaining the new projection; do not silently
route new reports through the previous unfiltered API. No migration or player-data rewrite
is needed for the ordinary API-first/worker-last roll.

### Release isolation and operational checks

The release is based on verified live `527e6ca853e34c9834db9c0c4e4eec6f548145dd`.
`origin/master` has unrelated, divergent work. The owner's explicit "only your own
changes" instruction takes precedence over the runbook's default master selection:
push and pin a dedicated release branch, verify that branch/full SHA against the
image, all four roles and public web. Do not force-push, merge unrelated work, or
reset the owner's original dirty workspace.

Preserve all four currently active Compose files (base, Arena pin, monument-shield
pin and escape/recovery pin); append a new image pin only for API1/API2/API3/worker.
Arena itself is unchanged. The existing live host-preflight script expects six
services and already fails on the seventh, deployed Arena service; record this
exact baseline mismatch and verify the seven known services explicitly. Its 6 GiB
available-memory gate must be checked again after disposable check containers stop.
Production data, seasons, flags, exemption accounts and database schema are unchanged.

Both candidate artifacts build successfully. A fresh private production dump was
restored into a separately named database in the disposable check Postgres, never
into production. Old and new actual server images each passed schema/no-pending-
migration checks, public and authenticated API reads, an authenticated notification
write, real combat/report persistence and cleanup with durable counts preserved.
The new image also proved that a retreated enemy is alive, counted in the public
retreat total, and absent from casualties and raw public ownership telemetry.
The rehearsal's SQL field name and unique-mission fixture errors were corrected in
the private probe only; no product schema or constraint was relaxed.

The live served entry proves Arena was compiled with `VITE_ARENA=1`, despite that
key being absent from production `.env`; keep that existing build flag and analytics
ID. Atomic directory exchange was rehearsed with two disposable directories on
`/var/www`'s actual filesystem before using it for web publication. APIs/worker,
Nginx and live web remain untouched at preparation time.
