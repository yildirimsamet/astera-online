# Clan Joint War — Full Code Review

Date: 2026-09-21

## Scope

This review follows a joint war from schema and rules through API transactions,
worker settlement, cache hand-off, member/leader controls, reports, localisation,
and the 350 px mobile layout. It covers the Phase 8–12 implementation and the
shared code changed by it. Unrelated economy simulations and snowball audits are
outside this pass by owner request.

## Behaviour scenarios reviewed

- A leader marks, cancels, and starts an operation, including an empty operation,
  shield loss, membership changes, season boundaries, and target ownership drift.
- A member quotes, sends, recalls, stages, fights, returns, loses a source world,
  or changes membership while a contribution is unresolved.
- A commander owns several worlds and donates or contributes from a world other
  than the currently selected world.
- Several members contribute different hull classes and technologies; damage,
  casualties, loot, salvage, Dominion, fuel, bay use, and hangar reservations
  must conserve and be assigned deterministically.
- Worker settlement overlaps clan management and ordinary world writes.
- Attacker, defender, clan participant, coordinator, and unrelated viewers open
  traffic and battle reports without receiving extra fog-of-war information.
- Old and rolling-deploy payloads omit newly added optional presentation data.
- Every control remains understandable and usable at 350 px in all five locales.

## Impact map

| Area | Main risk |
| --- | --- |
| `packages/rules` combat | A wrong damage share changes loot and Dominion allocation while the battle result still looks valid. |
| Server services and worker | Lock inversion can deadlock settlement; missing revalidation can launch an ineligible leader; lifecycle holes can orphan an operation. |
| API schemas and cache | Zod can silently strip public data; a mutation can overwrite the active world's cache with another world's snapshot. |
| Clan war composer | Shield acknowledgement can become impossible; changing worlds can submit hidden ships from the previous world. |
| Reports | Existing audit data can remain invisible, preventing players from understanding allocations and return state. |
| Public clan UI | Missing level data removes the only public progression signal required by the feature. |

## Confirmed findings

Statuses are updated as regression tests and fixes land.

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| JW-R1 | Critical | A protected contribution quote includes `SHIELD_WOULD_DROP`, so `quote.ok` is false; the UI continues to require `quote.ok` after acknowledgement and can never send it. | Confirmed |
| JW-R2 | High | Donation and contribution share one world selector; changing contribution origin retains hidden fleet values from the previous world. | Confirmed |
| JW-R3 | High | The backend publishes public clan level, but the web schema strips it and directory/profile surfaces omit it. | Confirmed |
| JW-R4 | Medium | The launch surface always asks for shield acknowledgement and has no authoritative leader-specific indication that launch will drop a shield. | Confirmed |
| JW-R5 | Critical | Start revalidates contributors' tier bands but skips a fleetless operation leader who is still a participant. | Confirmed |
| JW-R6 | Critical | Leadership transfer and clan disband are allowed when an active operation has no contributions, which can orphan control of the operation. | Confirmed |
| JW-R7 | High | Joint settlement locks player ledgers before score clans, opposite to clan management and ordinary settlement. | Confirmed |
| JW-R8 | High | Worker arrival locks only mission endpoints while joint settlement writes escrow rows on every contribution origin world. | Confirmed; fix design in progress |
| JW-R9 | Medium | Several joint paths do not match the documented operation/contribution/player lock order. The season row serialises normal joint paths, but the invariant comments are inaccurate and external clan operations still matter. | Partly mitigated by season lock |
| JW-R10 | High | Per-contribution hull damage applies one global overkill cap and ignores carried partial defender damage, misallocating reward shares across hull classes. | Confirmed |
| JW-R11 | High | Joint reports omit base/adjusted transfer, participant salvage, wave loot/salvage, and return destination/status already needed to audit the result. | Confirmed |
| JW-R12 | Medium | Donation inputs show treasury room but not selected-world holdings, allowing predictably refused amounts and coupling unrelated controls. | Confirmed |
| JW-R13 | High | Contribution success writes a raw pending array into an object-shaped cache and can replace the active world's pending/traffic snapshots with another world's data. | Confirmed |
| JW-R14 | Low | Joint report destination-name collection concatenates the same IDs twice. | Confirmed |

## Design checks

- **Clarity:** show selected-world holdings, public clan level, allocation audit,
  and each returning wave's state and destination.
- **Predictability:** keep quote inputs visible, distinguish a shield acknowledgement
  from blocking refusals, and show base versus adjusted Dominion transfer.
- **Decision support:** constrain donation amounts to both treasury room and world
  holdings; expose the data required to understand why each participant received
  their result.
- **Interaction cost:** keep donation and fleet origins independent, reset stale
  values on origin changes, and retain the one-screen workflow at 350 px.

## Verification plan

Each logic fix receives a failing regression test before implementation. Then run
the focused rules, server, and web joint-war suites, workspace typecheck and lint,
followed by a 350 px visual pass with `node tools/visual.mjs`. Heavy unrelated
economy and snowball suites are intentionally excluded.
