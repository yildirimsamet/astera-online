import {
  ACADEMY_STEPS, academyCheckpoint, buildingCost, buildMinutes, HULLS,
  instrumentCost, shipMinutes, hangarLoad, hangarCapacity, groundSlots, shieldHp, SHIELD, wealth,
  type AcademyCheckpoint, type AcademyStepId,
  academyFuel, academyPirateBattle, academyPirateLoot, academyRaidBattle, academyRaidLoot,
  ACADEMY_LEG_SECONDS, academyLessonFleet, academyOrderSeconds, fleetEntries, flightSlots, type Fleet,
  RESEARCH_PROJECT_IDS, RESEARCH_PROJECTS, researchAvailable,
} from '@astera/rules';
import type { ServerBuildOrderView, PlanetView, Preview, BattleReport } from '../api/schemas.js';
import { openWorld, planetOf } from './world.js';
import { ACADEMY_TARGET_ID } from './academyViews.js';

/** D172. A private, clock-driven exercise. Never reads or writes a live account.
 * Checkpoints are authored in shared rules; only the completed index may travel
 * to claim. Pending work is paid at commitment and cannot advance early.
 */
export interface AcademyWorld {
  preview: Preview;
  step: number;
  checkpoint: AcademyCheckpoint;
  pending: { endsAt: number; order: ServerBuildOrderView } | null;
  flight: AcademyFlight | null;
  journeys: AcademyFlight[];
  reports: BattleReport[];
  seenSignals: string[];
  /**
   * The sight lesson's sphere has been open long enough to put a world in it.
   * Set by the beat a second after the switch, read only while that beat runs.
   */
  sightDemo?: boolean;
}

export interface AcademyFlight {
  kind: 'pirate' | 'mine' | 'raid';
  id: string;
  fleet: Fleet;
  departAt: number;
  arriveAt: number;
  returnAt: number;
  homeAt: number;
}

export function academyPreview(now: number): Preview {
  const reserved = {
    id: 'academy-home', name: 'Academy', slotIndex: 0,
    position: { x: 180, y: 0, z: 0 },
  };
  return {
    reserved,
    season: {
      seasonId: 'academy', shard: 'ACADEMY', seed: 1, status: 'ACTIVE',
      startsAt: new Date(now), endsAt: new Date(now + 86_400_000),
      playerCap: 1, players: 1,
    },
    galaxy: {
      you: { planetId: reserved.id, playerId: 'academy-commander' },
      planets: [{
        id: reserved.id, name: reserved.name, owner: 'academy-commander',
        position: reserved.position, coreTier: 1, coreLevel: 1,
        intel: 'RESOLVED', state: { kind: 'NORMAL' },
        satellites: [], shielded: false, isSelf: true,
      }],
    },
    traffic: { contacts: [] },
    shard: { code: 'ACADEMY', name: 'Academy', planets: 1, capacity: 1, online: 1 },
  };
}

export function openAcademy(now: number, step = 0): AcademyWorld {
  return { preview: academyPreview(now), step, checkpoint: academyCheckpoint(step), pending: null, flight: null, journeys: [], reports: [], seenSignals: [] };
}

