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
- Nearby names appear automatically within 80 scene units, only for RESOLVED or
  REMEMBERED worlds. Selection of an UNKNOWN world still says unsurveyed. Preserve
  selected/owned/clan/rival/clock priority, record ages and private fault marks.
- Fixed pixel type, bounded label pool and screen-space collision avoidance;
  camera projection at 10 Hz, React updates only when label membership changes.
  Actual content dimensions are cached on commit/resize, outside the frame loop.
  Ordinary nearby labels are compact: planet name, commander and flag.
- Owner's visual refinements: map text derives 8.1–9 px from the ui-v2 tokens;
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

Follow-up, 2026-10-08: reduce map text by another 10%, keep flag size, extend
name range from 70 to 80, and fix premature disappearance shown in the owner's
two screenshots. The estimated 180 × 56 detailed box reserves more space than
the actual text. Use natural content width and cache measured label dimensions
on DOM commit/resize, outside the frame loop; retain a small gap and actual
collision suppression. Keep fog, priority, pool cap, record age and ray picking.
TDD: newly visible range, vertically separated real-size labels and actual
overlap cases first; then focused label tests and browser zoom reproduction.
No server/database checks, broad suites, economy simulations or snowball audit.

Follow-up validation: 19 focused label/identity/fault tests passed initially;
after concurrent planet-occlusion changes, all 26 focused tests passed together.
Web typecheck and scoped ESLint passed. The real renderer passed on mobile and desktop in an
independent preview with HMR/watch disabled and a separate Vite cache. It confirmed
8.1–9 px text, unchanged 10 × 6 px flags, background names with a small visible gap,
suppression on actual overlap, names at range 78, and none at overview range 95.
Fog, remembered ages, viewport bounds and the 32-label cap also passed. Artifacts:
`out/target-map-refined/observations.json` and the matching screenshots.
