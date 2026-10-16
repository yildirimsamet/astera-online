# Galaxy artifact review — 2026-10-17

Owner reports: intermittent large black rectangles in the galaxy, most noticeable on desktop;
Tempest / Fırtına İtkisi exhaust flashes become disproportionately bright when zoomed out.
Scope includes all galaxy render layers, every cosmetic family, Aegis and shared postprocessing.

## Findings and changes

The source contained undefined GLSL operations: descending `smoothstep` edges, signed bases
passed to `pow` for Gaussian squares, fractional powers without a nonnegative domain, and
unguarded polar `atan(0, 0)`. These are concrete portability defects; the owner's intermittent
desktop rectangle was not independently reproduced, so no individual defect is claimed as
its definitive cause. GLSL defines the relevant domains in the
[Khronos specification](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf).

Descending ramps now use `1 - smoothstep(low, high, x)`. Gaussian squares use multiplication.
Interpolated tails, dot products and oscillatory power bases are bounded. Planet impact UVs
guard poles and zero-length positions. Aegis uses high precision and a nonzero derivative
width so its smoothstep edges cannot coincide on a flat derivative.

Bloom already sanitized its luminance input, but the final composite still sampled the
original scene. `FiniteSceneEffect`, before Bloom and Vignette, now replaces non-finite or
out-of-half-float-range scene samples before blending. `BlendFunction.SET` avoids mixing a
NaN with zero. It merges into the existing fullscreen pass. Galaxy, landing and ship inspector
all use it; the existing luminance guard remains in place because bloom updates separately.

Tempest attenuation uses projected nozzle diameter in CSS pixels, including parent/instance
scale, for perspective and orthographic cameras. Nearby lightning retains its HDR emission;
distant flashes remain visible with a bounded formation budget. The nozzle count matters:
17 coincident distant nozzles previously summed to a peak luminance of approximately 6.096;
the initial fix measured approximately 0.365, below the galaxy bloom threshold.

Following owner feedback, deliberate white-gold ignition flashes now restore the loved crackle.
They last approximately 90 ms and occur sparsely on a seeded six-tick-per-second clock.
Near-view ignition fades into a bounded 12 CSS-pixel branching map flash when ships shrink.
It shares the plume draw, stays at the real motor position and cycles between motors, with only
one map flash drawn per formation tick. The final 17-nozzle far fixture peaks at approximately
**0.586**, below **0.78**. Warm flashes occur in **6 of 24** sampled frames, rather than becoming
a continuous yellow glow. The initial 2–3-pixel version was too small and is superseded.

Optional reference ship art now requires `ASTERA_REFERENCE_ART=true`. Merely having the old
reference pack on disk no longer enables the canceled replacement ship models in local dev.

## Coverage

| Render family | Review and action |
| --- | --- |
| Sky, nebulae, hero cards, stars, dust, meteors | Shader domains, projection and render state reviewed; descending sky ramps corrected. |
| Planet bodies, LOD/billboards, palette and authored skins, attachments, impact scars | Material patches, depth/blending and polar coordinates reviewed; impact coordinate guards added. |
| Aegis and satellite shells, telescope/radar volumes and sweeps | Precision, derivative widths, polar fades and instance data reviewed; Aegis and sensor ramps corrected. |
| Ships, fleets, probes, miners, trade/convoy routes, pips, ranks and wakes | Projection, instance bounds, additive emission and power domains reviewed; Tempest formation budget, pip ramp and convoy tail corrected. |
| Rings, crystal shards, flags, banners and all exhaust styles | Both shared and specialized shader paths reviewed; signed Gaussians, fractional powers, polar coordinates and descending ramps corrected. |
| Asteroids, wrecks, Dyson/monument models | Built-in/custom materials, model transforms and visibility reviewed; no additional unsafe domain found. |
| Combat and strategic effects, radiation bursts | Atlas/frame bounds and shader domains reviewed; radiation Gaussian corrected. |
| Shared postprocessing and context recovery | Existing bloom input guard retained; final scene guard added to all three composers. |

No galaxy shadow maps are enabled. The review found no evidence justifying blanket changes
to shadow bias, culling or depth testing. Existing instanced bounds/culling handling was retained.

## Verification and limits

### Follow-up: readable map lightning

Owner feedback: the initial 2–3-pixel flashes disappear when ships are barely visible.
Requirement: short white-yellow branching lightning must remain readable at extreme zoom,
without the former large bloom halo. Add a bounded 12 CSS-pixel lightning patch in the same
Tempest instanced draw; select only one nozzle per formation tick to prevent accumulation.
Fade it into the existing near-view plume and retain depth testing/world anchoring. Increase
the pulse duration to about 90 ms. Cover single/multiple motors, perspective/orthographic,
extreme zoom, finite pixels, intermittent visibility and maximum footprint. Other skins and
the existing finite-pixel guards are unchanged. Geometry increases by two triangles per nozzle.

Implemented and visually checked on the real fleet gallery. The GPU regression now includes
distance 640 as well as 160: visible warm lightning covers 39–42 pixels inside its fixed small
patch instead of the previous 2–3 pixels. The 17-overlapping-nozzle fixture peaks at **0.586**;
the most intense distant orthographic case peaks at **0.737**, both below **0.78**. Perspective
and orthographic cameras retain the same compact patch even as the ship becomes subpixel.
The map patch adds no draw call and alternates between motor ports. Earlier measurements below
describe the initial implementation, superseded by this follow-up for distant visibility.
Follow-up validation: 81 focused tests passed across six files; the zoom GPU sweep and live
formation screenshots passed, including subpixel ships at extreme perspective/orthographic zoom.
Web typecheck and scoped lint of all follow-up code/tests/tools passed.

### Existing audit checks

- Regression tests were written and observed failing before the corresponding fixes.
- Focused render/material/context suite: **153 tests passed across 11 files**. Separate focused
  tests cover sky, radiation, convoy, engine geometry/anchors and reference-art opt-in.
- Final focused rerun after white-gold flashes and test typing fixes: **100 tests passed across
  7 files**. Web typecheck and scoped lint passed, including the final GLSL/tool edits.
- `node tools/visual.mjs out/render-artifacts --render-artifacts`: **63 shader-family and
  fault-injection cases passed**. Material cases cover 12 frames each: four times, including
  ten hours elapsed, and three viewpoints, including poles/inside surfaces.
- Fault injection: unguarded NaN produced **192 invalid channels**; guarded NaN, positive/negative
  infinity and overflow scenarios produced **zero invalid channels**. Healthy-image difference
  was **zero**; both configurations used **14 draw calls**.
- `node tools/visual.mjs out/tempest-zoom --tempest-zoom` covers near/mid/far zoom, perspective
  and orthographic projection, 24 animation samples, 17 coincident nozzles, and live React
  uniform wiring. Screenshots and measurements are written alongside its review JSON.

GPU automation uses headless Chromium/SwiftShader. Planet material tests use diagnostic sphere
fixtures, not a complete render of every authored GLTF and texture. Static source discovery
covers all shader-producing files, while the numerical GPU suite covers the listed custom
material families; it is not a claim that every asset was individually photographed.
The owner's first local observation after the fixes was that the bug appears resolved.
Because it was intermittent, this is encouraging rather than a definitive reproduction of
the original driver fault. Continue observing `http://localhost:5173` after a hard refresh.
The owner requested visible white-yellow flashes without a large glow; those are now implemented
deliberately within the zoom/formation budget above.
No full test suite or long simulations were run for this expanded audit.
