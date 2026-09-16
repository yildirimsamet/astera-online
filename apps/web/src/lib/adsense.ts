import type { HtmlTagDescriptor, Plugin } from 'vite';

/**
 * GOOGLE ADSENSE, AND WHY IT IS THE ONE TAG THAT DOES NOT WAIT.
 *
 * `lib/analytics.ts` argues at length that a third-party script belongs after the
 * first frame, never in `<head>`. That argument is about MEASUREMENT, which is the
 * least urgent thing this app does. AdSense is not measurement:
 *
 *   - Google verifies a site by reading the loader out of the document's head.
 *     A tag appended from an idle callback is a tag a verification fetch can miss,
 *     and a site that fails verification earns nothing at all.
 *   - The loader is `async`. It does not block parsing, it does not block the
 *     module graph, and it is a few tens of KB against a 1.8 MB three.js bundle.
 *
 * So this one goes in the head, verbatim as Google publishes it — but it is
 * INJECTED AT BUILD TIME rather than committed into `index.html`, because a tag
 * in the page fires on every dev server, on a phone on the LAN, and inside every
 * Playwright frame `tools/visual.mjs` captures. `apply: 'build'` is the whole of
 * that opt-out.
 *
 * The publisher id is NOT configuration and is deliberately not an env var. It is
 * public — it ships in the `src` of every page that carries the tag — there is one
 * publisher for one game, and gating it on an environment variable would buy
 * nothing: the value is inlined at build time either way, so turning ads off
 * needs a rebuild whichever way it is spelled.
 *
 * Nothing in the client imports this module; it is build configuration that lives
 * here so it is typed, linted and tested like the rest of the client. The `vite`
 * imports are types only and are erased at compile.
 */

/** This game's AdSense publisher id. Public by construction: it ships in the tag. */
export const ADSENSE_CLIENT = 'ca-pub-2743431608715099';

/** Google's loader, exactly as the console hands it out. Mirrored by the production CSP. */
export const ADSENSE_LOADER_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

/** The one tag the built page gains. */
export function adsenseHeadTag(): HtmlTagDescriptor {
  return {
    tag: 'script',
    attrs: {
      async: true,
      src: ADSENSE_LOADER_SRC,
      // Google's snippet sets this so the loader's errors arrive with a stack
      // instead of "Script error", which is the only way a broken tag is ever
      // debuggable from the outside.
      crossorigin: 'anonymous',
    },
    injectTo: 'head',
  };
}

/**
 * Put the loader in the head of the built page — and only the built page.
 *
 * `/ads.txt` is the other half of the integration and is a static file in
 * `public/`; a test holds it to the publisher id above so the two cannot drift.
 */
export function adsensePlugin(): Plugin {
  return {
    name: 'astera:adsense',
    apply: 'build',
    transformIndexHtml: {
      // Ahead of Vite's own module injection, so the loader is the first request
      // the head starts rather than one queued behind the bundle.
      order: 'pre',
      handler: () => [adsenseHeadTag()],
    },
  };
}
