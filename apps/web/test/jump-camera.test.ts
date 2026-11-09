import { JUMP_FLIGHT, jumpTravel } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { initialHomeCameraPosition } from '../src/galaxy/follow.js';
import { JUMP_FOV, jumpCamera, jumpStop, type JumpPath } from '../src/galaxy/jumpCamera.js';

/**
 * WHERE THE CAMERA STANDS ON THE WAY (owner, 2026-11-09): beside the ship while the drive lights, on its
 * tail across the gap, behind it as it stops at its world, and at last where the main game opens on that
 * world, so the hand-over is not seen.
 */
type V = readonly [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(...a);
const unit = (a: V): V => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: V, b: V, k: number): V => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// A berth out in the first galaxy and a world inside the main one, in world units.
const path: JumpPath = { from: [150, 40, -140], planet: [30, 6, -40], radius: 1.1, ship: 1.3 };
const stop = jumpStop(path);
const forward = unit(sub(stop, path.from));
const shipAt = (s: number) => lerp(path.from, stop, jumpTravel(s));
/** Angle off the view axis, split into the screen's up and across, for a phone held upright. */
const seen = (s: number, point: V, aspect = 350 / 812) => {
  const pose = jumpCamera(path, s);
  const view = unit(sub(pose.target, pose.position));
  const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // The screen's own up is the pose's: on a steep way the frame rolls with the ship.
  const across = unit(cross(view, pose.up));
  const up = cross(across, view);
  const to = sub(point, pose.position);
  const depth = dot(to, view);
  const half = (pose.fov / 2) * (Math.PI / 180);
  return {
    ahead: depth > 0,
    inFrame: depth > 0 && Math.abs(dot(to, up) / depth) < Math.tan(half) && Math.abs(dot(to, across) / depth) < Math.tan(half) * aspect,
    distance: len(to),
  };
};

describe('the camera of the jump', () => {
  it('watches the drive light from beside and behind the ship, close', () => {
    for (const s of [0.5, 2, 3.8]) {
      const pose = jumpCamera(path, s);
      expect(seen(s, path.from).inFrame).toBe(true);
      expect(seen(s, path.from).distance).toBeLessThan(path.ship * 4);
      // Behind the nozzles' plane, so the flames are in the picture and not hidden by the hull.
      expect(dot(sub(pose.position, path.from), forward)).toBeLessThan(0);
    }
  });

  it('rides on the tail across the gap, the ship in frame and the way ahead', () => {
    for (const s of [8, 11, 13.5]) {
      const pose = jumpCamera(path, s);
      const ship = shipAt(s);
      expect(dot(sub(ship, pose.position), forward)).toBeGreaterThan(0);
      expect(seen(s, ship).inFrame).toBe(true);
      expect(seen(s, ship).distance).toBeLessThan(path.ship * 9);
    }
  });

  it('keeps behind the ship while it brakes, so the hull never passes the lens', () => {
    for (let s = JUMP_FLIGHT.arrive - 5; s <= JUMP_FLIGHT.arrive; s += 0.1) {
      const pose = jumpCamera(path, s);
      expect(dot(sub(shipAt(s), pose.position), forward)).toBeGreaterThan(path.ship * 2);
    }
  });

  // Owner 2026-11-09: no cut to a film. The camera leaves from where the player was looking.
  it('opens on the game camera and blends onto the ship without a jump', () => {
    // The game's view of its ship: a few lengths off, looking at it.
    const opening = { position: [path.from[0] + 6, path.from[1] + 8, path.from[2] - 10] as const, target: path.from };
    const first = jumpCamera(path, 0, opening);
    expect(first.position).toEqual(opening.position);
    expect(first.target).toEqual(opening.target);
    expect(jumpCamera(path, 3, opening)).toEqual(jumpCamera(path, 3));
    let last = first.position;
    for (let s = 0.02; s <= 3; s += 0.02) {
      const now = jumpCamera(path, s, opening).position;
      expect(Math.hypot(now[0] - last[0], now[1] - last[1], now[2] - last[2])).toBeLessThan(0.5);
      last = now;
    }
  });

  it('sees the ship stop at its world with the world behind it', () => {
    const s = JUMP_FLIGHT.arrive + 0.3;
    expect(seen(s, stop).inFrame).toBe(true);
    expect(seen(s, path.planet).inFrame).toBe(true);
    expect(seen(s, stop).distance).toBeLessThan(seen(s, path.planet).distance);
  });

  it('stops the ship at the foot of its world, not inside it and not far off', () => {
    const gap = len(sub(stop, path.planet));
    expect(gap).toBeGreaterThan(path.radius + path.ship * 0.5);
    expect(gap).toBeLessThan(path.radius * 2.5 + path.ship);
  });

  it('stands the ship up the screen on a steep way, and comes back level for the main game', () => {
    const steep: JumpPath = { from: [150, 140, -140], planet: [30, 6, -40], radius: 1.1, ship: 1.3 };
    const ahead = unit(sub(jumpStop(steep), steep.from));
    for (const s of [2, 10]) expect(Math.abs(dot(jumpCamera(steep, s).up, ahead))).toBeLessThan(0.75);
    expect(jumpCamera(steep, 24).up).toEqual([0, 1, 0]);
  });

  it('ends where the main game opens on the world', () => {
    const pose = jumpCamera(path, 24);
    expect(pose.target).toEqual(path.planet);
    const home = initialHomeCameraPosition(...path.planet);
    pose.position.forEach((value, i) => { expect(value).toBeCloseTo(home[i]!, 5); });
    expect(pose.fov).toBe(JUMP_FOV);
  });

  it('never jumps between two frames', () => {
    let last = jumpCamera(path, 0);
    for (let s = 1 / 60; s <= 25; s += 1 / 60) {
      const pose = jumpCamera(path, s);
      expect(len(sub(pose.position, last.position))).toBeLessThan(1);
      expect(len(sub(pose.target, last.target))).toBeLessThan(1.2);
      last = pose;
    }
  });
});
