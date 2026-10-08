# Brand recall — 2026-10-07

Owner requested four changes: visible in-game name, a return card, a premium branded
loading screen, and one quiz after a new player's first three minutes in the real
game. Approved quiz reward: 100 Alloy, 50 Crystal, 20 Deuterium.

## Requirements and boundaries

- Keep the existing wordmark on the landing page. Add a compact SVG brand masthead
  above the real game's resource row; show the name/address/install action in the
  menu and the name in the existing Academy heading.
- Loading: large immediately readable Astera Online lettering, a distinctive orbital
  silhouette, quiet stars, the return address, truthful status/progress. CSS,
  no new bitmap/font dependency, no minimum duration. Motion always remains active.
- Registering a new account enrolls it atomically. Restoring/logging into an existing
  account does not enroll it. Use a reserved account_rewards ledger entry, so no new
  database migration is needed and quiz completion survives seasons/devices.
- Return card: first real galaxy, after 60 foreground seconds with the scene
  loaded; small dismissible card above the dock. Defer while another panel/dialog
  is open. Remember having shown it per account on this browser. Install remains
  available from the menu. Hide installation offers when already installed.
- Quiz: 180 accumulated foreground seconds in the real game, persisted per account
  across reloads. Academy, loading and hidden-tab time do not count. Defer behind an
  open panel/dialog; quiz takes priority over a still-open return card.
- Ask which address reopens this game. Three text choices, randomized order. Wrong
  answers reveal the correct address and allow retry without a penalty. Skip/close
  ends the quiz without a reward. Completion/dismissal is recorded server-side.
- Reward is server-authoritative: ownership, live/operational capital, enrollment,
  correct answer, minimum server-side elapsed time, atomic once-per-account claim.
  The UI foreground timer controls presentation; it is not trusted for payment.
  Repeat/concurrent requests return completion without paying twice. Reward credits
  use the existing resource/wealth/cache conventions, including over-cap grants.
- Native install prompt when available; otherwise concise platform-specific steps.
  In-app browsers get instructions to open the address in their normal browser.
  Do not claim successful installation until it is confirmed.
- All six locales carry the same behavior and reward values. Failed quiz requests
  leave an actionable retry; do not display success before the server answers.

## Change surfaces and regression risks

Web: LoadingScreen, HudTop/TopBar, MenuPanel, Academy, main provider, App/GameShell
account identity, new brand state/installation/quiz components, API schemas/client,
locale resources, visual harness. Server: account enrollment, two route call sites,
new brand quiz service/routes and app registration. Rules: shared constants only.

Protect existing resource widths and notch padding, scene input/dock accessibility,
auth restore/claim retry behavior, ordinary rewards, resource accrual, wealth updates,
once-per-account rewards, and working-tree changes from other tasks.

## Tests first

- Storage: absent/corrupt/blocked storage, account isolation, time clamping, merge
  across tabs, return/quiz completion persistence.
- UI: return card at 60 seconds, quiz at exactly 180 seconds, hidden/loading time
  excluded, reload continuation, panel deferral, existing accounts excluded,
  wrong answer/retry/skip, network failure, no optimistic reward, cache update.
- Installation: native accepted/dismissed/failing prompt, iOS/Android/in-app fallback,
  installed state, malformed browser events.
- Server: enrollment only on account creation, wrong/early/non-enrolled/unauthenticated
  requests, no planet, concurrent/repeated claims, no client-specified payout,
  skip prevents future payout, other account ownership, transaction rollback.
- Contract: parse the actual status and completion routes with client Zod schemas.
- Preserve determinate/indeterminate loading semantics. Run relevant tests red,
  implement, run green, then focused checks and real browser visual checks at 350px,
  desktop, Turkish/English, and reduced motion.

## Original visual concept (superseded by the redesign below)

Essence: a memorable space expedition. Signature: ASTERA in large condensed Archivo
letters crossing a luminous planetary limb; ONLINE beneath, address anchored below.
Name is readable from the first frame; the orbital light moves around the name.
Reuse game tokens and typography. No fake percentage or forced animation wait.

