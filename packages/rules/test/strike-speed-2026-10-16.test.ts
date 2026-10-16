import { describe, expect, it } from 'vitest';
import { DEATH_STAR, RADIATION_BOMB } from '../src/index.js';

/**
 * FASTER STRATEGIC WEAPONS. Owner, 2026-10-16: *"Ölüm yıldızının hızını şu anki hızından %50
 * daha fazla yap. Radyasyon füzelerinin hızını şu anki hızlarından %30 daha fazla yap."*
 * Both were 1,000 units a minute after the 2026-10-13 tempo slowdown.
 */
describe('strategic weapon speed', () => {
  it('flies a Death Star half again as fast as it did', () => {
    expect(DEATH_STAR.speed).toBe(1_000 * 1.5);
  });

  it('flies a radiation bomb thirty per cent faster than it did', () => {
    expect(RADIATION_BOMB.speed).toBe(1_000 * 1.3);
  });
});
