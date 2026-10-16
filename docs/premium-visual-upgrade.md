# Premium visual and sound pass — 2026-10-11

This pass updates the existing playable game on `master`. It preserves combat, economy, ownership, research benefits, server timing and equipped cosmetic priority. The optional local reference pack is read from the command-ship worktree's `astera-refs` archive; that worktree and its original assets remain read-only.

## Review locally

The game runs at <http://localhost:5173/> with the API/worker at `:3100`. Vite serves the current source; a production bundle is not required to see these changes.

These development galleries use the real UI and galaxy renderer with sample data. They make no gameplay API writes:

- Space, hulls, wrecks, isotope rocks, combat, strategic impact, mining and sound samples: <http://localhost:5173/v2-gallery.html?view=premium-space&lng=tr>
- Base and production: <http://localhost:5173/v2-gallery.html?view=base-production&lng=tr>
- Research and project detail: <http://localhost:5173/v2-gallery.html?view=base-research&lng=tr>
- Independent music/effects controls: <http://localhost:5173/v2-gallery.html?view=menu&lng=tr>

The space gallery has replay buttons, all eight monument models in a selector, a lava-cosmetic switch, and the existing quality levels. Sound requires a real click/tap and enabled effects.

On the same local network, use <http://192.168.1.73:5173/> (the host address can change). Vite binds to `0.0.0.0`; `/api` stays on the same origin through its proxy.

## What changed

| Surface | Result | Implementation |
| --- | --- | --- |
| Base planet | Restored to the original static `PlanetSigil` image and original orbit spacing at the owner’s request; no portrait WebGL canvas | `ui/PlanetHero.tsx`, `ui/PlanetSigil.tsx` |
| Base and research sky | Original, detailed nebula plate with the existing sharp stars | `v2/kit/StarField.tsx` |
| All 16 research projects | Distinct cinematic hardware renders, including dedicated repair/industrial artwork | `ui/assets.ts`, `ui/kit/ArtWell.tsx`, `screens/ResearchPanel.tsx` |
| Galaxy background | Restored to the original procedural background at the owner’s request; `sky.ts` and `Environment.tsx` match HEAD | `galaxy/sky.ts`, `galaxy/Environment.tsx` |
| Local fleet/rock models | Six distinct reference hulls and three reference rocks in development; per-bucket failure falls back to owned models | `galaxy/referenceArt.ts`, `galaxy/shipCosmetics.ts`, `lib/referenceArtPlugin.ts` |
| Fleet/station materials | A small prefiltered environment adds readable metal reflections; fleet materials are cloned instead of mutating shared GLTF cache entries | `galaxy/SpaceLighting.tsx`, `galaxy/GalaxyCanvas.tsx`, `galaxy/Fleets.tsx` |
| Engines | Fine turbulent density and axial pulses; both reference nozzles follow each hull’s aim in the existing batched light field | `galaxy/vfx.ts`, `galaxy/Fleets.tsx` |
| Debris fields | An original hollow industrial wreck with fractured panels, collars, ribs and engine fragments; existing selection, lifespan and planet clearance retained | `galaxy/Wrecks.tsx`, `ui/assets.ts` |
| Isotope rocks | Restrained surface lighting and small faceted crystal outcrops on rocks already publicly marked isotope-rich | `galaxy/Asteroids.tsx` |
| Bombardment | A local 64-frame reference atlas, or the owned 16-frame production atlas, integrated into the existing server-timed volley, smoke, shock and embers; the previous procedural fire remains a loading/failure fallback | `galaxy/Bombardment.tsx`, `galaxy/vfx.ts` |
| Mining | A brief cutting flash and 12 sparks starting when a fresh successful extraction is confirmed, positioned at the debris band rather than inside its planet | `galaxy/MiningPulse.tsx`, `galaxy/MiningFlights.tsx` |
| Effects audio | Ten original short cues for controls, confirmation, warning, dispatch, cargo, weapons, shield, impact, strategic impact and mining | `lib/sound.ts`, `galaxy/audio.ts`, mutation success callbacks and existing toast/event surfaces |
| Settings | Persistent effects toggle and volume, independent of music, translated in all six locales | `shell/MenuPanel.tsx`, `i18n/locales/*/shell.ts` |

