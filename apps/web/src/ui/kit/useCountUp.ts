import { useEffect, useRef, useState } from 'react';

/**
 * A number that rolls to its new value instead of snapping to it.
 *
 * Two rules, both learned from the thing this replaces:
 *
 * ONE — it does NOT count up on mount. A status bar that animates 0 → 584 every time
 * the app opens is a slot machine, and it also lies: the alloy was already there. The
 * first value is shown as-is and only later CHANGES roll.
 *
 * TWO — it only rolls a material change. Resources accrue continuously and are
 * re-projected every few seconds; animating that trickle would leave the number
 * permanently in motion and impossible to read. Loot landing moves thousands, and
 * that is worth watching arrive. The threshold is what separates the two.
 */
export function useCountUp(value: number, { duration = 650 }: { duration?: number } = {}): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const start = from.current;
    const delta = Math.abs(value - start);
    const material = delta > Math.max(50, Math.abs(start) * 0.04);

    if (!material) {
      from.current = value;
      setShown(value);
      return;
    }

    const began = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - began) / duration);
      // Decelerating: the figure arrives fast and settles, like a mechanical counter
      // running down rather than a linear interpolation.
      const eased = 1 - (1 - t) ** 3;
      setShown(start + (value - start) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, duration]);

  return shown;
}

/**
 * True for a moment after a value the player cares about jumps.
 *
 * Production creeps up a few units a second and must not twitch; a raid landing or a
 * fleet coming home with loot moves thousands, and that deserves to be felt.
 */
export function useJump(value: number, hold = 450): boolean {
  const previous = useRef(value);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const delta = Math.abs(value - previous.current);
    const material = delta > Math.max(50, previous.current * 0.04);
    previous.current = value;
    if (!material) return;

    setPopping(true);
    const id = setTimeout(() => {
      setPopping(false);
    }, hold);
    return () => {
      clearTimeout(id);
    };
  }, [value, hold]);

  return popping;
}
