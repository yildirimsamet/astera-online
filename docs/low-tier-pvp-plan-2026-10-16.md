# Tier 1–3 PvP protection — 16 October 2026

## Approved behavior

Use the defending commander's highest currently controlled Core, across every world,
at resolution/observation time. Core 1–9 is tier 1–3. For those commanders:

- Decisive loot: 25% of stock above the Vault floor; 15% of uncollected Works.
- Partial loot: 12.5% of exposed stock; 7.5% of Works. Repelled: zero.
- Recovery: at least 2 net production hours lost in the last 8 hours grants 12 hours.
- Existing production calculation, positive raid-profit deduction, outbound-PvP refusal,
  shield forfeiture and the struck world's 50% production bonus remain in force.
- Tier 4+: existing 60%/30% decisive, 30%/15% partial, 4h loss / 6h history / 8h shield.
- Pirates, neutral planets, convoy rewards, salvage and cargo capacity keep existing rules.
- Colony battle faults retain their existing 4h net-loss / 6h history condition; reducing
  the shield threshold must not make faults more frequent for beginners.

## Implementation map and risks

1. Shared rules: one typed PvP balance profile; loot, shield eligibility and expiry use it.
   Keep the standard profile as the default for NPC and historical callers.
2. Server: normal and joint raids, probe readings and own-world comparison use the same
   commander profile. Never infer the commander's tier from a small colony or attacker.
3. Recovery history: include the current defeat exactly once; strict lower time boundary;
   gather 8h for low tiers but preserve the separate 6h fault condition. Lock order stays.
4. Persist the profile on new player battle reports with a nullable additive column.
   Old reports use the standard profile. Later upgrades must not rewrite old verdicts.
5. Client contract, battle explanations and EN/TR Wiki: publish actual stock and Works
   rates and recovery settings. No double reduction of already-adjusted probe estimates.
6. Tests first: rates and resource split for all grades/resources; cargo and floors;
   tier 3/4 boundary; colonies; attacker tier independence; history 6–8h and exact 8h;
   exact 2h threshold; longer shield/boost and no shortening; NPC and tier 4 regressions;
   snapshot contract and UI descriptions. Existing resource transactions and concurrency
   suites cover rollback/idempotency. Run ordinary checks sequentially with one worker,
   nice priority and at most 4 GiB Node heap. No economy simulations authorized.

## Workspace

Work directly on master as requested. Existing unrelated edits are preserved; tracked
source baseline copied to `/tmp/astera-low-tier-pvp-baseline` before task edits.

## Validation

Implemented and reviewed on master. The new rules failed before implementation and
passed afterward. Full rules: 2,411 tests passed. The initial complete web run had
6,555 passes and one obsolete Wiki expectation; that file was corrected and its 12
tests passed. After CR fixes, all 170 tests in the six affected web files passed,
as did all four workspace typechecks. Focused server/model checks: 20 passed.

The final ordinary server suite is running against a dedicated test database.
Backend/rules and tools/model lint passed. Global web lint currently reports an
unrelated error in a mobile config added by another concurrent task. Report and
Wiki visual checks passed initially; the final report preview hit a duplicate
development-module context and will be repeated on a fresh Vite instance.
Detailed findings and final results: `docs/low-tier-pvp-cr-2026-10-16.md`.
