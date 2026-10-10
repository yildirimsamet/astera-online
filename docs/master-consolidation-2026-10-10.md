# Master consolidation — 10 October 2026

Owner request: collect the current work from every active worktree and the main
working directory on `master`, except `komutan-gemisi` and `ui-v2`. Commit and push
the result without deploying or changing production gameplay data.

## Scope and preservation

- `astera-asteroid-fix-20261009`: generation snapshot migration 0146, bounded
  population history, protected calendar adoption/restamping, v11 showers,
  regression tests, incident reports and local operator rehearsal evidence.
- `astera-store-review-20261009`: store/inventory navigation, purchase feedback,
  menu showcase, UFO beam and product image, regression tests and visual tools.
- `astera-polar-wave2-20261010`: already committed on master through `19c46ef`;
  preserve its 16 new paid products, client compatibility, payment/refund tests,
  three approved ring simplifications and deployment procedure.
- Main working directory: colony abandonment, monument fleet recall, temporary
  session failure recovery and chat recognition explanations, including their
  tests, translations, documentation and visual verification tools.

The asteroid/store worktrees are detached snapshots with uncommitted changes.
Their source changes were already copied into the main working directory. Compare
files and patches rather than merging their old HEADs and calling that complete.
Where files also contain newer work, retain both changes, especially translations,
the API client, gallery routing and the deployment runbook. Import missing manual
asteroid evidence; preserve the partial/stopped test outcome as historical evidence.

Back up modified and untracked files before consolidation. Record the excluded
worktrees' HEADs, diffs and untracked file hashes and require them to remain
identical. Do not copy generated `node_modules` symlinks or ignored credentials,
captures and build output. Leave the original worktrees available.

The dated, single-fixture operator rehearsal script is preserved byte-for-byte
as `docs/evidence/asteroid-operator-rehearsal-2026-10-10.mjs.txt`, alongside its
captured local database results. It is historical evidence rather than a new
application entry point; its imports and future-date assumptions describe the
original rehearsal environment.

## Qualification

Run typecheck sequentially, root lint, then ordinary tests with one workspace and
one Vitest worker at low priority. Use a new localhost database ending in `_test`.
Do not run economy simulations or snowball audits. Check the combined store and
ring rendering using the existing visual runner after tests.

The corrected CI pipeline exposed a test failure, but its 80-line diagnostic was
truncated by GitHub before the final error. A reproduction first failed because
the annotation exceeded 4096 bytes. Strip ANSI colors and keep the final 3000
UTF-8 bytes before escaping the annotation; the same check then passed, including
multibyte text and a missing log. The test command retains explicit Bash pipefail.
This diagnostic improvement does not change or waive test results.

Verification results and the final source comparison are recorded below after
the checks complete. Production migration, calendar adoption, application deploy
and live charges remain outside this consolidation.
