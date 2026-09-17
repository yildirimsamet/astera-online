/* global window */
/*
 * THE H5 GAMES ADS BRIDGE, VERBATIM AS GOOGLE PUBLISHES IT.
 *
 * The Ad Placement API is not a separate library: it rides inside the AdSense
 * loader that runs just above this file, and a game reaches it through two
 * globals the publisher is expected to define — `adBreak()` and `adConfig()`,
 * both of which push a plain object onto the shared `adsbygoogle` queue. That is
 * the whole of Google's snippet and it is reproduced here without invention,
 * because the loader reads the queue and not our wrapper.
 *
 * A FIRST-PARTY FILE RATHER THAN AN INLINE BLOCK. Google's documentation shows
 * this as an inline `<script>` in the head. The deployed Content-Security-Policy
 * grants `script-src 'self'` and never `'unsafe-inline'`, so an inline copy would
 * be refused by the browser and the API would simply not exist on the one page
 * that needs it. Same bytes, same position, one file.
 *
 * THE QUEUE IS ADOPTED, NEVER REPLACED. The AdSense loader above is `async`: on
 * a fast connection it can execute first and leave commands on `adsbygoogle`.
 * Assigning a fresh array here would throw those away. Google's own snippet
 * spells this `x = x || []`; `??=` is the same thing for a value that is either
 * an array or undefined, and it is what this repo's lint rules accept.
 *
 * Injected into the built page only — see `src/lib/adsense.ts`. Nothing fetches
 * an ad by existing; placements are `adBreak()` calls and this game has none yet.
 */
window.adsbygoogle ??= [];
window.adBreak = window.adConfig = function (placement) {
  window.adsbygoogle?.push(placement);
};
