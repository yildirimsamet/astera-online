import { readFileSync } from 'node:fs';
import { INTERGALACTIC_CONVOY, convoyFormationSlots } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { CRAFT_SCALE, SCALE } from '../src/galaxy/scene.js';
import { FLEET_V2_ASSET_MANIFEST } from '../src/ui/fleet-v2-assets.js';
import {
  CONVOY_BASE_HULL_SCALE,
  CONVOY_DRIFT_AMPLITUDE,
  CONVOY_FOCUS_DISTANCE,
  CONVOY_FORMATION_LENGTH,
  CONVOY_HULL_SCALE,
  CONVOY_HULL_SCALE_MULT,
  CONVOY_WIND_LAYER_COUNT,
  CONVOY_WIND_OPACITY,
  convoyLongitudinalOffset,
} from '../src/galaxy/IntergalacticConvoy.js';

/** Owner playtest corrections for the public convoy's map-scale presence. */
describe('the Intergalactic Convoy presentation', () => {
  it('draws every manifest hull at exactly twice its previous convoy scale', () => {
    expect(CONVOY_BASE_HULL_SCALE).toBeCloseTo(0.14 * CRAFT_SCALE, 9);
    expect(CONVOY_HULL_SCALE_MULT).toBe(2);
    expect(CONVOY_HULL_SCALE).toBeCloseTo(
      CONVOY_BASE_HULL_SCALE * CONVOY_HULL_SCALE_MULT,
      9,
    );
  });

  it('spaces consecutive ranks by hull footprint while keeping the doubled hulls in two lanes', () => {
    expect(INTERGALACTIC_CONVOY.formation.lateralSpacing).toBe(64);

    const slots = convoyFormationSlots(1);
    const leftLane = slots.filter(({ column }) => column === -1);
    const rightLane = slots.filter(({ column }) => column === 1);
    for (let index = 1; index < leftLane.length; index += 1) {
      const frontRank = slots.filter(({ rank }) => rank === index);
      const backRank = slots.filter(({ rank }) => rank === index + 1);
      const frontSize = Math.max(...frontRank.map(({ hull }) => (
        CONVOY_HULL_SCALE * FLEET_V2_ASSET_MANIFEST[hull].scale
      )));
      const backSize = Math.max(...backRank.map(({ hull }) => (
        CONVOY_HULL_SCALE * FLEET_V2_ASSET_MANIFEST[hull].scale
      )));
      const gap = (leftLane[index - 1]!.localPosition.z - leftLane[index]!.localPosition.z) / SCALE;
      expect(gap).toBeGreaterThan((frontSize + backSize) / 2);
    }
    expect((rightLane[0]!.localPosition.x - leftLane[0]!.localPosition.x) / SCALE)
      .toBeCloseTo(64 / SCALE, 9);
  });

  it('derives an exact convoy focus distance from the final formation length', () => {
    expect(CONVOY_FORMATION_LENGTH).toBeGreaterThan(9.5);
    expect(CONVOY_FOCUS_DISTANCE).toBeGreaterThan(7);
    expect(CONVOY_FOCUS_DISTANCE).toBeCloseTo(
      CONVOY_FORMATION_LENGTH / 2 / Math.tan(Math.PI / 8) * 2.3,
      9,
    );
  });

  it('gives every craft bounded longitudinal motion without ever swapping rank order', () => {
    const slots = convoyFormationSlots(1);
    const rankGap = Math.min(...INTERGALACTIC_CONVOY.formation.rankGaps) / SCALE;
    expect(CONVOY_DRIFT_AMPLITUDE * 2).toBeLessThan(rankGap);

    for (let sample = 0; sample <= 1_200; sample += 1) {
      const atSeconds = sample / 10;
      const animatedZ = slots.map((slot, index) => (
        slot.localPosition.z / SCALE + convoyLongitudinalOffset(index, atSeconds)
      ));
      animatedZ.forEach((z, index) => {
        expect(Math.abs(z - slots[index]!.localPosition.z / SCALE))
          .toBeLessThanOrEqual(CONVOY_DRIFT_AMPLITUDE + Number.EPSILON);
      });
      for (const column of [-1, 1] as const) {
        const lane = slots
          .map((slot, index) => ({ slot, z: animatedZ[index]! }))
          .filter(({ slot }) => slot.column === column);
        for (let rank = 1; rank < lane.length; rank += 1) {
          expect(lane[rank - 1]!.z).toBeGreaterThan(lane[rank]!.z);
        }
      }
    }
  });

  it('keeps the rearward wind field softly layered but bounded', () => {
    expect(CONVOY_WIND_LAYER_COUNT).toBeGreaterThanOrEqual(3);
    expect(CONVOY_WIND_LAYER_COUNT).toBeLessThanOrEqual(5);
    expect(CONVOY_WIND_OPACITY).toBeGreaterThan(0);
    expect(CONVOY_WIND_OPACITY).toBeLessThanOrEqual(0.25);
  });
});

describe('IntergalacticConvoy.tsx, by its source', () => {
  const source = readFileSync('src/galaxy/IntergalacticConvoy.tsx', 'utf8');

  it('adds a shared formation wake and instanced drive cores without pulse rings', () => {
    expect(source).toContain('<FormationWakes');
    expect(source).toContain('<ConvoyDriveLights');
    expect(source).toContain('name="intergalactic-convoy-wakes"');
    expect(source).toContain('name="intergalactic-convoy-drives"');
    expect(source).not.toContain('ConvoyPulseRings');
    expect(source).not.toContain('intergalactic-convoy-pulses');
  });

  it('runs a GPU-instanced, continuously deforming flow veil instead of moving lines', () => {
    expect(source).toContain('<ConvoyWind');
    expect(source).toContain('name="intergalactic-convoy-wind"');
    expect(source).toContain('new THREE.InstancedBufferGeometry()');
    expect(source).toContain('new THREE.ShaderMaterial({');
    expect(source).toContain('attribute vec4 aFlow;');
    expect(source).toContain('uniform float uTime;');
    expect(source).toContain('float flowNoise');
    expect(source).toContain('float flowFbm');
    expect(source).toContain('vFlow = uv.y * 2.8 - uTime');
    expect(source).toContain('smoothstep');
    expect(source).not.toContain('<lineSegments');
    expect(source).not.toContain('<lineBasicMaterial');
    expect(source).toContain('<instancedMesh');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('<Exhaust');
  });

  it('uses the length-derived exact range when the convoy receives focus', () => {
    const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');
    expect(canvas).toContain("focus.kind === 'intergalacticConvoy'");
    expect(canvas).toContain('CONVOY_FOCUS_DISTANCE');
    expect(canvas).toContain("exactApproach={coachTap !== null || focus?.kind === 'intergalacticConvoy'}");
  });
});
