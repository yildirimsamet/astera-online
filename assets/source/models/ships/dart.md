# Dart model replacement — 2026-11-01

Owner-supplied master: `/home/yildirim/Downloads/meshy_convert/dart.glb`.
Incoming SHA-256: `a103a27ae133c67a74345ab550120bb438e61fc6bfb942a4b3202741593eefae`.

The supplied geometry, normals, UVs and colour atlas are retained. The source material
uses metalness 0.32 and roughness 0.52 for the painted alloy finish. No card or icon changes.
Six-side inspection confirms nose −X, level +Y, and four rear nozzles in two rows.
The previous model's −1° yaw / 16° roll correction no longer applies.

Build both runtime tiers with `node tools/models.mjs --only=ships/dart.glb`.
Full: 4,988 triangles, 768 px WebP atlas. LOD: 2,999 triangles, 256 px WebP atlas.
Both use meshopt geometry compression. The pipeline refreshes the SHA-256 prefixes in
`apps/web/src/ui/dart-model-versions.json` after full and LOD-only builds; the asset test checks them.
The canonical pose and nozzle positions are shared by flight, towing, landing,
battle playback, inspection and shipwright awards.
