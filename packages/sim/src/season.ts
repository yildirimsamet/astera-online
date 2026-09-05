import {
  ABUSE,
  ALL_HULLS,
  BUILD,
  BUILDING_IDS,
  COMBAT,
  COMBAT_HULLS as RULE_COMBAT_HULLS,
  DEATH_STAR,
  DEUTERIUM,
  MULTI_WORLD,
  SETTLEMENT_CLAIM_MINUTES,
  PROSPECTOR,
  RESEARCH_PROJECT_IDS,
  RESEARCH_PROJECTS,
  activeAsteroids,
  asteroidPosition,
  claimOre,
  colonyCapacity,
  collectorCap,
  deuteriumCollectorCap,
  deuteriumRate,
  deuteriumStorageCap,
  defenceMinutes,
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  NON_COMBATANT_HULLS,
  counterMult,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  bookBattle,
  buildingCost,
  buildMinutes,
  canAttack,
  collect,
  computeLoot,
  crystalRate,
  distance,
  dominion,
  emptyLedger,
  fleetCargo,
  fleetCount,
  fleetEntries,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  fleetValue,
  garrisonOf,
  plantCeiling,
  generateGalaxy,
  groundLoad,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
  hullBuildable,
  missionFuel,
  type TechLevels,
  selectNeutralSlots,
  PLANET_START,
  START_BUILDINGS,
  investedInBuilding,
  investedInInstrument,
  instrumentMaxed,
  mulberry32,
  resolveCombat,
  instrumentCost,
  interceptAsteroid,
  isSatellite,
  productionMult,
  prospectorHold,
  prospectorReturnSpeed,
  prospectorSpeed,
  travelExact,
  researchMinutes,
  satelliteCost,
  satelliteSlots,
  seeingUnlocked,
  shieldHp,
  shipMinutes,
  storageCap,
  travelMinutes,
  worthInvesting,
  vaultProtects,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type Fleet,
  type Ledger,
  type Rng,
  type GroundHullId,
  type HullId,
  type InstrumentId,
  type InstrumentLevels,
  type MobileHullId,
  type NeutralLayout,
  type NeutralTier,
  type SatelliteId,
  type AsteroidSpec,
  type Resources,
  type ResearchProjectId,
  recoveryMinutesFor,
} from '@astera/rules';
import {
  ARCHETYPES,
  ARCHETYPE_NAMES,
  type ArchetypeName,
  type CargoHullId,
  type CombatHullId,
  type Composition,
} from './archetypes.js';
import { measure, type Invariants } from './invariants.js';

export interface SimPlayer {
  id: number;
  name: string;
  type: ArchetypeName;
  x: number; y: number; z: number;
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  /** What is in orbit. Presence is the whole state — D25. */
  orbit: SatelliteId[];
  fleet: Fleet;
  ground: Fleet;
  /** Paid work in the three independent production lanes. */
  queues: Record<SimQueueId, SimBuildOrder[]>;
  alloy: number;
  crystal: number;
  deuterium: number;
  /** Uncollected production sitting in the works. D16. */
  bufferAlloy: number;
  bufferCrystal: number;
  bufferDeuterium: number;
  shield: number;
  lastTick: number;
  joinedAt: number;
  disruptedUntil: number;
  nextLogin: number;
  ledger: Ledger;
  attacks: number[];
  scoutsSent: number;
  lootToday: number;
  lossToday: number;
  disruptedToday: number;
  wealthNow: number;
  wealthHistory: number[];
  recentHits: Map<number, number[]>;
  /** What a probe last measured: what could be carried off, and what defends it. */
  intel: Map<number, { stock: number; defence: number; composition: Fleet; at: number }>;
  neighbours: { id: number; d: number }[];
  /** Seasonal permission only; reset with this simulated world. */
  isotopeSpectrometry: boolean;
  denseFuelCells: boolean;
  graviticCharges: boolean;
  /** Rung held on the one levelled project. T5. Zero means no refinery is legal. */
  deuteriumSynthesis: number;
  /**
   * Every levelled project, in the shape the rules package reads. T8.
   *
   * The bots do not BUY the three economy ladders — nothing in the model gives a
   * bot a reason to prefer a cargo rung to another Wasp, and inventing one would
   * be modelling a player rather than measuring the game. The field is threaded
   * through so the effects are wired and empty rather than absent and forgotten,
   * which is the difference between a band that reads a game without the ladders
   * and a band that silently reads the wrong game.
   */
  tech: TechLevels;
  cargoLimitedSeen: boolean;
  shieldInsightSeen: boolean;
}

export type SimBuildKind = 'BUILDING' | 'HULL' | 'INSTRUMENT' | 'SATELLITE' | 'RESEARCH';
export type SimQueueId = 'CONSTRUCTION' | 'YARD' | 'RESEARCH';

/** The simulator's in-memory mirror of one active server build order. */
export interface SimBuildOrder {
  queue: SimQueueId;
  kind: SimBuildKind;
  subject: string;
  count: number;
  cost: Resources;
  /** Full work duration, retained like `remainingSeconds` on the server row. */
  minutes: number;
  /** Absolute season minute; all three lanes may finish independently. */
  readyAt: number;
}

export interface SimBuildProjection {
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  orbit: SatelliteId[];
  research: TechLevels;
}

export interface Mission {
  from: number;
  to: number;
  fleet: Fleet;
  arriveAt: number;
  distance: number;
  scouted: boolean;
  returning: boolean;
  loot?: Resources;
}

export interface MiningRun {
  id: number;
  playerId: number;
  asteroidIndex: number;
  craft: number;
  holdEach: number;
  arriveAt: number;
  intercept: { x: number; y: number; z: number };
  returning: boolean;
  mined?: Resources;
}

export interface SimNeutralWorld {
  id: number;
  tier: NeutralTier;
  x: number;
  y: number;
  z: number;
  controllerId: number | null;
  buildings: BuildingLevels;
  aegis: number;
  fleet: Fleet;
  alloy: number;
  crystal: number;
  deuterium: number;
  lastTick: number;
  claimUntil: number | null;
  nextReinforcement: number | null;
  recoveryUntil: number;
  protectedUntil: number;
}

export type StrategicMission =
  | {
      id: number;
      kind: 'neutral_attack';
      ownerId: number;
      targetId: number;
      arriveAt: number;
      fleet: Fleet;
      returning: boolean;
      cargo?: Resources;
    }
  | {
      id: number;
      kind: 'settlement';
      ownerId: number;
      targetId: number;
      arriveAt: number;
    }
  | {
      id: number;
      kind: 'transfer';
      ownerId: number;
      targetId: number;
      arriveAt: number;
      transportHull: CargoHullId;
      cargo: Resources;
    }
  | {
      id: number;
      kind: 'death_star';
      ownerId: number;
      targetId: number;
      arriveAt: number;
      /** Launch-time stamp: a destructive flight can never become a capture by accident. */
      captureIntent: boolean;
    };

export interface StrategicDiagnostics {
  neutralMinted: Record<NeutralTier, number>;
  neutralTaken: Record<NeutralTier, number>;
  neutralLootShare: number;
  uniqueNeutralRaiders: number;
  neutralRaids: number;
  colonizedAt: Record<NeutralTier, number[]>;
  remainingNeutral: Record<NeutralTier, number>;
  coloniesPerPlayer: number[];
  transferredResources: number;
  deathStar: {
    builds: number;
    launches: number;
    firstHits: number;
    captures: number;
    misses: number;
  };
  recoveryThirdPartyArrivals: number;
  capitalHeldDeathStarValue: number;
}

export interface DayStats {
  attacks: number;
  lootValue: number;
  attackerLossValue: number;
  defenderLossValue: number;
  disruptedMinutes: number;
  byGrade: Record<'DECISIVE' | 'PARTIAL' | 'REPELLED', number>;
  scoutedAttacks: number; scoutedGain: number; scoutedLoss: number;
  blindAttacks: number; blindGain: number; blindLoss: number;
}

export const freshStats = (): DayStats => ({
  attacks: 0, lootValue: 0, attackerLossValue: 0, defenderLossValue: 0,
  disruptedMinutes: 0,
  byGrade: { DECISIVE: 0, PARTIAL: 0, REPELLED: 0 },
  scoutedAttacks: 0, scoutedGain: 0, scoutedLoss: 0,
  blindAttacks: 0, blindGain: 0, blindLoss: 0,
});

export interface SimConfig {
  players: number;
  days: number;
  seed: number;
  /** Experiment-only redistribution; total hull prices never move. */
  hullCrystalShare?: 0.25 | 0.30 | 0.35;
  /** Balance-lab override only; omitted means the live rules price. */
  spectrometryCrystalCost?: number;
  /** Balance-lab counterfactual only; omitted models the live isotope field. */
  isotopes?: boolean;
  /** Counterfactual used only to measure the v2 layer against its unchanged baseline. */
  strategicLayer?: boolean;
  /** Balance-lab appetite override; it is not a production feature flag. */
  neutralRaidChance?: number;
  /** Balance-lab transfer appetite for commanders who already won a colony. */
  colonyTransferChance?: number;
  /**
   * Fixed regression-lab layout. Omitted always models the live D99 world.
   * This keeps the five historical 50-player seeds comparable without making
   * their deliberately small sample the production neutral layout.
   */
  neutralLayout?: NeutralLayout & { slotPool: number };
}

export type CrystalSpendCategory =
  | 'buildings'
  | 'hardware'
  | 'defence'
  | 'combat'
  | 'hauler'
  | 'prospector'
  | 'research';

export interface CrystalDiagnostics {
  capPlayerHours: number;
  medianUnused: number;
  spent: Record<CrystalSpendCategory, number>;
  spentShare: Record<CrystalSpendCategory, number>;
  mining: {
    launches: number;
    oreClaimed: number;
    alloyDelivered: number;
    crystalDelivered: number;
    deuteriumDelivered: number;
    overflowLost: number;
  };
  strategic: StrategicDiagnostics;
}

export interface World {
  players: SimPlayer[];
  missions: Mission[];
  miningRuns: MiningRun[];
  asteroids: AsteroidSpec[];
  asteroidClaims: Map<number, number>;
  nextMiningRunId: number;
  rng: Rng;
  /** Separate stream so adding mining never rewrites combat/login randomness. */
  miningRng: Rng;
  /** How long the whole season runs. Bots need it to know when to stop building. */
  totalMinutes: number;
  hullCrystalShare?: SimConfig['hullCrystalShare'];
  spectrometryCrystalCost: number;
  isotopes: boolean;
  crystalCapPlayerMinutes: number;
  crystalSpent: Record<CrystalSpendCategory, number>;
  mining: CrystalDiagnostics['mining'];
  neutrals: SimNeutralWorld[];
  strategicMissions: StrategicMission[];
  deathStars: Map<number, { status: 'BUILDING' | 'READY'; readyAt: number }>;
  deathStarProtocol: Set<number>;
  neutralRaiders: Set<number>;
  nextStrategicMissionId: number;
  strategicRng: Rng;
  strategicEnabled: boolean;
  neutralRaidChance: number;
  colonyTransferChance: number;
  strategic: Omit<StrategicDiagnostics,
    'neutralLootShare' | 'uniqueNeutralRaiders' | 'remainingNeutral'
    | 'coloniesPerPlayer' | 'capitalHeldDeathStarValue'>;
}

/* ── setup ─────────────────────────────────────────────────────── */