Existing building art, production ship silhouettes, cosmetic GLBs and strategic-impact choreography remain in use. Local reference hulls are used only where no ship cosmetic is equipped. Their materials and surroundings benefit from the lighting pass.

## Asset storage and provenance

Runtime assets are served from `apps/web/public/assets/`. Source material and offline generators remain outside that public directory.

| Asset | Source / authoring record | Runtime |
| --- | --- | --- |
| 16 research renders | `assets/source/premium/research/*-v1.png`; exact prompt set: `assets/source/premium/research/prompts.json` | `apps/web/public/assets/images/premium/research/*-v1.webp` |
| Nebula plate | `assets/source/premium/nebula-v1.png`; exact prompt: `assets/source/premium/nebula-prompt.json` | `apps/web/public/assets/images/premium/nebula-v1.webp` |
| Industrial wreck | `assets/source/models/debris/metal-wreck-v1.glb`; geometry authored in `tools/premium-assets.mjs` | `apps/web/public/assets/models/debris/metal-wreck-v1.glb` |
| Explosion atlas | `assets/source/premium/vfx/explosion-v1.png`; deterministic bake in `tools/premium-assets.mjs` | `apps/web/public/assets/vfx/premium/explosion-v1.webp` |
| Ten sound cues | `assets/source/premium/audio/*-v1.wav`; deterministic synthesis in `tools/premium-assets.mjs` | `apps/web/public/assets/audio/premium/*-v1.mp3` |

The research/nebula images were generated with the **built-in `image_gen` tool**, not the fallback CLI/API. The saved JSON files contain the exact final prompts. The wreck, VFX and audio are original native assets generated offline from repository code. The optional reference models/atlas are served only in development; they are not copied to `public/`, committed, or included in production builds.

Rebuild the shipping derivatives without any generation/API calls:

```bash
node tools/premium-art.mjs
node tools/premium-assets.mjs wreck
node tools/models.mjs --only=debris/metal-wreck-v1.glb
node tools/premium-assets.mjs vfx
node tools/premium-assets.mjs audio
```

The established model pipeline is `assets/source/models/` → `tools/models.mjs` → `apps/web/public/assets/models/`. The wreck has an explicit no-simplification policy because its merged geometry is already small.

## Optional local reference derivatives

`referenceArtManifest.json` records the six hull assignments and measured nozzle positions. Normal local development uses Astera's owned models, as production does. An explicit review session (`ASTERA_REFERENCE_ART=true pnpm dev:web`) enables the pack only when the selected rocks, explosion atlas, and all full/LOD ship derivatives exist. Missing HTTP assets fall back independently to the owned Astera hull/rock; their hit targets and gameplay identity remain.

Prepare the ignored local cache and restart Vite if the optional pack was previously disabled:

```bash
nice -n 10 node tools/premium-reference-assets.mjs
```

The tool reads `ASTERA_REFS`, the repo-local archive, or the sibling worktree archive. It writes only `.dev/reference-art/`, served through `/__ref/prepared/ships/`. Full hulls are capped at 5,000 triangles; LODs are capped at 2,000 and 60% of their full geometry. Original 1024px maps are encoded to WebP; LODs retain UVs and share the full material textures instead of storing a second image set. The local six-hull transfer footprint is about 2.18 MiB including LODs, compared with 17.17 MiB for the original full GLBs alone.

| Hull | Full triangles | LOD triangles |
| --- | ---: | ---: |
| DART | 3,340 | 2,000 |
| VIPER | 2,702 | 1,620 |
| TALON | 4,999 | 1,996 |
| RAMPART | 4,232 | 1,999 |
| STRONGHOLD | 2,072 | 1,243 |
| LEVIATHAN | 3,826 | 1,999 |

## Cost controls

Shipping size is **736,002 bytes (718.8 KiB)** across 29 new runtime files; assets load where they are used, not as one startup download.

| Group | Files | Bytes |
| --- | ---: | ---: |
| Research, 384 × 384 WebP | 16 | 475,774 |
| Nebula, 1536 × 768 WebP | 1 | 68,808 |
| Effects MP3 | 10 | 64,014 |
| Explosion, 512 × 512 WebP | 1 | 99,458 |
| Wreck GLB | 1 | 27,948 |

