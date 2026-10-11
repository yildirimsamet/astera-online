# Client zoom preparation and monument captions

## Requirement and evidence

The owner's production admin session on the SM-S901E in Brave, 12 October 2026,
00:23:26–00:24:07 Turkey time, captured a 118.1 ms first-zoom frame with 76.5 ms
inside texture-upload calls. The owner reported that the first approach stuttered
and subsequent approaches improved. Texture calls were measured on the browser's
main thread; the particular assets and total GPU execution time were not recorded.
The same sampled CPU profile attributed 2.23 seconds of 40.55 seconds to monument
caption occlusion. These are measured costs, not a predicted improvement percentage.

The changes must prepare models before their first close draw and reduce caption
work while preserving the game's art, live motion, selection and visibility rules.
Work stays on master. Local verification uses only focused tests, sequentially,
with one worker and low process priority; full checks belong on CI.

## Scope and constraints

- Keep the existing model/material caches and LOD thresholds. Preserve local
  Suspense/error boundaries and transitions so a failed or unfinished preparation
  cannot hide the galaxy or prevent its normal drawing fallback.
- Prepare the fixed set of light planet looks in advance. Prepare full models
  only for the opening world and at most two distinct approaching looks in view.
  Do not eagerly upload every full-detail texture in the universe.
- Share one texture queue per renderer, deduplicate the same texture, and submit
  at most one texture per idle callback. A single WebGL upload cannot be split by
  this queue; this spreads preparation and does not promise every zoom is stall-free.
- Cancel an owner's pending work when it leaves, keep other owners' work alive,
  handle unavailable idle callbacks and failed asynchronous compilation, and allow
  preparation again after context restoration.
- Calculate monument caption occlusion from planet positions and body radii.
  A caption's visibility must be independent of touch-target padding, ship meshes,
  shield domes and LOD group membership. Only a planet before the caption blocks it.
- Cache caption results while the camera/projection, planets and caption positions
  are unchanged. Recompute after camera movement, lens changes, world updates,
  monument movement, or removal. Avoid allocating per planet on every frame.

## Regression cases before implementation

Texture queue: one upload per idle callback; shared texture uploaded once per
renderer; different renderers prepare independently; individual cancellation;
unmount/empty queue cancels callbacks; busy idle deadline waits; timer fallback;
upload failure leaves the next item runnable; context loss pauses and restoration
allows re-upload. Model preparation: async compilation precedes uploads; rejection
and late resolution after unmount cause no background upload; shared cached
geometry/material are not disposed. Target choice: visible approaches, distinct
looks, maximum two full looks, empty/far/offscreen worlds, opening-look exclusion.

Caption visibility: planet before/behind the caption; outside the sight line;
body limb; empty/removal cases; perspective and orthographic cameras; stationary
view avoids intersections; camera movement, lens and data changes invalidate the
cache; unchanged hidden membership retains its result object.

## Verification

Before implementation, the existing preparation failed the one-upload-per-idle
case (three calls instead of one), the light-only case, and emitted an unhandled
compilation rejection. A separate renderer-throw regression also failed before
its background failure handler was added. The new queue/visibility modules and bounded target
selector were also observed failing before they existed.

All 54 focused cases across six files passed in 7.95 seconds, including the existing
LOD and model-cache regressions, with `nice -n 10`, one worker and no file parallelism. A test-harness
cleanup order issue was corrected before recording the existing-code failures.
Final review also covers synchronous renderer failure, both opening-world tiers,
and context loss while uploads are still pending, including a new subscriber
during the loss. The CI typecheck exposed writable coordinate types on the two
read-only selectors; both now accept immutable coordinate tuples without casts.

Review: meshes used only for compilation are released after resolution or
rejection; cached model geometry/material remain owned by the existing cache.
Cancelled subscribers do not delete other owners' pending textures. Only one
idle callback per renderer is retained; the last subscriber removes canvas
listeners. Full-detail preparation has two approaching targets plus the existing
opening-world preparation. Previously visited models remain in the existing
session cache; this change introduces no GPU eviction policy.

The checked-in light assets have 256×128 colour maps: preparing all sixteen
requires approximately 2.67 MiB for RGBA8 texels and mipmaps, excluding driver
overhead. Light preparation leaves their normal/roughness maps unbound. Full
looks have 1024×512 colour and two 1024×1024 detail maps (about 13.33 MiB per
look under the same estimate), which is why full preparation follows only the
opening world and two approaching looks. These are asset-derived estimates,
not measurements of the phone's GPU memory.

Caption occlusion deliberately uses the 0.96-radius body envelope instead of the
old padded pointer geometry. It can reveal captions beside a planet's limb that
the oversized touch volume previously hid. Planet selection geometry is unchanged.
World and caption snapshots follow React's immutable input arrays; their positions
are rebuilt on data changes, independently of render-model mounting.

Full type/lint/test checks and the production web build run on CI
([workflow](../.github/workflows/ci.yml)); the result for the final master commit
is the release gate. No production change has been made for these two fixes.
Actual phone improvement and visual verification require the same live admin
first-zoom capture after publishing the reviewed change.
