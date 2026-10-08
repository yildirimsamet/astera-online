# Wiki rebuild — scope and verification

The September stashes are references, not current patches. They are preserved unchanged.
`stash@{8}` has a useful rule-driven catalogue, block content and internal-link syntax;
only 30 article bodies exist and several refer to older sensor/capacity/research rules.
`stash@{7}` records disclosure restrictions which still apply. Code and tests override prose.

Implementation scope: standalone build-time HTML at `/wiki` (English) and `/wiki/tr`
(Turkish), category and article routes; one typed content/catalogue and React article
renderer shared with a lazy in-game sheet. Keep the existing Vite app, publisher pages,
legal links and Nginx deployment. No changes to gameplay, balance, account state or APIs.
Other game languages use the English Wiki, with an explicit language selector.

Requirements / edges to test before implementation:
- Complete bilingual content; exact catalogue coverage for buildings, instruments,
  satellites, hulls and research; no empty or placeholder pages.
- Stable lowercase paths; no duplicate IDs/paths; unknown, malformed and removed
  Wiki paths return HTTP 404; trailing slashes/HTML aliases redirect to canonicals.
- Every page is useful in its first HTML response without JS, authentication, a
  database, a session or gameplay imports. Heading hierarchy, semantic navigation,
  working internal links, breadcrumbs and JSON-LD must match visible content.
- Unique meaningful titles/descriptions, absolute canonicals, hreflang, Open Graph,
  index/follow for real pages; noindex for 404. Automatic complete merged sitemap.
- In-game search/navigation/back keeps the session mounted; same content source and
  headings; real public links remain available. Lazy-load this room.
- Public facts only: no private commander data, administrative tooling, credentials,
  undisclosed opponent logic or internal balancing/scheduling algorithms.
- Verify development, preview, build output and Nginx delivery; 350px mobile and desktop.

Main regression risks: stale publisher sitemap assumptions; old guide-menu tests;
CSP for structured data; global game CSS/scroll affecting the sheet; Vite's SPA fallback
masking unknown Wiki URLs. Keep publishing independent from server services.

Source audit will be recorded below as systems are checked. Tests cover generated
values against rule functions rather than hardcoding another balance table.

Owner clarification: do not trust documentation for game facts. All gameplay statements
must be verified against current code and tests. Documentation and the old stashes can
only guide the audit; they cannot establish a mechanic, value, gate or outcome.

## Implemented catalogue and source audit

98 articles in each of English and Turkish, 12 categories and 222 indexable routes.
The catalogue covers all current 7 buildings, 4 instruments, 4 satellites, 26 hulls
and 16 research projects. The remaining articles explain the actual player loop,
world ownership, queues, travel, combat, intelligence, galaxy encounters, clans,
season scoring, rewards and returning from Silent Space.

Facts were checked against the executable rules and service paths, including:
- `packages/rules/src/economy.ts`, `economy-profile.ts`, `constants.ts`, `hulls.ts`,
  `research.ts`, `travel.ts`, `fuel.ts`, `combat.ts`, `escape.ts`, `damage.ts`:
  prices, effective storage, timing, rooms, prerequisites, counters, loot and repairs.
- `apps/server/src/services/movement.ts`, `research.ts`, `researchState.ts`,
  `strategic.ts`, `strategicInterception.ts`, `faults.ts`, `faultRepair.ts`:
  live launch/arrival gates, settlement refunds, capital research, EMP and loyalty.
- `mining.ts`, `pirateRaid.ts`, `monumentMovement.ts`, `monumentArrival.ts`,
  `monumentOwnership.ts`, `monumentProbe.ts`, `radiation.ts` and their rule functions:
  moving encounters, returning ore, HOLD capacity/production and exposure.
- `clanAid.ts`, `clanSupport.ts`, `clanWar.ts`, `clanWarSettlement.ts`, `clanLoot.ts`
  and the clan rules: permanent gifts versus returning transports, host defence,
  individual technology, committed strikes and treasury behaviour.
- `season.ts`, `seasonArchive.ts`, `seasonRankRewards.ts`, `rewards.ts`,
  `returnQueue.ts`, `returnStatus.ts` and their rules: current season timing,
  Dominion, carry-over rewards, preserved worlds and return eligibility.

