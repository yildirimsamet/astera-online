# Rocket exhaust pack

Owner brief, 2026-10-21: four original, premium, mobile-conscious animated rocket
exhausts reusable by the commander ship and galaxy strategic missiles. Warm
orange/yellow and cold blue/white families, inspired by real rocket launches.
Owner image references sharpened the direction: an intensely hot yellow/orange
inner jet surrounded by a fast blue/cyan annular shear layer, with a substantial
column before the fraying tail. Solar and Siege combine warm and cold emission
within the same volume; Cryo keeps a white core inside a blue jet.
Owner review: full-throttle preview length is **4.6** (formerly 9.2), with unchanged
nozzle width. Blender/GLB local lengths are **3.0**, or **2.7** for Vacuum (also
halved). All emission, including the hot core and shock cells, fades continuously
over the final half of the plume; the core cannot remain as a separate bright rod.

## Research and authoring decisions

- [NASA: shock diamonds](https://www.nasa.gov/image-article/into-blue-sky/): bright
  compression cells are structure within a supersonic exhaust, not floating rings.
- [NASA: vacuum plume expansion](https://www.nasa.gov/directorates/stmd/plume-surface-interaction-psi/):
  vacuum exhaust spreads substantially. The vacuum look has a wide, translucent
  envelope and weak compression cells. These are art-directed looks, not a fluid
  simulation or claims about specific real engines.
- [NVIDIA: particle overdraw](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles):
  large overlapping transparent particles can become fill-rate limited. Use one
  bounded volume proxy and one shared instanced material; no particle simulation,
  bloom pass, dynamic lights or per-frame texture uploads.
- [Three.js instancing](https://threejs.org/docs/pages/InstancedMesh.html) batches
  transforms sharing geometry and material. Four palettes and shape profiles share
  the same draw. A small repeating noise map supplies advected density variation.

The render integrates emissive density inside a box along the camera ray. This
preserves a round throat when viewed from behind and a continuous volume when
orbiting; it does not expose crossed flat cards. Quality sets a fixed sample count.
GPU cost still depends on screen coverage; draw counts alone are not a phone FPS
benchmark. Hardware frame time must be checked on the owner's target phone.

## Deliverables and acceptance

| ID | Direction | Intended use |
| --- | --- | --- |
| solar | white/yellow throat, turbulent orange tail | heavy main drive |
| cryo | tight blue/white column, defined compression cells | commander cruise/turbo |
| vacuum | blue throat, broad pale violet/blue expansion | large orbital engine |
| siege | dense white/gold core, amber breakup | strategic missile |

Nozzle at the origin; exhaust points along local **−Z**, matching galaxy hulls.
The API accepts independent length, nozzle radius, throttle, seed and transform.
Zero throttle must be completely dark. Reject non-finite transforms and invalid
dimensions, avoid frame allocations, preserve opaque-world occlusion, and dispose
only resources owned by a batch. The caller retains ownership of its noise map.

Tests cover these lifecycle/input boundaries and the asset/geometry budgets before
implementation. Visual checks cover four looks, motion, shutdown, rear/oblique
views, portrait layout and a mixed 128-engine batch. Existing galaxy/arena wiring
is outside this asset-authoring change: no accepted flight, scale or palette is
replaced implicitly.

## Files and use

- `assets/source/engine-flames/astera-engine-flames.blend`: animated Blender-native
  volumes, presentation nozzles and a camera in the **Astera | Engine Flame Studio**
  scene. The previous Blender scene is preserved.
- `assets/source/engine-flames/recipes.json`: shared original shape, flow and palette
  recipes. Both Blender authoring and the game material read these values.
- `tools/engine-flames-blender.py`: reproducible authoring script. Run in Blender's
  Python environment with `ASTERA_ROOT` pointing to the repository root.
- `public/assets/vfx/engine-flames/*.glb`: static, textured fallback shells, 480
  triangles each, no nozzle hardware. **glTF does not carry the procedural volume
  shader or its animation.** Use the game API for the finished animated treatment.
- `src/vfx/engineFlames.ts`: the game API, shared between arena and galaxy callers.
  Importing it performs no network request and starts no animation loop.

```ts
const noise = await new TextureLoader().loadAsync(ENGINE_FLAME_NOISE_URL);
noise.wrapS = noise.wrapT = RepeatWrapping;
noise.colorSpace = NoColorSpace;
const engines = new EngineFlameBatch(noise, { capacity: 128, quality: 'mobile' });
scene.add(engines.mesh);
engines.set(0, {
  variant: 'solar', matrix: nozzleLocalMatrix, length: 3,
  nozzleRadius: .12, throttle: 1, seed: 17,
});
// In the existing render loop; no new timer or per-frame allocations:
engines.update(elapsedSeconds);
// When removing the owner:
engines.dispose();
noise.dispose(); // only when all users of this shared texture have gone
```

The instance matrix is local to `engines.mesh`. For a single ship, parent the batch
under that ship. For a fleet batch, transform each nozzle into the batch's local
space. Matrix changes and throttle changes use `set`; hide an instance with zero
throttle. Default depth testing lets opaque hulls/worlds occlude the effect.
Back faces integrate one contiguous emission volume; interpenetrating opaque
geometry clips conservatively at the proxy, not at a sampled scene-depth surface.
No screen-depth texture or extra pass is required.

Quality: mobile **8**, standard **12**, high **20** integration steps. Choose by
screen coverage and device, batch nearby ships together, and stop drawing distant
batches. Avoid filling the entire screen with many simultaneous volume proxies.

## Review and validation

Start the existing Vite server and open `/engine-flame-preview.html`. It is a dev
entry, not a new player screen. Drag to orbit; test throttle, shutdown and rear view.
`?quality=mobile` uses the 8-step shader. The studio merges its presentation hardware
separately; it is not included in the flame-only budget.

All checks run sequentially with **2 GiB Node heap**, one Vitest worker and `nice`:

```sh
NODE_OPTIONS=--max-old-space-size=2048 nice -n 10 pnpm --filter @astera/web exec vitest run test/engine-flames.test.ts test/engine-flame-assets.test.ts test/rocket-jet.test.ts test/cosmetic-plume.test.ts test/exhaust-lift.test.ts test/missile-presence.test.ts test/accepted-galaxy-art.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
NODE_OPTIONS=--max-old-space-size=2048 nice -n 10 pnpm exec tsc --noEmit -p apps/web/tsconfig.engine-flames.json
NODE_OPTIONS=--max-old-space-size=2048 nice -n 10 node tools/visual.mjs out/engine-flames --engine-flames
```

Observed: **31 unit/regression tests pass**; the isolated pack typecheck and scoped
ESLint checks pass. The whole web workspace typecheck reached the 2 GiB heap limit;
it was not reported as passing and the heap limit was not raised. The smaller
config above checks every new TS module/test and their imports without loading the
unrelated app graph.

Visual evidence: `out/engine-flames/desktop.png`, `phone.png`, individual views and
`results.json`. Chromium/SwiftShader verified animated flow, low/full throttle,
completely dark shutdown, rear/oblique views, opaque foreground occlusion and
portrait layout without page/shader errors. The mixed **128-engine** scene drew
**1 call / 1,536 triangles**, with no presentation hardware and one shared flow
noise map (the warmed renderer reports two allocated textures). This is
structural evidence, not a hardware frame-time claim.
