import { ALL_HULLS, FLEET_V2_HULLS , MOBILE_HULLS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { hullId } from '../src/api/schemas.js';

const retired = ['WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER'] as const;

describe('Fleet V2 client boundary', () => {
  it('parses every current rules hull at the API edge', () => {
    // Derived, not typed: D196 added three hulls and a literal would have gone stale.
    expect(FLEET_V2_HULLS).toHaveLength(MOBILE_HULLS.length);
    for (const id of ALL_HULLS) expect(hullId.parse(id)).toBe(id);
  });

  it('rejects every retired hull ID instead of admitting an unrenderable manifest', () => {
    for (const id of retired) expect(hullId.safeParse(id).success, id).toBe(false);
    expect(hullId.safeParse('ALIEN_DREADNOUGHT').success).toBe(false);
  });
});
