# Renderer session review — 13 October 2026

Scope: `perf/galaxy-render-isolation`, from production web base
`1b176fed5d5ba95ecf76c1d1dd9180072b4e5c51` through the current fixes. The dirty
master checkout is excluded. This review includes the three original renderer
changes, covered opening preparation, the seven-second deadline, preload and
GLTF cache changes, instance-buffer ownership, recording metadata and the new
surface-query optimization. The temporary recording button remains a separate
local testing change.

## Confirmed findings and fixes

### P1 — first-use surface preparation blocks the main thread

- **Location:** `planetSurfaceProbes` in `galaxy/planetSkinAttachments.ts`, called
  synchronously by `LoadedPlanetSkinAttachments` in `PlanetSkinAttachments.tsx`.
- **Before:** 384 native mesh raycasts each scanned the full planet's roughly
  10,000 triangles. A CPU profile of the actual shop found 485 ms inside these
  raycasts and a 515 ms Long Task. Reopening the same model needed no raycasts,
  confirming that the existing geometry-keyed cache works after first use.
- **Fix:** use a temporary local `MeshBVH` to query the same geometry, retain all
  384 directions, and keep the existing fracture detection and placement rules.
  Indirect indexing preserves shared render buffers; no global Three prototype,
  render geometry, material, LOD or visual detail is changed. Equal-distance hits
  retain native face-index ordering; ray normalization matches native Mesh.
- **Validation:** tests first demonstrated the 384 native scans. Eight behavior
  cases now pass, including indexed/unindexed surfaces, seams, fractures, draw
  ranges, shared geometry and cache reuse. Four elemental looks in normal and
  recovery states have identical surface records, identical placement matrices
  and **zero changed pixels in eight captures**. Fresh geometry queries including
  temporary geometry cloning measured 403–513 ms before and 8–22 ms after.
- **Limits/risks:** those timings are desktop Chromium/SwiftShader, not S22
  timings or an FPS/thermal claim. Tree construction still has a one-time CPU
  cost and temporary allocations. The exact already-installed `three-mesh-bvh`
  0.8.3 is now declared directly; installed source and upstream documentation
  were checked. The tree is released after the calculation; only the existing
  probe results remain cached.

### P1 — first-frame readiness can be announced on a lost context

- **Location:** `FirstSceneFrame` in `galaxy/SceneWarmup.tsx` and its
  `GalaxyCanvas` call site.
- **Before:** opening preparation restores the camera and settles on context
  loss. `prepared` can still describe the old epoch, letting the first-frame
  notifier fire despite the composer being unmounted. A loss between a draw
  and its queued readiness callback also allowed a stale notification.
- **Fix:** require `gpu.live` at the call site; check the actual context before
  scheduling and again inside the callback. A lost callback releases the latch
  so recovery can announce a real frame.
- **Validation:** both new regression tests failed before the fix. Real browser
  `WEBGL_lose_context` tests produce zero notifications while lost and exactly
  one after restoration, including loss before the queued callback.
- **Effect/risk:** avoids opening the game/tutorial on a nonexistent first
  frame. It changes failure handling, not steady-state image quality or FPS;
  the parent's seven-second fallback remains in force.

### P2 — background texture preparation can wait indefinitely

- **Location:** `createQueue` in `galaxy/planetTextureQueue.ts`.
- **Before:** after the cover disappears, required uploads wait for an idle
  callback with at least 4 ms remaining. No timeout existed; repeated short idle
  slots or continuous main-thread work could prevent preparation from completing.
- **Fix:** give an upload a one-second idle deadline, honor `didTimeout`, and
  retain its original waiting time across inadequate slots. Submit at most one
  texture per callback. Covered preparation, independent cancellation and the
  existing timer fallback retain their behavior.
- **Validation:** the two new starvation cases failed before the fix; all 19
  texture queue tests pass, including shared owners, cancellation, failures,
  version changes, context loss/restoration and cover expiry.
- **Effect/risk:** required background work progresses even under sustained
  pressure. A forced upload can consume frame time; one texture per timeout
  bounds the submission count, not the duration of a single driver upload. JS
  dispatch can be delayed by a blocked main thread.

### P2 — StrictMode cleanup permanently cancels the opening barrier

- **Location:** the final layout-effect cleanup in `useOpeningViews`.
- **Before:** React's development effect replay called `work.finish('cancelled')`
  before any preparation frames, cleared tracked jobs and permanently disabled
  the barrier. The app actually uses `StrictMode` in `main.tsx`.
- **Fix:** cleanup restores/relinquishes camera ownership without terminally
  finishing the launch barrier. Live completion, timeout and context-loss paths
  remain responsible for its result. Child work still releases its owners on
  unmount; the canvas-owned barrier is discarded with the canvas.
- **Validation:** the new StrictMode regression first observed `cancelled` and
  lost pending work. It now retains the pending job and completes normally.
  The real browser also observes wide → middle → home and one ready notification
  under StrictMode without errors.
- **Effect/risk:** restores the intended development behavior; it is not a
  production FPS gain. Existing unmount and later-camera-movement tests pass.

