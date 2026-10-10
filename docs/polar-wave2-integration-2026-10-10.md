# Second cosmetic wave — Polar integration (10 October 2026)

Requested: merge PR #2 into master, preserve local work, and complete the existing Polar MVP for the new cosmetics.

Requirements and risks recorded before implementation:

- Merge the 18 new cosmetics: 16 paid products (four rings, two engines, ten standards), plus two included standards. Existing local asteroid, store, colony and monument work must survive unchanged.
- Extend the existing sandbox and production catalogues using the approved category prices: rings/standards EUR 1.99 and TRY 49; engines EUR 2.49 and TRY 69. Keep all 30 existing paid offers and their provider IDs/prices intact.
- Every new paid product needs a distinct product per environment, one-time public availability, inclusive regional prices and its own artwork. Never sell the four included standards. Re-running provisioning must reuse matching products rather than create duplicates.
- Keep checkout, verified webhook delivery, ownership and refunds on the existing server-authoritative path. Verify all new IDs, EUR/TRY quotes, provider checkout amounts, purchase/refund/replay behaviour, and existing purchase protections. Do not charge live cards or change the existing production webhook.
- Match config JSON, env templates, optional local environment configuration, both public price pages and the in-game catalogue. Missing mappings, wrong environment IDs, stale twenty-item assertions and absent public price entries must fail tests before implementation.
- Verify typecheck, lint and ordinary tests sequentially at low priority with one worker. Do not run economy simulations. Visually check the public price pages on phone and desktop.
- Existing CI fails before tests because pnpm/action-setup requests version 9 while packageManager pins pnpm@9.15.4. Use the packageManager pin and trigger checks for the repository's master branch.
- Provider catalogue provisioning is authorized by the integration request. Production application deployment is separate; record exact environment/deployment steps without restarting production during this task.
- Deployment review: the old image rejects new catalogue IDs in its env parser, so retain the old mapping with the rollback image. Old open clients also reject unknown IDs in inventory/equipment responses. New clients must declare the cosmetic IDs they know; requests without that declaration receive the frozen pre-wave-two inventory view. This changes response compatibility only: purchase/equip/refund rights still use the complete authoritative ledger. Test current/legacy/subset/empty/malformed declarations and prove hidden rights are retained.

Touched surfaces: the CI setup, provider catalogues, Polar mapping/config tests, publisher pricing pages/tests, the inventory response service/route and client declaration, release documentation. Shared purchase/refund logic should need no new implementation because it already derives accepted IDs from the shared cosmetic catalogue.

Visual amendment requested by the owner: remove all eight raised Inferno half-torus arcs,
the diagonal secondary Nebula belt, and the crystal-free secondary Prism belt. Keep each
main belt, its motion, and all Prism crystals. Shop, inventory, world rendering and the
three public/provider thumbnails must show the same revised appearance. Remove unused
arc shaders and the secondary-belt-only shader controls, and update the Inferno lore
that described removed arcs. This is a design change, covered by the design exception
to the logic TDD requirement; verify the real 3D render and the existing effect tests.

Rollback boundary: once a new-item checkout intent exists, a pre-wave-two image is unsafe even if its old env mapping is restored. Its old webhook enum ignores the new item after recording the event as seen, which can lose a delayed payment/refund. Keep a rollback image that understands the new catalogue, or forward-fix; document this before activation. No database schema changes are needed.

Baseline PR validation: merge `6e6a562`, typecheck and lint pass; 2,025 rules tests, 3,040 server tests and 5,636 web tests pass (10,701 total). Existing skips: one server and 29 web. PR #2 is merged on GitHub; local master preserves all previous work.

## Provider validation

- Initial read: 30 active products in each environment, none of the 16 new paid cosmetics. The catalogue acceptance assertion failed at 0/16 as expected.
- Created all 16 sandbox products with their individual WebP artwork, then verified their public, one-time, inclusive EUR/TRY prices.
- Created all 32 real sandbox checkout combinations through `createPolarCheckoutSession` (16 appearances × EUR/TRY). Every returned currency and total matched the application price, including TRY 49 rings/standards and TRY 69 engines. No sandbox card was charged during this amount check.
- Created the corresponding 16 live products after the sandbox amount check. Both environments now contain 46 active paid offers. Provider IDs are distinct between environments.
- Re-read both catalogues: all new products are reused, with no duplicates. All 30 original product IDs and their complete price records remain unchanged. The existing production webhook remains the intended delivery target; no production application rollout or live charge was performed.

The checkout amount evidence contains product IDs, currencies and totals only. Checkout URLs, access tokens and webhook signing secrets stay outside the repository.


