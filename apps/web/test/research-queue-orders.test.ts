import { describe, expect, it } from 'vitest';
import type { ResearchQueueOrderView } from '../src/api/schemas.js';
import { researchQueueOrders } from '../src/lib/orders.js';

/**
 * The research queue drawn with the build queue's rings: the Research page and the
 * desk outline read one conversion, so a rung reads the same in both.
 */
describe('researchQueueOrders', () => {
  const cost = { alloy: 400, crystal: 600, deuterium: 0 };

  it('carries a running rung with its clock, the level as its count', () => {
    const startedAt = new Date('2026-09-24T12:00:00Z');
    const finishesAt = new Date('2026-09-24T14:00:00Z');
    const queue: ResearchQueueOrderView[] = [
      { id: 'r-1', slot: 0, projectId: 'DENSE_FUEL_CELLS', level: 3, cost, startedAt, finishesAt },
    ];
    expect(researchQueueOrders(queue)).toEqual([
      { id: 'r-1', queue: 'CONSTRUCTION', slot: 0, kind: 'RESEARCH', subject: 'DENSE_FUEL_CELLS', count: 3, cost, startedAt, finishesAt },
    ]);
  });

  it('keeps an order still on its way to the server optimistic, with no clock', () => {
    const queue: ResearchQueueOrderView[] = [
      { id: 'tmp', slot: 1, projectId: 'DENSE_FUEL_CELLS', level: 4, cost, optimistic: true },
    ];
    expect(researchQueueOrders(queue)).toEqual([
      { id: 'tmp', queue: 'CONSTRUCTION', slot: 1, kind: 'RESEARCH', subject: 'DENSE_FUEL_CELLS', count: 4, cost, optimistic: true },
    ]);
  });

  it('is empty for an empty queue', () => {
    expect(researchQueueOrders([])).toEqual([]);
  });
});