export function buildWorld(cfg: SimConfig): World {
  const rng = mulberry32(cfg.seed);
  const galaxy = generateGalaxy(cfg.seed, cfg.players);

  const names: ArchetypeName[] = [];
  for (const type of ARCHETYPE_NAMES) {
    const n = Math.max(1, Math.round(cfg.players * ARCHETYPES[type].share));
    for (let i = 0; i < n; i++) names.push(type);
  }
  while (names.length < cfg.players) names.push('CASUAL');
  names.length = cfg.players;

  const players: SimPlayer[] = galaxy.slots.map((slot, i) => ({
    id: i,
    name: `P${String(i).padStart(3, '0')}`,
    type: names[i] ?? 'CASUAL',
    x: slot.x, y: slot.y, z: slot.z,
    buildings: { ...START_BUILDINGS },
    instruments: {},
    orbit: [],
    // D22: no starting fleet, and the grant is what the opening costs. Mirrors
    // `joinSeason` exactly — a simulation that opens differently from the game is
    // measuring a different game.
    fleet: {},
    ground: {},
    queues: { CONSTRUCTION: [], YARD: [], RESEARCH: [] },
    alloy: PLANET_START.alloy, crystal: PLANET_START.crystal, deuterium: PLANET_START.deuterium,
    bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
    shield: 0, lastTick: 0, joinedAt: 0, disruptedUntil: 0,
    nextLogin: Math.floor(rng() * 240),
    ledger: emptyLedger(),
    attacks: [], scoutsSent: 0,
    lootToday: 0, lossToday: 0, disruptedToday: 0,
    wealthNow: 0, wealthHistory: [],
    recentHits: new Map(), intel: new Map(),
    neighbours: [],
    isotopeSpectrometry: false,
    denseFuelCells: false,
    graviticCharges: false,
    deuteriumSynthesis: 0,
    tech: {},
    cargoLimitedSeen: false,
    shieldInsightSeen: false,
  }));

  const strategicGalaxy = generateGalaxy(
    cfg.seed,
    cfg.neutralLayout?.slotPool ?? MULTI_WORLD.neutralSlotPool,
  );
  const neutrals: SimNeutralWorld[] = selectNeutralSlots(
    cfg.seed,
    strategicGalaxy.slots,
    cfg.neutralLayout,
  )
    .map((chosen) => {
      const template = MULTI_WORLD.neutral[chosen.tier];
      const alloyPerHour = alloyRate(template.buildings.REFINERY);
      const crystalPerHour = crystalRate(template.buildings.EXTRACTOR);
      return {
        id: chosen.slot.index,
        tier: chosen.tier,
        x: chosen.slot.x,
        y: chosen.slot.y,
        z: chosen.slot.z,
        controllerId: null,
        buildings: { ...template.buildings },
        aegis: chosen.tier === 3 ? 3 : 0,
        fleet: { ...template.fleet, ...template.ground },
        alloy: storageCap(alloyPerHour, template.buildings.VAULT),
        crystal: storageCap(crystalPerHour, template.buildings.VAULT),
        deuterium: deuteriumStorageCap(0, crystalPerHour, template.buildings.VAULT),
        lastTick: 0,
        claimUntil: null,
        nextReinforcement: template.reinforcementMinutes,
        recoveryUntil: 0,
        protectedUntil: 0,
      };
    });

  for (const p of players) {
    p.neighbours = players
      .filter((q) => q.id !== p.id)
      .map((q) => ({ id: q.id, d: distance(p, q) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 18);
  }

  return {
    players,
    missions: [],
    miningRuns: [],
    asteroids:
      cfg.isotopes === false
        ? galaxy.asteroids.map((rock) => ({
            ...rock,
            isotopeRich: false,
            deuteriumShare: 0,
          }))
        : galaxy.asteroids,
    asteroidClaims: new Map(),
    nextMiningRunId: 1,
    rng,
    miningRng: mulberry32((cfg.seed ^ 0x51f15e5d) >>> 0),
    totalMinutes: cfg.days * 1440,
    ...(cfg.hullCrystalShare === undefined ? {} : { hullCrystalShare: cfg.hullCrystalShare }),
    spectrometryCrystalCost:
      cfg.spectrometryCrystalCost ?? RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1).crystal,
    isotopes: cfg.isotopes ?? true,
    crystalCapPlayerMinutes: 0,
    crystalSpent: {
      buildings: 0, hardware: 0, defence: 0, combat: 0, hauler: 0, prospector: 0,
      research: 0,
    },
    mining: {
      launches: 0, oreClaimed: 0, alloyDelivered: 0, crystalDelivered: 0,
      deuteriumDelivered: 0, overflowLost: 0,
    },
    neutrals,
    strategicMissions: [],
    deathStars: new Map(),
    deathStarProtocol: new Set(),
    neutralRaiders: new Set(),
    nextStrategicMissionId: 1,
    strategicRng: mulberry32((cfg.seed ^ 0xd34db33f) >>> 0),
    strategicEnabled: cfg.strategicLayer ?? true,
    neutralRaidChance: cfg.neutralRaidChance ?? 0.02,
    colonyTransferChance: cfg.colonyTransferChance ?? 0.05,
    strategic: {
      neutralMinted: { 1: 0, 2: 0, 3: 0 },
      neutralTaken: { 1: 0, 2: 0, 3: 0 },
      neutralRaids: 0,
      colonizedAt: { 1: [], 2: [], 3: [] },
      transferredResources: 0,
      deathStar: { builds: 0, launches: 0, firstHits: 0, captures: 0, misses: 0 },
      recoveryThirdPartyArrivals: 0,
    },
  };
}

const REDISTRIBUTED_HULLS = new Set(['PIKE', 'RAMPART', 'WAYFARER', 'PROSPECTOR']);

/** Same total price, with only the alloy/crystal split changed for an experiment. */
export function redistributedHullPrice(
  id: keyof typeof HULLS,
  share?: SimConfig['hullCrystalShare'],
): Resources {
  const hull = HULLS[id];
  if (share === undefined || !REDISTRIBUTED_HULLS.has(id)) {
    return { alloy: hull.alloy, crystal: hull.crystal, deuterium: hull.deuterium };
  }
  const total = hull.alloy + hull.crystal;
  const crystal = Math.round(total * share);
  return { alloy: total - crystal, crystal, deuterium: hull.deuterium };
}

function hullPrice(world: World, id: keyof typeof HULLS): Resources {
  return redistributedHullPrice(id, world.hullCrystalShare);
}

function spendCrystal(world: World, category: CrystalSpendCategory, amount: number): void {
  world.crystalSpent[category] += amount;
}

const completedResearchOf = (p: SimPlayer, world: World): TechLevels => {
  const completed: TechLevels = { ...p.tech };
  if (p.isotopeSpectrometry) completed.ISOTOPE_SPECTROMETRY = 1;
  if (p.denseFuelCells) completed.DENSE_FUEL_CELLS = 1;
  if (p.graviticCharges) completed.GRAVITIC_CHARGES = 1;
  if (world.deathStarProtocol.has(p.id)) completed.DEATH_STAR_PROTOCOL = 1;
  return completed;
};

/** Current state plus every order already ahead in one independent lane. */
export function projectedBuildState(
  p: SimPlayer,
  world: World,
  queue: SimQueueId,
): SimBuildProjection {
  const projected: SimBuildProjection = {
    buildings: { ...p.buildings },
    instruments: { ...p.instruments },
    orbit: [...p.orbit],
    research: completedResearchOf(p, world),
  };
  for (const order of p.queues[queue]) {
    if (order.kind === 'BUILDING') {
      const id = order.subject as BuildingId;
      projected.buildings[id] += 1;
    } else if (order.kind === 'INSTRUMENT') {
      const id = order.subject as InstrumentId;
      projected.instruments[id] = (projected.instruments[id] ?? 0) + 1;
    } else if (order.kind === 'SATELLITE') {
      const id = order.subject as SatelliteId;
      if (!projected.orbit.includes(id)) projected.orbit.push(id);
    } else if (order.kind === 'RESEARCH') {
      const id = order.subject as ResearchProjectId;
      projected.research[id] = Math.max(projected.research[id] ?? 0, order.count);
    }
  }
  return projected;
}

/** How full a Hangar has to be before a bot spends a level on the next one. */
const HANGAR_PRESSURE = 0.8;

const queuedHullCount = (p: SimPlayer, hull: HullId): number =>
  p.queues.YARD
    .filter((order) => order.kind === 'HULL' && order.subject === hull)
    .reduce((sum, order) => sum + order.count, 0);

/** Room already committed in the yard queue, on one side of the two pools. */
const queuedYardBulk = (p: SimPlayer, ground: boolean): number =>
  p.queues.YARD.reduce((sum, order) => {
    if (order.kind !== 'HULL') return sum;
    const hull = order.subject as HullId;
    return HULLS[hull].ground === ground ? sum + hullBulk(hull) * order.count : sum;
  }, 0);

/**
 * Pay and append one order, using the same depth, second rounding and season-end
 * refusal as the server. Callers validate the subject-specific gate first.
 */
export function enqueueSimBuild(
  p: SimPlayer,
  t: number,
  world: World,
  input: Omit<SimBuildOrder, 'readyAt'>,
): boolean {
  const queue = p.queues[input.queue];
  const validLane = input.kind === 'HULL'
    ? input.queue === 'YARD'
    : input.kind === 'RESEARCH'
      ? input.queue === 'RESEARCH'
      : input.queue === 'CONSTRUCTION';
  if (!validLane) return false;
  if (queue.length >= BUILD.queueDepth) return false;
  if (!Number.isInteger(input.count) || input.count < 1) return false;
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) return false;
  if (
    p.alloy < input.cost.alloy
    || p.crystal < input.cost.crystal
    || p.deuterium < input.cost.deuterium
  ) return false;

  // The server stores whole seconds, so the simulation must not finish a fraction
  // earlier and compound that drift over a fourteen-day season.
  const minutes = Math.max(1, Math.ceil(input.minutes * 60)) / 60;
  const startsAt = queue.at(-1)?.readyAt ?? t;
  const readyAt = startsAt + minutes;
  if (readyAt > world.totalMinutes) return false;

  p.alloy -= input.cost.alloy;
  p.crystal -= input.cost.crystal;
  p.deuterium -= input.cost.deuterium;
  queue.push({
    ...input,
    cost: { ...input.cost },
    minutes,
    readyAt,
  });
  return true;
}

/** Absolute completion minute for one more order, with server-style second rounding. */
function nextSimBuildReadyAt(
  p: SimPlayer,
  queue: SimQueueId,
  t: number,
  minutes: number,
): number {
  const roundedMinutes = Math.max(1, Math.ceil(minutes * 60)) / 60;
  return (p.queues[queue].at(-1)?.readyAt ?? t) + roundedMinutes;
}

function applySimBuild(p: SimPlayer, order: SimBuildOrder, world: World): void {
  if (order.kind === 'BUILDING') {
    const id = order.subject as BuildingId;
    p.buildings[id] += 1;
    return;
  }
  if (order.kind === 'HULL') {
    const id = order.subject as HullId;
    const stack = HULLS[id].ground ? p.ground : p.fleet;
    stack[id] = (stack[id] ?? 0) + order.count;
    return;
  }
  if (order.kind === 'INSTRUMENT') {
    const id = order.subject as InstrumentId;
    p.instruments[id] = (p.instruments[id] ?? 0) + 1;
    return;
  }
  if (order.kind === 'SATELLITE') {
    const id = order.subject as SatelliteId;
    if (!p.orbit.includes(id)) p.orbit.push(id);
    return;
  }

  const id = order.subject as ResearchProjectId;
  if (id === 'ISOTOPE_SPECTROMETRY') p.isotopeSpectrometry = true;
  else if (id === 'DENSE_FUEL_CELLS') p.denseFuelCells = true;
  else if (id === 'GRAVITIC_CHARGES') p.graviticCharges = true;
  // The order's `count` is its target rung, exactly as the server reads it.
  else if (id === 'DEUTERIUM_SYNTHESIS') {
    p.deuteriumSynthesis = Math.max(p.deuteriumSynthesis, order.count);
  } else if (id === 'DEATH_STAR_PROTOCOL') world.deathStarProtocol.add(p.id);
  p.tech[id] = Math.max(p.tech[id] ?? 0, order.count);
}

/**
 * DOES THIS COMMANDER ACTUALLY WANT DEUTERIUM? T5.
 *
 * A plant is a resource sink until something spends what it makes, and today that
 * is a Runner, a Breacher or a Death Star. A bot that bought one anyway would be a
 * model of a worse player than the one being measured, and every band would read
 * the cost of a mistake nobody makes.
 *
 * T6 IS WHAT CHANGES THIS. Once every launch burns fuel, every archetype wants a
 * plant and this predicate becomes true for all of them — which is exactly why the
 * mechanism is here now and the demand is narrow.
 */
const wantsDeuterium = (p: SimPlayer): boolean => {
  /*
    T6 MADE THIS TRUE FOR EVERYBODY, which is what the narrow version was waiting
    for. Every launch burns deuterium now, so a commander who ever intends to fly
    wants a refinery — and one who never attacks still transfers, settles and
    sends aid. The predicate stays as a function because the answer is a design
    statement rather than a constant: if some archetype ever genuinely does not
    need fuel, this is where that is said.
  */
  void p;
  return true;
};

/** The rung already held or on its way, so two orders cannot buy the same one. */
const synthesisRung = (p: SimPlayer): number =>
  p.queues.RESEARCH.reduce(
    (rung, order) => order.kind === 'RESEARCH' && order.subject === 'DEUTERIUM_SYNTHESIS'
      ? Math.max(rung, order.count)
      : rung,
    p.deuteriumSynthesis,
  );

/**
 * Buy the next synthesis rung, but only once the plant is standing at the ceiling
 * the current one opened. A rung bought ahead of the building it unlocks is
 * capacity paid for and not used — the same demand test the Hangar takes.
 */
function trySynthesis(p: SimPlayer, t: number, world: World): void {
  if (!wantsDeuterium(p)) return;
  const rung = synthesisRung(p);
  const project = RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS;
  if (rung >= project.maxLevel) return;
  if (rung > 0 && p.buildings.DEUTERIUM_PLANT < plantCeiling(rung)) return;
  const cost = project.costAt(rung + 1);
  if (p.alloy < cost.alloy || p.crystal < cost.crystal || p.deuterium < cost.deuterium) return;
  const projected = projectedBuildState(p, world, 'RESEARCH');
  const placed = enqueueSimBuild(p, t, world, {
    queue: 'RESEARCH',
    kind: 'RESEARCH',
    subject: 'DEUTERIUM_SYNTHESIS',
    count: rung + 1,
    cost,
    minutes: researchMinutes(cost, projected.buildings.CORE),
  });
  if (placed) spendCrystal(world, 'research', cost.crystal);
}

/** Complete due work at each order's exact instant; disruption never pauses it. */
export function advanceBuildQueues(world: World, t: number): void {
  for (const p of world.players) {
    const due = [...p.queues.CONSTRUCTION, ...p.queues.YARD, ...p.queues.RESEARCH]
      .filter((order) => order.readyAt <= t)
      .sort((a, b) => a.readyAt - b.readyAt || a.queue.localeCompare(b.queue));
    if (due.length === 0) continue;
    const completed = new Set(due);
    for (const order of due) {
      // Settle production and shield recovery under the old hardware first.
      sync(p, order.readyAt);
      applySimBuild(p, order, world);
    }
    p.queues.CONSTRUCTION = p.queues.CONSTRUCTION.filter((order) => !completed.has(order));
    p.queues.YARD = p.queues.YARD.filter((order) => !completed.has(order));
    p.queues.RESEARCH = p.queues.RESEARCH.filter((order) => !completed.has(order));
  }
}

