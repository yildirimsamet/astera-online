import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { ARENA_TUNING as T } from '@astera/rules/arena';
import { KNOB_TRAVEL, LANDING_THROTTLE, THROTTLE_DETENTS, stickHome, type ArenaAction, type ArenaControls } from './input.js';
import type { HudSnapshot, HudStore } from './store.js';
import { arenaCopy } from './copy.js';

const ICONS: Record<ArenaAction, React.ReactNode> = {
  fire: <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" /><path d="M16 3v7M16 22v7M3 16h7M22 16h7" /><circle cx="16" cy="16" r="1.4" fill="currentColor" /></svg>,
  turbo: <svg viewBox="0 0 32 32"><path d="M7 8l8 8-8 8M16 8l8 8-8 8" /></svg>,
  smoke: <svg viewBox="0 0 32 32"><path d="M9 23a5 5 0 0 1-1.2-9.8 7 7 0 0 1 13.4-2.7 5 5 0 0 1 4.6 7.7A4.5 4.5 0 0 1 22 23z" /></svg>,
  cloak: <svg viewBox="0 0 32 32"><path d="M4 16s4.5-7 12-7 12 7 12 7-4.5 7-12 7S4 16 4 16z" /><circle cx="16" cy="16" r="3.4" /><path d="M6 26 26 6" /></svg>,
};

/**
 * Two-thumb portrait layout. Left thumb: a floating stick anywhere in the lower left.
 * Right thumb: FIRE at rest, TURBO beside it (used together with steering), SMOKE and
 * CLOAK further away so they are never hit by accident, and a sticky throttle rail on
 * the right edge. A contextual LAND / TAKE OFF key sits centred under the ship.
 */
