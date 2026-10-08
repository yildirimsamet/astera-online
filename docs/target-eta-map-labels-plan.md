# Target estimates and galaxy names — 2026-10-08

Owner requested (1) best-case target ETA using the fastest available combat hull
for attack targets, excluding transports; non-combat destinations include cargo
hulls, and (2) readable nearby planet names with the known commander's country flag.

- Estimates use ships standing at the active origin, with its Beacon, propulsion
  and pace. No ships away, ground guns, zero counts or mining craft. An attack
  estimate without a combat ship is absent; an unarmed hauler cannot promise a raid.
- Planet dossier is combat; another owned world is transport. Merchant currently
  selects the fastest valid carrier and convoy currently considers armed hulls;
  preserve those moving-target solvers. Pirate summary excludes cargo/unarmed
  hulls but keeps their reach-table rows for an actual selected mixed fleet.
- Exact launch timing continues to use the slowest selected ship. No ship speed,
  combat outcome, travel formula or server launch behavior is changed.
- Nearby names appear automatically within 70 scene units, only for RESOLVED or
  REMEMBERED worlds. Selection of an UNKNOWN world still says unsurveyed. Preserve
  selected/owned/clan/rival/clock priority, record ages and private fault marks.
- Fixed readable type, bounded label pool and screen-space collision avoidance;
  camera projection at 10 Hz, React updates only when label membership changes.
  Ordinary nearby labels are compact: planet name, commander and flag.
- Owner's visual refinements: map text uses the existing 9–10 px ui-v2 tokens;
  flags are half size (10 × 6 px). Short names use compact boxes rather than a
  fixed wide reservation. Remembered records have enough room for their age.
- Country follows the same earned owner identity: existing bulk public-world join,
  optional silhouette snapshot, optional client/schema/node field. UNKNOWN omits
  country; remembered owner and flag freeze together. No invented country for
  neutral worlds or old records. No per-planet country requests or new dependency.
- TDD for these new tasks: focused failing ETA, visibility/collision, country and
  API tests, then implementation, then the same tests and nearby regressions.
  Run checks sequentially with one worker and two CPU cores; never the full suite.
- Risks: combat/transport caller mixups, cargo-only pirate summaries, changing
  selected-fleet timings, hidden identity leaks, swapped owners on stale records,
  unreadable/colliding names and needless HTML/frame updates on mobile.

Validation: 70 focused web tests and 31 server tests passed, as did web/server
type checks and scoped ESLint. Server checks ran against their own temporary
`astera_target_map_20261008_test` database after another local test process was
observed truncating the shared test database. One worker/two CPU cores; no full
suite, economy simulation or snowball audit. Real renderer visual checks use
`node tools/visual.mjs out/target-map --target-map` with an independent dev port
and no API/database. They cover untapped known names, loaded 10 × 6 flags, dated
memories, hidden unknown identities, zoom, viewport bounds and collisions.
