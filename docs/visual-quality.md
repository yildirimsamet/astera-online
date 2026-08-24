# Galaxy visual quality gate

This is the acceptance contract for the galaxy's visual upgrade. It turns
“premium” into frames and budgets that the three-person team can review, rather
than a taste argument at the end of a milestone.

The visual north star remains the one in `product-vision.md`: **a NASA photograph
you can fly around in, happening now.** Presentation may become substantially more
ambitious; public readability, mobile-first portrait and server-authored outcomes
do not move with it.

## Reproduce the baseline

With the API and web client running:

```sh
WEB=http://localhost:5199 pnpm visual:baseline -- out/visual-baseline
```

The default run uses the locked 390 × 844 portrait viewport at DPR 2. It opens the
real `GalaxyCanvas` inside the write-free rehearsal, captures the wide disc and the
home approach, records WebGL counters, fails on page/console errors, and fails if
the rehearsal makes an unexpected API call. It creates no account and takes no
seat. `INCLUDE_DESKTOP=1` adds the 1440 × 900 composition check; `SCENARIO=desktop`
runs only that check.

SwiftShader is intentionally used in automation. Its absolute load time is not a
device benchmark; its images, scene counters and regressions are repeatable. Frame
time acceptance is measured on the real-device matrix below.

## D90 baseline · 2026-08-23

Portrait rehearsal, wide disc, Chromium/SwiftShader:

| Counter | Baseline | Idle ceiling | Battle peak ceiling |
| --- | ---: | ---: | ---: |
| Galaxy draw calls, before post-processing | 35 | 55 | 100 |
| Triangles | 29,576 | 75,000 | 180,000 |
| GPU textures | 47 | 64 | 80 |
| GPU geometries | 32 | 48 | 72 |
| Rendered points | 5,100 | 8,000 | 20,000 |
| Pixel ratio | 2 | 2 | 2 |

These are ceilings, not targets to fill. An effect that crosses one needs a measured
trade, not a wider column. Battle peak is sampled with a full visible volley,
impacts and debris; it is not permission for the idle galaxy to retain battle VFX.

Current visual score: **6.4 / 10 — competent and distinctive, not yet premium.**

| Surface | Reading now | Acceptance for the upgrade |
| --- | --- | --- |
| Composition | Portrait wide view is readable and alive; desktop is too sparse | Portrait remains primary; wide layouts preserve scale and focal tension |
| Stars | Good magnitude and temperature variation | No uniform dot field; bright stars stay rare and bloom selectively |
| Nebula | Attractive silhouette, but too faint and flat through much of the frame | Three depth bands, readable dust absorption and no obvious texture seam |
| Worlds | Strong texture identity; limb sometimes reads as a grey halo | Lit crescent reads as atmosphere, dark side stays clean, selection remains unambiguous |
| Propulsion | Transit trails read as thin white route marks | Engine core, plume and wake form one directional signature at every semantic zoom |
| Asteroids | Motion is legible; line-like wakes feel diagrammatic | Tumbling mass, mineral shedding and a dissipating particulate wake |
| Combat | Timing and staging exist; projectiles and impacts lack physical weight | Launch, cruise, impact flash, ejecta and cooling aftermath read as distinct beats |

## Real-device performance gate

The team keeps one device in each tier and records a 20-second wide orbit plus the
signature battle. Browser emulation is not evidence for this table.

| Tier | Acceptance |
| --- | --- |
| Current iPhone / flagship Android | 60 fps target; p95 frame ≤ 20 ms |
| Mid-range Android, two to three years old | 60 fps target; p95 frame ≤ 24 ms |
| Low tier supported Android | 30 fps minimum; p95 frame ≤ 33.3 ms |

No capture may show a long task over 100 ms during an already-loaded battle. Display
DPR stays fixed during camera interaction: thin trails, hull silhouettes and stars
must never blur under the player's finger. `prefers-reduced-motion` removes meteors,
violent camera response and non-essential particle drift without hiding game state.

## Required acceptance frames

Each implementation item retains a before/after pair with identical viewport and
state:

1. Full portrait disc.
2. Home-world approach.
3. One moving combat fleet at readable distance.
4. The signature volley: launch, cruise, impact and aftermath.
5. Asteroid crossing with a Prospector nearby.
6. The busiest supported galaxy state.

Review the stills at 100% and at phone size. A frame passes only if game objects
remain readable without their labels, bloom does not merge unrelated objects, fog
does not reveal private information, and decorative motion never resembles a
route, radar warning, watch beam or selectable contact.

**Sharpness is invariant.** No full-screen blur, depth of field, motion blur,
interaction-time resolution drop or backdrop blur may soften the galaxy at any
moment. Bloom is local to luminous energy and may not erase the hard silhouette of
a ship, world, asteroid or interface glyph beneath it.

## Ownership and CR

The rendering owner owns shaders, batching, colour management and renderer
counters. The VFX/art owner owns reference, shape language, atlases and the
acceptance frames. The integration/performance owner owns semantic readability,
the device matrix, Playwright captures and regression reporting. Owners may rotate;
every milestone still names all three responsibilities.

At the end of every plan item, CR means:

1. Review only that item's diff and remove accidental or duplicate work.
2. Run focused tests, web typecheck, lint on touched files and `git diff --check`.
3. Run `visual:baseline`, inspect every produced image, and compare renderer
   counters with this table.
4. Record any deliberate budget movement and its visible return before proceeding.

An item is not complete because it compiles. It is complete when its before/after
frame is visibly better, its information hierarchy is intact and its measured cost
fits the gate.

The signature vertical slice is the one deliberate prototype exception: it may
hand a quantified shared-infrastructure debt directly to the following VFX
infrastructure item, because discovering that common cost is part of the slice's
job. It may not ship, roll out to another effect or pass the infrastructure CR
until that debt is back inside the same unchanged ceiling.

