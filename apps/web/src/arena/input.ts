import { createInput, sampleAssist, sampleInput, type ArenaIntent } from '@astera/rules/arena';

/** Thumb travel to full deflection: longer travel means finer aim for the same turn. */
export const STICK_RADIUS = 72;
/** The drawn base ring's radius, and how far the knob moves inside it (knob radius 23). */
export const STICK_RING = 76;
export const KNOB_TRAVEL = 52;

export interface Rect { left: number; top: number; right: number; bottom: number }

/**
 * Where the stick base opens: under the thumb, kept inside a home area in the lower
 * left and never over a key (owner 2026-10-21: a fast pull pushed it onto TURBO/SMOKE).
 * A ring that would touch a key moves the shorter way out — left of it, or below it.
 */
export function stickHome(touch: { x: number; y: number }, pad: Rect, keys: readonly Rect[]): { x: number; y: number } {
  const minX = pad.left + STICK_RING + 14; const maxX = pad.left + 196;
  const minY = pad.bottom - 250; const maxY = pad.bottom - STICK_RING - 24;
  let x = Math.max(minX, Math.min(maxX, touch.x)); let y = Math.max(minY, Math.min(maxY, touch.y));
  const reach = STICK_RING + 6;
  // Leaving one key can touch another; a few passes settle it.
  for (let pass = 0; pass < 4; pass++) {
    for (const key of keys) {
      const dx = Math.max(key.left - x, 0, x - key.right); const dy = Math.max(key.top - y, 0, y - key.bottom);
      if (dx * dx + dy * dy >= reach * reach) continue;
      const left = key.left - reach; const below = key.bottom + reach;
      const canLeft = left >= minX; const canBelow = below <= maxY;
      if (canLeft && (!canBelow || x - left <= below - y)) x = left;
      else if (canBelow) y = below;
      else { x = minX; y = maxY; }
    }
  }
  return { x, y };
}

export interface Circle { x: number; y: number; r: number }

/**
 * What one thumb on FIRE / TURBO holds (owner 2026-10-21: turbo with the tip, fire with
 * the middle of the same thumb). A phone reports a thumb as ONE point, the middle of its
 * contact, so a thumb across both keys lands between them: that strip holds both. A
 * key's own face holds only that key; `contact` (the reported contact radius) lets a
 * flat thumb that covers both keys hold both.
 */
export function chordAt(x: number, y: number, contact: number, fire: Circle, turbo: Circle): ('fire' | 'turbo')[] {
  const on = (c: Circle): boolean => Math.hypot(x - c.x, y - c.y) <= c.r + contact;
  const dx = turbo.x - fire.x; const dy = turbo.y - fire.y; const length = Math.hypot(dx, dy) || 1;
  const s = ((x - fire.x) * dx + (y - fire.y) * dy) / length;
  const off = Math.abs((x - fire.x) * dy - (y - fire.y) * dx) / length;
  const bridge = s >= fire.r * 0.75 && s <= length - turbo.r * 0.75 && off <= Math.min(fire.r, turbo.r) * 0.75;
  const held: ('fire' | 'turbo')[] = [];
  if (bridge || on(fire)) held.push('fire');
  if (bridge || on(turbo)) held.push('turbo');
  return held;
}

/** Throttle stops the rail snaps to: stop, landing speed, cruise, full. */
export const THROTTLE_DETENTS = [0, 0.2, 0.5, 1] as const;
/** 24 m/s, the landing speed (owner 2026-10-21; was 18). */
export const LANDING_THROTTLE = 0.2;
export type ArenaAction = 'fire' | 'turbo' | 'smoke' | 'cloak';

const snap = (value: number): number => {
  for (const detent of THROTTLE_DETENTS) if (Math.abs(value - detent) < 0.045) return detent;
  return Math.max(0, Math.min(1, value));
};

/**
 * Raw pilot controls, outside React. Each simulation tick turns them into one
 * quantised intent (`sample`), where aim assist joins the stick. A cancelled finger
 * can never release another one: every control owns its pointer id.
 */
