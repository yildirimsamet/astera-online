# Brief 3 for Codex — two more rock caves (Claude, 2026-10-22)

Same pipeline, MCP and deliverables as brief 2, with review 3 §0 (the collider is yours to shape
outside the routes). Start after review 3.

## Why

The owner's item 8, in full: "Yarık haritasinin tasarimi (komple tüm alan) çok önemli, rastgele
yapılmamalı. Akıllıca planlanmalı. Magara gibi kayalardan olusmus icinde birden farkli path olan
yapilar olmali. Gemiler icine girip izini kaybettirebilmeli. Yine içine girilebilen içinde farkli
yollar olan terk edilmis uzay binalari vs olmali."

Caves, plural. Today the Rift has one (Kovuk). These two must **play differently** from it and
from each other, so that choosing where to flee is a decision:

| | Kovuk (have) | Yarık Kanyonu (new) | Petek (new) |
|---|---|---|---|
| Shape | one big hollow rock, 2 rooms, 3 levels | a long winding fissure through fused giant rocks, open to the sky in places | a honeycomb rock: many small cells, many short links |
| Chase | long tunnels, a loop, a vertical shaft | in and out: dive into the crack, pop out the top, drop back in | a maze: every 100 m a choice of 2–3 ways |
| Farm | crystal grotto | crystal on the canyon walls | little ore: a hiding place, not a mine |

Rock look as in review 3 for Kovuk: fractured basalt, large planar faces with sharp edges, strata
steps, dust in hollows, dark glassy ridges; never a ball, never foil.

## 1. Yarık Kanyonu (`yarik_kanyonu`) — in the heart of Kristal Kuşağı

- Five to seven giant rocks (150–300 m each) fused into one ~750 × 400 × 300 m mass.
- A fissure winds through it end to end: 70–100 m wide, 150–250 m deep, **open to the sky over
  about half its length**, roofed over by rock arches and fallen slabs elsewhere (≥ 3 roofed
  stretches 80–200 m long). Bends ≥ 60 m radius.
- One side branch that leaves the fissure and rejoins it further on, out of line of sight.
- ≥ 4 ways in: both ends, and ≥ 2 from above (where the fissure is open).
- Crystal deposit empties on the fissure walls (≥ 6, `deposit_N`, normal out of the wall).
- Main end faces glTF +Z (toward the heart).
- collider ≤ 16 k; lod0 ≤ 40 k.

## 2. Petek (`petek`) — a honeycomb rock

- ~520 m lopsided rock, pitted with craters; inside, **8–10 cells** (90–130 m) joined by
  **≥ 14 short passages** (60–75 m clear, 40–120 m long). Cells on **three levels**.
- Route graph cycle rank ≥ 5; from every cell ≥ 2 ways on. Line of sight between two cells is
  broken by ≥ 1 bend (measure: no two cell centres see each other).
- ≥ 5 mouths on ≥ 3 sides (one up, one down).
- Faint light: a few cracks to the outside per cell (< 6 m), so a cell is never pitch black.
- Two `deposit_N` only. Main mouth faces glTF +Z.
- collider ≤ 16 k; lod0 ≤ 40 k.

## Deliverables

As brief 2: `<name>.glb` (collider, lod0/1/2, empties), `<name>.json` (entrances, deposits,
paths through every route), `validation.json` (closed, single, no self-intersections, route
clearance min and p5, two-way distance, cycle rank, the line-of-sight numbers), previews (1 km,
300 m, two interiors), `provenance.json`. Blender ≤ 2.5 GB, purge after heavy steps, save after
each asset. Report every rule not met.