The existing EN/TR game vocabulary supplies player-visible names and hull descriptions;
stale Core prose is explicitly replaced after checking the timing functions. Numeric
tables are derived from public rule fields/functions. The publisher never serializes
whole service/configuration objects, private intelligence, undisclosed opponent
behaviour, random generators, administration or operational information.

Relevant corrections include the uncapped Core, Hangar's independent ten levels,
effective Store headroom, capital-based research timing, tactical EMP instead of
planet destruction, target-commander raid quotas across worlds, distinct aid/support
ownership, the current 30-day season and 48-hour inactivity threshold.

## Publication and delivery

`src/wiki/catalog.ts` is the route/content manifest; `WikiContent.tsx` renders it for
both the build-time public edition and the lazy in-game `WikiScreen`. The sheet adds
search and local history without game queries. Public HTML contains no executable
JavaScript, and uses the project's actual ui-v2 tokens, icons, Archivo and existing art.

The Vite plugin emits every page, public CSS/fonts and the merged publisher/Wiki sitemap.
Development and preview serve the same manifest. Nginx resolves clean page paths before
directories, redirects existing aliases with 308 and query preservation, and returns
404 plus noindex for unknown Wiki URLs without entering the game SPA. The original
home HTML and publisher/guide pages link to the Wiki. Robots allows these routes.

The web scripts use Vite 6's native `--configLoader runner`: the default bundled config
externalizes the source-only rules workspace, whose `.js` imports resolve to `.ts`
through Vite. Using the runner lets publishing consume the current rules directly
without compiling a second rules copy or adding a server framework.

## Verification notes

Tests were introduced and run failing before implementing publication, routing, sheet
navigation/search and menu integration. Subsequent disclosure, effective-storage,
localized-class and public-discovery corrections also have regression checks.

The full gate exposed an existing date-dependent resource-state fixture: it described
an October 6 response as newer than a collection prediction stamped with today's date.
Only the subsequent read's fixture time was made relative to now; resource/gameplay
implementation is unchanged. The complete resource-state and i18n suites pass together.

The browser journey (`node tools/visual.mjs out/wiki --wiki`) passes English desktop,
350px English mobile and 350px Turkish mobile. Public contexts disable JavaScript and
assert no game scripts/API calls, original HTML content, working assets and true 404;
the real ui-v2 sheet verifies search, article connections and back navigation. Screenshots
and measurements are in the ignored `out/wiki/` directory.

Production delivery has also been exercised with an isolated nginx:1.28-alpine instance
serving the actual build and the repository's Wiki location rules, including GET/HEAD,
page versus directory resolution, aliases, assets, query preservation and missing pages.
No production deployment is part of this local change.

Final checks (2026-10-07):
- Whole-workspace typecheck and lint pass. The final changed Wiki files also pass
  type-aware lint; the final web typecheck passes.
- Production web build passes. All 222 Wiki URLs are served as HTML by Nginx, with
  canonical URLs, exactly one h1 and no game script. Missing URLs return 404/noindex;
  seven alias forms return 308 and preserve the query string. The complete repository
  Nginx vhost passes `nginx -t` with isolated temporary certificates.
- The full web run passes 5,299 tests (29 existing skips), and the rules run passes
  1,988 tests. All 44 final Wiki publication, HTTP and sheet checks pass; desktop
  and both 350px mobile browser journeys pass. A production Turkish mobile browser
  with JavaScript disabled also passes with no API/script requests or broken assets.
- `pnpm verify` is **not green**: the unchanged simulator's `season.test.ts` fails
  `TAX holds its band`, with 0.0325 below `BANDS.TAX`'s 0.035 minimum. A separate Git
  HEAD export of `packages/rules` and `packages/sim`, without any Wiki changes,
  reproduces exactly the same five-seed values and failure. No simulation, balance
  or server implementation was changed to make this unrelated alarm pass. PNPM's
  failure stops the remaining serial server suite, so that suite is not reported
  as a completed passing run.

Local review URL: `http://127.0.0.1:5188/wiki/tr` (English: `/wiki`). The final category
back-navigation fix was also tested in the actual Turkish 350px sheet and rebuilt.
Both supplied stashes remain intact. Temporary HEAD exports and isolated Nginx
containers are removed after verification; screenshots and this audit remain available.
