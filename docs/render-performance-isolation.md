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

`openingViewSequence.ts` now waits for the per-canvas preparation barrier and
two actual frames after its revision settles. Counter stability and the former
1200 ms stage timeout no longer certify readiness. `WarmPlanetModel` registers at
layout commit, compiles the actual cached material, then waits for the texture
queue's explicit completion result. Warmup Suspense boundaries also participate,
including the existing unique far/lite looks and the bounded nearby full looks.

The texture queue deduplicates by renderer and texture, returns an explicit result
(`ready`, `failed`, `cancelled`, `context-lost`) and retains independent owners.
While covered it submits at most one texture per 16 ms timer; after uncovering it
returns to the existing idle scheduling (or the 50 ms timer fallback). Texture
version changes require another submission. Completion means upload commands were
submitted; it is not a GPU fence.

The opening cover has a seven-second deadline from mount, including network time.
The old secondary 15-second galaxy timer was removed. Galaxy loading exits without
its 180 ms fade so the fade does not extend that deadline. Timeout restores the
opening camera, releases the preparation barrier and preserves background work;
it does not certify successful preparation. `canvas.dataset.galaxyPreparation`
records `ready`, `failed`, `timeout`, `context-lost` or `cancelled` for inspection.
As with any JS timer, a blocked main thread can delay dispatch of the deadline.

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


## Explicit completion validation (2026-10-13)

The new phone recording `e6787380-b430-4ae9-bc24-1444e57a70ee` still measured
318.1 ms on first zoom-out and 175.7 ms on the second. Its textures rose from 153
to 234 and shader programs from 114 to 117 after opening. This established that
preparation was incomplete; it did not isolate which driver/shader/upload work
accounted for each stall.

Core and integration checks cover completion, shared owners, partial failure,
version changes during upload, cancellation, context loss/restoration, late
compilation after timeout and seven-second removal with the scene left mounted.
The 17-file focused regression run had 114 passing tests and two stale literal
source assertions. Those assertions were updated for the tracked Suspense fallback
and the queue's loading-mode argument; the subsequent 8-file run passed 77 tests.
Final web typecheck and lint passed.

The final full web run passed all 456 active test files: 6,078 tests passed and
29 were skipped (one entire file was skipped). The production build passed and
is available on the local phone preview; the existing large-chunk warning remains.

Chromium/SwiftShader rendered 204 actual `PlanetField` worlds and the normal
composer, completed the three views and reported `ready` without page errors.
A shader preparation was then deliberately held: the cover left at 7040 ms under
software rendering, the camera returned home, the result remained `timeout`, and
releasing the held job still submitted its textures in the background. These are
correctness checks, not S22 performance results. Artifacts remain in ignored
`out/render-performance/`. The temporary galaxy recording control is kept as a
local testing change so it can be removed independently before deployment.

## Latest phone recording comparison (2026-10-13)

The latest recording is `a6da2384-0ffb-4831-ad0d-c086b63fa2aa`, started at
16:40:40 Istanbul time. Compared with the preceding `e6787380` recording:

| Recorded metric | Previous (8 samples) | Latest (11 samples) |
| --- | ---: | ---: |
| Average FPS | 36.4 | 50.3 |
| Minimum sampled FPS | 19 | 27 |
| Longest stall | 318.1 ms | 292.9 ms |
| Gaps over 50 ms | 16 | 9 |
| Gaps over 250 ms | 2 | 1 |
| Total Long Task time | 1,235 ms | 545 ms |
| Maximum draw calls | 848 | 620 |
| Maximum triangles | 1,259,368 | 852,620 |

The first overview still stalls at second 3: 292.9 ms, with a 278.8 ms render
submission maximum. The later return to the overview at seconds 9–11 has a
maximum gap of 50.2 ms, versus 175.7 ms during the preceding record's later
overview at seconds 6–8. The latest home return at second 7 still has a 117.2 ms
gap. Texture counts rise from 170 at second 1 to 220 by second 10, so resources
continue to be introduced after loading. These observations do not identify the
specific work responsible for the remaining stalls.

