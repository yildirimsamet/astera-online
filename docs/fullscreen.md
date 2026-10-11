# Fullscreen control — browser research and requirements

Owner request, 2026-10-11. The shop keeps its text, shrinks horizontally (remove
the left spark), and a labelled 44px touch target immediately to its right toggles
the entire document, including portal sheets, dialogs and notifications.

Official references checked on 2026-10-11:

- [MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen):
  user activation is required; requests are asynchronous and may reject; listen
  to document fullscreenchange/fullscreenerror. No automatic entry on load/retry.
- [MDN exitFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Document/exitFullscreen)
  and [fullscreenEnabled](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenEnabled):
  exit can reject; embedding/Permissions Policy can disable fullscreen.
- [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json):
  modern Chrome/Edge/Firefox on desktop and Chrome/Firefox/Samsung on Android
  support element fullscreen. Safari macOS and iPadOS support the standard API
  from 16.4; older Safari uses WebKit-prefixed methods/events. iPhone does not
  support arbitrary element fullscreen; iOS WebViews may also lack it. Optional
  navigationUI is not implemented on all browsers; treat hide as a browser hint.
- [WebKit Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/):
  macOS/iPadOS unprefixed support; Esc or downward touch gesture exits. Keep the
  browser's exit controls; no keyboard/orientation lock.
- [Apple iPhone web apps](https://support.apple.com/en-ie/guide/iphone/iphea86e5236/27/ios/27):
  Safari Share → Add to Home Screen → Open as Web App → Add, then launch that icon.
  This is a manual alternative, not something JavaScript can install/launch itself.
- [Chrome Android edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge):
  viewport insets can change; retain the existing safe-area/dynamic viewport shell.
  No viewport resize hack or fake fullscreen CSS mode.

| Environment | Intended behavior |
| --- | --- |
| Windows/Linux/macOS Chrome/Firefox/Edge | Native document enter/exit; Esc stays browser controlled |
| macOS Safari | Standard API first, WebKit fallback for older supported versions |
| Android Chrome/Firefox/Samsung | Native fullscreen on supported pages; menu/PWA guide if absent |
| iPadOS Safari | Native API with native swipe/exit synchronization |
| iPhone Safari/other browsers without support | Explain limitation; real Home Screen web app steps |
| Embedded/denied pages | Explain unavailable state; no unsupported method call |
| Actual standalone/minimal-ui PWA without native API | Recognize current app view, no install loop |
| Normal tab with historical PWA install flag | Still offer native fullscreen/help; storage is not current display proof |
| Browser fullscreen (F11), no fullscreenElement | Recognize already fullscreen; cannot programmatically leave browser-controlled mode |

Edge cases: request/exit rejection or synchronous throw, WebKit void return with
events, error before/after a promise settles, rapid taps during transition, external
Esc/swipe/app switch exit, failed entry never flips active state, unmount removes
listeners without forcing global exit, capability/visibility changes. Feature
detection controls functionality; UA is used only for explanatory fallback steps.
No API requests, new dependency, polling, storage writes or game state changes.

Affected: brand masthead and styles, an isolated fullscreen control, six locale
trees, browser event tests and visual harness. Keep unrelated mastheads, PWA
installation flow, chat/portal mounting and renderer configuration unchanged.
First test native enter/exit, event synchronization, errors/rapid taps, WebKit,
unsupported iPhone/in-app/desktop help, actual vs remembered PWA, keyboard access
and immediate placement after shop. Then verify real Chromium fullscreen/portals
and 350px/desktop layouts; Safari/iPhone device behavior remains a physical-device
verification limit in this Linux workspace.

Validation: native Chromium document entry/exit and externally initiated exit,
siblings retained in fullscreen, the unsupported iPhone guide over game panels,
centred card/overflow/44px touch targets at 350px and 1280px, all six languages.
`node tools/visual.mjs out/fullscreen --fullscreen` passes 12 browser scenarios;
screenshots and measurements are in `out/fullscreen`. WebKit prefixed events and
native failure/pending/cleanup/PWA states are covered by unit tests; Firefox and
Safari engines/physical devices are not installed in this Linux workspace.
