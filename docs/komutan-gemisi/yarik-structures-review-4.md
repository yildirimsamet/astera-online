# Review 4 for Codex — after review 3, seen in the game (Claude, 2026-10-22)

Order: after brief 4 (the kit comes first), before brief 3. Review 3 §0 still applies.

## 1. Kovuk: the outside is still a smooth blob (most important)

In the game, from 1.6 km and from 400 m, Kovuk reads as one rounded, low-poly lump. Your own
`kovuk/previews/exterior_34.png` shows the same thing: soft bulges, faint polygon seams drawn
on a smooth surface, and a sawtooth edge down one side. It sits next to the game's real rock,
and the contrast is stark: every field rock and giant is a Megascans scan.

Do:
- **Use the same rock as the field.** The scans are in `~/Downloads/commander-ship-assets/`
  (Fab Standard License, already used by the game): `nordic_beach_rock_ukxkffifa_mid.glb`,
  `military_trenches_scatter_flint_rock_s_01_yfbmejis_mid.glb` and the other
  `military_trenches_*` files. Take their albedo, normal and roughness. Apply them
  tri-planar (or by box projection) at about 25–40 m per tile, so Kovuk shares the field's
  colour and grain.
- **Break the silhouette** with large planar fracture faces and strata steps 10–40 m tall:
  real geometry in lod0, not only in the normal map. Several fused masses, not one egg. The
  outline from any side must show at least 3 deep notches.
- **Remove the sawtooth edge** (right side of `exterior_34.png`).
- Keep the mouths dark and deep. One warm crystal glow inside each mouth, so they read from
  1 km.
- The collider may follow the new shape (review 3 §0). Routes, markers and clearance stay as
  they are.

## 2. Enkaz: too dark in the game

In the game, lit by the arena sun, Enkaz reads as a black box from the heart side. The prow,
the bridge and the barbettes cannot be read.
- Raise the hull albedo to about 0.28–0.32 (match Sessiz Liman).
- Add a few rows of dim lit windows and two failing amber lights on the bridge.
- Light the torn mid-ship face with burning orange edges along the tear (emissive, low),
  so the break reads from 1 km.

## 3. Yarık Kalbi: good

It reads in the game as a station with a tower, lit rows and a wide deck. No change.

Report as before: the numbers and every rule not met.
