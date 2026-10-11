# Contact formation performance — 11 October 2026

Scope: fixes 1 and 2 from the admin recording review, implemented in the existing
master checkout. Keep the current appearance, animation, intel and gameplay rules.

Requirements and regression cases, recorded before implementation:

- Each owned geometry/material is released when that resource is replaced or its
  component unmounts. Replacing geometry must retain the live shader; changing a
  hull outline must retain the live body materials, including material arrays.
- Contact motion/time, selection, inbound status and remembered status must not
  recreate markers, formation slots, wake buffers or engine-light buffers.
- A real fleet composition/count change (including a partially filled marker),
  mass fallback change, mining/harvest craft change or kind/intel transition must
  still update the picture. Unknown contacts, probes and strategic craft retain
  their existing representations; empty formations must remain safe.
- API structural sharing already preserves an equal fleet branch across polling.
  Memoization can depend on kind, fleet, craft and mass instead of the whole
  contact. Per-frame motion continues to read the current contact independently.
- Separate mounted formations must own separate resources; replacing or removing
  one must not release another's resources. Retired and final resources must be
  disposed exactly once by their component.

Affected logic: `Foreign` marker derivation and the cleanup effects in
`FormationHullPartMesh`, `FormationPips`, `FormationRanks`, `Wake` and
`FormationWakes`, all in `apps/web/src/galaxy/Fleets.tsx`. Downstream formation,
nozzle and light memoization benefits from stable markers without changing its
rules. Cached source models, textures and materials remain externally owned.

Validation: write runtime regression tests, reproduce failure before changing
production code, then run focused tests, sequential typecheck/lint/ordinary tests
with one worker, and visual verification. Economy/season simulations are excluded
by the owner's standing instruction. FPS improvements require a comparable new
device recording; deterministic allocation/disposal regressions establish the
fix without inventing an FPS percentage.

Initial implementation checkpoint:

- Before the fix, six runtime regressions failed on marker identity or premature
  material disposal. After the fix, all 13 new regressions passed; the related
  route, instancing, engagement, structural-sharing and squadron suites brought
  the focused run to 104 passing tests.
- Typecheck passed in all four workspaces. The final diff passed whitespace review.
- The owner then requested avoiding test load because the PC was stuttering.
  The running full lint process was terminated; full ordinary tests, build and
  browser/visual verification were not started. There is no completed lint or
  device FPS result to claim.
- Changes are in master and served by the existing Vite frontend on port 5173.
  No separate worktree or production deployment was created for these fixes.

Detailed review before release:

- No blocking runtime defect found in the two changes. Each of the five cleanup
  sites now follows the identity of the resource it owns. Body materials are
  clones; source model materials, geometries and shared textures are retained.
- Checked installed React Three Fiber 9.7.0 disposal: it releases the host object
  and its reconciler children, not geometry/material constructor arguments or
  ordinary resource props. InstancedMesh disposal releases instance resources,
  so the component effects remain the owners of their cloned materials.
- `contactMarkers` reads exactly kind, fleet, craft and mass. `main.tsx` installs
  date-aware structural sharing; `useTraffic` and `GalaxyView` pass those shared
  branches through without cloning the roster. The narrowed dependencies cover
  every current formation input.
- The frame callback remains independent of the marker memo: it reads current
  contact coordinates, instants, landing and engagement, updates position and
  heading, and writes the current aim distance. R3F refreshes the callback ref on
  render, so retaining geometry does not freeze craft on an old flight window.
- Count/fill, hull composition, mass fallback, mining/harvest count, intel/kind,
  empty formations, focus, inbound and remembered states are covered by the
  focused regression cases. Asset/engine/skin dependencies remain independent
  of this memo and continue to update normally.
- The tests execute React hooks with real Three resources but mock frame
  registration and asset loading. They establish allocation identities and
  component disposal, not GPU rendering, Suspense timing or device FPS. Production
  acceptance must use the same admin overview/device/quality and a comparable
  50-second recording with moving traffic; retain counts and compare long frames
  and long tasks alongside FPS.
- Release only the fleet source, its regression test and this note. Existing
  edits to CLAUDE.md, deployment.md and WorksLine.tsx belong to other work and are
  excluded. Full qualification runs in the existing GitHub CI to avoid PC load.
  Server/rules/schema/network contracts are unchanged; rollout retains the
  existing private backup and hashed-asset rollback procedure.
