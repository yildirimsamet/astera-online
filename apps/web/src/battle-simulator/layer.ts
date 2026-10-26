import { useEffect, type RefObject } from 'react';
import { claimEscape } from '../lib/sheet.js';
import { coverGalaxy } from '../lib/galaxyCover.js';
import { useNativeBack } from '../platform/nativeBack.js';

/**
 * A full-screen 3D layer over the game (the replay, the simulator): the galaxy stops drawing, the
 * page stops scrolling, Escape and the phone's back close it, and Tab stays inside it.
 */
export function useFullScreenLayer(panel: RefObject<HTMLElement | null>, onClose: () => void): void {
  useNativeBack(panel, onClose);
  useEffect(() => {
    const release = coverGalaxy('whole');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (claimEscape(event, panel.current)) { onClose(); return; }
      if (event.key !== 'Tab') return;
      const top = panel.current?.querySelector<HTMLElement>('[data-sheet-panel]') ?? panel.current;
      const controls = [...(top?.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, summary, [tabindex="0"]') ?? [])]
        .filter(node => node.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; release(); };
  }, [panel, onClose]);
}
