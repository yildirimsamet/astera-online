# Ship model skins — 2026-10-09

Owner-approved mapping (latest correction): Ejder → Corsair (Korsan),
Balina → Citadel (Kale), Akrep → Viper (Engerek), Vatoz → Leviathan.
The supplied `shark` asset keeps its stable internal ID and filename; its customer-facing
name is Balina / Whale. UFO probe receives the same restrained
material treatment. Skins change appearance only; geometry retains its authored silhouette.

The incoming `assets/source/models/new_skins/` folder is a staging area. Its four
masters have moved byte-for-byte into `assets/source/models/ships/skins/<name>/model.glb`.
Canonical names are independent of their target hull, so reassignment never requires
renaming assets. Source GLBs are never served or overwritten by the build.

Generated assets mirror this hierarchy under `apps/web/public/assets/models/`:
`model.glb` for flight, `model_lod.glb` for distance, `model_preview.glb` for inspection.
Product cards belong under `public/assets/images/cosmetics/ships/`.
UFO stays under the existing `probes/` hierarchy.

Requirements and tests first: approved hull binding, independent per-hull equipment,
wrong-hull rejection, missing/unknown reset targets, ownership/revocation, concurrent
equipment changes, fog-safe fleet appearances, mixed formations and neutral fleets,
shop versus inventory, model orientations, geometry and texture budgets, original
source hashes, actual mobile and desktop renders. Material tests preserve neutral
armour and illuminate existing coloured detail rather than making the body glow.

Affected code: shared catalogue and equipment types; existing account JSON equipment;
equipment route and client contract; traffic appearances; instanced formation model
selection; product preview/cards and six locales; offline model pipeline. No gameplay
stats or payment prices change. Existing non-ship equipment stays compatible.

Category visibility: the shop shows only categories with actual catalogue items.
Inventory shows only categories with accessible owned or included items; free clan
standards are included for every account. The current selection falls back to the first
available category after a refund or collection refresh, without an empty selected tab.
Legacy planet-only responses remain supported. Unknown IDs never create a category.
Preview nozzles are measured per model and point aft; short jets must not inherit
large plume deformation. Mobile previews must frame every claw, wing, tail and jet.

Art references: [Warframe TennoGen texturing](https://www.warframe.com/en/steamworkshop/texturing-guide)
informs separating metal, surface colour and restrained focal emissives; [Khronos glTF PBR material extensions](https://www.khronos.org/blog/blender-gltf-i-o-support-for-gltf-pbr-material-extensions)
documents embedded emissive strength. These are technical references, not copied art.

Latest inspection: dragon eyes are the inset windows at source-normalized X −0.372,
not the rearward armour at −0.285. Whale wing jets have separately measured attachments:
`[-.318, -.065, .100]` and `[.318, -.109, .123]` in centered +Z-facing model space.
Do not mirror these points: the supplied wing tips differ in sweep and height.
Product photographs are rendered at an actual 600 × 400 canvas from the first frame;
resizing just the screenshot wrapper left a 260px canvas and made old cards look distant.

Final owner request: add a fourth engine skin, Titan Drive (`engine-titan`), inspired by
Death Star propulsion but sized for ordinary formations. The effect needs a cool ignition
core, turbulent orange combustion and a fading ember tail. Use one shared instanced draw
per formation and a bounded 800-triangle two-shell mesh; animation changes only the time
uniform. Existing engines, flags, rings, probe and ship bindings must remain compatible.
Cover catalogue ownership/equipment, distinct geometry and animation, card delivery,
shader compilation, shop/inventory and a real equipped mixed formation before finishing.

Visual review passes for all four ship cards, UFO and four engine cards. Whale is
inspected from top, both sides and rear; every other ship/engine from top and side.
The real shop and inventory pass at 350px and 1280px without broken cards or overflow.
Mixed flight loads each ship's flight and LOD model, retaining the unskinned Dart,
and never requests an inspection model. A separate real Titan formation records
16 exhaust instances with one 800-triangle geometry and a single-pass material.
Artifacts: `out/ship-skins/collection.png`, `engine-titan-motion.gif`,
`titan-fleet.png` and `results.json`.

Stationary-camera store checks confirm motion for all four engines with zero shader
or JavaScript errors; recording and frame differences are in `out/ship-skin-motion/`.
The latest focused model/assets/categories/drive tests pass (62), as do server
ownership/equipment/traffic/payment regressions (43) and offline asset tests (14).
The facing registry test includes the cosmetic catalogue's flight, LOD and inspection
paths and independently checks that every facing path points to a real file.

Final ordinary workspace validation passes typecheck, lint and 10,661 tests across
rules, web and all 208 ordinary server files. Economy simulations and snowball audits
are excluded under the owner rule. Detailed accounting is recorded in
`out/ship-skin-review/validation-results.json`.
