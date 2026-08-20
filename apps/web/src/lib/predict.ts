import {
  HULLS,
  PROSPECTOR,
  instrumentCost,
  instrumentMaxed,
  satelliteCost,
  seeingUnlocked,
  upgradeCost,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type Resources,
  type SatelliteId,
} from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';

/**
 * WHAT A TAP DOES, BEFORE THE SERVER SAYS SO. D53.
 *
 * Construction in this game is INSTANT ON PAYMENT — no build timers, by design,
 * because "a bar filled up" is the weakest return hook there is. The interface was
 * not keeping that promise: a tap disabled its own button and waited a round trip
 * to show a decision the design says is immediate. Returning the whole view from
 * the mutation halved that. This removes the rest of it.
 *
 * IT IS A PREDICTION, NOT A DECISION. Principle 1 says the client never decides an
 * outcome, and nothing here does: the server validates against its own figures
 * inside a row lock, its answer overwrites this on arrival, and a refusal rolls it
 * back. `useProjected` has predicted the works between fetches on exactly this
 * basis since D16. What is new is only that a spend is predicted too.
 *
 * IT PREDICTS WHAT THE PLAYER IS LOOKING AT, AND NOTHING ELSE.
 *
 * That restraint is the whole design of this file. A full prediction would have to
 * re-derive storage caps from the new Refinery level, per-hour rates from the new
 * Foundry, orbit slots from the new Core, flight bays, Wealth — which is
 * `planetView` written a second time, in another language, guaranteed to drift the
 * first time a rule moves. So each predictor touches the two piles being spent, the
 * one thing being bought, and the price of the next one of it. Every derived figure
 * lands two hundred milliseconds later with the real answer, and nobody is staring
 * at a storage ceiling in those two hundred milliseconds.
 *
 * Each function is PURE and returns a new view. The caller decides whether to keep
 * it — see `useOptimisticPlanet` in `queries.ts`.
 */

/** Whether the two piles cover a price. The same test the server will apply. */
const affordable = (view: PlanetView, cost: Resources): boolean =>
  view.planet.alloy >= cost.alloy && view.planet.crystal >= cost.crystal;

/** Pay for something, leaving every derived figure alone. */
function spend(view: PlanetView, cost: Resources): PlanetView {
  return {
    ...view,
    planet: {
      ...view.planet,
      alloy: view.planet.alloy - cost.alloy,
      crystal: view.planet.crystal - cost.crystal,
    },
  };
}

/**
 * `null` means "do not predict this one".
 *
 * Returned whenever the answer is not certain from what the client holds — most
 * often because the player cannot afford it, in which case the server is about to
 * refuse and showing the purchase first would be a flicker of a lie. Predicting
 * only the certain cases is what keeps a rollback rare enough to be invisible.
 */
export type Prediction = PlanetView | null;

export function predictUpgrade(view: PlanetView, type: BuildingId): Prediction {
  const level = view.buildings[type];
  if (level === undefined) return null;
  const cost = view.nextCosts[type];
  if (!cost || !affordable(view, cost)) return null;
  /**
   * THE CORE CEILING, PREDICTED TOO. Otherwise the one refusal a player meets most
   * often — raising a structure past its Command Core — would show as a successful
   * upgrade that un-happens a moment later.
   */
  const core = view.buildings.CORE ?? 0;
  if (type !== 'CORE' && level >= core) return null;

  const next = spend(view, cost);
  return {
    ...next,
    buildings: { ...next.buildings, [type]: level + 1 },
    // The row shows what the NEXT one costs, and it is the figure directly under
    // the button that was just pressed.
    nextCosts: { ...next.nextCosts, [type]: upgradeCost(level + 1) },
  };
}

export function predictBuild(view: PlanetView, hull: HullId, count: number): Prediction {
  const spec = HULLS[hull];
  if (!Number.isInteger(count) || count < 1) return null;
  // The Shipyard gate, for the same reason the Core ceiling is checked above.
  if ((view.buildings.SHIPYARD ?? 0) < spec.minShipyard) return null;

  const cost = { alloy: spec.alloy * count, crystal: spec.crystal * count };
  if (!affordable(view, cost)) return null;

  /**
   * A PROSPECTOR IS CAPPED BY WHAT YOU OWN, NOT BY WHAT IS AT HOME.
   *
   * `PROSPECTOR.max` counts craft wherever they are, which is why the payload
   * carries `fleetAway` at all. Predicting past that cap would offer a fourth
   * drill and then take it away.
   */
  const owned = (view.fleet[hull] ?? 0) + (view.fleetAway[hull] ?? 0);
  if (hull === 'PROSPECTOR' && owned + count > PROSPECTOR.max) return null;

  const next = spend(view, cost);
  const ground = spec.ground;
  const stack = ground ? next.ground : next.fleet;
  const updated = { ...stack, [hull]: (stack[hull] ?? 0) + count };
  return ground ? { ...next, ground: updated } : { ...next, fleet: updated };
}

export function predictInstrument(view: PlanetView, type: InstrumentId): Prediction {
  const level = view.instruments[type] ?? 0;
  const cost = view.instrumentCosts[type];
  if (!cost || !affordable(view, cost)) return null;
  /**
   * EVERY GUARD THE SERVER WILL APPLY, APPLIED HERE FIRST.
   *
   * The Uplink gate (D25), the Command Core ceiling, and the level an instrument's
   * own effect table stops at (D36). All three are pure functions this client
   * already imports, so declining is exact rather than approximate — and a
   * prediction that is only usually right is worse than none, because the flicker
   * lands on the one screen the whole information game is played on.
   */
  if ((type === 'TELESCOPE' || type === 'RADAR') && !seeingUnlocked(view.orbit)) return null;
  if (level >= (view.buildings.CORE ?? 0)) return null;
  if (instrumentMaxed(type, level)) return null;

  const next = spend(view, cost);
  return {
    ...next,
    instruments: { ...next.instruments, [type]: level + 1 },
    instrumentCosts: { ...next.instrumentCosts, [type]: instrumentCost(type, level + 1) },
  };
}

export function predictSatellite(view: PlanetView, type: SatelliteId): Prediction {
  if (view.orbit.includes(type)) return null;
  if (view.orbit.length >= view.orbitSlots) return null;
  const cost = satelliteCost(type);
  if (!affordable(view, cost)) return null;

  const next = spend(view, cost);
  return { ...next, orbit: [...next.orbit, type] };
}

/**
 * EMPTY THE WORKS. D16.
 *
 * The one tap a player makes every single session, and the one this matters most
 * for. Predicted from the caps the payload already carries rather than by calling
 * the rules' own `collect` — `alloyCap` and `bufferAlloyCap` are on the view, they
 * are computed server-side with the Foundry multiplier applied (D52a), and reading
 * them keeps this from being a second copy of that arithmetic.
 */
export function predictCollect(view: PlanetView): Prediction {
  const p = view.planet;
  const takeAlloy = Math.min(p.bufferAlloy, Math.max(0, p.alloyCap - p.alloy));
  const takeCrystal = Math.min(p.bufferCrystal, Math.max(0, p.crystalCap - p.crystal));
  if (takeAlloy <= 0 && takeCrystal <= 0) return null;

  return {
    ...view,
    planet: {
      ...p,
      alloy: p.alloy + takeAlloy,
      crystal: p.crystal + takeCrystal,
      bufferAlloy: p.bufferAlloy - takeAlloy,
      bufferCrystal: p.bufferCrystal - takeCrystal,
    },
  };
}
