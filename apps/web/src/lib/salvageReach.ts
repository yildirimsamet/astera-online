import { distance, travelExact, travelMinutes, type Vec3 } from '@astera/rules';

/**
 * How long a salvage flight is quoted for, in the units its server flies it: a colony ship's
 * server times a flight exactly, the main game's in whole minutes. Quoting a ship in whole minutes
 * put "3m" on the button and "2m" on the departure for the same flight.
 */
export function salvageReachMinutes(home: Vec3 | undefined, at: Vec3, speed: number, aboard: boolean): number | null {
  if (!home || speed <= 0) return null;
  const span = distance(home, at);
  return aboard ? travelExact(span, speed) : travelMinutes(span, speed);
}