const queuedWealth = (p: SimPlayer): number =>
  [...p.queues.CONSTRUCTION, ...p.queues.YARD, ...p.queues.RESEARCH]
    .reduce((sum, order) => sum + resourcesTotal(order.cost), 0);

function enqueueHullOrder(
  p: SimPlayer,
  hull: HullId,
  count: number,
  t: number,
  world: World,
  category: CrystalSpendCategory,
): boolean {
  if (count < 1 || !hullBuildable(hull, p.buildings.SHIPYARD, p.tech)) return false;
  /*
    THE SAME TWO CEILINGS THE SERVER ENFORCES. T4/T4b.

    Ships answer to the Hangar and emplacements to the Core, and what is already in
    the yard queue counts — a bot that could place two orders that each fit and
    together do not would end the season with a fleet the live game refuses, and
    every band measured off it would be measuring a different game.
  */
  const needed = hullBulk(hull) * count;
  if (HULLS[hull].ground) {
    const load = groundLoad(p.fleet) + queuedYardBulk(p, true);
    if (load + needed > groundSlots(p.buildings.CORE)) return false;
  } else {
    const load = ownedHangarLoad(p, world) + queuedYardBulk(p, false);
    if (load + needed > hangarCapacity(p.buildings.HANGAR)) return false;
  }
  const unit = hullPrice(world, hull);
  const cost = {
    alloy: unit.alloy * count,
    crystal: unit.crystal * count,
    deuterium: unit.deuterium * count,
  };
  const minutes = HULLS[hull].ground
    ? defenceMinutes(cost, p.buildings.SHIPYARD)
    : shipMinutes(cost, p.buildings.SHIPYARD, p.tech);
  const placed = enqueueSimBuild(p, t, world, {
    queue: 'YARD',
    kind: 'HULL',
    subject: hull,
    count,
    cost,
    minutes,
  });
  if (placed) spendCrystal(world, category, cost.crystal);
  return placed;
}

/* ── economy ───────────────────────────────────────────────────── */

const capsOf = (p: SimPlayer) => ({
  alloy: storageCap(alloyRate(p.buildings.REFINERY), p.buildings.VAULT),
  crystal: storageCap(crystalRate(p.buildings.EXTRACTOR), p.buildings.VAULT),
  deuterium: deuteriumStorageCap(
    deuteriumRate(p.buildings.DEUTERIUM_PLANT),
    crystalRate(p.buildings.EXTRACTOR),
    p.buildings.VAULT,
  ),
});

/**
 * What the WORKS hold when full, which is where production actually lands (D16).
 *
 * Priced through `productionMult` for the same reason `worksOf` is: a Foundry lifts
 * the rate and therefore the ceiling that follows from it.
 */
const worksCapsOf = (p: SimPlayer) => {
  const boost = productionMult(p.orbit);
  return {
    alloy: collectorCap(alloyRate(p.buildings.REFINERY) * boost),
    crystal: collectorCap(crystalRate(p.buildings.EXTRACTOR) * boost),
    deuterium: deuteriumCollectorCap(
      deuteriumRate(p.buildings.DEUTERIUM_PLANT) * boost,
      crystalRate(p.buildings.EXTRACTOR) * boost,
    ),
  };
};

const worksOf = (p: SimPlayer) => ({
  refineryLevel: p.buildings.REFINERY,
  extractorLevel: p.buildings.EXTRACTOR, plantLevel: p.buildings.DEUTERIUM_PLANT,
  aegisLevel: p.instruments.AEGIS ?? 0,
  vaultLevel: p.buildings.VAULT,
  production: productionMult(p.orbit),
});

const EMPTY_RESOURCES: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

function syncNeutral(n: SimNeutralWorld, t: number, world: World): void {
  if (t <= n.lastTick || n.recoveryUntil > t) {
    n.lastTick = Math.max(n.lastTick, t);
    return;
  }
  const hours = (t - n.lastTick) / 60;
  const alloyPerHour = alloyRate(n.buildings.REFINERY);
  const crystalPerHour = crystalRate(n.buildings.EXTRACTOR);
  const nextAlloy = Math.min(storageCap(alloyPerHour, n.buildings.VAULT), n.alloy + alloyPerHour * hours);
  const nextCrystal = Math.min(storageCap(crystalPerHour, n.buildings.VAULT), n.crystal + crystalPerHour * hours);
  if (n.controllerId === null) {
    world.strategic.neutralMinted[n.tier] += nextAlloy - n.alloy + nextCrystal - n.crystal;
  }
  n.alloy = nextAlloy;
  n.crystal = nextCrystal;
  n.lastTick = t;
}

/** Mirrors the server's strict infrastructure → Aegis → proportional garrison order. */
function reinforceNeutralSim(n: SimNeutralWorld, t: number, world: World): void {
  const template = MULTI_WORLD.neutral[n.tier];
  if (template.reinforcementMinutes === null) return;
  syncNeutral(n, t, world);
  let blocked = false;
  for (const type of ['CORE', 'REFINERY', 'EXTRACTOR', 'SHIPYARD'] as const) {
    while (n.buildings[type] < template.buildings[type]) {
      const cost = buildingCost(type, n.buildings[type]);
      if (n.alloy < cost.alloy || n.crystal < cost.crystal || n.deuterium < cost.deuterium) {
        blocked = true;
        break;
      }
      n.alloy -= cost.alloy;
      n.crystal -= cost.crystal;
      n.deuterium -= cost.deuterium;
      n.buildings[type]++;
    }
    if (blocked) break;
  }
  if (n.tier === 3 && !blocked) {
    while (n.aegis < 3) {
      const cost = instrumentCost('AEGIS', n.aegis);
      if (n.alloy < cost.alloy || n.crystal < cost.crystal || n.deuterium < cost.deuterium) {
        blocked = true;
        break;
      }
      n.alloy -= cost.alloy;
      n.crystal -= cost.crystal;
      n.deuterium -= cost.deuterium;
      n.aegis++;
    }
  }
  const target = { ...template.fleet, ...template.ground } as Fleet;
  const tie = ALL_HULLS.filter((hull) => (target[hull] ?? 0) > 0);
  while (!blocked) {
    const missing = tie
      .filter((hull) => (n.fleet[hull] ?? 0) < (target[hull] ?? 0))
      .sort((a, b) =>
        ((n.fleet[a] ?? 0) / Math.max(1, target[a] ?? 0))
        - ((n.fleet[b] ?? 0) / Math.max(1, target[b] ?? 0))
        || tie.indexOf(a) - tie.indexOf(b));
    const hull = missing[0];
    if (!hull) break;
    const cost = HULLS[hull];
    if (n.alloy < cost.alloy || n.crystal < cost.crystal || n.deuterium < cost.deuterium) break;
    n.alloy -= cost.alloy;
    n.crystal -= cost.crystal;
    n.deuterium -= cost.deuterium;
    n.fleet[hull] = (n.fleet[hull] ?? 0) + 1;
  }
  n.nextReinforcement = t + template.reinforcementMinutes;
}

const coloniesOf = (world: World, playerId: number): SimNeutralWorld[] =>
  world.neutrals.filter((n) => n.controllerId === playerId);

function strategicReservations(world: World, playerId: number): number {
  return world.strategicMissions.filter((mission) =>
    mission.ownerId === playerId
    && (mission.kind === 'settlement'
      || (mission.kind === 'death_star' && mission.captureIntent)),
  ).length;
}

function strategicCapacity(world: World, p: SimPlayer): number {
  const highest = Math.max(
    p.buildings.CORE,
    ...coloniesOf(world, p.id).map((n) => n.buildings.CORE),
  );
  return colonyCapacity(highest);
}

function canReserveColony(world: World, p: SimPlayer): boolean {
  return coloniesOf(world, p.id).length + strategicReservations(world, p.id)
    < strategicCapacity(world, p);
}

function raidFleetFor(p: SimPlayer, tier: NeutralTier): Fleet | null {
  const cargoHull = ARCHETYPES[p.type].cargoPreference.find((id) => (p.fleet[id] ?? 0) > 0);
  const escort = COMBAT_HULLS
    .filter((id) => (p.fleet[id] ?? 0) > 0)
    .sort((a, b) => HULLS[b].speed - HULLS[a].speed)[0];
  if (!cargoHull || !escort) return null;
  if (tier === 1) return { [escort]: Math.min(3, p.fleet[escort] ?? 0), [cargoHull]: 1 };
  const send: Fleet = { [cargoHull]: 1 };
  for (const hull of COMBAT_HULLS) {
    const count = Math.floor((p.fleet[hull] ?? 0) * 0.6);
    if (count > 0) send[hull] = count;
  }
  return fleetValue(send) > 0 ? send : null;
}

export function neutralRaidEligible(
  tier: NeutralTier,
  archetype: ArchetypeName,
  attackValue: number,
  defenceValue: number,
): boolean {
  if (tier === 1) return attackValue > 0;
  if (tier === 2) return attackValue >= defenceValue * 1.8;
  return archetype === 'GRINDER' && attackValue >= defenceValue * 2.5;
}

function trySettleNeutral(p: SimPlayer, n: SimNeutralWorld, t: number, world: World): void {
  if (n.claimUntil === null || n.claimUntil <= t || !canReserveColony(world, p)) return;
  const { transportHull, transports } = MULTI_WORLD.settlement;
  if (world.strategicRng() >= 0.18 || (p.fleet[transportHull] ?? 0) < transports) return;
  const cost = MULTI_WORLD.settlement.cost;
  if (p.alloy < cost.alloy || p.crystal < cost.crystal || p.deuterium < cost.deuterium) return;
  const fleet: Fleet = { [transportHull]: transports };
  const flight = fleetTravelExact(distance(p, n), fleet, 1, p.tech);
  const arriveAt = t + flight;
  if (arriveAt > n.claimUntil) return;
  p.alloy -= cost.alloy;
  p.crystal -= cost.crystal;
  p.deuterium -= cost.deuterium;
  p.fleet[transportHull] = (p.fleet[transportHull] ?? 0) - transports;
  world.strategicMissions.push({
    id: world.nextStrategicMissionId++,
    kind: 'settlement',
    ownerId: p.id,
    targetId: n.id,
    arriveAt,
  });
}

function tryNeutralRaid(p: SimPlayer, t: number, world: World): void {
  if (world.strategicRng() >= world.neutralRaidChance) return;
  const candidates = world.neutrals
    .filter((n) => n.controllerId === null && n.protectedUntil <= t)
    .sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id);
  for (const n of candidates) {
    if (n.recoveryUntil > t) {
      world.strategic.recoveryThirdPartyArrivals++;
      continue;
    }
    const send = raidFleetFor(p, n.tier);
    if (!send) return;
    const defenceValue = fleetValue(n.fleet) + shieldHp(n.aegis);
    const attackValue = fleetValue(send);
    // T3 is intentionally not a blind farm: only the informed archetype models a
    // probe/counter-composition decision, and still demands a wide safety margin.
    if (!neutralRaidEligible(n.tier, p.type, attackValue, defenceValue)) continue;

    for (const [hull, count] of fleetEntries(send)) p.fleet[hull] = (p.fleet[hull] ?? 0) - count;
    world.strategicMissions.push({
      id: world.nextStrategicMissionId++,
      kind: 'neutral_attack',
      ownerId: p.id,
      targetId: n.id,
      arriveAt: t + fleetTravelExact(distance(p, n), send, 1, p.tech),
      fleet: send,
      returning: false,
    });
    return;
  }
}

function tryTransferToColony(p: SimPlayer, t: number, world: World): void {
  const colony = coloniesOf(world, p.id)[0];
  const transportHull = ARCHETYPES[p.type].cargoPreference.find((id) => (p.fleet[id] ?? 0) > 0);
  if (!colony || !transportHull || world.strategicRng() >= world.colonyTransferChance) return;
  const cargo = {
    alloy: Math.min(600, Math.floor(p.alloy * 0.08)),
    crystal: Math.min(200, Math.floor(p.crystal * 0.08)),
    deuterium: Math.min(50, Math.floor(p.deuterium * 0.08)),
  };
  if (cargo.alloy + cargo.crystal + cargo.deuterium <= 0) return;
  p.alloy -= cargo.alloy;
  p.crystal -= cargo.crystal;
  p.deuterium -= cargo.deuterium;
  p.fleet[transportHull] = (p.fleet[transportHull] ?? 0) - 1;
  world.strategicMissions.push({
    id: world.nextStrategicMissionId++,
    kind: 'transfer',
    ownerId: p.id,
    targetId: colony.id,
    arriveAt: t + fleetTravelExact(distance(p, colony), { [transportHull]: 1 }, 1, p.tech),
    transportHull,
    cargo,
  });
}

