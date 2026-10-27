# Review 3 of the Rift structures (Claude, 2026-10-22)

Review 2 landed and is in the game: the İskele glyph is crisp geometry and reads very well from
the cockpit; the Liman hangar, its floor markings and the "SESSİZ LİMAN" stencil read from
outside. Validation, hashes and the unchanged-collider proof were exactly right.

The rules you reported unmet were blocked by **my** rule ("keep every collider exactly"), not by
your work. This review relaxes it.

## 0. Rule change: the collider may grow outside the routes

The collider exists so that what a pilot sees is what a pilot hits. It may now change, under
these conditions (all reported in `validation.json`):

1. **Fixed:** every entrance, deposit, pad and deck empty, `<name>.json` paths, the main
   entrance on +Z. Route clearance must not get worse: minimum clear diameter along every path
   ≥ the review-2 number (İskele has none; Liman 71.27 m; Kovuk its own), and 40 m in front of
   every mouth stays open.
2. Closed, single, no self-intersections, budgets as before (≤ 12 k; Kovuk ≤ 16 k).
3. **lod0 → collider ≤ 0.75 m everywhere** (nothing you can see is something you fly through).
4. **collider → lod0 ≤ 0.75 m, except across gaps smaller than a ship** (≤ 10 m: between the
   members of a lattice, between ribs, under a cable). There the collider may close the gap
   with a flat envelope. Report the largest such gap and where.
5. Thin render-only details are allowed only below 1.5 m thickness and only where no ship can
   reach them (inside a lattice envelope, flush on a wall).

## İskele

Seen in the game (cockpit on the deck, and from 400 m): it works. Remaining:

1. **Mast:** now possible under §0.4. A tapered triangular lattice (three ≥ 1.5 m chords,
   X-bracing), the teal lens housing on top, two red obstruction lights halfway. Collider: the
   triangular prism enclosing it.
2. **Stencils and scorch are pixel noise** at eye height (deck_eye: the "İ-…" marks and the
   landing scorch arcs are blocky smears). Make the dock numbers inset geometry like the glyph,
   or a crisp ≥ 4 px/cm decal region; scorch as a soft radial gradient, not a dithered stripe.
3. **Underside:** an open truss (chords + diagonals) under §0.4, pipes from the tanks to the
   deck, nozzles with heat-darkened rims.

## Sessiz Liman

Seen in the game from 800 m against the sky: the hangar and the strip lights read; **the body is
a black silhouette**. Remaining:

1. **Albedo too dark for the game's light.** Raise the hull base to ≈ 0.28–0.35 (it is lit by a
   single key from the sky's bright side, a dim fill and an environment map; anything at 0.1
   goes black). Keep contrast in roughness and panel tone, not in darkness.
2. **The scorch decals read as cartoon saw-teeth** (exterior_entrance, inside_chamber: big
   dark shapes with regular zig-zag edges over the cylinder and the column). Replace with soft
   soot gradients concentrated round the breaches and the hangar lip, irregular, low contrast.
3. **Breaches and silhouette under §0:** jagged plates bent outwards at both breaches, exposed
   ribs, a missing outer-ring section, a broken antenna array, a snapped solar-wing stub,
   radiator fins. The 1–2 km outline must read as a wreck, not boxes.
4. More exterior light: two rows of lit windows on the cylinder, running lights at the corners
   of each wing, so the station reads from 2 km.

## Kovuk

Good: the foil facets are gone; the collapsed hall with its pillar and the light shaft
(interior_bend) is the best interior so far. Remaining, all needing §0:

1. **Still a ball from 1 km** (exterior_34). Grow the collider and the render outward:
   elongated lopsided body (≈ 1 : 0.7 : 0.6), one big flat fracture face, a ridge spine, two or
   three fused boulders (40–90 m), an impact crater with a raised rim. The outline must not be
   near-spherical from any side.
2. Mouths stay on their markers: where the body grows past a mouth, carve a flared crater or
   fracture down to it (the 40 m in front stays open; the opening may only get wider).
3. Large planar fracture faces with sharp edges and blocky strata steps on the exterior (medium
   scale, in geometry); the fine grit stays in the normal map.
4. Crystal veins: the grotto deposits should glow teal on the wall in the render, not only in
   the Blender preview lights (emissive in the exported material).

## Yarık Kalbi (brief 2, first delivery)

Good: octagonal disc, tapered spire, crown, four numbered pads, the name, the gallery between
the two decks, the 80 m way through. It reads as a station from 1 km. Remaining:

1. **Too plain for the landmark everyone sees.** Bevel every edge; break the disc rim into
   layered armour segments, add radiator fins, docking arms with lights under the pads, pipes
   and hatches on the deck, antenna dishes. Medium-scale detail density like a real station.
2. **Light that reads from 3 km:** amber is right, but add a warm beacon at the crown, lit
   windows rows on the spire, and floodlights on the pads. Today it is dark grey on black.
3. The lower deck's underside is a flat plate: give it structure (ribs, tanks, the hub's
   machinery).

## Enkaz (brief 2, first delivery)

Good: two halves, the bent spine above the gap (93.85 m under it), the two inner passages,
69 m minimum. Remaining:

1. **It does not read as a warship** — two faceted blocks. Give it a ship's silhouette: a
   long tapered prow with an armoured keel, a superstructure / bridge tower, turret barbettes
   (empty or with a broken turret), an engine bank of 3–5 large nozzles at the stern, layered
   armour plates along the flanks. Size of a capital ship: every detail must say "huge".
2. **Torn faces:** at the snapped mid-ship, exposed ribs ≥ 3 m, deck levels visible in
   cross-section, bent plates; ash-black scorch round them.
3. **Interior is an empty grey box** (interior.png). Ribs every 15–20 m along the corridor,
   pipes and cable bundles on the walls, collapsed bulkheads to fly round (keep 60 m clear),
   amber emergency lights in the exported emissive (they mark the way), dead teal strips.
4. Dead running lights along the hull and one or two still-lit amber ones, so it reads at 2 km.

## Order

1. Enkaz and Yarık Kalbi (they replace boxes in the game, the owner's fly-through bug).
2. Kovuk silhouette (§0 lets it finally stop being a ball).
3. Sessiz Liman, then İskele.

Save the .blend and re-export after each asset, so each can go into the game on its own.
