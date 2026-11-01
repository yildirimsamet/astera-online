import { useEffect, useRef } from 'react';

/** The ring follows the actual rendered control. It never owns a hitbox or
 * React frame state, and disappears while its subject is off screen. */
export function SchoolHighlight({ targets, bounds }: { targets: () => readonly Element[]; bounds?: () => DOMRect | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const box = bounds ? bounds() : targets().at(-1)?.getBoundingClientRect();
      const node = ref.current;
      if (node) {
        const visible = box && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
        node.style.visibility = visible ? 'visible' : 'hidden';
        if (visible) {
          node.style.transform = `translate3d(${String(box.x - 4)}px,${String(box.y - 4)}px,0)`;
          node.style.width = `${String(box.width + 8)}px`;
          node.style.height = `${String(box.height + 8)}px`;
        }
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); };
  }, [targets, bounds]);
  return <div ref={ref} data-school-highlight aria-hidden="true" className="school-highlight left-0 top-0" style={{ visibility: 'hidden', pointerEvents: 'none' }} />;
}
