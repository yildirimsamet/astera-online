# Review 1 of the Rift structures (Claude, 2026-10-22)

The validation work is solid: all three are closed, single, self-intersection-free, and the
tunnels clear 64–76 m with bends ≥ 70 m. Keep that pipeline. **The look is not yet premium,
and the route design is too symmetric for a chase game.** Rebuild the parts below; the hard
rules of `yarik-structures-brief.md` still apply unless changed here.

## 0. One rule change: render mesh and collider may differ (all three assets)

The voxel remesh is what melts the hard-surface edges and leaves the stair-step bands visible
on Kovuk's clay render. From now on:

- Node **`collider`**: the closed 2-manifold the game collides with (all of brief rule 2),
  ≤ 12 k triangles (Kovuk ≤ 16 k). Routes are measured against this node.
- Nodes **`lod0/lod1/lod2`**: render meshes. They may be non-manifold kitbash, bevelled and
  detailed, but must follow the collider: **two-way distance between `lod0` and `collider`
  ≤ 0.75 m** (sample ≥ 50 k points on each, report max and p99 in `validation.json`).
  Nothing may stick into a flyable route more than 0.75 m past the collider, and the collider
  may not block where `lod0` shows open space.
- Hard surface (İskele, Liman): build from clean primitives with **exact booleans + bevels**,
  not voxel remesh. Rock (Kovuk): remesh is fine for the collider, but the render mesh needs
  real detail (below).

## 1. Kovuk — needs a real cave and a route network you can lose someone in

Look:
- Today it reads as a soft potato with a blurred mottled texture, and the tunnels read as
  smooth pipes. Target: a fractured basalt asteroid — sharp ridges, terraced strata, crater
  rims with ejecta, fracture lines; dusty lighter regolith collecting in hollows and crater
  floors, dark glassy rock on ridges. High-frequency detail in the normal map; no blur.
- Tunnel walls: ridged/Voronoi-crackle displacement, cross-section varies ±20 % and is not
  round (flattened, slanted, with ledges and fallen blocks that keep 60 m clear).
- Mouths: irregular, flared, with an overhang, set inside a crater or a fracture — not a
  drilled circular hole.
- 2–4 light shafts (< 8 m cracks) into the chambers; render one interior view with a shaft.

Routes (most important):
- No perfect ring with 120° spokes: a pursuer can read that shape.
- **4 entrances**, one of them on the top or bottom face (a vertical way in).
- **Two distinct chambers** 180–220 m: a "crystal grotto" (the deposit empties go here) and a
  "collapsed hall" with 1–2 thick rock pillars to circle around.
- Passages on **at least two levels** (≥ 80 m apart vertically), **≥ 2 loops**, and at least
  one fork whose two branches rejoin **out of line of sight of each other** (≥ 60° of turn on
  each branch before they rejoin).
- Measure and report: for each fork, the travel distance after which the two branches no
  longer see each other (target ≤ 150 m).

## 2. İskele — an operational landing dock, readable from 1 km

- **Remove the "H"**: that is an Earth helipad. Use a sci-fi landing glyph: a segmented teal
  ring (24 segments), four inward chevrons, a centre dot, a thin outer hazard ring of amber
  dashes at the deck edge.
- Deck: keep ~106 m, but give it thickness and layering — bevelled rim with an inset light
  strip, panel seams, tie-down points, worn paint; one material atlas.
- Underside: a real support structure — a thick truss lattice (members ≥ 3 m), two or three
  fuel tanks, a thruster block, under-deck floodlights pointing down.
- **Beacon mast** 50–60 m tall at the deck edge with an emissive beacon at the top (the thing a
  pilot sees from 1 km). No other tall objects on the deck; the 60 m circle stays clear.
- Budget: `lod0` up to 15 k is fine; bevels are worth the triangles.

## 3. Sessiz Liman — an abandoned station, not a melted toy

Look:
- Sharp bevelled hard surface, panel lines in the normal map, greebles; currently every edge
  is melted and the clay shows wrinkles.
- Abandoned: two **hull breaches** with torn plates and exposed girder ribs (≥ 3 m thick),
  missing panels, scorch marks, a broken antenna array, a snapped solar-wing stub.
- The **hangar bay** must read from outside: a large rectangular maw ≥ 120 × 80 m with interior
  floodlights and floor markings, a landing pad inside.
- Fix the texture stretching on curved walls and floors (white smears in the interior views).
- Dim amber emergency lights, dead teal strips; keep the interior readable at ship eye height.

Routes:
- Not the Y shape (it is the same plan as Kovuk). Hangar → atrium ring room → two corridors at
  **different heights** → the two breaches; a loop around the atrium plus one bypass corridor
  that skips it. ≥ 3 entrances on ≥ 2 sides, as in the brief.

## Deliverables

Same files as the brief, plus the `collider` node, the two-way distance numbers, and the
line-of-sight numbers for Kovuk. Render the previews with enough light to judge the materials
(a key light plus a low fill; the current interiors are too dark to review). Keep Blender
under 2 GB, purge after heavy steps, save after each asset. Report every rule not met.
