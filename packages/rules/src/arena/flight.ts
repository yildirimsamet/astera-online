import { DEFAULT_STEERING, clampAssist, steeringGain } from './controls.js';
import { moveFlight } from './collision.js';
import { fuelBurn } from './fuel.js';
import { ARENA_LAYOUT } from './layout.js';
import { ARENA_TUNING, type FlightTuning } from './tuning.js';
import { alignUp, rotateLocal, rotateWorld } from './vec.js';
import type { ArenaLayout, FlightInput, FlightState, SteeringSettings } from './types.js';

export function createFlightState(): FlightState {
  return {
    p: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 },
    s: 0, throttle: 0, omegaYaw: 0, omegaPitch: 0, fuel: ARENA_TUNING.fuelTank,
    landed: 0, nx: 0, ny: 1, nz: 0, landThrottle: 0, liftoff: 0, bump: 0, kx: 0, ky: 0, kz: 0,
  };
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0;

/** One authoritative 1/tickRate step, mutating only the caller's state. */
export function stepFlight(state: FlightState, input: FlightInput, layout: ArenaLayout = ARENA_LAYOUT,
  settings: SteeringSettings = DEFAULT_STEERING, tuning: FlightTuning = ARENA_TUNING): void {
  const dt = 1 / tuning.tickRate;
  const powered = state.fuel > 0;
  const throttle = powered ? Math.max(0, Math.min(1, finite(input.throttle))) : 0;
  const steerX = finite(input.steerX);
  const steerY = finite(input.steerY);
  const gain = steeringGain(steerX, steerY, settings.sensitivity, tuning);
  state.throttle = throttle;

  if (state.landed) {
    state.s = 0; state.omegaPitch = 0; state.bump = 0;
    if (throttle < state.landThrottle) state.landThrottle = throttle;
    if (powered && (throttle > state.landThrottle || input.turbo)) {
      // Take off cleanly: level on the surface, then lift along its normal. Turbo takes off too.
      alignUp(state.q, state.nx, state.ny, state.nz, 1);
      state.landed = 0; state.liftoff = tuning.liftTicks; state.omegaYaw = 0;
    } else {
      state.omegaYaw = powered ? -steerX * gain * tuning.landedYawRate : 0;
      rotateWorld(state.q, state.nx, state.ny, state.nz, state.omegaYaw * dt);
      alignUp(state.q, state.nx, state.ny, state.nz, dt / tuning.landSettle);
      if (powered) state.fuel = Math.max(0, state.fuel - fuelBurn(0, false, tuning) * dt);
      return;
    }
  }

  const turbo = powered && input.turbo;
  // Turbo is a boost to full turbo speed from any throttle; releasing it glides back down.
  const target = turbo ? tuning.speedMax * tuning.turboSpeedMul : throttle * tuning.speedMax;
  if (state.s < target) state.s = Math.min(target, state.s + tuning.accel * (turbo ? tuning.turboAccelMul : 1) * dt);
  else state.s = Math.max(target, state.s - tuning.decel * dt);
  if (target === 0 && state.s < tuning.stopEpsilon) state.s = 0;

  if (powered) {
    const slow = 1 - Math.min(1, state.s / tuning.speedMax);
    const turn = tuning.turnRateMax * (1 + tuning.slowTurnBonus * slow) * (turbo ? tuning.turboTurnMul : 1);
    // Looking along +Z with +Y up makes screen-right the local -X direction.
    const yaw = (-steerX * gain - clampAssist(input.assistX, tuning)) * turn;
    const pitch = (steerY * gain * (settings.invertPitch ? -1 : 1) + clampAssist(input.assistY, tuning)) * turn;
    const response = Math.min(1, dt / tuning.turnResponse);
    state.omegaYaw += (yaw - state.omegaYaw) * response;
    state.omegaPitch += (pitch - state.omegaPitch) * response;
    const stop = turn * tuning.turnStopRatio;
    if (yaw === 0 && Math.abs(state.omegaYaw) < stop) state.omegaYaw = 0;
    if (pitch === 0 && Math.abs(state.omegaPitch) < stop) state.omegaPitch = 0;
    const q = state.q;
    const vertical = 2 * (q.y * q.z - q.w * q.x);
    const rollError = 2 * (q.x * q.y + q.w * q.z);
    const roll = Math.abs(vertical) < 0.8660254037844386 && state.liftoff === 0 ? -tuning.rollLevelRate * rollError : 0;
    rotateLocal(q, state.omegaPitch, state.omegaYaw, roll, dt);
  } else { state.omegaYaw = 0; state.omegaPitch = 0; }

  const q = state.q;
  moveFlight(state, layout, 2 * (q.x * q.z + q.w * q.y), 2 * (q.y * q.z - q.w * q.x),
    1 - 2 * (q.x * q.x + q.y * q.y), dt, tuning.shipHitRadius, tuning, input.land === true);
  if (state.liftoff > 0) state.liftoff--;
  if (powered) state.fuel = Math.max(0, state.fuel - fuelBurn(state.throttle, turbo, tuning) * dt);
}
