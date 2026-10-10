# Cosmetic collections — 2026-10-09

Owner request: separate Store and Inventory, categorize planet/ship/probe/miner models,
produce premium planet rings, engine effects and clan standards. Existing purchases survive.
Ship/probe/miner products represent distinct authored models, never mere recolours.

Implementation: shared typed catalogue; independent cosmetic slots; account entitlements;
server-authoritative equipment; category navigation in both surfaces; live previews use
actual in-game effects. Existing planet purchase and equipment API stays compatible.
New products cannot be sold until payment product configuration exists. No fabricated prices.

Tests first: catalogue identity/category/slot and unknown IDs; ownership, wrong slot,
unauthenticated equipment, reset, revoked rights, clan role; store/inventory separation,
empty categories, selection, pending/error states. Verify fog-safe projection: no appearance
on unidentified contacts or unknown worlds. Test existing planet checkout regressions.

Affected areas: rules catalogue, cosmetic services/routes/schema/migration, galaxy projection,
web schemas/queries/client, shop/inventory/preview, 3D effects and localization. Risks:
visibility leaks, transparent overdraw on mobile, revocation leaving equipment active,
new product config accidentally disabling existing sales. Bound effect geometry and update
uniforms through refs; preserve depth testing. Run pnpm verify and visual harness.

Art direction: Aurora (flowing spectral ribbons), Helios (segmented solar machinery),
Singularity (gravitational arcs). Each silhouette and motion is distinct. Inspection uses
orbit controls and controlled lighting. Product cards derive from real rendered objects.

## Delivery and operation

- Cosmetic ownership stays on the existing account entitlement ledger. New equipment lives
  in `accounts.cosmetic_equipment`; migration 0145 is required before starting this build.
- Rings apply to all currently controlled worlds alongside their individually equipped
  planet skins. Engines apply to fleets; UFO replaces probe geometry. Combat is untouched.
- Owner confirmed: a flag belongs to its buyer. Only a current clan leader can equip it;
  the clan displays its current leader's equipped standard. Two free standards are included.
- New paid products are opt-in through `POLAR_COSMETIC_PRODUCTS`: a JSON object keyed by
  cosmetic ID, each value `{ "productId": "<Polar UUID>", "eurAmount": 399, "tryAmount": 9900 }`.
  Amounts are minor currency units. Verified sandbox and live mappings are in
  `config/polar-cosmetics.{sandbox,production}.json`; approved category prices are recorded in
  `docs/cosmetics-polar-release-2026-10-09.md`. Missing products have no quote and cannot be purchased.
  Existing ten planet/bundle product settings remain compatible. Free standards cannot be sold.
- `/api/admin/cosmetics/grant` uses the existing verified-order contract for manual delivery:
  `{ username, skinId, orderRef }`. Authenticated admin only; idempotent order replay.
- Catalog images: `node tools/visual.mjs out/cosmetic-collections --cosmetic-collections`
  with the local Vite server running. Captures the actual shared 3D effect, never an illustration.
- UFO master remains untouched. The flight mesh is 11,999 triangles with 1K material maps
  (800,544 bytes after material embellishment); the separate shop-only preview retains
  all 27,426 triangles and 2K maps (1,908,020 bytes). Only inspecting the probe loads
  that preview. The owner requested moderate
  optimization after rejecting the earlier 4,797-triangle/512px version.
  Rebuild both with `node tools/models.mjs --only=probes/probe_ufo.glb`.

Validation uses an isolated `astera_cosmetics_test` database. The pre-existing shared test
DB's migration ledger and actual columns differed; no game database was reset or altered.

Traffic appearances are loaded once into the shared traffic snapshot. Observer projection
adds only the appropriate cosmetic fields after sight resolution; unidentified and
effect-only contacts receive none. Refunded entitlements are revalidated on every snapshot.

