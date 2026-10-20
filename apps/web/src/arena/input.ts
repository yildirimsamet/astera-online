import { createInput, sampleAssist, sampleInput, type ArenaIntent } from '@astera/rules/arena';

/** Thumb travel to full deflection: longer travel means finer aim for the same turn. */
export const STICK_RADIUS = 72;
/** Throttle stops the rail snaps to: stop, landing speed, cruise, full. */
export const THROTTLE_DETENTS = [0, 0.15, 0.5, 1] as const;
export const LANDING_THROTTLE = 0.15;
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
