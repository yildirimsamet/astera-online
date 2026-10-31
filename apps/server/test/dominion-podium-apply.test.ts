import { describe, expect, it } from 'vitest';
import { applyDominionPodium } from '../src/services/dominion.js';

/**
 * THE PODIUM IS THREE BADGES ON A THOUSAND WORLDS. Capacity fix plan, item 4 (2026-11-01).
 *
 * Every galaxy read replaces the cached worlds' badges with the current podium. It
 * copied all thousand worlds to do it, a tenth of the read's CPU; a world whose badge
 * does not change is now handed on as it is.
 */
interface World { id: string; controller: { kind: string; playerId?: string }; dominionRank?: 1 | 2 | 3 }
const world = (id: string, playerId?: string, dominionRank?: 1 | 2 | 3): World => ({
  id,
  controller: playerId === undefined ? { kind: 'NEUTRAL' } : { kind: 'PLAYER', playerId },
  ...(dominionRank === undefined ? {} : { dominionRank }),
});

describe('applyDominionPodium', () => {
  it('moves the badges to the current podium', () => {
    const worlds = [world('a', 'p1', 1), world('b', 'p2'), world('c', 'p3', 2), world('n', undefined, 3)];
    const out = applyDominionPodium(worlds, new Map([['p2', 1 as const], ['p3', 2 as const]]));
    expect(out).toEqual([world('a', 'p1'), world('b', 'p2', 1), world('c', 'p3', 2), world('n')]);
    expect(Object.keys(out[0]!)).not.toContain('dominionRank');
    expect(Object.keys(out[3]!)).not.toContain('dominionRank');
  });

  it('hands on every world whose badge does not change without copying it', () => {
    const worlds = [world('a', 'p1', 1), world('b', 'p2'), world('n')];
    const out = applyDominionPodium(worlds, new Map([['p1', 1 as const]]));
    expect(out.every((each, index) => each === worlds[index])).toBe(true);
  });
});
