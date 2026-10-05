# Resource state audit

Requirement: every surface reads the same spendable stock for the same world. Production
belongs to the Works until collection; fuel and cargo spend stored deuterium. The server
remains authoritative.

Found: the top meter retains an animation counter after its animation is interrupted,
and uses a collection's old target as a minimum after a later spend. `WorldProvider`
exposes the `/planets` response while the header and economy read `/planet/:id`;
single-world reads and optimistic changes do not update those list readers. Works
projection also omits refinery deuterium and anchors server production to response time.

Coverage before implementation:

- Collection, spending, refunds, reward/depot claims, trade fuel and cargo: one reading
  across header, economy and owned-world consumers, including zero and overflow.
- Pending purchases, rejected purchases and a newer update during rollback.
- Older list/single-world/mutation responses arriving after a newer snapshot.
- A newer list read after a competing single-world read, and external credits
  received during both successful and refused purchases.
- Fresh list responses updating inactive worlds; switching worlds during collection.
- Cargo arriving on an inactive world with a missed SSE event.
- Queued purchases, collections and launches retaining the tapped world's identity
  after selection changes; reward capacity checked at its capital destination.
- Background resync, missed events, and production after network delay, disruption,
  recovery boost and storage/Works caps.

Touched boundaries: planet view contract, React Query world normalization/subscriptions,
resource mutation reconciliation, arrival refresh, Works projection, and the top meter's decorative
collection effect. Existing gameplay costs, ownership rules and transfer rules stay intact.
All existing callers of `useWorld().worlds` must receive the canonical per-world views.

Code review also covered mutation ordering, cancellation, rollback, structural sharing,
legacy capital aliases, selection during pending writes, event/focus recovery, and all
stock consumers. Review findings fixed: fresh list responses discarded after a competing
read; credits discarded while an optimistic purchase is pending; non-planet-view spends
outside the per-world mutation lane; inactive-world arrival refresh; colony stock used
for capital reward capacity; and queued operations sent to a newly selected world.
Mutation metadata captures the physical origin before TanStack waits; UI selection
cannot redirect a pending spend or launch. Deferred reads are retried after settlement.

The second end-to-end review reproduced four additional failures before their fixes:

| Finding | Trigger and consequence | Resolution |
| --- | --- | --- |
| P1: two mutation queues disagree | Queue a capital collection, select a colony, and start another purchase. TanStack updates the old mutation's scope but retains its original queue membership; the collection can pause indefinitely. | Use the existing per-world turnstile for prediction, request, reconciliation and rollback. Remove the redundant TanStack scopes. Origin metadata remains captured at the tap. |
| P1: cancelling a list loses another world's credit | A purchase cancels a pending `/planets` read carrying cargo credited to another world. Its stock stays stale until a later refresh. | Keep the list read running. Normalize each world against its canonical snapshot, preserving the purchase's newer result and the other world's credit. |
| P2: probe reconciliation releases early | The probe POST spends alloy/crystal but returns no planet view. The next purchase predicts against the balance from before the probe. | Await the planet and world refreshes before releasing the source world's turn. |
| P2: refresh changes the selected world | With unavailable localStorage, every world-list update resets a valid colony selection to the capital. The visible resource balance changes worlds unexpectedly. | Bind the in-memory selection to its commander/season storage key, preserve it during refresh, and restore persistence only on initialization or when ownership invalidates it. |

Six regressions reproduce those failures, covering independent-world success/failure,
list reads started before/during a purchase, probe reconciliation, and unavailable
storage. A separate cancelled-read case verifies that even a newer abandoned response
cannot publish side effects. Resource tests now use the application's Date-aware
structural sharing and parse a fresh response for the identical-prediction case.
The three no-input mutations use `void` as their variables generic, preserving
`mutate()` without lint suppression or casts.

Verification scope follows the owner's latest instruction: resource/state/claim/fleet
regressions, typecheck, lint and browser checks. Economy simulations and snowball audit
are excluded from this task's final validation.

Final validation (2026-10-05): 544 web tests across 29 related files and 86 real-database
API contract tests passed (630 distinct tests). Workspace typecheck and lint passed.
After the final no-input type annotation adjustment, 98 focused tests and web typecheck
passed again. Browser checks at 350 px and 1280 px passed: real WorldProvider, HudTop
and PlanetScreen with controlled API fixtures; collection followed immediately by
spending shows 536 alloy, 500 crystal and 2 deuterium consistently, then world switching
shows the colony's own balance and clears the previous world's collection particles.
`git diff --check` is clean. No implementation issue found in this review remains open.
