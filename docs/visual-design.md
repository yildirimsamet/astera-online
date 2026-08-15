# Visual Design & Asset Direction

Visual quality is a core part of this game's identity and player experience. Do not treat visuals as secondary to functionality or leave them until the end.

The game should feel visually polished, cohesive, memorable, and intentional — not like a technically functional prototype with placeholder graphics.

## Visual Quality Rule

When implementing any visual element, ask:

- Does this look good enough for the final game?
- Does it fit the game's established visual identity?
- Does it make the game feel more immersive and desirable to return to?
- Is this something the agent can realistically create at a high quality?

Do not settle for crude, generic, or obviously AI-generated/placeholder-looking visuals simply because they are technically functional.

## When You Need an Asset From Me

If an element would look significantly better with a proper custom asset and you cannot create a sufficiently high-quality version yourself, **stop and ask me for the asset instead of implementing a low-quality approximation**.

This can include, for example:

- Planet models
- Buildings
- Ships
- Space structures
- Asteroids
- Galaxy/environment elements
- Icons
- Effects
- Backgrounds
- Illustrations
- Important UI artwork
- Other distinctive visual elements

When requesting an asset, do not simply say:

> "I need a ship model."

Tell me exactly what is needed.

For each requested asset, provide:

1. **What the asset is**
2. **What it should look like**
3. **Its visual style**
4. **Important shape/material/detail requirements**
5. **Required format and technical requirements**
6. **Where it will be used in the game**
7. **Recommended tools/services where I can create or obtain it**
8. **A suitable prompt/specification I can give to that tool if useful**

For example, instead of asking for "a spaceship," explain the intended silhouette, scale, style, materials, level of detail, camera usage, animation requirements, and whether it should be a 3D model, texture, icon, or illustration.

## Do Not Block Progress Unnecessarily

Use your own implementation when you can produce a good result with code, procedural graphics, shaders, CSS, SVG, Three.js/R3F, etc.

Ask me for an external/custom asset only when it would make a **meaningful visual-quality difference**.

The goal is not to outsource every visual element.

The goal is:

**Use code for what code can do well.  
Use custom assets when custom assets are necessary for a polished game.**

Never sacrifice the game's visual quality merely to avoid asking me for an asset.

When an asset is needed, tell the user:

1. **What asset is needed**
2. **What it should look like**
3. **Its visual/style requirements**
4. **Where/how the user can create or obtain it** (for example: Blender, AI image generation, asset stores, audio-generation tools, etc.)
5. **The required format/resolution/technical requirements**, when relevant.

Do not block development unnecessarily. If a temporary implementation is sufficient for development, use one, but clearly mark it as temporary and replace it before MVP completion if the final experience requires a real asset.

## Audio

Audio is part of the game experience.

If music, ambient sound, UI sounds, combat sounds, fleet travel sounds, notifications, or other audio would materially improve the experience and a proper asset is required, ask the user for it using the same process above.

## Quality Rule

Before accepting a visual implementation, ask:

> "Does this look like a real game, or does it look like a website that happens to contain a game?"

If it looks like a website, improve it.

**Visual quality is part of gameplay quality.**

ASSET PRODUCTION & VISUAL DIRECTION

The game is a 3D space/galaxy game where players can own planets and see other players' planets. It starts as a web game using React + React Three Fiber + Three.js, with mobile app and PC versions planned later.

Visual quality is very important. The game must feel like a real space game/app, NOT like a typical web dashboard or website. The space/galaxy theme should be strong, immersive and visually cohesive.

The following asset pipeline is a general example, NOT a strict requirement. Choose the best approach based on the project's actual needs, visual quality, performance and future web/mobile/PC compatibility.

Possible tools/approaches:

- Blender → 3D models and optimization
- GLB/glTF → web-friendly 3D assets
- AI image generation → concept art, textures, backgrounds and visual references
- Figma → UI/HUD design
- Procedural generation → planet/asteroid/environment variations
- Three.js particles → simple VFX such as stars, explosions, engine trails, etc.
- AI or sound libraries → music and sound effects

Prefer reusable assets and variations over creating hundreds of unique heavy assets. For example, a small number of high-quality planet/ship bases can be procedurally varied.

Keep performance in mind, especially the existing target of smooth performance on mid-range Android devices. Use appropriate LODs, instancing, optimized meshes, compressed textures and efficient rendering where appropriate.

