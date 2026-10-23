# Brief 2 for Codex — Yarık Kalbi and Enkaz (Claude, 2026-10-22)

Same pipeline, same Blender MCP, same hard rules as `yarik-structures-brief.md`, **as changed
by `yarik-structures-review-1.md` §0** (a separate closed `collider` node; render `lod0/1/2`
within 0.75 m of it both ways). Start this only after review 1 is done.

## Why

Today the heart and the wreck are a few invisible boxes with an older reference model drawn
over them. The model sticks out of the boxes, so ships fly **through** parts of it and can sit
inside it — exactly the bug the owner reported ("bu gemilerin içinden geçebiliyorum, içinde
beklenedebiliyor"). Each becomes one original closed asset whose collider is what the game hits.

## 1. Yarık Kalbi (`yarik_kalbi`) — the central station, a landmark seen from everywhere

- Placed at the arena centre, the busiest and most exposed place: open farming all around it.
- ~320 m across, ~260 m tall. A derelict relay station: a wide octagonal disc (~40 m thick)
  pierced by a tall spire, a broken antenna crown on top, docking arms with ledges.
- **Readable from 3 km**: a strong silhouette and a few warm amber lights; dead teal strips.
- Enterable, but simple: **one straight fly-through tunnel** across the disc (70–90 m clear,
  both mouths flared, lit inside) and **an open gallery ring** under the disc's rim that a ship
  can circle through. These are places to break line of sight for a moment, not a maze.
- Landing ledges: 3–4 flat pads (≥ 40 m, normal +Y) on the docking arms. Empties `pad_N`.
- `collider` ≤ 12 k triangles; `lod0` ≤ 30 k.

## 2. Enkaz (`enkaz`) — a capital ship broken in two

- ~440 m long derelict warship, snapped mid-ship: bow and stern drift ~100 m apart, slightly
  turned to each other, with a twisted spine girder still bridging them **above** the gap.
- The gap under the spine is the obvious way through (≥ 90 m clear).
- **One breached corridor through the stern**: in by the torn mid-ship face, out through a hull
  breach on the side (60–90 m clear, bends ≥ 60 m radius). A second short route: under the
  bow's keel through a collapsed hangar. ≥ 3 entrances on ≥ 2 sides.
- Look: dark hull plating, exposed ribs ≥ 3 m thick, scorch, dead running lights, a few
  flickering amber emergency lights inside. Not the old reference ship: an original design.
- `collider` ≤ 12 k triangles; `lod0` ≤ 30 k.

## Deliverables (each asset)

`assets/source/yarik/<name>/<name>.glb` (nodes `collider`, `lod0`, `lod1`, `lod2`, empties),
`<name>.json` (entrances, pads, paths — centrelines through every route, same format as Kovuk),
`validation.json` (closed, single, no self-intersections, route clearance min and p5, two-way
distance max and p99), previews (outside from 1 km and 300 m, one interior view, well lit),
`provenance.json`. Main entrance faces glTF +Z. Keep Blender under 2 GB, purge after heavy
steps, save after each asset. Report every rule not met.
