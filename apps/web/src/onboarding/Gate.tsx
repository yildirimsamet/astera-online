import { useEffect, useState } from 'react';

/**
 * ONE THING IS PRESSABLE AT A TIME. D56.
 *
 * A beat that says "raise the Command Core first" while every other control on the
 * screen still works is a suggestion, and a stranger who presses something else
 * ends up with an instruction on screen that no longer describes the world in
 * front of them. The rehearsal gates instead: during a beat, the target is live
 * and nothing else is.
 *
 * GATED BY CAPTURING EVENTS, NOT BY COVERING THE SCREEN — and the difference is
 * the whole reason this works on a phone. A blocking overlay swallows the gesture
 * as well as the tap: the planet panel could not be SCROLLED to reach the row the
 * beat was pointing at, and the disc could not be orbited to find a world hiding
 * behind another. A capture listener cancels ACTIVATIONS only, so scrolling,
 * pinching and orbiting all keep working and only the wrong press is refused.
 *
 * `preventDefault` is used on `click` alone. On a pointer or touch event it would
 * cancel the scroll the player was starting, which is the same bug wearing a
 * different hat.
 *
 * THE WAY OUT IS NEVER GATED. The beat card carries a skip and a way to sign in,
 * and it is exempt by `data-beat-card` — a player who cannot find the thing the
 * beat is asking for has to be able to leave, or a guided opening becomes a locked
 * door. That is the one concession this makes to being a tutorial rather than a
 * cage, and it is deliberate.
 */

/** Activation events. A press begins at one of these and ends at `click`. */
const ACTIVATIONS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'] as const;

export function useGate(
  targets: () => readonly Element[],
  active: boolean,
  onRefused: () => void,
): void {
  useEffect(() => {
    if (!active) return;

    const guard = (event: Event): void => {
      const node = event.target;
      if (!(node instanceof Node)) return;

      // The card that is doing the instructing, and whatever it carries.
      if (node instanceof Element && node.closest('[data-beat-card]')) return;
      if (node.parentElement?.closest('[data-beat-card]')) return;

      for (const allowed of targets()) {
        if (allowed === node || allowed.contains(node)) return;
      }

      event.stopPropagation();
      // Only the activation itself. Cancelling a pointer event here would cancel
      // the scroll or the orbit it was the first frame of.
      if (event.type === 'click') {
        event.preventDefault();
        /**
         * A REFUSAL HAS TO BE FELT, or it reads as a broken button.
         *
         * Only on `click`, so one press nudges once rather than five times — and
         * only there because that is the event a person means by "I pressed it".
         */
        onRefused();
      }
    };

    for (const type of ACTIVATIONS) document.addEventListener(type, guard, true);
    return () => {
      for (const type of ACTIVATIONS) document.removeEventListener(type, guard, true);
    };
  }, [targets, active, onRefused]);
}

/**
 * BRING THE SUBJECT INTO VIEW, ONCE, WHEN A BEAT STARTS.
 *
 * A panel is taller than a phone: the Wasp row sits below the fold on the Reach
 * tab, and a beat pointing at something nobody can see reads as a beat that is
 * broken. The onboarding owns the flow, so it does the scrolling.
 *
 * ONCE PER BEAT, AND NEVER AGAIN. Re-running it would fight a player who scrolled
 * away to look at something — the gate stops them pressing the wrong thing, and
 * that is a different matter from stopping them LOOKING. It also waits for the
 * element to exist, because a sheet animating in has no box to scroll to yet.
 */
export function useScrollIntoView(target: () => Element | null, key: string): void {
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const find = (): void => {
      const el = target();
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      // ~2 seconds at 60fps, which covers a sheet's entrance and then gives up
      // rather than spinning for the life of the beat.
      if (tries++ > 120) return;
      raf = requestAnimationFrame(find);
    };
    raf = requestAnimationFrame(find);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [key]);
}



/**
 * Which edge a follower should sit on, given where the subject is.
 *
 * MEASURED ON A FRAME BUT REPORTED ONLY WHEN IT FLIPS. The answer changes at most
 * a couple of times in a whole rehearsal, and re-rendering the galaxy to say
 * "still the bottom" sixty times a second is the cost this exists to avoid.
 */
export function usePlacement(
  targets: () => readonly Element[],
  band: number,
): 'top' | 'bottom' {
  const [place, setPlace] = useState<'top' | 'bottom'>('bottom');

  useEffect(() => {
    let raf = 0;
    const look = (): void => {
      const found = targets();
      const box = found.length > 0 ? found[found.length - 1]!.getBoundingClientRect() : null;
      /**
       * ANY SURFACE THAT OWNS THE BOTTOM EDGE, not just a sheet.
       *
       * The focus rail is the other one: tapping a world opens it along the bottom
       * with the commitment inside, and a card parked there covers the very
       * control the beat is asking to be opened. Narrowing the lit list to the
       * attack button is what exposed this — before that the rail happened to be
       * measured, and the flip happened by accident rather than by rule.
       */
      const sheet = document.querySelector('[data-sheet-panel], [data-focus-rail]') !== null;
      const inTheWay =
        box !== null &&
        box.height < window.innerHeight * 0.75 &&
        box.bottom > window.innerHeight - band;

      const wanted: 'top' | 'bottom' = sheet || inTheWay ? 'top' : 'bottom';
      setPlace((previous) => (previous === wanted ? previous : wanted));
      raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [targets, band]);

  return place;
}
