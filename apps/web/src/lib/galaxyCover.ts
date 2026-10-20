import { useEffect, type RefObject } from 'react';

/**
 * HOW MUCH OF THE GALAXY THE OPEN SHEETS HIDE. Owner, 2026-10-20: "menü, chat vs gibi komple
 * bir yavaşlık hantallık var".
 *
 * Measured on stage as the admin: with the Base page over the whole disc, the galaxy still drew
 * thirty frames a second of 126 draws and bloom that nobody could see — the loop that starves the
 * sheet's own taps and scrolls on a phone. The ticker (`galaxy/frames.tsx`) reads this:
 *
 *   · 'whole' — a page fills the room between the top bar and the dock: nothing is drawn.
 *   · 'part'  — a modal sheet stands over the dimmed rest of it: drawn at a slower step.
 *
 * A peek card is not modal and covers nothing: the world beside it stays live.
 */
export type GalaxyCover = 'whole' | 'part';

const covers = new Map<symbol, GalaxyCover>();
const listeners = new Set<() => void>();
let published: GalaxyCover | null = null;

export function galaxyCover(): GalaxyCover | null {
  let cover: GalaxyCover | null = null;
  for (const level of covers.values()) {
    if (level === 'whole') return 'whole';
    cover = 'part';
  }
  return cover;
}

function publish(): void {
  const cover = galaxyCover();
  if (cover === published) return;
  published = cover;
  for (const listener of [...listeners]) listener();
}

export function watchGalaxyCover(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cover the galaxy at `level` until the returned function is called. Idempotent to release. */
export function coverGalaxy(level: GalaxyCover): () => void {
  const key = Symbol('cover');
  covers.set(key, level);
  publish();
  return () => {
    covers.delete(key);
    publish();
  };
}

/**
 * Whole when the panel fills its holder (the room between the top bar and the dock) across the
 * full width; a column beside a wide screen's live galaxy is only ever part.
 */
const WHOLE_HEIGHT = 0.92;
const WHOLE_WIDTH = 0.95;

/** A modal sheet reports how much of the galaxy its panel hides, following it as it resizes. */
export function useGalaxyCover(panel: RefObject<HTMLElement | null>, modal: boolean): void {
  useEffect(() => {
    const element = panel.current;
    if (!modal || !element) return undefined;
    const key = Symbol('sheet');
    const measure = (): void => {
      const own = element.getBoundingClientRect();
      const room = element.parentElement?.getBoundingClientRect();
      const whole = room !== undefined && room.height > 0
        && own.height >= room.height * WHOLE_HEIGHT && own.width >= window.innerWidth * WHOLE_WIDTH;
      const level: GalaxyCover = whole ? 'whole' : 'part';
      if (covers.get(key) === level) return;
      covers.set(key, level);
      publish();
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    if (element.parentElement) observer?.observe(element.parentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      covers.delete(key);
      publish();
    };
  }, [panel, modal]);
}
