import { describe, expect, it } from 'vitest';
import { flashMoments, NOT_FILMED } from '../src/flashMoments.js';

/** Plan §1.5, the list the owner approved: every bright moment is filmed, or says where it is looked at instead. */
describe('the bright moments', () => {
  const moments = flashMoments('http://x');

  it('films each moment the plan names, once', () => {
    expect(moments.map((m) => m.id)).toEqual([
      'simulator-battle', 'arena-match', 'radiation-bomb', 'jump', 'prologue-warp', 'prologue-torch', 'legacy-reveal',
      'death-star-impact', 'planet-battle', 'tempest-engine',
    ]);
  });

  it('films the galaxy strikes from the 3D art gallery, so nothing is left to the eye alone', () => {
    expect(NOT_FILMED).toEqual([]);
  });

  it('films a strike through its whole length, from the replay press', () => {
    const strike = (id: string) => moments.find((m) => m.id === id);
    // The impact lands 1.8 s after the press and lasts 8 s; the engagement lasts 10 s.
    expect(strike('death-star-impact')?.seconds).toBeGreaterThanOrEqual(10);
    expect(strike('planet-battle')?.seconds).toBeGreaterThanOrEqual(12);
    expect(strike('death-star-impact')?.act).toBeDefined();
    expect(strike('planet-battle')?.act).toBeDefined();
  });

  it('films the jump through all five of its beats', () => {
    expect(moments.find((m) => m.id === 'jump')?.seconds).toBeGreaterThanOrEqual(25);
  });

  it('holds time from load only for the previews, which start their effect with the page', () => {
    expect(moments.filter((m) => m.heldFromLoad).map((m) => m.id)).toEqual(['radiation-bomb', 'jump']);
  });

  it('names what it cannot film, why, and where it is looked at instead', () => {
    for (const left of NOT_FILMED) {
      expect(left.why.length).toBeGreaterThan(0);
      expect(left.when).toMatch(/S22/);
    }
  });
});
