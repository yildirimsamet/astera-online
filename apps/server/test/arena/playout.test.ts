import { describe, expect, it } from 'vitest';
import { createPlayout, playInput, queueInput, resetPlayout } from '../../src/arena/playout.js';

/**
 * Owner 2026-10-20: "hızlı dönerken titriyor". Each input used to be held a fixed two
 * ticks after ITS OWN arrival, so a single late packet left a hole however deep the
 * queue was; the server repeated the last input and the client's prediction was wrong
 * by a tick. Inputs now play on a steady clock: the buffer absorbs lateness.
 */
const BUFFER = 2; const REPEAT_MAX = 3;
const run = (arrivals: Record<number, number[]>, ticks: number) => {
  const p = createPlayout<number>(); const played: (number | 'repeat' | 'neutral')[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    for (const seq of arrivals[tick] ?? []) queueInput(p, seq, seq, tick, BUFFER);
    const r = playInput(p, tick, REPEAT_MAX); played.push(typeof r === 'string' ? r : r.input);
  }
  return played;
};

describe('input playout', () => {
  it('waits the buffer once, then plays one input per tick', () => {
    expect(run({ 0: [1], 1: [2], 2: [3], 3: [4] }, 6)).toEqual(['neutral', 'neutral', 1, 2, 3, 4]);
  });

  it('absorbs a packet up to the buffer late without a hole', () => {
    // 3 is two ticks late and lands with 4 and 5.
    expect(run({ 0: [1], 1: [2], 4: [3, 4, 5], 5: [6], 6: [7] }, 9)).toEqual(['neutral', 'neutral', 1, 2, 3, 4, 5, 6, 7]);
  });

  it('plays a later packet the moment it lands, and the buffer has grown after it', () => {
    // 3 is four ticks late: two repeats, then no further wait.
    const played = run({ 0: [1], 1: [2], 6: [3, 4, 5, 6, 7], 7: [8], 8: [9] }, 12);
    expect(played).toEqual(['neutral', 'neutral', 1, 2, 'repeat', 'repeat', 3, 4, 5, 6, 7, 8]);
  });

  it('goes neutral after a long silence and buffers again on return', () => {
    const played = run({ 0: [1], 9: [2], 10: [3] }, 13);
    expect(played.slice(0, 3)).toEqual(['neutral', 'neutral', 1]);
    expect(played.slice(3, 9)).toEqual(['repeat', 'repeat', 'repeat', 'neutral', 'neutral', 'neutral']);
    expect(played.slice(9)).toEqual(['neutral', 'neutral', 2, 3]);
  });

  it('starts over after a reset', () => {
    const p = createPlayout<number>();
    queueInput(p, 1, 1, 0, BUFFER); playInput(p, 2, REPEAT_MAX);
    resetPlayout(p);
    queueInput(p, 2, 2, 5, BUFFER);
    expect(playInput(p, 5, REPEAT_MAX)).toBe('neutral');
    expect(playInput(p, 7, REPEAT_MAX)).toMatchObject({ seq: 2, input: 2 });
  });
});
