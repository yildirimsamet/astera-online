import { describe, expect, it } from 'vitest';
import { groundSlots, hangarCapacity, hullBulk } from '@astera/rules';
import { roomParts } from '../src/lib/room.js';
import { planetView } from './fixtures.js';

/**
 * WHERE A WORLD'S ROOM HAS GONE. D1/D2: the room bar draws home, away, queued and the
 * order being placed in three strengths of your own colour, so each part has to be
 * known on its own — not only the total a single bar used to draw in grey.
 */
describe('the room a world has spent', () => {
  const now = new Date();
  const order = (subject: string, count: number) => ({
    id: `${subject}-${String(count)}`,
    queue: 'YARD' as const,
    slot: 0,
    kind: 'HULL' as const,
    subject,
    count,
    startedAt: now,
    finishesAt: new Date(now.getTime() + 60_000),
    cost: { alloy: 0, crystal: 0, deuterium: 0 },
  });

  it('splits the Hangar into what is home, away and queued', () => {
    const view = planetView({
      fleet: { DART: 10 },
      fleetAway: { DART: 3 },
      ground: { THORN: 4 },
      capacity: { hangar: 200, hangarUsed: 0, ground: 20, groundUsed: 0 },
      queues: { CONSTRUCTION: [], YARD: [order('DART', 2)] },
    });
    const dart = hullBulk('DART');
    expect(roomParts(view, false)).toEqual({ total: 200, home: 10 * dart, away: 3 * dart, queued: 2 * dart });
  });

  it('keeps the guns on the ground out of the Hangar, and the ships out of the ground', () => {
    const view = planetView({
      fleet: { DART: 10 },
      ground: { THORN: 4 },
      capacity: { hangar: 200, hangarUsed: 0, ground: 20, groundUsed: 0 },
      queues: { CONSTRUCTION: [], YARD: [order('THORN', 1)] },
    });
    const thorn = hullBulk('THORN');
    expect(roomParts(view, true)).toEqual({ total: 20, home: 4 * thorn, away: 0, queued: thorn });
  });

  /** An older server sends no capacity: the rules' own figures stand in. */
  it('falls back to the rules when the payload carries no capacity', () => {
    // The fixture carries a capacity by default; an older server's payload does not.
    const { capacity: _dropped, ...view } = planetView({ buildings: { CORE: 6, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 1, HANGAR: 3 }, fleet: {} });
    expect(roomParts(view, false).total).toBe(hangarCapacity(3));
    expect(roomParts(view, true).total).toBe(groundSlots(6));
  });
});
