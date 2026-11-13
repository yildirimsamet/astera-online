import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { REPEAT_START_MS, repeatInterval, repeatStep } from './logic.js';

export interface RepeatPress {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * TAP FOR ONE, HOLD FOR MANY — SAFE INSIDE A SCROLLING LIST.
 *
 * A tap counts on release, so a finger that lands on a card and then scrolls adds
 * nothing (the browser cancels the pointer when it takes the gesture). A hold starts
 * repeating after `REPEAT_START_MS` and speeds up; `stock` scales the later steps so
 * four hundred ships do not take four hundred repeats. A keyboard activation (a click
 * with no click count) adds one; the click a pointer tap also fires is ignored.
 */
export function useRepeatPress(onStep: (amount: number) => void, enabled: boolean, stock = 0): RepeatPress {
  const timer = useRef<number | null>(null);
  const pressed = useRef(false);
  const repeated = useRef(false);
  const step = useRef(onStep);
  useEffect(() => { step.current = onStep; });

  const clear = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const repeat = (tick: number): void => {
    repeated.current = true;
    step.current(repeatStep(tick, stock));
    timer.current = window.setTimeout(() => { repeat(tick + 1); }, repeatInterval(tick));
  };

  useEffect(() => clear, []);
  // A held ± stops at its bound: the finger may still be down, or the button gone from under it.
  useEffect(() => { if (!enabled) clear(); }, [enabled]);

  return {
    onPointerDown: (event) => {
      if (!enabled || event.button === 1 || event.button === 2) return;
      clear();
      pressed.current = true;
      repeated.current = false;
      timer.current = window.setTimeout(() => { repeat(0); }, REPEAT_START_MS);
    },
    onPointerUp: () => {
      const tapped = pressed.current && !repeated.current;
      pressed.current = false;
      clear();
      if (tapped && enabled) step.current(1);
    },
    onPointerCancel: () => {
      pressed.current = false;
      clear();
    },
    onPointerLeave: () => {
      pressed.current = false;
      clear();
    },
    onClick: (event) => {
      if (event.detail === 0 && enabled) step.current(1);
    },
    onContextMenu: (event) => { event.preventDefault(); },
  };
}