Visual verification: all 17 actual product renders passed with no JavaScript/shader errors;
350px and 1280px category navigation passed with no horizontal overflow. The non-leader
flag equip action is disabled. Latest captures are in `out/cosmetic-revision/`.

Validation results: TypeScript and lint pass; rules 2,016 tests pass; web 5,566 tests
pass (29 pre-existing skips). The targeted server suite passes 39 tests, including
new-category checkout/payment/refund and concurrent independent equipment changes.
Full `pnpm verify` stops on the pre-existing simulator `TAX holds its band` failure
(TAX 0.0325). Reproduced on clean HEAD `00a8d14` in an isolated worktree, with the
baseline rules source explicitly resolved; no balance thresholds or skips were changed.

The server run was split across two isolated test databases after the five initial
files passed, so the long snowball audit could finish alongside the remaining files.
The audit completed all 24 cases: 10 passed, 14 failed (economy assertions, route
measurement limits, and benchmark runtime limits). Three fast assertion failures
(Core 6 founding affordability, checkpoint army, repeat pirate purse) were reproduced
unchanged on clean HEAD 00a8d14. The other long audit failures were not individually
baseline-replayed. No economy code or audit expectations were modified.

## Owner-directed visual revision

The owner rejected the initial Aurora ring, mild standards, over-simplified UFO and
flat-cut engine origins. Revised direction: dimensional storm bands; eight original
aggressive heraldic standards plus two free standards; moderate UFO flight LOD with
separate close-up geometry; volumetric animated exhaust with a narrow throat, bright
inner core and transparent end caps. Original SVG standard artwork lives under
`public/assets/images/cosmetics/standards/` and follows the same cloth deformation as
its in-game form. Names/stories cover all six supported locales.

References studied for visual principles, without copying assets:
- https://bartekku100.gumroad.com/l/RocketShader — nozzle, plume and shock structure.
- https://coatesillustration.com/sledgehammer-games-portfolio — aggressive readable heraldry.
- https://support.eveonline.com/hc/en-us/articles/6206083486876-Alliance-Logos — small-scale legibility.

Motion verification uses the actual shop with a stationary engine camera and compares
frames (`node tools/visual.mjs out/cosmetic-motion --cosmetic-motion`). It records video
and checks that a measurable portion of exhaust pixels changes, with no shader errors.

The remaining server run completed: 203 files, 2,740 tests passed. Together with the
five initial files and the completed snowball audit, every server test file ran. The
separate audit failures above remain explicitly unresolved outside this cosmetic scope.

Revision verification: all 17 real product renders and both 350px/1280px layouts passed.
133 focused web tests plus the catalogue tests pass. Actual store motion initially
failed with identical frames: updating the memoized uniform object did not update the
mounted material after reconciliation. The fix writes `material.current.uniforms.uTime`.
All three exhausts now pass stationary-camera image-difference checks (1.23–2.09% of
all preview pixels changed over the sampled interval), with zero shader errors.
Source and flight UFO captures at identical framing are in `out/cosmetic-revision/`;
the new flight mesh preserves 11,999 triangles with measured simplification error .0086.
The latest exhaust silhouettes also use distinct profiles: solar shock chambers,
broader flowing aurora plasma and a narrower void core. Final motion recording:
`out/cosmetic-motion/engines.webm`.

## Local world trials

Owner requests trying planet and ring skins on their actual owned worlds. The store
starts a local-only render override and flies to an owned target; a compact bar selects
among owned worlds, compares current appearance, exits or returns to the selected store
item. Trial never calls purchase/equip APIs, never edits query-cache data and never
changes what other players see. Ending, opening another panel, logout/unmount or loss
of target ownership removes the override. Current shield status and the other cosmetic
slot are preserved. Tests first cover nonmutation, ownership/fog, reset/comparison,
unsupported IDs and store callback wiring.

