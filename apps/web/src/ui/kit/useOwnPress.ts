import { useRef, type MouseEvent } from 'react';

/**
 * A CONTROL ANSWERS ONLY A PRESS THAT BEGAN ON IT.
 *
 * The bug this exists to make unrepeatable: tapping a world opened the planet
 * sheet and it shut itself again (D109a). A synthesised click is delivered to
 * whatever occupies the point at DISPATCH time, not to what was there when the
 * finger went down — so a surface that MOUNTS as a result of a gesture receives
 * the tail of that gesture as a press of its own:
 *
 *     pointerdown → canvas          the finger lands on the world
 *     pointerup   → canvas
 *     SHEET OPEN                    React mounts the sheet ~98ms later
 *     click       → button[scrim]   the browser dispatches the tap's click NOW
 *
 * Any control that can appear under a finger is exposed to this, which in this
 * interface is every dismiss control and every control on the focus rail — the
 * rail mounts along the bottom edge the instant a world is selected, and a world
 * can be tapped there. The cost is not cosmetic: the stray click lands on CLEAR
 * and deselects the world the player just chose.
 *
 * A DELAY WOULD ONLY MOVE THE RACE — it reached a phone first and a desktop
 * second as the machine got faster. This is timing-independent: the control
 * records its own `pointerdown` and refuses a click without one.
 *
 * KEYBOARD ACTIVATION IS NOT A POINTER PRESS AND MUST STILL WORK. Enter or Space
 * on a focused button fires a click with no `pointerdown` at all, which is
 * exactly the shape being refused. `detail === 0` is what separates them: a
 * pointer click carries a click count, a keyboard or programmatic one does not.
 */
export function useOwnPress(onPress: () => void): {
  onPointerDown: () => void;
  onClick: (event: MouseEvent) => void;
} {
  const began = useRef(false);
  return {
    onPointerDown: () => {
      began.current = true;
    },
    onClick: (event: MouseEvent) => {
      const fromKeyboard = event.detail === 0;
      if (!fromKeyboard && !began.current) return;
      began.current = false;
      onPress();
    },
  };
}
