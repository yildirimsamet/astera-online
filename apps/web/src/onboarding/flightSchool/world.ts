import {
  START_BUILDINGS, HULLS, PROSPECTOR, PROBE, buildingCost, instrumentCost, satelliteCost,
  sensorSphere, sensorReach, coreTier, distance, shieldHp, groundLoad, groundSlots, hangarCapacity, hangarLoad,
  interceptAsteroid, claimOre, missionFuel, resolveCombat, mulberry32, computeLoot, fleetCargo,
  engagementEndsAt, visualLeg, worldRadius, orbitStandoff, type BuildingId, type Fleet, type Resources, type InstrumentId, type AsteroidSpec, type Vec3,
} from '@astera/rules';
import type { BattleReport, GalaxyView, PlanetView, ServerBuildOrderView } from '../../api/schemas.js';
import { galaxySchema } from '../../api/schemas.js';
import { academyPlanet, academyPreview } from '../academyWorld.js';
import { nextSchoolScene, sceneById, type SchoolSceneId } from './scenes.js';
import { SCHOOL_REVEAL_MS } from './visualStory.js';

export const SCHOOL_HOME = 'academy-home';
export const SCHOOL_TARGET = 'school-target';
export const SCHOOL_ROCK = 'school_asteroid'.padEnd(22, '0');
export const SCHOOL_MINING_SPEED = 6000;
export const SCHOOL_RAID: Fleet = { DART: 30, COURIER: 2 };
export const SCHOOL_DEFENDER: Fleet = { DART: 5, THORN: 1 };
export const SCHOOL_INVADER: Fleet = { RAMPART: 12 };
const HOME: Vec3 = { x: 180, y: 0, z: 0 };
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const add = (a: Resources, b: Resources): Resources => ({ alloy: a.alloy + b.alloy, crystal: a.crystal + b.crystal, deuterium: a.deuterium + b.deuterium });
const take = (a: Resources, b: Resources): Resources => {
  const result = { alloy: a.alloy - b.alloy, crystal: a.crystal - b.crystal, deuterium: a.deuterium - b.deuterium };
  if (Object.values(result).some(n => n < 0)) throw new Error('INSUFFICIENT_RESOURCES');
  return result;
};

export interface SchoolFlight {
  kind: 'mine' | 'probe' | 'raid' | 'defend';
  departAt: number; arriveAt: number; turnAt: number; homeAt: number;
  from: Vec3; to: Vec3; fleet: Fleet;
}
export interface SchoolWorld {
  version: 1;
  startedAt: number;
  sceneAt: number;
  scene: SchoolSceneId;
  buildings: Record<BuildingId, number>;
  instruments: Record<InstrumentId, number>;
  uplink: boolean;
  resources: Resources;
  reserve: Resources;
  buffer: Resources;
  producedAt: number;
  shield: number | null;
  fleet: Fleet;
  ground: Fleet;
  pending: (ServerBuildOrderView & { startedAt: Date; finishesAt: Date }) | null;
  flight: SchoolFlight | null;
  journeys: SchoolFlight[];
  reports: BattleReport[];
  probeAt: number | null;
  watching: boolean;
  previewLevel: number | null;
  reach: { from: number; to: number; at: number; radar?: boolean } | null;
}

export function createSchool(now: number): SchoolWorld {
  return {
    version: 1, startedAt: now, sceneAt: now, scene: 'welcome', buildings: { ...START_BUILDINGS },
    instruments: { TELESCOPE: 0, RADAR: 0, AEGIS: 0, VEIL: 0 }, uplink: false,
    // An explicitly labelled finite exercise budget, never accepted by claim.
    resources: { alloy: 1000, crystal: 250, deuterium: 50 },
    reserve: { alloy: 44_000, crystal: 15_750, deuterium: 550 },
    buffer: { alloy: 120, crystal: 50, deuterium: 0 }, producedAt: now, shield: null, fleet: {}, ground: {},
    pending: null, flight: null, journeys: [], reports: [], probeAt: null, watching: false, previewLevel: null, reach: null,
  };
}
export const schoolScene = (w: SchoolWorld) => sceneById(w.scene);
export const schoolTargetPosition = (): Vec3 => ({ x: HOME.x + neighbours[0].x, y: 0, z: neighbours[0].z });
export const schoolThreatHold = (): Vec3 => ({ x: HOME.x + 1000, y: 0, z: -1300 });

