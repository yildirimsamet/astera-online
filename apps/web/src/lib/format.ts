import i18n from '../i18n/index.js';

/**
 * Number formatting. Every figure a player reads goes through here.
 *
 * LOCALE-AWARE, AND THE LOCALE IS A TRANSLATED STRING RATHER THAN THE LANGUAGE
 * TAG. `units.numberLocale` is `en-US` in English and `tr-TR` in Turkish, which
 * is what decides whether nine thousand two hundred and forty is `9,240` or
 * `9.240`. Reading it out of the resource tree rather than off `i18n.language`
 * means a future language can pick a grouping that is not its own default —
 * which is a real thing translators ask for and costs nothing to allow.
 *
 * These are plain functions, not hooks, because they are called from `dossier`,
 * `directives` and `notifications` as well as from components. Every surface that
 * renders one of these also renders translated text, so it is already subscribed
 * to `languageChanged` and re-formats with everything else.
 */

const locale = (): string => i18n.t('units.numberLocale');

export const full = (value: number): string => Math.round(value).toLocaleString(locale());

/**
 * Short form for tight columns: 12.4k, 1.8M — or 12,4b and 1,8M in Turkish.
 *
 * Used where the exact figure is not the decision — a storage bar, a ladder row.
 * Anything a player spends or loses is shown in full.
 *
 * The mantissa goes through `toLocaleString` rather than `toFixed` so the decimal
 * separator follows the language. `toFixed` is hard-wired to a full stop, which
 * put `12.4b` on a Turkish screen — an English number wearing a Turkish suffix.
 */
export function compact(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return i18n.t('units.millions', { value: decimals(n / 1_000_000, abs >= 10_000_000 ? 0 : 1) });
  }
  if (abs >= 1_000) {
    return i18n.t('units.thousands', { value: decimals(n / 1_000, abs >= 10_000 ? 0 : 1) });
  }
  return n.toLocaleString(locale());
}

/**
 * A FIGURE TOO SMALL TO ROUND. Owner report — the per-craft fuel rate.
 *
 * `compact` rounds, which is right for everything a player spends and wrong for a
 * RATE: a Wasp burns a tenth of a deuterium per thousand units and `compact` prints
 * that as zero — a ship card stating that the most common hull in the game is free
 * to fly. Same locale notation as every other figure, so Turkish reads `0,1`.
 */
export const decimal = (value: number, digits = 1): string => decimals(value, digits);

const decimals = (value: number, digits: number): string =>
  value.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** A probe report is a range, and it must never be shown as if it were a number. */
export const range = (low: number, high: number): string =>
  `${compact(low)}${i18n.t('units.rangeJoin')}${compact(high)}`;

export const signed = (value: number): string =>
  `${value > 0 ? i18n.t('units.plus') : value < 0 ? i18n.t('units.minus') : ''}${full(Math.abs(value))}`;

/**
 * A percentage, with the sign on the side the language puts it.
 *
 * English writes `40%` and Turkish writes `%40`, so this cannot be a template
 * literal at the call site — which is what it was, in four of them.
 */
export const percent = (value: number): string =>
  i18n.t('units.percent', { value: Math.round(value * 100) });
