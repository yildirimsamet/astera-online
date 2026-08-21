/**
 * GOOGLE ANALYTICS, LOADED THE WAY IT WOULD BE LOADED IN NEXT.JS.
 *
 * The brief asked for Next's best practice, and this is not a Next app — so what
 * follows is `@next/third-parties`' `<GoogleAnalytics>` translated rather than a
 * copy of the snippet Google hands out. Four things that component does, and all
 * four matter more here than they would on a content site:
 *
 *   1. IT NEVER BLOCKS THE PAGE. Next calls it `afterInteractive`: the tag goes in
 *      after hydration, never in `<head>`, never render-blocking. The pasted
 *      snippet in `index.html` would sit in front of a 1.8 MB three.js bundle on a
 *      phone, which is the one thing this project's loading screen exists to keep
 *      honest. Here it waits for the browser to be idle as well — measurement is
 *      the least urgent thing that happens in the first second of this app.
 *   2. `dataLayer` AND `gtag` EXIST BEFORE THE SCRIPT DOES. That is not a
 *      formality: it is what makes calls made during the load window queue instead
 *      of being dropped. `track()` below is therefore safe from the first frame.
 *   3. THE ID IS CONFIGURATION, NOT A LITERAL. `VITE_GA_ID`, inlined at build
 *      time. With it unset — every dev server, every test, every local build —
 *      nothing is fetched, nothing is defined and no request leaves the machine.
 *      That is the whole of the opt-out, and it is why this file has no
 *      environment checks in it: an environment without the variable is an
 *      environment without analytics.
 *   4. IT IS IDEMPOTENT. React 19 StrictMode mounts twice in development, and two
 *      tags on one page double every figure they report.
 *
 * WHAT IS DELIBERATELY NOT HERE. No consent banner, because nothing here reads or
 * writes anything the player has given us — there is no ad module, no user id and
 * no custom dimension carrying a commander name. No route tracking, because the
 * game has no router: there is one screen and it is the galaxy (D20). What the
 * funnel actually needs is the two moments below, and they are the two GA4 names
 * for them rather than invented ones.
 */

const MEASUREMENT_ID: string = import.meta.env.VITE_GA_ID ?? '';

type GtagArgs = [command: string, ...rest: unknown[]];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

let started = false;

/**
 * Install the tag. Safe to call more than once; does nothing without an id.
 *
 * `requestIdleCallback` where it exists — Safari still does not have it — and a
 * short timeout everywhere else. Either way the network request happens after the
 * first frame, which on this app is after the galaxy has been drawn.
 */
export function startAnalytics(): void {
  if (started || MEASUREMENT_ID === '' || typeof window === 'undefined') return;
  started = true;

  window.dataLayer ??= [];
  /**
   * `arguments`, not a rest parameter, and it has to be.
   *
   * gtag reads the *arguments object itself* off the queue — pushing an array
   * built from a rest parameter produces a differently-shaped entry and the tag
   * silently ignores it. This is the one place in the codebase where the old form
   * is correct rather than lazy, which is why it is a `function` and not an arrow.
   */
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID);

  const install = (): void => {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(tag);
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(install, { timeout: 4000 });
  } else {
    window.setTimeout(install, 1500);
  }
}

/**
 * Report something that happened. A no-op wherever the tag was never installed.
 *
 * Call sites pass GA4's own event names where one exists — `sign_up`, `login` —
 * because a standard name is reported in the console's own funnel views and an
 * invented one has to be built into a custom report by hand.
 */
export function track(event: string, params: Record<string, string | number> = {}): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', event, params);
}

/** Exposed for the test that proves an unconfigured build fetches nothing. */
export const analyticsConfigured = (): boolean => MEASUREMENT_ID !== '';