## D90 infrastructure result · 2026-08-23

The HDR and shared-formation pass made the renderer contract explicit: linear-sRGB
working colour, sRGB output, ACES filmic tone mapping and a half-float post-process
target. Bloom is mipmapped and selective; the two-sample composer replaces the
library's eight-sample default on the mobile full-screen buffer.

Formation exhaust lights, capacity pips and parallel wakes are now three shared
buffers instead of per-craft transparent objects. The fixed portrait rehearsal and
a real 36-marker raid produced:

| Capture | Draw calls | Triangles | Textures | Result |
| --- | ---: | ---: | ---: | --- |
| Idle portrait | 23 | 3,178 | 27 | Pass |
| Signature battle peak | 92 | 52,053 | — | Pass |

The battle prototype measured 105 calls before wake batching and 240 before the
shared-light pass. The unchanged battle ceiling remains 100. Visual CR found no
bloom wash or lost black level; the oversized blue engine envelope and thin linear
wake remain propulsion work, not infrastructure debt.

## D90 propulsion result · 2026-08-23

Ship drive signatures now have three energy zones in the existing shared buffers:
a compact hot throat, a blue expanding/fading plume and a cooler wake. Thirteen
plume samples merge into one continuous flame without adding draw calls. The wake
is a camera-facing shader ribbon with a soft cross-section, nonlinear decay and a
small deterministic flutter; formation ribbons remain one draw.

Playwright CR used a 36-marker raid at the locked combat camera. The final full
engagement peaked at 82 calls and 49,498 triangles. At readable distance the hull
silhouette remains visible, the previous overlapping blue discs are gone, and the
wake no longer reads as a route line. A final approach-only tuning frame confirmed
the lower-energy core without changing geometry or call count.

## D90 missile and impact result · 2026-08-23

The server-authored shot clock remains linear, while rendered distance now follows
an accelerating power curve: ignition is readable and contact arrives with speed.
Trail opacity has separate ignition and contact envelopes, and transparent
double-sided ribbons use a single pass. Round and ejecta buffers are explicitly
disposed when an engagement leaves the scene.

The shock texture is no longer a camera-facing HUD circle. Every impact reuses one
module-lifetime quad aligned to the local surface normal, so the wave foreshortens
with the planet. Fireball, outward-only ejecta and cooling smoke retain independent
curves. The final Playwright raid peaked at 82 calls and 41,692 triangles; all 50
bombardment tests and 12 frame-policy tests passed. Close-camera CR also capped
formation pips in screen space so combat markers cannot grow into pixel blocks.

## D90 environment result · 2026-08-23

The background now has an explicit far/mid/near depth stack: a domain-warped sky
sphere with narrow emission ridges and stronger absorption lanes; deterministic
temperature/magnitude star shells; and a three-height particulate disc rotating in
the playable volume. The star and dust distributions are seeded, so visual
regression sees the same sky on every run.

Twenty-two bright stars moved from individual sprites to one custom point buffer.
Its fragment shader draws a soft core and restrained four-vane diffraction pattern;
ordinary stars and dust retain power-law size distributions instead of uniform
dots. NASA's temperature ordering (hot blue/white, cool orange/red) and the
emission/reflection/dark-nebula distinction informed the narrow palette and the
subtractive dust structure.

The final portrait Playwright capture measured 27 calls, 6,330 triangles and 37
textures with 20 visible worlds and two rocks, below every idle ceiling. Wide and
home frames preserve black level and planet hierarchy. Seventeen focused tests,
lint, production build, full web typecheck and diff checks passed.

## D90 asteroid and planet result · 2026-08-23

Asteroid bodies remain three instanced model buckets. Their field-wide tail is now
a soft-edge shader ribbon with curved orbital geometry, a warm mineral head, cool
dust decay and nonlinear width/fade. Six deterministic grains per rock add broken
mass near the head; every grain in the field is still one points draw. The old
double-sided transparent ribbon cost two passes, so the added particulate draw did
not raise the measured scene call count.

Planet atmosphere stayed one instanced quad for the galaxy. Its extent tightened
from 1.16× to 1.10× radius, opacity from 0.62 to 0.40, and scattering energy is
concentrated in a narrower, more saturated lit-side crescent. Fog-of-war continues
to multiply the same per-instance stance value and the atmosphere remains clear of
the 1.34× selection ring.

The final phone wide/home capture held at 27 calls, 6,290 triangles and 37 textures.
An authenticated Playwright focus frame additionally verified the asteroid's
curved taper and particulate head at close range. Sixteen planet/frame tests,
lint, production build, full web typecheck and diff checks passed.

## D90 adaptive quality and motion result · 2026-08-23

Reduced-motion is a live preference, not a page-load snapshot. Its media-query
listener stops meteors, atmosphere breathing, dust rotation, engine flicker and
trail flutter while preserving positions, combat state and readable propulsion.
Camera focus changes become effectively immediate for players who request it.

An interaction-time DPR experiment failed visual CR: dropping a DPR-2 phone to
1.2 visibly blurred the ship silhouette and its thin wake until the quality
debounce recovered. It was removed completely. The Playwright gate now zooms the
live canvas, captures the interaction frame and asserts that DPR is unchanged
before, during and after the gesture.

Final production captures held DPR 2 → 2 → 2 on the 390 × 844 phone and DPR 1 →
1 → 1 on desktop. The normal phone scene measured 29 calls, 8,272 triangles and
40 textures; reduced motion removed one draw and all three ambient meteor lines.
Desktop measured 32 calls and 8,408 triangles. All three runs had zero page errors
and zero unexpected API writes; visual inspection found no interaction blur.