export function createControls() {
  const intent: ArenaIntent = createInput();
  const stick = { x: 0, y: 0 };
  const stickCenter = { x: 0, y: 0 };
  const keys = new Set<string>();
  const actions = new Map<ArenaAction, number>();
  let stickPointer: number | null = null;
  let throttlePointer: number | null = null;
  let throttle = 0;
  let lastThrottle = 0.5;
  let lastTap = -Infinity;
  let turboPressedAt = 0;
  let fire = false; let turbo = false;
  let smoke = false; let cloak = false; let turboBurst = false;
  const listeners = new Set<() => void>();
  const changed = (): void => { for (const listener of listeners) listener(); };
  const setThrottle = (value: number): void => {
    const next = snap(Number.isFinite(value) ? value : 0);
    if (next === throttle) return;
    throttle = next;
    if (throttle > 0) lastThrottle = throttle;
    changed();
  };
  const keyboardStick = (): void => {
    if (stickPointer !== null) return;
    stick.x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    stick.y = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  };
  return {
    stick, stickCenter,
    get throttle(): number { return throttle; },
    get firing(): boolean { return fire; },
    get stickPointer(): number | null { return stickPointer; },
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setThrottle,
    takeOff(): void { setThrottle(Math.max(0.5, lastThrottle)); },
    stop(): void { setThrottle(0); },
    stickDown(pointer: number, x: number, y: number): boolean {
      if (stickPointer !== null) return false;
      stickPointer = pointer; stickCenter.x = x; stickCenter.y = y; stick.x = 0; stick.y = 0;
      return true;
    },
    stickMove(pointer: number, x: number, y: number): void {
      if (pointer !== stickPointer) return;
      // The base stays where it was placed; past the rim the knob simply saturates.
      const dx = x - stickCenter.x; const dy = y - stickCenter.y;
      const gain = 1 / Math.max(STICK_RADIUS, Math.sqrt(dx * dx + dy * dy));
      stick.x = dx * gain; stick.y = dy * gain;
    },
    stickUp(pointer: number): void {
      if (pointer !== stickPointer) return;
      stickPointer = null; stick.x = 0; stick.y = 0; keyboardStick();
    },
    throttleDown(pointer: number, level: number, time: number): boolean {
      if (throttlePointer !== null) return false;
      throttlePointer = pointer;
      if (time - lastTap <= 300 && time >= lastTap) { setThrottle(throttle > 0 ? 0 : lastThrottle); lastTap = -Infinity; }
      else { setThrottle(level); lastTap = time; }
      return true;
    },
    throttleMove(pointer: number, level: number): void { if (pointer === throttlePointer) setThrottle(level); },
    throttleUp(pointer: number): void { if (pointer === throttlePointer) throttlePointer = null; },
    actionDown(action: ArenaAction, pointer: number, time: number): boolean {
      if (actions.has(action)) return false;
      actions.set(action, pointer);
      if (action === 'fire') fire = true;
      if (action === 'turbo') { turbo = true; turboPressedAt = time; }
      if (action === 'smoke') smoke = true;
      if (action === 'cloak') cloak = true;
      changed();
      return true;
    },
    actionUp(action: ArenaAction, pointer: number, time: number, cancelled = false): void {
      if (actions.get(action) !== pointer) return;
      actions.delete(action);
      if (action === 'fire') fire = false;
      if (action === 'turbo') { turbo = false; if (!cancelled && time - turboPressedAt < 150) turboBurst = true; }
      changed();
    },
    pressed(action: ArenaAction): boolean { return actions.has(action); },
    keyDown(code: string): void {
      keys.add(code);
      if (code === 'KeyX') setThrottle(0);
      if (code === 'KeyR') setThrottle(throttle + 0.1);
      if (code === 'KeyF') setThrottle(throttle - 0.1);
      if (code === 'KeyT') setThrottle(Math.max(0.5, lastThrottle));
      if (code === 'Space') fire = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') turbo = true;
      if (code === 'KeyQ') smoke = true;
      if (code === 'KeyE') cloak = true;
      keyboardStick();
    },
    keyUp(code: string): void {
      keys.delete(code);
      if (code === 'Space') fire = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') turbo = false;
      keyboardStick();
    },
    /**
     * The tick's intent. `friction` < 1 slows the stick while the reticle rests on a
     * target (console-style aim friction); the assist channel is the steering magnet.
     */
    sample(friction = 1, assistX = 0, assistY = 0, autopilot?: { x: number; y: number }): ArenaIntent {
      if (autopilot) sampleInput(intent, autopilot.x, autopilot.y, throttle, turbo);
      else sampleInput(intent, stick.x * friction, stick.y * friction, throttle, turbo);
      sampleAssist(intent, assistX, assistY);
      intent.fire = fire; intent.smoke = smoke; intent.cloak = cloak; intent.turboBurst = turboBurst;
      smoke = false; cloak = false; turboBurst = false;
      return intent;
    },
    /**
     * Lets go of everything held (stick, buttons, keys): used on blur, pause, a lost link
     * and when a flight ends. The throttle is a lever, not a held button: it stays where
     * it was, so opening the menu never stops the ship.
     */
    clear(): void {
      keys.clear(); actions.clear(); stickPointer = null; throttlePointer = null;
      stick.x = 0; stick.y = 0; fire = false; turbo = false; smoke = false; cloak = false; turboBurst = false;
      lastTap = -Infinity; changed();
    },
    intent,
  };
}

export type ArenaControls = ReturnType<typeof createControls>;
