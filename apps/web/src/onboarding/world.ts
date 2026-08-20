import {
  BUILDING_IDS,
  HULLS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  START,
  START_BUILDINGS,
  alloyRate,
  collectorCap,
  crystalRate,
  fleetCount,
  flightSlots,
  instrumentCost,
  productionMult,
  satelliteCost,
  satelliteSlots,
  storageCap,
  tiersWithinBand,
  upgradeCost,
  vaultProtects,
  wealth,
  type BuildingId,
  type Fleet,
  type HullId,
} from '@astera/rules';
import type { ClaimIntent, GalaxyPlanet, PlanetView, Preview } from '../api/schemas.js';

/**
 * THE REHEARSAL'S WORLD. D56.
 *
 * A planet that does not exist, kept in memory, driven by the same
 * `@astera/rules` the server validates against — and that shared module is the
 * whole reason this design is cheap here and would be reckless anywhere else. The
 * package has no clock, no I/O and no ambient randomness, so "what does the Core
 * cost at level 1" has exactly one answer on both sides of the wire.
 *
 * IT DECIDES NOTHING. Everything below produces two things: a `PlanetView` to
 * render, and an INTENT to remember. The intents are what travel at the end, and
 * the server runs them through `upgradeBuilding`, `buildUnits` and `launchAttack`
 * exactly as it would for a signed-in player. Principle 1 is not bent: the client
 * is rendering and sending intent, and the fact that it can also predict the
 * outcome is what lets the screen keep up with a finger.
 *
 * EVERY GUARD THE SERVER HAS IS RE-CHECKED HERE, and the reason is D53's rule
 * about optimistic prediction: a prediction that is only usually right is worse
 * than none. If this offered an upgrade the claim would refuse, the player would
 * watch their opening un-happen on the one screen the game is played on.
 */

export interface RehearsalWorld {
  /** The world the server said it would give this visitor. */
  reserved: Preview['reserved'];
  buildings: Record<BuildingId, number>;
  alloy: number;
  crystal: number;
  /** Hulls standing on the planet. */
  fleet: Fleet;
  /** Hulls that have been sent. Owned, and demonstrably not defending. */
  away: Fleet;
  /** What was pressed, in the order it was pressed. This is what travels. */
  intents: ClaimIntent[];
  /** The one flight the opening budget funds, once it has been committed. */
  launch: { targetPlanetId: string; fleet: Fleet } | null;
}

export function openWorld(preview: Preview): RehearsalWorld {
  return {
    reserved: preview.reserved,
    buildings: { ...START_BUILDINGS },
    alloy: START.alloy,
    crystal: START.crystal,
    fleet: {},
    away: {},
    intents: [],
    launch: null,
  };
}

/* ── what may be pressed ────────────────────────────────────── */

/** Why an opening step is refused, in the server's own vocabulary. */
export type Refusal = 'CORE_CEILING' | 'INSUFFICIENT_RESOURCES' | 'SHIPYARD_TOO_LOW';

/**
 * The Core ceiling and the price, checked in that order — which is the order
 * `upgradeBuilding` checks them in, so the refusal a player sees is the refusal
 * they would have got.
 */
export function refusesUpgrade(w: RehearsalWorld, type: BuildingId): Refusal | null {
  const level = w.buildings[type];
  if (type !== 'CORE' && level >= w.buildings.CORE) return 'CORE_CEILING';
  const cost = upgradeCost(level);
  if (w.alloy < cost.alloy || w.crystal < cost.crystal) return 'INSUFFICIENT_RESOURCES';
  return null;
}

export function refusesBuild(w: RehearsalWorld, hull: HullId, count: number): Refusal | null {
  const spec = HULLS[hull];
  if (w.buildings.SHIPYARD < spec.minShipyard) return 'SHIPYARD_TOO_LOW';
  if (w.alloy < spec.alloy * count || w.crystal < spec.crystal * count) {
    return 'INSUFFICIENT_RESOURCES';
  }
  return null;
}

/* ── pressing them ──────────────────────────────────────────── */

export function upgrade(w: RehearsalWorld, type: BuildingId): RehearsalWorld {
  if (refusesUpgrade(w, type)) return w;
  const cost = upgradeCost(w.buildings[type]);
  return {
    ...w,
    alloy: w.alloy - cost.alloy,
    crystal: w.crystal - cost.crystal,
    buildings: { ...w.buildings, [type]: w.buildings[type] + 1 },
    intents: [...w.intents, { kind: 'upgrade', building: type }],
  };
}

export function build(w: RehearsalWorld, hull: HullId, count: number): RehearsalWorld {
  if (refusesBuild(w, hull, count)) return w;
  const spec = HULLS[hull];
  return {
    ...w,
    alloy: w.alloy - spec.alloy * count,
    crystal: w.crystal - spec.crystal * count,
    fleet: { ...w.fleet, [hull]: (w.fleet[hull] ?? 0) + count },
    intents: [...w.intents, { kind: 'build', hull, count }],
  };
}

/**
 * Commit the fleet. IRREVERSIBLE, here as well as there.
 *
 * The rehearsal could let a visitor take it back — nothing has happened yet — and
 * it deliberately does not. A launch that can be undone during the tutorial and
 * never again afterwards teaches the wrong thing about the one rule the whole risk
 * layer rests on (Principle 3).
 */
