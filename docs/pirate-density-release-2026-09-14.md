# Pirate density qualification — 2026-09-14

Owner request: increase pirate spawning by 50%, deploy only this task's changes,
preserve unrelated local work. Qualified on clean, isolated worktrees based on the
deployed `0c01c65147e0bc00f4815636b974c98f8912f841`.

## Change and compatibility review

- Candidate rate: 0.02 → 0.03 per configured seat/hour; 6 → 9/hour at 300 seats.
- Established targets retain their complete specs, continuous indices and opaque
  handles. The increase is an independent appended HMAC-labelled lane.
- Four full-season seeds retain their baseline prefix hashes and admit
  1.494–1.505× as many targets. Individual rewards, combat and speeds do not change.
- Proportional pirate allowance: 6.5% → 9.75%, isolated per lane. Mining is unchanged.
- No DDL, route removal, response-shape change, repair or season operation.
- Two-phase rolling activation is mandatory for this upgrade. First hide additional
  contacts everywhere; enable only after all three APIs and the worker understand
  the complete field. A staged process can accept and settle an enabled replica's
  additional handle; the integration test proves this. See `deployment.md`, D211.

## Qualification evidence

| Check | Baseline | Candidate |
| --- | --- | --- |
| Full rules tests | 1,179: 1,153 pass / 26 fail | 1,181: 1,155 pass / 26 fail |
| Contract tests | 80: 79 pass / 1 fail | 80: 79 pass / 1 fail |
| Pirate field/fog/raid/traffic/reports/concurrency | — | 135/135 pass |
| Extra-handle staged launch and settlement | — | pass (27/27 raid tests) |
| Root build (lint, typecheck, client artifact) | — | pass |
| Root verify | existing rules failures | typecheck/lint pass; same 26 rules failures |
| Scratch real-HTTP loop | — | all green |
| Scratch phone visual harness | — | positive checks pass; no runtime errors |
| Scratch two-commander movement harness | — | all green; no runtime errors |

The failing rules set has identical names and assertion messages before/after;
only temporary worktree paths and stack locations are excluded from comparison.
The contract failure is the existing clan-journey assertion, identical before/after.
`verify` stops at rules, so this is not a claim that every workspace suite is green.
Earlier parallel browser attempts were interrupted during local memory contention;
qualification uses the completed sequential reruns. The visual/HTTP asteroid-specific
checks skip an empty field window; orbit, interception and sight rules are separately tested.

The original actual-price pirate supply-cap regression remains visible against the
unchanged established fixture and its original allowance: day-0 alloy is 64,113
against 53,661.57526282222. This standing D208 admission/current-hull-price mismatch
is not fixed or hidden by widening a tolerance. A new full-field test checks the
generator's frozen-price admission liability against the proportional budget for
every day of three full-season seeds. It does not claim actual captured-hull prices
obey the old cap.

Before release, production backup restore matched accounts/seasons/players/missions/
migrations at 856/22/190/1,100/78. Both live seasons' old private fields were hashed
without printing their keys for a pre-activation comparison against the new image.
Production rollback image, webroot, vhost and checksum-verified dump are retained.
Actual deployment completion still requires all runbook health, identity and public
acceptance checks; this qualification record alone is not a deploy claim.
