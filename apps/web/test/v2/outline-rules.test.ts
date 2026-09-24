import { describe, expect, it } from 'vitest';
import type { BuildOrderView, PendingThread, PlanetView } from '../../src/api/schemas.js';
import { outlineQueues, outlineWorlds } from '../../src/lib/outline.js';
import { planetView } from '../fixtures.js';

/**
 * THE DESK OUTLINE'S READINGS (E11). Which worlds, with what at home and coming for
 * them; which lanes of work, research first — the active world's read from its own
 * (optimistic) view, so an order the player just placed is on the outline at once.
 */

const NOW = Date.parse('2026-09-24T12:00:00Z');

const capital = planetView({ fleet: { DART: 12, COURIER: 2 }, fleetAway: { DART: 4 } }, { id: 'p1', name: 'Thistle' });
const colony = planetView({ fleet: {}, fleetAway: {} }, { id: 'p2', name: 'Kestrel' });

const incoming = (targetPlanetId: string): PendingThread => ({
  kind: 'incoming',
  targetName: 'x',
  targetPlanetId,
  minutesRemaining: 9,
  arriveAt: new Date(NOW + 9 * 60_000),
});

const timed = { slot: 0, count: 1, cost: { alloy: 1, crystal: 0, deuterium: 0 }, startedAt: new Date(NOW), finishesAt: new Date(NOW + 60_000) };
const order = (id: string, queue: 'CONSTRUCTION' | 'YARD'): BuildOrderView => (queue === 'YARD'
  ? { ...timed, id, queue, kind: 'HULL', subject: 'DART' }
  : { ...timed, id, queue, kind: 'BUILDING', subject: 'REFINERY' });

describe('outlineWorlds', () => {
  it('reads each world with its ships home and away, the capital and the active one marked', () => {
    expect(outlineWorlds([capital, colony], { activePlanetId: 'p2', capitalPlanetId: 'p1' }, [])).toEqual([
      { id: 'p1', name: 'Thistle', capital: true, active: false, ships: 14, away: 4, threats: 0 },
      { id: 'p2', name: 'Kestrel', capital: false, active: true, ships: 0, away: 0, threats: 0 },
    ]);
  });

  it('counts the attacks coming for each world, and nothing else, as its threats', () => {
    const own = { kind: 'fleet', targetName: 'x', targetPlanetId: 'p2', minutesRemaining: 3, arriveAt: new Date(NOW) } as PendingThread;
    const worlds = outlineWorlds([capital, colony], { activePlanetId: 'p1', capitalPlanetId: 'p1' }, [
      incoming('p1'), incoming('p1'), incoming('p2'), own,
    ]);
    expect(worlds.map((world) => world.threats)).toEqual([2, 1]);
  });
});

describe('outlineQueues', () => {
  it('puts research first, then each world’s Construction and Yard, in the worlds’ order', () => {
    const queues = outlineQueues([capital, colony], undefined, 'p1');
    expect(queues.map((queue) => [queue.worldId, queue.lane])).toEqual([
      [null, 'research'],
      ['p1', 'construction'],
      ['p1', 'yard'],
      ['p2', 'construction'],
      ['p2', 'yard'],
    ]);
    expect(queues[1]).toMatchObject({ world: 'Thistle' });
  });

  it('reads the active world from its own view, where an order just placed already is', () => {
    const stale = planetView({ queues: { CONSTRUCTION: [], YARD: [] } }, { id: 'p1', name: 'Thistle' });
    const fresh = planetView({ queues: { CONSTRUCTION: [order('b-1', 'CONSTRUCTION')], YARD: [order('y-1', 'YARD')] } }, { id: 'p1', name: 'Thistle' });
    const queues = outlineQueues([stale], fresh, 'p1');
    expect(queues.find((queue) => queue.lane === 'construction')?.orders.map((o) => o.id)).toEqual(['b-1']);
    expect(queues.find((queue) => queue.lane === 'yard')?.orders.map((o) => o.id)).toEqual(['y-1']);
  });

  it('reads research off the active view, as rings', () => {
    const fresh: PlanetView = planetView({
      researchQueue: [{ id: 'r-1', slot: 0, projectId: 'DENSE_FUEL_CELLS', level: 2, cost: { alloy: 1, crystal: 1, deuterium: 0 }, optimistic: true }],
    }, { id: 'p1' });
    const [research] = outlineQueues([capital], fresh, 'p1');
    expect(research?.orders).toEqual([expect.objectContaining({ kind: 'RESEARCH', subject: 'DENSE_FUEL_CELLS', count: 2 })]);
  });

  it('leaves a lane empty where a world carries no queues yet (an older server)', () => {
    const queues = outlineQueues([capital], undefined, 'p9');
    expect(queues.every((queue) => queue.orders.length === 0)).toBe(true);
  });
});