- The Base and other planet portraits are static images. The extra portrait canvas and its two components were removed.
- Nebula panels use a static plate, not additional galaxy canvases.
- The galaxy environment is baked from six 64px faces once per mount/context restoration. No new per-frame lighting pass or shadow maps were added.
- The wreck has one mesh/material and 2,136 triangles. Its transparent double-sided material uses a single pass.
- Crystal outcrops share merged geometry and an instanced mesh per rich rock bucket. They use the existing public isotope flag; no composition information is inferred.
- The owned explosion atlas occupies 1 MiB as RGBA before driver overhead; the optional local reference atlas occupies 4 MiB. Frame offsets use owned texture clones sharing the loaded image source. Existing particle counts and combat windows are preserved.
- Effects audio loads after a gesture, has at most six simultaneous voices, cue cooldowns and event deduplication. Hidden tabs stop voices and suspend audio. Muted/failed audio cannot reject a gameplay action.
- Existing galaxy DPR, quality levels, frame scheduler, bloom policy and `NoToneMapping` are retained.

## Verification and remaining review

The visual capture command is:

```bash
nice -n 10 node tools/visual.mjs out/premium --premium
```

An earlier review produced 34 screenshots at 350/585/1280 widths, including six-language settings, with no browser errors or horizontal overflow. Those captures predate the final reference-model integration and portrait rollback. The focused post-CR review is recorded separately in `out/premium/cr-fixed/inspection.json` and the code-review report. The screenshots and layout/error record are in `out/premium/`. This uses software SwiftShader: its frame timing is **not a physical-device FPS benchmark**. Renderer counters in the existing bridge show the final composite pass and must not be reported as total galaxy draw calls.

Manual browser audio inspection confirmed no AudioContext before a gesture, decoding all ten samples, successful playback, silence when muted, persisted mute after reload, and no page errors. File inspection found no clipped sample peaks. Subjective sound and visual approval remains with the owner.

Current verification and all six CR fixes are recorded in `docs/premium-code-review-20261011.md`. The focused browser review completed with static portraits, real LOD/shared-texture measurements, owned-model fallbacks during forced 404s, and delayed mining confirmation playing once. Web typecheck and production build passed; the final changed files passed typed lint after the full scan’s last finding was corrected. The existing Vite main-bundle size warning remains. The separate 3D portrait chunk has been removed.

As explicitly requested, no unit/regression tests were written, changed, or run for this pass. Add/fix those only after the owner approves the visual result.

### Local API recovery during review

The web server initially answered on `:5173` while no API process listened on `:3100`, causing Vite proxy responses of 500. API startup then identified three pending local migrations (`0147`–`0149`). Applying the existing migrations and starting the API/worker restored 200 responses through `http://localhost:5173/api/servers` and `/api/preview`.

The old database also held three historical failed `asteroid_hour` events dated 2026-10-09. They disappeared with the owner-authorized world reset below; no event was marked successful to hide a failure. Health returned 200 after the fresh worlds opened.

### Current local seasons

The owner authorized resetting obsolete local seasons. EU-1 and EU-2 were ruleset 14 with no monuments; MONUMENT-LOCAL was ruleset 16 with five legacy monuments. The existing season end/wipe operations sealed their records, removed the old world data and kept all 16 accounts. A private backup was saved under `.dev/localdump/` before the reset. All three new live seasons use the current ruleset 16, each with four Hard and four Easy monuments.

`pnpm start` now invokes `season local-bootstrap`. That command reads `MULTI_WORLD.rulesetVersion` and the current monument defaults, replacing obsolete or frozen local worlds before opening the game. It requires development mode and a loopback database; production keeps the ordinary `season bootstrap` command and its immutable live seasons. Current local worlds survive repeat startup. The monument rehearsal also uses the current default instead of a hardcoded version. Local startup runs package typechecks sequentially and explicitly binds Vite to all interfaces.

No resources were granted to `32rfr32`; the owner withdrew that request after forgetting the password. The later authorized grant to `hdhsjssiaka` added 50k alloy, 50k crystal, 10k deuterium, five of every non-ground hull and one ready Death Star. The authorized 50 asteroid / 20 pirate additions were local-only. Their one-off scripts were archived as text under `.dev/one-offs/`; they are not application or lint input.

After visual approval, update the existing `dev-up` command fixtures for the new bootstrap and Vite arguments, and cover obsolete-version/layout refresh, repeat startup preserving current world IDs, and refusal outside local development. These tests remain deferred with the rest of this pass.