The project should preserve high-quality source/master assets where possible so the same visual assets can later be adapted for mobile and PC.

IMPORTANT:
If a required visual/audio asset is something you cannot create at a sufficiently high quality, or creating it yourself would result in a generic, simple or amateur-looking result, DO NOT substitute it with a poor implementation. Ask me to provide or obtain the appropriate asset instead.

The same applies to important sound effects, music and other audio assets: if they materially affect the game's quality and you cannot produce an appropriate result, request the asset from me.

The goal is a polished, cohesive, visually impressive space game — not merely a technically functional web application.

---

# Assets currently requested

Kept here rather than in an issue tracker so a cold agent finds it while reading the
visual rules. Each entry says what is temporary, what would replace it, and what the
replacement must satisfy. **Nothing here blocks development** — every one has a working
procedural stand-in today.

## 1 · Planet portrait — WANTED NOW

**What it is.** The player's own planet, shown on the planet screen and the entry screen.
Currently `apps/web/src/ui/PlanetSigil.tsx`, a procedural SVG: one radial body gradient,
two-octave `feTurbulence` surface, angular shadow, atmospheric limb. It is deterministic
from the planet id, costs nothing to load, and is honest — but it is a good CSS planet,
not a beautiful one, and this is the image carrying the entire ownership pillar.

**What it should look like.** A single planet, lit from the upper left by one cold white
star, seen from roughly 1.5 planet-diameters away. Roughly a third of the disc in shadow,
with a soft terminator. Visible surface character at a glance — banding, weather, or
continents — legible at 104 px on a phone. A thin atmospheric rim on the lit edge only.
No rings, no moons, no ships, no lens flare, no starfield in the image.

**Style.** Photographic-plausible, not stylised or cartoon. Reference: Cassini and Voyager
plate photography, not concept art. It must sit inside a near-black `#05070D` interface
without glowing — the interface is an instrument panel and the planet is the one warm
object in it.

**Variations needed.** Six to eight bases, splitting into two families the palette already
assumes: **cold** (ice, blue-grey, methane) and **warm** (rust, ochre, iron oxide). Each
base gets procedurally hue-shifted and re-lit per planet, so six well-made bases cover two
hundred planets. Do not produce two hundred images.

**Format.** `1024 × 1024` PNG with a real alpha channel — transparent outside the disc,
no baked background, no baked glow. Disc centred, occupying ~76% of the frame (matching
the current `r=38` in a 100-unit viewBox) so it drops in without re-layout. Delivered as
PNG for the master; the build converts to WebP. Keep the master at 2048 if the tool
produces it — the same asset will be needed at higher resolution for desktop later.

**Where it is used.** `PlanetSigil` — the only component that changes. The planet screen
hero at 104 px, the entry screen at 188 px, and later the Phase 5 galaxy at label scale.

**How to make it.** Two good routes:
- **Blender** — a UV sphere, one sun lamp, a procedural noise/Musgrave material into
  displacement and colour ramp, render with a transparent film. This gives the cleanest
  masters and re-renders for free at any resolution.
- **AI image generation** (Midjourney / DALL·E / Stable Diffusion) then background removal.
  Faster, less controllable, and the lighting direction must be checked on every output.

**Prompt, if generating:**

> A single exoplanet photographed from space, three-quarter lit by one cold white star
> from the upper left, one third of the sphere in shadow with a soft terminator, subtle
> banded cloud layers and continental mottling, thin blue atmospheric rim on the lit edge,
> no rings, no moons, no spacecraft, no lens flare, pure black background, scientific
> photography, Cassini probe plate, sharp, high detail, centred, square

Generate one set with a cold blue-grey palette and one with a rust-and-ochre palette.

## 2 · Phase 5 — the 3D galaxy

Do **not** produce these yet. The galaxy view is fenced at three weeks and starts as
points, lines and labels; asking for models before that fence is how the fence breaks.
When it opens, the request will be: one low-poly planet base mesh with a 1K PBR set
(`.glb`, Draco + KTX2), one equirectangular starfield/nebula environment (`.hdr`, 4K
master → 2K web), and two or three additive sprite sheets for engine trails and impacts.

## 3 · Audio

Nothing requested. This game is played in four-minute gaps, often in public, almost always
muted. A notification sound would be the first audio worth having, and only once web push
exists.
