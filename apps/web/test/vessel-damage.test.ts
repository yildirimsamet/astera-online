import type { VesselSystem } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { VESSEL_BAYS, damageSpots, vesselHitBox, type VesselLights } from '../src/galaxy/mainSky.js';

/**
 * THE DAMAGE IS WHERE THE DAMAGE IS (plan 2026-11-08 F8). The ship burned by a share of the whole
 * road: a repaired Refinery kept its fire until the road reached 35 %. Each system now burns by its
 * own repairs, and the one that is mended goes out.
 */
const all = (share: number): VesselLights => ({ REFINERY: share, SURVEY: share, DEFENCE: share, CARGO: share, DRIVE: share });
const at = (lights: VesselLights, system: VesselSystem) => damageSpots(lights).find(spot => spot.at === system);

describe('where the ship burns', () => {
  it('burns everywhere while nothing is repaired', () => {
    expect(damageSpots(all(0)).map(spot => [spot.at, spot.kind]).sort()).toEqual([
      ['CARGO', 'sparks'], ['DEFENCE', 'fire'], ['DRIVE', 'fire'], ['REFINERY', 'fire'], ['SURVEY', 'sparks'],
    ]);
  });
  it('puts out a repaired system and leaves the others as they are', () => {
    const lights = { ...all(0), DEFENCE: 1 };
    expect(at(lights, 'DEFENCE')).toBeUndefined();
    expect(at(lights, 'DRIVE')).toEqual(at(all(0), 'DRIVE'));
  });
  it('lets a half-repaired machine smoulder instead of burn, less as it mends', () => {
    expect(at({ ...all(0), DRIVE: 0.25 }, 'DRIVE')?.kind).toBe('ember');
    expect(at({ ...all(0), DRIVE: 0.75 }, 'DRIVE')!.strength).toBeLessThan(at({ ...all(0), DRIVE: 0.25 }, 'DRIVE')!.strength);
    expect(at({ ...all(0), CARGO: 0.5 }, 'CARGO')?.kind).toBe('sparks');
  });
  it('is clean when all of it is repaired', () => {
    expect(damageSpots(all(1))).toEqual([]);
  });
});

/** Owner 2026-11-08: the ship's touch area spread far past its hull and took the taps meant for the rocks around it. */
describe('where the ship can be touched', () => {
  for (const hull of ['SPINE', 'WEDGE', 'SEED'] as const) {
    it(`stops at the ${hull} hull and still covers every bay`, () => {
      const [length, height, width] = vesselHitBox(hull);
      expect(length).toBe(1);
      for (const [x, y, z] of Object.values(VESSEL_BAYS[hull])) {
        expect(Math.abs(x)).toBeLessThanOrEqual(length / 2);
        expect(Math.abs(y)).toBeLessThanOrEqual(height / 2);
        expect(Math.abs(z)).toBeLessThanOrEqual(width / 2);
      }
      expect(height).toBeLessThan(0.5);
      expect(width).toBeLessThan(0.7);
    });
  }
});