This is not a matched A/B test: the scene changed from 198 planets, 174 shields,
63–64 contacts and 10 pirates to 199 planets, 176 shields, 48–49 contacts and
8 pirates; cache, thermal state and camera timing are not controlled. The quality,
viewport and DPR match, but lower scene load also affects the result. The record
does not contain `galaxyPreparation`, so it cannot distinguish a completed opening
from the seven-second timeout. Do not attribute all FPS/draw/triangle reductions
to the warmup change or conclude that first-zoom preparation is solved.

The read-only server export is retained as
`out/render-performance/phone-20261013T134040-comparison.jsonl` in this worktree.

## Follow-up after the 50-second phone recording (2026-10-13)

Recording `d95c6d12-7d30-4fb0-a658-6af138627ec8` averages 48 FPS. Seconds 6–30
average 51.6 FPS with no Long Tasks. Menu/shop/inventory samples 31–37 average
36.4 FPS and account for 1,313 of the total 2,227 ms of Long Tasks (59%). Their
maximum galaxy render submission time is only 18.4 ms. Seconds 43–44 instead
contain 201.9/184.1 ms render submissions, with shader counts rising 104 → 110
and textures 224 → 239. These are distinct investigation targets; the recording
cannot identify the responsible JS stack, decoding job, shader or driver call.
The first overview still stalls for 309.8 ms after the loading screen is gone.

Three concrete defects were reproduced separately from that correlation:

1. `fetchAsset` in `lib/preload.ts` recognised images only when their whole URL
   ended in an image extension. Actual planet URLs end in `.png?v=<hash>`, so
   their image/decode preparation was bypassed. Classification now examines the
   path before query/fragment while keeping the original fetch/image URL.
   Tests cover pending decode, failed decode/request, browsers without decode,
   and model URLs whose query/fragment looks like an image filename.
2. `ModelInstances` in `PlanetSkinModel.tsx` used `dispose={null}` to protect
   cached geometry/material, also suppressing `InstancedMesh.dispose`. In the
   installed Fiber reconciler, assets supplied through constructor `args` are
   not child instances. Normal mesh disposal therefore frees its instance buffers
   without disposing those assets. Real WebGL instrumentation over four removals
   showed live buffers growing 6 → 12 before the fix; afterwards each mount/removal
   remains 6 → 4 and eight instance buffers are deleted in total. Geometry and
   material dispose counts remain zero. Real reconciler tests additionally cover
   capacity reconstruction and reuse on remount for full and far tiers.
3. Fiber caches `useGLTF(url)` under a different key from `useGLTF([url, lodUrl])`.
   The skin and formation loaders used pairs, while preloads and previews used
   individual URLs. Both actual components invoked the file loader again after
   individual preloading. `useGltfPair` starts both individual preloads before
   reading either hook, preserving parallel loading and sharing their parsed
   results. Browser file-loader counts for a country planet and Pike formation
   changed from two to one per URL. Unit tests exercise the real Suspense cache,
   overlapping requests, identical tiers, replacement and either tier failing.

Four before/after browser captures (full/far default worlds, country skin, Pike
formation) have zero changed pixels, with no page errors. This verifies those
views and resource ownership; it does not establish an S22 FPS/thermal gain or
prove these defects caused every recorded stall. No LOD threshold, resolution,
effect, animation, model or gameplay behavior was reduced.

Recordings now capture the opening result when the galaxy's recording starts:
`ctx.opening` is 0 unknown, 1 ready, 2 timeout, 3 failed, 4 context-lost or
5 cancelled. The button still appears after loading. This metadata distinguishes
completed preparation from the seven-second fallback without recording under
the cover. It is compatible with the server's existing numeric context schema.