Initial loading design assessment: 6/10; small mark and a satellite dish compete for
attention. Target: strong name hierarchy, identifiable silhouette, restrained motion,
and readable narrow-phone layout. Final score follows browser inspection.

## Owner testing constraint — 2026-10-08

Do not run all tests at once: it makes the owner’s computer sluggish. The bulk
verification job was stopped. Continue with small relevant groups, one worker,
sequentially; run browser captures separately. Full-suite success is not claimed.

## Original feature verification (before the current redesign)

- Server service + authentication: 66 checks passed, including 11 brand cases;
  contract suite: 88 checks passed.
- Web brand/state/install/loading and visual-journey checks: 34 passed sequentially
  with one worker. Resource/header/menu and Academy regressions also passed.
- Focused lint covers the changed web/server/rules files; the full suite is not claimed.
- Real browser: 350 px phone and desktop; English/Turkish; iOS installation steps;
  three real foreground minutes; wrong answer then correct; confirmed 100/50/20
  payout; card/quiz remain dismissed after reload. No page errors.
- Repeat this flow alone with `WEB=http://localhost:5192 node tools/visual.mjs
  out/brand-recall --brand-recall`. Its rendering is limited to 10 fps; time is real.
- Loading captures include phone, desktop, landscape and reduced motion. Final
  loading design assessment: 8.5/10. Immediate readable name, recognizable orbit,
  distinct .space accent, no clipping, and truthful progress without extra waiting.

## Current redesign — 2026-10-08, design review before tests

The owner rejected the preceding designs, then approved the direction of the orbital
animation and requested more gyroscope depth. This task explicitly implements and
previews the design before writing/updating tests. The earlier verification counts
above apply to the original feature, not this new implementation.

### Visual direction and animation continuity

