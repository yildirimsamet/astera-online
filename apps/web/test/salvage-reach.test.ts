import { describe, expect, it } from 'vitest';
import { distance, travelExact, travelMinutes } from '@astera/rules';
import { salvageReachMinutes } from '../src/lib/salvageReach.js';

/**
 * THE BUTTON AND THE DEPARTURE AGREE (Codex player test, 2026-11-05: "3 dk" on the button, "2 dk"
 * on the toast). A ship's server times a salvage flight exactly; the main game's in whole minutes.
 */
describe('how long a salvage flight is quoted for', () => {
  const home = { x: 0, y: 0, z: 0 }, at = { x: 37, y: 0, z: 0 }, speed = 20;

  it('quotes a ship the exact time its server will fly', () => {
    expect(salvageReachMinutes(home, at, speed, true)).toBeCloseTo(travelExact(distance(home, at), speed));
  });

  it('keeps the main game in whole minutes, as its server flies', () => {
    expect(salvageReachMinutes(home, at, speed, false)).toBe(travelMinutes(distance(home, at), speed));
  });

  it('quotes nothing without a home or a speed', () => {
    expect(salvageReachMinutes(undefined, at, speed, true)).toBeNull();
    expect(salvageReachMinutes(home, at, 0, true)).toBeNull();
  });
});
