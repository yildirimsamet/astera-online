import { ABUSE, CORE_TOP_LEVEL, SILENT_SPACE, tierBandReach } from '@astera/rules';

/** The Command Core levels a development tier covers (`coreTier` is a level divided by three, rounded up). */
const CORE_PER_TIER = 3;

/**
 * WHAT GUARDS A NEWCOMER, IN THEIR OWN NUMBERS (plan 2026-11-13 §4.4, §4.7): the first-game shield, the
 * Core levels that may raid them (the tier band, said in the levels a player reads on their world), and
 * the quiet hours after the shield before Silent Space (S5). Read from the rules the server keeps.
 */
export function landingProtection(peakCore: number): { shieldHours: number; coreLow: number; coreHigh: number; silentHours: number } {
  const band = tierBandReach(peakCore);
  return {
    shieldHours: ABUSE.firstGameShieldHours,
    coreLow: (band.low - 1) * CORE_PER_TIER + 1,
    coreHigh: Math.min(CORE_TOP_LEVEL, band.high * CORE_PER_TIER),
    silentHours: SILENT_SPACE.idleMs / 3_600_000,
  };
}
