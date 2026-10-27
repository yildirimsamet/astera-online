# Review 2 of the Rift structures (Claude, 2026-10-22)

Review 1's rules are met where checked; keep the validation as it is. This round is about the
**look**: each asset must read as premium at ship eye height and at 1 km, under the game's
lighting (a key light from the sky's bright side, dark fill, fog, bloom on emissive).

## İskele (v2 seen: exterior_34, deck_eye, support_eye, exterior_entrance)

Good: the H is gone; 24-segment ring, chevrons, centre dot, amber edge dashes, beacon at 58 m,
truss, tanks and floodlights are there. The collider is clean (0.32 m max).

Change:
1. **The glyph is pixelated** (deck_eye): a 1024 map stretched over 106 m is ~10 cm a pixel, so
   the strokes are stair-stepped at eye height. Model the ring segments, chevrons, centre dot and
   edge dashes as **thin inset geometry strips** (2–4 cm proud, emissive material slot or a
   small emissive atlas region) so they stay crisp at any distance. A few hundred triangles.
2. **The deck reads as plain grey plastic.** Use a darker gunmetal base (albedo ≈ 0.18–0.25),
   panel plates with real seams in the normal map, worn paint on the plate edges and around the
   tie-downs, tyre-like scorch marks from landings near the circle, roughness variation
   (polished where ships land, rough at the rim). Detail density so the deck is not empty at
   ship eye height: tie-down points, grates, small hatches, numbered markings ("İ-1", "İ-2",
   "İ-3" stencils for the three docks would be welcome as three texture variants or decals).
3. **The beacon mast is a square post.** Make it a tapered lattice mast (triangular section,
   X-bracing, ≥ 1.5 m members) with a lens housing at the top: an emissive teal lens and two small
   red obstruction lights halfway up. It is what a pilot looks for from 1 km.
4. **The underside reads as boards.** Truss members as real lattice (chords + diagonals), pipes
   running from the tanks to the deck, tank end caps and straps, the thruster block with nozzles
   and heat-darkened rims. The floodlights should be visible lamp housings.
5. Keep the deck circle clear, keep `lod0` ≤ 15 k, collider rules unchanged.

## Kovuk (v2 seen: all six previews + validation)

Good: the route network is right (4 mouths incl. the vertical one, grotto + collapsed hall with a
pillar, three levels 200 m apart, loops, LOS numbers, 62 m minimum), the collider is clean and
in the game it already plays. Keep the collider and the routes **exactly**; this round is look.

1. **Silhouette: it is a ball.** From 1 km (exterior_34) it reads as a round potato covered in
   crumpled foil. Break the outline: an elongated, lopsided body (≈ 1 : 0.7 : 0.6), one big
   flat fracture face, a ridge spine, two or three large boulders fused on, a deep impact crater
   with a raised rim. The outline must not be convex anywhere near a sphere.
2. **Surface: crumpled foil.** The fracture microfacets are all the same size and lit the same
   way. Use three scales: large planar fracture faces (10–60 m) with sharp edges, medium
   blocky strata steps, fine grit only in the normal map. Dusty regolith collects in crater
   floors and on upward faces (lighter, warmer); ridges darker and glassier.
3. **Mouths are square holes** (exterior_entrance). Make every mouth an irregular, flared
   opening inside a crater or a fracture, with an overhang and fallen blocks at its lip.
   Keep the collider's clear diameter.
4. **Interior:** the grotto should glow faintly from its crystal veins (teal emissive veins
   running from each deposit point into the rock, ≤ 0.5 m proud so they stay in the collider
   tolerance); the collapsed hall needs one strong light shaft and dust in it. Right now both
   rooms are flat grey.
5. **Size on the wire:** the render GLB is 4.4 MB after WebP; 2048 base + normal is fine, but
   keep ORM and emissive at 1024 and let the detail come from the normal map.

## Sessiz Liman (v2 seen: all six previews + validation)

Good: three ways in, atrium loop, bypass, two heights, 71 m minimum, clean collider, hangar
reads from outside. Keep the collider and the routes.

1. **It reads as clean boxes and a cylinder**, not an abandoned station. The breaches are not
   visible from outside: tear them open — jagged plate edges bent outwards, exposed ribs
   (≥ 3 m), hanging cables, a missing section of the outer ring.
2. **Texture is a tiled grid** with blurry stains (inside_chamber). Replace with hull panels of
   different sizes, panel lines and bolts in the normal map, worn paint, scorch around the
   breaches, a faded stencilled name "SESSİZ LİMAN" and a number on the hangar lip.
3. **Greebles and silhouette:** antenna array (broken), a snapped solar wing stub, radiator
   fins, pipes along the corridors, docking clamps at the hangar. From 1 km the outline should
   be busy, not a box.
4. **Light:** amber emergency lights in rows along the corridor floors and the atrium (they
   are the way markers in the dark), dead teal strips, the hangar floodlit. In the game the
   station is almost black from outside: give it a few exterior lights (window strips,
   running lights) so it reads from 2 km.
