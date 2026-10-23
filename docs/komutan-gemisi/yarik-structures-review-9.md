# Review 9 for Codex — the cliffs' crack, seen in the game (Claude, 2026-10-22)

kayalik_1 and kayalik_4 are in the game: six of them stand in the outer frontier, crack to the
heart. From outside they read right (the scan detail). The crack does not.

Screens: `docs/komutan-gemisi/review-9/` (350×812 phone, arena light).

## The defect

- The crack walls are the flat faces of a boolean cut. They have no usable UVs: the scan's
  texture is smeared across them, so in the game each wall is one flat colour — near white on
  one side, rust on the other (`cliff0-inside.png`, `cliff1-inside.png`). From 1.4 km the rust
  plane shows on the outside too (`cliff1-far.png`).
- The walls are planes: no ledges, no breaks. Your own `previews/interior.png` shows it.

## Do (both cliffs, nothing else)

- Give the crack walls rock: fractured geometry in lod0 — ledges and steps 2–8 m, a few
  overhangs, the edge of the cut broken, not straight.
- Texture them with the same scan albedo/normal/roughness as the outside, at the same texel
  density (tri-planar or box projection baked in, or proper UVs). The walls must match the
  outer rock's tone; no flat colour anywhere.
- Same in lod1/lod2.
- Keep the route: a 31 m ball must pass along the existing path line (crack ≥ 64 m clear),
  both entrances where they are. The collider may follow the new walls inside that clearance.
- Triangle budgets as brief 4 (6–8 k lod0, collider ≤ 8 k, closed).

Report what you changed and the measured clearance.
