import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { CLASS_STATS, abilityStats, type ShipClass, type Tactic } from '@astera/rules/arena';
import { AIM_WINDOW_MS, KNOB_TRAVEL, LANDING_THROTTLE, THROTTLE_DETENTS, chordAt, chordLink, railLevel, stickHome, type ArenaAction, type ArenaControls, type Circle } from './input.js';
import type { HudSnapshot, HudStore } from './store.js';
import { arenaCopy } from './copy.js';

/** Each class's A slot (Y4c): the missile, the shield, the repair. */
export const SIGNATURE_ICONS: Record<ShipClass, React.ReactNode> = {
  akinci: <svg viewBox="0 0 32 32"><path d="M22.5 5.5 26.5 9.5 13 23l-4-4z" /><path d="M9 19l-3.5 1 2 2-1 3.5L13 23" /><path d="M22.5 5.5 27 5l-.5 4.5" /></svg>,
  muhafiz: <svg viewBox="0 0 32 32"><path d="M16 4 26 8v7c0 6.4-4.2 10.8-10 13-5.8-2.2-10-6.6-10-13V8z" /><path d="M11 16.5l3.4 3.4L21.5 12.5" /></svg>,
  kilavuz: <svg viewBox="0 0 32 32"><path d="M12.5 5h7v7.5H27v7h-7.5V27h-7v-7.5H5v-7h7.5z" /></svg>,
};

export const ACTION_ICONS: Record<'fire' | 'turbo' | Tactic, React.ReactNode> = {
  fire: <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" /><path d="M16 3v7M16 22v7M3 16h7M22 16h7" /><circle cx="16" cy="16" r="1.4" fill="currentColor" /></svg>,
  turbo: <svg viewBox="0 0 32 32"><path d="M7 8l8 8-8 8M16 8l8 8-8 8" /></svg>,
  smoke: <svg viewBox="0 0 32 32"><path d="M9 23a5 5 0 0 1-1.2-9.8 7 7 0 0 1 13.4-2.7 5 5 0 0 1 4.6 7.7A4.5 4.5 0 0 1 22 23z" /></svg>,
  cloak: <svg viewBox="0 0 32 32"><path d="M4 16s4.5-7 12-7 12 7 12 7-4.5 7-12 7S4 16 4 16z" /><circle cx="16" cy="16" r="3.4" /><path d="M6 26 26 6" /></svg>,
  // The ship and its mirror, the copy dashed.
  illusion: <svg viewBox="0 0 32 32"><path d="M11 5 17 19l-6-3-6 3z" /><path d="M21 27l-6-14 6 3 6-3z" strokeDasharray="2.4 2.2" /></svg>,
  // A sweep from the centre and the marks it found.
  radar: <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" /><path d="M16 16 24 8" /><path d="M16 5a11 11 0 0 1 11 11" strokeWidth="3" opacity=".5" /><circle cx="22" cy="20" r="1.6" fill="currentColor" /><circle cx="10" cy="11" r="1.6" fill="currentColor" /></svg>,
};

/**
 * Two-thumb portrait layout. Left thumb: a floating stick anywhere in the lower left.
 * Right thumb: FIRE at rest, TURBO beside it (used together with steering), the class's
 * signature (A) and the tactic chosen in the hangar (B) further away so they are never hit by
 * accident (plan 14 §4), and a sticky throttle rail on the right edge. A contextual LAND /
 * TAKE OFF key sits centred under the ship.
 */
/** One key, three states. Landing is a tap; taking off needs a short hold so a stray tap never launches you. */
/** Owner 2026-10-21: 70 % shorter than the first 550 ms. */
export const TAKEOFF_HOLD_MS = 165;

