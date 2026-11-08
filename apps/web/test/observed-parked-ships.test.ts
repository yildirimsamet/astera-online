import { describe, expect, it } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
import { observedParkedShips } from '../src/galaxy/parkedShip.js';

const base = { id: 'other', position: { x: 0, y: 0, z: 0 }, isSelf: false, isCapital: true,
  commanderShip: { ship: 'muhafiz', level: 4, docked: true } };
const parse = (over = {}) => galaxySchema.shape.planets.parse([{ ...base, ...over }]);
describe('other commanders parked at visible worlds', () => {
  it('keeps the server appearance and selects the world rather than the owner hangar', () => {
    expect(observedParkedShips(parse())).toEqual([{ planetId: 'other', ship: 'muhafiz', level: 4, docked: true, reason: null, until: null }]);
  });
  it('does not duplicate the owner ship or render remembered or unknown appearances', () => {
    for (const over of [{ isSelf: true }, { isOwned: true }, { intel: 'REMEMBERED' }, { intel: 'UNKNOWN' }, { commanderShip: undefined }]) {
      expect(observedParkedShips(parse(over))).toEqual([]);
    }
  });
});
