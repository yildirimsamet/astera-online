import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { outpostFinderTargets } from '../src/starter/outpostTargets.js';

/**
 * THE OUTPOST LIST, WHEN THE FIRST HUNT STARTS (plan §5.2, F4d). The ship's two first outposts lead the
 * list and say so; a part's outpost comes next; the galaxy's others follow as before.
 */
const at = { x: 0, y: 0, z: 0 };
const post = (id: string, over: { firstHunt?: boolean; hasPart?: boolean; coreLevel?: number } = {}) =>
  ({ id, name: id, body: 'OUTPOST' as const, position: at, coreLevel: over.coreLevel ?? 1, ...over });

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the outpost list', () => {
  it('puts the first hunt\'s two first, then the one with a part, then the rest as they came', () => {
    const listed = outpostFinderTargets([post('Ash'), post('Bel', { hasPart: true }), post('Cor', { firstHunt: true }), post('Dun'), post('Eld', { firstHunt: true, coreLevel: 2 })], i18n.t);
    expect(listed.map(target => target.id)).toEqual(['Cor', 'Eld', 'Bel', 'Ash', 'Dun']);
  });

  it('names the first hunt\'s two for what they are, with their level', () => {
    const [first, second, third] = outpostFinderTargets([post('Cor', { firstHunt: true }), post('Eld', { firstHunt: true, coreLevel: 2 }), post('Ash', { coreLevel: 3 })], i18n.t);
    expect(first).toMatchObject({ kind: 'planet', label: 'Cor', detail: 'First hunt · Guard level 1' });
    expect(second?.detail).toBe('First hunt · Guard level 2');
    expect(third?.detail).toBe('Guard level 3');
  });

  it('lists only outposts', () => {
    expect(outpostFinderTargets([{ id: 'ship', name: 'Ship', body: 'VESSEL', coreLevel: 1 }], i18n.t)).toEqual([]);
  });
});
