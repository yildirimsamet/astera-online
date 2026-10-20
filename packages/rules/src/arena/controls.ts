import { ARENA_TUNING, type FlightTuning } from './tuning.js';
import type { FlightInput, SteeringSettings, Vec3 } from './types.js';

export const DEFAULT_STEERING: Readonly<SteeringSettings> = Object.freeze({ sensitivity: 1, invertPitch: false });

const finite = (value: number): number => Number.isFinite(value) ? value : 0;
export const createInput = (): FlightInput => ({ steerX: 0, steerY: 0, throttle: 0, turbo: false, assistX: 0, assistY: 0 });

export function sampleInput(out: FlightInput, x: number, y: number, throttle: number, turbo = false): void {
  out.steerX = Math.round(Math.max(-1, Math.min(1, finite(x))) * 1000) / 1000;
  out.steerY = Math.round(Math.max(-1, Math.min(1, finite(y))) * 1000) / 1000;
  out.throttle = Math.round(Math.max(0, Math.min(1, finite(throttle))) * 100) / 100;
  out.turbo = turbo;
}

/** The aim-assist channel uses the same 0.001 grid as the stick and never exceeds assistMax. */
export function sampleAssist(out: FlightInput, x: number, y: number, tuning: FlightTuning = ARENA_TUNING): void {
  out.assistX = clampAssist(x, tuning);
  out.assistY = clampAssist(y, tuning);
}

export function clampAssist(value: number, tuning: FlightTuning = ARENA_TUNING): number {
  return Math.round(Math.max(-tuning.assistMax, Math.min(tuning.assistMax, finite(value))) * 1000) / 1000;
}

/** A scalar gain preserves the direction of the circular stick. */
export function steeringGain(x: number, y: number, sensitivity: number, tuning: FlightTuning): number {
  const length = Math.sqrt(x * x + y * y);
  if (length <= tuning.deadzone || !Number.isFinite(length)) return 0;
  const magnitude = Math.max(0, Math.min(1, (Math.min(1, length) - tuning.deadzone) / (1 - tuning.deadzone)));
  const curve = magnitude * (tuning.stickLinear + (1 - tuning.stickLinear) * magnitude * magnitude);
  return Math.min(1, curve * Math.max(0, finite(sensitivity))) / length;
}

export function shapeSteering(out: Vec3, x: number, y: number, settings = DEFAULT_STEERING, tuning = ARENA_TUNING): void {
  const gain = steeringGain(x, y, settings.sensitivity, tuning);
  out.x = finite(x) * gain;
  out.y = finite(y) * gain * (settings.invertPitch ? -1 : 1);
  out.z = 0;
}
