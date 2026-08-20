# Visual Design & Asset Direction

Visual quality is part of this game's identity, not a finishing pass. The game should feel
polished, cohesive and intentional — never like a working prototype with placeholder graphics.

## The feeling, before anything else

> **Fun, utopian, epic. A NASA photograph you can fly around in — and one that is happening
> right now, not one that is being reported to you.**

The owner's direction, and it outranks convenience. `docs/product-vision.md` states it in full
and `CLAUDE.md` carries the short form; what it means for this document:

- **Scale and depth over neatness.** A world is a world, not a dot. A raid is a bombardment, not
  a status change. If a moment would be more magnificent and it costs the loop nothing, make it
  more magnificent.
- **Motion is content.** A still disc has failed even when every number on it is correct.
  Something should always be crossing it, and the things crossing it belong to other people.
- **Nothing on screen may be waiting.** No spinner where a decision should be, no craft parked on
  its destination, no squadron holding over a world with nothing left to do. When a payload is
  late the world keeps running off the clock it already has and corrects itself when the truth
  lands — it never freezes and waits to be told (D52).
- **A moment worth animating is worth everybody seeing.** The fog governs what you KNOW before a
  decision; it is not a reason to hide the world from the people living in it.

## Art direction — Command Deck

> The player is standing at a command deck window, looking out at the disc. Every panel is a
> machined plate that slides into that window. The plates are lit by their own readouts.

**1 · The world never closes.** The R3F canvas is mounted once and is behind everything,
always. Panels are plates that slide over a living galaxy, never pages that replace it. A
screen that hides the world is a website.

**2 · Every surface is a built object.** Cut corners, a bright top bevel where light catches,
a darker bottom edge, a drop shadow that follows the cut silhouette, and a recessed well
behind content. Three vocabulary words and only three — **plate**, **slab**, **socket**. A 1px
rounded rectangle is a card on a website.

**3 · The interface is lit by itself.** In space the only light source is the instrument.
Active things carry an emissive edge that bleeds onto what is next to them; inactive things do
not. **Glow is a state, never a decoration** — if everything glows, nothing is on.

**4 · The art is the hero, never a bullet point.** The renders in `public/assets/images/` are
300–450px and are the most expensive thing this project owns. They appear at 96–140px inside a
lit socket, as the subject of a card. A render used at 40px in a text row is a wasted asset and
reads as a favicon.

**5 · Numbers are the loudest thing on screen.** Stock, power, ETA, exposure, dominion — the
game *is* those numbers. A display face at real size with tabular figures, never 12px mono in
a list.

### What is gameplay and not taste

- **Hue carries category, luminance carries certainty.** Alloy warm amber, crystal cold aqua,
  threat grease-pencil red, opportunity a jade used nowhere else.
- **The clarity ramp is reserved.** `FULL → CLEAR → INTERMITTENT → DEGRADED → BLIND` fades
  toward the background, so an unreliable reading is literally harder to see. Nothing outside
  the intel layer may use those five values.
- **Commit styling is reserved for the irreversible.** Launching, and nothing else.
- **Icons carry shape; the interface carries colour.** Hue already means category, so a
  coloured icon competes with the one thing colour is for.
- Near-black ground. Density with structure. No ornament that carries no information.

The palette is read off the art that already exists: gunmetal and graphite structures,
electric-blue emissive panels, amber emissive on alloy and the vault, crystalline blue shards,
molten-orange veining in raw alloy.

> **The test:** does this look like a real game, or like a website that happens to contain one?

## When to ask for an asset

If an element would be significantly better with a proper custom asset and you cannot produce
one at sufficient quality, **stop and ask rather than shipping a low-quality approximation.**
The same applies to audio.

When requesting one, never say "I need a ship model". Give: what it is · what it should look
like · its style · shape, material and detail requirements · format and technical requirements
· where it is used · recommended tools.

**`KNOWN RISKS` forbids commissioning art mid-phase.** Use what exists; a procedural stand-in
that is honest beats a half-finished commission.

## Technical specification for icons

24px grid, 1.5px stroke, round caps and joins, `currentColor` only — no fills, no gradients,
no baked colour. Exported as React components in `apps/web/src/ui/icons/`. They must read at
16px on a phone in daylight.

## Asset inventory

