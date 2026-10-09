# Cosmetic sales — 9 October 2026

Owner-approved regional prices (minor units in provider configuration):

| Collection | Türkiye | Outside Türkiye |
| --- | ---: | ---: |
| Four ship models and UFO probe | ₺99 | €3.99 |
| Three planet rings | ₺49 | €1.99 |
| Four engine trails, including Titan | ₺69 | €2.49 |
| Eight premium clan standards | ₺49 | €1.99 |

These are regional prices, not an exchange-rate conversion. The two included clan
standards remain free. Existing planet and elemental bundle prices stay unchanged.
The owner's explicit deployment scope is every change in the current `master`
worktree; `feature/komutan-gemisi` and its separate worktree are excluded.

Acceptance covers complete, distinct sandbox/live product mappings; the approved
TRY/EUR quote for each paid item; one-time inclusive prices in Polar; checkout
amounts; authenticated purchase, verified delivery and refund; public price pages;
and production environment forwarding to every API and worker. Existing payment,
ownership, hull binding and refund regressions remain required. Long economy
simulations and snowball audits remain excluded unless explicitly requested.

Test-first regressions are in `polar-catalog.test.ts` and
`publisher-pricing.test.ts`. Provider setup uses the existing Polar MCP endpoints
with the locally stored credentials; secrets never belong in this document or Git.

Both Polar environments now contain the twenty new, public, one-time products with
separate EUR/TRY prices and inclusive tax behavior. Each product has its actual skin
artwork attached. The ten pre-existing products were compared with the pre-release
catalogue and preserved. Canonical IDs and prices are in
`config/polar-cosmetics.sandbox.json` and `config/polar-cosmetics.production.json`;
the respective environment templates carry the same mappings. Production Compose
passes the mapping to all three APIs and the singleton worker.

All forty sandbox checkout combinations (twenty items × two currencies) were
created through the application's checkout service and matched the expected total.
Five real sandbox card payments covered ship, ring, engine, probe and flag; each
delivered only its purchased appearance. All five full refunds removed their Polar
rights and effective equipment. Replayed paid events neither duplicated nor restored
ownership. All sandbox webhook deliveries returned HTTP 200, and the temporary test
endpoint was disabled afterwards. No live test charge was taken.

The English/Turkish public pricing pages now include all thirty paid offers, with
country pricing and category/hull descriptions. Both pages were checked at 350px
and 1280px: all artwork loaded, no horizontal overflow and no page errors.

The complete master release also carries the existing fleet escape threshold change
to 3.5, monument probe loss change to 75%, cosmetic previews/equipment and trials,
planet selection and loading wordmark fixes, and the explicit long-test opt-in rule.
It adds migration `0145_cosmetic_equipment` (an account JSON column with an empty
default). Production rollout must prove the retained API and worker survive this
addition on a restored backup before applying it and rolling API1 → API2 → API3 →
worker. Seasons, live calendars and asteroid generation are not changed by this
release. The separate commander-ship feature worktree is not merged.
