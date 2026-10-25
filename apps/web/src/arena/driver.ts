import { ARENA_TUNING } from '@astera/rules/arena';
import { strideFor } from '../galaxy/frames.js';

/** The only owner of simulation steps, independent of R3F's render callbacks. */
export function createFrameDriver(step: () => void, draw: (time: number, alpha: number) => void) {
  const stepMs = 1000 / ARENA_TUNING.tickRate;
  let previous: number | null = null;
  let accumulator = 0;
  let refreshMs = 1000 / 60;
  let measured = false;
  let skip = 0;
  let ticks = 0;
  return {
    get ticks(): number { return ticks; },
    advance(time: number, canRender = true): void {
      if (!Number.isFinite(time) || (previous !== null && time < previous)) return;
      const elapsed = previous === null ? 0 : time - previous;
      previous = time;
      if (elapsed > 0 && elapsed < 100) {
        refreshMs = measured ? refreshMs + (elapsed - refreshMs) * 0.1 : elapsed;
        measured = true;
      }
      accumulator += Math.min(elapsed, stepMs * 5);
      let recovered = 0;
      while (accumulator + 0.00000001 >= stepMs && recovered < 5) {
        step();
        accumulator = Math.max(0, accumulator - stepMs);
        recovered++;
        ticks++;
      }
      if (recovered === 5) accumulator %= stepMs;
      if (!canRender) return;
      const stride = strideFor(60, refreshMs);
      if (skip > 0 && skip < stride) { skip--; return; }
      skip = stride - 1;
      draw(time, accumulator / stepMs);
    },
  };
}