Trials also explicitly frame the selected world up close. The camera reserves the
bottom control area so the world and complete ring stay visible on a narrow phone.
Normal map gestures remain available; selecting/clearing a map target ends the trial.
When no planet skin is equipped, the trial reads the world's current recovery boost
to select its correct appearance. The authoritative world/cache remains unchanged.

Actual GalaxyView verification passed at 350px and 1280px, including unowned ring
trial, colony selection, compare, return to the same product, planet trial and exit.
No purchase/equipment requests or shader errors occurred. Screenshots and results:
`out/cosmetic-trial/`; reproduce with `node tools/visual.mjs out/cosmetic-trial --cosmetic-trial`.
The gallery uses two fixture-owned worlds but mounts the real shop, galaxy, camera
and PlanetField. Focused interaction/framing/restoration tests pass (72 tests).

## Ship collection and Titan drive

The final hull mapping is Korsan/Corsair → Ejder, Kale/Citadel → Balina,
Engerek/Viper → Akrep, Leviathan → Vatoz. Each hull has its own account equipment
entry; equipping or resetting one preserves the other hulls. Refunded rights and
wrong-hull selections are checked on the server and when projecting visible traffic.
The catalogue, shop cards and inventory display the compatible hull in all six locales.

Immutable model masters now live in `assets/source/models/ships/skins/<name>/`.
Generated flight, distance and inspection models mirror that hierarchy under
`apps/web/public/assets/models/ships/skins/`. Flight meshes are bounded at 5,000
triangles and 1K maps, distance meshes at 3,000 triangles and 512px maps. Detailed
inspection meshes load only in the shop/inventory. Rebuild with
`node tools/models.mjs --only=ships/skins/`. See `ship-skin-integration.md` for measured
attachments and the material pipeline.

The dragon's actual inset eyes, scorpion's eyes and needle, whale's eyes, stingray's
eyes and UFO accents use baked emissive maps. Neutral metal remains neutral, with
no additional glow lights or Bloom pass. Whale wing jets use separate attachment
coordinates because the supplied model is asymmetric. Preview engine products use
Kargı/Pike. Card framing is closer and captures a real 600 × 400 render from the
first paint; all product cards are delivered as WebP assets.

Empty shop categories are hidden. Inventory categories require accessible owned or
included items; two included clan standards are available even without a purchase.
Selection falls back when its last entitlement is revoked.

Titan Drive (`engine-titan`) is the fourth engine appearance: a blue-white ignition
core, turbulent yellow-orange combustion and a fading ember tail, inspired by the
Death Star exhaust. Its two-shell volume has 800 triangles instead of the other
engines' 1,536. A formation submits the effect as one instanced draw, without the
Death Star's forty sprite objects and two point lights. Animation updates shader
time; this describes the render budget rather than a measured frame-rate guarantee.

Reproduce the ship/card/nozzle/mobile/actual-flight review with
`WEB=http://127.0.0.1:5187 node tools/visual.mjs out/ship-skins --ship-skins`.
Stationary-camera motion verification for all four engines passes with no JavaScript
or shader errors (0.71–1.53% of preview pixels change across sampled frames).
Motion captures, results and video: `out/ship-skin-motion/`.

Latest owner instruction (2026-10-09) supersedes the historical simulation runs above:
economy/season simulations, snowball audits and similar long studies run only upon
an explicit user request. The ordinary `pnpm verify` and `pnpm test` defaults exclude
them, with guarded workspace/audit discovery. Current validation uses that ordinary
gate, plus focused checks and actual renderer captures.

Follow-up fixes: the wordmark R has a continuous horizontal-to-diagonal joint, removing
the protruding square cap. The planet selection's outer hoop is removed while owned
and selected worlds retain their close silhouette border. Actual PlanetField verification
passes unselected home, selected home, selected unknown and cleared selection;
an actual pointer tap on the unknown planet also passes. Both worlds keep only
their close edge and clearing selection preserves the home edge. Captures and
measured border radii are in `out/planet-selection/`. The real loading
screen passes seven viewport ratios and the bootstrap render (`out/loading-r-fix/`).

