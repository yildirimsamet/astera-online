import { describe, expect, it } from 'vitest';
import { contactRail } from '../src/galaxy/contactRail.js';

/**
 * A PIRATE ABOARD IS A CONTACT TO READ (plan F6, walk 2026-11-08). The main galaxy's pirate rail
 * reads the pirate roster, which the starter galaxy does not have: the scout the sensor lessons are
 * taught on opened nothing when touched. Aboard it opens as any other craft does.
 */
describe('which rail a touched contact opens', () => {
  it('keeps the pirate rail in the main galaxy', () => {
    expect(contactRail({ kind: 'pirate' }, false)).toBe('pirate');
  });
  it('reads a pirate aboard as a contact', () => {
    expect(contactRail({ kind: 'pirate' }, true)).toBe('contact');
  });
  it('reads every other craft as a contact', () => {
    expect(contactRail({ kind: 'fleet' }, false)).toBe('contact');
    expect(contactRail({ kind: 'unknown' }, true)).toBe('contact');
  });
});