/** Release only the next exercise's shortfall from the finite training budget.
 * Large batches may temporarily exceed storage, as grants can in the live game;
 * the two collection exercises always retain normal free storage space. */
function enterScene(w: SchoolWorld): SchoolWorld {
  const scene = schoolScene(w);
  let cost: Resources = zero();
  const b = (['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT', 'HANGAR'] as const).find(id => id === scene.subject);
  const instrument = (['TELESCOPE', 'RADAR', 'AEGIS'] as const).find(id => id === scene.subject);
  const hull = Object.values(HULLS).find(h => h.id === scene.subject);
  if (b) cost = buildingCost(b, w.buildings[b]);
  else if (instrument) cost = instrumentCost(instrument, w.instruments[instrument]);
  else if (scene.subject === 'UPLINK') cost = satelliteCost('UPLINK');
  else if (hull) cost = { alloy: hull.alloy * (scene.count ?? 1), crystal: hull.crystal * (scene.count ?? 1), deuterium: hull.deuterium * (scene.count ?? 1) };
  else if (scene.kind === 'probe') cost = { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 };
  else if (scene.kind === 'raid') cost.deuterium = missionFuel(SCHOOL_RAID, distance(HOME, schoolTargetPosition()), 2);
  const grant = { alloy: Math.max(0, cost.alloy - w.resources.alloy), crystal: Math.max(0, cost.crystal - w.resources.crystal), deuterium: Math.max(0, cost.deuterium - w.resources.deuterium) };
  return { ...w, resources: add(w.resources, grant), reserve: take(w.reserve, grant) };
}

export function schoolPlanet(w: SchoolWorld): PlanetView {
  const base = academyPlanet({
    preview: academyPreview(w.startedAt), step: 0,
    checkpoint: { buildings: w.buildings, instruments: w.instruments, satellites: w.uplink ? ['UPLINK'] : [],
      fleet: w.fleet, builtEver: w.fleet, resources: w.resources, buffer: w.buffer,
      claimedRewards: [], progress: { PIRATE: 0, MINE: 0, RAID: 0 }, queue: null },
    pending: w.pending ? { endsAt: w.pending.finishesAt.getTime(), order: w.pending } : null,
    flight: null, journeys: [], reports: w.reports, seenSignals: [],
  });
  const fleet = { ...w.fleet };
  if (w.flight && w.flight.kind !== 'defend') for (const [id, count] of Object.entries(w.flight.fleet)) {
    if (id in HULLS) {
      const hull = Object.values(HULLS).find(h => h.id === id);
      if (hull) fleet[hull.id] = (fleet[hull.id] ?? 0) - count;
    }
  }
  return { ...base, planet: { ...base.planet, name: 'Aurora', shield: w.shield ?? base.planet.shield }, fleet, ground: w.ground, fleetAway: w.flight?.kind !== 'defend' ? w.flight?.fleet ?? {} : {},
    capacity: { ...base.capacity, ground: groundSlots(w.buildings.CORE), groundUsed: groundLoad(w.ground) },
    instrumentCosts: Object.fromEntries(Object.keys(w.instruments).flatMap(id => {
      const type = (['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL'] as const).find(value => value === id);
      return type ? [[type, instrumentCost(type, w.instruments[type])]] : [];
    })),
  };
}