## Regression qualification

- RED before implementation: 31/45 selected server assertions fail for the missing mappings
  and incompatible inventory responses; 8/151 selected web assertions fail for missing
  public entries/included-standard copy and the absent client catalogue declaration.
- GREEN after implementation: all 45 selected server tests pass. Sixteen paid IDs are
  exercised through concurrent checkout, authenticated delivery, equipment and full refund;
  replay, mismatched ownership/product, partial refund, refund-before-payment and independent
  manual grants are covered. All four included standards reject paid checkout.
- Inventory compatibility tests cover missing/empty/subset/unknown/oversized declarations,
  per-hull ship equipment, free flags, authentication and ownership. Filtering does not
  revoke ledger entries. The client retry test requires the same catalogue declaration and
  refreshed authorization after a 401.

- All 151 selected web tests pass. Public pages require all 46 offers and all four included
  standards; the two client tests verify catalogue headers and refresh retries.
- Three additional restart tests pass: after a pending new-item checkout is persisted,
  replace the app with the compatible build using the old twenty-extra mapping and disabled
  sales. Payment still grants the correct right, full refund removes it, and late payment
  replay cannot restore it. This is the documented compatibility-first rollback path.
- GitHub CI now gets through pnpm setup/install/typecheck but exposed a pre-existing
  absolute local `fflate` import in `tools/xlsx.ts`. Replaced it with the normal package
  import and declared the already-locked `fflate@0.8.3` development dependency. A fresh
  manifest-only frozen-lock check passes; a small generated XLSX opens as a ZIP with valid
  escaped XML, numeric cells and invalid control characters removed. No economy study ran.
- The merged PR and portable import pass the complete GitHub CI gate at `0b360fa`:
  frozen installation, typecheck, lint and ordinary tests. Failure logs are also surfaced
  as job annotations for future diagnosis. Post-integration source has passed local
  typecheck and lint; the release must pass its own complete CI gate before qualification.

Sanitized provider amount evidence: [32 checkout totals](evidence/polar-wave2-provider-checks-2026-10-10.json).

## Manual qualification

- Paid three real sandbox hosted checkouts using Stripe's test card: Saturn Crown EUR 1.99,
  Tempest Drive TRY 69 and Sovereign Lion TRY 49. The existing receiver verified Polar's
  real signatures and granted exactly those three rights. The current catalogue view
  returned them; the legacy view remained readable and retained the unrelated manual
  Aurora right.
- Fully refunded all three sandbox orders through Polar. Net refunds plus refunded tax
  equal each order total; purchased rights disappeared while the manual right remained.
  Redelivered the three original paid events through Polar's own delivery API after refund:
  each returned HTTP 200 and no refunded right returned.
- The temporary receiver stopped during the run; ten delivery attempts failed before it
  restarted with the same database, account and checkout intents. All three paid orders
  subsequently delivered successfully. Across payment, refund and explicit redelivery,
  nine successful signed callbacks returned HTTP 200. No intent or receipt was deleted.
- Removed only the temporary sandbox endpoint and stopped its receiver/tunnel/preview.
  Re-read both environments: the two original disabled sandbox endpoints and the original
  enabled production endpoint match their pre-task snapshots. No live card was charged.
- Captured the revised Inferno, Nebula and Prism products through `node tools/visual.mjs`.
  All three real shader programs render without errors; Inferno has no raised arcs,
  Nebula and Prism have no crossing secondary belt, and Prism retains its crystals.
  Store navigation and inventory pass at 350 and 1,280 pixels without horizontal overflow.
  The visual harness was temporarily limited to these three products, then restored byte
  for byte; other product thumbnails were not regenerated.
- Updated the three WebP thumbnails and their matching sandbox/live product media.
  Verified all six SHA-256 media digests against the committed assets, with product IDs,
  names, metadata and prices unchanged. Inferno lore in all six locales and both provider
  descriptions now describes the remaining plasma filaments and inner rim.
- Both public price pages pass at 350 and 1,280 pixels: 46 priced offers, matching API
  amounts, every image loaded and no overflow or JavaScript errors. Preview font files
  are explicitly permitted from the shared local dependency tree.

Sanitized evidence: [sandbox payment, refund, replay and visual checks](evidence/polar-wave2-manual-checks-2026-10-10.json).
Local captures: `out/polar-wave2/rings/` and `out/polar-wave2/pricing/`.
Sandbox payment method and email delivery limitations: [Polar sandbox documentation](https://polar.sh/docs/integrate/sandbox).