export function beginAcademyOrder(w: AcademyWorld, action: AcademyStepId, now: number): AcademyWorld {
  const step = ACADEMY_STEPS[w.step];
  if (w.pending || w.flight || step?.id !== action) throw new Error('ACADEMY_ACTION_REFUSED');
  const state = w.checkpoint;
  const clocks = { startedAt: new Date(now), finishesAt: new Date(now) };
  let order: ServerBuildOrderView;
  if ('building' in step) {
    order = {
      ...clocks, id: `academy-${step.id}`, queue: 'CONSTRUCTION', slot: 0,
      kind: 'BUILDING', subject: step.building, count: 1,
      cost: buildingCost(step.building, state.buildings[step.building]),
    };
  } else if (step.id === 'aegis') {
    order = {
      ...clocks, id: 'academy-aegis', queue: 'CONSTRUCTION', slot: 0,
      kind: 'INSTRUMENT', subject: 'AEGIS', count: 1,
      cost: instrumentCost('AEGIS', state.instruments.AEGIS),
    };
  } else {
    const hull = step.id === 'darts' || step.id === 'reinforcements' ? 'DART'
      : step.id === 'prospector' ? 'PROSPECTOR' : step.id === 'courier' ? 'COURIER' : null;
    if (!hull) throw new Error('ACADEMY_ACTION_REFUSED');
    const count = hull === 'DART' ? 2 : 1;
    order = {
      ...clocks, id: `academy-${step.id}`, queue: 'YARD', slot: 0, kind: 'HULL', subject: hull, count,
      cost: { alloy: HULLS[hull].alloy * count, crystal: HULLS[hull].crystal * count, deuterium: HULLS[hull].deuterium * count },
    };
  }
  const minutes = order.queue === 'YARD'
    ? shipMinutes(order.cost, state.buildings.SHIPYARD, {})
    : buildMinutes(order.cost, state.buildings.CORE);
  // Short authored pacing is local to Academy; live rule clocks are untouched.
  const endsAt = now + academyOrderSeconds(minutes) * 1000;
  const resources = {
    alloy: state.resources.alloy - order.cost.alloy,
    crystal: state.resources.crystal - order.cost.crystal,
    deuterium: state.resources.deuterium - order.cost.deuterium,
  };
  if (Object.values(resources).some((value) => value < 0)) throw new Error('INSUFFICIENT_RESOURCES');
  return {
    ...w, checkpoint: { ...state, resources },
    pending: { endsAt, order: { ...order, startedAt: new Date(now), finishesAt: new Date(endsAt) } },
  };
}

export function advanceAcademy(w: AcademyWorld, now: number): AcademyWorld {
  if (w.flight && now >= w.flight.homeAt) {
    const flight = w.flight;
    const reports = [...w.reports];
    if (flight.kind !== 'mine') {
      const pirate = flight.kind === 'pirate';
      const battle = pirate ? academyPirateBattle() : academyRaidBattle();
      const loot = pirate ? academyPirateLoot() : academyRaidLoot();
      reports.push({
        kind: 'BATTLE', id: `${flight.id}-report`, missionId: pirate ? null : flight.id,
        pirateRaidId: pirate ? flight.id : null,
        pirate: pirate ? { level: 1, callsign: 'AC-01', damageMult: 1, capturedHull: 'WARDEN' } : null,
        at: new Date(flight.returnAt), grade: battle.grade, rounds: battle.rounds,
        attacking: true, opponentName: pirate ? 'AC-01' : '', opponentPlanet: pirate ? '' : 'Academy II',
        opponentPlanetId: pirate ? null : ACADEMY_TARGET_ID, neutral: !pirate, yourPlanet: w.preview.reserved.name,
        yourLosses: battle.attackerLosses, theirLosses: battle.defenderLosses,
        yourFleet: flight.fleet, theirFleet: {}, lootAlloy: loot.alloy, lootCrystal: loot.crystal,
        lootDeuterium: loot.deuterium, dominion: 0, shieldAbsorbed: 0, cargoLimited: false,
        defenceSalvage: {}, disruptedMinutes: 0, wreckValue: 0,
      });
    }
    return { ...w, step: w.step + 1, checkpoint: academyCheckpoint(w.step + 1),
      flight: null, journeys: [...w.journeys, flight], reports };
  }
  if (!w.pending || now < w.pending.endsAt) return w;
  return { ...w, step: w.step + 1, checkpoint: academyCheckpoint(w.step + 1), pending: null };
}

