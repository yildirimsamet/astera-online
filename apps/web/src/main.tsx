import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { LazyMotion, domMax } from 'motion/react';
import { lockViewportZoom } from './lib/viewport.js';
import { startUiScale } from './lib/uiScale.js';
import { uiScaleHost } from './platform/display.js';
import { I18nextProvider } from 'react-i18next';
/**
 * FIRST, AND BEFORE ANYTHING THAT RENDERS. The selected dictionary is ready
 * before React mounts, including deferred locales — no flash of translation
 * keys. See `i18n/index.ts`.
 */
import i18n, { i18nReady } from './i18n/index.js';
import { syncDocumentLanguage } from './i18n/document.js';
import { init as startSentry } from '@sentry/react';
import { startAnalytics } from './lib/analytics.js';
import { crashRootHooks, startCrashReports } from './lib/crashReports.js';
import { startPlayerAnalytics } from './lib/playerAnalytics/runtime.js';
import { configureH5Ads } from './lib/h5.js';
import { starterFetch } from './starter/transport.js';
import { Api } from './api/client.js';
import { createQueryClient } from './api/queryClient.js';
import { ApiProvider } from './api/context.js';
import { forgetWithQuery } from './api/gatedRead.js';
import { keys } from './api/keys.js';
import { ToastProvider } from './ui/Toast.js';
import { ErrorBoundary } from './shell/ErrorBoundary.js';
import { ConsentPlacement } from './landing/public/ConsentPlacement.js';
import { App } from './App.js';
import { InstallProvider } from './brand/Install.js';
import { startAndroidBack } from './platform/nativeBack.js';
import { watchAppHeight } from './lib/appHeight.js';
import { tolerateForeignDomEdits } from './lib/foreignDomEdits.js';
import { isAppActive, watchAppActivity } from './platform/activity.js';
import './styles.css';

function start(): void {
  /**
   * Crash reports first, so a throw anywhere below is seen (plan 2026-11-13, owner §10.7-1). Errors
   * only, nothing about the player, and only from a production build on the game's own hosts or app.
   */
  const crashes = startCrashReports({
    native: (import.meta.env.VITE_ASTERA_PLATFORM ?? 'web') !== 'web',
    host: window.location.host,
    production: import.meta.env.PROD,
    release: import.meta.env.VITE_ASTERA_RELEASE ?? '',
  }, startSentry);
  syncDocumentLanguage();
  // A page translator rewrites React's text nodes; an update must not crash on them (Sentry WEB-4).
  tolerateForeignDomEdits();

  /**
   * Measurement, and it is deliberately the last thing set up and the first thing
   * that is allowed to wait. Nothing is fetched unless `VITE_GA_ID` was set at build
   * time, and even then the request is deferred to an idle moment — see
   * `lib/analytics.ts` for why the pasted `<head>` snippet would have been wrong on
   * a page that opens by compiling a 3D scene.
   */
  startAnalytics();

  /**
   * H5 Games Ads, told what kind of game this is.
   *
   * `adConfig()` fetches nothing on its own — it declares the sound state so
   * Google can pick a suitable creative, and leaves preloading to Google because
   * there is no placement to preload for yet. On a dev server the bridge does not
   * exist and this is a no-op; see `lib/h5.ts` for why the placement half is
   * deliberately absent.
   */
  configureH5Ads();

  const api = new Api({ observations: true, fetch: starterFetch(globalThis.fetch.bind(globalThis)) });
  const stopPlayerAnalytics = startPlayerAnalytics();
  if (import.meta.hot) import.meta.hot.dispose(stopPlayerAnalytics);

  /**
   * A handle on the API, in development only.
   *
   * Setting up a scenario worth photographing — a telescope installed, a watch
   * assigned, a probe in the air — takes half a dozen calls as the signed-in player,
   * and driving them through the interface is slow and brittle. Stripped from
   * production by the `DEV` guard.
   */
  if (import.meta.env.DEV || import.meta.env.VITE_VISUAL_TEST === '1') {
    (window as unknown as { __api?: Api }).__api = api;
  }

  focusManager.setEventListener(handleFocus => {
    const update = () => { handleFocus(isAppActive()); };
    const stopActivity = watchAppActivity(update);
    update();
    return stopActivity;
  });
  const client = createQueryClient();
  // A session move clears the cache under a galaxy read just made: the next view's read must not wait on it.
  forgetWithQuery(client.getQueryCache(), keys.galaxy, { forget: api.forgetGalaxyRead });

  /**
   * Scenario harnesses sometimes commit a mutation outside the page, then need the
   * mounted tree to read that committed state without reloading the whole WebGL
   * scene. Development-only, like `__api` and the galaxy scene bridge.
   */
  if (import.meta.env.DEV || import.meta.env.VITE_VISUAL_TEST === '1') {
    (window as unknown as { __queryClient?: QueryClient }).__queryClient = client;
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('no #root element');

  // Refuses the two zoom gestures the viewport meta and `touch-action` cannot.
  lockViewportZoom();
  // The player's interface size, before the first frame (`lib/uiScale.ts`).
  const stopUiScale = startUiScale(uiScaleHost());
  if (import.meta.hot) import.meta.hot.dispose(stopUiScale);
  // The height the page really has on screen, for every full screen (item 23).
  const stopAppHeight = watchAppHeight();
  if (import.meta.hot) import.meta.hot.dispose(stopAppHeight);
  const stopAndroidBack = startAndroidBack();
  if (import.meta.hot) import.meta.hot.dispose(stopAndroidBack);

  /**
   * Motion, loaded the small way.
   *
   * `LazyMotion` + the `m` components keep the animation runtime out of the initial
   * bundle until something actually animates. `domMax` rather than `domAnimation`
   * because bottom sheets are dragged, and a sheet you cannot swipe away reads as dated
   * on a phone — this is a mobile-first game, not a desktop app that shrinks.
   *
   */
  /**
   * THE BOUNDARY SITS AS HIGH AS IT CAN WHILE STILL BEING ABLE TO SPEAK.
   *
   * Directly inside the language provider and outside everything else, so a throw
   * in the query client, the API context, the toast layer or any screen below them
   * lands on a floor instead of emptying `#root` — which is the black screen the
   * owner was handed a report of. It goes no higher because its fallback needs the
   * i18n instance; it reads that instance directly rather than through context, so
   * the provider above it is a placement rule and not a dependency.
   *
   * ONE BOUNDARY, ON PURPOSE. A second one around the disc would keep the header
   * and the strip alive through a scene crash, and may well be worth adding — but
   * only after this one has told us what is actually throwing. See
   * `shell/ErrorBoundary.tsx` for why the first question is answered by catching
   * rather than by guessing.
   */
  createRoot(root, crashRootHooks(crashes)).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <LazyMotion features={domMax} strict>
            <QueryClientProvider client={client}>
              <ApiProvider api={api}>
                <ToastProvider>
                  <ConsentPlacement><InstallProvider><App /></InstallProvider></ConsentPlacement>
                </ToastProvider>
              </ApiProvider>
            </QueryClientProvider>
          </LazyMotion>
        </ErrorBoundary>
      </I18nextProvider>
    </StrictMode>,
  );
}

void i18nReady.then(start);
