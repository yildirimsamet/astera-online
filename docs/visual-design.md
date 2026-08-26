# Visual Design & Asset Direction

Capital, colony and neutral silhouettes must remain distinct at mobile map scale. Capitals
carry a permanent command mark; owned colonies share the commander accent without borrowing
that mark; neutral T1/T2/T3 worlds communicate increasing threat through scale, orbital
activity and light density without exposing exact stock or garrison. Recovery uses a fractured,
cooling shell and an exact countdown; occupation protection uses a clean protective dome.
Death Star traffic always uses its dedicated model and impact language, never the ordinary
raid missile volley. Every viewer plays impact and control transfer at the server timestamp.
Craft, probe, Prospector drill and orbital satellite readability comes from a thin additive
back-face rim following the model's actual silhouette; camera-facing circular neon markers are
not used. Drive colour belongs to hull identity: ordinary combat hulls are cold, Runner is
amber, Breacher is red and Death Star is strategic red. On command surfaces that strategic red
is a restrained semantic accent, never a full red dashboard: scale, dense material, a dedicated
silhouette and structural framing carry the asset's power. Formation members aim independently
from their own slot toward the same destination rather than remaining parallel.

Death Star propulsion is a turbulent layered rocket plume with a blue-white throat and a
yellow/orange/red cooling body. Its impact is an eight-second server-timed event made from an
irregular surface ignition, sparse shock fronts, deterministic fire lobes, hot ejecta and
cooling smoke; perfect concentric neon target rings are explicitly avoided.

World ownership is the one semantic exception to the line-free galactic scenery (D122). It is
drawn above the painted plane as several hair-thin, gently curved white filaments rather than a
single straight stroke: more veil or string than route. The caller's worlds are always joined;
the selected foreign commander's worlds are joined only while one of them is focused. Telescope
watches have no beam or tether on the map. The filaments stay faint enough that worlds remain
the subject and never borrow the orange language reserved for flight intent.

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
300–450px and are the most expensive thing this project owns. A render used at 40px in a text row
is a wasted asset and reads as a favicon.

Which size a render gets follows from what the surface asks the player to do (`interface.md` I3).

- **A SHEET is the argument**, so its portrait runs at 96–150px as the subject of the plate.
- **A ROW asks you to IDENTIFY an object** among thirteen others, so its render sits in a 74px
  socket — large enough to recognise at a glance, small enough that fourteen of them still scan.
  This is the floor. `UpgradeRow`, the most-seen surface in the game, drew its art at 48px in a
  flat wash until D109; that is the failure this rule was written about.
- **A LADDER RUNG repeats an object already identified** by the portrait at the top of the same
  sheet, so it is a thumbnail rather than a subject and may go smaller. It is showing *which level
  changes the hardware*, not *what this thing is*.

`ArtWell` publishes the sheet and row steps; nothing should sit between them.

**5 · Numbers are the loudest thing on screen.** Stock, power, ETA, exposure, dominion — the
game *is* those numbers. A display face at real size with tabular figures, never 12px mono in
a list.

### What is gameplay and not taste

- **Hue carries category, luminance carries certainty.** Alloy warm amber, crystal cold aqua,
  Deuterium neon chartreuse, threat grease-pencil red, opportunity a bluer jade used nowhere
  else. Isotope rocks repeat Deuterium's chartreuse; they never introduce a second fuel hue.
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

The three-person team may produce or commission art inside a planned milestone when the asset
has an owner, a performance budget, an acceptance shot and a fallback. An honest procedural
stand-in still beats integrating a half-finished asset into a load-bearing surface.

Galaxy rendering budgets, required Playwright frames and the per-milestone CR gate live in
[`visual-quality.md`](visual-quality.md). “Premium” is not accepted without that evidence.

## Technical specification for icons

24px grid, 1.5px stroke, round caps and joins, `currentColor` only — no fills, no gradients,
no baked colour. Exported as React components in `apps/web/src/ui/icons/`. They must read at
16px on a phone in daylight.

## Asset inventory

| Asset | Count | Used |
|---|---|---|
| `planets/planet_1..16` | 16 | **Everywhere a planet appears.** Chosen by hash of the planet id, so a world never changes appearance |
| `resources/alloy`, `crystal`, `deuterium` | 3 | Status bar, every price, the hero's per-hour readout, gain lines |
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
| `ships/runner`, `breacher` | 2 | Future combat hulls; 2D cards plus mobile-optimised transit models |
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
