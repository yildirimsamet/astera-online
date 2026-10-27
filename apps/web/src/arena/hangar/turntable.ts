/**
 * The hangar's ship on its turntable: a sideways drag turns it, all the way round, and a flick
 * keeps it turning until it slows; left alone it turns slowly by itself. A drag moves only the
 * ship, on every device (owner 2026-10-23): the camera holds its angle and only comes closer
 * within what the apron allows, so the hangar never moves under the hand.
 */
export const TURN = Object.freeze({
  /** Radians of turn per pixel dragged. */
  perPixel: 0.011,
  /** The fastest a flick spins the ship, radians a second. */
  maxSpin: 6,
  /** How quickly a flick dies away, per second. */
  friction: 2.4,
  autoSpin: 0.22,
  /** Seconds after a hand lets go before the ship turns by itself again. */
  rest: 4,
  polar: 1.16,
  distance: 0.66, near: 0.42, far: 0.86,
  /** The air under the ship's lowest point, and how far it breathes up and down, against its length. */
  clearance: 0.07, breath: 0.012,
});

export interface Turntable { yaw: number; spin: number; distance: number; held: boolean; idle: number }

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Left alone from the first frame: the ship is already turning when the hangar opens. */
export const createTurntable = (): Turntable => ({ yaw: 0, spin: 0, distance: TURN.distance, held: false, idle: TURN.rest });

export function dragTurntable(t: Turntable, dx: number, dt: number): void {
  if (!Number.isFinite(dx)) return;
  t.held = true; t.idle = 0;
  t.yaw += dx * TURN.perPixel;
  if (dt > 0) t.spin = clamp(t.spin * 0.5 + (dx * TURN.perPixel / dt) * 0.5, -TURN.maxSpin, TURN.maxSpin);
}

export function releaseTurntable(t: Turntable): void { t.held = false; }

/** `factor` above one moves the camera away. */
export function zoomTurntable(t: Turntable, factor: number): void {
  if (!Number.isFinite(factor) || factor <= 0) return;
  t.distance = clamp(t.distance * factor, TURN.near, TURN.far);
}

export function stepTurntable(t: Turntable, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0 || t.held) return;
  t.idle += dt;
  const target = t.idle > TURN.rest ? TURN.autoSpin : 0;
  t.spin = target + (t.spin - target) * Math.exp(-TURN.friction * dt);
  t.yaw += t.spin * dt;
}

/**
 * Where a ship's origin stands so its lowest point floats over the deck. The class models are
 * centred on their origin, so half of each hull is below it; `minY` is that lowest point in the
 * model's own unit space.
 */
export const restHeight = (floor: number, minY: number, length: number): number => floor + (Math.max(0, -minY) + TURN.clearance) * length;
