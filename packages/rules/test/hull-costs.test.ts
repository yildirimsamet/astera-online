import { describe, expect, it } from 'vitest';
import { ALL_HULLS, HULLS, type HullId } from '../src/index.js';

const BEFORE_D82: Record<
  HullId,
  Pick<(typeof HULLS)[HullId], 'alloy' | 'crystal' | 'atk' | 'hp' | 'speed' | 'cargo' | 'cls' | 'minShipyard' | 'ground'>
> = {
  WASP: { alloy: 260, crystal: 0, atk: 14, hp: 24, speed: 435, cargo: 40, cls: 'SKIRMISHER', minShipyard: 0, ground: false },
  LANCE: { alloy: 950, crystal: 190, atk: 46, hp: 62, speed: 322, cargo: 50, cls: 'LANCE', minShipyard: 2, ground: false },
  BULWARK: { alloy: 2500, crystal: 620, atk: 26, hp: 210, speed: 199, cargo: 70, cls: 'BULWARK', minShipyard: 4, ground: false },
  HAULER: { alloy: 1150, crystal: 130, atk: 0, hp: 80, speed: 284, cargo: 1800, cls: 'SUPPORT', minShipyard: 1, ground: false },
  BASTION: { alloy: 1700, crystal: 380, atk: 34, hp: 260, speed: 0, cargo: 0, cls: 'BULWARK', minShipyard: 1, ground: true },
  THORN: { alloy: 800, crystal: 120, atk: 16, hp: 60, speed: 0, cargo: 0, cls: 'SKIRMISHER', minShipyard: 0, ground: true },
  PROSPECTOR: { alloy: 700, crystal: 120, atk: 0, hp: 70, speed: 330, cargo: 1800, cls: 'SUPPORT', minShipyard: 1, ground: false },
};

describe('D82 hull crystal surcharge', () => {
  it('raises every crystal component by 25%, rounded to the nearest whole resource', () => {
    for (const id of ALL_HULLS) {
      expect(HULLS[id].crystal, id).toBe(Math.round(BEFORE_D82[id].crystal * 1.25));
    }
  });

  it('does not change alloy prices or hull capabilities', () => {
    for (const id of ALL_HULLS) {
      const { crystal: _crystal, ...unchanged } = BEFORE_D82[id];
      expect(HULLS[id], id).toMatchObject(unchanged);
    }
  });
});