const neighbours = [
  { id: SCHOOL_TARGET, name: 'Lyra', x: -100, z: 1400, level: 3, orbit: [] },
  { id: 'school-2', name: 'Vega', x: 1750, z: 200, level: 6, orbit: ['UPLINK'] },
  { id: 'school-3', name: 'Altair', x: -1050, z: -1150, level: 15, orbit: ['UPLINK', 'FOUNDRY'] },
  { id: 'school-4', name: 'Deneb', x: 0, z: -2430, level: 7, orbit: ['FOUNDRY'] },
  { id: 'school-5', name: 'Mira', x: 2200, z: -1200, level: 12, orbit: ['UPLINK', 'BEACON'] },
  { id: 'school-6', name: 'Rigel', x: -2350, z: 1400, level: 4, orbit: [] },
  { id: 'school-7', name: 'Sirius', x: 1700, z: 2650, level: 16, orbit: ['UPLINK', 'DERRICK'] },
  { id: 'school-8', name: 'Arcturus', x: -2200, z: -2700, level: 9, orbit: ['UPLINK'] },
] as const;

export function schoolExampleLeg() {
  const altair = neighbours.find(p => p.id === 'school-3')!;
  const origin = schoolTargetPosition(), destination = { x: HOME.x + altair.x, y: 0, z: altair.z };
  return { ...visualLeg(origin, destination, orbitStandoff(worldRadius(3)), orbitStandoff(worldRadius(altair.level))), origin, destination };
}

export function schoolGalaxy(w: SchoolWorld, now?: number): GalaxyView {
  const sensor = sensorSphere(HOME, w.previewLevel ?? w.instruments.TELESCOPE, w.instruments.RADAR, SCHOOL_HOME);
  if (w.reach && now !== undefined) {
    const t = Math.max(0, Math.min(1, (now - w.reach.at) / SCHOOL_REVEAL_MS));
    sensor[w.reach.radar ? 'detect' : 'identify'] = w.reach.from + (w.reach.to - w.reach.from) * (t * t * (3 - 2 * t));
  }
  return galaxySchema.parse({
    you: { planetId: SCHOOL_HOME, playerId: 'academy-commander' }, sensors: [{ ...sensor,
      telescope: (w.previewLevel ?? w.instruments.TELESCOPE) > 0
        && !(w.reach && !w.reach.radar && w.reach.from === sensorReach(0) && now !== undefined && now < w.reach.at) }],
    planets: [
      { id: SCHOOL_HOME, name: 'Aurora', owner: '', position: HOME,
        kind: 'CAPITAL', coreLevel: w.buildings.CORE, coreTier: coreTier(w.buildings.CORE),
        intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: w.uplink ? ['UPLINK'] : [],
        shielded: (w.shield ?? shieldHp(w.instruments.AEGIS)) > 0, isSelf: true },
      ...neighbours.map(p => {
        const position = { x: HOME.x + p.x, y: 0, z: p.z };
        if (distance(HOME, position) > sensor.identify) return { id: p.id, position, intel: 'UNKNOWN' as const, isSelf: false };
        return { id: p.id, position, name: p.name, owner: p.name,
          kind: 'CAPITAL' as const,
          controller: { kind: 'PLAYER', playerId: `commander-${p.id}`, displayName: p.name },
          coreLevel: p.level, coreTier: coreTier(p.level), intel: 'RESOLVED' as const,
          state: { kind: 'NORMAL' as const }, satellites: [...p.orbit], shielded: p.level >= 10, isSelf: false,
          ...(w.watching && p.id === SCHOOL_TARGET ? { fleet: { status: 'HOME', staleMinutes: 0, etaMinutes: null, clarity: 'FULL' } } : {}),
        };
      }),
    ],
  });
}

export function schoolRock(w: SchoolWorld, now = w.startedAt): Omit<AsteroidSpec, 'index'> & { id: string; oreRemaining: number; active: boolean } {
  const taken = w.journeys.some(f => f.kind === 'mine') || (w.flight?.kind === 'mine' && now >= w.flight.arriveAt);
  return { id: SCHOOL_ROCK, radius: 800, period: 4, phase: 0.4, inclination: 0.15,
    ascendingNode: 0, speed: 2 * Math.PI * 800 / 4, level: 1, ore: 120, oreRemaining: taken ? Math.max(0, 120 - claimOre(120, PROSPECTOR.hold, 0.3, 0).taken) : 120,
    // Reading the exercise never runs its target out of time. Both the visible
    // field and dispatch solve receive this same twenty-minute exercise window.
    crystalShare: 0.3, appearsAt: 0, expiresAt: (now - w.startedAt) / 60_000 + 20, active: true, isotopeRich: false, deuteriumShare: 0 };
}

