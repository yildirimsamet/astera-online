# Credits

Third-party work used in Astera Online, with what was changed. The in-game list is in the
Battle Zone menu (`apps/web/src/arena/credits.tsx`).

## Ship models (Battle Zone class ships)

All three are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
`tools/arena-ships.mjs` builds them for the game: decimated into three levels of detail,
textures recompressed to KTX2, geometry compressed. Spaceship Concept's detail was also
baked into new maps.

| Class | Model | Author | Source |
|---|---|---|---|
| Akıncı | Space Fighter | Comrade1280 | https://sketchfab.com/3d-models/space-fighter-e766136d4871441289d37d44a4bbcd3b |
| Muhafız | Spaceship Concept | marum3s | https://sketchfab.com/3d-models/spaceship-concept-406349eef4814e60997b691dd71fb87a |
| Kılavuz | SpaceShip | JazOone | https://sketchfab.com/3d-models/spaceship-6164a883f57f4f13938c3c5999bc0e1f |

## Effect textures (galaxy)

From the owner's asset library, as recorded there (`packs.json`, licence confirmed by the owner on
2026-11-12). Each file was resized and recompressed to WebP; nothing else was changed.

| File (`apps/web/public/assets/vfx/library/`) | Used for | Source file | Pack | Author | Licence |
|---|---|---|---|---|---|
| `sck-smoke-8x8.webp` | Death Star strike: the mushroom cloud; mining dig: the dust off the cut; wrecked colony ship: the smoke columns | `explosionsmokeanimated.png` | Space Combat Kit (v2.8.1) | VSX Games | VSX Games (Unity Asset Store) |
| `white-shock-4x4.webp` | Death Star strike: the condensation disc | `whiteshockwave01-4x4.png` | Unique AoE Magic Abilities Vol.1 (v1.6.1) | Gabriel Aguiar Productions | Gabriel Aguiar (Unity Asset Store) |
| `flare-star.webp` | Death Star strike: the flash | `flare01.png` | Unique Projectiles Vol.1 (v1.8.1) | Gabriel Aguiar Productions | Gabriel Aguiar (Unity Asset Store) |
| `electric-line-4x4.webp` | EMP storm: arcs crawling over the world | `electricline01-4x4.png` | Unique AoE Magic Abilities Vol.1 (v1.6.1) | Gabriel Aguiar Productions | Gabriel Aguiar (Unity Asset Store) |
| `lightning-5x5.webp` | EMP storm: bolts leaping off the limb | `lightning03-5x5.png` | Unique AoE Magic Abilities Vol.1 (v1.6.1) | Gabriel Aguiar Productions | Gabriel Aguiar (Unity Asset Store) |
| `sck-exhaust-halo.webp` | Mining dig: the cut's glow on the face and the lit hold; wrecked colony ship: the glow of its fires | `exhaust-halo.png` | Space Combat Kit (v2.8.1) | VSX Games | VSX Games (Unity Asset Store) |
| `flame-3-6x6.webp` | Wrecked colony ship: the flames over its bays | `flame-style-3.png` | Realistic Fire VFX (v3.5) | Luke Peek | Luke Peek (Unity Asset Store) |
