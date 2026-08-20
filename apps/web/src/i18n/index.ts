import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en/index.js';
import { tr } from './locales/tr/index.js';
import { FALLBACK_LANGUAGE, detectLanguage, type Language } from './languages.js';

/** The single namespace every key lives under. See the note by `resources`. */
export const NS = 'game';

/**
 * ONE LANGUAGE FOR THE WHOLE GAME, DECIDED BEFORE THE FIRST FRAME.
 *
 * RESOURCES ARE STATIC AND SYNCHRONOUS, deliberately. i18next can fetch a locale
 * over HTTP, and every version of that has the same shape: the first render has
 * no strings, so either the app suspends or it paints the keys and then corrects
 * itself. Principle 10 rules out both — "never a spinner where a decision should
 * be", and a flash of `landing.premise` is worse than a spinner. Two languages of
 * UI copy is a few tens of kilobytes in a bundle that ships eleven 3D models; the
 * trade is not close.
 *
 * DETECTION IS OURS RATHER THAN THE PLUGIN'S. `i18next-browser-languagedetector`
 * would do the same job, but its default order puts a `?lng=` query parameter and
 * a cookie ahead of the browser, and this game has neither — what it would add is
 * two more places a language could come from and a caching layer that has to be
 * reasoned about at sign-out. `detectLanguage` is fifteen lines, reads the stored
 * choice then `navigator.languages` in the browser's own order of preference, and
 * is directly testable without a DOM.
 *
 * THE FALLBACK IS TURKISH. Owner decision, and it is not the same thing as the
 * default: a device that asks for English gets English, because detection runs
 * first. Turkish is what a device that asked for NEITHER lands on.
 */

/**
 * ONE i18next NAMESPACE, HOLDING EVERY SECTION.
 *
 * i18next's own namespaces are a code-splitting mechanism — they exist so a route
 * can load its strings and not the rest. Nothing here is split (see above), so
 * using them would buy nothing and cost the thing that matters: `t()` would take
 * `'loading:contact'`, a colon nobody remembers, and every call site would have
 * to know which FILE its string lives in.
 *
 * The sections are top-level keys inside one tree instead, so `t('loading.contact')`
 * is an ordinary path and the section boundary is a fact about the resource
 * rather than about the API.
 */
const resources = {
  en: { [NS]: en },
  tr: { [NS]: tr },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  ns: [NS],
  defaultNS: NS,
  /**
   * `t('planet.tabs.growProblem')` is one lookup into a nested object rather than
   * a key that happens to contain dots, so the separators stay on. The
   * counterpart is that no key may contain a literal `.` or `:` — nothing here
   * does, and the type on `t()` makes a new one a compile error.
   */
  keySeparator: '.',
  nsSeparator: ':',
  interpolation: {
    // React escapes everything it renders. Escaping again turns a planet called
    // "Vantage & Co" into "Vantage &amp; Co" on screen.
    escapeValue: false,
  },
  returnNull: false,
  /**
   * A missing key is a bug, and in development it should be loud rather than
   * quietly rendered as its own key. In production the key is still the least
   * bad thing to show — but the type system has already made this unreachable.
   */
  saveMissing: false,
  debug: false,
});

/** The language in use right now, narrowed to one this build actually has. */
export const currentLanguage = (): Language =>
  i18n.resolvedLanguage === 'en' ? 'en' : 'tr';

/**
 * SWITCHING LIVES IN `document.ts`, NOT HERE, and that is a boundary rather than
 * a filing decision.
 *
 * This module is imported by `lib/notifications.ts`, which the SERVER's contract
 * test imports to check that a worker's payloads still parse — so everything
 * reachable from here has to compile against Node's types, with no DOM. The head
 * sync touches `document`; keeping it in a sibling that only the browser entry
 * and the switcher import keeps that true without a cast or a second tsconfig.
 */

export { i18n };
export default i18n;
