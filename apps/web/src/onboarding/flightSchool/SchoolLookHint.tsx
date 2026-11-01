import { useEffect, useState } from 'react';

/** A short invitation during travel, dismissed as soon as a real drag is tried. */
export function SchoolLookHint({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    const show = window.setTimeout(() => { setVisible(true); }, 1500);
    const hide = window.setTimeout(() => { setVisible(false); }, 7000);
    const down = (event: PointerEvent) => {
      if (event.target instanceof HTMLCanvasElement) start = { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 12) {
        setVisible(false); window.clearTimeout(show); start = null;
      }
    };
    const up = () => { start = null; };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.clearTimeout(show); window.clearTimeout(hide);
      window.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    };
  }, []);
  return visible ? <div className="school-look-hint" data-school-look-hint>
    <span aria-hidden="true">‹</span><p>{label}</p><span aria-hidden="true">›</span>
  </div> : null;
}