Final ordinary verification passes typecheck, lint, 2,023 rules tests, 5,609 web tests
and 3,029 server tests. The existing skips remain 29 web tests and one server test.
All 208 ordinary server files are accounted for without omissions or duplicates:
51 completed in the initial verify run, then 157 completed across three independent
temporary test databases. Economy simulations and the snowball audit were excluded.
Machine-readable coverage and results: `out/ship-skin-review/validation-results.json`.

## Second premium wave — 2026-10-09

Owner request: two deliberately plain included standards, ten paid standards, four paid rings
and two paid drives, each clearly above the first collection. Research principles applied:
players pay for what other commanders see (rings around every held world, drives on every
flight, standards on every clan fleet); a living, animated signature separates premium from
basic; each look needs a silhouette and colour readable at map distance; themed pairs invite
collecting (Prism halo + drive; Amber Scorpion standard + Scorpion hull).

- **Standards.** Sovereign Lion, Abyssal Kraken, Oni Warlord, Eye of the Void, Valkyrie, Sun
  Scarab, Star Stag, Event Horizon, White Tiger, Amber Scorpion; included Bastion and Meridian
  (flat colour, rectangular cloth, no metal). Each paid standard cuts its own cloth outline in
  the artwork (`clipPath id="cloth"`, transparent outside), so tails, torn edges and claw slits
  need no shader code. The banner program discards transparent texels and adds a gilded sheen:
  a light band sweeps across bright metal thread about every nine seconds. The claw slits also
  carry a painted gash so they still read when the texture is minified.
- **Rings.** Saturn's Crown (real C/B/A anatomy from a 1D profile texture, Cassini and Encke
  gaps, Keplerian shear, ~26° obliquity), Prism Halo (120 instanced crystal needles, thin-film
  edges and rainbow dust), Inferno (ridged plasma filaments and a white-hot rim), Nebula Veil
  (two logarithmic arms, dust lanes, star-forming knots and a warm core). The owner requested
  removal of Inferno's eight raised arcs and the diagonal secondary Prism/Nebula belts on
  10 October. Main belts keep their obliquity or vertical undulation; Prism retains its crystals.
- **Drives.** Tempest (four forked bolts re-seeded twelve times a second; bolt paths are computed
  per tube ring in the vertex stage, so the jagged polyline costs vertices, not pixels) and Prism
  (white core dispersing into travelling spectral bands, light rings and glitter).
- **Budgets.** Every new look compiles its own program (`cosmeticShaders.ts`); legacy products
  keep the shared program unchanged. Belts are annuli (no discarded plane pixels), noise is
  three octaves, drives stay at 1,536 triangles per craft in one instanced draw, Prism shards
  are one 960-triangle draw. Ring spans live in
  `RING_SPANS` and feed both geometry and shaders.

**Sale status (10 October).** All sixteen paid products now exist in sandbox and production
with their individual artwork and approved regional prices. Both catalogue JSON files and
env templates include all 36 paid non-planet cosmetics; both public price pages list all 46
offers including planets and the bundle. Included standards remain free. The server still
grants purchases only through verified Polar payment events and revokes them on full refund.
Application production activation requires the documented runtime mapping and rollout; the
provider catalogue alone does not activate the in-game offers. Integration evidence and
rollback constraints: [Polar second-wave release](polar-wave2-integration-2026-10-10.md).

Verification: all 36 real product renders and the 350px/1280px shop layouts pass with no
JavaScript or shader errors; both new drives pass the stationary-camera motion check
(0.86% and 1.08% of preview pixels change). Rings were also checked in the real galaxy trial
with Bloom, and drives and standards in the actual formation renderer. Reproduce cards with
`node tools/visual.mjs out/cosmetic-collections --cosmetic-collections`, motion with
`--cosmetic-motion`, and a formation with `v2-gallery.html?view=cosmetic-fleet:<engine>:<flag>`.