/** One key, three states. Landing is a tap; taking off needs a short hold so a stray tap never launches you. */
function LandKey({ status, onLand, onCancel, onTakeOff }: { status: HudSnapshot; onLand: () => void; onCancel: () => void; onTakeOff: () => void }) {
  const c = arenaCopy();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const release = (): void => { if (timer.current) clearTimeout(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => release, []);
  if (status.landed) {
    return <button className={`ac-land is-takeoff ${holding ? 'is-holding' : ''}`}
      onPointerDown={event => { event.preventDefault(); setHolding(true); timer.current = setTimeout(() => { release(); onTakeOff(); }, 550); }}
      onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
      <i aria-hidden />{c.takeOffHold}
    </button>;
  }
  if (status.landing === 'approach') {
    return <button className="ac-land is-cancel" onPointerDown={event => { event.preventDefault(); onCancel(); }}>
      {c.cancelLanding}<small>{String(Math.round(status.landingDistance))} m</small>
    </button>;
  }
  return <button className="ac-land" onPointerDown={event => { event.preventDefault(); onLand(); }}>{c.land}</button>;
}

export function FlightControls({ controls, store, onLand, onCancel }: { controls: ArenaControls; store: HudStore; onLand: () => void; onCancel: () => void }) {
  const c = arenaCopy();
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const status = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const throttle = useSyncExternalStore(listener => controls.subscribe(listener), () => controls.throttle, () => controls.throttle);
  useEffect(() => {
    let frame = 0;
    const paint = (): void => {
      frame = requestAnimationFrame(paint);
      const bounds = pad.current?.getBoundingClientRect();
      if (!bounds || !ring.current || !knob.current) return;
      const active = controls.stickPointer !== null;
      ring.current.toggleAttribute('data-active', active);
      if (active) {
        ring.current.style.left = `${String(controls.stickCenter.x - bounds.left)}px`;
        ring.current.style.top = `${String(controls.stickCenter.y - bounds.top)}px`;
      } else { ring.current.style.left = ''; ring.current.style.top = ''; }
      knob.current.style.transform = `translate(${String(controls.stick.x * KNOB_TRAVEL)}px, ${String(controls.stick.y * KNOB_TRAVEL)}px)`;
    };
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); };
  }, [controls]);
  const level = (event: PointerEvent<HTMLDivElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top - 10) / Math.max(1, bounds.height - 20)));
  };
  const alive = status.phase === 'flying';
  const cooldown = (action: ArenaAction): number => action === 'smoke' ? status.smokeCooldown / T.smokeCooldown
    : action === 'cloak' ? status.cloakCooldown / T.cloakCooldown : action === 'turbo' ? 1 - status.turboCharge / T.turboCharge : 0;
  const seconds = (action: ArenaAction): number => action === 'smoke' ? status.smokeCooldown : action === 'cloak' ? status.cloakCooldown : 0;
  return <div className="ac-root">
    <div ref={pad} className="ac-stick-pad" role="group" aria-label={c.throttle}
      onPointerDown={event => {
        event.preventDefault();
        // The base appears where the thumb lands, but only inside a fixed home area.
        const keys = [...(event.currentTarget.parentElement?.querySelectorAll('.ac-action, .ac-land') ?? [])].map(key => key.getBoundingClientRect());
        const home = stickHome({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), keys);
        if (controls.stickDown(event.pointerId, home.x, home.y)) {
          event.currentTarget.setPointerCapture(event.pointerId);
          controls.stickMove(event.pointerId, event.clientX, event.clientY);
        }
      }}
      onPointerMove={event => { controls.stickMove(event.pointerId, event.clientX, event.clientY); }}
      onPointerUp={event => { controls.stickUp(event.pointerId); }} onPointerCancel={event => { controls.stickUp(event.pointerId); }}
      onLostPointerCapture={event => { controls.stickUp(event.pointerId); }}>
      <div ref={ring} className="ac-stick"><i /><i /><i /><i /><div ref={knob} className="ac-knob" /></div>
    </div>
    <div className="ac-throttle" role="slider" aria-label={c.throttle} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(throttle * 100)} tabIndex={0}
      onPointerDown={event => {
        event.preventDefault();
        if (controls.throttleDown(event.pointerId, level(event), event.timeStamp)) event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => { controls.throttleMove(event.pointerId, level(event)); }}
      onPointerUp={event => { controls.throttleUp(event.pointerId); }} onPointerCancel={event => { controls.throttleUp(event.pointerId); }}
      onLostPointerCapture={event => { controls.throttleUp(event.pointerId); }}>
      <span>{c.throttle}</span>
      <div className="ac-rail" style={{ '--level': String(throttle) } as React.CSSProperties}>
        {THROTTLE_DETENTS.map(detent => <em key={detent} style={{ bottom: `${String(detent * 100)}%` }}
          data-land={detent === LANDING_THROTTLE ? '' : undefined}>{detent === LANDING_THROTTLE ? c.landStop : ''}</em>)}
        <i /><b />
      </div>
      <strong>{Math.round(throttle * 100)}</strong>
    </div>
    {alive && (status.landed || status.landing === 'approach' || status.canLand) && <LandKey status={status} onLand={onLand}
      onCancel={onCancel} onTakeOff={() => { controls.takeOff(); }} />}
    {(['fire', 'turbo', 'smoke', 'cloak'] as const).map(action => {
      const wait = seconds(action);
      const charge = cooldown(action);
      return <button key={action} className={`ac-action ac-${action} ${action === 'turbo' && status.turboActive ? 'is-active' : ''} ${action === 'fire' && status.locked ? 'is-locked' : ''}`}
        aria-label={c[action]} disabled={!alive || wait > 0}
        style={{ '--charge': String(Math.max(0, Math.min(1, charge))) } as React.CSSProperties}
        onPointerDown={event => {
          event.preventDefault();
          if (controls.actionDown(action, event.pointerId, event.timeStamp)) event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={event => { controls.actionUp(action, event.pointerId, event.timeStamp); }}
        onPointerCancel={event => { controls.actionUp(action, event.pointerId, event.timeStamp, true); }}
        onLostPointerCapture={event => { controls.actionUp(action, event.pointerId, event.timeStamp, true); }}>
        <svg className="ac-ring" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="47" /></svg>
        <span className="ac-icon" aria-hidden>{ICONS[action]}</span>
        <small>{wait > 0 ? String(Math.ceil(wait)) : c[action]}</small>
      </button>;
    })}
  </div>;
}
