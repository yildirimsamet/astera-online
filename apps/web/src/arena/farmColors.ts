import { RESOURCE_ART } from '../ui/assets.js';

/**
 * One colour per farm kind, the galaxy's own resource colours (v2 tokens), so an ore
 * piece, a deposit halo, a radar dot and a HUD segment of the same kind always match.
 */
/* Kind 3 is Asteryum (plan 2026-11-24 §3.2): gozlemevi.md's eleventh meaning, lavender (owner 2026-11-25, G15). */
export const FARM_TONE = ['var(--color-v2-alloy)', 'var(--color-v2-crystal)', 'var(--color-v2-deut)', 'var(--color-v2-asterium)'] as const;
export const FARM_HEX = ['#f2a14a', '#7fd0ff', '#a8ea4c', '#b48cff'] as const;
/** Linear RGB for additive particles: a touch over one so the core blooms. */
export const FARM_RGB: readonly (readonly [number, number, number])[] = [[1.5, 0.78, 0.3], [0.6, 1.1, 1.5], [0.95, 1.45, 0.35], [1.15, 0.8, 1.6]];
/** One picture per farm kind, the galaxy's own resource icons: a haul is read by its picture, never by colour alone. */
export const FARM_ART = [RESOURCE_ART.alloy, RESOURCE_ART.crystal, RESOURCE_ART.deuterium, RESOURCE_ART.asterium] as const;
