import { useTranslation } from 'react-i18next';
import { MOON } from '@astera/rules';
import i18n, { MOON_NS } from './index.js';
import { compact } from '../lib/format.js';
import { duration } from '../lib/time.js';
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

/**
 * THE RULES' OWN NUMBERS, IN EVERY MOON LINE (review U4). Copy names `{{hopSeconds}}`, never "90", so a
 * tuned rule can never leave six languages telling the old number. Formatted at call time, in the reader's
 * language; a caller's own params win.
 */
const ruleVars = (): Record<string, string | number> => ({
  hopSeconds: MOON.hopSeconds,
  gateSeconds: MOON.gateOpenSeconds,
  scanFuel: MOON.scanCost.deuterium,
  closeHours: MOON.strikeCloseHours,
  healHours: MOON.crackHealHours,
  captureCore: MOON.capture.requiredCore,
  buildAlloy: compact(MOON.build.cost.alloy),
  buildCrystal: compact(MOON.build.cost.crystal),
  buildTime: duration(MOON.build.minutes),
});

/** Runtime-backed, strictly typed translator for the `moon` namespace without expanding the global `i18next` type union. */
export function moonT(key: MoonKey, params?: Record<string, string | number>): string {
  const fn = (i18n as unknown as RawI18n).getFixedT(null, MOON_NS);
  return fn(key, { ...ruleVars(), ...params });
}

export function useMoonT(): (key: MoonKey, params?: Record<string, string | number>) => string {
  // Subscribes to language changes cleanly via react-i18next without widening the default `game` key union.
  useTranslation();
  return moonT;
}