export function tryDeathStar(p: SimPlayer, t: number, world: World): void {
  const existing = world.deathStars.get(p.id);
  if (existing?.status === 'BUILDING' && existing.readyAt <= t) {
    existing.status = 'READY';
  }
  if (existing?.status === 'READY') {
    const target = world.neutrals
      .filter((n) => n.controllerId !== p.id && n.protectedUntil <= t)
      .sort((a, b) => Number(b.recoveryUntil > t) - Number(a.recoveryUntil > t)
        || distance(p, a) - distance(p, b) || a.id - b.id)[0];
    if (!target) return;
    const captureIntent = target.recoveryUntil > t;
    if (captureIntent && !canReserveColony(world, p)) return;
    const arriveAt = t + travelMinutes(distance(p, target), DEATH_STAR.speed);
    if (captureIntent && arriveAt >= target.recoveryUntil) return;
    world.deathStars.delete(p.id);
    world.strategicMissions.push({
      id: world.nextStrategicMissionId++,
      kind: 'death_star',
      ownerId: p.id,
      targetId: target.id,
      arriveAt,
      captureIntent,
    });
    world.strategic.deathStar.launches++;
    return;
  }
  if (existing || t < RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.availableAtMinutes) return;
  if (!world.deathStarProtocol.has(p.id)) {
    const projected = projectedBuildState(p, world, 'RESEARCH');
    // Already paid and waiting: the strategic asset cannot start until the
    // research completion has made the permission durable.
    if ((projected.research.DEATH_STAR_PROTOCOL ?? 0) > 0) return;
    if (
      (projected.research.GRAVITIC_CHARGES ?? 0) < 1
      || projected.buildings.CORE < (RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.requiredCore ?? 0)
    ) return;
    const research = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.costAt(1);
    if (p.alloy < research.alloy || p.crystal < research.crystal || p.deuterium < research.deuterium) return;
    const placed = enqueueSimBuild(p, t, world, {
      queue: 'RESEARCH',
      kind: 'RESEARCH',
      subject: 'DEATH_STAR_PROTOCOL',
      count: 1,
      cost: research,
      minutes: researchMinutes(research, projected.buildings.CORE),
    });
    if (placed) spendCrystal(world, 'research', research.crystal);
    return;
  }
  if (
    p.buildings.CORE < DEATH_STAR.requiredCore
    || p.buildings.SHIPYARD < DEATH_STAR.requiredShipyard
  ) return;
  if (p.alloy < DEATH_STAR.cost.alloy || p.crystal < DEATH_STAR.cost.crystal || p.deuterium < DEATH_STAR.cost.deuterium) return;
  p.alloy -= DEATH_STAR.cost.alloy;
  p.crystal -= DEATH_STAR.cost.crystal;
  p.deuterium -= DEATH_STAR.cost.deuterium;
  spendCrystal(world, 'combat', DEATH_STAR.cost.crystal);
  world.deathStars.set(p.id, { status: 'BUILDING', readyAt: t + DEATH_STAR.buildMinutes });
  world.strategic.deathStar.builds++;
}

/** D113. Mirrors `applyDeathStarStrike`: half the stores, the Core, and the Aegis. */
function applyStrategicDamage(n: SimNeutralWorld, t: number): void {
  const survives = (amount: number) =>
    Math.floor(amount * (1 - DEATH_STAR.stockShareDestroyed));
  n.alloy = survives(n.alloy);
  n.crystal = survives(n.crystal);
  n.deuterium = survives(n.deuterium);
  const core = Math.max(0, n.buildings.CORE - 1);
  n.buildings.CORE = core;
  // Only what the Core ceiling forces down comes down with it.
  for (const type of ['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'] as const) {
    n.buildings[type] = Math.min(n.buildings[type], core);
  }
  n.aegis = Math.max(0, n.aegis - DEATH_STAR.aegisLevelsLost);
  n.fleet = Object.fromEntries(
    fleetEntries(n.fleet).filter(([hull]) => hull === 'PROSPECTOR'),
  );
  n.claimUntil = null;
  n.lastTick = t;
}

function resolveStrategicMission(mission: StrategicMission, t: number, world: World): void {
  const p = world.players[mission.ownerId];
  const target = world.neutrals.find((n) => n.id === mission.targetId);
  if (!p || !target) return;
  if (mission.kind === 'neutral_attack') {
    if (mission.returning) {
      for (const [hull, count] of fleetEntries(mission.fleet)) {
        p.fleet[hull] = (p.fleet[hull] ?? 0) + count;
      }
      const caps = capsOf(p);
      p.alloy = Math.min(caps.alloy, p.alloy + (mission.cargo?.alloy ?? 0));
      p.crystal = Math.min(caps.crystal, p.crystal + (mission.cargo?.crystal ?? 0));
      p.deuterium = Math.min(caps.deuterium, p.deuterium + (mission.cargo?.deuterium ?? 0));
      return;
    }

    // A world can recover, become protected or change controller while the fleet
    // is travelling. Like the server, that stale arrival returns without combat.
    if (target.controllerId !== null || target.protectedUntil > t || target.recoveryUntil > t) {
      if (target.recoveryUntil > t) world.strategic.recoveryThirdPartyArrivals++;
      world.strategicMissions.push({
        ...mission,
        id: world.nextStrategicMissionId++,
        arriveAt: t + fleetTravelExact(distance(p, target), mission.fleet, 1, p.tech),
        returning: true,
      });
      return;
    }

    syncNeutral(target, t, world);
    const result = resolveCombat(
      mission.fleet,
      target.fleet,
      shieldHp(target.aegis),
      mulberry32((mission.id * 104729 + t) >>> 0),
      // A caretaker world researches nothing; the raider's doctrines still count.
      { attacker: { tech: p.tech }, defender: { tech: {} } },
    );
    target.fleet = { ...result.defenderSurvivors, ...result.defenceSalvage };
    const loot = computeLoot(
      { alloy: target.alloy, crystal: target.crystal, deuterium: target.deuterium },
      EMPTY_RESOURCES,
      EMPTY_RESOURCES,
      result.grade,
      fleetCargo(result.attackerSurvivors, p.tech),
    );
    target.alloy -= loot.fromStock.alloy;
    target.crystal -= loot.fromStock.crystal;
    target.deuterium -= loot.fromStock.deuterium;
    const taken = loot.alloy + loot.crystal + loot.deuterium;
    world.strategic.neutralTaken[target.tier] += taken;
    world.strategic.neutralRaids++;
    world.neutralRaiders.add(p.id);
    // D112: a closed window reopens; a live one is never pushed back.
    if (result.grade === 'DECISIVE' && (target.claimUntil === null || target.claimUntil <= t)) {
      target.claimUntil = t + SETTLEMENT_CLAIM_MINUTES;
      trySettleNeutral(p, target, t, world);
    }
    if (fleetValue(result.attackerSurvivors) > 0) {
      world.strategicMissions.push({
        id: world.nextStrategicMissionId++,
        kind: 'neutral_attack',
        ownerId: p.id,
        targetId: target.id,
        arriveAt: t + fleetTravelExact(
          distance(p, target), result.attackerSurvivors, 1, p.tech,
        ),
        fleet: result.attackerSurvivors,
        returning: true,
        cargo: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
      });
    }
    return;
  }
  if (mission.kind === 'settlement') {
    const { transportHull, transports } = MULTI_WORLD.settlement;
    if (target.controllerId === null && target.claimUntil !== null && target.claimUntil >= t) {
      target.controllerId = p.id;
      target.claimUntil = null;
      target.protectedUntil = t + MULTI_WORLD.occupationMinutes;
      target.fleet[transportHull] = (target.fleet[transportHull] ?? 0) + transports;
      world.strategic.colonizedAt[target.tier].push(t);
    } else {
      p.fleet[transportHull] = (p.fleet[transportHull] ?? 0) + transports;
      p.alloy += MULTI_WORLD.settlement.cost.alloy;
      p.crystal += MULTI_WORLD.settlement.cost.crystal;
      p.deuterium += MULTI_WORLD.settlement.cost.deuterium;
    }
    return;
  }
  if (mission.kind === 'transfer') {
    if (target.controllerId === p.id) {
      target.alloy += mission.cargo.alloy;
      target.crystal += mission.cargo.crystal;
      target.deuterium += mission.cargo.deuterium;
      target.fleet[mission.transportHull] = (target.fleet[mission.transportHull] ?? 0) + 1;
      world.strategic.transferredResources +=
        mission.cargo.alloy + mission.cargo.crystal + mission.cargo.deuterium;
    } else {
      p.fleet[mission.transportHull] = (p.fleet[mission.transportHull] ?? 0) + 1;
      p.alloy += mission.cargo.alloy;
      p.crystal += mission.cargo.crystal;
      p.deuterium += mission.cargo.deuterium;
    }
    return;
  }
  if (target.controllerId === p.id || target.protectedUntil > t) {
    world.strategic.deathStar.misses++;
    return;
  }
  const second = mission.captureIntent && target.recoveryUntil > t;
  applyStrategicDamage(target, t);
  if (second) {
    target.controllerId = p.id;
    target.recoveryUntil = 0;
    target.protectedUntil = t + MULTI_WORLD.occupationMinutes;
    world.strategic.deathStar.captures++;
  } else {
    /*
      A SIMULATED STRIKE ONLY EVER LANDS ON A NEUTRAL, which takes the short window
      since D167 — there is no commander to answer a deadline and no control to
      lose. The colony branch is not reachable here, and the drop itself is not
      modelled: no simulated bot ever relieves a world.
    */
    target.recoveryUntil = t + recoveryMinutesFor('NEUTRAL');
    world.strategic.deathStar.firstHits++;
  }
}

export function runStrategicSession(p: SimPlayer, t: number, world: World): void {
  const openClaim = world.neutrals
    .filter((n) => n.controllerId === null && n.claimUntil !== null && n.claimUntil > t)
    .sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id)[0];
  if (openClaim) trySettleNeutral(p, openClaim, t, world);
  tryNeutralRaid(p, t, world);
  tryTransferToColony(p, t, world);
  tryDeathStar(p, t, world);
}

export function advanceStrategicLayer(world: World, t: number): void {
  const dueStrategic = world.strategicMissions
    .filter((mission) => mission.arriveAt <= t)
    .sort((a, b) => a.arriveAt - b.arriveAt || a.id - b.id);
  if (dueStrategic.length > 0) {
    const dueIds = new Set(dueStrategic.map((mission) => mission.id));
    world.strategicMissions = world.strategicMissions
      .filter((mission) => !dueIds.has(mission.id));
    for (const mission of dueStrategic) resolveStrategicMission(mission, t, world);
  }
  for (const neutral of world.neutrals) {
    if (neutral.controllerId !== null || neutral.nextReinforcement === null) continue;
    if (neutral.nextReinforcement > t) continue;
    if (neutral.recoveryUntil > t) {
      neutral.nextReinforcement = neutral.recoveryUntil;
    } else {
      reinforceNeutralSim(neutral, t, world);
    }
  }
}

function strategicWealth(p: SimPlayer, world: World): number {
  let total = 0;
  for (const n of coloniesOf(world, p.id)) {
    for (const type of BUILDING_IDS) {
      total += investedInBuilding(n.buildings[type], type);
    }
    total += investedInInstrument('AEGIS', n.aegis);
    total += fleetValue(n.fleet) + n.alloy + n.crystal + n.deuterium;
  }
  if (world.deathStars.has(p.id)) total += resourcesTotal(DEATH_STAR.cost);
  for (const mission of world.strategicMissions.filter((m) => m.ownerId === p.id)) {
    if (mission.kind === 'death_star') total += resourcesTotal(DEATH_STAR.cost);
    if (mission.kind === 'settlement') {
      const { transportHull, transports } = MULTI_WORLD.settlement;
      total += transports * resourcesTotal(HULLS[transportHull]);
    }
    if (mission.kind === 'transfer') {
      total += resourcesTotal(HULLS[mission.transportHull]) + resourcesTotal(mission.cargo);
    }
    if (mission.kind === 'neutral_attack') {
      total += fleetValue(mission.fleet) + resourcesTotal(mission.cargo ?? EMPTY_RESOURCES);
    }
  }
  return total;
}

const resourcesTotal = (r: Resources): number => r.alloy + r.crystal + r.deuterium;

function totalWealth(p: SimPlayer, world: World): number {
  // Committed resources remain fully owned, as on the server. They are not in
  // storage and therefore do not enter ARR's losable numerator while queued.
  return wealth(holdingsOf(p)) + queuedWealth(p) + strategicWealth(p, world);
}

function sync(p: SimPlayer, t: number): void {
  const next = advanceEconomy(
    {
      alloy: p.alloy, crystal: p.crystal, deuterium: p.deuterium,
      bufferAlloy: p.bufferAlloy, bufferCrystal: p.bufferCrystal,
      bufferDeuterium: p.bufferDeuterium,
      shield: p.shield,
      lastTickMinutes: p.lastTick, disruptedUntilMinutes: p.disruptedUntil,
    },
    worksOf(p),
    t,
  );
  p.alloy = next.alloy;
  p.crystal = next.crystal;
  p.deuterium = next.deuterium;
  p.bufferAlloy = next.bufferAlloy;
  p.bufferCrystal = next.bufferCrystal;
  p.bufferDeuterium = next.bufferDeuterium;
  p.shield = next.shield;
  p.lastTick = next.lastTickMinutes;
}