HTTP checks of actual versioned planet image/model URLs found production returns
`public, max-age=31536000, immutable`, while the local Vite preview returns
`no-cache` with ETags (conditional requests return 304). Browser cache reuse and
model parsing/GPU preparation are different costs; file-loader counters above
do not claim every invocation downloaded another network body. No HTTP cache
configuration or service worker was changed.

Evidence is in ignored `out/render-performance/`: `phone-20261013T135117*.json*`,
`phone-cache-headers-20261013.json`, `planet-lifetime-{before,after}.json`,
`gltf-cache-{before,after}.json`, before/after PNGs and the red/green test logs.
The focused change regressions passed 89 tests, followed by 33 passing tests
covering recording metadata and final cache/lifetime behavior. Web typecheck
passed. Full web regressions and the final build are recorded below when complete.

The next phone record (`776a3bb6-3701-4975-ac4f-6ec9360e1197`, 34 samples)
confirms `opening=2`: this opening used the seven-second timeout, not successful
preparation. First-five-second maximum gap is 167.4 ms versus 309.8 ms previously,
but the overall FPS is lower (34.5 versus 48). Menu/shop/inventory is now open for
14 of 34 samples, versus 7 of 50; those samples average 28 FPS and contribute
2,232 of 3,192 ms of Long Tasks. The maximum draw count/triangles also increased
to 727/1,122,033 from 570/849,733, with 49–50 contacts versus 37–39 and different
camera usage. These are not controlled A/B results or evidence that all stalls
are fixed. The next investigation must time the store's own renderer and JS work,
which the galaxy submission timer does not include.

During the local build replacement, the old lazy store URL
`SkinsScreen-BwqZG015.js` disappeared; Vite serves HTML for it, while the current
`SkinsScreen-egfcM7Ep.js` returns JavaScript. The reported dynamic-module error
cleared after reload, consistent with a tab holding the old import map. Current
JS/CSS chunks are archived under ignored `out/render-performance/phone-hashed-assets`
for retention on later local builds. No application auto-reload behavior was added.

## Session-wide review and follow-up fixes (2026-10-13)

The detailed findings, affected functions, evidence, risk and validation are in
[`render-performance-session-review.md`](render-performance-session-review.md).
The review covers every renderer change against the pinned production base.

An actual shop CPU profile identified the 384 native surface raycasts as a
485 ms first-use cost within a 515 ms Long Task. The equivalent local BVH query
preserves all samples and placement rules, with zero changed pixels for eight
normal/recovery elemental captures. Fresh geometry queries measured 403–513 ms
before and 8–22 ms after on desktop software rendering, not the S22.

New failing regressions also confirmed premature first-frame readiness during
context loss, permanent barrier cancellation during StrictMode replay and idle
starvation of background texture preparation. All three are fixed; the new
five-file regression group passes 46 tests. Native browser context loss and
restoration plus StrictMode preparation pass without page errors. On canvas
unmount, camera ownership is restored/released and its barrier is discarded;
effect cleanup no longer terminally cancels a barrier reused by effect replay.

Full web coverage was completed after an interrupted run by checking the
remaining files and changed regressions sequentially. Reconciled coverage is
460 files: 459 pass, one intentionally skipped; 6,113 passing tests and 29
skipped. The final 81-file group passes 366 tests; subsequent type-fixture
corrections pass their 26 behavior tests. Final web typecheck passes. No gameplay,
quality, LOD threshold, resolution or visual effect was reduced.

Final web lint and production build pass. The original six-view comparison was
repeated with unchanged draw/triangle results and zero changed pixels in every
view, without page errors. The standard seven-viewport loading check also passes
its 6× CPU check (p95 16.8 ms). The refreshed local phone build retains prior
hashed JS/CSS chunks to preserve lazy imports in open tabs; reload selects the
new code. The preview remains on port 4188 with the production API proxy. No
production deployment has been performed.
