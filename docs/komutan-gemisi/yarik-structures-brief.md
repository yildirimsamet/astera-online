# Brief for Codex — Rift (Yarık) enterable structures, v1 (2026-10-22)

Owner approved (2026-10-22): Codex builds these in Blender **through the Blender MCP**
(Blender 5.2.2 is open, MCP server on 127.0.0.1:9876). Claude reviews the renders and the
validation report and sends change requests. Design context: `docs/komutan-gemisi/15-yarik-haritasi.md`.

Astera Online is a premium mobile-first space game: a real-time pilot arena ("the Rift") where
15 m ships farm ore, chase and escape. These three structures replace flat box buildings that
players found ugly and buggy (you could fly *inside* models with no collision). The owner wants:
cave-like rock formations **with several paths inside** where a chased ship can **lose its
pursuer**, and **enterable abandoned space buildings** with different routes inside.

## Hard rules (all three assets)

1. **Real scale, metres.** 1 Blender unit = 1 m. glTF export Y-up (default). The main entrance
   faces glTF **+Z** (Blender −Y). Origin at the structure's centre.
2. **`lod0` is also the collision mesh.** The game collides ships against exactly these
   triangles. Therefore `lod0` must be:
   - one closed 2-manifold (no holes, no non-manifold edges, no loose parts, no internal faces),
   - consistently wound with normals pointing **out of the solid** (into open space / tunnels),
   - free of self-intersections and zero-area triangles.
   Every space a ship can enter is a designed opening. There is no "inside of the model".
3. **Ship scale.** Ships are ~15 m long, collide as a ~6 m radius capsule, turn on a ~58 m radius
   at 80 m/s and ~96 m at full speed (120 m/s).
   - Tunnels / corridors: clear diameter **60–90 m** everywhere along the route.
   - Bends: centreline radius **≥ 60 m**.
   - Chambers / rooms: **150–250 m**.
   - No dead-end pocket narrower than 60 m (a ship must be able to turn around or leave).
4. **Routes.** At least **3 entrances**, at least two of them on clearly different sides (> 90°
   apart). Between any two entrances **≥ 2 distinct routes**; the network contains **at least
   one loop**. A pursuer must not be able to tell which way you went.
5. **Budgets (mobile).** `lod0` ≤ 30 k triangles (Liman ≤ 40 k, İskele ≤ 15 k); `lod1` ≈ 35 %,
   `lod2` ≈ 12 % of `lod0` (render-only, may be simplified freely). One material per asset if at
   all possible (texture atlas). Maps ≤ 2048²: base colour, normal, ORM (occlusion-roughness-metal),
   emissive if needed. Detail comes from the normal map, not from triangles.
6. **Look.** Premium, "a live NASA photograph you can fly through": physically lit PBR, no
   cartoon colours, no flat untextured faces, no visible tiling. Readable silhouettes from 1 km.
7. **Do not touch anything else in the repo.** Write only under `assets/source/yarik/`,
   `tools/yarik-blender.py` and `docs/yarik-structures.md`. No git commits. Keep Blender memory
   under ~3 GB (moderate remesh voxel sizes). Do not run the project's test suites.

## Assets, in order

### 1. Kovuk — a hollowed asteroid cave complex
- Overall ~700 m, irregular, believable rock body (impact craters, fractures, ridges), dark
  basalt grey-brown, slightly desaturated; must sit well beside photogrammetry rocks.
- Inside: a tunnel network meeting all rules above, with **two chambers**. Tunnel walls are rough
  rock, not smooth pipes; vary the cross-section. Some light shafts (thin cracks to the outside
  that are too narrow to fly through, < 8 m) are welcome: they read beautifully in space.
- Empties: `entrance_N` at each mouth centre, local **+Z pointing out of the mouth**;
  `deposit_N` (6–10) on chamber walls, +Z along the wall's outward normal, where glowing ore veins
  will be placed by the game.

### 2. İskele — exit dock (an operational landing platform, not abandoned)
- A flat landing deck ~100 m across on top of a compact support structure (trusses, tanks,
  antenna, a beacon mast to one side). Industrial sci-fi, gunmetal with worn paint; accent
  emissive colour teal `#2ee6c8`.
- On the deck: an emissive landing circle ~60 m across with inward chevrons. It must read as
  **"land / stop here"**. **No ring, arch, gate or portal shape anywhere** — those read as "fly
  through", which is wrong for this mechanic.
- Single solid (rules 1–2 apply; no tunnels needed). Empty `deck` at the landing circle centre on
  the deck surface, +Y up.

### 3. Sessiz Liman — an abandoned station you can fly through
- Overall 500–700 m. Built from modular parts: an open **hangar bay** (mouth ≥ 120 × 80 m),
  wide corridors (rule 3), junctions, a central ring room / atrium ~200 m, and **hull breaches**
  as extra entrances. Satisfies rule 4.
- Abandoned: dark gunmetal panels, scorch marks, missing panels exposing girders (girders are
  part of the closed surface or thick enough to be solid; nothing thinner than 3 m), dim amber
  emergency lights and dead teal `#2ee6c8` strips in the emissive map.
- Empties: `entrance_N` (+Z out), `pad_N` (2–4 flat landing spots inside, +Y up).

## Deliverables per asset (`assets/source/yarik/<name>/`)

- `<name>.glb`: nodes `lod0`, `lod1`, `lod2` and the empties above; textures embedded (PNG).
- `<name>.json`: entrances, deposits/pads/deck (positions + directions, glTF Y-up metres), and
  **route centrelines** as polylines (`paths: [[x,y,z], …][]`) — used to verify clearance and to
  draw the in-game map.
- `validation.json`: triangle counts per LOD, manifold/winding/self-intersection checks, minimum
  clearance measured along every centreline (sampled every ≤ 10 m, distance to `lod0`), minimum
  bend radius, entrance count, route/loop check, texture sizes.
- `previews/`: PNG renders, 1600 px: exterior ¾ view, exterior from the main entrance, two views
  **from inside** (chamber, a bend looking along the tunnel, at ship eye height), top orthographic
  with centrelines drawn, and a clay (no-texture) view showing the topology.
- One shared `.blend` (`assets/source/yarik/yarik-structures.blend`, one scene per asset) and the
  reproducible generator `tools/yarik-blender.py` (run through the MCP, `ASTERA_ROOT` global, like
  `tools/engine-flames-blender.py` in the main repo).
- `provenance.json` (original procedural work, Blender version, date) and a short
  `docs/yarik-structures.md` (what was built, measured numbers, known limits).

Finish asset 1 completely (with previews + validation) before starting asset 2. Report the
validation numbers honestly; a rule that is not met must be listed, not hidden.
