import { useCallback, useEffect, useRef } from 'react';
import { TutorialHand } from '../TutorialHand.js';
import { SchoolHighlight } from './SchoolHighlight.js';

/** One settled target for both marks. Only its own sheet scrolls, and a control
 * clipped by that sheet is never treated as a visible target. */
export function SchoolPointer({ targets, showHand = true }: { targets: () => readonly Element[]; showHand?: boolean }) {
  const settled = useRef<Element | null>(null);
  const rectangle = useRef<DOMRect | null>(null);
  const read = useCallback(() => settled.current ? [settled.current] : [], []);
  const bounds = useCallback(() => settled.current ? rectangle.current : null, []);
  /** A frame round something out in the scene would hide the very thing it is about. */
  const frame = useCallback(() => settled.current && !settled.current.hasAttribute('data-scene-mark') ? rectangle.current : null, []);
  useEffect(() => {
    let frame = 0, candidate: Element | null = null, since = 0, previous = '', scrollAt = 0, attempts = 0;
    const paint = () => {
      const target = document.querySelector('[data-loading-screen]') ? null : targets().at(-1) ?? null;
      const box = target?.getBoundingClientRect();
      const body = target?.closest<HTMLElement>('[data-sheet-body], [data-sheet-scroll]');
      const rail = target?.closest<HTMLElement>('[data-focus-rail]')?.querySelector<HTMLElement>('.overflow-y-auto');
      const scroll = body ?? (rail?.contains(target) ? rail : null);
      const port = scroll?.getBoundingClientRect();
      const sticky = scroll?.querySelector<HTMLElement>('[data-category-bar]')?.getBoundingClientRect().height ?? 0;
      const top = Math.max(0, (port?.top ?? 0) + sticky + (scroll ? 10 : 0));
      const bottom = Math.min(innerHeight, port?.bottom ?? innerHeight) - (scroll ? 8 : 0);
      const full = box !== undefined && box.top >= top - 1 && box.bottom <= bottom + 1;
      const oversized = box !== undefined && box.height > bottom - top && box.top <= top + 1 && box.bottom >= bottom - 1;
      const fits = box && box.width > 0 && box.height > 0 && bottom > top && (full || oversized) && box.left >= -1 && box.right <= innerWidth + 1;
      if (target !== candidate) {
        candidate = target; settled.current = null; since = performance.now(); previous = ''; attempts = 0; scrollAt = 0;
      }
      const key = box ? [box.x, box.y, box.width, box.height].map(Math.round).join(':') : '';
      // A control has to come to rest; the sky never does, and a hand that waited for it would blink.
      if (key !== previous) {
        previous = key;
        if (target?.hasAttribute('data-scene-mark') !== true) { since = performance.now(); settled.current = null; }
      }
      const queue = target?.hasAttribute('data-queue-lane') === true;
      if (box && scroll && !fits && attempts < 3 && (queue || (performance.now() - since >= 180 && performance.now() - scrollAt >= 400))) {
        scroll.scrollBy({ top: box.top - top, behavior: queue ? 'instant' : 'smooth' }); scrollAt = performance.now(); attempts++;
      }
      // A mark out in the scene is drawn under an open panel; the pointer must not float above it.
      const hidden = fits && target?.hasAttribute('data-scene-mark') === true
        && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('[data-focus-rail], [data-sheet-panel]');
      if (!fits || hidden || !target?.isConnected) settled.current = null;
      else if (performance.now() - since >= 180) {
        settled.current = target;
        const left = Math.max(0, box.left), y = Math.max(top, box.top);
        rectangle.current = new DOMRect(left, y, Math.min(innerWidth, box.right) - left, Math.min(bottom, box.bottom) - y);
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); settled.current = null; };
  }, [targets]);
  return <>{showHand && <TutorialHand targets={read} bounds={bounds} />}<SchoolHighlight targets={read} bounds={frame} /></>;
}
