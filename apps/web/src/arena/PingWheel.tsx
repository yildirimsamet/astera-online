import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { PING_KINDS, pingSector, type PingKind } from './pings.js';
import type { ArenaCopy } from './copy.js';

/** How long a finger rests before the wheel opens; a tap or a drag never opens it. */
export const PING_HOLD_MS = 320;
const DRIFT = 12;
const DEAD_ZONE = 26;
const EDGE = 96;

export const PING_ICONS: Record<PingKind, ReactNode> = {
  enemy: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" /><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" /></svg>,
  farm: <svg viewBox="0 0 24 24"><path d="M12 3l6 6-6 12-6-12z" /><path d="M6 9h12" /></svg>,
  go: <svg viewBox="0 0 24 24"><path d="M5 19l7-15 7 15-7-4z" /></svg>,
  danger: <svg viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17v.5" /></svg>,
};

interface Open<T> { target: T; cx: number; cy: number; held: boolean }

/**
 * Hold anywhere free on the screen: a round wheel of four calls opens under the finger (owner
 * 2026-10-22). Slide onto one and lift, or lift at the centre and tap one; a tap on free screen
 * closes it. `aim` fixes the spot the moment the wheel opens, so the call marks it however the
 * view turns while the pilot chooses; the wheel sits in its own layer, so the stick and the
 * keys keep working meanwhile.
 *
 * A mouse calls it with the wheel's button only (owner 2026-10-27: a click opened it): at once,
 * under the cursor; under the pointer lock on the crosshair, chosen by pushing the mouse towards a
 * call and letting go. `onHold` says while it holds the mouse, so the ship does not turn meanwhile.
 */
export function PingWheel<T>({ c, aim, onPing, locked = false, onHold }: { c: ArenaCopy; aim: (x: number, y: number) => T;
  onPing: (kind: PingKind, target: T) => void; locked?: boolean; onHold?: (held: boolean) => void }) {
  const [open, setOpen] = useState<Open<T> | null>(null);
  const [hot, setHot] = useState<PingKind | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = (): void => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  const close = (): void => { setOpen(null); setHot(null); };
  const send = (kind: PingKind, at: Open<T>): void => { onPing(kind, at.target); close(); };
  const place = (x: number, y: number): Open<T> => ({ target: aim(x, y), held: true,
    cx: Math.min(Math.max(x, EDGE), window.innerWidth - EDGE), cy: Math.min(Math.max(y, EDGE), window.innerHeight - EDGE) });
  // The page's latest props, for the document listeners the lock needs (they stay put across renders).
  const latest = useRef({ place, onPing, onHold });
  latest.current = { place, onPing, onHold };
  useEffect(() => {
    if (!locked) return;
    let held: { at: Open<T>; x: number; y: number } | null = null;
    const down = (event: MouseEvent): void => {
      if (event.button !== 1) return;
      event.preventDefault();
      const at = latest.current.place(window.innerWidth / 2, window.innerHeight / 2);
      held = { at, x: 0, y: 0 }; setOpen(at); setHot(null); latest.current.onHold?.(true);
    };
    const move = (event: MouseEvent): void => {
      if (!held) return;
      held.x += event.movementX; held.y += event.movementY; setHot(pingSector(held.x, held.y, DEAD_ZONE));
    };
    const up = (event: MouseEvent): void => {
      if (event.button !== 1 || !held) return;
      const kind = pingSector(held.x, held.y, DEAD_ZONE);
      if (kind) latest.current.onPing(kind, held.at.target);
      held = null; setOpen(null); setHot(null); latest.current.onHold?.(false);
    };
    document.addEventListener('mousedown', down); document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousedown', down); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      if (held) { setOpen(null); latest.current.onHold?.(false); }
    };
  }, [locked]);

  const down = (event: PointerEvent<HTMLDivElement>): void => {
    if (open && !open.held) { close(); return; }
    if (press.current || locked) return;
    if (event.pointerType === 'mouse' && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { clientX: x, clientY: y } = event;
    press.current = { id: event.pointerId, x, y };
    stop();
    if (event.pointerType === 'mouse') { event.preventDefault(); setOpen(place(x, y)); return; }
    timer.current = setTimeout(() => {
      timer.current = null;
      setOpen(place(x, y));
    }, PING_HOLD_MS);
  };
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const start = press.current;
    if (start?.id !== event.pointerId) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (open) setHot(pingSector(dx, dy, DEAD_ZONE));
    else if (Math.hypot(dx, dy) > DRIFT) { stop(); press.current = null; }
  };
  const up = (event: PointerEvent<HTMLDivElement>): void => {
    const start = press.current;
    if (start?.id !== event.pointerId) return;
    press.current = null; stop();
    if (!open) return;
    const kind = pingSector(event.clientX - start.x, event.clientY - start.y, DEAD_ZONE);
    if (kind) send(kind, open);
    else { setOpen({ ...open, held: false }); setHot(null); }
  };

  return <>
    <div className="ap-ping-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { press.current = null; stop(); close(); }} />
    {open && <div className={`ap-wheel ${open.held ? 'is-held' : ''}`} style={{ left: open.cx, top: open.cy }}>
      <svg className="ap-wheel-ring" viewBox="-100 -100 200 200" aria-hidden>
        {PING_KINDS.map((kind, i) => <path key={kind} className={`is-${kind} ${hot === kind ? 'is-hot' : ''}`}
          transform={`rotate(${String(i * 90)})`} d="M-63.6 -63.6A90 90 0 0 1 63.6 -63.6L26.2 -26.2A37 37 0 0 0 -26.2 -26.2Z" />)}
      </svg>
      {PING_KINDS.map(kind => <button key={kind} type="button" className={`ap-call is-${kind} ${hot === kind ? 'is-hot' : ''}`}
        onPointerDown={event => { event.stopPropagation(); }}
        onClick={event => { event.stopPropagation(); send(kind, open); }}>
        <span aria-hidden>{PING_ICONS[kind]}</span>{c.pings[kind]}</button>)}
    </div>}
  </>;
}
