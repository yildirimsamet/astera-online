# Galaxy visibility — 4 November 2026

Owner requested deployment of this task alone. Release base is the actual production
commit `85977d9e5d468cf695c8e23f7d7b1aabf295f759`, not the shared working tree's HEAD.
The shared tree's starter-galaxy work and two unpublished capacity commits are excluded.

Scope: remove the broad central disc cloud; restore the planet-size multiplier;
brighten planet bodies and add a subtle unresolved-world rim shine; soften the sky;
double travelling craft and triple asteroid sizes. Preserve monument model sizes and
increase convoy formation spacing in proportion to its hulls.

Planet annotations use camera-up offsets. Only unresolved non-owned worlds carry an
eye-off icon, with smooth distance-dependent size and grey tint. Name width caps double.
Explicit selection restores a close camera distance in either direction, with room for
large formations. Opening Telescope/Radar fits the active sensor sphere only when it
does not already fit; closing and background refreshes preserve the camera distance.

Compatibility: no schema, API, event, timing, ownership or season-generation changes.
The shared `worldRadius` change also affects existing visual flight endpoint and sensor
intersection calculations. Deploy matching APIs and worker, followed by the web client;
already-open clients remain API-compatible. Existing in-flight timestamps remain stored.
Arena runtime and all production feature flags retain their previous configuration.

Validation on the isolated source: whole-workspace typecheck, lint of all changed
TypeScript files, 308 targeted web tests and 133 rules tests passed. The normal visual
runner passed all five planet-selection checks. Real local authenticated galaxy checks
used 42 planets and eight monuments: repeated selection returned to distance seven;
Telescope and Radar opened fully in frame and closing preserved distance, with no page
errors. Long economy/snowball tests were not run, per owner instruction.

Deployment uses immutable server/web artifacts, the exact existing runtime Compose
configuration with only the four application image references changed, and a retained
image/web/config rollback. A fresh production dump was restored into a separate
disposable database: 228 migration records, 1,797 accounts and 280 planets. There are
no pending release migrations. Private runtime files, dumps and postflight evidence
remain outside Git in the VPS release directory.