export function LandKey({ status, onLand, onCancel, onTakeOff }: { status: HudSnapshot; onLand: () => void; onCancel: () => void; onTakeOff: () => void }) {
  const c = arenaCopy();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const release = (): void => { if (timer.current) clearTimeout(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => release, []);
  if (status.landed) {
    return <button className={`ac-land is-takeoff ${holding ? 'is-holding' : ''}`} style={{ '--hold': `${String(TAKEOFF_HOLD_MS)}ms` } as React.CSSProperties}
      onPointerDown={event => { event.preventDefault(); setHolding(true); timer.current = setTimeout(() => { release(); onTakeOff(); }, TAKEOFF_HOLD_MS); }}
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

const circleOf = (element: HTMLElement): Circle => {
  const r = element.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
};

const keyCircles = (keys: ReadonlyMap<ArenaAction, HTMLElement>): { fire: Circle; turbo: Circle } | null => {
  const fire = keys.get('fire'); const turbo = keys.get('turbo');
  return fire && turbo ? { fire: circleOf(fire), turbo: circleOf(turbo) } : null;
};

export function FlightControls({ controls, store, onLand, onCancel }: { controls: ArenaControls; store: HudStore; onLand: () => void; onCancel: () => void }) {
  const c = arenaCopy();
  const keys = useRef(new Map<ArenaAction, HTMLButtonElement>());
  // FIRE and TURBO share one touch zone so one thumb across both holds both (chordAt).
  const chords = useRef(new Map<number, Set<ArenaAction>>());
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<ReadonlySet<ArenaAction>>(new Set());
  // The strip that holds both, drawn where chordAt finds it: measured from the keys as laid out.
  const zone = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState<React.CSSProperties>({});
  // Layout is read on mount, resize and touch-down only: a read per frame or per finger move
  // after the HUD's style writes forced a layout every time (S22 profile 2026-10-23).
  const circles = useRef<{ fire: Circle; turbo: Circle } | null>(null);
  const padOrigin = useRef({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const measure = (): void => {
      const bounds = pad.current?.getBoundingClientRect();
      if (bounds) padOrigin.current = { left: bounds.left, top: bounds.top };
      const measured = circles.current = keyCircles(keys.current);
      if (!measured || !zone.current) return;
      const box = zone.current.getBoundingClientRect();
      const { fire: f, turbo: t } = measured;
      const l = chordLink(f, t);
      // The "+" sits in the middle of the neck, the part between the keys.
      const neck = ((t.r + Math.hypot(f.x - t.x, f.y - t.y) - f.r) / 2 - l.start) / Math.max(1, l.end - l.start);
      setLink({ left: l.x - box.left, top: l.y - box.top - l.half, width: l.end - l.start, height: 2 * l.half,
        transform: `rotate(${String(l.angle)}rad) translateX(${String(l.start)}px)`, '--neck': `${String(neck * 100)}%` } as React.CSSProperties);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); };
  }, []);
  const chord = (event: PointerEvent<HTMLDivElement>, phase: 'move' | 'up' | 'cancel'): void => {
    const fire = keys.current.get('fire'); const turbo = keys.current.get('turbo');
    const id = event.pointerId; const had = chords.current.get(id); const at = circles.current;
    if (!fire || !turbo || (phase === 'move' && !had)) return;
    const contact = event.pointerType === 'touch' ? Math.max(event.width, event.height) / 2 : 0;
    // A disabled key drops out alone: an empty magazine must not take TURBO with it.
    const next = phase === 'move' && at
      ? chordAt(event.clientX, event.clientY, contact, at.fire, at.turbo).filter(action => !(action === 'fire' ? fire : turbo).disabled) : [];
    const mine = had ?? new Set<ArenaAction>();
    // A thumb rolling off a key is not a tap: only a lift may count as a turbo tap-burst.
    for (const action of [...mine]) if (!next.includes(action as 'fire' | 'turbo')) {
      controls.actionUp(action, id, event.timeStamp, phase !== 'up'); mine.delete(action);
    }
    for (const action of next) if (!mine.has(action) && controls.actionDown(action, id, event.timeStamp)) mine.add(action);
    if (phase === 'move') chords.current.set(id, mine); else chords.current.delete(id);
    setHeld(new Set([...chords.current.values()].flatMap(set => [...set])));
  };
  const status = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const throttle = useSyncExternalStore(listener => controls.subscribe(listener), () => controls.throttle, () => controls.throttle);
  // An aimed signature waits for its friend: the key and a hint say so until the wait runs out.
  const aimSince = useSyncExternalStore(listener => controls.subscribe(listener), () => controls.aimedAt, () => controls.aimedAt);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!Number.isFinite(aimSince)) return;
    setNow(performance.now());
    const end = setTimeout(() => { setNow(performance.now()); }, Math.max(0, aimSince + AIM_WINDOW_MS - performance.now()) + 20);
    return () => { clearTimeout(end); };
  }, [aimSince]);
  const aiming = Number.isFinite(aimSince) && controls.aiming(Math.max(now, aimSince));
  useEffect(() => {
    let frame = 0;
    const paint = (): void => {
      frame = requestAnimationFrame(paint);
      if (!ring.current || !knob.current) return;
      const bounds = padOrigin.current;
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
  const level = (event: PointerEvent<HTMLDivElement>): number =>
    railLevel(event.clientY, (event.currentTarget.querySelector('.ac-rail') ?? event.currentTarget).getBoundingClientRect());
  const alive = status.phase === 'flying';
  // A missile waits for its lock; a shield or repair is aimed with taps (input.ts).
  const missile = status.ship === 'akinci';
  // FIRE's ring is the magazine (owner 2026-10-21: ammunition is its own, read where it is spent);
  // the missile's ring fills as its lock builds.
  const skill = (action: 'signature' | 'turbo' | Tactic) => abilityStats(status.ship, action, action === 'signature' ? status.ranks.signature : action === 'turbo' ? status.ranks.turbo : status.ranks.tactic);
  const cooldown = (action: ArenaAction): number => action === 'smoke' ? status.smokeCooldown / skill(action).cooldown
    : action === 'cloak' ? status.cloakCooldown / skill(action).cooldown : action === 'turbo' ? 1 - status.turboCharge / skill(action).duration
      : action === 'illusion' || action === 'radar' ? status.tacticCooldown / skill(action).cooldown
      : action === 'signature' ? status.signatureCooldown > 0 ? status.signatureCooldown / skill(action).cooldown : missile ? 1 - status.lockProgress : 0
        : 1 - status.ammo / CLASS_STATS[status.ship].ammoCapacity;
  const label = (action: ArenaAction, wait: number): string => wait > 0 ? String(Math.ceil(wait))
    : action === 'signature' ? aiming ? c.aimKey : missile && !status.lockReady ? status.lockProgress > 0 ? c.lockBuilding : c.noLock
      : c.signatures[status.ship].name
      : action !== 'fire' ? c[action] : status.ammo < 1 ? c.empty : `${c.fire} · ${String(status.ammo)}`;
  const seconds = (action: ArenaAction): number => action === 'smoke' ? status.smokeCooldown : action === 'cloak' ? status.cloakCooldown
    : action === 'illusion' || action === 'radar' ? status.tacticCooldown : action === 'signature' ? status.signatureCooldown : 0;
  return <div className="ac-root">
    <div ref={pad} className="ac-stick-pad" role="group" aria-label={c.throttle}
      onPointerDown={event => {
        event.preventDefault();
        // The base appears where the thumb lands, but only inside a fixed home area.
        const keys = [...(event.currentTarget.parentElement?.querySelectorAll('.ac-action, .ac-land') ?? [])].map(key => key.getBoundingClientRect());
        const bounds = event.currentTarget.getBoundingClientRect();
        padOrigin.current = { left: bounds.left, top: bounds.top };
        const home = stickHome({ x: event.clientX, y: event.clientY }, bounds, keys);
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
    <div ref={zone} className="ac-chord" aria-hidden
      onPointerDown={event => {
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
        circles.current = keyCircles(keys.current); chords.current.set(event.pointerId, new Set()); chord(event, 'move');
      }}
      onPointerMove={event => { chord(event, 'move'); }}
      onPointerUp={event => { chord(event, 'up'); }} onPointerCancel={event => { chord(event, 'cancel'); }}
      onLostPointerCapture={event => { chord(event, 'cancel'); }}>
      <i className={`ac-link ${held.has('fire') && held.has('turbo') ? 'is-linked' : ''} ${!alive || status.ammo < 1 ? 'is-off' : ''}`} style={link} />
    </div>
    {aiming && <p className="ac-aim-hint">{c.aimHint}</p>}
    {(['fire', 'turbo', 'signature', status.tactic] as const).map(action => {
      const wait = seconds(action);
      const charge = cooldown(action);
      const chorded = action === 'fire' || action === 'turbo';
      const ready = action === 'signature' && wait === 0 && (!missile || status.lockReady);
      return <button key={action} ref={element => { if (element) keys.current.set(action, element); else keys.current.delete(action); }}
        className={`ac-action ac-${action} ${action === 'turbo' && status.turboActive ? 'is-active' : ''} ${action === 'fire' && status.locked ? 'is-locked' : ''} ${chorded ? 'is-chorded' : ''} ${held.has(action) ? 'is-pressed' : ''} ${ready ? 'is-ready' : ''} ${action === 'signature' && aiming ? 'is-aiming' : ''}`}
        aria-label={action === 'fire' ? `${c.fire} · ${String(status.ammo)} ${c.rounds}` : action === 'signature' ? c.signatures[status.ship].name : c[action]}
        disabled={!alive || wait > 0 || (action === 'fire' && status.ammo < 1) || (action === 'signature' && missile && !status.lockReady)}
        data-ship={action === 'signature' ? status.ship : undefined}
        style={{ '--charge': String(Math.max(0, Math.min(1, charge))) } as React.CSSProperties}
        {...(chorded ? {} : {
          onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            if (controls.actionDown(action, event.pointerId, event.timeStamp)) event.currentTarget.setPointerCapture(event.pointerId);
          },
          onPointerUp: (event: PointerEvent<HTMLButtonElement>) => { controls.actionUp(action, event.pointerId, event.timeStamp); },
          onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => { controls.actionUp(action, event.pointerId, event.timeStamp, true); },
          onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => { controls.actionUp(action, event.pointerId, event.timeStamp, true); },
        })}>
        <svg className="ac-ring" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="47" /></svg>
        <span className="ac-icon" aria-hidden>{action === 'signature' ? SIGNATURE_ICONS[status.ship] : ACTION_ICONS[action]}</span>
        <small>{label(action, wait)}</small>
      </button>;
    })}
  </div>;
}
