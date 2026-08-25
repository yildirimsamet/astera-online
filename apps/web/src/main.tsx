import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import { lockViewportZoom } from './lib/viewport.js';
import { I18nextProvider } from 'react-i18next';
/**
 * FIRST, AND BEFORE ANYTHING THAT RENDERS. The instance initialises at import
 * with its resources already in memory, so by the time React paints there is a
 * language — no suspense, no flash of `landing.premise`. See `i18n/index.ts`.
 */
import i18n from './i18n/index.js';
import { syncDocumentLanguage } from './i18n/document.js';
import { startAnalytics } from './lib/analytics.js';
import { Api } from './api/client.js';
import { shareStructure } from './api/structural.js';
import { ApiProvider } from './api/context.js';
import { ToastProvider } from './ui/Toast.js';
import { App } from './App.js';
import './styles.css';

syncDocumentLanguage();

/**
 * Measurement, and it is deliberately the last thing set up and the first thing
 * that is allowed to wait. Nothing is fetched unless `VITE_GA_ID` was set at build
 * time, and even then the request is deferred to an idle moment — see
 * `lib/analytics.ts` for why the pasted `<head>` snippet would have been wrong on
 * a page that opens by compiling a 3D scene.
 */
startAnalytics();

const api = new Api();

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

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // The server is the only authority; a failed read is worth one more try and
      // then a visible failure, never a silent stale render.
      retry: 1,
      refetchOnReconnect: true,
      /**
       * IDENTITY ACROSS A REFETCH, WHICH THE DEFAULT COULD NOT GIVE US.
       *
       * Every payload the disc draws from carries `Date` instants, and React
       * Query's own walker treats a Date as a leaf compared by reference — so a
       * refetch that read back exactly what it already held still produced brand
       * new arrays of brand new objects. Every memo below them re-ran, every
       * `BufferGeometry` built from one was rebuilt, and the camera re-framed
       * itself on data that had not moved.
       *
       * One clause fixes it for the whole client at once. See `api/structural.ts`.
       */
      structuralSharing: shareStructure,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('no #root element');

// Refuses the two zoom gestures the viewport meta and `touch-action` cannot.
lockViewportZoom();

/**
 * Motion, loaded the small way.
 *
 * `LazyMotion` + the `m` components keep the animation runtime out of the initial
 * bundle until something actually animates. `domMax` rather than `domAnimation`
 * because bottom sheets are dragged, and a sheet you cannot swipe away reads as dated
 * on a phone — this is a mobile-first game, not a desktop app that shrinks.
 *
 * `reducedMotion="user"` makes the OS setting authoritative for every animation in
 * the app, so the CSS media query in styles.css and the JS animations agree instead
 * of one of them quietly ignoring the preference.
 */
createRoot(root).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={client}>
            <ApiProvider api={api}>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ApiProvider>
          </QueryClientProvider>
        </MotionConfig>
      </LazyMotion>
    </I18nextProvider>
  </StrictMode>,
);
