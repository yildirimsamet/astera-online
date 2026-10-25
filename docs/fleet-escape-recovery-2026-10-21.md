# Fleet escape and recovery window — 2026-10-21

Owner request: lower fleet escape from 3.5× to 3×; extend the standard recovery shield from 8 to 12 hours; review the entire affected path.

## Scope and impact

- Escape uses inclusive armed resource value, not ship count or attack damage. Preserve five-warship minimum, standing DECISIVE requirement, fuel check, active ground defence, ruleset gate, ESCAPE posture and support exclusions. Monuments do not use tactical escape.
- Standard and low-tier recovery now both last 12 hours. Keep their distinct loss thresholds (4 / 2 hours) and history windows (6 / 8 hours), newcomer 24 hours and first-game 72 hours.
- The struck-world +50% production boost ends with its actual shield deadline, including early forfeit. Its multiplier, collector capacity and other worlds do not change.
- New grants/renewals use 12 hours. Persisted deadlines and historical report profiles remain unchanged; no data migration. Renewal takes the later deadline and never adds windows or shortens existing protection.
- Shared constants drive rules, solo/joint planet raids, server grant/attack-protection paths, UI readouts and Wiki facts. Review fixed text and test fixtures for stale 3.5× / 8-hour claims without changing unrelated storage protection, monument rotation or recovery history.

## Verification plan

Owner memory constraint: tests use a 2 GiB Node heap, one worker, sequential workspaces, nice 10.

Tests first: exact 3× and just below, old 3.5× still qualifies, actual escaped fleet and fuel, 1:2 unchanged, supported/HOLD/nondecisive lines stay; fresh 12-hour grant, renewal/max, exact expiration, stored legacy deadline preservation, boost boundary. Then related rules/API/UI tests, sequential typechecks/lint, mobile and desktop visual checks, and final diff/caller review.

## Results

- TDD RED: old values failed 29 rules, 15 API and 10 UI expectations before implementation.
- Rules: 143 files / 2,763 tests PASS. Related API regressions: 9 files / 222 tests PASS. Exact candidate planet/report contracts: 3 PASS. UI/Wiki/i18n: 302 PASS; the escape test now checks localized 3.0 / 3,0 rather than confusing integer formatting with a rule error.
- Reviewed solo and joint settlements, support/HOLD exclusions, five-warship floor, disabled guns, maintenance eligibility, unchanged fuel charges, replay/concurrent deliveries, low-tier loss/history windows, bots, forfeit, world-scoped production boost, vacation and stored report/deadline compatibility.
- Confirmed stale findings fixed: six locale recovery notes said eight hours; related docs/comments and threshold fixtures still described 3.5× / eight hours. Two old design paragraphs incorrectly claimed Death Star impacts automatically grant recovery; current code grants on solo/joint raid losses, while protection also blocks new Death Star and planet-targeted Radiation Bomb launches. Documentation corrected without changing strategic gameplay.
- AST comparison against the deployed baseline proves runtime TypeScript changes are exactly `ESCAPE.ratio: 3.5 → 3` and `ABUSE.recoveryShieldHours: 8 → 12`; other service edits are comments only. No schema, dependency, season, feature flag or damage model change.
- The initial broad API run exhausted a 384 MiB tmpfs test database. Replaced only that disposable fixture with a disk-backed 512 MiB database; all tests subsequently passed. Node test heaps remained 2 GiB, one worker. The disposable database uses fsync off for ordinary fixture speed; actual-image restore rehearsal uses the normal production database durability settings.
- All-workspace typechecks PASS: rules/server/sim locally, full web project in an isolated VPS container (3 GiB hard limit, 2.5 GiB heap, one CPU). The local full-web check exhausted its 2 GiB heap; no compiler errors were reported.
- Visual harness PASS: desktop EN, 350px EN/TR, shared Wiki sheet/navigation. Additional mobile/desktop checks confirm both recovery rows say 12 hours and tactical retreat says 3×, with no page overflow. Mobile tables retain their existing horizontal scrolling.
- Full server/rules lint PASS. Full web lint found one redundant optional chain in the new Wiki row assertion; corrected it, reran the 15 Wiki tests PASS and the focused lint PASS. All other web files passed that full lint run. Tools/simulator lint remains the last static group.
- Production web build and fresh old/new-image restore rehearsal PASS for the first candidate. This follow-up changes only that test assertion and this record; final artifacts are rebuilt from its pinned SHA before release.
- Remaining release gates: final tools/simulator lint, rebuilt artifacts/restore proof, all-role health and external acceptance. Runtime deployment evidence goes in ignored `out/escape-recovery-release-20261021/` and the private timestamped VPS backup directory.
- Scope isolation: release starts at deployed `d3595171` and includes only the 22 selected files plus this note. Concurrent engine-flame work and `tools/visual.mjs` edits are excluded. Preserve the already-deployed Arena code/UI and its running service/image.
