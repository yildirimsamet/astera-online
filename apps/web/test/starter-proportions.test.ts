import { worldRadius } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { CRAFT_SCALE, STARTER_MODEL_SCALE, VESSEL_LENGTH, asteroidRadius, nodeRadius, modelScale } from '../src/galaxy/scene.js';

/**
 * OWNER PLAYTEST 2026-11-07: "Ya gemiler çok küçük ya da probe, prospector, savaş gemileri çok büyük."
 * A colony ship is the size of a town; what it sends out is a drone. The craft keep the size the main
 * galaxy reads them at (`Fleets.tsx` ROUTE, `MiningFlights.tsx` STYLE); the ships grow, and the camera
 * and every arrival read the grown ship through its node radius.
 */
describe('a colony ship among its craft', () => {
  it('dwarfs the probe and the Prospector it sends', () => {
    const probe = 0.18 * CRAFT_SCALE * STARTER_MODEL_SCALE;
    const prospector = 0.26 * CRAFT_SCALE * STARTER_MODEL_SCALE;
    expect(VESSEL_LENGTH / probe).toBeGreaterThanOrEqual(4);
    expect(VESSEL_LENGTH / prospector).toBeGreaterThanOrEqual(3);
  });

  it('is framed and approached by the size it is drawn at, as before the growth', () => {
    expect(nodeRadius({ body: 'VESSEL', coreLevel: 1 }) / VESSEL_LENGTH).toBeCloseTo(worldRadius(1) / 1.3, 6);
  });

  it('leaves every world its Core level', () => {
    expect(nodeRadius({ coreLevel: 7 })).toBe(worldRadius(7));
    expect(nodeRadius({ body: 'OUTPOST', coreLevel: 2 })).toBe(worldRadius(2));
  });
});

it('halves starter models from one scale, without changing main galaxy models or distances', () => {
  expect(STARTER_MODEL_SCALE).toBe(0.5);
  expect(modelScale(true)).toBe(0.5);
  expect(modelScale(false)).toBe(1);
  expect(VESSEL_LENGTH).toBe(2.6 * STARTER_MODEL_SCALE);
  expect(nodeRadius({ body: 'OUTPOST', coreLevel: 2 }, true)).toBe(worldRadius(2) * STARTER_MODEL_SCALE);
  expect(nodeRadius({ coreLevel: 7 }, false)).toBe(worldRadius(7));
  expect(asteroidRadius(3, modelScale(true))).toBe(asteroidRadius(3) / 2);
});
