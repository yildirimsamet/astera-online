import {
  RESEARCH_PROJECT_IDS,
  RESEARCH_PROJECTS,
  groundSlots,
  hangarCapacity,
} from '@astera/rules';
import type { PlanetView } from '../src/api/schemas.js';

/**
 * ONE PLANET FIXTURE, FOR EVERY TEST THAT NEEDS ONE.
 *
 * There were five hand-rolled copies of this object across the suite, each a
 * slightly different snapshot of `GET /api/planet` taken on the day its test was
 * written. Two problems came out of that, and both are the reason this file exists:
 *
 *  · ADDING A FIELD TO THE PAYLOAD BROKE FIVE FILES, so the cheap fix was always
 *    to paste the field into five places rather than to think about it once.
 *  · THE COPIES DRIFTED. A fixture is a claim about what the server sends, and
 *    five claims that disagree are four tests running against a world that does
 *    not exist. `contract.test.ts` is what proves the shape is real; this is what
 *    keeps every unit test pointed at that same shape.
 *
 * Everything is overridable, and the defaults describe a NEW COMMANDER — a fresh
 * planet with the opening grant spent, because that is the state most interface
 * decisions are made from and the one most likely to be got wrong.
 */
export function planetView(
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView {
  return {
    planet: {
      id: 'p1',
      name: 'Kestrel-12',
      position: { x: 0, y: 0, z: 0 },
      alloy: 500,
      crystal: 120,
      deuterium: 0,
      alloyCap: 2000,
      crystalCap: 600,
      deuteriumCap: 300,
      alloyPerHour: 116,
      crystalPerHour: 40,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      bufferAlloyCap: 1160,
      bufferCrystalCap: 398,
      bufferDeuteriumCap: 199,
      vaultFloor: 600,
      vaultProtected: { alloy: 500, crystal: 100, deuterium: 0 },
      vaultCapacity: { alloy: 500, crystal: 100, deuterium: 0 },
      shield: 0,
      shieldMax: 0,
      shieldPerHour: 0,
      disruptedUntil: null,
      ...stock,
    },
    buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0, HANGAR: 0 },
    nextCosts: {},
    instruments: {},
    instrumentCosts: {},
    orbit: [],
    orbitSlots: 1,
    satelliteCosts: {},
    research: RESEARCH_PROJECT_IDS.map((id) => ({
      id,
      cost: RESEARCH_PROJECTS[id].costAt(1),
      discovered: false,
      completed: false,
      completedAt: null,
      available: false,
      availableAt: new Date('2999-01-01T00:00:00.000Z'),
      prerequisite: RESEARCH_PROJECTS[id].prerequisite,
    })),
    fleet: { WASP: 12 },
    ground: {},
    /** Craft that are off the planet. Empty by default: nothing is in the air. */
    fleetAway: {},
    flight: { used: 0, total: 3 },
    capacity: {
      hangar: hangarCapacity(0),
      hangarUsed: 12,
      ground: groundSlots(1),
      groundUsed: 0,
    },
    score: { wealth: 0, dominion: 0 },
    ...over,
  };
}
