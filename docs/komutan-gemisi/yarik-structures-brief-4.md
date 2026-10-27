# Brief 4 for Codex — the modular station kit and three owner models (Claude, 2026-10-22)

Context: `16-yarik-v6-plani.md`. The Rift grows to 13 km for 30–50 pilots; the owner wants many
enterable buildings of different sizes with farming inside, built from a modular kit. Same
pipeline, MCP, previews and validation as briefs 2–3; review 3 §0 applies.

## 1. The kit (`kit_<piece>`, one asset folder each)

Visual language: Sessiz Liman v3 (gunmetal hull ≈ 0.3 albedo, panel seams and bolts in the
normal map, worn paint, soft soot, amber emergency rows on the floors, dead teal strips, a few
lit windows outside). Every piece must read as part of one abandoned station family.

**Grid and ports (hard):**
- Metres, glTF Y-up, piece origin on the 20 m grid. A **port** is a 70 × 70 m clear square
  opening on a grid face, centred on a grid point, facing ±X, ±Z or ±Y.
- Each piece lists its ports in `<name>.json`: `ports: [{ position, direction }]` (centre of
  the opening's plane, outward unit direction).
- At a port the wall ends flush in the port plane with a **10 m rim frame** (outer 90 × 90 m),
  so two pieces placed port to port meet face to face with no gap and no overlap.
- **Collider:** the wall itself is the solid: closed, single, ≥ 3 m thick everywhere; the
  inside space is outside the solid. A corridor is a thick-walled tube, a room a thick-walled
  box with holes at its ports. No caps across ports.
- Inside every route ≥ 62 m clear (the 70 m port minus trim); bends ≥ 60 m radius.
- `paths`: centrelines port to port through every way; `deposits`: wall points for ore veins
  (normal into the room); `cargo`: points in the open for loose ore clusters (≥ 40 m clear round).
- collider ≤ 3 k (corridors) / ≤ 6 k (rooms, hall, hangar); lod0 ≤ 12 k / ≤ 25 k.

| key | Piece | Size | Ports |
|---|---|---|---|
| `kit_corridor` | straight corridor | 80 m long | 2 (±Z) |
| `kit_bend` | 90° bend | inner radius ≥ 70 m | 2 |
| `kit_tee` | T junction | | 3 |
| `kit_cross` | four-way | | 4 |
| `kit_room` | small room | 120 m cube | 4 (±X, ±Z), the plan uses 2–4 and caps the rest with `kit_cap` |
| `kit_hall` | farm hall | 240 × 140 × 120 m (X × Y × Z) | 4 (two on each long side) + 1 up; 6 deposits, 3 cargo |
| `kit_hangar` | hangar | 160 m deep, 140 × 90 m maw | 1 port at the back + the maw (an entrance, not a port); pad inside |
| `kit_mouth` | entrance mouth | 60 m, flares from the port to 110 m | 1 port; the open end is the way in, lit |
| `kit_cap` | blank cap | | closes a port: a flush armoured plate, solid |
| `kit_tower` | tower segment | 80 m tall, 120 m wide | ±Y ports (stackable) + 1 side port; top variant `kit_tower_top` with a lantern |
| `kit_corridor_broken` | broken corridor | 80 m | 2 ports; the middle torn open to space (an extra way in) |
| `kit_room_collapsed` | collapsed room | 120 m | 2 ports; debris inside keeps a 62 m way |
| `kit_dressing_*` | antenna, solar-wing stub, radiator, tank cluster | solid, not enterable | mount on a 20 m grid face |

Previews: each piece alone (exterior 300 m, interior), and **one test assembly** (mouth →
corridor → tee → room + hall → hangar) to prove the ports meet without seams.

## 2. Three owner models (the owner bought / gave them; keep credits in provenance.json)

Source folder: `~/Downloads/commander-ship-assets/` (read only; copy what you need).

| key | Source | License | Do |
|---|---|---|---|
| `gangut` | `gangut_space_hub.glb` | CC-BY-4.0, Comrade1280 | ~450 m Tersane centrepiece. Retexture to the kit's palette, solid collider (the outer ring is a solid torus ≥ 8 m thick, spokes ≥ 4 m), enterable hub core with one 70 m way through if it fits. |
| `halka_harabe` | `space_station_3.glb` | CC-BY-4.0, re1monsen | ~400 m broken ring ruin for Enkaz Mezarlığı. Drop the loose particles; beams ≥ 1.5 m; gaps < 10 m closed in the collider (review 3 §0.4); the open ring interior is flyable. |
| `kayalik_1`, `kayalik_4` | `alaskan_cliff_rock_1_free.glb`, `_4_free.glb` | Fab Standard | 600–900 m cliff formations for the outer frontier. 6–8 k lod0, detail baked to normal; space-rock tone like the game's rocks; closed collider ≤ 8 k; one deep crack (60–80 m wide) through each, so a pilot can hide in it. |

Report every rule not met. Blender ≤ 2.5 GB, purge after heavy steps, save after each asset.
