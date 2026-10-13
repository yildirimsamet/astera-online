# Isolated renderer optimization — 13 October 2026

Base: production web `1b176fed5d5ba95ecf76c1d1dd9180072b4e5c51`.
Branch: `perf/galaxy-render-isolation`. Do not merge pending master changes into this release.

Order: postprocessing isolation, planet/shield compaction, formation visibility.
Keep art, quality, LOD thresholds, clocks, picking and gameplay unchanged.

Before implementation, regression requirements:
- Postprocessing retains children/pass identity through unrelated parent renders and
  preparation changes; quality/context changes rebuild targets; context loss unmounts.
  Preserve bloom finite guard, HDR, MSAA and startup render priority.
- Planet/shield compaction handles empty/all/partial visibility, frustum boundaries,
  moving camera/projection/data, correct colour/phase and pick identity. Preserve
  capacity, animation phase and separate body/shield/atmosphere bounds.
- Formation culling must retain visible trails, engines and markers, update movement
  before visibility before buffer writes, and refresh before reappearance. Combat
  effects and interaction targets must remain independent. Uncertain cosmetic bounds
  must conservatively remain visible rather than lose an effect.
- Resource ownership fixes and LOD/quality changes are outside this optimization scope.

TDD and sequential checks: one Vitest worker, nice 10, max Node heap 4096 MiB.
Device FPS improvements require comparable device recordings; unit tests do not prove them.

Implementation:
- `GalaxyPostprocessing`: memoized boundary and stable effect children, including
  the prepared/enabled transition. Existing HDR, MSAA, bloom, vignette and context
  recovery remain intact.
- `instanceVisibility`: allocation-free compact membership, invalidated by camera,
  projection, subject identity and parent transform. Standard planet bodies and
  shields submit visible members only. Planet pick spheres keep their full original
  order; shield colour/opacity/breath/phase follow compact slots. Static views do not
  rewrite shield buffers. No changes to atmosphere or LOD thresholds.
- `formationVisibility`: conservative separate bounds for hull parts plus outline,
  native engine billboards and wakes. Offscreen work returns before buffer writes.
  Motion, aiming, markers, picking, cosmetics and combat continue. Custom wake
  offsets with no declared maximum keep their existing draw/update behaviour.
- `GalaxyVisualPhase`: these buffers update after default-priority motion/camera
  callbacks and before the existing priority-1 render. Other canvases retain the
  default priority and automatic rendering.

Controlled visual comparison (SwiftShader, 600 x 600, fixed clock):
204 standard planets, 180 shields, 48 fleet contacts using real production components
and assets, with the full planet tier fixed for the comparison. This is a component
fixture, not the complete GalaxyCanvas/LOD flow or a replay of the Samsung recording.

| View | Calls before → after | Triangles before → after | Changed pixels |
| --- | --- | --- | --- |
| Near | 431 → 191 | 1,825,205 → 189,195 | 0 |
| Edge | 431 → 193 | 1,825,205 → 189,291 | 0 |
| Wide | 591 → 591 | 1,825,525 → 1,825,525 | 0 |
| Reverse | 431 → 207 | 1,825,205 → 189,963 | 0 |
| Empty | 399 → 109 | 1,825,141 → 13 | 0 |
| Return | 431 → 191 | 1,825,205 → 189,195 | 0 |

The unchanged wide view is intentional: visible detail is preserved. This does not
establish an FPS, thermal or battery improvement on S22. The remaining empty-view
calls include unchanged marker/point draws and postprocessing, which this change
does not disable. Planet and fleet instances in the fixture keep the same quality.

Evidence: `out/render-performance/results.json`, before/after PNGs, and
`out/render-performance/compare.mjs` in the isolated worktree. Temporary baseline
components were copied from the production SHA above and removed after comparison.
The comparison script regenerates/removes those temporary files. To repeat, serve
this worktree with Vite on port 5188, then run the script from the repository root.
`node tools/visual.mjs out/render-performance/engines --engine-attachments` also
verified DART, PIKE and CITADEL from rear/top/side. DART's 12 motion captures were
all distinct; no browser errors occurred.

Deployment handoff:
Build/publish the reviewed commit from this branch, never the dirty master tree.
The default `deploy/deploy.sh` fetches/resets to origin/master and is therefore NOT
an appropriate entry point for this isolated release. No deployment has been made.
After publishing the pinned web artifact, repeat the same S22 camera route with the
same quality preset, separate cold/warm runs, and compare frame-time percentiles,
hitches, long tasks, draw counts and a sustained thermal run. Revert this branch's
performance commit if visual or interaction differences appear.

