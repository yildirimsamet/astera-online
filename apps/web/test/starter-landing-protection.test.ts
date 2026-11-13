import { ABUSE, CORE_TOP_LEVEL, FIRST_SEASON_START, SILENT_SPACE } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { landingProtection } from '../src/starter/protection.js';

/**
 * WHAT GUARDS A NEWCOMER, IN THEIR OWN NUMBERS (plan 2026-11-13 §4.4 "İnince", §4.7). Read from the
 * rules, so the jump panel and the landing card cannot promise a shield or a band the server does not keep.
 */
describe('the protection a jump lands with', () => {
  it('names the first-game shield and the thirty quiet hours that start once it ends (S5)', () => {
    const said = landingProtection(FIRST_SEASON_START.buildings.CORE);
    expect(said.shieldHours).toBe(ABUSE.firstGameShieldHours);
    expect(said.shieldHours).toBe(72);
    expect(said.silentHours).toBe(SILENT_SPACE.idleMs / 3_600_000);
    expect(said.silentHours).toBe(30);
  });

  it('says who may raid as a range of Command Core levels: Core 1 to 6 for a world that lands at Core 3', () => {
    expect(landingProtection(FIRST_SEASON_START.buildings.CORE)).toMatchObject({ coreLow: 1, coreHigh: 6 });
  });

  it('follows the band as the Core grows, and stops at the top of the ladder', () => {
    expect(landingProtection(7)).toMatchObject({ coreLow: 4, coreHigh: 12 });
    expect(landingProtection(CORE_TOP_LEVEL)).toMatchObject({ coreHigh: CORE_TOP_LEVEL });
  });
});