/**
 * The tap, as a bot performs it. D16.
 *
 * Every archetype empties the works the moment it logs in — it is one button and
 * there is never a reason not to. Modelling it as automatic-on-login is what makes
 * the simulator honest about the collector's real cost, which is not the tap but
 * the PRODUCTION LOST between logins: a bot that visits twice a day fills an
 * eight-hour buffer and idles for four, and that shortfall now shows up in the
 * archetype spread instead of being invisible.
 */
function collectWorks(p: SimPlayer): void {
  const after = collect(
    {
      alloy: p.alloy, crystal: p.crystal, deuterium: p.deuterium,
      bufferAlloy: p.bufferAlloy, bufferCrystal: p.bufferCrystal,
      bufferDeuterium: p.bufferDeuterium,
      shield: p.shield,
      lastTickMinutes: p.lastTick, disruptedUntilMinutes: p.disruptedUntil,
    },
    worksOf(p),
  ).state;

  p.alloy = after.alloy;
  p.crystal = after.crystal;
  p.deuterium = after.deuterium;
  p.bufferAlloy = after.bufferAlloy;
  p.bufferCrystal = after.bufferCrystal;
  p.bufferDeuterium = after.bufferDeuterium;
}

// Uncollected ore is still owned, so it still counts as Wealth — and Wealth is
// what the rank floor reads. Leaving the buffer out would make a player cheapest,
// and so most protected from attack, at exactly the moment they were carrying the
// most: overnight, with the works full.
const holdingsOf = (p: SimPlayer) => ({
  buildings: p.buildings, instruments: p.instruments, satellites: p.orbit,
  fleet: p.fleet, ground: p.ground,
  alloy: p.alloy + p.bufferAlloy,
  crystal: p.crystal + p.bufferCrystal,
  deuterium: p.deuterium + p.bufferDeuterium,
});

/* ── what to build, and why it is derived rather than listed ───── */

/** Every mobile hull that fights, from the rules-owned catalog partition. */
export const COMBAT_HULLS = RULE_COMBAT_HULLS as readonly CombatHullId[];

/**
 * What a bot expects to meet on the ground.
 *
 * Read off the hull table rather than written down, so a second ground hull is
 * picked up instead of silently ignored.
 *
 * THERE ARE TWO SINCE D27 — a Bastion and a Thorn, in opposite classes — and this
 * comment claimed there was exactly one for long enough that `expectedDefence`
 * sixty lines below documents the bug that arose precisely BECAUSE "how much
 * defence do they have" and "how many Bastions" stopped being the same question.
 * One assumed hull each is a bot reasoning about the classes it may face, which is
 * public in the hull table and not information a human is denied.
 */
export const GROUND_DEFENCE: Fleet = Object.fromEntries(
  ALL_HULLS.filter((id) => HULLS[id].ground).map((id) => [id, 1]),
);

/**
 * Damage a hull deals before it dies, per resource spent, against a known defence.
 *
 * BOTH DIRECTIONS OF THE COUNTER MATRIX, because either one alone lies. A Bulwark's
 * raw attack per resource is a sixth of a Wasp's, so an offence-only measure says
 * never build one; what a Bulwark is actually for is what it survives, and that
 * only shows up in the incoming multiplier.
 *
 * DERIVED FROM `counterMult`, NOT FROM A TABLE OF HULL NAMES. That property is
 * load-bearing rather than tidy: this policy exists so that a combat change can be
 * measured, and a policy that hardcoded today's answer would have to be rewritten
 * by the very change it exists to measure — which would leave the reading exactly
 * as uninterpretable as it was before.
 */
export function tradeScore(hull: CombatHullId, defenders: Fleet): number {
  const h = HULLS[hull];
  const cost = h.alloy + h.crystal + h.deuterium;
  if (cost <= 0 || h.atk <= 0) return 0;

  let hpPool = 0;
  let atkPool = 0;
  let outWeighted = 0;
  let inWeighted = 0;
  for (const [id, n] of fleetEntries(defenders)) {
    const d = HULLS[id];
    hpPool += n * d.hp;
    atkPool += n * d.atk;
    outWeighted += n * d.hp * counterMult(h.cls, d.cls);
    inWeighted += n * d.atk * counterMult(d.cls, h.cls);
  }
  if (hpPool <= 0) return 0;

  const out = outWeighted / hpPool;
  const incoming = atkPool > 0 ? inWeighted / atkPool : 1;
  return (h.atk * out * (h.hp / incoming)) / cost;
}

/**
 * What the informed player brings, given what the Shipyard can build.
 *
 * Seventy-thirty and not a hundred-zero, on purpose. A bot that always fields the
 * single best hull is playing a solved game, and `BANDS` measured against a galaxy
 * of solved players says nothing about a galaxy of people. The second hull is the
 * hedge a competent player keeps against the home fleet they cannot see.
 */
export function adaptiveMix(
  yard: number,
  fallback: Composition,
  defence: Fleet = GROUND_DEFENCE,
  permitted: readonly CombatHullId[] = COMBAT_HULLS,
  tech: TechLevels = {},
): Composition {
  const buildable = permitted.filter((h) => hullBuildable(h, yard, tech));
  if (buildable.length === 0) return fallback;

  const ranked = [...buildable].sort((x, y) => tradeScore(y, defence) - tradeScore(x, defence));
  const first = ranked[0];
  if (!first) return fallback;
  const second = ranked[1];
  return second ? { [first]: 0.7, [second]: 0.3 } : { [first]: 1 };
}


/**
 * WHAT THIS PLAYER EXPECTS TO FLY INTO.
 *
 * SCORING AGAINST GROUND DEFENCE ALONE WAS A REAL BUG, and it hid for a whole
 * stage. A planet's guns are roughly a sixth of the hull value a raider meets —
 * most of a galaxy sits in home FLEETS — so ranking hulls against `GROUND_DEFENCE`
 * picked the hull that counters a turret and loses to the swarm guarding it. It
 * was invisible while there was one ground hull, because the answer happened to
 * coincide; D27 made the two answers differ and the bug surfaced at once.
 *
 * VALUE-NORMALISED, NOT SUMMED. A raw sum of every scouted fleet is dominated by
 * whichever neighbour happens to hoard the most Wasps, which is a fact about one
 * planet rather than about the neighbourhood. Each report is scaled to the same
 * weight before being blended, so what comes out is the SHAPE of local defence.
 *
 * It is a PRIOR, never a solution: the fleet is bought before a target is chosen,
 * so this answers "what does my neighbourhood look like", not "what has that
 * planet got". That is what keeps an informed bot competent rather than optimal —
 * and a bot that has scouted nobody falls back to its own habits, which is the
 * honest model of a player guessing from what they would build themselves.
 */
function expectedDefence(p: SimPlayer, t: number, fallback: Composition): Fleet {
  const seen: Fleet = {};
  let reports = 0;
  for (const known of p.intel.values()) {
    // What a neighbourhood BUILDS moves far more slowly than the stock in its
    // stores, so a day-old reading is still worth having.
    if (t - known.at > 1440) continue;
    const value = fleetValue(known.composition);
    if (value <= 0) continue;
    reports++;
    for (const [id, n] of fleetEntries(known.composition)) {
      seen[id] = (seen[id] ?? 0) + (n * 10_000) / value;
    }
  }
  if (reports === 0) {
    for (const [id, share] of Object.entries(fallback) as [CombatHullId, number][]) {
      seen[id] = (share * 10_000) / (HULLS[id].alloy + HULLS[id].crystal);
    }
  }
  // Ground guns never leave, so every raid meets them on top of whatever flies.
  for (const id of GROUND_HULLS) seen[id] = (seen[id] ?? 0) + 1;
  return seen;
}

/** Only what fights. Transports are cargo — eight of them are not a raid. */
const combatPart = (fleet: Fleet): Fleet =>
  Object.fromEntries(COMBAT_HULLS.map((h) => [h, fleet[h] ?? 0]));

/** What may be packed into a raid: combat hulls plus cargo, never mining craft. */
const raidingPart = (fleet: Fleet): Fleet => ({
  ...combatPart(fleet),
  WAYFARER: fleet.WAYFARER ?? 0,
  COURIER: fleet.COURIER ?? 0,
  ATLAS: fleet.ATLAS ?? 0,
});

const ownedProspectors = (p: SimPlayer, world: World): number =>
  (p.fleet.PROSPECTOR ?? 0)
  + world.miningRuns
    .filter((run) => run.playerId === p.id)
    .reduce((sum, run) => sum + run.craft, 0);

/** Home plus every outbound/return stack still owned by this commander. */
const ownedMissionHull = (p: SimPlayer, world: World, hull: MobileHullId): number =>
  (p.fleet[hull] ?? 0)
  + world.missions
    .filter((mission) => mission.from === p.id)
    .reduce((sum, mission) => sum + (mission.fleet[hull] ?? 0), 0);

/**
 * ROOM THIS COMMANDER'S CRAFT TAKE UP, wherever they are. T4.
 *
 * The server counts every unit row a world owns, home or away, because a ceiling a
 * launch could empty is not a ceiling. A bot that could dodge the Hangar by having
 * its fleet in the air would model a game nobody is playing, and the gate would be
 * measured against fleets the live rules refuse to build.
 */
function ownedHangarLoad(p: SimPlayer, world: World): number {
  let load = hangarLoad(p.fleet);
  for (const mission of world.missions) {
    if (mission.from === p.id) load += hangarLoad(mission.fleet);
  }
  for (const mission of world.strategicMissions) {
    // Only the neutral raid carries craft; a settlement and a transfer carry ore.
    if (mission.ownerId === p.id && mission.kind === 'neutral_attack') {
      load += hangarLoad(mission.fleet);
    }
  }
  for (const run of world.miningRuns) {
    if (run.playerId === p.id) load += run.craft * hullBulk('PROSPECTOR');
  }
  return load;
}

/** Buy at most one per login, preserving the rules-level two-craft ownership cap. */
function tryBuyProspector(p: SimPlayer, t: number, world: World): void {
  const a = ARCHETYPES[p.type];
  const target = Math.min(a.prospectorTarget, PROSPECTOR.max);
  if (p.buildings.SHIPYARD < HULLS.PROSPECTOR.minShipyard) return;
  if (ownedProspectors(p, world) + queuedHullCount(p, 'PROSPECTOR') >= target) return;

  const price = hullPrice(world, 'PROSPECTOR');
  if (p.alloy < price.alloy || p.crystal < price.crystal) return;
  if (p.alloy - price.alloy < alloyRate(p.buildings.REFINERY) * 0.5) return;
  enqueueHullOrder(p, 'PROSPECTOR', 1, t, world, 'prospector');
}

/** Buy the next reachable rung from this habit's authored research target. */
function tryResearch(p: SimPlayer, t: number, world: World): void {
  trySynthesis(p, t, world);
  const archetype = ARCHETYPES[p.type];
  const projects = Object.keys(archetype.researchTargets) as ResearchProjectId[];
  for (const id of projects) {
    if (!RESEARCH_PROJECT_IDS.includes(id)) continue;
    const project = RESEARCH_PROJECTS[id];
    const target = Math.min(project.maxLevel, Math.floor(archetype.researchTargets[id] ?? 0));
    if (target < 1 || t < project.availableAtMinutes) continue;

    const projected = projectedBuildState(p, world, 'RESEARCH');
    const held = Math.floor(projected.research[id] ?? 0);
    if (held >= target) continue;
    if (project.prerequisite && (projected.research[project.prerequisite] ?? 0) < 1) continue;
    if (projected.buildings.CORE < (project.requiredCore ?? 0)) continue;

    // Seasonal discoveries remain behavioral gates; the new fleet ladders are
    // ordinary visible research and therefore do not inherit these conditions.
    if (id === 'ISOTOPE_SPECTROMETRY') {
      if (!world.isotopes || !archetype.researchesIsotopes) continue;
      if (ownedProspectors(p, world) + queuedHullCount(p, 'PROSPECTOR') < 1) continue;
    }
    if (id === 'DENSE_FUEL_CELLS' && !p.cargoLimitedSeen) continue;
    if (id === 'GRAVITIC_CHARGES' && !p.shieldInsightSeen) continue;

    const next = held + 1;
    const base = project.costAt(next);
    const cost = id === 'ISOTOPE_SPECTROMETRY'
      ? { ...base, crystal: world.spectrometryCrystalCost }
      : base;
    if (p.alloy < cost.alloy || p.crystal < cost.crystal || p.deuterium < cost.deuterium) {
      continue;
    }
    const placed = enqueueSimBuild(p, t, world, {
      queue: 'RESEARCH',
      kind: 'RESEARCH',
      subject: id,
      count: next,
      cost,
      minutes: researchMinutes(cost, projected.buildings.CORE),
    });
    if (placed) spendCrystal(world, 'research', cost.crystal);
    return;
  }
}

/**
 * Deuterium a rational bot is currently saving for its next reachable research.
 * Without this reserve, every flight burns the last few units forever and a
 * discovered project with a deuterium price can never complete.
 */
