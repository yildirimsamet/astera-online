---
name: user-execution-mode
description: "This user wants execution, not deliberation — decide small things yourself, ship, and only ask when core product direction changes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 553ba8c9-2b15-4a5b-838b-03e499d77bd8
  modified: 2026-08-15T16:44:57.364Z
---

Once this user says a project is out of the design phase, **default behaviour is to move it
forward**: `IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE`.

**Decide yourself, without asking:** architecture, folder structure, library choice, query
optimisation, caching, component design, internal API shape, test design, small UX details,
naming, refactors.

**Ask only when** a change alters the core loop, the risk/reward structure, the product's
identity, or a decision already marked locked.

**They explicitly do not want:** re-researching settled questions · endlessly improving design
documents · waiting for every uncertainty to resolve before building · approval requests for
small technical choices · redesigning a working system because something better might exist ·
treating feature count as progress.

They also said the inverse matters just as much: **never quietly drop or simplify core
gameplay because it is hard to build.** Ask instead what the simplest version is that
preserves the intended experience. "Simple implementation" is good; "simplified gameplay" is
a product decision that must be deliberate and stated.

They write long, highly structured briefs in English but converse in Turkish. Deliverables
and documentation stay in English.

**Why:** they have watched agents loop on research and design instead of shipping, and said
so directly — "research is a tool, documentation is a tool, architecture is a tool; none of
them is the product."

**How to apply:** when stuck, pick the smallest reversible option and continue. Report what
changed and what is next; do not narrate every decision. See [[astera]].
