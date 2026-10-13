# Death Star burst and surface review · 13 October 2026

Owner requests: a disposable page showing flight, impact and the one-hour aftermath,
with default and skinned planets. No TDD for the preview and no playback controls.
Replace EMP cages/orbiting rings with the pre-EMP surface scars. Scars must rotate
with the actual 3D surface and become denser after successive successful strikes.
Verify bursts of 3–5 launches separated by 200 ms, 300 ms and 1 second, including
simultaneous arrivals, duplicate delivery and colony secession at zero loyalty.

Current authority: `launchDeathStar`, `applyDeathStarStrike`, `onMissionArrival`,
`advanceLoyalty`, `onColonySecession`, `DeathStarImpacts` and `StrategicBlast`.
There is no target-specific launch quota/cooldown. Each planet stocks 1 weapon,
or 2 with Strategic Stockpile, and each launch needs a free flight bay. Every
successful hit restarts the 60-minute EMP clock and subtracts 20 loyalty points
from a colony. A capital has no loyalty. Zero loyalty is terminal.

Implementation: shade scars inside the existing planet materials, using their
own local surface coordinates so they rotate and occlude with the model, independent
of the GLTF's packed texture UVs. Keep source geometry/material
caches intact. Group only damaged instances by a bounded visual level; retain
normal warmup programs. Store a successful-hit counter on the planet under the
existing target lock, reset after the EMP window expires, and expose it as public
visual state. Intercepted/ineffective and redelivered missions must not add scars.

The burst audit found that five spaced hits from exactly 100 left sub-hundredth
loyalty because fault-free colonies regenerate between impacts. After the owner
asked to eliminate that residue (proposing hidden 20.1 damage), preserve the
published 20-point hit and clear only post-strike residue at or below 0.01.
200 ms, 300 ms and 1 second burst regression cases cover the boundary; ordinary
loyalty regeneration and balances above the tolerance remain unchanged.

Verification: isolated PostgreSQL database (never a shared/dev database), one
workspace/worker at a time, ordinary relevant regressions only; 4 GiB maximum
heap. Browser captures and scene measurements at 350 px and desktop, covering
elemental and country skins, successive hits and model rotation. Preserve all
unrelated edits already present in the shared checkout.

Verified: 107 backend regressions (burst, interception, loyalty and secession),
9 galaxy API/traffic contract checks and 109 relevant rendering/impact/notification
regressions passed. Server and web typechecks and all three sequential lint groups
passed. The final browser run passed at 1280 px and 350 px with lava, ice and Turkey
skins: ten independent concurrent blasts, increasing scar masks, rotating surface
materials, no retired EMP cages, no horizontal overflow and no playback buttons.
Evidence: `out/death-star-preview/measurements.json` and captures in that directory.

Each successful strike notifies the defender separately; secession sends one
additional `colony_lost`. Redelivery creates neither extra damage nor duplicate
notifications. Four hits release a colony initially at 70 loyalty; five rapid hits
release one initially at 100, and the secession regression verifies the returning
mobile fleet and neutral caretaker.

Database prerequisite: apply `0151_death_star_surface_hits.sql` with the normal
migration workflow before running the updated backend. It has been applied only
to the isolated verification database during this review.

The owner subsequently requested removal of the disposable preview. Its HTML,
React entry, stylesheet and dedicated browser verification command were removed;
the production renderers, regression tests and recorded evidence remain.

## Scope for later separation from master

Production visuals: `apps/web/src/galaxy/PlanetField.tsx` removes the old EMP cage
and fixed recovery sprites; `PlanetSkinModel.tsx` groups damaged instances and
composes their surface materials; new `planetImpactMaterial.ts` supplies rotating
red fissures and visual levels 1–5. `docs/visual-design.md` records that language.

Successful-hit persistence: only the `empHits` addition in
`apps/server/src/db/schema.ts`, its updates in `services/strategic.ts`, public
state in `services/publicGalaxy.ts`, and the optional EMP `hits` field in
`apps/web/src/api/schemas.ts`. The database change is only `planets.emp_hits`;
the current SQL is `0151_death_star_surface_hits.sql`.

Loyalty residue: only `DEATH_STAR.colonyLoyaltyZeroTolerance` in
`packages/rules/src/constants.ts` and the corresponding strike calculation in
`services/strategic.ts`. Other speed, build-duration, radiation and fleet-health
changes in those shared files belong to separate work.

Regressions: new `apps/server/test/death-star-burst.test.ts` and
`apps/web/test/planet-impact-material.test.ts`; additions in
`apps/server/test/contract.test.ts` and `apps/web/test/death-star-impact.test.ts`.
The live renderer's `planet-visibility.test.tsx` evaluator now traverses the
grouping fragment while retaining its compaction, picking and matrix assertions.
Notification dispatch already existed and was verified, not implemented here.

When isolating this change, copy only these hunks from shared dirty files and
regenerate the migration journal/snapshot against the destination branch. The
current snapshot includes other pending migrations and must not be copied whole.
Deployment is now authorized. The isolated release branch starts from the live
`cda19955355296403c9a4bf596f378746c984cfb` so deployed renderer improvements are
preserved. Only task-owned hunks were applied; the migration was regenerated as
`0151_death_star_surface_hits` against that branch (one additive integer column).
The dirty local master and unrelated pending work remain untouched. The selected
release branch replaces the runbook's default master reference for this release;
checkout, OCI, all runtime roles and public web still must share one pinned SHA.
