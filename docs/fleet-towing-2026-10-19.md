# Fleet reward towing

Scope: visual only. Pirate capture (one), signal DERELICT (one), convoy award (one–three); represent every awarded hull separately behind the returning formation, in a single nose-to-tail chain attached to the existing foremost central formation ship (owner correction). No engines/wakes on towed hulls. Shared owner/contact renderer; exact towing metadata follows Telescope identification, without revealing routes, ownership, resources or private signal outcomes.

Edges: outbound/unresolved/recall/no award => no tow; same-type awards remain separately visible without double-counting; absent/zero/lost rewards clamped to actual fleet; empty escort cannot tow itself; many escort markers and large rewards must clear the entire fleet; stable ties, finite zero-length geometry, heading updates, depth-tested planets, disposal. Multiple rewards connect to each other in a single straight trailing train; only the first connects to the formation tip. Signal site/outcome remains private; only its physical flight becomes sensor-visible.

Affected paths: session pending projection, traffic snapshot/projection (signal flights currently missing), client Zod contracts, owner/foreign formations, new cable rendering and layout helper. No reward, combat, speed, damage, delivery or persistence changes. Legacy pirate/convoy units exclude awards; HP physical rosters include awards. Normalize visual fleet without altering stored units. Tests first: layout/geometry, API preservation, projections and existing reward/flight regressions. Visual verification via tools/visual.mjs.


Implementation: the ship chain reuses FormationHulls, including its existing LODs and material disposal. All alternating torus links/collars use one InstancedMesh (64 triangles per link); the first cable is capped at 48 links, later cables at 24 each. Movement uses the server clock, bounded roll, existing model attachment coordinates, dynamic instance matrices and galaxy frustum culling. No rigid-body physics or per-frame React updates. Hit bounds include the prize train. Generic launch/arrival invalidations refresh signal flight traffic, without broadcasting signal identifiers or outcomes.

Verification: tests cover multiple identical prizes, counts beyond three, no tug, lost prize, safe home after pad capture, schema preservation, owner exclusion and sensor privacy. Existing contract, pirate, convoy, signal, traffic and rendering regressions are checked sequentially with one worker. A shared PostgreSQL checkpointer was killed during an initial traffic run; the affected traffic suite was rerun successfully against a disposable isolated database. No shared database settings were changed.


Visual evidence: `out/fleet-towing/` contains owner baseline, single-prize, three-prize, observer side and 350×812 portrait frames plus measurements. The three-prize chain uses 70 link/collar instances, 4,480 triangles and one draw call. The staged owner formation measured 24 draws / 72,978 triangles at the final close camera; portrait measured 24 / 65,438. These are SwiftShader scene counters, not device FPS. Chain depth testing, finite instance matrices and absence of prize engines/wakes are asserted by the browser harness.


Owner visual revisions: prize centers now share the formation's middle axis (local X=Y=0), without the previous lowered train or deep hanging loop. Link transverse scale and attachment collar diameter are half their original values; chain length and link counts stay unchanged. A write-free `v2-gallery.html?view=fleet-towing&lng=tr` preview exposes 1/2/3 prizes and owner/observer controls for direct inspection.


Final review: explicit two-prize and three-prize center-axis frames were inspected after the width reduction. Browser checks also open the interactive gallery, switch 2/3 prizes and switch to the identified observer, with no page/console errors. Screenshots: `owner-double.png`, `owner-top.png`, `interactive-2-ships.png`, `interactive-3-ships.png`. The local preview is served on port 5199 for the owner to inspect. The disposable test database was removed after verification.
