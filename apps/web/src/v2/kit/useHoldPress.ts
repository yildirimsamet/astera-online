import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { haptic } from '../../lib/haptics.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';

/** How long a press has to be held before it commits. Spec B9. */
export const HOLD_MS = 600;
/** How long an unanswered Enter confirm stays armed. */
const CONFIRM_MS = 4_000;
/** How long "hold to confirm" stays on the face after a release that came too soon. */
const NUDGE_MS = 1_600;

export interface HoldPress {
  /** The finger or Space is down and the hold is filling. */
  holding: boolean;
  /** Enter armed the inline second step. */
  confirming: boolean;
  /** A release came too soon: the face says how to do it. */
  nudge: boolean;
  /** Spread onto the button that is held. */
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
    onClick: (event: MouseEvent) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
    onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => void;
    onBlur: () => void;
  };
}

/**
 * THE HOLD-TO-COMMIT GESTURE, WITHOUT ITS FACE. Spec B9, decision K4. Shared by the
 * v2 `HoldButton` and the game kit's hold action so both keep one set of rules:
 * the press must begin on the button (`useOwnPress`), Space holds, Enter confirms
 * twice, and a release that came too soon says so. `holdMs` lets a heavier action
 * ask for a longer hold.
 */
export function useHoldPress(onCommit: () => void, disabled: boolean, holdMs = HOLD_MS): HoldPress {
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [nudge, setNudge] = useState(false);

  /** Ends a hold. `released` is a finger or key let go: if the hold had not gone through, say how. */
  const stop = (released = false): void => {
    if (released && timer.current !== null) setNudge(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  useEffect(() => {
    if (!nudge) return undefined;
    const expiry = window.setTimeout(() => { setNudge(false); }, NUDGE_MS);
    return () => { window.clearTimeout(expiry); };
  }, [nudge]);

  const start = (): void => {
    if (disabled || timer.current !== null) return;
    haptic('tap');
    setNudge(false);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      haptic('commit');
      onCommit();
    }, holdMs);
  };

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!confirming) return undefined;
    const expiry = window.setTimeout(() => { setConfirming(false); }, CONFIRM_MS);
    return () => { window.clearTimeout(expiry); };
  }, [confirming]);

  /** A pointer click only ever answers the inline confirm, and only one that began here. */
  const confirmPress = useOwnPress(() => {
    if (!confirming) return;
    setConfirming(false);
    onCommit();
  });

  return {
    holding,
    confirming,
    nudge,
    handlers: {
      onPointerDown: (event) => {
        // Touch, pen and the primary mouse button arm it; the middle and secondary buttons do not.
        if (event.button !== 1 && event.button !== 2) start();
        confirmPress.onPointerDown();
      },
      onPointerUp: () => { stop(true); },
      onPointerLeave: () => { stop(); },
      onPointerCancel: () => { stop(); },
      onContextMenu: (event) => { event.preventDefault(); },
      onClick: confirmPress.onClick,
      onKeyDown: (event) => {
        if (event.key === ' ') {
          event.preventDefault();
          if (!event.repeat) start();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (confirming) {
            setConfirming(false);
            onCommit();
          } else {
            setConfirming(true);
          }
        }
      },
      onKeyUp: (event) => { if (event.key === ' ') stop(true); },
      onBlur: () => { stop(); setConfirming(false); },
    },
  };
}
