import { describe, expect, it } from 'vitest';
import { outpostName, siteCode } from '../src/starter/index.js';

/**
 * AN OUTPOST HAS A NAME (player test, Codex report: "OP-625C" on the map). The code stays as the
 * second line that tells two alike apart; the name is what a player remembers and says.
 */
describe('an outpost\'s name', () => {
  const ids = Array.from({ length: 400 }, (_, index) => `${index.toString(16).padStart(8, '0')}-7c1e-4a2b-9d3f-${(index * 7919).toString(16).padStart(12, '0')}`);

  it('is a word, not a code, and the same every time', () => {
    for (const id of ids) {
      expect(outpostName(id)).toMatch(/^[A-Z][a-z]{3,8}$/u);
      expect(outpostName(id)).toBe(outpostName(id));
    }
  });

  it('rarely repeats inside one starter galaxy of eight', () => {
    expect(new Set(ids.map(outpostName)).size).toBeGreaterThanOrEqual(150);
  });

  it('keeps the code that tells two alike apart', () => {
    expect(siteCode({ id: '625c0a1b-0000', kind: 'OUTPOST' })).toBe('OP-625C');
    expect(siteCode({ id: '9f2e0a1b-0000', kind: 'WRECK' })).toBe('WR-9F2E');
  });
});
