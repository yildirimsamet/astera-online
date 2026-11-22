import { useTranslation } from 'react-i18next';
import i18n, { MOON_NS } from './index.js';
import type { MoonResources } from './locales/en/moon.js';

type LeafKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : LeafKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MoonKey = LeafKeys<MoonResources>;

interface RawI18n {
  getFixedT(lng: null, ns: string): (key: string, opts?: Record<string, string | number>) => string;
}

/** Runtime-backed, strictly typed translator for the `moon` namespace without expanding the global `i18next` type union. */
export function moonT(key: MoonKey, params?: Record<string, string | number>): string {
  const fn = (i18n as unknown as RawI18n).getFixedT(null, MOON_NS);
  return params ? fn(key, params) : fn(key);
}

export function useMoonT(): (key: MoonKey, params?: Record<string, string | number>) => string {
  // Subscribes to language changes cleanly via react-i18next without widening the default `game` key union.
  useTranslation();
  return moonT;
}