export type SchoolAction = { kind: 'continue' | 'home' | 'collect' | 'watch' | 'mine' | 'probe' | 'raid' | 'defend' }
  | { kind: 'order'; subject: string; count: number }
  | { kind: 'range'; level: number | null };

export function schoolAction(w: SchoolWorld, action: SchoolAction, now: number): SchoolWorld {
  const scene = schoolScene(w);
  if (w.pending || w.flight) throw new Error('QUEUE_FULL');
  const next = (): SchoolWorld => enterScene({ ...w, scene: nextSchoolScene(w.scene), sceneAt: now, previewLevel: null, reach: null });
  if (action.kind === 'continue' && (scene.kind === 'read' || scene.kind === 'report' || scene.kind === 'range')) return next();
  if (action.kind === 'home' && scene.kind === 'home') return next();
  if (action.kind === 'range' && scene.kind === 'range') {
    if (action.level !== null && (!Number.isInteger(action.level) || action.level < 1 || action.level > 5)) throw new Error('ACADEMY_ACTION_REFUSED');
    return { ...w, previewLevel: action.level, reach: { from: schoolGalaxy(w, now).sensors?.[0]?.identify ?? sensorReach(1),
      to: sensorReach(action.level ?? w.instruments.TELESCOPE), at: now + 2000 } };
  }
  if (action.kind === 'watch' && scene.kind === 'watch') return { ...next(), watching: true };
  if (action.kind === 'collect' && scene.kind === 'collect') {
    const p = schoolPlanet(w).planet;
    const moved = { alloy: Math.min(w.buffer.alloy, Math.max(0, p.alloyCap - w.resources.alloy)),
      crystal: Math.min(w.buffer.crystal, Math.max(0, p.crystalCap - w.resources.crystal)),
      deuterium: Math.min(w.buffer.deuterium, Math.max(0, p.deuteriumCap - w.resources.deuterium)) };
    return enterScene({ ...w, scene: nextSchoolScene(w.scene), sceneAt: now, resources: add(w.resources, moved), buffer: take(w.buffer, moved) });
  }
  if (action.kind === 'order' && scene.kind === 'order' && action.subject === scene.subject && action.count === (scene.count ?? 1)) {
    const building = (Object.keys(START_BUILDINGS)).find(id => id === action.subject);
    let order: NonNullable<SchoolWorld['pending']>;
    const common = { id: `school-${w.scene}`, slot: 0, count: action.count, subject: action.subject,
      startedAt: new Date(now), finishesAt: new Date(now + 3000) };
    const b = (['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT', 'HANGAR'] as const).find(id => id === building);
    const instrument = (['TELESCOPE', 'RADAR', 'AEGIS'] as const).find(id => id === action.subject);
    const hull = Object.values(HULLS).find(h => h.id === action.subject);
    if (b) {
      if (b !== 'CORE' && b !== 'HANGAR' && w.buildings[b] >= w.buildings.CORE) throw new Error('CORE_CEILING');
      order = { ...common, kind: 'BUILDING', queue: 'CONSTRUCTION', cost: buildingCost(b, w.buildings[b]) };
    } else if (instrument) {
      if (instrument !== 'AEGIS' && !w.uplink) throw new Error('UPLINK_REQUIRED');
      order = { ...common, kind: 'INSTRUMENT', queue: 'CONSTRUCTION', cost: instrumentCost(instrument, w.instruments[instrument]) };
    } else if (action.subject === 'UPLINK') {
      order = { ...common, kind: 'SATELLITE', queue: 'CONSTRUCTION', cost: satelliteCost('UPLINK') };
    } else if (hull) {
      if (w.buildings.SHIPYARD < hull.minShipyard) throw new Error('SHIPYARD_TOO_LOW');
      const additions = { [hull.id]: (w.fleet[hull.id] ?? 0) + action.count };
      if (!hull.ground && hangarLoad({ ...w.fleet, ...additions }) > hangarCapacity(w.buildings.HANGAR)) throw new Error('HANGAR_FULL');
      if (hull.ground && groundLoad({ ...w.ground, [hull.id]: action.count }) > groundSlots(w.buildings.CORE)) throw new Error('GROUND_SLOTS_FULL');
      order = { ...common, kind: 'HULL', queue: 'YARD', cost: { alloy: hull.alloy * action.count, crystal: hull.crystal * action.count, deuterium: hull.deuterium * action.count } };
    } else throw new Error('ACADEMY_ACTION_REFUSED');
    return { ...w, pending: order, resources: take(w.resources, order.cost) };
  }
  if ((action.kind === 'mine' || action.kind === 'probe' || action.kind === 'raid' || action.kind === 'defend') && action.kind === scene.kind) {
    const kind = action.kind;
    const fleet: Fleet = kind === 'mine' ? { PROSPECTOR: 1 } : kind === 'raid' ? { ...SCHOOL_RAID } : kind === 'defend' ? { ...SCHOOL_INVADER } : {};
    if (kind !== 'defend' && Object.values(HULLS).some(h => (fleet[h.id] ?? 0) > (w.fleet[h.id] ?? 0))) throw new Error('INSUFFICIENT_SHIPS');
    let to = kind === 'defend' ? HOME : schoolTargetPosition();
    let leg = 6500;
    if (kind === 'mine') {
      // Same orbit and interception solver as the live mining lane. Compress the
      // orbit AND craft speed together: the meeting point stays on that orbit.
      const intercept = interceptAsteroid(HOME, SCHOOL_MINING_SPEED, { ...schoolRock(w, now), index: 0 }, (now - w.startedAt) / 60_000);
      if (!intercept) throw new Error('ASTEROID_UNREACHABLE');
      to = intercept.at;
      leg = intercept.flightMinutes * 60_000;
    }
    const fuel = kind === 'raid' ? missionFuel(fleet, distance(HOME, to), 2) : 0;
    const cost = kind === 'probe' ? { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 } : { ...zero(), deuterium: fuel };
    const arriveAt = now + leg;
    const turnAt = kind === 'raid' || kind === 'defend' ? engagementEndsAt(arriveAt) : arriveAt;
    return { ...w, resources: take(w.resources, cost), flight: { kind, fleet, from: kind === 'defend' ? schoolThreatHold() : HOME,
      to, departAt: now, arriveAt, turnAt, homeAt: kind === 'defend' ? turnAt : turnAt + leg * (kind === 'mine' ? 2 : 1) } };
  }
  throw new Error('ACADEMY_ACTION_REFUSED');
}

