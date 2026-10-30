# Commander menu web release — 30 October 2026

Scope: web menu hierarchy, support page, /profile sheet and route. Parent is the production checkout `0135cc0bf7df3aa3847077ff5096f9020064df4b`; server, shared rules, API client, runtime, mobile packages, database and feature flags remain exactly that parent.

The working tree also contained separate Notification Center, planned-maintenance and server cache work. They are excluded. Android-only Notification Center hooks in the menu were omitted from this web backport because production does not yet implement that feature; all pre-existing production web controls are preserved. The normal development tree retains that native functionality for its separate coordinated release.

The profile keeps its /profile address and opens in the shared Sheet below the TopBar, without unmounting the galaxy. Support is a primary-colored main entry above Settings; its developer note is expandable. Owner CSS edits are included.

Web publication retains old hashed assets, backs up the existing webroot/vhost and adds only the exact /profile Nginx rewrite after the new web files. API/worker images, schemas and player data are not touched. Web and runtime have separate release identities for this client-only release.

Qualification: 273 tests passed across 16 files using two fork workers with 1024 MiB heaps. Web typecheck passed. Eight browser scenarios covered six languages, compact screens, long names/rewards, navigation restoration, support details and /profile beneath the TopBar, with no horizontal overflow or page errors. Changed TS/JS files are linted in sequential groups before the production build. Production public build flags are retained.