### Previously reproduced resource/cache defects rechecked

- `ModelInstances`: removing `dispose={null}` frees only the instance buffers;
  cached geometry/material supplied through constructor args survives. Real
  WebGL cycles stopped the growing live-buffer count; full/far, remount and
  capacity-replacement tests pass. No pixel changes in the two tier captures.
- `useGltfPair`, skin models and formation hulls: individual URL cache entries
  replace array keys while starting both loads in parallel. Actual file-loader
  invocations fall from two to one per URL after individual preloading. This
  is parse/object reuse, not proof of a second network download. Overlapping
  consumers, identical URLs, tier replacement and either failure are covered.
- `fetchAsset`: versioned image URLs enter `Image.decode` preparation using the
  path for classification and the original URL for caching. Decode, request
  failure and unsupported-decode cases pass; model URLs with image-like queries
  remain model fetches. HTTP cache behavior was verified separately.

## Original optimizations and their connections

| Area | Review result | Evidence and limits |
| --- | --- | --- |
| Postprocessing | Effect children retain identity through parent updates and preparation. Context/resolution changes rebuild targets; bloom guard, HDR and MSAA are preserved. | Lifecycle regressions and real before/after captures. No reduction in postprocessing quality. |
| Planet/shield compaction | Body drawing is separate from stable pick order. Shield colour, opacity, phase and breath follow compact slots; animated maximum radius is included. | Frustum boundaries, projection/parent changes, replacement data, zero visibility, re-entry and native raycast tests. |
| Formation culling | Movement/camera callbacks run before buffer work in the galaxy. Hull outline, engines and wakes have independent conservative bounds. Unbounded custom animation remains visible. | Offscreen buffer versions and current-time re-entry checked. The earlier preview callback-order regression was fixed; previews keep automatic rendering. |
| Covered opening | Camera ownership, tracked resource completion and actual home-frame release are preserved; timeout restores the camera and background work continues. | Pure state tests plus real browser ready/timeout scenarios. The new StrictMode/context cases close additional gaps. |
| Loading deadline | One seven-second deadline from mount; the galaxy cover exits immediately instead of adding a fade. | Deadline and slow-preparation browser checks. A blocked main thread can delay JS dispatch. |
| Recording | Opening outcome is snapshotted after loading. Existing counters and renderer auto-reset are restored when recording stops. | Actual PerfProbe harness and payload tests. The galaxy render timer excludes preview renderers and UI; it is CPU submission time, not a GPU timer. |

The culling comparison still intentionally leaves the wide view unchanged:
all visible detail must continue to be drawn. A high triangle/draw count alone
was not treated as a defect. Gameplay clocks, picking, combat, trails, resolution,
LOD thresholds, materials and visual effects were not reduced.

## Unresolved measurements

The latest S22 recording uses `opening=2` (seven-second fallback). It does not
prove completed preparation or an overall performance gain: scene load, camera
route and time spent in the store differ from the previous recording. The surface
calculation is now a demonstrated CPU hotspot with an equivalent-output fix,
but not every remaining zoom/store stall has an attributed phone call stack.

The isolated shop CPU profile also shows context creation, shader/texture first
use and context teardown work. Its inventory transition has a SwiftShader
`loseContext` stall. That driver timing is not evidence of the same S22 cause;
no speculative renderer-pooling change was made. Thermal and battery stability
still need a sustained matched-device run. The recorder alone cannot attribute
GPU execution or browser GC.

## Verification artifacts

Ignored `out/render-performance/` contains the original comparisons and native
buffer/cache measurements; `shop-*.cpuprofile`; `surface-probes-{before,after}.json`
and eight pairs of captures; `session-review-{red,green}.log`; and
`session-review-browser.json`.

The interrupted full web run was completed by checking its remaining files and
the changed regressions sequentially. Coverage reconciliation confirms all 460
test files were exercised: 459 pass, one intentionally skipped; 6,113 tests pass
and 29 are skipped across the recorded runs. The final 81-file group itself has
366 passing tests; the subsequent test-type corrections pass all 26 tests in
their two files. Final web typecheck and the web lint group pass. Other workspaces
were unchanged and had passed their checks earlier in this session.

The original six-view rendering comparison was repeated after these fixes:
every view again has zero changed pixels and no page errors. The near fixture
retains 431 → 191 calls; the fully visible wide view stays at 591 calls. The
standard loading visual check passes seven viewport ratios, real bootstrap,
moving orbits and its 6× CPU check (p95 16.8 ms). These are browser correctness
checks, not measured phone FPS. The production web build passes (12.72 s); its
existing large-chunk warning remains. It is served on the phone preview at
`http://192.168.1.73:4188`, using the authorized production API. Prior JS/CSS
chunks are retained in this local build so an already-open tab can still import
its lazy modules. Reload is needed to test the newest code. No production
deployment has been performed.

Implementation references: installed Three/Fiber/BVH source was checked against
the [upstream BVH 0.8.3 API](https://github.com/gkjohnson/three-mesh-bvh/tree/v0.8.3#readme).
The background deadline follows the required-work timeout semantics described
in [MDN's requestIdleCallback documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback).
