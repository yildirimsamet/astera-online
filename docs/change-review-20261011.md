# CR — changes from this session, 2026-10-11

Owner asks to review all task changes and verify/confirm each finding before fixing.
Scope: placement telemetry/pool configuration, event drain loop, telescope batching,
admin authority/provisioning/resources/moderation/clan access, special ship craft
explanations and fullscreen/store controls. Preserve the concurrently edited battle
report files; review only our relevant changes in shared files.

Review method: trace untrusted boundaries, server authority, transaction/lock order,
expiry and timestamp races, row ownership, projection/cache isolation, query counts,
indexes, UI states/locales and browser events. Each actual fix needs a reproducing
FAIL followed by PASS, then the full ordinary sequential quality gate.

## Verified findings

- Mute expiry can be evaluated using a Date captured before a database advisory
  lock wait. A request blocked past the expiry can be rejected after the mute has
  ended. Reproduced in all three production send routes with controlled time and
  real locks: each returned 403 at expiry instead of 200.
- Mute duration is likewise calculated from the request's pre-lock Date. A delayed
  admin mutation could save a restriction shorter than the selected duration.
  Reproduced after ten minutes of lock waiting: the 5-minute mute expired at 00:05
  instead of 00:15. Four RED regressions are in `admin-operations.test.ts`.
  Both services now accept the injectable Clock and read it after acquiring their
  moderation lock. The production clan path passes the live clock too; its other
  timestamp rules are unchanged. Targeted GREEN validation: all 74 admin/clan/chat/
  DM regressions pass, including the four new real-lock timing tests.

## Checks already completed

- Admin HTTP authorization rejects non-admin/forged display-name/client flags.
  Bounded read-only lazy economy, account-scoped mutes and exact mask scope;
  original text stays in operator audit only. Constant SQL count and activity indexes.
- Ordinary chat/clan/DM/galaxy/join regressions: 203 targeted tests passed.
- Mobile/desktop admin UI and special craft sheets pass browser verification.
- Fullscreen first tests failed (control absent), then 159 fullscreen/install/locale/
  HUD tests passed. Native state comes from browser events, whole-document target,
  no stale installed flag, no autoplay entry, timeout/cleanup and prefix coverage.

All four workspace typechecks pass. Root lint first found ten style/type/lint
issues in this session's code/tests/fixtures; each was inspected and corrected.
Root lint now passes with zero errors or warnings. Full ordinary suite is running.
Post-lint type recheck: rules/server pass; concurrent new visual work reports
`src/ui/PlanetHero.tsx:112`, optional `undefined` skin passed to a nullable-only
prop. This file is not part of our tasks and is left to that task's owner. The
original complete four-workspace typecheck passed before these external edits.

## Additional verified findings

- Fullscreen help was nested in the isolated masthead. Confirmed by RED DOM test
  and real Chromium at 350px: the visible-sized
  dialog was under the game panel (`elementFromPoint`, topmost=false). Render help
  into the existing body portal layer. Whole-document fullscreen includes it.
  Preserve close, failure/retry and fallback copy; no shared Sheet behavior change.
  A second real-browser assertion caught the missing desktop top inset outside the
  shell: the card sat at the bottom rather than centred. The help portal defines
  zero top/dock insets for its own whole-viewport card; no game-shell CSS change.
  GREEN: 12 real Chromium scenarios pass at 350px/1280px in all six languages;
  native/external exit, sibling panels, guide stacking, centring, overflow and touch
  size measured. Screenshots reviewed in `out/fullscreen`.
- Clan sends select their reply preview before acquiring the room's masking lock.
  Confirmed with two RED regressions (ordinary and admin posting): the response
  included `Moderated original` after the mask writer committed `**`. The room
  lock and moderation gate now precede reply selection. Stored reply ownership and
  membership filters are unchanged. GREEN: 53 admin/clan regressions pass,
  including both concurrent reply cases and the cross-galaxy admin send/read test.
- Missing moderation-target error copy: `ACCOUNT_NOT_FOUND` is absent from the
  locale catalogue, so admin username mistakes show a generic failure. Confirmed
  by six RED `describeError` tests, one per locale. Add the precise corrective text
  to all six catalogues; no error-handler behavior or raw-diagnostic fallback change.
  GREEN: all 69 fullscreen/admin/error-copy/harness UI tests pass.

## Remaining validation

Recheck types after lint fixes, then all ordinary rules/server/web tests, sequentially at low
priority with one Vitest worker. Long simulations/audits are not authorized.
The owner staged this session's work and started another master task: preserve the
index and unrelated work. Do not restage or unstage review fixes on the owner's behalf.
