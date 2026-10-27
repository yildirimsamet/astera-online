import { ARENA_TUNING, type FlightTuning } from './tuning.js';

export function fuelBurn(throttle: number, turbo = false, tuning: FlightTuning = ARENA_TUNING): number {
  return tuning.idleBurn + tuning.throttleBurn * throttle + (turbo ? tuning.turboBurn : 0);
}

/** The warning: under 15 % of the tank, enough left to make for an exit. */
export function lowFuel(fuel: number, tuning: FlightTuning = ARENA_TUNING): boolean {
  return fuel < tuning.fuelTank * 0.15;
}

export function remainingFlightSeconds(fuel: number, throttle: number, turbo = false, tuning: FlightTuning = ARENA_TUNING): number {
  const burn = fuelBurn(throttle, turbo, tuning);
  return burn > 0 ? Math.max(0, fuel) / burn : 0;
}
