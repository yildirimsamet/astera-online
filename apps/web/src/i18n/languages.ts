/**
 * THE TWO LANGUAGES, AND HOW A DEVICE IS ASKED WHICH ONE IT WANTS.
 *
 * Kept out of `index.ts` so the detector and the language switcher can both read
 * it without importing the i18next instance — a module that pulls in the whole
 * resource tree is a bad dependency for a button.
 *
 * TURKISH IS THE FALLBACK, ENGLISH IS NOT. Owner decision. Fallback here means
 * "what a device that asked for neither gets", so a phone set to German lands on
 * Turkish rather than on English. A device that asks for English still gets
 * English — detection runs first and the fallback only catches what it misses.
 */

export const LANGUAGES = ['tr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** What the switcher prints for each. Each language names itself, in itself. */
export const LANGUAGE_LABEL: Record<Language, string> = {
  tr: 'Türkçe',
  en: 'English',
};

/** The two-letter code on the chip in the header. */
export const LANGUAGE_SHORT: Record<Language, string> = {
  tr: 'TR',
  en: 'EN',
};

export const FALLBACK_LANGUAGE: Language = 'tr';

/** Where a chosen language is remembered, so it survives a reload and a sign-out. */
export const LANGUAGE_STORAGE_KEY = 'astera.language';

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/**
 * Narrow a BCP-47 tag down to one of ours. `tr-TR` is Turkish; `en-GB` is English.
 *
 * Anything else returns null rather than the fallback, because the caller needs to
 * know the difference: a device asking for German has NOT asked for Turkish, and
 * conflating the two here would make the stored-preference branch unreachable.
 */
export function matchLanguage(tag: string | undefined | null): Language | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split('-')[0];
  return isLanguage(base) ? base : null;
}

/**
 * WHAT LANGUAGE THIS DEVICE IS IN, in the order the player would expect.
 *
 * 1. What they chose here before, if they ever did.
 * 2. Every language the browser reports, in the browser's own order of
 *    preference — `navigator.languages` and not just `navigator.language`,
 *    because a phone set to `de, en, tr` has said something useful about the
 *    second and third entries and reading only the first throws it away.
 * 3. Turkish.
 */
export function detectLanguage(nav: Pick<Navigator, 'language' | 'languages'> = navigator): Language {
  const stored = readStored();
  if (stored) return stored;

  /**
   * `navigator.languages` is typed as always present and is not: Safari has
   * shipped versions where it is undefined, and a webview can leave it out
   * entirely. Spreading `undefined` throws, and it would throw on the very first
   * line of the app — so the guard stays and the lint rule is told why.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const tags = [...(nav.languages ?? []), nav.language];
  for (const tag of tags) {
    const match = matchLanguage(tag);
    if (match) return match;
  }
  return FALLBACK_LANGUAGE;
}

/**
 * Storage can throw — Safari in private mode, a locked-down embedded webview —
 * and a language preference is never worth taking the game down for.
 */
export function readStored(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStored(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Nothing to do. The choice holds for this session and is asked again next time.
  }
}
