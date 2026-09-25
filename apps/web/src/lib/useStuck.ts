import { useEffect, useRef, useState } from 'react';

/**
 * WHETHER A STICKY BAR IS PINNED TO THE TOP OF ITS PAGE.
 *
 * CSS cannot style a `position: sticky` element by whether it is stuck, so a one-pixel
 * sentinel sits just above the bar: once it has scrolled past the top of the page's
 * scroller (a sheet's body), the bar is pinned. A sentinel below the fold is not "past"
 * — only one above the scroller's top edge counts. Where there is no
 * `IntersectionObserver` the bar is simply never treated as pinned.
 */
export function useStuck<T extends HTMLElement>(): { sentinel: React.RefObject<T | null>; stuck: boolean } {
  const sentinel = useRef<T>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const top = entry.rootBounds?.top ?? 0;
        setStuck(entry.boundingClientRect.top < top);
      },
      { root: node.closest('[data-sheet-body]'), threshold: 0 },
    );
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  return { sentinel, stuck };
}
