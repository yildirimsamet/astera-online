import { describe, expect, it } from 'vitest';
import { recentHitAges } from '../src/galaxy/publicMoments.js';

/**
 * EVERY BOMB OF A BURST DETONATES IN FULL. Owner, 2026-10-16: *"Vurulmadan hedef'e ulaşan
 * füzelerin hepsi için ard ard'a olsa bile animasyon doğru düzgün oynatılıyor mu?"* The
 * radiation cloud drew one detonation, from the latest hit: a second bomb half a second
 * behind the first snapped the first's expanding mass back to a seed and started over.
 * The cloud now carries the age of each recent hit, so every detonation runs its course.
 */
describe('the hits a radiation cloud is still detonating', () => {
  it('gives each landed hit its own age, newest first, and leaves empty slots unlit', () => {
    expect(recentHitAges([1_000, 1_500], 2_200, 4)).toEqual([0.7, 1.2, -1, -1]);
  });

  it('does not start a hit that has not landed yet', () => {
    expect(recentHitAges([1_000, 3_000], 2_000, 3)).toEqual([1, -1, -1]);
  });

  it('keeps the newest hits when a burst outnumbers the slots', () => {
    expect(recentHitAges([0, 200, 400, 600, 800], 1_000, 3)).toEqual([0.2, 0.4, 0.6]);
  });

  it('writes into the uniform it is given, so a frame allocates nothing', () => {
    const into = [9, 9];
    expect(recentHitAges([500], 1_000, 2, into)).toBe(into);
    expect(into).toEqual([0.5, -1]);
  });
});