- Main accent is ui-v2 self turquoise (#2EE6C8): sigil, ONLINE, orbital light,
  address suffix, masthead, return/menu name and dialog actions. Resource colors
  remain attached to their own alloy/crystal/deuterium amounts.
- Compared a single rotating ring, multiple gyroscope rings, and a planet with
  two independently moving orbits. Selected the planet/orbits: direct connection
  to the game, readable silhouette and several movements to follow.
- The revised planet has layered cloud bands, a rotating storm, volume shading
  and a fixed day/night shadow. Two rings use actual CSS 3D perspective and a
  preserved 3D context, metal rims and independent precession/inclination. Light
  bodies pass behind the planet; inverse rotations keep their spherical faces
  facing the camera. This replaces the manually clipped front/back halves.
  Independent 7.4/11.6-second light orbits, 30/44-second ring precession and a
  24-second planet cycle avoid a short obvious whole-scene reset.
- All continuous animation uses CSS transforms on bounded HTML wrappers. SVG
  content is rasterized once per relevant style/size change. No loading WebGL
  context, requestAnimationFrame paint loop, worker, texture/video download, new
  font or dependency. Motion is never disabled by a system motion preference.
- OpeningScene is memoized and its trusted innerHTML object is constant. A fresh
  innerHTML object had recreated the scene during every progress update, restarting
  all CSS animations. Now progress only updates the caption/rail. A mount-only
  negative animation delay uses document time to retain apparent phase across
  bootstrap/session/screen handoffs; it never adds a minimum wait.
- First HTML and React use the same opening.css, opening-art.html, sigil.svg and
  wordmark.svg via openingScreenPlugin. The initial scene paints directly from the
  HTML without waiting for the application or a logo asset. These embedded sources
  total 18,769 bytes / 4,091 bytes gzip in the current revision; this excludes the
  rest of the document, React and application code.
- Masthead height is now 27px, down from 33px. Sigil, wordmark, ONLINE and gaps
  scale with it. The existing resource bar, safe-area owner and shell height
  measurement remain; small address text stays readable.

### Real preparation under the cover

- Keep the canvas mounted and loading underneath the cover.
- fetchAsset waits for image decode where supported and for model response bodies,
  rather than treating response headers as a completed download.
- Both landing and galaxy use SceneWarmup inside model Suspense. compileAsync
  prepares actual scene programs before the composer starts drawing. Removed
  drei's synchronous Preload and its six extra cube-camera renders.
- SceneRenderGate prevents an automatic render from blocking on programs while
  warmup is still in flight. FirstSceneFrame signals after the composer's actual
  first draw, so texture/buffer upload is behind the cover too.
- Galaxy also waits for its opening planet/map/season/mining requests to settle;
  an empty initial canvas cannot certify the game as prepared. Landing waits for
  its actual scene as well as the opening file list.
- Removed the unconditional five-second reveal and the artificial 450 ms hold.
  Reveal normally follows real readiness. A 20-second exceptional deadline keeps
  network/GPU failure from closing the door forever; it is not an estimate or a
  mandatory wait. Existing scene fallback handling remains.
- A file-preload timeout does not set progress to 100%. Unknown server/scene work
  uses an indeterminate rail; percentages only refer to a measured file list.

### Installation and quiz

- Always open the branded instructions card. A real retained beforeinstallprompt
  event adds the native install action, including when it arrives after the card
  opened. Invoke prompt in the click before any await and consume each event once.
  Dismissal/failure reveals manual fallback. Only appinstalled or standalone
  confirms installation; accepted choice alone never sets installed. The installed
  detection extension below also checks the optional related-app API and remembers
  confirmations on this browser.
- The automatic return offer waits for 60 accumulated foreground seconds in the
  real game. Loading, Academy and hidden-tab time do not count. Clicking the menu
  action opens instructions immediately; a native prompt still requires a click.
- OS/browser identification reads optional low-entropy client hints, validated
  through Zod, then UA/touch fallback (including iPad desktop UA). Brave's optional
  official isBrave API refines the manual guide on opening the card without
  blocking it. Identification is best-effort: it never gates the native action.
- iOS/iPadOS: Share → Add to Home Screen → Add; leave Open as Web App on if present,
  and use Safari if the option is unavailable. Detect iPad's desktop UA via touch.
- Android: native prompt when offered; otherwise browser-menu steps. Embedded
  X/Instagram/etc browsers direct the player to Safari on iOS or Chrome on Android
  and provide the canonical address. A real native capability overrides UA hints.
- Chrome/Brave/Edge desktop: native installation when offered; otherwise an
  available address-bar install icon and Ctrl+D / Mac ⌘D. Safari on Mac alone
  gets File → Add to Dock when available (Sonoma+). A normal page cannot invoke
  or create a native bookmark.
- Firefox Android: menu → Install → confirm adding to home screen. Firefox Windows
  143+ gets an available web-app icon guide (Microsoft Store builds need 150+);
  the copy is conditional because the icon can be absent. Older Firefox and
  Firefox Mac/Linux get the bookmark shortcut. Firefox's Windows web-app feature
  is a browser action, not a page-controlled beforeinstallprompt capability.
- Both dialogs use the existing ui-v2 Sheet and controls, shared SVG lockup, proper
  focus containment/restoration and concise copy in all six locales. The
  installation card can be closed while awaiting the browser.
- Copy uses the existing shared copyText helper, including the HTTP/webview
  fallback. Removed the separate select-and-copy paragraph. Success/failure is
  truthful feedback in the same button, with polite announcement and restored
  focus. The visible address remains selectable if both copy paths refuse.
- Quiz separates the visual component from RecallHost. Three physical resource
  icons show +100/+50/+20, address choices have compact rows, and success shows the
  actual server grant. Initial focus is on the question card so a random choice
  does not look selected. Existing timing, eligibility, wrong retry, skip,
  server authority, cache updates and once-per-account behavior stay unchanged.

### Installed-player menu action — 2026-10-08

- The owner's installation question and request to stop continually showing Add
  Home are interpreted as hiding it from installed players; players who have not
  installed retain access in the menu. A clarification was offered between this
  behavior and removing the menu action altogether.
- Reuse the same provider in the menu and automatic return card. A standalone
  launch, appinstalled, or a matching webapp returned by the optional
  getInstalledRelatedApps API suppresses installation offers and closes an open
  guide. A confirmed installation is remembered per origin/browser, independent
  of the player account, and shared with other tabs through the storage event.
- Remembered confirmation is historical evidence, not a guaranteed current
  inventory. Safari/iOS and Firefox cannot reliably report installation from a
  normal tab; iOS app and browser storage may also be separate. An absent prompt,
  unavailable API, empty result or API error does not prove non-installation.
- A genuine new beforeinstallprompt clears old history and makes installation
  available again, including after uninstall. Accepted choice alone never writes
  the confirmation. Query revisions prevent a delayed result from overriding a
  newer install event or native offer.
- A single asynchronous query on mount and on returning to a visible tab does
  not delay game loading. Hide the button while the initial check is pending;
  after 1.5 seconds, manual access becomes available if the API has not answered.
  A late positive answer can still hide it. No polling interval is added.
- Each of the six existing manifests self-declares its own related webapp and
  the existing production identity https://asteraonline.space/ derived from
  start_url. No id/start_url/scope change and no new PWA identity. Desktop Chrome/
  Edge 140+ and Chrome Android 84+ support the in-scope PWA check. Android checks
  made with a different language manifest may not find an older installation;
  preserve remembered confirmation instead of treating an empty list as absence.
- Implementation and browser observations precede formal test updates, per the
  owner's design-review-first instruction. Full-suite verification remains
  deferred; checks run individually with two CPU cores.
- Web typecheck, scoped lint and manifest identity/JSON checks passed. One Chromium process
  observed 15 installation scenarios: confirmation across reloads/tabs, matching
  app ID/manifest, standalone launch, foreign/malformed/empty/rejected responses,
  remembered confirmation, accepted-but-unconfirmed installation, fresh native
  offer versus delayed results, API deadline/late proof, and blocked storage.
  No page errors. Browser events/API responses were simulated; this is not proof
  of physical-device or actual OS installation behavior. Captures and observations
  are in out/brand-installed-state/.
- Primary sources: [Chrome installed-related-app API](https://developer.chrome.com/docs/capabilities/get-installed-related-apps),
  [MDN display versus installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Create_a_standalone_app),
  [MDN API compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getInstalledRelatedApps).

### Installation review fixes — 2026-10-08

- Tests now cover the card-first native flow, hidden-while-checking action, 60-second
  return card, installed-state evidence (standalone, appinstalled, other tab, related
  apps, empty answer, 1.5 s deadline, stale answer vs newer offer), every manual guide,
  copy feedback, and installProfile/installedPwa as units.
- A computer has no home screen: desktop profiles show “Hızlı erişim ekle” /
  “Save for quick access”, a click-based benefit line and a bookmark-or-install
  return hint (`installDesktop`, `installBenefitDesktop`, `returnHintDesktop`).
  “Kısayol” is avoided because the same card uses it for Ctrl/⌘+D.
- The guide is announced once: no Sheet eyebrow, the visible h3 is aria-hidden
  behind the quiet Sheet title. Unused `iosSteps`/`desktopSteps` copy was removed.
- Browser captures must set `navigator.userAgentData` with the emulated UA:
  hints outrank the UA, and headless Chromium reports the host platform.

### Research used

- [Animation performance](https://web.dev/articles/animations-and-performance):
  transform/opacity animation can continue on the compositor while main JS is busy.
- [Moderate animation speed, Journal of Consumer Research](https://academic.oup.com/jcr/article/53/1/136/8165440):
  moderate movement reduced perceived waits in their experiments; no promise that
  this exact scene or every player forgets a wait.
- [Original CHI progress-bar work](https://www.chrisharrison.net/index.php/Research/ProgressBars2):
  visual flow influences time perception; retain honest progress rather than
  manufacture percentages.
- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html):
  compileAsync is the documented asynchronous shader preparation path.
- [beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)
  and [installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable):
  platform availability varies; capability, not UA, decides the native button.
- [iPhone home-screen guide](https://support.apple.com/guide/iphone/iphea86e5236/ios)
  and [Mac web apps](https://support.apple.com/en-ie/104996): concise manual paths.
- [Chrome bookmark API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks):
  bookmarks are an extension API, not a normal-page API.
- [UA detection pitfalls](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent)
  and [client hints](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData):
  identify only to select help; support must be checked from a capability.
- [Brave identification](https://github.com/brave/brave-browser/wiki/Detecting-Brave-(for-Websites))
  and [Brave web apps](https://support.brave.app/hc/en-us/articles/39077114659597-How-do-I-install-and-use-Web-Apps-in-Brave):
  Chrome-like UA, optional official API and browser installation controls.
- [Firefox Android](https://support.mozilla.org/en-US/kb/use-web-apps-firefox-android)
  and [Firefox Windows](https://support.mozilla.org/en-US/kb/web-apps-firefox-windows):
  separate manual paths; current Windows/version/private-window limitations.

### Review and checks

Review entry /brand-preview.html: loading, ?view=hud, ?view=install, ?view=quiz.
?lang=en and ?state=reward provide alternate review states. The quiz preview is
local state only: it never pays a real account. These entries do not enter the
normal production build.

Browser observations are run alone with one Chromium process and two CPU cores,
separate from checks. Current captures live under out/brand-refinement:
gyro-mobile.png, gyro-desktop.png and gyro-motion.webm. Earlier out/brand-redesign
captures and blackhole/prism files are superseded. Real opening inspection recorded
no scene DOM replacement during progress updates and no page errors. The revised
gyroscope observation blocked main JS for three seconds: 77 distinct frames of
the cropped planet/orbits region arrived during the middle 2.5 seconds. This
checks the scene itself, not just its progress rail, even with a system motion
preference set. Phone 350px, short-height and landscape captures remain in bounds;
English/Japanese quiz and installation variants were reviewed. Current manual
card observations cover Chrome, Brave, Safari Mac, Firefox Windows/Linux/Android,
iPad desktop UA and embedded iOS at 350x640. Browser/OS metadata and native
offer/dismissal were simulated in Chromium: this does not certify installation on
those physical browsers/devices. Clipboard denial fell back successfully; when
both paths refused, only the button displayed failure and focus stayed in the card.
No page errors. Shader timings from
software-rendered, CPU-limited Chromium are not physical phone benchmarks.

Internal design assessment: typography 9, composition 8.8, motion 9.1, color 9,
craft 8.9 (weighted 9.0/10). Remaining work toward 10: owner visual review of the
moving scene and dialogs, then physical device validation and targeted regression
coverage. These are internal judgments, not a claim of owner approval or awards.

Pending after design review, run small checks sequentially with one worker:
- Stable DOM/animation identity across frequent progress updates and handoffs;
  compositor continuity during blocked main JS; first HTML/React alignment;
  resize/landscape and numeric/indeterminate progress.
- File body/decode completion, truthful timeout progress, readiness after model
  resolution/compilation/first draw, missing assets, compile failure, StrictMode,
  context restore, unmount cancellation and exceptional deadline.
- Late/missing/native prompt; single use; accepted vs confirmed installed;
  dismissed/failing prompt; iOS/iPad desktop UA, Android, in-app, desktop Mac/Linux;
  client hints/malformed hints/Brave masking or rejected optional API;
  Firefox Windows versions/private/Store builds; clipboard denial, honest inline
  feedback and dialog focus/close. Return offer threshold is now 60 seconds.
- Existing three-minute real-game timer, hidden/loading/Academy exclusion,
  wrong/retry/skip/failure, actual reward display, no optimistic or duplicate reward.
No new tests have been written or run for this redesign. Full-suite success is
not claimed. The current web type check has passed; focused lint covers the changed
brand/loading/readiness implementation. Regression tests remain after owner review.
