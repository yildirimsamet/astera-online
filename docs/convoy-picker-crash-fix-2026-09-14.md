# Convoy picker crash fix — 2026-09-14

Reported on iPhone Safari: choose ships for a convoy strike, press Max, then reduce
the selected count. Removing the last Dart while another armed hull remained left
`DART: 0` in the fleet. The convoy reward quote requires strictly positive entries
and threw during render, taking down the game screen.

The picker now omits a hull at zero. Positive counts still clamp to home inventory;
editing the wing still clears confirmation. Reward rules and server validation do
not change. No DDL, API contract change, data repair or season operation is needed;
deploy through the rolling path in [deployment.md](deployment.md).

Five sheet tests cover Max followed by minus (including zero in a mixed wing),
direct zero/empty input, re-selection, empty and transport-only refusals,
confirmation invalidation and the exact committed fleet. Three tests reproduced
the reported RangeError before the fix; all five passed afterward.

The full web suite completed with 2,823 passes, two skips and two existing failures
(`gains.test.ts`, Refinery L9 formatting; `surface-vocabulary.test.ts`, recessed
card styling). Both failing cases were separately reproduced with identical
assertions on clean baseline `d8d9d113471e27a528d1bd783b4d9b0f5e395918`.
The scratch phone visual harness and real-HTTP loop passed. A 402×714 Chromium
run also committed a real convoy launch containing only the remaining Pikes after
Max, minus to zero, re-selection and clearing the Dart input, with no runtime errors.

Baseline rules have 26 existing failures (1,157 passes), and the simulator has 11
existing failures (104 passes, 11 skips). Release acceptance requires matching
these failures and completing build, backup restore and production identity/health
checks from the deployment runbook; this note alone is not a deploy claim.