| Asset | Count | Used |
|---|---|---|
| `planets/planet_1..16` | 16 | **Everywhere a planet appears.** Chosen by hash of the planet id, so a world never changes appearance |
| `resources/alloy`, `crystal` | 2 | Status bar, every price, the hero's per-hour readout, gain lines |
| `general/telescope_1..3` | 3 | Telescope row (tier by level), the intel screen's empty state, the dossier's fleet-status gap |
| `general/radar_1..3` | 3 | Same pattern for the Radar |
| `general/shield_1..3` | 3 | Same pattern for the Aegis |
| `general/veil_1..3` | 3 | Same pattern for the Veil |
| `general/command_core_1..3` | 3 | Command Core row and its ladder (tier by level) |
| `general/vault_1..3` | 3 | Same pattern for the Vault |
| `general/shipyard_1..3` | 3 | Same pattern for the Shipyard |
| `general/bastion_1..3`, `thorn_1..3` | 6 | The two ground guns. **Tiered by how many are STANDING, not by a level** — a gun has no level, so a battery's ladder is its count (`groundArt`) |
| `drills/drill_1..3` | 3 | The Prospector: shipyard row, build sheet, and the craft drawn in the galaxy |
| `sattelites/sattelite_type_1..4` | 4 | **The four satellites, one render each and untiered** — a satellite has no levels (D25). Foundry / Beacon / Derrick / Uplink, in file order |
| `ships/ship_1..4` | 4 | Wasp / Lance / Bulwark / Hauler |
| `ships/explorer_ship` | 1 | The probe |
| `models/*.glb` | — | Every craft in transit, the four satellites in orbit, three rock bodies, the debris ring, the missile |
| `logos/logo-lockup` | 1 | **The ASTERA ONLINE wordmark**, hung by `Wordmark` on the front door and the loading cover — the only two surfaces that state the identity |
| `logos/logo-mark` | 1 | The same artwork with the words taken off. Nothing draws it yet; it is what the icons are cut from and what a small placement would use |
| `icons/icon-{180,192,512}`, `icon-512-maskable`, `favicon-{32,64}` | 6 | The manifest, the iOS home screen, and the browser tab |

`general/orbital_ring` and `general/drill` are unused — the Ring was retired in D22 and the
Drill became a craft in D25. Both files are still in the repo.

**The two `logos/*` files above are DERIVED and committed** (D54). The supplied plates —
`logo-big/small` and `logo-background-big/small`, kept beside them — paint the glow on solid
black, which draws a visible rectangle over the void and over the loading frame's radial
gradients. The derived pair carries an alpha channel lifted so that `alpha = max(r,g,b)` and
`colour = pixel / alpha`, which composited over black is the original pixel for pixel. Nothing
regenerates them on a build; `art.test.ts` is what catches a missing one.

### What is missing

Every building, every instrument and both ground guns now have a render. `ui/marks.tsx` is
down to the Core, the Vault and the lock — the first two are the unreachable floor of an art
well, and the lock marks a STATE, which no photograph can.

| Needed | Why it matters |
|---|---|
| **Alloy Refinery** / **Crystal Extractor** | The last borrow: both wear the raw resource they produce, which reads well at row size but is a small lie about what the building is |
| Battle-outcome imagery for `DECISIVE` / `PARTIAL` / `REPELLED` | The report is the loop's payoff and is currently all type |

A new installation ships in **three tiers**, exactly like `telescope_1..3` — that is what makes
a planet visibly upgrade and what feeds the next-level preview. A new HULL ships as one
render, because a hull is bought rather than raised. The exception is a GROUND gun, which is
bought repeatedly and never raised: three renders, chosen by how many are standing.

**Effects**, as sprite sheets or transparent PNG sequences at 512px, additive-friendly (bright
on black, no baked background): engine trail, launch flare, impact, shield hit ripple, scan
ping. Fire and explosion effects are currently baked procedurally in `vfx.ts`.

### 3D — the 2D renders cannot be reused

The sixteen planet PNGs are **renders, not textures**. They cannot be wrapped onto a sphere.

| Needed for 3D | Format |
|---|---|
| Planet surface maps | Equirectangular colour maps, 2:1, 2048×1024 (4096×2048 master). Optional roughness/normal |
| Starfield / nebula environment | Equirectangular `.hdr` or `.exr`, 4K master → 2K web |
| Ship meshes | `.glb`, Draco-compressed, KTX2 textures, ≤3k triangles, one LOD below |

Blender is the right tool for all of these, and the same masters can re-render the 2D art.

### Which way a ship faces — a rule that has already cost a bug

**Author every craft with its nose down +Z, level, centred on its own origin.** That is the
axis `Object3D.lookAt` aims, so a model built this way needs no correction anywhere.

The existing hulls do not obey it — four were authored nose-down −X, one nose-down +Z — so
each one's facing is DECLARED in `MODEL_FACING` (`apps/web/src/ui/assets.ts`) and
`orientedCraft` turns it onto +Z. **A new hull with no entry there will fly backwards or
sideways.**

The client used to infer facing from the bounding box, which is wrong twice over: a box cannot
tell a fuselage from a wingspan (the Explorer is 0.62 long and 1.00 across the wings, so it
flew sideways down every route), and it cannot tell a nose from a tail. **Facing is information
only the person who made the model has. It has to be written down, not guessed.**

Two more traps at the same site: `orientedCraft` turns a model *before* it measures it, because
a box round a body lying diagonally is a box round the diagonal; and a thin shell needs
`THREE.DoubleSide` or it draws nothing for half of every rotation, which reads as a corrupt
model rather than a material setting.

## Audio — nothing exists

Lowest priority, and honest about why: this game is played in four-minute gaps, often in
public, almost always muted. The first sounds worth having are a fleet arrival and an
incoming-fleet warning, and only once notifications exist.
