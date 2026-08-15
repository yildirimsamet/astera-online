import { productiveMinutes, storageCap } from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';
import { useNow } from './time.js';

/**
 * What the planet holds *right now*, predicted between fetches.
 *
 * PREDICTION ONLY. Every spend is validated against the server's own figure
 * inside a row lock; this exists so the numbers move while you watch them, which
 * is what makes an offline world feel like it was running. It uses the same rule
 * function as the server, so it cannot drift in a way an action would not correct.
 */
export function useProjectedResources(
  planet: PlanetView['planet'] | undefined,
  fetchedAt: number,
  /**
   * One second where the number is being watched; far coarser everywhere else.
   * The planet screen only needs this to decide whether a button can be pressed,
   * and re-rendering forty rows every second to move a boundary nobody is
   * staring at is the definition of an unnecessary re-render.
   */
  intervalMs = 1000,
): { alloy: number; crystal: number } {
  const now = useNow(intervalMs);
  if (!planet) return { alloy: 0, crystal: 0 };

  // Any consistent epoch works — productiveMinutes only ever subtracts.
  const from = fetchedAt / 60_000;
  const to = Math.max(from, now / 60_000);
  const until = planet.disruptedUntil ? planet.disruptedUntil.getTime() / 60_000 : 0;
  const hours = productiveMinutes(from, to, until) / 60;

  return {
    alloy: Math.min(planet.alloyCap, planet.alloy + planet.alloyPerHour * hours),
    crystal: Math.min(planet.crystalCap, planet.crystal + planet.crystalPerHour * hours),
  };
}

export const capacityHours = (rate: number): number => (rate <= 0 ? 0 : storageCap(rate) / rate);
