import { VESSEL_HULLS } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { VESSEL_NOZZLES, vesselHitBox } from '../src/galaxy/mainSky.js';

/**
 * EVERY HULL BURNS FROM ITS OWN NOZZLES (owner, 2026-11-09: "tüm 3 tip geminin alevlerinin doğru
 * oturduğundan emin ol"). Measured from the models' rear faces: the Spine's ring of six, the Wedge's two
 * pods and the Seed's one bell. Model units, nose along +X, one ship long.
 */
describe('the nozzles of each hull', () => {
  it('counts the nozzles each model has', () => {
    expect(VESSEL_NOZZLES.SPINE.at).toHaveLength(6);
    expect(VESSEL_NOZZLES.WEDGE.at).toHaveLength(2);
    expect(VESSEL_NOZZLES.SEED.at).toHaveLength(1);
  });

  it.each(VESSEL_HULLS)('sits %s on its rear face, inside its outline, mirrored across the keel', (hull) => {
    const { at, radius } = VESSEL_NOZZLES[hull];
    const [, high, wide] = vesselHitBox(hull);
    for (const [x, y, z] of at) {
      expect(x).toBe(-0.5);
      expect(Math.abs(y) + radius).toBeLessThan(high / 2);
      expect(Math.abs(z) + radius).toBeLessThan(wide / 2);
      expect(at.some(([, y2, z2]) => y2 === y && z2 === -z)).toBe(true);
    }
  });

  it('keeps nozzles of one hull from overlapping', () => {
    for (const hull of VESSEL_HULLS) {
      const { at, radius } = VESSEL_NOZZLES[hull];
      for (const a of at) for (const b of at) if (a !== b) expect(Math.hypot(a[1] - b[1], a[2] - b[2])).toBeGreaterThanOrEqual(radius * 2);
    }
  });
});
