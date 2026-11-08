import { RESEARCH_PROJECTS, SHIELD, STARTER, hangarLoad, moduleStage, vesselAegisHp, type VesselModule, type VesselProgress } from '@astera/rules';
import { researchProjectId, type PlanetView } from '../api/schemas.js';
import type { VesselView } from '../api/starterSchemas.js';
import { planetOf } from '../onboarding/world.js';

const INSTRUMENTS: ReadonlySet<string> = new Set<VesselModule>(['TELESCOPE', 'RADAR', 'AEGIS']);

const timed = (order: VesselView['queue'][number], slot: number) => ({
  id: order.id, slot, subject: order.subject, count: order.count, startedAt: order.startedAt, finishesAt: order.readyAt, cost: order.cost,
});

/**
 * A SHIP, AS THE SCREENS THAT KNOW ABOUT PLANETS READ IT. Plan §5.7.
 *
 * The repair stage is the level the main rules are told about, so rates, ceilings and the vault come
 * from the rules that will still hold after the landing. `planetOf` already fills every field from
 * those rules, for a world that does not exist; only what is this ship's own goes on top. The real
 * schema is the contract: `starter-adapter` parses this through it, so a new required field breaks a
 * test rather than a screen.
 */
export function vesselToPlanetView(vessel: VesselView): PlanetView {
  const progress: VesselProgress = { modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel };
  const stage = (module: VesselModule): number => moduleStage(progress, module);
  const hangar = stage('HANGAR');
  const shieldMax = vesselAegisHp(stage('AEGIS'));

  const ordersIn = (queue: VesselView['queue'][number]['queue']) => vessel.queue.filter(order => order.queue === queue);
  const researching = ordersIn('RESEARCH');
  const lab = vessel.features.includes('research');

  const world = planetOf({
    output: STARTER.outputMult,
    reserved: { id: vessel.id, name: vessel.name, slotIndex: 0, position: vessel.position },
    buildings: {
      CORE: 1,
      REFINERY: stage('REFINERY'),
      EXTRACTOR: stage('EXTRACTOR'),
      VAULT: stage('VAULT'),
      SHIPYARD: stage('SHIPYARD'),
      DEUTERIUM_PLANT: stage('DEUTERIUM_PLANT'),
      HANGAR: hangar,
    },
    alloy: vessel.alloy,
    crystal: vessel.crystal,
    deuterium: vessel.deuterium,
    queues: {
      CONSTRUCTION: ordersIn('CONSTRUCTION').map((order, slot) => ({
        ...timed(order, slot),
        queue: 'CONSTRUCTION' as const,
        kind: INSTRUMENTS.has(order.subject) ? 'INSTRUMENT' as const : 'BUILDING' as const,
      })),
      YARD: ordersIn('YARD').map((order, slot) => ({ ...timed(order, slot), queue: 'YARD' as const, kind: 'HULL' as const })),
      REPAIR: ordersIn('DOCK').map((order, slot) => ({ ...timed(order, slot), queue: 'REPAIR' as const, kind: 'REPAIR' as const })),
    },
    intents: [],
  });

  return {
    ...world,
    vessel,
    planet: {
      ...world.planet,
      kind: 'CAPITAL',
      bufferAlloy: vessel.bufferAlloy,
      bufferCrystal: vessel.bufferCrystal,
      bufferDeuterium: vessel.bufferDeuterium,
      shield: vessel.shield,
      shieldMax,
      shieldPerHour: Math.round(shieldMax * SHIELD.regenPerHour),
      recoveryUntil: vessel.recoveryUntil,
    },
    instruments: { TELESCOPE: stage('TELESCOPE'), RADAR: stage('RADAR'), AEGIS: stage('AEGIS'), VEIL: 0 },
    research: !lab ? [] : STARTER.research.projects.map((id): PlanetView['research'][number] => {
      const level = vessel.research[id] ?? 0;
      return {
        id,
        level,
        maxLevel: STARTER.research.maxLevel,
        cost: RESEARCH_PROJECTS[id].costAt(Math.min(level + 1, STARTER.research.maxLevel)),
        discovered: true,
        completed: level >= STARTER.research.maxLevel,
        completedAt: null,
        available: level < STARTER.research.maxLevel,
        availableAt: vessel.galaxy.epoch,
        prerequisite: null,
        prerequisiteMet: true,
      };
    }),
    researchQueue: researching.map((order, slot) => ({
      id: order.id, slot, projectId: researchProjectId.parse(order.subject), level: order.stage,
      startedAt: order.startedAt, finishesAt: order.readyAt, cost: order.cost,
    })),
    researchCore: 1,
    fleet: vessel.fleet,
    fleetDamage: vessel.damage,
    fleetAway: {},
    flight: { used: vessel.flying, total: STARTER.attackBays[Math.max(0, Math.min(hangar, STARTER.attackBays.length) - 1)]! },
    capacity: { hangar: hangar > 0 ? STARTER.hangarRoom[hangar - 1] ?? 0 : 0, hangarUsed: hangarLoad(vessel.fleet), hangarCeiling: STARTER.hangarRoom.length, ground: 0, groundUsed: 0 },
    score: { wealth: 0, dominion: 0 },
    academyStep: null,
  };
}
