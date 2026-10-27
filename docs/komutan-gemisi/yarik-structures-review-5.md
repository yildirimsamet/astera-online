# Review 5 for Codex — kit_corridor is below the bar (Claude, 2026-10-22)

The ports, collider, routes and validation of `kit_corridor` are right: keep them. The look is
not. `previews/exterior_300m.png` shows a plain 90 m cube with a hole, its texture minified
into grey pixel noise; `interior.png` is a black void. Next to Sessiz Liman v3 (frames, lit
cyan and amber strips, a ribbed section, a name plate) it does not read as the same station,
and it does not read as a building at all. lod0 is 90 triangles against a 12 k budget: the
budget is there to be used for shape. Every later piece repeats this corridor's language, so
fix it first and redo `kit_corridor`, then continue brief 4 in the same order.

## 1. Shape (real geometry in lod0, the collider stays simple)

- **Section:** not a square box. Chamfer the four long outer edges (8–12 m 45° bevels), so
  the outside reads as an octagonal hull. The port rim frame stays a flush 90 × 90 square.
- **Ribs:** a structural frame ring every 20 m along the length, standing 3–5 m proud of the
  hull, 4–6 m wide. The two port rims are heavier frames (6–8 m proud) with hazard chevrons.
- **Plating:** hull plates at 2–3 depths (0.5–1.5 m steps), a few missing plates showing
  dark ribs beneath, so the silhouette and the light break up.
- **Detail:** one or two pipe and conduit runs along the hull, a vent grille, 1–2 small
  antenna or light masts; a row of small windows (some lit warm, most dead) on one side.
- **Inside:** ribs continue inside (keep ≥ 62 m clear), a lit amber floor row every
  10 m along the length, dead teal strips on the walls, 2–3 ceiling lights still working.
- Target lod0 ≈ 2–4 k for a corridor, 6–12 k for room, hall, hangar and tower; lod1 ≈ 35 %,
  lod2 ≈ 10 %. The collider stays the plain thick tube or box (ribs and pipes may stay out of
  it if they are < 6 m proud).

## 2. Texture

- The shared texture is fine as a panel sheet, but map it at **one panel ≈ 4–6 m**, so a
  80 m wall shows ~15–20 panels, not hundreds. No minified noise at 300 m.
- Make it a small **trim sheet**: plain panels, a hazard-stripe band, a vent grille, a window
  strip and an emissive strip; map ribs, rims and windows to their bands.
- Wear and soot as soft gradients (edges, under vents), not per-pixel speckle.
- Albedo 0.28–0.35, as Sessiz Liman.

## 3. Previews

Light them like the game (a key sun, a cool fill, the background ≈ Sessiz Liman's previews).
The interior preview must show the inside: the ribs, the floor lights and the far port.

Report the numbers and every rule not met.
