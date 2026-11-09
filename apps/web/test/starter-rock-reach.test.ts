import { PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { rockInReach, setRockReach, FINGER_PX, type ReachRock } from '../src/starter/tutorial/rockReach.js';

/**
 * A ROCK WORTH TAPPING (owner playtest 2026-11-09). The player is asked to come closer until a rock's
 * own target is a fingertip wide and clear of the officer's card and the dock. The telescope's opening
 * view leaves it a few pixels across.
 */
const HEIGHT = 812;
const camera = (distance: number): PerspectiveCamera => {
  const c = new PerspectiveCamera(45, 350 / HEIGHT, 0.1, 2000);
  c.position.set(0, 0, distance);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
};
const rock = (id: string, x = 0, y = 0, z = 0, level = 1): ReachRock => ({ id, at: [x, y, z], level });

afterEach(() => { setRockReach(null); });

describe('a rock in reach', () => {
  it('is not one at the distance the telescope opens on', () => {
    expect(rockInReach([rock('a')], camera(80), HEIGHT)).toBeNull();
  });
  it('is one when its target is a fingertip wide', () => {
    expect(rockInReach([rock('a')], camera(30), HEIGHT)).toBe('a');
  });
  it('asks for a bit of a zoom, not a dive', () => {
    expect(FINGER_PX).toBe(44);
    expect(rockInReach([rock('a')], camera(34), HEIGHT)).toBe('a');
    expect(rockInReach([rock('a')], camera(40), HEIGHT)).toBeNull();
  });
  it('is not one off the side of the screen', () => {
    expect(rockInReach([rock('a', 20)], camera(30), HEIGHT)).toBeNull();
  });
  it('is not one under the officer\'s card', () => {
    expect(rockInReach([rock('a', 0, 10)], camera(30), HEIGHT)).toBeNull();
  });
  it('is not one under the dock', () => {
    expect(rockInReach([rock('a', 0, -10)], camera(30), HEIGHT)).toBeNull();
  });
  it('is not one behind the camera', () => {
    expect(rockInReach([rock('a', 0, 0, 40)], camera(30), HEIGHT)).toBeNull();
  });
  it('names the one that looks biggest', () => {
    expect(rockInReach([rock('far', 0, 0, -6), rock('near', 1, 0, 6)], camera(30), HEIGHT)).toBe('near');
  });
  it('finds nothing in an empty sky', () => {
    expect(rockInReach([], camera(10), HEIGHT)).toBeNull();
  });
});
