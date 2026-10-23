import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, copyFlight, createFlightState, createInput, createPilot, createSandboxWorld, leadPoint, predictPilot,
  stepArenaWorld, type ArenaIntent, type FlightState, type Pilot, type Vec3,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/**
 * Owner 2026-10-21: "aim assist doesn't work, and not at all with turbo + fire". A networked
 * pilot sees other ships `interpDelay + RTT + inputBuffer` (~0.3 s) in the past, while the
 * server flies his shots against where they are now. These duels play that delay out: the
 * shooter steers from a view `lag` ticks old, the server world decides every hit. The heading
 * is the pilot's alone (no magnet); inside the aim circle the guns follow the lead.
 * Measured before this change (magnet on a lead drawn from the delayed view): 0–5 % hits.
 */
/** `weave`: the target jinks full stick left and right every 0.45 s. */
interface Duel { lag: number; weave: boolean; turbo: boolean; distance: number; seconds: number }

const TAN_CIRCLE = Math.sqrt(1 - T.aimCircleCos * T.aimCircleCos) / T.aimCircleCos;
const velocityOf = (out: Vec3, state: FlightState): void => {
  const q = state.q;
  out.x = 2 * (q.x * q.z + q.w * q.y) * state.s; out.y = 2 * (q.y * q.z - q.w * q.x) * state.s;
  out.z = (1 - 2 * (q.x * q.x + q.y * q.y)) * state.s;
};

function arena(): ReturnType<typeof createSandboxWorld> {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith([], 8000, 8000), seed: 7 });
  world.pilot.phase = 'extracted';
  return world;
}
function join(world: ReturnType<typeof createSandboxWorld>, pilot: Pilot): void {
  world.drones.push(pilot);
  const prior = createFlightState(); copyFlight(prior, pilot); world.dronePrevious.push(prior);
}
/** Ahead and `side` × distance to the right, crossing to the left (local +X) at full speed. */
function crossingTarget(distance: number, side = 0.35): Pilot {
  const target = createPilot(2);
  target.p.x = -distance * side; target.p.z = distance;
  target.q.y = Math.SQRT1_2; target.q.w = Math.SQRT1_2; target.s = T.speedMax; target.throttle = 1;
  return target;
}

/** Hit fraction of a pilot who keeps the target's lead mark (◇) inside the circle and holds the trigger. */
function duel(o: Duel): number {
  const world = arena();
  const shooter = createPilot(1); const target = crossingTarget(o.distance);
  shooter.s = o.turbo ? T.speedMax * T.turboSpeedMul : 60; shooter.throttle = 0.5;
  join(world, shooter); join(world, target);
  const own: ArenaIntent = { ...createInput(), throttle: 0.5, fire: true, turbo: o.turbo };
  const theirs: ArenaIntent = { ...createInput(), throttle: 1 };
  const inputs = new Map([[shooter.id, own], [target.id, theirs]]);
  const history: FlightState[] = [];
  const seenVelocity = { x: 0, y: 0, z: 0 }; const ahead = { x: 0, y: 0, z: 0 }; const mark = { x: 0, y: 0, z: 0 };
  for (let tick = 0; tick < o.seconds * T.tickRate; tick++) {
    const now = createFlightState(); copyFlight(now, target); history.push(now);
    const seen = history[Math.max(0, history.length - 1 - o.lag)] ?? now;
    velocityOf(seenVelocity, seen);
    // The HUD draws the ◇ from the delayed hull moved forward by the aim horizon.
    const horizon = o.lag / T.tickRate;
    ahead.x = seen.p.x + seenVelocity.x * horizon; ahead.y = seen.p.y + seenVelocity.y * horizon;
    ahead.z = seen.p.z + seenVelocity.z * horizon;
    if (!leadPoint(mark, shooter, ahead, seenVelocity)) { mark.x = ahead.x - shooter.p.x; mark.y = ahead.y - shooter.p.y; mark.z = ahead.z - shooter.p.z; }
    const q = shooter.q;
    const fz = mark.x * 2 * (q.x * q.z + q.w * q.y) + mark.y * 2 * (q.y * q.z - q.w * q.x) + mark.z * (1 - 2 * (q.x * q.x + q.y * q.y));
    const right = -(mark.x * (1 - 2 * (q.y * q.y + q.z * q.z)) + mark.y * 2 * (q.x * q.y + q.w * q.z) + mark.z * 2 * (q.x * q.z - q.w * q.y)) / fz;
    const up = (mark.x * 2 * (q.x * q.y - q.w * q.z) + mark.y * (1 - 2 * (q.x * q.x + q.z * q.z)) + mark.z * 2 * (q.y * q.z + q.w * q.x)) / fz;
    // The pilot steers only while the ◇ drifts past half the circle; inside it the guns follow.
    const off = fz <= 0 || Math.sqrt(right * right + up * up) > TAN_CIRCLE * 0.5;
    own.steerX = off ? Math.max(-1, Math.min(1, right * 15)) : 0;
    own.steerY = off ? Math.max(-1, Math.min(1, -up * 15)) : 0;
    theirs.steerX = o.weave ? (Math.floor(tick / (T.tickRate * 0.45)) % 2 === 0 ? 1 : -1) : 0;
    stepArenaWorld(world, inputs);
  }
  expect(own.assistX).toBe(0); expect(own.assistY).toBe(0);
  return shooter.hits / Math.max(1, shooter.shots);
}