function researchDeuteriumReserve(p: SimPlayer, t: number, world: World): number {
  const archetype = ARCHETYPES[p.type];
  const projected = projectedBuildState(p, world, 'RESEARCH');
  for (const id of Object.keys(archetype.researchTargets) as ResearchProjectId[]) {
    const project = RESEARCH_PROJECTS[id];
    const target = Math.min(project.maxLevel, Math.floor(archetype.researchTargets[id] ?? 0));
    const held = Math.floor(projected.research[id] ?? 0);
    if (held >= target || t < project.availableAtMinutes) continue;
    if (project.prerequisite && (projected.research[project.prerequisite] ?? 0) < 1) continue;
    if (projected.buildings.CORE < (project.requiredCore ?? 0)) continue;
    if (id === 'ISOTOPE_SPECTROMETRY'
      && (!world.isotopes || !archetype.researchesIsotopes
        || ownedProspectors(p, world) + queuedHullCount(p, 'PROSPECTOR') < 1)) continue;
    if (id === 'DENSE_FUEL_CELLS' && !p.cargoLimitedSeen) continue;
    if (id === 'GRAVITIC_CHARGES' && !p.shieldInsightSeen) continue;
    const cost = project.costAt(held + 1);
    if (p.alloy >= cost.alloy && p.crystal >= cost.crystal) return cost.deuterium;
  }
  return 0;
}

/** Compare a few nearby visible rocks, preserving shared first-arrival races. */
function tryMine(p: SimPlayer, t: number, world: World): void {
  const craft = p.fleet.PROSPECTOR ?? 0;
  if (craft <= 0 || world.miningRng() >= ARCHETYPES[p.type].miningChance) return;

  const speed = prospectorSpeed(p.orbit);
  const holdEach = prospectorHold(p.orbit, p.tech);
  const shortlist = activeAsteroids(world.asteroids, t)
    // `isotopes: false` is the experiment baseline: it must reproduce the old
    // asteroid field exactly, not silently hide the rocks whose independent hash
    // would have made them rich in the treatment arm.
    .filter((rock) => !world.isotopes || !rock.isotopeRich || p.isotopeSpectrometry)
    .filter((rock) => (world.asteroidClaims.get(rock.index) ?? 0) < rock.ore)
    .sort((x, y) =>
      distance(p, asteroidPosition(x, t)) - distance(p, asteroidPosition(y, t)))
    .slice(0, 4);

  let best: {
    rock: AsteroidSpec;
    arriveAt: number;
    intercept: MiningRun['intercept'];
    score: number;
  } | null = null;
  for (const rock of shortlist) {
    const intercept = interceptAsteroid(p, speed, rock, t);
    if (!intercept) continue;
    const remaining = Math.max(0, rock.ore - (world.asteroidClaims.get(rock.index) ?? 0));
    const outboundYield = Math.min(remaining, holdEach * craft);
    // Priced at the return speed: the bot ranks rocks by yield per minute of the
    // whole round trip, so a leg it does not actually fly makes it choose wrong. D117.
    const home = travelExact(distance(intercept.at, p), prospectorReturnSpeed(p.orbit));
    const score = outboundYield / Math.max(0.01, intercept.flightMinutes + home);
    if (!best || score > best.score) {
      best = { rock, arriveAt: intercept.meetsAtMinutes, intercept: intercept.at, score };
    }
  }
  if (!best) return;

  p.fleet.PROSPECTOR = 0;
  world.miningRuns.push({
    id: world.nextMiningRunId++,
    playerId: p.id,
    asteroidIndex: best.rock.index,
    craft,
    holdEach,
    arriveAt: best.arriveAt,
    intercept: best.intercept,
    returning: false,
  });
  world.mining.launches++;
}

function resolveMiningRun(run: MiningRun, t: number, world: World): void {
  const p = world.players[run.playerId];
  if (!p) return;

  if (run.returning) {
    sync(p, t);
    const caps = worksCapsOf(p);
    const mined = run.mined ?? { alloy: 0, crystal: 0, deuterium: 0 };
    const alloy = Math.min(mined.alloy, Math.max(0, caps.alloy - p.bufferAlloy));
    const crystal = Math.min(mined.crystal, Math.max(0, caps.crystal - p.bufferCrystal));
    const deuterium = Math.min(
      mined.deuterium,
      Math.max(0, caps.deuterium - p.bufferDeuterium),
    );
    p.bufferAlloy += alloy;
    p.bufferCrystal += crystal;
    p.bufferDeuterium += deuterium;
    p.fleet.PROSPECTOR = (p.fleet.PROSPECTOR ?? 0) + run.craft;
    world.mining.alloyDelivered += alloy;
    world.mining.crystalDelivered += crystal;
    world.mining.deuteriumDelivered += deuterium;
    world.mining.overflowLost +=
      mined.alloy + mined.crystal + mined.deuterium - alloy - crystal - deuterium;
    return;
  }

  const rock = world.asteroids.find((candidate) => candidate.index === run.asteroidIndex);
  const already = world.asteroidClaims.get(run.asteroidIndex) ?? 0;
  const claim = rock
    ? claimOre(
        Math.max(0, rock.ore - already),
        run.holdEach * run.craft,
        rock.crystalShare,
        world.isotopes ? rock.deuteriumShare : 0,
      )
    : { taken: 0, alloy: 0, crystal: 0, deuterium: 0, remaining: 0 };
  if (claim.taken > 0) world.asteroidClaims.set(run.asteroidIndex, already + claim.taken);
  world.mining.oreClaimed += claim.taken;

  // As on the server, a Derrick installed while the craft is away affects its return —
  // and, also as on the server, the trip home is flown at a third of the outbound speed. D117.
  const home = travelExact(distance(run.intercept, p), prospectorReturnSpeed(p.orbit));
  world.miningRuns.push({
    ...run,
    arriveAt: t + home,
    returning: true,
    mined: { alloy: claim.alloy, crystal: claim.crystal, deuterium: claim.deuterium },
  });
}

/**
 * The smallest fleet worth launching, PRICED rather than counted.
 *
 * This was `fleetCount(p.fleet) < 8` — eight hulls of anything — a fair proxy only
 * while every combat hull cost about the same. An archetype fielding Lances at
 * 2,280 against a Wasp's 520 met a bar four times dearer for no stated reason, and
 * measured, four of six GRINDERs finished a season holding a good fleet they were
 * never allowed to launch while Wasp swarms sailed through the same gate.
 *
 * Derived from the cheapest combat hull, so it keeps meaning what it always meant
 * — eight Wasps' worth of fight — whatever a future hull table says.
 */
const MIN_RAID_VALUE =
  8 * Math.min(...COMBAT_HULLS.map((h) => HULLS[h].alloy + HULLS[h].crystal));

/* ── a bot session ─────────────────────────────────────────────── */

