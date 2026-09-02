import {
  FLEET_V2_HULLS,
  MULTI_WORLD,
  type TechLevels,
} from '@astera/rules';
import { describe, expect, it } from 'vitest';
import {
  allHullIdSchema,
  mobileFleetSchema,
  onboardingIntentSchema,
} from '../src/schemas/fleet.js';
import { assertHullProductionAccess } from '../src/services/hullAccess.js';
import { launchAttack } from '../src/services/mission.js';
import { settlementFleet } from '../src/services/movement.js';

const retired = ['WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER'] as const;

describe('Fleet V2 server boundary', () => {
  it('accepts every current hull and rejects every retired ordinary hull', () => {
    for (const id of FLEET_V2_HULLS) expect(allHullIdSchema.safeParse(id).success).toBe(true);
    for (const id of ['BASTION', 'THORN', 'PROSPECTOR']) {
      expect(allHullIdSchema.safeParse(id).success).toBe(true);
    }
    for (const id of retired) expect(allHullIdSchema.safeParse(id).success).toBe(false);
  });

  it('parses an exhaustive mobile manifest and refuses unknown/ground keys', () => {
    const fleet = Object.fromEntries(FLEET_V2_HULLS.map((id) => [id, 1]));
    expect(mobileFleetSchema.safeParse(fleet).success).toBe(true);
    expect(mobileFleetSchema.safeParse({ ...fleet, WASP: 1 }).success).toBe(false);
    expect(mobileFleetSchema.safeParse({ ...fleet, ALIEN_DREADNOUGHT: 1 }).success).toBe(false);
    expect(mobileFleetSchema.safeParse({ BASTION: 1 }).success).toBe(false);
  });

  it('lets onboarding stage exactly two Darts but never a retired hull', () => {
    expect(onboardingIntentSchema.safeParse({ kind: 'build', hull: 'DART', count: 2 }).success)
      .toBe(true);
    expect(onboardingIntentSchema.safeParse({ kind: 'build', hull: 'WASP', count: 2 }).success)
      .toBe(false);
  });
});

describe('authoritative Fleet V2 production access', () => {
  const cataclysmTech: TechLevels = {
    STARSHIP_ENGINEERING: 2,
    SHIP_POWER: 4,
    SHIP_ARMOR: 2,
  };

  const accessError = (run: () => void): unknown => {
    try {
      run();
      return null;
    } catch (error: unknown) {
      return error && typeof error === 'object' && 'code' in error ? error.code : error;
    }
  };

  it('requires both the authoritative Shipyard and every research rung', () => {
    expect(accessError(() => { assertHullProductionAccess('CATACLYSM', 6, cataclysmTech); }))
      .toBeNull();
    expect(accessError(() => { assertHullProductionAccess('CATACLYSM', 5, cataclysmTech); }))
      .toBe('SHIPYARD_TOO_LOW');
    expect(accessError(() => {
      assertHullProductionAccess('CATACLYSM', 6, { ...cataclysmTech, SHIP_POWER: 3 });
    })).toBe('NEEDS_HULL_RESEARCH');
  });

  it('keeps level-one hulls available without research', () => {
    expect(accessError(() => { assertHullProductionAccess('DART', 0, {}); })).toBeNull();
  });
});

describe('mission role boundaries', () => {
  it('builds settlement from the exact shared two-Courier requirement', () => {
    expect(settlementFleet()).toEqual({
      [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports,
    });
    expect(settlementFleet()).toEqual({ COURIER: 2 });
  });

  it('rejects support-only attacks before touching persistence', async () => {
    const db = {
      transaction: () => {
        throw new Error('persistence reached');
      },
    };
    await expect(launchAttack(
      db as never,
      'origin',
      'target',
      { COURIER: 1 },
      { now: () => new Date('2026-09-01T00:00:00Z') },
    )).rejects.toMatchObject({ code: 'NOT_A_WARSHIP' });
  });
});
