/**
 * INPUT PLAYOUT (owner 2026-10-20: "hızlı dönerken titriyor").
 *
 * The first input after a (re)start waits `buffer` ticks; from then on one input plays
 * per tick on a steady clock, so a packet late by up to the buffer leaves no hole. A
 * hole repeats the last input — the client then corrects by a tick — and a packet that
 * finally lands plays at once, which leaves the buffer deeper: it grows to the link's
 * jitter by itself. A long silence goes neutral and buffers again.
 */
export interface Queued<I> { seq: number; due: number; input: I }
export interface Playout<I> { queue: Queued<I>[]; playing: boolean; last: number }

export const createPlayout = <I>(): Playout<I> => ({ queue: [], playing: false, last: Number.NEGATIVE_INFINITY });

export function resetPlayout<I>(p: Playout<I>): void {
  p.queue.length = 0; p.playing = false; p.last = Number.NEGATIVE_INFINITY;
}

export function queueInput<I>(p: Playout<I>, seq: number, input: I, tick: number, buffer: number): void {
  p.queue.push({ seq, due: tick + buffer, input });
}

/** The input for this tick, or what to do without one. */
export function playInput<I>(p: Playout<I>, tick: number, repeatMax: number): Queued<I> | 'repeat' | 'neutral' {
  const next = p.queue[0];
  if (next && (p.playing || next.due <= tick)) {
    p.queue.shift(); p.playing = true; p.last = tick;
    return next;
  }
  if (tick - p.last <= repeatMax) return 'repeat';
  p.playing = false;
  return 'neutral';
}