export function launch(
  w: RehearsalWorld,
  targetPlanetId: string,
  fleet: Fleet,
): RehearsalWorld {
  if (w.launch) return w;
  if (fleetCount(fleet) === 0) return w;
  const away: Fleet = { ...w.away };
  const home: Fleet = { ...w.fleet };
  for (const [hull, n] of Object.entries(fleet) as [HullId, number][]) {
    if ((home[hull] ?? 0) < n) return w;
    home[hull] = (home[hull] ?? 0) - n;
    away[hull] = (away[hull] ?? 0) + n;
  }
  return {
    ...w,
    fleet: home,
    away,
    launch: { targetPlanetId, fleet },
    intents: [...w.intents, { kind: 'launch', targetPlanetId, fleet }],
  };
}

/* ── who may be hit ─────────────────────────────────────────── */

/**
 * The worlds this planet may attack, nearest first. D49.
 *
 * FILTERED BY THE RULE, RANKED BY THE ONLY COST A NEWCOMER CAN READ. The tier band
 * is public on every world, so this is checkable off the map before a fleet is
 * packed — which is exactly why D49 replaced a Wealth floor with it.
 *
 * IT DOES NOT RANK BY WEAKNESS, and it must never be made to. The whole point of
 * the beat this feeds is that the choice is blind: nobody knows what is down there,
 * and an interface that hinted would answer for free the question the Telescope is
 * sold to answer.
 *
 * The bash limit is deliberately not modelled. How often a world has been hit
 * recently is not public, publishing it would be a new leak, and the honest place
 * to discover it is the claim — which reports the refusal and re-opens the choice.
 */
export function reachableTargets(
  w: RehearsalWorld,
  worlds: readonly GalaxyPlanet[],
): GalaxyPlanet[] {
  const tier = Math.max(1, Math.ceil(w.buildings.CORE / 3));
  const from = w.reserved.position;
  return worlds
    .filter((p) => !p.isSelf && p.owner !== '' && tiersWithinBand(tier, p.coreTier))
    .sort((a, b) => squared(from, a.position) - squared(from, b.position));
}

const squared = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;

/* ── rendering it ───────────────────────────────────────────── */

/**
 * The world as `/api/planet` would describe it.
 *
 * Built to the production schema on purpose: the rehearsal hands this to the very
 * same `PlanetScreen` the game uses, which is what stops the tutorial teaching an
 * interface that does not exist. Every figure comes from the rules package, in the
 * same order `services/planetView.ts` derives them — including `productionMult`,
 * which lifts the rate and therefore both caps with it.
 */
export function planetOf(w: RehearsalWorld): PlanetView {
  const boost = productionMult([]);
  const perHourAlloy = alloyRate(w.buildings.REFINERY) * boost;
  const perHourCrystal = crystalRate(w.buildings.EXTRACTOR) * boost;

  return {
    planet: {
      id: w.reserved.id,
      name: w.reserved.name,
      position: w.reserved.position,
      alloy: Math.floor(w.alloy),
      crystal: Math.floor(w.crystal),
      alloyCap: storageCap(perHourAlloy),
      crystalCap: storageCap(perHourCrystal),
      alloyPerHour: Math.round(perHourAlloy),
      crystalPerHour: Math.round(perHourCrystal),
      /**
       * THE WORKS ARE EMPTY AND STAY EMPTY.
       *
       * A rehearsal lasts two minutes and nothing accrues in it. Ticking a buffer
       * would be the one place this world drifts from the one the claim creates —
       * the server starts a planet's clock when the row is written, not when a
       * visitor started looking — and it would put a number on screen that the
       * first real payload then corrects downward.
       */
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferAlloyCap: collectorCap(perHourAlloy),
      bufferCrystalCap: collectorCap(perHourCrystal),
      vaultFloor: vaultProtects(w.buildings.VAULT),
      shield: 0,
      disruptedUntil: null,
    },
    buildings: { ...w.buildings },
    nextCosts: Object.fromEntries(
      BUILDING_IDS.map((b) => [b, upgradeCost(w.buildings[b])]),
    ),
    instruments: Object.fromEntries(INSTRUMENT_IDS.map((i) => [i, 0])),
    instrumentCosts: Object.fromEntries(
      INSTRUMENT_IDS.map((i) => [i, instrumentCost(i, 0)]),
    ),
    orbit: [],
    orbitSlots: satelliteSlots(w.buildings.CORE),
    satelliteCosts: Object.fromEntries(SATELLITE_IDS.map((s) => [s, satelliteCost(s)])),
    fleet: { ...w.fleet },
    ground: {},
    fleetAway: { ...w.away },
    flight: { used: w.launch ? 1 : 0, total: flightSlots(w.buildings.CORE) },
    score: {
      wealth: wealth({
        buildings: w.buildings,
        instruments: {},
        satellites: [],
        fleet: { ...w.fleet, ...w.away },
        ground: {},
        alloy: w.alloy,
        crystal: w.crystal,
      }),
      // Only combat makes Dominion, and none has happened.
      dominion: 0,
    },
  };
}
