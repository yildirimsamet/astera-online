import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING, createFlightState, createInput, forwardVector, sampleAssist, sampleInput, stepFlight,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

const empty = layoutWith();

describe('fixed-step arena flight', () => {
  it('accelerates towards the selected throttle and never flies backwards', () => {
    const state = createFlightState();
    const input = createInput();
    input.throttle = 1;
    stepFlight(state, input, empty);
    expect(state.s).toBeCloseTo(ARENA_TUNING.accel / ARENA_TUNING.tickRate, 12);
    expect(state.p.z).toBeGreaterThan(0);
    for (let i = 0; i < 150; i++) stepFlight(state, input, empty);
    expect(state.s).toBe(ARENA_TUNING.speedMax);
    input.throttle = 0.5;
    for (let i = 0; i < 200; i++) stepFlight(state, input, empty);
    expect(state.s).toBe(ARENA_TUNING.speedMax / 2);
  });

  it('decelerates to exact zero in finite time when throttle is cut', () => {
    const state = createFlightState();
    state.s = ARENA_TUNING.speedMax;
    const input = createInput();
    for (let i = 0; i < 400; i++) stepFlight(state, input, empty);
    expect(state.s).toBe(0);
    const position = { ...state.p };
    stepFlight(state, input, empty);
    expect(state.p).toEqual(position);
  });

  it('burns a small amount of deuterium even when fully stopped', () => {
    const state = createFlightState();
    stepFlight(state, createInput(), empty);
    expect(state.fuel).toBe(ARENA_TUNING.fuelTank - ARENA_TUNING.idleBurn / ARENA_TUNING.tickRate);
    expect(state.p).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('holds heading once the stick is released and stops turning within four ticks', () => {
    const state = createFlightState();
    const input = createInput();
    input.steerX = 1;
    for (let i = 0; i < 60; i++) stepFlight(state, input, empty);
    input.steerX = 0;
    for (let i = 0; i < 4; i++) stepFlight(state, input, empty);
    expect(state.omegaYaw).toBe(0);
    const heading = { ...state.q };
    for (let i = 0; i < 30; i++) stepFlight(state, input, empty);
    expect(state.q).toEqual(heading);
  });

  it('pushes the nose up when the stick is pushed up, without requiring throttle', () => {
    const state = createFlightState();
    const input = createInput();
    input.steerY = -1;
    for (let i = 0; i < 10; i++) stepFlight(state, input, empty);
    const forward = { x: 0, y: 0, z: 0 };
    forwardVector(forward, state.q);
    expect(forward.y).toBeGreaterThan(0);
    expect(state.s).toBe(0);
  });

  it('lets turbo modifiers reduce turn rate while increasing forward speed', () => {
    const normal = createFlightState();
    const turbo = createFlightState();
    const input = createInput();
    input.throttle = 1;
    input.steerX = 1;
    for (let i = 0; i < 150; i++) {
      input.turbo = false;
      stepFlight(normal, input, empty);
      input.turbo = true;
      stepFlight(turbo, input, empty);
    }
    expect(turbo.s).toBe(ARENA_TUNING.speedMax * ARENA_TUNING.turboSpeedMul);
    expect(turbo.omegaYaw).toBeCloseTo(normal.omegaYaw * ARENA_TUNING.turboTurnMul, 10);
    expect(turbo.fuel).toBeLessThan(normal.fuel);
  });

  it('turbo always flies at full turbo speed, whatever the throttle, and glides back after', () => {
    const T = ARENA_TUNING;
    const state = createFlightState();
    const input = createInput();
    input.throttle = 0.5;
    for (let i = 0; i < 120; i++) stepFlight(state, input, empty);
    expect(state.s).toBe(T.speedMax * 0.5);
    input.turbo = true;
    const boost = T.speedMax * T.turboSpeedMul;
    const ticks = Math.ceil((boost - state.s) / (T.accel * T.turboAccelMul) * T.tickRate);
    for (let i = 0; i < ticks; i++) stepFlight(state, input, empty);
    expect(state.s).toBe(boost);
    input.turbo = false;
    stepFlight(state, input, empty);
    expect(state.s).toBeLessThan(boost);
    expect(state.s).toBeGreaterThan(T.speedMax * 0.5);
  });

  it('keeps the owner turbo budget: twice the old burn time, the same 7.5 s refill', () => {
    expect(ARENA_TUNING.turboCharge).toBe(6);
    expect(ARENA_TUNING.turboCharge / ARENA_TUNING.turboRegen).toBe(7.5);
  });

  it('clamps fuel at zero and accepts no steering or throttle after fuel runs out', () => {
    const state = createFlightState();
    state.fuel = 0.00001;
    stepFlight(state, createInput(), empty);
    expect(state.fuel).toBe(0);
    const heading = { ...state.q };
    const input = createInput();
    input.throttle = 1;
    input.steerX = 1;
    input.turbo = true;
    for (let i = 0; i < 10; i++) stepFlight(state, input, empty);
    expect(state.fuel).toBe(0);
    expect(state.s).toBe(0);
    expect(state.throttle).toBe(0);
    expect(state.q).toEqual(heading);
  });

  it('turns tighter when slow: speed management is part of the dogfight', () => {
    const slow = createFlightState();
    const fast = createFlightState();
    fast.s = ARENA_TUNING.speedMax;
    const coast = createInput();
    coast.steerX = 1;
    const cruise = createInput();
    cruise.steerX = 1;
    cruise.throttle = 1;
    for (let i = 0; i < 20; i++) {
      stepFlight(slow, coast, empty);
      stepFlight(fast, cruise, empty);
    }
    expect(slow.s).toBe(0);
    expect(fast.s).toBe(ARENA_TUNING.speedMax);
    expect(slow.omegaYaw / fast.omegaYaw).toBeCloseTo(1 + ARENA_TUNING.slowTurnBonus, 6);
  });

  it('adds the aim-assist channel after the stick curve and clamps it to a mild authority', () => {
    const assisted = createFlightState();
    const capped = createFlightState();
    const plain = createFlightState();
    for (const state of [assisted, capped, plain]) state.s = ARENA_TUNING.speedMax;
    const a = createInput(); a.throttle = 1; sampleAssist(a, ARENA_TUNING.assistMax, 0);
    const c = createInput(); c.throttle = 1; sampleAssist(c, 1, 0);
    const p = createInput(); p.throttle = 1;
    expect(c.assistX).toBe(ARENA_TUNING.assistMax);
    for (let i = 0; i < 30; i++) {
      stepFlight(assisted, a, empty);
      stepFlight(capped, c, empty);
      stepFlight(plain, p, empty);
    }
    expect(plain.omegaYaw).toBe(0);
    expect(assisted.omegaYaw).toBeCloseTo(-ARENA_TUNING.assistMax * ARENA_TUNING.turnRateMax, 6);
    expect(capped).toEqual(assisted);
    const tampered = createFlightState();
    tampered.s = ARENA_TUNING.speedMax;
    const raw = { ...p, assistX: 5, assistY: Number.NaN };
    for (let i = 0; i < 30; i++) stepFlight(tampered, raw, empty);
    expect(tampered.omegaYaw).toBeCloseTo(assisted.omegaYaw, 9);
    expect(tampered.omegaPitch).toBe(0);
  });

  it('keeps its quaternion normalized and speed nonnegative for arbitrary intent sequences', () => {
    fc.assert(fc.property(fc.array(fc.tuple(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: -1000, max: 1000 }),
    ), { minLength: 1, maxLength: 150 }), (sequence) => {
      const a = createFlightState();
      const b = createFlightState();
      const input = createInput();
      for (const [x, y, throttle, assist] of sequence) {
        sampleInput(input, x / 1000, y / 1000, throttle / 100);
        sampleAssist(input, assist / 1000, -assist / 2000);
        stepFlight(a, input, empty);
        stepFlight(b, input, empty);
        expect(a.s).toBeGreaterThanOrEqual(0);
        expect(a.fuel).toBeGreaterThanOrEqual(0);
        const q = a.q;
        expect(Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)).toBeCloseTo(1, 12);
      }
      expect(a).toEqual(b);
    }), { numRuns: 60 });
  });

  it('levels roll near the reference plane and leaves vertical flight stable', () => {
    const state = createFlightState();
    state.q.z = 0.3;
    state.q.w = Math.sqrt(1 - state.q.z * state.q.z);
    const before = Math.abs(state.q.z);
    for (let i = 0; i < 30; i++) stepFlight(state, createInput(), empty);
    expect(Math.abs(state.q.z)).toBeLessThan(before);

    const vertical = createFlightState();
    vertical.q.x = -Math.sqrt(0.5);
    vertical.q.w = Math.sqrt(0.5);
    const q = { ...vertical.q };
    stepFlight(vertical, createInput(), empty);
    expect(vertical.q).toEqual(q);
  });
});
