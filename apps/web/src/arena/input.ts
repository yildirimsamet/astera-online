import { createInput, sampleInput, type ArenaIntent, type Tactic } from '@astera/rules/arena';

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
  const link = chordLink(fire, turbo);
  const cos = Math.cos(link.angle); const sin = Math.sin(link.angle);
  const s = (x - link.x) * cos + (y - link.y) * sin;
  const off = Math.abs((y - link.y) * cos - (x - link.x) * sin);
  const bridge = s >= link.start && s <= link.end && off <= link.half;
  const held: ('fire' | 'turbo')[] = [];
  if (bridge || on(fire)) held.push('fire');
  if (bridge || on(turbo)) held.push('turbo');
  return held;
}

/**
 * The strip that holds both keys (owner 2026-10-22: drawn, joined to both): from TURBO's
 * centre (`x`, `y`) towards FIRE's at `angle`, `start`–`end` px along, `half` px either
 * side. Both ends lie under the keys, so only the neck between them shows.
 */
export function chordLink(fire: Circle, turbo: Circle): { x: number; y: number; angle: number; start: number; end: number; half: number } {
  const length = Math.hypot(fire.x - turbo.x, fire.y - turbo.y);
  return { x: turbo.x, y: turbo.y, angle: Math.atan2(fire.y - turbo.y, fire.x - turbo.x),
    start: turbo.r * 0.75, end: length - fire.r * 0.75, half: Math.min(fire.r, turbo.r) * 0.75 };
}

/** Throttle stops the rail snaps to: stop, landing speed, cruise, full. */
export const THROTTLE_DETENTS = [0, 0.3, 0.5, 1] as const;
/** 24 m/s, the landing speed (owner 2026-10-21; was 18): 0.3 of the 80 m/s top speed. */
export const LANDING_THROTTLE = 0.3;
/** Holding Kalk lifts off at a third of the throttle (owner 2026-10-22; was at least half). */
export const TAKEOFF_THROTTLE = 0.33;
export type ArenaAction = 'fire' | 'turbo' | Tactic | 'signature';
/** An aimed signature (shield, repair): a second tap this soon casts it on oneself (Y4c, owner 2026-10-23). */
export const DOUBLE_TAP_MS = 300;
/**
 * Keys the flight page hands to the controls; the rest stay the browser's. Owner 2026-10-27: Q is
 * the ability (A) and E the tactic (B); V and the second tactic key are gone.
 */
export const GAME_KEY = /^(Key[WASDRFXQET]|Space|Shift(Left|Right)|Arrow(Up|Down|Left|Right))$/;
/** Keys that act once a press: the browser's auto-repeat must not fire them again. */
export const ONE_PRESS_KEYS: readonly string[] = ['KeyQ', 'KeyE', 'KeyL', 'KeyT', 'KeyX', 'KeyM', 'Tab'];
/** How long the target tray waits for a choice (the tray says who; owner 2026-10-27). */
export const AIM_WINDOW_MS = 6000;
/**
 * The desktop's mouse (owner 2026-10-27: "joystick yerine mouse hareketi"): this much travel in
 * one tick is full deflection, and each tick the deflection eases back by MOUSE_RECENTRE, so the
 * ship turns while the mouse moves and flies straight about a quarter second after it rests.
 */
export const MOUSE_RADIUS = 40;
export const MOUSE_RECENTRE = 0.7;
/** The pointer id the mouse's left button holds FIRE under (a finger's id is never negative). */
export const MOUSE_POINTER = -1;

/**
 * The throttle a touch at `y` asks for, read off the rail itself (inset by its 4 px end caps): its
 * foot is a full stop, a touch below it too, its head full (F12: the whole column was read, and
 * the visible foot was about 5 %).
 */
