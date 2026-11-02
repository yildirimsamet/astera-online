# Legacy showcase review — 2 November 2026

The change adds localized season captions to both showcases, replaces “Gösterişçi” with “Stil Sahibi”, opens locked goals in a focused detail dialog, removes the map name’s trailing cup, hides the internal combat-outcome table, and gives server-operated commanders stable selections of two or three existing common pieces.

## Confirmed review findings

1. Career awards with a known source season lost their season caption because presentation checked only `scope === 'SEASON'`. A failing presentation test reproduced it. Display the known ordinal for every applicable piece; keep physical engravings and thumbnail cache identities unchanged.
2. A monument goal one second short of completion said “1 hour remaining”. A failing dialog test reproduced it. Use the existing precise duration formatter for the remaining interval.
3. Existing accounts that already held every selected starter piece kept an empty showcase because initialization depended on a newly inserted award. A failing persistence test reproduced it. Store a private initialization receipt in existing award evidence and fill an empty shelf once. Preserve occupied shelves, later removals, administrative revocations and all other evidence.
4. Old ledger evaluators would revoke the synthetic starter awards during a mixed-version roll. The activation test first failed with the switch disabled. `BOT_LEGACY_ENABLED=false` now defers initial grants; already initialized awards remain valid if the switch is later disabled. Roll every API and worker with the switch false, verify all processes use the candidate, then activate and populate only the roster accounts.

No competitive podium, payment entitlement or gameplay resource is fabricated. The initialization receipt stays out of public award responses. Account-specific selection is stable across retries, concurrent reads, restarts and seasons. No schema or shared gameplay-rule change is required.

## Validation

- Initial related regressions: 11 web files / 176 tests and 22 server files / 244 tests passed.
- Post-review candidate: the same 176 web tests and 39 ledger/API/initialization tests passed, including inactive/active rollout states and occupied/empty existing shelves.
- Browser review: mobile 350 px, desktop 1280 px, nested dialog dismissal/focus restoration, ordinary visitor/owner actions, season captions and private outcome-table removal.
- Complete lint coverage: 2,997 authored files passed in 54 sequential batches.
- Source type checking passed for rules, server, web and simulator. Test-root checks passed after retaining original browser-global declarations, except one unchanged five-file group (`faults`, `first-scene-frame`, `fleet-cards`, `fleet-escape`, `fleet-towing-gallery`) that exceeds the 2 GiB heap. The exact same five roots, compiler options and limit were checked on pristine production source `a04095f5`: it also exits with `SIGABRT` / heap exhaustion. No new type diagnostic remains; full client type checking is **not** represented as passed.
- Full checks must respect the owner's local 2 GiB heap ceiling. Large single-process checks exceed it; run smaller sequential groups without changing compiler or lint rules. Record their actual results with release acceptance.

## Release constraints

Build on the current production parent `a04095f5c35bfee8ffb752cfdbff41aa49b3cc39`; do not publish the unrelated local branch differences. Retain the exact runtime environment, arena image, webroot, Nginx configuration, source/image identifiers and verified backup. Qualify old/new reads and showcase writes on an isolated restored database. Publish only after healthy candidate APIs and worker; retain old hashed assets.

After activation, a backend rollback must retain the new legacy evaluator. The previous evaluator cannot preserve these starter awards. A previous web build remains compatible with the unchanged API shapes. Never restore a stale database over subsequent player writes.
