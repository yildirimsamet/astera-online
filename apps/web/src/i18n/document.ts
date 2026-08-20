import i18n, { currentLanguage } from './index.js';
import { writeStored, type Language } from './languages.js';

/**
 * THE THREE THINGS OUTSIDE REACT'S REACH, AND THE ONE CONTROL THAT MOVES THEM.
 *
 * React owns everything inside `<body>`. These live in the head and in the
 * browser's own chrome, and they are read at moments React is not involved in —
 * a link preview, a search result, an install prompt.
 *
 *   `lang`         · which voice a screen reader uses, and how text is hyphenated.
 *                    A Turkish page announced in an English voice is the
 *                    accessibility equivalent of the wrong font.
 *   `description`  · what a shared link says about the game.
 *   `manifest`     · what the "add to home screen" prompt says it is installing.
 *
 * SEPARATE FROM `index.ts` BECAUSE OF WHO IMPORTS WHAT. The instance is reached
 * from `lib/notifications.ts`, and the server's contract test imports that module
 * to check a worker's payloads still parse — so the instance has to compile with
 * no DOM at all. Everything that touches `document` is therefore here, where only
 * the browser entry point and the language switcher can see it.
 */

/**
 * Switch, remember, and tell the document.
 *
 * The write comes FIRST and is not awaited on the language change: a player who
 * switches and immediately closes the tab must come back to the language they
 * chose, not to the one their browser prefers.
 */
export async function setLanguage(language: Language): Promise<void> {
  writeStored(language);
  await i18n.changeLanguage(language);
  syncDocumentLanguage();
}

/**
 * Called once at startup so the very first paint carries the right `lang`.
 *
 * Written defensively: this runs before React, and under test on a page that may
 * not carry the head tags at all. A missing element is skipped rather than thrown
 * over — a language preference is never worth taking the game down for.
 */
export function syncDocumentLanguage(): void {
  document.documentElement.lang = currentLanguage();

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', i18n.t('document.description'));

  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.setAttribute('href', i18n.t('document.manifest'));
}
