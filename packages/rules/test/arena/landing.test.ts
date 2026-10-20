import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, createFlightState, createInput, stepFlight, type FlightState, type Vec3,
} from '../../src/arena/index.js';
import { box, layoutWith, sphere } from './helpers.js';

const r = T.shipHitRadius;
const up = (s: FlightState): Vec3 => {
  const q = s.q;
  return { x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
};
const forward = (s: FlightState): Vec3 => {
  const q = s.q;
  return { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
};
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const rock = layoutWith([sphere(0, 0, 0, 60, 30)]);

/** Fly slowly into the rock ahead until the ship touches down. */
function touchDown(state: FlightState, throttle = 0.15): number {
  const input = createInput();
  input.throttle = throttle;
  for (let i = 0; i < 600; i++) {
    stepFlight(state, input, rock);
    if (state.landed) return i;
  }
  throw new Error('never landed');
}

describe('landing on any surface', () => {
  it('lands on a slow contact: stopped, resting on the surface, with the outward normal', () => {
    const state = createFlightState();
    touchDown(state);
    expect(state.landed).toBe(1);
    expect(state.s).toBe(0);
    expect(Math.sqrt(state.nx ** 2 + state.ny ** 2 + state.nz ** 2)).toBeCloseTo(1, 9);
    expect(state.nz).toBeCloseTo(-1, 6);
    const distance = Math.sqrt(state.p.x ** 2 + state.p.y ** 2 + (state.p.z - 60) ** 2);
    expect(distance).toBeCloseTo(30 + r, 3);
  });

  it('bounces off instead of landing when the contact is too fast, harder the faster it hits', () => {
    const away = (speed: number): { bump: number; gap: number } => {
      const state = createFlightState();
      state.p.z = 60 - 30 - r - 3;
      state.s = speed;
      const input = createInput();
      input.throttle = 1;
      stepFlight(state, input, rock);
      expect(state.landed).toBe(0);
      const bump = state.bump;
      for (let i = 0; i < 8; i++) stepFlight(state, input, rock);
      return { bump, gap: 60 - 30 - r - state.p.z };
    };
    const soft = away(50); const hard = away(T.speedMax);
    expect(hard.bump).toBeGreaterThan(soft.bump);
    expect(hard.gap).toBeGreaterThan(soft.gap);
    expect(hard.gap).toBeGreaterThan(5);
  });

  it('rests in place and settles its belly onto the surface while the throttle stays down', () => {
    const state = createFlightState();
    touchDown(state);
    const at = { ...state.p };
    const input = createInput();
    input.throttle = 0.15;
    for (let i = 0; i < 60; i++) stepFlight(state, input, rock);
    expect(state.landed).toBe(1);
    expect(state.p).toEqual(at);
    expect(dot(up(state), { x: state.nx, y: state.ny, z: state.nz })).toBeGreaterThan(0.99);
    expect(Math.abs(dot(forward(state), { x: state.nx, y: state.ny, z: state.nz }))).toBeLessThan(0.1);
  });

  it('lands sideways on a wall, using the wall face as its floor', () => {
    const wall = layoutWith([box(0, 0, 0, 40, 60, 60, 2)]);
    const state = createFlightState();
    const input = createInput();
    input.throttle = 0.1;
    for (let i = 0; i < 600 && !state.landed; i++) stepFlight(state, input, wall);
    expect(state.landed).toBe(1);
    expect(state.nx).toBeCloseTo(0, 12);
    expect(state.ny).toBeCloseTo(0, 12);
    expect(state.nz).toBeCloseTo(-1, 12);
    expect(state.p.z).toBeCloseTo(38 - r, 6);
  });

  it('takes off only when the throttle rises above its lowest value since touchdown', () => {
    const state = createFlightState();
    touchDown(state, 0.15);
    const input = createInput();
    input.throttle = 0.15;
    stepFlight(state, input, rock);
    expect(state.landed).toBe(1);
    input.throttle = 0;
    stepFlight(state, input, rock);
    expect(state.landed).toBe(1);
    input.throttle = 0.05;
    stepFlight(state, input, rock);
    expect(state.landed).toBe(0);
    expect(state.liftoff).toBeGreaterThan(0);
    const surface = (): number => Math.sqrt(state.p.x ** 2 + state.p.y ** 2 + (state.p.z - 60) ** 2) - 30;
    const start = surface();
    input.throttle = 0.6;
    for (let i = 0; i < 45; i++) {
      stepFlight(state, input, rock);
      expect(state.landed).toBe(0);
    }
    expect(surface()).toBeGreaterThan(start + 10);
  });

  it('turns in place about the surface normal while landed and ignores pitch', () => {
    const state = createFlightState();
    touchDown(state);
    const input = createInput();
    input.throttle = 0.15;
    for (let i = 0; i < 40; i++) stepFlight(state, input, rock);
    const at = { ...state.p };
    const before = forward(state);
    input.steerX = 1;
    input.steerY = 1;
    for (let i = 0; i < 20; i++) stepFlight(state, input, rock);
    expect(state.p).toEqual(at);
    expect(state.landed).toBe(1);
    expect(dot(forward(state), before)).toBeLessThan(0.95);
    expect(dot(up(state), { x: state.nx, y: state.ny, z: state.nz })).toBeGreaterThan(0.99);
    expect(state.omegaPitch).toBe(0);
  });

  it('keeps burning a trickle of fuel while landed and stays landed when it runs dry', () => {
    const state = createFlightState();
    touchDown(state);
    state.fuel = T.idleBurn / T.tickRate * 1.5;
    stepFlight(state, createInput(), rock);
    expect(state.fuel).toBeCloseTo(T.idleBurn / T.tickRate * 0.5, 12);
    stepFlight(state, createInput(), rock);
    expect(state.fuel).toBe(0);
    const input = createInput();
    input.throttle = 1;
    for (let i = 0; i < 5; i++) stepFlight(state, input, rock);
    expect(state.landed).toBe(1);
    expect(state.s).toBe(0);
  });
});
