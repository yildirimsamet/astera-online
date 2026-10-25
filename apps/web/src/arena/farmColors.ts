/**
 * One colour per farm kind, the galaxy's own resource colours (v2 tokens), so an ore
 * piece, a deposit halo, a radar dot and a HUD segment of the same kind always match.
 */
export const FARM_TONE = ['var(--color-v2-alloy)', 'var(--color-v2-crystal)', 'var(--color-v2-deut)'] as const;
export const FARM_HEX = ['#f2a14a', '#7fd0ff', '#a8ea4c'] as const;
/** Linear RGB for additive particles: a touch over one so the core blooms. */
export const FARM_RGB: readonly (readonly [number, number, number])[] = [[1.5, 0.78, 0.3], [0.6, 1.1, 1.5], [0.95, 1.45, 0.35]];