function runSession(p: SimPlayer, t: number, world: World, rng: Rng): void {
  sync(p, t);
  // First thing anyone does on opening the game, and the thing that restarts
  // production that the full buffer had stopped.
  collectWorks(p);
  const a = ARCHETYPES[p.type];

  /**
   * 0. Defence first, as insurance on what is currently raidable.
   *
   * TWO GUNS NOW, AND THE SPLIT IS THE ARCHETYPE'S OWN. D27. A defender used to have
   * no composition choice at all — there was one ground hull, so "how much defence"
   * was the entire decision. With a heavy Bulwark-class gun and a light
   * Skirmisher-class one, what a planet is strong AGAINST is a choice, and it is the
   * choice an attacker has to scout to discover.
   */
  {
    const raidable = Math.max(0, p.alloy - vaultProtects(p.buildings.VAULT, p.buildings.REFINERY, p.buildings.EXTRACTOR, p.buildings.DEUTERIUM_PLANT).alloy);
    const target = raidable * a.defenceRatio;
    const committedGround = { ...p.ground };
    for (const order of p.queues.YARD) {
      if (order.kind !== 'HULL') continue;
      const id = order.subject as HullId;
      if (HULLS[id].ground) committedGround[id] = (committedGround[id] ?? 0) + order.count;
    }
    const shortfall = target - fleetValue(committedGround);
    if (shortfall > 0) {
      for (const [id, share] of Object.entries(a.groundMix) as [GroundHullId, number][]) {
        const g = HULLS[id];
        if (p.buildings.SHIPYARD < g.minShipyard) continue;
        const want = Math.floor((shortfall * share) / (g.alloy + g.crystal));
        const n = Math.min(
          want,
          Math.floor((p.alloy * 0.5) / g.alloy),
          g.crystal > 0 ? Math.floor(p.crystal / g.crystal) : Infinity,
        );
        if (n > 0) {
          enqueueHullOrder(p, id, n, t, world, 'defence');
        }
      }
    }
  }

  /**
   * 1. Buildings, in archetype order. CORE gates everything else.
   *
   * THE SUNSET IS NOW MODELLED, and before Economy v2 it was not. The bots bought
   * an upgrade whenever they could afford one, right up to the wipe — so they ran
   * past the level where an upgrade stops repaying, sank the whole late season into
   * the one thing a raid can never take, and the gate read `ARR` LOW while Core
   * climbed two rungs past anything a real commander would buy.
   *
   * `worthInvesting` is the rule the DESIGN already had; the model of the player
   * simply did not know it. A commander with two days left does not build a mine
   * that repays in four — they build fleets, which is what the last act is for.
   */
  for (let pass = 0; pass < 3; pass++) {
    for (const key of a.buildOrder) {
      if (p.queues.CONSTRUCTION.length >= BUILD.queueDepth) break;
      const projected = projectedBuildState(p, world, 'CONSTRUCTION');
      const lvl = projected.buildings[key];
      if (key !== 'CORE' && lvl >= projected.buildings.CORE) continue;
      /*
        ROOM IS BOUGHT WHEN IT IS NEEDED, not because it is next on a list. T4.

        A Hangar earns nothing on its own — it lifts a ceiling — so `worthInvesting`
        below, which prices an upgrade against the hours of PRODUCTION left to repay
        it, cannot judge one. The demand test is the honest substitute: raise it once
        the fleet is actually pressing against what the world can hold. Without this a
        bot buys capacity for ships it never builds and the gate measures the cost of
        a mistake no real commander makes.
      */
      if (key === 'HANGAR'
        && ownedHangarLoad(p, world) < hangarCapacity(lvl) * HANGAR_PRESSURE) continue;
      // The plant answers to its research rung as well as to the Core. T5.
      if (key === 'DEUTERIUM_PLANT' && lvl >= plantCeiling(synthesisRung(p))) continue;
      const cost = buildingCost(key, lvl);
      const minutes = buildMinutes(cost, projected.buildings.CORE);
      const readyAt = nextSimBuildReadyAt(p, 'CONSTRUCTION', t, minutes);

      // A building only earns after it exists. The old instant model could use the
      // session clock directly; doing that with a queue lets a last-hour order pass
      // a payback test against hours in which it is still under construction.
      let productiveHours = Math.max(0, (world.totalMinutes - readyAt) / 60);
      if (key === 'CORE') {
        // Core has no output of its own. It is an economy investment only when a
        // producer is already at its ceiling, and only after that newly-unlocked
        // producer could finish behind it. This prevents a rational bot ending the
        // season with a paid Core whose sole payoff can no longer be constructed.
        const producerAt = Math.max(
          projected.buildings.REFINERY,
          projected.buildings.EXTRACTOR,
        );
        if (producerAt < lvl) continue;
        const producerMinutes = buildMinutes(buildingCost('REFINERY', producerAt), lvl + 1);
        const producerReadyAt = readyAt
          + Math.max(1, Math.ceil(producerMinutes * 60)) / 60;
        productiveHours = Math.max(0, (world.totalMinutes - producerReadyAt) / 60);
      }
      if (!worthInvesting(lvl, productiveHours)) continue;
      if (
        p.alloy >= cost.alloy && p.crystal >= cost.crystal &&
        p.alloy - cost.alloy > alloyRate(p.buildings.REFINERY) * 0.5
      ) {
        const placed = enqueueSimBuild(p, t, world, {
          queue: 'CONSTRUCTION',
          kind: 'BUILDING',
          subject: key,
          count: 1,
          cost,
          minutes,
        });
        if (placed) spendCrystal(world, 'buildings', cost.crystal);
      }
    }
  }

  /**
   * 2. ONE PIECE OF HARDWARE PER SESSION, off a single wishlist. D25.
   *
   * The archetype's `wants` mixes ground instruments and satellites in its own
   * priority order, and the first entry it can actually afford is what it buys.
   * Instruments are levelled and so stay on the list until the Command Core
   * ceiling stops them; a satellite drops off it the moment it is in orbit.
   *
   * WHY ONE LIST AND NOT TWO. The Uplink gates the Telescope and the Radar, so an
   * archetype whose first choice is a seeing instrument cannot reach it until a
   * satellite is bought. Modelled as two passes, the gated entries were skipped,
   * something cheaper was bought instead, and the Uplink never came — the GRINDER
   * played whole seasons blind and took the design's central claim down with it.
   *
   * THE BUDGET GUARD MATTERS TOO. Satellites cost several times a building at the
   * same level, and "buy whenever affordable" would have a bot empty its store into
   * orbit while its planet stands undefended. No player does that. Reserving the
   * archetype's military share is the same discipline the building pass applies
   * with its half-hour of production.
  */
  {
    for (const id of a.wants) {
      if (p.queues.CONSTRUCTION.length >= BUILD.queueDepth) break;
      const projected = projectedBuildState(p, world, 'CONSTRUCTION');
      const room = satelliteSlots(projected.buildings.CORE) - projected.orbit.length;
      const orbital = isSatellite(id);
      let cost;
      if (orbital) {
        if (room <= 0 || projected.orbit.includes(id)) continue;
        cost = satelliteCost(id);
      } else {
        const lvl = projected.instruments[id] ?? 0;
        if (lvl >= projected.buildings.CORE || instrumentMaxed(id, lvl)) continue;
        // The two seeing instruments hang off an Uplink in orbit (D25).
        if ((id === 'TELESCOPE' || id === 'RADAR') && !seeingUnlocked(projected.orbit)) continue;
        cost = instrumentCost(id, lvl);
      }

      /**
       * RESERVE BOTH METALS, NOT JUST ALLOY.
       *
       * Guarding alloy alone looks right and is not: pass 3 buys hulls out of a
       * share of ALLOY but clips the count by whatever CRYSTAL is left, and crystal
       * is the scarcer of the two. A guard that protects only alloy therefore lets
       * every hardware purchase come out of the fleet through the side door — the
       * galaxy's military fell by a sixth, and raid returns with it, while the bots
       * appeared to be reserving their military budget the whole time.
       */
      const keepAlloy = p.alloy * a.militaryShare;
      const keepCrystal = p.crystal * a.militaryShare;
      if (p.alloy - cost.alloy < keepAlloy) continue;
      if (p.crystal - cost.crystal < keepCrystal) continue;

      const placed = enqueueSimBuild(p, t, world, {
        queue: 'CONSTRUCTION',
        kind: orbital ? 'SATELLITE' : 'INSTRUMENT',
        subject: id,
        count: 1,
        cost,
        minutes: buildMinutes(cost, projected.buildings.CORE),
      });
      if (placed) {
        spendCrystal(world, 'hardware', cost.crystal);
        break;
      }
    }
  }

  // 2.5. Existing D19 economy: a scarce, losable utility hull before combat spend.
  tryBuyProspector(p, t, world);
  tryResearch(p, t, world);

  /**
   * 3. Offensive hulls from what remains, to the archetype's composition.
   *
   * This used to walk a dearest-first fixed list, buy the first hull it could
   * afford and `break` — so every bot in the galaxy spent its entire military
   * budget on the most expensive hull available to it, every session. That is the
   * inverse of the dominant composition, and it means every raid-return figure the
   * project has recorded was measured in a world where nobody fields a fleet that
   * works. See `Archetype.composition`.
   */
  {
    const yard = p.buildings.SHIPYARD;
    const researchReserve = researchDeuteriumReserve(p, t, world);
    const deuteriumForShips = () => Math.max(0, p.deuterium - researchReserve);
    const shieldedNeighbour = p.neighbours.some(
      ({ id }) => (world.players[id]?.instruments.AEGIS ?? 0) > 0,
    );
    const breacherPrice = hullPrice(world, 'NULLIFIER');
    const breachers = ownedMissionHull(p, world, 'NULLIFIER') + queuedHullCount(p, 'NULLIFIER');
    if (
      p.graviticCharges
      && shieldedNeighbour
      && hullBuildable('NULLIFIER', yard, p.tech)
      && breachers < 2
      && p.alloy >= breacherPrice.alloy
      && p.crystal >= breacherPrice.crystal
      && deuteriumForShips() >= breacherPrice.deuterium
    ) {
      enqueueHullOrder(p, 'NULLIFIER', 1, t, world, 'combat');
    }

    const budget = p.alloy * a.militaryShare;
    const ordinaryHulls = COMBAT_HULLS.filter((hull) => hull !== 'NULLIFIER');
    const affordableHulls = ordinaryHulls.filter((hull) => {
      const price = hullPrice(world, hull);
      return p.alloy >= price.alloy
        && p.crystal >= price.crystal
        && deuteriumForShips() >= price.deuterium;
    });
    const mix = a.adaptsComposition
      ? adaptiveMix(
        yard, a.composition, expectedDefence(p, t, a.composition), affordableHulls, p.tech,
      )
      : a.composition;

    // Only what the Shipyard can actually build, renormalised — otherwise a low
    // yard silently forfeits the share it cannot spend and under-buys all season.
    const open = COMBAT_HULLS.filter(
      (h) => (mix[h] ?? 0) > 0 && hullBuildable(h, yard, p.tech),
    );
    const total = open.reduce((sum, h) => sum + (mix[h] ?? 0), 0);

    if (total > 0) {
      /**
       * Biggest share first, carrying whatever a hull could not spend to the next.
       *
       * Without the carry an early budget is smaller than one hull of the preferred
       * type, every share rounds to zero, and a bot that can afford five Wasps buys
       * nothing at all for the first days of the season.
       */
      const order = [...open].sort((x, y) => (mix[y] ?? 0) - (mix[x] ?? 0));
      let carry = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (const hull of order) {
          if (p.queues.YARD.length >= BUILD.queueDepth) break;
          const price = hullPrice(world, hull);
          const spend = pass === 0 ? (budget * (mix[hull] ?? 0)) / total + carry : carry;
          if (spend < price.alloy) continue;
          let n = Math.floor(spend / price.alloy);
          n = Math.min(n, Math.floor(p.alloy / price.alloy));
          if (price.crystal > 0) n = Math.min(n, Math.floor(p.crystal / price.crystal));
          if (price.deuterium > 0) {
            n = Math.min(n, Math.floor(deuteriumForShips() / price.deuterium));
          }
          let committed = 0;
          if (n > 0) {
            if (enqueueHullOrder(p, hull, n, t, world, 'combat')) committed = n;
          }
          carry = Math.max(0, spend - committed * price.alloy);
        }
      }
    }

    // Settlement has an exact two-Courier contract. Keep those transports
    // reachable even when the archetype's ordinary logistics preference is a
    // heavier hull; otherwise a cargo preference would accidentally become a
    // colony permission.
    if (a.attackChance > 0 && hullBuildable('COURIER', yard, p.tech)) {
      const price = hullPrice(world, 'COURIER');
      const have = ownedMissionHull(p, world, 'COURIER') + queuedHullCount(p, 'COURIER');
      const n = Math.min(
        Math.max(0, MULTI_WORLD.settlement.transports - have),
        Math.floor((p.alloy * 0.2) / price.alloy),
        Math.floor(p.crystal / price.crystal),
        Math.floor(deuteriumForShips() / price.deuterium),
      );
      if (n > 0) enqueueHullOrder(p, 'COURIER', n, t, world, 'hauler');
    }

    // Cargo expresses the archetype's speed/capacity preference, then scales to
    // what a neighbour is likely holding instead of being bought one at a time.
    const cargoHull = a.cargoPreference.find((id) => hullBuildable(id, yard, p.tech));
    if (cargoHull && a.attackChance > 0) {
      const price = hullPrice(world, cargoHull);
      const nb = p.neighbours[0] ? world.players[p.neighbours[0].id] : undefined;
      const caps = nb ? capsOf(nb) : { alloy: 5000, crystal: 1500, deuterium: 0 };
      const want = Math.ceil(
        ((caps.alloy + caps.crystal + caps.deuterium) * 0.25) / HULLS[cargoHull].cargo,
      );
      const have = ownedMissionHull(p, world, cargoHull) + queuedHullCount(p, cargoHull);
      const n = Math.min(
        want - have,
        Math.floor((p.alloy * 0.3) / price.alloy),
        Math.floor(p.crystal / price.crystal),
        price.deuterium > 0
          ? Math.floor(deuteriumForShips() / price.deuterium)
          : Number.MAX_SAFE_INTEGER,
      );
      if (n > 0) {
        enqueueHullOrder(p, cargoHull, n, t, world, 'hauler');
      }
    }
  }

  tryMine(p, t, world);
  if (rng() < a.attackChance) tryAttack(p, t, world, rng);
  if (world.strategicEnabled) runStrategicSession(p, t, world);

  p.nextLogin = t + Math.max(20, Math.round((1440 / a.loginsPerDay) * (0.6 + rng() * 0.8)));
}

function tryAttack(p: SimPlayer, t: number, world: World, rng: Rng): void {
  const a = ARCHETYPES[p.type];
  // A Beacon in orbit shortens every leg this planet flies. D25.
  const raidFleet = raidingPart(p.fleet);
  const speed = fleetSpeed(raidFleet, p.tech) * fleetSpeedMult(p.orbit);
  if (speed <= 0 || fleetValue(combatPart(raidFleet)) < MIN_RAID_VALUE) return;
  p.wealthNow = totalWealth(p, world);

  let best: { q: SimPlayer; d: number; flight: number; score: number; scouted: boolean; defence: number | null } | null = null;

  for (const nb of p.neighbours.slice(0, 10)) {
    const q = world.players[nb.id];
    if (!q) continue;
    q.wealthNow = q.wealthNow || totalWealth(q, world);

    const hits = (p.recentHits.get(q.id) ?? []).filter((x) => t - x < ABUSE.bashWindowMinutes).length;
    /*
      ONE WORLD PER SIMULATED COMMANDER, SO THE PEAK IS THE ONLY CORE THERE IS.
      D168 measures the band on a commander's tallest Core across every world they
      hold; `SimPlayer` models a single planet, so this is that reading and not a
      shortcut past it. A simulator that ever grows colonies has to take the max
      here, or it will report a band the server does not enforce.
    */
    const gate = canAttack(
      { playerId: String(p.id), peakCoreLevel: p.buildings.CORE },
      { playerId: String(q.id), peakCoreLevel: q.buildings.CORE },
      hits,
    );
    if (!gate.ok) continue;

    const known = p.intel.get(q.id);
    const scouted = Boolean(a.scouts && known && t - known.at < 480);
    const defence = scouted && known ? known.defence : null;
    if (
      defence !== null
      && defence * 1.8 > fleetValue(combatPart(p.fleet)) * 0.95
      && ((q.instruments.AEGIS ?? 0) <= 0 || p.shieldInsightSeen)
    ) continue;

    /**
     * A BLIND ATTACKER KNOWS NOTHING ABOUT THE TARGET. D127.
     *
     * This is the change that made the simulator able to evaluate D127 at all.
     * The blind branch used to estimate a target's stock from `capsOf(q)` — the
     * target's own building levels — so the "blind" attacker could in fact read
     * exactly how developed every world in the galaxy was and pick the richest.
     * That was true while development was public. It is not any more: an unscouted
     * world is a point, and nothing about it is legible.
     *
     * So the prior is the attacker's own economy — "I assume they are about like
     * me" — which is the only honest thing a commander with no intel has to go on.
     * It depends on nothing about `q`, which is the property that matters: without
     * it the model measures a game where the fog does not exist, and the tier
     * band's removal reads as far more damaging than it is (`TI` fell out of band
     * on exactly this).
     */
    const blindCaps = capsOf(scouted ? q : p);
    const blindWorks = worksCapsOf(scouted ? q : p);
    /**
     * AND THE BLIND PRIOR IS NOISY, WHICH THE FIRST VERSION FORGOT.
     *
     * Estimating every unscouted target from the attacker's own economy makes
     * every unscouted target score IDENTICALLY, so the tie-break falls to distance
     * and the whole galaxy raids its nearest neighbour for ever. That is not
     * blindness, it is a different kind of perfect information — and it collapsed
     * the spread of who gets hit, which took shield encounters (and therefore
     * Gravitic Charges discovery) with it.
     *
     * A commander with no intel still picks somewhere, for reasons they could not
     * defend. The jitter is that: it varies the estimate without depending on
     * anything about the target, so the model keeps its variety and keeps its fog.
     */
    const blindPrior = (
      blindCaps.alloy + blindCaps.crystal + blindCaps.deuterium
      + blindWorks.alloy + blindWorks.crystal + blindWorks.deuterium
    ) * 0.35;
    const stock = scouted && known ? known.stock : blindPrior * (0.45 + rng() * 1.5);
    // The vault floor is read off the same side as the estimate above it: a blind
    // attacker cannot know the target's Vault any more than their store.
    const vaultOf = scouted ? q : p;
    const vault = vaultProtects(
      vaultOf.buildings.VAULT,
      vaultOf.buildings.REFINERY,
      vaultOf.buildings.EXTRACTOR,
      vaultOf.buildings.DEUTERIUM_PLANT,
    );
    const expectedLoot = Math.max(0, stock - (vault.alloy + vault.crystal)) * 0.5;
    const flight = travelMinutes(nb.d, speed);
    // A blind attacker cannot make this risk discount. That is the whole point.
    const risk = defence !== null ? 1 + defence / Math.max(1, fleetValue(p.fleet)) : 1.6;
    // Fresh intelligence should be actionable, not routinely displaced by a
    // fresh random blind guess on the next login.
    const score = (expectedLoot / ((flight + 10) * risk)) * (scouted ? 4 : 1);

    if (!best || score > best.score) best = { q, d: nb.d, flight, score, scouted, defence };
  }
  if (!best || best.score <= 0) return;

  /**
   * A SCOUT SCOUTS ALMOST ALWAYS NOW. D127.
   *
   * This was 0.7 while a commander could read a target's development straight off
   * the map: a probe bought precision on a choice you had already narrowed for
   * free, so skipping it three times in ten was a plausible shortcut. Under D127
   * there is no free narrowing — an unprobed world is a point — so a commander who
   * has decided to scout and then launches blind anyway is not taking a shortcut,
   * they are throwing a fleet at a coordinate.
   *
   * IT IS NOT 1.0, because a bay held by a probe is a bay a raid cannot use and
   * there is a real impatience in the decision. The other archetypes still never
   * scout, and that is deliberate: the spread between someone who looks and
   * someone who does not is exactly what D127 is supposed to make expensive, and
   * flattening it would delete the comparison.
   */
  if (a.scouts && !best.scouted && rng() < 0.9) {
    p.scoutsSent++;
    sync(best.q, t);
    // A probe that resolves an active dome has supplied the same actionable
    // shield telemetry as a battle report, without requiring a sacrificial raid.
    if ((best.q.instruments.AEGIS ?? 0) > 0 && best.q.shield > 0) {
      p.shieldInsightSeen = true;
    }
    p.intel.set(best.q.id, {
      stock:
        best.q.alloy + best.q.crystal + best.q.deuterium
        + best.q.bufferAlloy + best.q.bufferCrystal + best.q.bufferDeuterium,
      defence: fleetValue({ ...best.q.fleet, ...best.q.ground }),
      composition: { ...best.q.fleet, ...best.q.ground },
      at: t + 8,
    });
    return; // spends the session on the probe
  }

  // Escorts scale with the expected fight; cargo scales with the expected haul.
  const commit =
    best.scouted && best.defence !== null
      ? Math.min(0.95, Math.max(0.25, (best.defence * 1.8) / Math.max(1, fleetValue(p.fleet))))
      : 0.7 + rng() * 0.25;

  const send: Fleet = {};
  for (const k of MOBILE_HULLS) {
    const have = p.fleet[k] ?? 0;
    if (have <= 0) continue;
    // The dome is public but its strength is not. A Breacher is the response to
    // seeing that dome, never a generic fourth warship sent at bare worlds. D95.
    if (k === 'NULLIFIER' && (best.q.instruments.AEGIS ?? 0) <= 0) continue;
    const n = HULLS[k].profile === 'TRANSPORT' ? have : Math.floor(have * commit);
    if (n > 0) {
      send[k] = n;
      p.fleet[k] = have - n;
    }
  }
  if (fleetCount(send) === 0) return;

  /*
    FULL FUEL OR NO LAUNCH. T6.

    Both legs, before the ships leave, exactly as the server charges it — and the
    craft go back on the pad if the tank cannot cover it, because a bot that flew
    on credit would model a game the live rules refuse and every band measured off
    it would be measuring that other game.
  */
  const fuel = missionFuel(send, best.d, 2);
  if (p.deuterium - fuel < researchDeuteriumReserve(p, t, world)) {
    for (const [hull, n] of fleetEntries(send)) p.fleet[hull] = (p.fleet[hull] ?? 0) + n;
    return;
  }
  p.deuterium -= fuel;

  world.missions.push({
    from: p.id, to: best.q.id, fleet: send,
    arriveAt: t + best.flight, distance: best.d,
    scouted: best.scouted, returning: false,
  });
  p.attacks.push(t);
}

