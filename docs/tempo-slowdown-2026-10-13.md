# Owner tempo change — 2026-10-13

Work directly on master; preserve the existing uncommitted work.

## Requirements and affected paths

- All mobile fleet hulls, including cargo, escorts, collectors and special combat hulls:
  80% of their previous default speed. Ground emplacements remain stationary.
  `economy-profile.ts` owns this shared speed scale; trade and pirate anchors follow it,
  preserving their existing speed ratios and interception guarantees.
- Probe: 3510 → 2632.5. Prospector: 1237.5 → 990, laden return 618.75 → 495.
  Death Star: 1250 → 1000. These independent craft read `constants.ts`.
- Alloy, Crystal and Deuterium hourly output: 80% of the previous output at every level,
  including the opening taper, late-level lift and satellite multipliers.
  Prices, curve shapes and resource packets stay at their existing values.
- All work runs at 80% of its previous rate: durations are divided by 0.8 (×1.25),
  including buildings, instruments, satellites, research, hulls, ground defence, repairs,
  Death Stars, interception charges and colony repair crews. The shared timer dial and its cap move together;
  colony crews' independent 5–15 minute range becomes 6.25–18.75 minutes.
  Stored flight and work deadlines retain their committed timestamps.
- Beacon: speed multiplier 1.3 → 1.2. Update its descriptions in all six languages;
  existing shared quote functions supply the new UI numbers and countdowns.

## Critical issue and owner decision

Production rates also size storage and Works. Directly reducing output shrinks a full
Refinery-6 Works from 8987 to 7189 Alloy; the next production tick discards the excess.
The owner selected the recommended solution: **preserve storage and Works capacities;
reduce hourly production only**. Compensate their production-hour multipliers by ×1.25.
The same-level purchase guarantee recalculates its hours from the reduced output.

Active-season decisions confirmed by the owner: NPC pirates and merchants also slow
by 20%. Their pre-cutover contacts are retired only after every outbound/returning
pirate raid and merchant convoy has finished. Historical rows are retained. NPCs
appearing after the cutover use the slower orbit; current merchant windows disappear
until the next scheduled window. Asteroids and the fixed linear Intergalactic Convoy
calendar keep their existing geometry and deadlines.

Migration `0156_tempo_slowdown` adds `seasons.tempo_starts_at`. New seasons start with
the new tempo. Existing seasons require `activate-tempo-slowdown --shard CODE --yes`
during the coordinated deployment. The season-wide exclusive lock serializes this
command with dispatch. `BUSY` is read-only; repeated activation keeps the first epoch.
There is no global ruleset bump, which would activate unrelated features.

The lazy economy splits at that epoch, preserving old production, outages, recovery
boosts, leak budgets and productive-time telemetry before applying the reduced rate.
Owner and probe reads use the same boundary. The CLI does not retime paid queue orders
or existing player flight deadlines. See `docs/deployment.md` for release sequencing.

## Code review findings

- Fixed an omitted queue: independent colony repair crews now take ×1.25 time too.
- Full server regressions exposed an owner-confirmed balance side effect:
  preserving Store capacity retains its `/48h` leak while production falls 20%.
  A Core/Refinery/Store 6 colony with 50,000 Alloy loses about 1,923 over ten hours;
  its old production covered the leak. Owner choice: scale post-cutover leakage
  by the same 20%, preserving the old production/leak ratio and pre-cutover accounting.
  The full-store drain clock becomes 48 → 60 hours; the income cap remains 2×
  production and the total budget remains one full Store. Regression coverage
  checks producer levels 0–100 and each resource on both sides of the cutover.
- The repair sheet had a hardcoded 5–15 minute range in all six languages despite
  passing the shared limits. Add a rendered UI regression for every language before
  replacing the literals with the supplied, localized limits (6.25–18.75 minutes).
- Fixed productive-time telemetry crossing the epoch: convert each interval using
  its own rate instead of over-crediting past production at today's lower rate.
- Retired merchants must be hidden from both publication and dispatch, and from
  delayed lifecycle notifications and new-player notification backfills.
  Activation also refreshes the public-event query; the fleet/economy event alone
  does not invalidate that client cache.
- The new strategic build durations contain fractional seconds, while the stored
  `remaining_seconds` column is integer. Regression tests reproduce the resulting
  PostgreSQL `22P02`/HTTP 500. Owner-approved fix: round up once to whole seconds
  at queue creation, then use that same value for the deadline and remaining work.
  Death Star: 4387.5 → 4388 seconds; interceptor: 2193.75 → 2194 seconds.
- Preserve the season row SHARE/UPDATE lock order during activation and dispatch;
  repeated adoption never moves the epoch or writes while NPC contracts exist.

## Regression coverage

Test before implementation: every mobile profile and independent craft, stationary guns,
all producer levels 0–100, unchanged pre-change capacity samples (mixed levels, no plant,
late curve and Foundry), accumulated stock, all work quote families including caps,
research discounts, repair damage, Beacon copy, merchant/pirate/asteroid interception,
and colony claim deadlines. Run ordinary rules, server and client suites sequentially
with one worker and `nice -n 10`; no long simulations. Typecheck and lint under a 4 GiB
Node heap limit. Review the diff against the pre-task snapshot.

## Verification record

- Ordinary rules: 2,153 cases verified. The final full run passed 2,152 and
  caught one invalid Vault-level test fixture; correcting that fixture made all
  26 slowdown regressions pass (`out/tempo-rules-final.log`, `out/tempo-leak-green.log`).
- Ordinary server: every one of the 236 test files verified, 3,465 cases passed
  and one existing skip. The broad run was interrupted after 233 files; the
  remaining three and both reviewed failures were rerun with all affected fault,
  economy and adoption suites: 11 files / 216 cases passed. Evidence:
  `out/tempo-server-disk.log`, `out/tempo-server-final.log`.
- The ordinary web suite was reviewed; the old Store-hours expectations were
  updated without changing capacity. Final affected UI run: 5 files / 134 cases
  passed, including the repair range in all six languages (`out/tempo-web-final.log`).
- All four workspace typechecks passed after the final logic changes
  (`out/tempo-typecheck-final.log`). All three sequential lint groups passed
  (`out/tempo-lint-server-rules.log`, `out/tempo-lint-web.log`,
  `out/tempo-lint-tools-sim.log`). `git diff --check` is clean.
- Visual verification: `node tools/visual.mjs ... --special-ships` passed eight
  mobile/desktop craft sheets. A temporary isolated fixture rendered the actual
  repair sheet at 350/1280 px in all six languages: twelve checks passed, with no
  overflow or browser errors. Turkish mobile screenshots were inspected;
  artifacts remain in `out/tempo-special-visual` and `out/tempo-repair-visual`.
- No long economy or season simulations were run. Production was not deployed
  or activated; the coordinated release procedure remains in `docs/deployment.md`.