const crossing: Duel = { lag: 9, weave: false, turbo: false, distance: 300, seconds: 2.5 };

describe('aim circle against a ship seen through network delay', () => {
  it('lands most shots on a straight crossing target whose mark is kept inside the circle', () => {
    expect(duel(crossing)).toBeGreaterThanOrEqual(0.6);
  });

  it('keeps working while the shooter is on turbo', () => {
    // The shooter closes 300 m from 520 (1.4 s at the old 216 m/s turbo): long-range shots miss
    // more, so the window follows the turbo speed, not the clock (KG-X25).
    expect(duel({ ...crossing, turbo: true, distance: 520, seconds: 300 / (T.speedMax * T.turboSpeedMul) })).toBeGreaterThanOrEqual(0.4);
  });

  it('still rewards a target that jinks: dodging costs the shooter hits', () => {
    const straight = duel(crossing);
    const weaving = duel({ ...crossing, weave: true });
    // Shots twice as fast (owner 2026-10-21) are in the air half as long, so a jink at 300 m
    // costs less than it did: 85 % → 65 % (75 % → 40 % at 600 m/s). At 80 m/s (KG-X25, owner
    // 2026-10-23: easier to hit, kept knowing this) a jink moves the hull less: 85 % → 80 %.
    expect(weaving).toBeLessThan(straight);
    expect(weaving).toBeGreaterThan(0.1);
  });

  it('works the same without network delay, as the sandbox sees it', () => {
    expect(duel({ ...crossing, lag: 0 })).toBeGreaterThanOrEqual(0.6);
  });
});

describe('predicted tracers', () => {
  it('leave the guns towards the point the server shot flies to', () => {
    const lag = 9;
    // Server: the target where it is now.
    const server = arena();
    const shooter = createPilot(1); shooter.s = 60; shooter.throttle = 0.5;
    // Hull ~6° right of the nose; its lead lies inside the circle on the other side.
    const target = crossingTarget(300, 0.1);
    join(server, shooter); join(server, target);
    // Client: the same shooter as its own predicted pilot, the target drawn `lag` ticks back.
    const client = arena();
    const seenTarget = crossingTarget(300, 0.1); seenTarget.p.x -= T.speedMax * lag / T.tickRate;
    copyFlight(client.pilot, shooter); client.pilot.id = shooter.id; client.pilot.phase = 'flying'; client.pilot.shield = 0;
    join(client, seenTarget);
    client.aimHorizon = lag / T.tickRate;
    const fire: ArenaIntent = { ...createInput(), throttle: 0.5, fire: true };
    stepArenaWorld(server, new Map([[shooter.id, fire], [target.id, { ...createInput(), throttle: 1 }]]));
    predictPilot(client, { ...fire });
    const real = server.projectiles.find(b => b.life > 0); const ghost = client.ghosts.find(b => b.life > 0);
    expect(real && ghost).toBeTruthy();
    if (!real || !ghost) return;
    const r = Math.sqrt(real.v.x * real.v.x + real.v.y * real.v.y + real.v.z * real.v.z);
    const g = Math.sqrt(ghost.v.x * ghost.v.x + ghost.v.y * ghost.v.y + ghost.v.z * ghost.v.z);
    const angle = Math.acos(Math.min(1, (real.v.x * ghost.v.x + real.v.y * ghost.v.y + real.v.z * ghost.v.z) / (r * g)));
    expect(angle).toBeLessThan(0.002);
  });
});