/* ── mission resolution ────────────────────────────────────────── */

function resolveMission(m: Mission, t: number, world: World, stats: DayStats): void {
  const atk = world.players[m.from];
  const def = world.players[m.to];
  if (!atk || !def) return;

  if (m.returning) {
    for (const [hull, n] of fleetEntries(m.fleet)) {
      atk.fleet[hull] = (atk.fleet[hull] ?? 0) + n;
    }
    sync(atk, t);
    const caps = capsOf(atk);
    atk.alloy = Math.min(caps.alloy, atk.alloy + (m.loot?.alloy ?? 0));
    atk.crystal = Math.min(caps.crystal, atk.crystal + (m.loot?.crystal ?? 0));
    atk.deuterium = Math.min(caps.deuterium, atk.deuterium + (m.loot?.deuterium ?? 0));
    return;
  }

  sync(def, t);
  // The server's definition, not a second copy of it: a bot whose miners fight
  // would price defence against a line the live game never puts on the board.
  const defenders = garrisonOf(def.fleet, def.ground);
  // Seeded from the mission, so any battle can be re-derived from its inputs.
  const rng = mulberry32((m.from * 7919 + m.to * 104729 + m.arriveAt) >>> 0);
  const r = resolveCombat(m.fleet, defenders, def.shield, rng, {
    attacker: { tech: atk.tech },
    defender: { tech: def.tech },
  });

  for (const k of Object.keys(def.fleet) as (keyof Fleet)[]) {
    // Carried across by hand for the same reason the server does it: a craft that
    // was never in the line is absent from the survivors, and `?? 0` would read
    // that absence as annihilation.
    if (NON_COMBATANT_HULLS.includes(k)) continue;
    def.fleet[k] = r.defenderSurvivors[k] ?? 0;
  }
  for (const k of Object.keys(def.ground) as (keyof Fleet)[]) {
    def.ground[k] = (r.defenderSurvivors[k] ?? 0) + (r.defenceSalvage[k] ?? 0);
  }
  def.shield = r.shieldLeft;

  const loot = computeLoot(
    { alloy: def.alloy, crystal: def.crystal, deuterium: def.deuterium },
    {
      alloy: def.bufferAlloy,
      crystal: def.bufferCrystal,
      deuterium: def.bufferDeuterium,
    },
    vaultProtects(def.buildings.VAULT, def.buildings.REFINERY, def.buildings.EXTRACTOR, def.buildings.DEUTERIUM_PLANT),
    r.grade,
    fleetCargo(r.attackerSurvivors, atk.tech),
  );
  // Two columns, debited separately — the works are not the store, and the vault
  // covers only one of them. D16.
  def.alloy -= loot.fromStock.alloy;
  def.crystal -= loot.fromStock.crystal;
  def.deuterium -= loot.fromStock.deuterium;
  def.bufferAlloy -= loot.fromBuffer.alloy;
  def.bufferCrystal -= loot.fromBuffer.crystal;
  def.bufferDeuterium -= loot.fromBuffer.deuterium;

  /** History-derived Dense Fuel discovery: the hold filled and value remained. */
  const survivingCargo = fleetCargo(r.attackerSurvivors, atk.tech);
  const remainingRaidable =
    Math.max(0, def.alloy - vaultProtects(def.buildings.VAULT, def.buildings.REFINERY, def.buildings.EXTRACTOR, def.buildings.DEUTERIUM_PLANT).alloy)
    + Math.max(0, def.crystal - vaultProtects(def.buildings.VAULT, def.buildings.REFINERY, def.buildings.EXTRACTOR, def.buildings.DEUTERIUM_PLANT).crystal)
    + def.deuterium
    + (def.bufferAlloy + def.bufferCrystal + def.bufferDeuterium) * COMBAT.lootBufferShare;
  if (survivingCargo > 0 && loot.alloy + loot.crystal + loot.deuterium >= survivingCargo - 1) {
    if (remainingRaidable > 1) atk.cargoLimitedSeen = true;
  }

  const outgoingDamage = r.rounds.reduce((sum, round) => sum + round.attackerDamage, 0);
  const shieldAbsorbed = r.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0);
  if (
    outgoingDamage > 0
    && shieldAbsorbed / outgoingDamage >= DEUTERIUM.graviticDiscoveryShieldShare
  ) {
    atk.shieldInsightSeen = true;
  }

  const wasUntil = def.disruptedUntil;
  def.disruptedUntil = applyDisruption(wasUntil, t, r.grade);
  const added = Math.max(0, def.disruptedUntil - Math.max(wasUntil, t));
  def.disruptedToday += added;

  bookBattle(atk.ledger, def.ledger, loot.alloy + loot.crystal + loot.deuterium, r);

  const lootValue = loot.alloy + loot.crystal + loot.deuterium;
  const gained = lootValue + r.defenderLossValue;
  stats.attacks++;
  stats.lootValue += lootValue;
  stats.attackerLossValue += r.attackerLossValue;
  stats.defenderLossValue += r.defenderLossValue;
  stats.disruptedMinutes += added;
  stats.byGrade[r.grade]++;
  if (m.scouted) {
    stats.scoutedAttacks++; stats.scoutedGain += gained; stats.scoutedLoss += r.attackerLossValue;
  } else {
    stats.blindAttacks++; stats.blindGain += gained; stats.blindLoss += r.attackerLossValue;
  }

  atk.lootToday += lootValue;
  def.lossToday += r.defenderLossValue + lootValue;
  const hits = atk.recentHits.get(def.id) ?? [];
  hits.push(t);
  atk.recentHits.set(def.id, hits);

  if (fleetCount(r.attackerSurvivors) > 0) {
    world.missions.push({
      from: m.from, to: m.to, fleet: r.attackerSurvivors,
      arriveAt: t + travelMinutes(
        m.distance,
        fleetSpeed(r.attackerSurvivors, atk.tech) * fleetSpeedMult(atk.orbit),
      ),
      distance: m.distance, scouted: m.scouted, returning: true, loot,
    });
  }
}

/* ── the season loop ───────────────────────────────────────────── */

export interface DayReport {
  day: number;
  stats: DayStats;
  invariants: Invariants;
}

export function runSeason(cfg: SimConfig): { world: World; days: DayReport[]; diagnostics: CrystalDiagnostics } {
  const world = buildWorld(cfg);
  const total = cfg.days * 1440;
  const days: DayReport[] = [];
  let stats = freshStats();

  for (let t = 0; t <= total; t++) {
    // Complete at the public instant before any decision or battle at this minute.
    // The queues run through disruption and never wait for the next login.
    advanceBuildQueues(world, t);
    if (world.strategicEnabled) {
      advanceStrategicLayer(world, t);
    }
    for (let i = world.missions.length - 1; i >= 0; i--) {
      const m = world.missions[i];
      if (m && m.arriveAt <= t) {
        world.missions.splice(i, 1);
        resolveMission(m, t, world, stats);
      }
    }
    const dueMining = world.miningRuns
      .filter((run) => run.arriveAt <= t)
      .sort((x, y) => x.arriveAt - y.arriveAt || x.id - y.id);
    if (dueMining.length > 0) {
      const dueIds = new Set(dueMining.map((run) => run.id));
      world.miningRuns = world.miningRuns.filter((run) => !dueIds.has(run.id));
      for (const run of dueMining) resolveMiningRun(run, t, world);
    }
    for (const p of world.players) {
      if (p.nextLogin <= t) runSession(p, t, world, world.rng);
    }
    if (t > 0) {
      for (const p of world.players) {
        if (p.crystal >= capsOf(p).crystal - 0.01) world.crystalCapPlayerMinutes += 1;
      }
    }
    if (t > 0 && t % 1440 === 0) {
      for (const neutral of world.neutrals) syncNeutral(neutral, t, world);
      for (const p of world.players) {
        sync(p, t);
        p.wealthNow = totalWealth(p, world);
      }
      const day = t / 1440;
      days.push({ day, stats, invariants: measure(day, world.players, stats) });
      for (const p of world.players) {
        p.wealthHistory.push(p.wealthNow);
        p.lootToday = 0;
        p.lossToday = 0;
        p.disruptedToday = 0;
      }
      stats = freshStats();
    }
  }
  const spentTotal = Object.values(world.crystalSpent).reduce((sum, value) => sum + value, 0);
  const spentShare = Object.fromEntries(
    Object.entries(world.crystalSpent).map(([key, value]) => [key, spentTotal > 0 ? value / spentTotal : 0]),
  ) as Record<CrystalSpendCategory, number>;
  const unused = world.players
    .map((player) => player.crystal + player.bufferCrystal)
    .sort((a, b) => a - b);
  const middle = Math.floor(unused.length / 2);
  const medianUnused = unused.length % 2 === 0
    ? ((unused[middle - 1] ?? 0) + (unused[middle] ?? 0)) / 2
    : (unused[middle] ?? 0);
  for (const neutral of world.neutrals) syncNeutral(neutral, total, world);
  const neutralTakenTotal = Object.values(world.strategic.neutralTaken)
    .reduce((sum, value) => sum + value, 0);
  const miningIncome = world.mining.alloyDelivered
    + world.mining.crystalDelivered
    + world.mining.deuteriumDelivered;
  const deathStarValue = resourcesTotal(DEATH_STAR.cost);
  const capitalHeldDeathStarValue = world.deathStars.size * deathStarValue;
  const remainingNeutral = ({ 1: 0, 2: 0, 3: 0 }) as Record<NeutralTier, number>;
  for (const neutral of world.neutrals) {
    if (neutral.controllerId === null) remainingNeutral[neutral.tier]++;
  }
  return {
    world,
    days,
    diagnostics: {
      capPlayerHours: world.crystalCapPlayerMinutes / 60,
      medianUnused,
      spent: { ...world.crystalSpent },
      spentShare,
      mining: { ...world.mining },
      strategic: {
        neutralMinted: { ...world.strategic.neutralMinted },
        neutralTaken: { ...world.strategic.neutralTaken },
        neutralLootShare: neutralTakenTotal / Math.max(1, neutralTakenTotal + miningIncome),
        uniqueNeutralRaiders: world.neutralRaiders.size,
        neutralRaids: world.strategic.neutralRaids,
        colonizedAt: {
          1: [...world.strategic.colonizedAt[1]],
          2: [...world.strategic.colonizedAt[2]],
          3: [...world.strategic.colonizedAt[3]],
        },
        remainingNeutral,
        coloniesPerPlayer: world.players.map((p) => coloniesOf(world, p.id).length),
        transferredResources: world.strategic.transferredResources,
        deathStar: { ...world.strategic.deathStar },
        recoveryThirdPartyArrivals: world.strategic.recoveryThirdPartyArrivals,
        capitalHeldDeathStarValue,
      },
    },
  };
}

export { dominion, investedInBuilding, capsOf, holdingsOf, totalWealth };
