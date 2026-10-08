# Astera Online loading film

## Requirements and inspection

- Eight seconds, 30 fps, 1920 × 1080, Eevee, 240 delivered frames. Frame 241 is the loop boundary, not an exported duplicate.
- The original raster logo is reused without replacing or stretching its typography. Its existing coloured artwork gets restrained saturation and alpha contrast through the material, not an edited source file; the contrast curve reduces its supplied haze while keeping the original lettering and illustration.
- Logo readability takes priority over ring, light, camera and stars. No reveal, disappearance, UI, sound, large flare or distracting particles.
- Background, camera and illumination return to the same state at the boundary. A 32-fold symmetric ring turns one sector per loop, giving a 256-second full revolution without an eight-second spin or a reset.
- The logo is a stable UV-mapped, alpha-cut artwork plane, not procedural text. The 768 × 433 original asset limits close-up detail; composition keeps it close to its native display size.
- No open Blender process was found. `/tmp/quit.blend` was inspected read-only: `Scene`, one planet mesh `Sphere`, four materials, packed planet textures, no render camera, no logo or ring. Preserve it and retain its original scene in the new file.
- Real lockup: `apps/web/public/assets/images/logos/logo-lockup.png`. `logo-mark.png` and the supplied logo plates were also identified. The existing loading component is under active user development; do not modify it.
- `general/orbital_ring.png` is a 350px 2D building render, useful as a metallic reference but unsuitable for 3D motion.
- `assets/source/models/dyson/dyson_1.glb` was imported and rendered for inspection. Its wide body and four large pointed modules conflict with the requested thin, elegant structure. The ancient stargate is a substantial 116k-accessor-vertex monument, also unsuitable for this minimal identity shot.
- No reusable deep-space environment texture was found: the game sky is generated in `apps/web/src/galaxy/sky.ts`. Use a sparse reproducible star field and very faint procedural interstellar dust in Blender.
- Work only in this asset folder and `out/astera-loading`; never alter original art, recovered scene data, app code, camera controls or gameplay.

## Acceptance and edge cases

The owner subsequently waived TDD for this visual task. Scene checks already completed are retained as optional production validation; no further TDD cycle or workspace-wide tests are required. Finish by reviewing rendered footage and the loop seam.

1. Check requirements against a Blender scene before creating the implementation (expected failure), then rerun against the saved result.
2. Verify packed original logo, aspect ratio, camera type, engine, duration, source-scene preservation and bounded geometry.
3. Compare evaluated endpoint transforms, lights and shader inputs. Check the rotating geometry as an unordered world-space point set: equivalent geometry, not equal Euler angles.
4. Verify ring projection clears the actual lettering across the loop; the original diagonal artwork can extend beyond the lettering.
5. Render and visually inspect first, middle and boundary frames. Iterate composition/materials and compare a second preview. Inspect a contact sheet of the full animation and seam frames.
6. Deliver the editable packed `.blend`, silent browser WebM/MP4 loops, a still poster, scene tests and reproduction instructions. Encode 240 frames, not 241; include no intro/outro, audio or fake percentage.

## Scope and risk

Only Blender production scripts, validation, notes and output media are new. Existing application logic is untouched. Preserve every pre-existing scene and object by creating a separate production scene. Use keyframes, not handlers/drivers/external runtime dependencies. Pack the texture so moving the `.blend` does not break the logo. Keep colour management, glow and geometry modest for a 4GB GTX 1650 Ti.