CR verification:
- Confirmed and fixed one regression before release: shared formation components
  could cull against the previous parent position in automatic-render preview
  canvases, where child and parent callbacks both have priority 0. A real browser
  single-frame reproduction returned `parentX: 0, enginesVisible: false`. After
  restricting formation culling to `GalaxyVisualPhase`, the same browser returned
  `parentX: 0, enginesVisible: true`. The regression test fails before the fix and
  passes after it. Preview callbacks retain priority 0; no manual render takeover.
- Added live-component tests for full/far planet compaction, original pick identity,
  raycast bounds after replacement data, unchanged far-tier uploads and current-time
  re-entry. All passed; no planet bug was demonstrated by these checks.
- Repeated the six-view comparison after the fix: the table above and zero changed
  pixels still hold. The harness now loads a single static entry and asserts the
  presence of priority-0.5 callbacks. This avoids a Vite HMR diagnostic artifact:
  separately importing the provider with a stale URL could create a second context
  and inadvertently measure the non-culling preview path.
- Reviewed camera/ViewOffset priority, shader maximum displacement, hull part
  transforms, independent markers/combat, cached resource ownership, startup and
  composer recovery. No other regression was confirmed. This is not a guarantee
  against device-specific rendering faults or a substitute for S22 profiling.

Verification completed before final build:
- Workspace typecheck passed; all three sequential lint groups passed before CR.
- Web full run: 6,046 passed, 29 skipped, one stale source-location assertion failed.
  That assertion was corrected for the extracted Bloom component and passed on
  rerun. Subsequent focused CR tests passed, including the new preview regression.
- Server ordinary suite: 231 files, 3,337 passed, one skipped. Used isolated database
  `astera_render_perf_20261013_test`, not the shared development/test database.
- Rules ordinary suite: 116 files, 2,082 passed. No long simulations or snowball audit.

Final checks after CR fix:
- Web typecheck: passed.
- Web lint group: passed; other lint groups remained unchanged and had passed.
- All 15 affected regression files: 122 tests passed.
- Production web build: passed. Vite reports its existing large-chunk warning;
  bundle splitting was not part of this render change.
- The isolated server test database was removed after the successful run.
- Full-suite logs, final regression/build logs and visual evidence are retained in
  `out/render-performance/` in this worktree. No production deployment performed.

## Covered opening preparation (2026-10-13)

The phone recording `66994b88-5318-4b84-b3dd-32bf2eefaefa` reports a 401.7 ms
stall at second 4 and a maximum render submission duration of 388.1 ms. This is
consistent with first-use resource work, but does not identify shader compilation,
texture upload, driver work or JS allocation as the root cause.

The gameplay cover now permits one hidden camera preparation sequence after the
existing shader/data gates: whole-disc view, intermediate view, then the intended
opening view. These are actual frames through the same LOD, culling and composer
paths, using the same resolution and quality. No separate renderer, permanent
maximum-detail scene or visible camera tour is created. Academy home framing lands
at the existing HOME_DISTANCE under the cover; explicit wide/tutorial framing is
preserved. Canvases without a cover opt out.

`openingViewSequence.ts` requires two rendered frames and a 150 ms quiet interval
per stage, using render/resource counters and pending React LOD transitions. Each
stage has a 1200 ms soft deadline evaluated on rendered frames. This is bounded
best-effort preparation, not a GPU fence or proof that every lazy asset has loaded.
Normal asynchronous loading continues after a deadline. A blocked main thread can
exceed these soft deadlines. Existing cover deadlines remain in force.

The rig pauses during preparation. Cover expiry, context loss and unmount restore
the intended opening camera and controls; context recovery does not repeat the
tour. Finishing the sequence releases camera ownership, so later user movements
are not reset by cleanup. The ready callback waits for the home stage to draw.

Expected tradeoff: some first-use work moves into loading, which may take longer
and briefly allocate resources used by the overview. Sustained FPS improvement is
not promised. Resources disposed on a later LOD change may still need preparation
again, and later arrivals/assets cannot be covered by a startup-only sequence.
Acceptance on the S22 requires cold and warm launches of both builds with matching
quality, camera gestures and scene: compare time to interactive, first zoom-out
stall, subsequent zooms, heap and a longer thermal run. Browser software rendering
is a correctness check, not a mobile performance measurement.

Validation: the full web run passed 6058 tests with 29 skipped; its only failure
was the old literal JSX assertion for the nested planet fallback. The assertion
was updated to retain the nested-boundary check alongside the pending-work marker.
The subsequent 9-file focused run passed all 52 tests, including the updated
assertion and new camera/ready-gate cases. A Chromium/SwiftShader fixture rendered
204 real `PlanetField` worlds with the production composer, observed distances
180 → 35 → 7, released the cover only at home, and reported no page errors.
`tools/visual.mjs --loading` also passed seven viewport sizes and its existing
6× CPU loading-animation check. Artifacts are in ignored `out/render-performance/`.