export function tickSchool(w: SchoolWorld, now: number): SchoolWorld {
  const until = w.pending ? Math.min(now, w.pending.finishesAt.getTime()) : now;
  if (until - w.producedAt >= 5000 || (w.pending && now >= w.pending.finishesAt.getTime() && until > w.producedAt)) {
    const p = schoolPlanet(w).planet, hours = (until - w.producedAt) / 3_600_000;
    w = { ...w, producedAt: until, buffer: {
      alloy: Math.min(p.bufferAlloyCap, w.buffer.alloy + p.alloyPerHour * hours),
      crystal: Math.min(p.bufferCrystalCap, w.buffer.crystal + p.crystalPerHour * hours),
      deuterium: Math.min(p.bufferDeuteriumCap, w.buffer.deuterium + (p.deuteriumPerHour ?? 0) * hours),
    } };
  }
  if (w.reach && now >= w.reach.at + SCHOOL_REVEAL_MS) w = { ...w, reach: null };
  const order = w.pending;
  if (order && now >= order.finishesAt.getTime()) {
    const result = { ...w, scene: nextSchoolScene(w.scene), sceneAt: order.finishesAt.getTime(), pending: null };
    const b = (['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'DEUTERIUM_PLANT', 'HANGAR'] as const).find(id => id === order.subject);
    const instrument = (['TELESCOPE', 'RADAR', 'AEGIS'] as const).find(id => id === order.subject);
    const hull = Object.values(HULLS).find(h => h.id === order.subject);
    if (b) result.buildings = { ...w.buildings, [b]: w.buildings[b] + 1 };
    else if (instrument) {
      result.instruments = { ...w.instruments, [instrument]: w.instruments[instrument] + 1 };
      if (instrument === 'TELESCOPE') result.reach = { from: sensorReach(w.instruments.TELESCOPE), to: sensorReach(w.instruments.TELESCOPE + 1), at: order.finishesAt.getTime() + 2000 };
      if (instrument === 'RADAR') result.reach = { from: 0, to: sensorSphere(HOME, w.instruments.TELESCOPE, w.instruments.RADAR + 1).detect, at: order.finishesAt.getTime() + 2000, radar: true };
    }
    else if (order.subject === 'UPLINK') result.uplink = true;
    else if (hull?.ground) result.ground = { ...w.ground, [hull.id]: (w.ground[hull.id] ?? 0) + order.count };
    else if (hull) result.fleet = { ...w.fleet, [hull.id]: (w.fleet[hull.id] ?? 0) + order.count };
    return tickSchool(enterScene(result), now);
  }
  const flight = w.flight;
  if (!flight || now < flight.homeAt) return w;
  const result = { ...w, flight: null, scene: nextSchoolScene(w.scene), sceneAt: flight.homeAt, journeys: [...w.journeys, flight] };
  if (flight.kind === 'probe') return { ...result, probeAt: flight.homeAt };
  if (flight.kind === 'mine') {
    const ore = claimOre(120, PROSPECTOR.hold, 0.3, 0);
    return { ...result, buffer: add(w.buffer, { alloy: ore.alloy, crystal: ore.crystal, deuterium: ore.deuterium }) };
  }
  const defending = flight.kind === 'defend';
  const defender = defending ? { ...w.fleet, ...w.ground } : SCHOOL_DEFENDER;
  const attacker = defending ? SCHOOL_INVADER : SCHOOL_RAID;
  const battle = resolveCombat(attacker, defender, defending ? shieldHp(w.instruments.AEGIS) : 0, mulberry32(defending ? 31 : 12), { attacker: { tech: {} }, defender: { tech: {} } });
  const loot = defending ? zero() : computeLoot({ alloy: 1200, crystal: 400, deuterium: 30 }, zero(), zero(), battle.grade, fleetCargo(battle.attackerSurvivors, {}));
  const survivors = defending ? battle.defenderSurvivors : battle.attackerSurvivors;
  const fleet: Fleet = { ...w.fleet };
  const ground: Fleet = { ...w.ground };
  for (const h of Object.values(HULLS)) if (h.ground) {
    if (defending) ground[h.id] = survivors[h.id] ?? 0;
  } else if (h.id !== 'PROSPECTOR') fleet[h.id] = survivors[h.id] ?? 0;
  const report: BattleReport = { kind: 'BATTLE', id: `school-${flight.kind}`, missionId: `school-${flight.kind}`, pirateRaidId: null,
    pirate: null, at: new Date(flight.turnAt), grade: battle.grade, rounds: battle.rounds, attacking: !defending,
    opponentName: 'Lyra', opponentPlanet: 'Lyra', opponentPlanetId: SCHOOL_TARGET, neutral: false,
    yourPlanet: 'Aurora', yourLosses: defending ? battle.defenderLosses : battle.attackerLosses,
    theirLosses: defending ? battle.attackerLosses : battle.defenderLosses, yourFleet: defending ? defender : attacker,
    theirFleet: defending ? attacker : defender, lootAlloy: loot.alloy, lootCrystal: loot.crystal, lootDeuterium: loot.deuterium,
    dominion: 0, shieldAbsorbed: battle.rounds.reduce((sum, r) => sum + r.shieldAbsorbed, 0), cargoLimited: false, defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 0 };
  return enterScene({ ...result, fleet, ground, shield: defending ? battle.shieldLeft : w.shield, resources: add(w.resources, loot), reports: [...w.reports, report] });
}
