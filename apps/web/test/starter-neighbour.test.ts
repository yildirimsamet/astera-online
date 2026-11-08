import { describe, expect, it } from 'vitest';
import { hasOtherShip, nearestShip } from '../src/starter/neighbour.js';

/** The first probe goes to the closest ship (onboarding design §5.2, owner: "sen karar ver"). */
describe('the nearest ship to probe', () => {
  const at = (x: number, z: number) => ({ x, y: 0, z });
  const worlds = [
    { id: 'mine', body: 'VESSEL' as const, position: at(0, 0) },
    { id: 'outpost', body: 'OUTPOST' as const, position: at(1, 0) },
    { id: 'far', body: 'VESSEL' as const, position: at(30, 0) },
    { id: 'near', body: 'VESSEL' as const, position: at(5, 5) },
  ];

  it('is the closest other ship, never your own, never an outpost', () => {
    expect(nearestShip(worlds, 'mine', at(0, 0))).toBe('near');
  });

  /** Found on the test galaxy: before a world is selected the active id is empty, and the ship found itself. */
  it('never picks the player\'s own ship, whatever the active id says', () => {
    const own = [{ id: 'mine', body: 'VESSEL' as const, position: at(0, 0), isSelf: true }, ...worlds.slice(1)];
    expect(nearestShip(own, '', at(0, 0))).toBe('near');
  });

  it('is nothing when nobody else is about', () => {
    expect(nearestShip(worlds.slice(0, 2), 'mine', at(0, 0))).toBeNull();
    expect(nearestShip(worlds, 'mine', undefined)).toBeNull();
  });

  /** One answer to "is there anyone to probe", for the guide and the next-step line alike. */
  it('knows whether anyone else is in the galaxy, whether or not the ship has a position yet', () => {
    expect(hasOtherShip(worlds, 'mine')).toBe(true);
    expect(hasOtherShip(worlds.slice(0, 2), 'mine')).toBe(false);
    expect(hasOtherShip([{ id: 'mine', body: 'VESSEL' as const, position: at(0, 0), isSelf: true }], '')).toBe(false);
  });
});

it('chooses the closest active rock at the current orbital minute', async () => {
  const { nearestRock } = await import('../src/starter/neighbour.js');
  const rocks = [
    { id: 'far', active: true, oreRemaining: 100, radius: 400, speed: 0, period: 100, phase: 0, inclination: 0, ascendingNode: 0 },
    { id: 'near', active: true, oreRemaining: 100, radius: 150, speed: 0, period: 100, phase: 0, inclination: 0, ascendingNode: 0 },
  ];
  expect(nearestRock(rocks, { x: 0, y: 0, z: 0 }, 25)).toBe('near');
  expect(nearestRock([{ ...rocks[1]!, active: false }], { x: 0, y: 0, z: 0 }, 25)).toBeNull();
});
