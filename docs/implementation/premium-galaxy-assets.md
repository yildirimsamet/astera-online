# Accepted normal-galaxy art pass

Owner decisions (2026-10-11): retain the native GD ordinary asteroids, green isotope
variant, Rocket_1 bombardment model and impact effects, native textured ship wakes,
ship engine flames, and strategic exhaust/explosion. Remove the mining extraction
flash entirely and the separate yellow strategic exhaust glow sprite.

Restore all original Fleet V2 bodies, authored finishes, poses, UI cards and icons;
original probe and drill; original procedural galaxy sky; original abandoned station.
Restore the older rocky annulus from `5d095d1^`, not the later industrial metal field.
The existing server field coordinates, lifetime, selection and salvage rules remain.
The model is one complete ring, 2,087 triangles, not a fragment to repeat around an orbit.

All 22 mobile Fleet V2 hulls plus drill, probe, strategic missile and merchant were
rendered separately from rear/top/side views. Engine attachments live in
`galaxy/engineAnchors.ts`, keyed by the drawn model URL, in fully posed unit space
including height. Applying hullPoseLift again is incorrect. Existing optional
cosmetics retain their own equipment and fallback logic. Every flight, pirate and
convoy formation shares this attachment table. Probe and merchant use the same
Exhaust component as their inspector; drill and strategic propulsion read the table.

Most craft have one or two apertures. Talon and Viper expose paired split apertures;
all four openings receive jets. The merchant has four rear ports. Engine particles
remain instanced: one draw per formation, 24 particles per aperture, 64 for the strategic
plume. Anchor calibration does not add one draw or one light per engine.

Owner corrections (2026-10-12): retain continuous texture and rearward flow, with a
gentle sideways bend along the flame like a moving rope. The mouth stays fixed and
the bend grows towards the tail; individual particles must not scatter or pulse
the engine off. Equal emission phases and a continuously fed throat preserve
coverage and brightness after tab suspension. Strategic propulsion shares the profile.
The hull's existing T1–T4 tier also increases plume diameter and reach modestly.
Growth affects only the plume beyond its fixed attachment; hull sizes, poses,
ports, colours and textures do not change. Equipped bodies inherit the same tier.
Untiered utility craft retain their existing dimensions. No extra particles,
draws or lights are needed for either adjustment.

The four equipped ship bodies were also inspected from rear/top/side, bottom and the
opposite side. Their own measured ports in `SHIP_SKIN_DRIVES` now feed the URL-keyed
attachment table for flight, LOD and inspection. The ordinary flame and purchased
engine effects share `formationEngineUnits`; neither inherits a stock hull's height.
Purchased effects use one instance per real port in their existing single draw.
The UFO has a downward emitter and beam; its invented rearward flame is removed.
All five cosmetics are selectable alone in the review gallery.
All six purchased engine effects are selectable on those bodies and the stock
fleet craft through the same inspector, including shareable `engine` URL choices.
Changing an effect style now replaces its shader material. Previously the Three
program cache retained the first compiled program, so selecting Tempest or Prism
after Titan still drew Titan. The visual regression checks the shader actually
bound on the GPU while changing styles on the same mounted canvas.
Purchased propulsion also draws after the depth-writing hull at order 1000,
with depth testing enabled and depth writes disabled. Previously it drew before
the hull at order 0 and appeared behind the body even from the rear.
Hull rim width is halved from 0.008 to 0.004; unfocused/focused opacity changes
from 0.42/0.65 to 0.315/0.4875. Both individual and instanced hull paths use these
values, following the owner's additional direction on 2026-10-12.

Sources remain read-only in `/home/yildirim/astera-ref-assets/extracted`.
`tools/galaxy-reference-pack.mjs` regenerates only the approved missile, four rocks
and active VFX textures. `tools/premium-debris-pack.mjs` generates the retained curved
metal plate used by explosions; the persistent wreck field uses the original rocky ring.
Rejected imported hulls, UI renders, station, sky cube, mining texture and unused
metal-field families/LODs were removed from the worktree and production manifests.

Opening asset transfer is 1,796,305 bytes versus 1,756,053 bytes for the original
selection: +40,252 bytes (+2.29%) from the three native asteroid bodies and maps.
This exceeds the older pre-V2 reference ceiling by 9,990 bytes (+0.56%); the accepted
selection is capped at 1.8 MB. Wrecks, missiles, isotope bodies and impact effects
are outside that opening list and load separately.
Ordinary rocks use 745 / 802 / 1,354 triangles, isotope 976, missile 256. Their
textures are embedded resized WebP; geometry uses meshopt. These measurements do
not establish device FPS.

Validation evidence: the original model and art contracts, engine counts, atlas
independence, strategic timing, mining removal, selection, scene isolation and LOD
material sharing pass together (169 tests). Workspace typecheck and root lint passed.
The earlier complete web run passed 5,928 tests with 29 existing skips; the subsequent
run completed two shards (1,489 and 1,495 tests) before the owner requested focused
verification only. It is not recorded as another completed full run. Rules passed
2,062 tests and were not changed by this work. The isolated server run completed
484 tests before later requests interrupted it; it is not a complete backend suite.
The final admin/HUD checks passed 136 web tests and four selected API/contract tests.
Admin and galaxy readouts were also reviewed at mobile and desktop widths; all six
readout languages passed the numeric emphasis and layout checks. No economy
simulations or snowball studies are authorized or run.

Review artifacts are local, ignored outputs under `out/premium-assets/engine-calibration`.
The initial sheets contain the original models without flames; the final sheets use
live Hull, FormationLightField, Exhaust and StrategicExhaust components. Diagnostic
lighting and an orthographic camera make nozzle alignment readable; appearance in
the ordinary galaxy is checked through the isolated review gallery on port 5174.
The final paid-engine review contains 162 rear/top/side views: six engines on
nine bodies, including all four equipped skins and both four-port hulls. All
requested GPU programs, port counts and depth/order checks passed. Gentle native
flow and tier scaling were also photographed separately with motion sequences.

The separately reported intermittent black rectangles were not reproduced, and
the owner ended that investigation; see `black-artifacts-investigation.md`.
They are not claimed fixed by the engine
program and ordering corrections.