export function railLevel(y: number, rail: { top: number; height: number }): number {
  return Math.max(0, Math.min(1, 1 - (y - rail.top - 4) / Math.max(1, rail.height - 8)));
}

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
  const mouse = { x: 0, y: 0 };
  let mouseOn = false;
  const keys = new Set<string>();
  const actions = new Map<ArenaAction, number>();
  let stickPointer: number | null = null;
  let throttlePointer: number | null = null;
  let throttle = 0;
  let lastThrottle = 0.5;
  let lastTap = -Infinity;
  let turboPressedAt = 0;
  let fire = false; let turbo = false;
  let smoke = false; let cloak = false; let illusion = false; let radar = false; let turboBurst = false;
  /** The B slot this flight carries: what Q and E press. */
  let tactic: Tactic = 'smoke';
  const pressTactic = (which: Tactic): void => {
    if (which === 'smoke') smoke = true; else if (which === 'cloak') cloak = true; else if (which === 'illusion') illusion = true; else radar = true;
  };
  // The A slot: a missile goes at once; a shield or repair is aimed (`aimedAt`: when the wait began).
  // With no friend in the room there is no one to choose: it goes on the pilot at once.
  let signatureMode = { aimed: false, self: (): number => -1, friends: (): number => 0 };
  let signature = false; let signatureTarget = -1; let aimedAt = -Infinity;
  const pressSignature = (time: number): void => {
    if (!signatureMode.aimed) { signature = true; signatureTarget = -1; return; }
    if (signatureMode.friends() === 0 || (time - aimedAt <= DOUBLE_TAP_MS && time >= aimedAt)) {
      signature = true; signatureTarget = signatureMode.self(); aimedAt = -Infinity;
    } else aimedAt = time;
  };
  const listeners = new Set<() => void>();
  const changed = (): void => { for (const listener of listeners) listener(); };
  // `exact` skips the detents: Kalk's 0.33 sits next to the landing stop and must not snap onto it.
  const setThrottle = (value: number, exact = false): void => {
    const clean = Number.isFinite(value) ? value : 0;
    const next = exact ? Math.max(0, Math.min(1, clean)) : snap(clean);
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
  /** The tick's steering: a finger on the stick, else the steering keys, else the mouse while it holds the pointer. */
  const steer = (): void => {
    keyboardStick();
    if (!mouseOn) return;
    if (stickPointer === null && stick.x === 0 && stick.y === 0) { stick.x = mouse.x; stick.y = mouse.y; }
    mouse.x *= MOUSE_RECENTRE; mouse.y *= MOUSE_RECENTRE;
  };
  return {
    stick, stickCenter,
    get throttle(): number { return throttle; },
    get firing(): boolean { return fire; },
    get stickPointer(): number | null { return stickPointer; },
    /** When the current aimed signature began waiting for its friend; -Infinity when none waits. */
    get aimedAt(): number { return aimedAt; },
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setThrottle,
    takeOff(): void { setThrottle(TAKEOFF_THROTTLE, true); },
    /**
     * The flight's A slot: `aimed` for a shield or repair; `self` reads the pilot's own id (the room's,
     * once it has given one); `friends` counts the living friends it could go to instead.
     */
    setSignature(mode: { aimed: boolean; self: () => number; friends: () => number }): void { signatureMode = mode; aimedAt = -Infinity; },
    /** The tray's own chip, or the 1 key: the aimed ability goes on the pilot. */
    castOnSelf(time: number): void {
      if (time - aimedAt > AIM_WINDOW_MS || time < aimedAt) return;
      signature = true; signatureTarget = signatureMode.self(); aimedAt = -Infinity; changed();
    },
    /** The tray closed without a choice. */
    cancelAim(): void { if (Number.isFinite(aimedAt)) { aimedAt = -Infinity; changed(); } },
    get mouseSteering(): boolean { return mouseOn; },
    /** The page holds the pointer (desktop): the mouse steers until it lets go. */
    steerWithMouse(on: boolean): void { mouseOn = on; mouse.x = 0; mouse.y = 0; if (!on && stickPointer === null) keyboardStick(); },
    /** Mouse travel since the last move, in CSS px; full deflection at MOUSE_RADIUS, never past it. */
    mouseMove(dx: number, dy: number): void {
      if (!mouseOn || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      mouse.x += dx / MOUSE_RADIUS; mouse.y += dy / MOUSE_RADIUS;
      const length = Math.hypot(mouse.x, mouse.y);
      if (length > 1) { mouse.x /= length; mouse.y /= length; }
    },
    /** The flight's B slot (Y4d): the one tactic Q and E press. */
    setTactic(next: Tactic): void { tactic = next; },
    /** Waiting for the friend an aimed signature goes to. */
    aiming(time: number): boolean { return time - aimedAt <= AIM_WINDOW_MS && time >= aimedAt; },
    /** The friend tapped while aiming. */
    signatureAt(target: number, time: number): void {
      if (time - aimedAt > AIM_WINDOW_MS || time < aimedAt) return;
      signature = true; signatureTarget = target; aimedAt = -Infinity; changed();
    },
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
      if (action === 'signature') pressSignature(time);
      else if (action !== 'fire' && action !== 'turbo') pressTactic(action);
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
      if (code === 'KeyQ') { pressSignature(performance.now()); changed(); }
      if (code === 'KeyE') pressTactic(tactic);
      keyboardStick();
    },
    keyUp(code: string): void {
      keys.delete(code);
      if (code === 'Space') fire = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') turbo = false;
      keyboardStick();
    },
    /**
     * The tick's intent. The heading is the pilot's alone (owner 2026-10-21): no aim
     * friction, no steering magnet — the aim circle moves the guns, not the ship.
     */
    sample(autopilot?: { x: number; y: number }): ArenaIntent {
      if (autopilot) sampleInput(intent, autopilot.x, autopilot.y, throttle, turbo);
      else { steer(); sampleInput(intent, stick.x, stick.y, throttle, turbo); }
      intent.fire = fire; intent.smoke = smoke; intent.cloak = cloak; intent.illusion = illusion; intent.radar = radar; intent.turboBurst = turboBurst;
      intent.signature = signature; intent.signatureTarget = signatureTarget;
      smoke = false; cloak = false; illusion = false; radar = false; turboBurst = false; signature = false; signatureTarget = -1;
      return intent;
    },
    /**
     * Lets go of everything held (stick, buttons, keys): used on blur, pause, a lost link
     * and when a flight ends. The throttle is a lever, not a held button: it stays where
     * it was, so opening the menu never stops the ship.
     */
    clear(): void {
      keys.clear(); actions.clear(); stickPointer = null; throttlePointer = null;
      stick.x = 0; stick.y = 0; mouse.x = 0; mouse.y = 0; fire = false; turbo = false; smoke = false; cloak = false; illusion = false; radar = false; turboBurst = false;
      signature = false; signatureTarget = -1; aimedAt = -Infinity;
      lastTap = -Infinity; changed();
    },
    intent,
  };
}

export type ArenaControls = ReturnType<typeof createControls>;
