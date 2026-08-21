import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MEASUREMENT, AND THE ONE PROPERTY IT HAS TO HAVE.
 *
 * `VITE_GA_ID` is inlined at build time, so an unconfigured build — every dev
 * server, every test run, every local `pnpm build` — must install nothing, fetch
 * nothing and define nothing. That is the entire opt-out: there is no runtime
 * flag to get wrong, and a `<script>` that appears anyway would be a third-party
 * request leaving a machine that never asked for one.
 *
 * `track()` is then required to be inert rather than to throw, because it is
 * called from the session path on every sign-in. A funnel event that crashes the
 * app it measures is worse than no funnel.
 *
 * The module is re-imported per test: `MEASUREMENT_ID` and the `started` latch are
 * module-level, and a stale module registry would make the second test read the
 * first one's decision.
 */
describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.dataLayer;
    delete window.gtag;
    for (const tag of document.querySelectorAll('script[src*="googletagmanager"]')) tag.remove();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('installs nothing at all when no measurement id was built in', async () => {
    const { startAnalytics, analyticsConfigured } = await import('../src/lib/analytics.js');
    expect(analyticsConfigured()).toBe(false);

    startAnalytics();

    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('is a no-op to report an event with no tag installed', async () => {
    const { track } = await import('../src/lib/analytics.js');
    expect(() => {
      track('sign_up', { method: 'rehearsal' });
    }).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });

  /**
   * The tag goes in AFTER the first frame, never in `<head>`. On this app the
   * first frame is a 3D galaxy compiled out of a 1.8 MB bundle, and a
   * render-blocking third-party script in front of it is the one thing the
   * loading cover exists to keep honest.
   */
  it('defers the script to an idle moment, and installs it exactly once', async () => {
    vi.stubEnv('VITE_GA_ID', 'G-TEST12345');
    // jsdom has no `requestIdleCallback`, which is also Safari's position — hence
    // the fallback the next test covers. Stubbed here to take the preferred path.
    const idle = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', idle);

    const { startAnalytics } = await import('../src/lib/analytics.js');
    startAnalytics();
    // React 19 StrictMode mounts twice in development, and two tags on one page
    // double every figure they report.
    startAnalytics();

    expect(idle).toHaveBeenCalledTimes(1);
    const tags = document.querySelectorAll('script[src*="googletagmanager"]');
    expect(tags).toHaveLength(1);
    expect(tags[0]?.getAttribute('src')).toContain('G-TEST12345');
    expect((tags[0] as HTMLScriptElement).async).toBe(true);
  });

  /**
   * `gtag` and `dataLayer` exist BEFORE the remote script does, which is what
   * makes a call during the load window queue instead of being dropped.
   */
  it('queues events raised before the script has landed', async () => {
    vi.stubEnv('VITE_GA_ID', 'G-TEST12345');
    // Armed but never fired: the window between `startAnalytics()` and the script
    // arriving is the whole point of this test.
    vi.stubGlobal('requestIdleCallback', vi.fn(() => 1));

    const { startAnalytics, track } = await import('../src/lib/analytics.js');
    startAnalytics();

    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    track('login', { method: 'form' });

    // js, config, and the event — all waiting for the real tag to drain them.
    expect(window.dataLayer?.length).toBe(3);
  });

  /**
   * SAFARI, WHICH STILL HAS NO `requestIdleCallback` — and so does jsdom, which
   * is why this is the path a test would take by default. A timeout is the
   * fallback; the one thing that must never happen is the script going in
   * synchronously.
   */
  it('falls back to a timeout where idle callbacks do not exist', async () => {
    vi.stubEnv('VITE_GA_ID', 'G-TEST12345');
    vi.useFakeTimers();

    const { startAnalytics } = await import('../src/lib/analytics.js');
    startAnalytics();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();

    vi.runAllTimers();
    expect(document.querySelector('script[src*="googletagmanager"]')).not.toBeNull();
    vi.useRealTimers();
  });
});
