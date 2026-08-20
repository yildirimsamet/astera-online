import { productiveMinutes } from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';
import { toServerTime } from './clock.js';
import { useNow } from './time.js';

/**
 * What the planet holds *right now*, predicted between fetches.
 *
 * PREDICTION ONLY. Every spend is validated against the server's own figure inside
 * a row lock; this exists so the numbers move while you watch them, which is what
 * makes an offline world feel like it was running. It uses the same rule functions
 * as the server, so it cannot drift in a way an action would not correct.
 *
 * IT PREDICTED THE WRONG PILE. This was written before D16, when production landed
 * straight in storage, and it kept adding `rate × hours` to `planet.alloy` long
 * after production started landing in the WORKS instead. The result was a header
 * that contradicted itself: the big storage numbers crept upward on their own —
 * which is precisely what D16 exists to stop — while the vessels beside them, read
 * straight from the last fetch, never moved at all. The owner reported the second
 * half of that ("the works don't update while I play"); the first half was the
 * same bug wearing the opposite sign.
 *
 * So now the two piles are predicted for what they actually are:
 *
 *   · THE WORKS FILL, capped at the collector's ceiling. That cap is the entire
 *     lesson of D16 — production stops when the vessel is full — and a projection
 *     that ran past it would teach the opposite of the thing the interface is
 *     built to teach.
 *   · STORAGE DOES NOT MOVE. Nothing arrives in it except by collecting, spending,
 *     mining or being raided, and every one of those is a mutation that refetches.
 *     A number that changes without a cause is a number a player learns to
 *     distrust.
 */
export interface Projected {
  /** In storage. Spendable, and steady between actions. */
  alloy: number;
  crystal: number;
  /** In the works. Filling, and worth nothing until it is collected. */
  bufferAlloy: number;
  bufferCrystal: number;
}

/**
 * The works, moved forward from when they were last read to a given instant.
 *
 * Pulled out of the hook because a second caller needs exactly this and must not
 * have a second copy of it: an optimistic write re-anchors React Query's
 * `dataUpdatedAt` to NOW, so a payload written with a works figure from a minute
 * ago would make the projection restart from the older number — the meter would
 * visibly drop and then be corrected by the server's answer. See `predict.ts`.
 */
export function worksAt(
  planet: PlanetView['planet'],
  fetchedAt: number,
  now: number,
): { bufferAlloy: number; bufferCrystal: number } {
  /**
   * ALL THREE INSTANTS ON THE SERVER'S EPOCH — and one of them is not born there.
   *
   * This used to say "any consistent epoch works", which was true of the two it
   * compared and quietly false of the third: `disruptedUntil` is a SERVER timestamp
   * and `fetchedAt`/`now` were both device time, so a drifted phone mis-measured
   * every disruption. `useNow` now returns `serverNow()`, which fixed that end and
   * broke the other — `fetchedAt` is React Query's `dataUpdatedAt`, the one
   * timestamp in the client that can only be taken locally, so the span became
   * `real elapsed + offset` and the works jumped forward the moment a fetch landed.
   *
   * `toServerTime` moves it across. Every figure below is now on one clock.
   */
  const from = toServerTime(fetchedAt) / 60_000;
  const to = Math.max(from, now / 60_000);
  const until = planet.disruptedUntil ? planet.disruptedUntil.getTime() / 60_000 : 0;
  const hours = productiveMinutes(from, to, until) / 60;

  return {
    bufferAlloy: Math.min(planet.bufferAlloyCap, planet.bufferAlloy + planet.alloyPerHour * hours),
    bufferCrystal: Math.min(
      planet.bufferCrystalCap,
      planet.bufferCrystal + planet.crystalPerHour * hours,
    ),
  };
}

export function useProjected(
  planet: PlanetView['planet'] | undefined,
  fetchedAt: number,
  /**
   * One second where the number is being watched; far coarser everywhere else.
   * The planet screen only needs this to decide whether a button can be pressed,
   * and re-rendering forty rows every second to move a boundary nobody is staring
   * at is the definition of an unnecessary re-render.
   */
  intervalMs = 1000,
): Projected {
  const now = useNow(intervalMs);
  if (!planet) return { alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0 };

  return { alloy: planet.alloy, crystal: planet.crystal, ...worksAt(planet, fetchedAt, now) };
}
