import { describe, expect, it } from 'vitest';
import { BURN_MS, PATCH_MS } from '../src/onboarding/prologue/world.js';
import { SYNTH_CUES, synthesize } from '../src/lib/synth.js';

/**
 * SOUNDS MADE ON THE DEVICE (owner 2026-11-06: "Ses bile yok!"). A breaker, a furnace catching, a
 * weld and a jump are drawn from code at unlock: no file to fetch, nothing to wait for.
 */
describe('a synthesized cue', () => {
  it('is a short, audible, unclipped sound', () => {
    for (const cue of SYNTH_CUES.filter(each => each !== 'ignite' && each !== 'weld')) {
      const samples = synthesize(cue, 48_000);
      const seconds = samples.length / 48_000;
      expect(seconds).toBeGreaterThan(0.1);
      expect(seconds).toBeLessThan(3.5);
      const peak = samples.reduce((most, value) => Math.max(most, Math.abs(value)), 0);
      expect(peak).toBeGreaterThan(0.2);
      expect(peak).toBeLessThanOrEqual(1);
      expect(samples.every(Number.isFinite)).toBe(true);
    }
  });

  /** Owner 2026-11-06: the furnace went quiet halfway through its burn. It roars until the batch is out. */
  it('keeps the furnace roaring for the whole burn', () => {
    const rate = 8_000;
    const samples = synthesize('ignite', rate);
    expect(samples.length / rate).toBeGreaterThanOrEqual(BURN_MS / 1000);
    const loudness = (from: number, to: number) => {
      const part = samples.slice(Math.round(from * rate), Math.round(to * rate));
      return Math.sqrt(part.reduce((sum, value) => sum + value * value, 0) / part.length);
    };
    expect(loudness(4.5, 5.5)).toBeGreaterThan(loudness(0.5, 1.5) * 0.35);
  });

  /** Owner playtest 2026-11-06: the weld went quiet long before the patch held. It burns until it holds. */
  it('keeps the torch burning for the whole patch, and strikes it with its own short arc', () => {
    const rate = 8_000;
    const samples = synthesize('weld', rate);
    expect(samples.length / rate).toBeGreaterThanOrEqual(PATCH_MS / 1000);
    const loudness = (from: number, to: number) => {
      const part = samples.slice(Math.round(from * rate), Math.round(to * rate));
      return Math.sqrt(part.reduce((sum, value) => sum + value * value, 0) / part.length);
    };
    expect(loudness(5.8, 6.8)).toBeGreaterThan(loudness(0.5, 1.5) * 0.35);
    expect(SYNTH_CUES).toContain('arc');
  });

  /** Owner playtest 2026-11-07: a repair order's sound is half a second to a second, no more. */
  it('strikes the arc in under a second', () => {
    const seconds = synthesize('arc', 8_000).length / 8_000;
    expect(seconds).toBeGreaterThanOrEqual(0.5);
    expect(seconds).toBeLessThanOrEqual(1);
  });

  it('ends in silence, so nothing clicks when it stops', () => {
    for (const cue of SYNTH_CUES) {
      const tail = synthesize(cue, 48_000).slice(-240);
      expect(Math.max(...tail.map(Math.abs))).toBeLessThan(0.02);
    }
  });

  /** Retention plan §6.2: a salvage crate unlatches with its own sound. */
  it('has a sound for a crate coming open', () => {
    expect(SYNTH_CUES).toContain('crate');
  });

  it('sounds the same every time', () => {
    expect(synthesize('switch', 22_050)).toEqual(synthesize('switch', 22_050));
  });
});
