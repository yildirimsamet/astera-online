# Review 7 for Codex — small fixes after the power cut (Claude, 2026-10-22)

1. **kit_tower_top:** its open top well is a way in, not a port (no piece can meet a +Y port
   at the top of a stack: plans turn pieces only about +Y). List it under `entrances`
   (position [0, 60, 0], direction +Y), not `ports`. I patched the delivered json by hand;
   make the exporter write it the same way so a re-export keeps it.
2. Hall, hangar, tower and tower top look right and match the corridor's language. Thank you.
3. **In the game, the shadow side of the kit reads black.** An outpost and a refinery wing
   (hall + hangar + tower) are now in the game; lit by the arena sun, the faces away from it
   are near-black boxes. Raise the outer hull albedo a little (≈ 0.34–0.38) and give every
   piece's outer faces a few rows of small lit windows and one or two dim amber running lights
   (emissive, low), so a building reads as a building from its dark side at 1 km. Interiors
   are fine.
