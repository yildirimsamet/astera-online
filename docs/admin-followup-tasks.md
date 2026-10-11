# Owner-requested follow-ups, 2026-10-11

Complete the admin task before starting these two separate tasks (owner steering).
Preserve the ongoing performance optimizations and validate the combined workspace
with sequential checks and all ordinary tests; no long simulations.

1. Special ship craft sheets: near the top, below How it works, add a noticeable
   bordered section explaining the actual special role. Cover Söndürücü and Hurdacı
   and other special hulls. Verify target/effect/capacity/outcome in current rules,
   show the real amount or rule, localize all six languages, and test the decision
   support before implementation. Visually check 350px and desktop.
2. Top bar: shrink the store button (remove its left icon if useful), put a full
   screen button immediately to its right. Research current official browser/OS
   support: Android, iOS, Chrome, Firefox, Safari and standalone/PWA behavior.
   Use feature detection and user gestures, handle enter/exit/error/events and
   unsupported browsers honestly. Provide a practical supported fallback where
   possible. Do not promise impossible iPhone behavior. Test before implementation,
   verify browser interaction and mobile/desktop layout, then complete all ordinary
   quality gates. User explicitly authorized this research.

## Special hull requirement analysis

The current `SPECIALIST` catalogue contains exactly `NULLIFIER` and
`GARBAGE_COLLECTOR`; ordinary combat hulls keep their existing progressive detail.
Place an always-visible, labelled, bordered role section immediately after How it
works and before the matchup/quantity controls, including when research is locked.
Nullifier: 1 + `SHIELD_BREAKER.bonusShieldDamageMult` times class-adjusted damage
against active Aegis; bonus damage never spills into ships/guns; ordinary attack
after the shield empties. Collector: join attacking combat ships, each survivor
lifts at most `SALVAGE.perCollector` resource units from that battle's wreck and
brings them home; no loot cargo increase, no defensive salvage, no independent
asteroid/public field mission. Values come from shared rules and locale formatting.
No balance, combat, crafting or dispatch changes. Affected files: craft sheet and
six locale trees, existing craft-sheet integration tests and browser visual harness.
Test visibility without expanding detail, correct limits, position, research-locked
state, both languages and omission from ordinary hulls; preserve build controls.

Special hull validation complete: 163 craft/collector/localization tests pass.
`tools/visual.mjs --special-ships` verifies both hulls at 350px/1280px in Turkish/
English: role visible without scrolling or expanding, correct rule values, border,
position and no overflow. Screenshots: `out/special-ships`.