export function beginAcademyFlight(w: AcademyWorld, kind: AcademyFlight['kind'], now: number): AcademyWorld {
  if (w.pending || w.flight || ACADEMY_STEPS[w.step]?.id !== kind) throw new Error('ACADEMY_ACTION_REFUSED');
  // Both raids read the lesson's own statement of what it sends. This line held a
  // second copy of the pirate wing (`{ DART: 2 }`) — the same drift that had the
  // raid lesson demanding two Darts while three were standing.
  const fleet: Fleet = kind === 'mine' ? { PROSPECTOR: 1 } : { ...academyLessonFleet(kind) };
  for (const [id, count] of fleetEntries(fleet)) {
    if ((w.checkpoint.fleet[id] ?? 0) < count) throw new Error('ACADEMY_ACTION_REFUSED');
  }
  const fuel = kind === 'mine' ? 0 : academyFuel(kind);
  if (w.checkpoint.resources.deuterium < fuel) throw new Error('INSUFFICIENT_RESOURCES');
  const arriveAt = now + ACADEMY_LEG_SECONDS * 1000;
  const returnAt = arriveAt + (kind === 'mine' ? 0 : 10_000);
  return { ...w, checkpoint: { ...w.checkpoint,
    resources: { ...w.checkpoint.resources, deuterium: w.checkpoint.resources.deuterium - fuel } },
    flight: { id: `academy-${kind}`, kind, fleet, departAt: now, arriveAt, returnAt, homeAt: returnAt + ACADEMY_LEG_SECONDS * 1000 } };
}

/** Informational lessons and explicit reward claims; exercises need their action. */
export function completeAcademyLesson(w: AcademyWorld, action: AcademyStepId): AcademyWorld {
  const step = ACADEMY_STEPS[w.step];
  if (w.pending || w.flight || step?.id !== action || 'building' in step ||
    ['aegis', 'darts', 'prospector', 'reinforcements', 'courier', 'pirate', 'mine', 'raid', 'telescope'].includes(action)) {
    throw new Error('ACADEMY_ACTION_REFUSED');
  }
  return { ...w, step: w.step + 1, checkpoint: academyCheckpoint(w.step + 1) };
}

export function academyPlanet(w: AcademyWorld): PlanetView {
  const state = w.checkpoint;
  const order = w.pending?.order;
  const planet = planetOf({
    ...openWorld(w.preview), buildings: state.buildings, ...state.resources,
    queues: {
      CONSTRUCTION: order?.queue === 'CONSTRUCTION' ? [order] : [],
      YARD: order?.queue === 'YARD' ? [order] : [],
    },
  });
  const shield = shieldHp(state.instruments.AEGIS);
  const fleet = { ...state.fleet };
  for (const [id, count] of fleetEntries(w.flight?.fleet ?? {})) fleet[id] = (fleet[id] ?? 0) - count;
  return {
    ...planet,
    planet: { ...planet.planet, shield, shieldMax: shield, shieldPerHour: Math.round(shield * SHIELD.regenPerHour),
      bufferAlloy: state.buffer.alloy, bufferCrystal: state.buffer.crystal, bufferDeuterium: state.buffer.deuterium },
    instruments: { ...planet.instruments, ...state.instruments },
    research: RESEARCH_PROJECT_IDS.map((id) => {
      const project = RESEARCH_PROJECTS[id];
      const discovered = !['ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES', 'DEATH_STAR_PROTOCOL'].includes(id);
      return { id, level: 0, nextLevel: 1, maxLevel: project.maxLevel, cost: project.costAt(1),
        completed: false, completedAt: null, discovered,
        available: discovered && project.prerequisite === null && researchAvailable(id, 0),
        prerequisite: project.prerequisite, prerequisiteMet: project.prerequisite === null,
        availableAt: new Date(w.preview.season.startsAt.getTime() + project.availableAtMinutes * 60_000),
      };
    }),
    instrumentCosts: { ...planet.instrumentCosts, AEGIS: instrumentCost('AEGIS', state.instruments.AEGIS) },
    fleet,
    fleetAway: { ...w.flight?.fleet },
    flight: { used: w.flight ? 1 : 0, total: flightSlots(state.buildings.CORE) },
    score: {
      ...planet.score,
      wealth: wealth({
        buildings: state.buildings, instruments: state.instruments, satellites: [],
        fleet: state.fleet, ground: {},
        alloy: state.resources.alloy + (order?.cost.alloy ?? 0),
        crystal: state.resources.crystal + (order?.cost.crystal ?? 0),
        deuterium: state.resources.deuterium + (order?.cost.deuterium ?? 0),
      }),
    },
    capacity: {
      hangar: hangarCapacity(state.buildings.HANGAR), hangarUsed: hangarLoad(state.fleet),
      ground: groundSlots(state.buildings.CORE), groundUsed: 0,
    },
  };
}
