import {
  ABUSE,
  ALL_HULLS,
  BUILD,
  COMBAT,
  DEATH_STAR,
  DEUTERIUM,
  MULTI_WORLD,
  SETTLEMENT_CLAIM_MINUTES,
  PROSPECTOR,
  RESEARCH_PROJECTS,
  activeAsteroids,
  asteroidPosition,
  claimOre,
  colonyCapacity,
  collectorCap,
  deuteriumCollectorCap,
  deuteriumStorageCap,
  defenceMinutes,
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  counterMult,
  advanceEconomy,
  alloyRate,
  applyDisruption,
  bookBattle,
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
  generateGalaxy,
  selectNeutralSlots,
  PLANET_START,
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
  resolveQueue,
  satelliteCost,
  satelliteSlots,
  seeingUnlocked,
  shieldHp,
  shipMinutes,
  storageCap,
  travelMinutes,
  upgradeCost,
  worthInvesting,
  vaultProtects,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type BuildQueueId,
  type Fleet,
  type Ledger,
  type Rng,
  type GroundHullId,
  type HullId,
  type InstrumentId,
  type InstrumentLevels,
  type NeutralLayout,
  type NeutralTier,
  type SatelliteId,
  type AsteroidSpec,
  type Resources,
  type ResearchProjectId,
} from '@astera/rules';
import { ARCHETYPES, ARCHETYPE_NAMES, type ArchetypeName, type CombatHullId, type Composition } from './archetypes.js';
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
  /** Paid work in the two independent Economy v2 queues. */
  queues: Record<BuildQueueId, SimBuildOrder[]>;
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
  cargoLimitedSeen: boolean;
  shieldInsightSeen: boolean;
}

export type SimBuildKind = 'BUILDING' | 'HULL' | 'INSTRUMENT' | 'SATELLITE' | 'RESEARCH';

/** The simulator's in-memory mirror of one active server build order. */
export interface SimBuildOrder {
  queue: BuildQueueId;
  kind: SimBuildKind;
  subject: string;
  count: number;
  cost: Resources;
  /** Full work duration, retained like `remainingSeconds` on the server row. */
  minutes: number;
  /** Absolute season minute; the two queues may finish independently. */
  readyAt: number;
}

export interface SimBuildProjection {
  buildings: BuildingLevels;
  instruments: InstrumentLevels;
  orbit: SatelliteId[];
  research: Set<ResearchProjectId>;
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
    buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
    instruments: {},
    orbit: [],
    // D22: no starting fleet, and the grant is what the opening costs. Mirrors
    // `joinSeason` exactly — a simulation that opens differently from the game is
    // measuring a different game.
    fleet: {},
    ground: {},
    queues: { CONSTRUCTION: [], YARD: [] },
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
        deuterium: deuteriumStorageCap(crystalPerHour, template.buildings.VAULT),
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
      cfg.spectrometryCrystalCost ?? RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.cost.crystal,
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

const REDISTRIBUTED_HULLS = new Set(['LANCE', 'BULWARK', 'HAULER', 'PROSPECTOR']);

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

const completedResearchOf = (p: SimPlayer, world: World): Set<ResearchProjectId> => {
  const completed = new Set<ResearchProjectId>();
  if (p.isotopeSpectrometry) completed.add('ISOTOPE_SPECTROMETRY');
  if (p.denseFuelCells) completed.add('DENSE_FUEL_CELLS');
  if (p.graviticCharges) completed.add('GRAVITIC_CHARGES');
  if (world.deathStarProtocol.has(p.id)) completed.add('DEATH_STAR_PROTOCOL');
  return completed;
};

/** Current state plus every order already ahead in one independent queue. */
export function projectedBuildState(
  p: SimPlayer,
  world: World,
  queue: BuildQueueId,
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
      projected.research.add(order.subject as ResearchProjectId);
    }
  }
  return projected;
}

const queuedHullCount = (p: SimPlayer, hull: HullId): number =>
  p.queues.YARD
    .filter((order) => order.kind === 'HULL' && order.subject === hull)
    .reduce((sum, order) => sum + order.count, 0);

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
  if ((input.kind === 'HULL') !== (input.queue === 'YARD')) return false;
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
  const readyAt = resolveQueue([{ queue: input.queue, minutes }], startsAt)[0];
  if (readyAt === undefined || readyAt > world.totalMinutes) return false;

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
  queue: BuildQueueId,
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
  else world.deathStarProtocol.add(p.id);
}

/** Complete due work at each order's exact instant; disruption never pauses it. */
export function advanceBuildQueues(world: World, t: number): void {
  for (const p of world.players) {
    const due = [...p.queues.CONSTRUCTION, ...p.queues.YARD]
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
  }
}

const queuedWealth = (p: SimPlayer): number =>
  [...p.queues.CONSTRUCTION, ...p.queues.YARD]
    .reduce((sum, order) => sum + resourcesTotal(order.cost), 0);

function enqueueHullOrder(
  p: SimPlayer,
  hull: HullId,
  count: number,
  t: number,
  world: World,
  category: CrystalSpendCategory,
): boolean {
  if (count < 1 || p.buildings.SHIPYARD < HULLS[hull].minShipyard) return false;
  const unit = hullPrice(world, hull);
  const cost = {
    alloy: unit.alloy * count,
    crystal: unit.crystal * count,
    deuterium: unit.deuterium * count,
  };
  const minutes = HULLS[hull].ground
    ? defenceMinutes(cost, p.buildings.SHIPYARD)
    : shipMinutes(cost, p.buildings.SHIPYARD);
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
  deuterium: deuteriumStorageCap(crystalRate(p.buildings.EXTRACTOR), p.buildings.VAULT),
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
    deuterium: deuteriumCollectorCap(crystalRate(p.buildings.EXTRACTOR) * boost),
  };
};

const worksOf = (p: SimPlayer) => ({
  refineryLevel: p.buildings.REFINERY,
  extractorLevel: p.buildings.EXTRACTOR,
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
      const cost = upgradeCost(n.buildings[type]);
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
  const tie: (keyof Fleet)[] = ['WASP', 'LANCE', 'BULWARK', 'THORN', 'BASTION'];
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
  const cargoHull = (p.fleet.HAULER ?? 0) > 0 ? 'HAULER'
    : (p.fleet.RUNNER ?? 0) > 0 ? 'RUNNER' : null;
  if (!cargoHull || (p.fleet.WASP ?? 0) <= 0) return null;
  if (tier === 1) return { WASP: Math.min(3, p.fleet.WASP ?? 0), [cargoHull]: 1 };
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
  const haulers = MULTI_WORLD.settlement.haulers;
  if (world.strategicRng() >= 0.18 || (p.fleet.HAULER ?? 0) < haulers) return;
  const cost = MULTI_WORLD.settlement.cost;
  if (p.alloy < cost.alloy || p.crystal < cost.crystal || p.deuterium < cost.deuterium) return;
  const flight = fleetTravelExact(distance(p, n), { HAULER: haulers });
  const arriveAt = t + flight;
  if (arriveAt > n.claimUntil) return;
  p.alloy -= cost.alloy;
  p.crystal -= cost.crystal;
  p.deuterium -= cost.deuterium;
  p.fleet.HAULER = (p.fleet.HAULER ?? 0) - haulers;
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
      arriveAt: t + fleetTravelExact(distance(p, n), send),
      fleet: send,
      returning: false,
    });
    return;
  }
}

function tryTransferToColony(p: SimPlayer, t: number, world: World): void {
  const colony = coloniesOf(world, p.id)[0];
  if (!colony || world.strategicRng() >= world.colonyTransferChance || (p.fleet.HAULER ?? 0) < 1) return;
  const cargo = {
    alloy: Math.min(600, Math.floor(p.alloy * 0.08)),
    crystal: Math.min(200, Math.floor(p.crystal * 0.08)),
    deuterium: Math.min(50, Math.floor(p.deuterium * 0.08)),
  };
  if (cargo.alloy + cargo.crystal + cargo.deuterium <= 0) return;
  p.alloy -= cargo.alloy;
  p.crystal -= cargo.crystal;
  p.deuterium -= cargo.deuterium;
  p.fleet.HAULER = (p.fleet.HAULER ?? 0) - 1;
  world.strategicMissions.push({
    id: world.nextStrategicMissionId++,
    kind: 'transfer',
    ownerId: p.id,
    targetId: colony.id,
    arriveAt: t + fleetTravelExact(distance(p, colony), { HAULER: 1 }),
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
    const projected = projectedBuildState(p, world, 'CONSTRUCTION');
    // Already paid and waiting: the strategic asset cannot start until the
    // research completion has made the permission durable.
    if (projected.research.has('DEATH_STAR_PROTOCOL')) return;
    if (
      !projected.research.has('GRAVITIC_CHARGES')
      || projected.buildings.CORE < (RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.requiredCore ?? 0)
    ) return;
    const research = RESEARCH_PROJECTS.DEATH_STAR_PROTOCOL.cost;
    if (p.alloy < research.alloy || p.crystal < research.crystal || p.deuterium < research.deuterium) return;
    const placed = enqueueSimBuild(p, t, world, {
      queue: 'CONSTRUCTION',
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
        arriveAt: t + fleetTravelExact(distance(p, target), mission.fleet),
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
    );
    target.fleet = { ...result.defenderSurvivors, ...result.defenceSalvage };
    const loot = computeLoot(
      { alloy: target.alloy, crystal: target.crystal, deuterium: target.deuterium },
      EMPTY_RESOURCES,
      EMPTY_RESOURCES,
      result.grade,
      fleetCargo(result.attackerSurvivors),
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
        arriveAt: t + fleetTravelExact(distance(p, target), result.attackerSurvivors),
        fleet: result.attackerSurvivors,
        returning: true,
        cargo: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
      });
    }
    return;
  }
  if (mission.kind === 'settlement') {
    const haulers = MULTI_WORLD.settlement.haulers;
    if (target.controllerId === null && target.claimUntil !== null && target.claimUntil >= t) {
      target.controllerId = p.id;
      target.claimUntil = null;
      target.protectedUntil = t + MULTI_WORLD.occupationMinutes;
      target.fleet.HAULER = (target.fleet.HAULER ?? 0) + haulers;
      world.strategic.colonizedAt[target.tier].push(t);
    } else {
      p.fleet.HAULER = (p.fleet.HAULER ?? 0) + haulers;
      p.alloy += MULTI_WORLD.settlement.cost.alloy;
      p.crystal += MULTI_WORLD.settlement.cost.crystal;
    }
    return;
  }
  if (mission.kind === 'transfer') {
    if (target.controllerId === p.id) {
      target.alloy += mission.cargo.alloy;
      target.crystal += mission.cargo.crystal;
      target.deuterium += mission.cargo.deuterium;
      target.fleet.HAULER = (target.fleet.HAULER ?? 0) + 1;
      world.strategic.transferredResources +=
        mission.cargo.alloy + mission.cargo.crystal + mission.cargo.deuterium;
    } else {
      p.fleet.HAULER = (p.fleet.HAULER ?? 0) + 1;
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
    target.recoveryUntil = t + MULTI_WORLD.recoveryMinutes;
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
    total += Object.values(n.buildings)
      .reduce((sum, level) => sum + investedInBuilding(level), 0);
    total += investedInInstrument('AEGIS', n.aegis);
    total += fleetValue(n.fleet) + n.alloy + n.crystal + n.deuterium;
  }
  if (world.deathStars.has(p.id)) total += resourcesTotal(DEATH_STAR.cost);
  for (const mission of world.strategicMissions.filter((m) => m.ownerId === p.id)) {
    if (mission.kind === 'death_star') total += resourcesTotal(DEATH_STAR.cost);
    if (mission.kind === 'settlement') {
      total += MULTI_WORLD.settlement.haulers * (HULLS.HAULER.alloy + HULLS.HAULER.crystal);
    }
    if (mission.kind === 'transfer') {
      total += HULLS.HAULER.alloy + HULLS.HAULER.crystal + resourcesTotal(mission.cargo);
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

/** Every hull that fights. Haulers carry; ground units never leave. */
export const COMBAT_HULLS: readonly CombatHullId[] = MOBILE_HULLS.filter(
  (h): h is CombatHullId => h !== 'HAULER' && h !== 'RUNNER',
);

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
): Composition {
  const buildable = permitted.filter((h) => yard >= HULLS[h].minShipyard);
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

/** Only what fights. Haulers are cargo — eight of them are not a raid. */
const combatPart = (fleet: Fleet): Fleet =>
  Object.fromEntries(COMBAT_HULLS.map((h) => [h, fleet[h] ?? 0]));

/** What may be packed into a raid: combat hulls plus cargo, never mining craft. */
const raidingPart = (fleet: Fleet): Fleet => ({
  ...combatPart(fleet),
  HAULER: fleet.HAULER ?? 0,
  RUNNER: fleet.RUNNER ?? 0,
});

const ownedProspectors = (p: SimPlayer, world: World): number =>
  (p.fleet.PROSPECTOR ?? 0)
  + world.miningRuns
    .filter((run) => run.playerId === p.id)
    .reduce((sum, run) => sum + run.craft, 0);

/** Home plus every outbound/return stack still owned by this commander. */
const ownedMissionHull = (p: SimPlayer, world: World, hull: CombatHullId | 'RUNNER'): number =>
  (p.fleet[hull] ?? 0)
  + world.missions
    .filter((mission) => mission.from === p.id)
    .reduce((sum, mission) => sum + (mission.fleet[hull] ?? 0), 0);

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

/**
 * The one current project, bought only by a commander who already committed to
 * mining. This is conservative about adoption without pretending a non-miner
 * would burn Crystal on a permission they cannot use. D93.
 */
function tryResearch(p: SimPlayer, t: number, world: World): void {
  if (!world.isotopes) return;
  if (!ARCHETYPES[p.type].researchesIsotopes) return;
  let projected = projectedBuildState(p, world, 'CONSTRUCTION');
  if (!projected.research.has('ISOTOPE_SPECTROMETRY')) {
    if (t < RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.availableAtMinutes) return;
    if (ownedProspectors(p, world) + queuedHullCount(p, 'PROSPECTOR') < 1) return;
    const cost = {
      ...RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.cost,
      crystal: world.spectrometryCrystalCost,
    };
    if (
      p.alloy < cost.alloy
      || p.crystal < cost.crystal
      || p.deuterium < cost.deuterium
    ) return;
    const placed = enqueueSimBuild(p, t, world, {
      queue: 'CONSTRUCTION',
      kind: 'RESEARCH',
      subject: 'ISOTOPE_SPECTROMETRY',
      count: 1,
      cost,
      minutes: researchMinutes(cost, projected.buildings.CORE),
    });
    if (placed) spendCrystal(world, 'research', cost.crystal);
    return;
  }

  if (
    !projected.research.has('DENSE_FUEL_CELLS')
    && ARCHETYPES[p.type].researchesRunner
    && p.cargoLimitedSeen
  ) {
    const cost = RESEARCH_PROJECTS.DENSE_FUEL_CELLS.cost;
    const affordable =
      p.alloy >= cost.alloy
      && p.crystal >= cost.crystal
      && p.deuterium >= cost.deuterium;
    if (affordable) {
      const placed = enqueueSimBuild(p, t, world, {
        queue: 'CONSTRUCTION',
        kind: 'RESEARCH',
        subject: 'DENSE_FUEL_CELLS',
        count: 1,
        cost,
        minutes: researchMinutes(cost, projected.buildings.CORE),
      });
      if (placed) spendCrystal(world, 'research', cost.crystal);
    }
  }

  projected = projectedBuildState(p, world, 'CONSTRUCTION');
  if (
    !projected.research.has('GRAVITIC_CHARGES')
    && ARCHETYPES[p.type].researchesBreacher
    && p.shieldInsightSeen
  ) {
    const cost = RESEARCH_PROJECTS.GRAVITIC_CHARGES.cost;
    const affordable =
      p.alloy >= cost.alloy
      && p.crystal >= cost.crystal
      && p.deuterium >= cost.deuterium;
    if (affordable) {
      const placed = enqueueSimBuild(p, t, world, {
        queue: 'CONSTRUCTION',
        kind: 'RESEARCH',
        subject: 'GRAVITIC_CHARGES',
        count: 1,
        cost,
        minutes: researchMinutes(cost, projected.buildings.CORE),
      });
      if (placed) spendCrystal(world, 'research', cost.crystal);
    }
  }
}

/** Compare a few nearby visible rocks, preserving shared first-arrival races. */
function tryMine(p: SimPlayer, t: number, world: World): void {
  const craft = p.fleet.PROSPECTOR ?? 0;
  if (craft <= 0 || world.miningRng() >= ARCHETYPES[p.type].miningChance) return;

  const speed = prospectorSpeed(p.orbit);
  const holdEach = prospectorHold(p.orbit);
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
    const raidable = Math.max(0, p.alloy - vaultProtects(p.buildings.VAULT, p.buildings.REFINERY, p.buildings.EXTRACTOR).alloy);
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
      const cost = upgradeCost(lvl);
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
        const producerMinutes = buildMinutes(upgradeCost(producerAt), lvl + 1);
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
   * This used to walk `['BULWARK','LANCE','WASP']`, buy the first hull it could
   * afford and `break` — so every bot in the galaxy spent its entire military
   * budget on the most expensive hull available to it, every session. That is the
   * inverse of the dominant composition, and it means every raid-return figure the
   * project has recorded was measured in a world where nobody fields a fleet that
   * works. See `Archetype.composition`.
   */
  {
    const yard = p.buildings.SHIPYARD;
    const shieldedNeighbour = p.neighbours.some(
      ({ id }) => (world.players[id]?.instruments.AEGIS ?? 0) > 0,
    );
    const breacherPrice = hullPrice(world, 'BREACHER');
    const breachers = ownedMissionHull(p, world, 'BREACHER') + queuedHullCount(p, 'BREACHER');
    if (
      p.graviticCharges
      && shieldedNeighbour
      && yard >= HULLS.BREACHER.minShipyard
      && breachers < 2
      && p.alloy >= breacherPrice.alloy
      && p.crystal >= breacherPrice.crystal
      && p.deuterium >= breacherPrice.deuterium
    ) {
      enqueueHullOrder(p, 'BREACHER', 1, t, world, 'combat');
    }

    const budget = p.alloy * a.militaryShare;
    const ordinaryHulls = COMBAT_HULLS.filter((hull) => hull !== 'BREACHER');
    const mix = a.adaptsComposition
      ? adaptiveMix(yard, a.composition, expectedDefence(p, t, a.composition), ordinaryHulls)
      : a.composition;

    // Only what the Shipyard can actually build, renormalised — otherwise a low
    // yard silently forfeits the share it cannot spend and under-buys all season.
    const open = COMBAT_HULLS.filter((h) => (mix[h] ?? 0) > 0 && yard >= HULLS[h].minShipyard);
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
          if (price.deuterium > 0) n = Math.min(n, Math.floor(p.deuterium / price.deuterium));
          let committed = 0;
          if (n > 0) {
            if (enqueueHullOrder(p, hull, n, t, world, 'combat')) committed = n;
          }
          carry = Math.max(0, spend - committed * price.alloy);
        }
      }
    }

    // A few fast holds first. Expensive per cargo, bounded, and paid in mined D.
    if (p.denseFuelCells && yard >= HULLS.RUNNER.minShipyard) {
      const price = hullPrice(world, 'RUNNER');
      const have = ownedMissionHull(p, world, 'RUNNER') + queuedHullCount(p, 'RUNNER');
      const target = p.type === 'GRINDER' ? 3 : 2;
      const n = Math.min(
        Math.max(0, target - have),
        Math.floor((p.alloy * 0.2) / price.alloy),
        Math.floor(p.crystal / price.crystal),
        Math.floor(p.deuterium / price.deuterium),
      );
      if (n > 0) {
        enqueueHullOrder(p, 'RUNNER', n, t, world, 'hauler');
      }
    }

    // Cargo sized to what a neighbour is likely holding, not bought one at a time.
    if (yard >= HULLS.HAULER.minShipyard && a.attackChance > 0) {
      const price = hullPrice(world, 'HAULER');
      const nb = p.neighbours[0] ? world.players[p.neighbours[0].id] : undefined;
      const caps = nb ? capsOf(nb) : { alloy: 5000, crystal: 1500, deuterium: 0 };
      const want = Math.ceil(
        ((caps.alloy + caps.crystal + caps.deuterium) * 0.25) / HULLS.HAULER.cargo,
      );
      const have = (p.fleet.HAULER ?? 0) + queuedHullCount(p, 'HAULER');
      const n = Math.min(
        want - have,
        Math.floor((p.alloy * 0.3) / price.alloy),
        Math.floor(p.crystal / price.crystal),
      );
      if (n > 0) {
        enqueueHullOrder(p, 'HAULER', n, t, world, 'hauler');
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
  const speed = fleetSpeed(raidFleet) * fleetSpeedMult(p.orbit);
  if (speed <= 0 || fleetValue(combatPart(raidFleet)) < MIN_RAID_VALUE) return;
  p.wealthNow = totalWealth(p, world);

  let best: { q: SimPlayer; d: number; flight: number; score: number; scouted: boolean; defence: number | null } | null = null;

  for (const nb of p.neighbours.slice(0, 10)) {
    const q = world.players[nb.id];
    if (!q) continue;
    q.wealthNow = q.wealthNow || totalWealth(q, world);

    const hits = (p.recentHits.get(q.id) ?? []).filter((x) => t - x < ABUSE.bashWindowMinutes).length;
    const gate = canAttack(
      // D49: the band is measured in development tiers, not in Wealth.
      { playerId: String(p.id), coreLevel: p.buildings.CORE },
      { playerId: String(q.id), coreLevel: q.buildings.CORE },
      hits,
    );
    if (!gate.ok) continue;

    const known = p.intel.get(q.id);
    const scouted = Boolean(a.scouts && known && t - known.at < 120);
    const defence = scouted && known ? known.defence : null;

    /**
     * A scout learns what a planet is holding; a blind attacker guesses from how
     * developed it looks.
     *
     * Both figures count the works as well as the store (D16) — a target's storage
     * is now a transient that empties minutes after its owner logs in, so a guess
     * or a measurement that looked only at storage would describe every planet in
     * the galaxy as empty.
     */
    /**
     * AND THE BLIND GUESS COUNTS THE WORKS TOO, which is what the note above always
     * claimed and the expression never did. D52a.
     *
     * `capsOf` is storage alone. The scouted branch was updated for D16 — it reads
     * `bufferAlloy + bufferCrystal` off the real planet — and this one was not, so a
     * blind attacker under-valued every target by roughly the collector ceiling and
     * the model preferred scouted targets for a reason that was an omission rather
     * than an effect. That is the kind of silent skew that makes a `TAX` reading
     * uninterpretable, which matters because `TAX` is one of the two gate
     * assertions currently red.
     */
    const blindCaps = capsOf(q);
    const blindWorks = worksCapsOf(q);
    const stock =
      scouted && known
        ? known.stock
        : (
            blindCaps.alloy + blindCaps.crystal + blindCaps.deuterium
            + blindWorks.alloy + blindWorks.crystal + blindWorks.deuterium
          ) * 0.35;
    const vault = vaultProtects(q.buildings.VAULT, q.buildings.REFINERY, q.buildings.EXTRACTOR);
    /**
     * `stock` above is alloy and crystal added together, so the floor deducted
     * from it has to be both floors added together too — which is what `vault * 2`
     * meant while the two were the same number. They are not any more (D61).
     */
    const expectedLoot = Math.max(0, stock - (vault.alloy + vault.crystal)) * 0.5;
    const flight = travelMinutes(nb.d, speed);
    // A blind attacker cannot make this risk discount. That is the whole point.
    const risk = defence !== null ? 1 + defence / Math.max(1, fleetValue(p.fleet)) : 1.6;
    const score = expectedLoot / ((flight + 10) * risk);

    if (!best || score > best.score) best = { q, d: nb.d, flight, score, scouted, defence };
  }
  if (!best || best.score <= 0) return;

  if (a.scouts && !best.scouted && rng() < 0.7) {
    p.scoutsSent++;
    sync(best.q, t);
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
    if (k === 'BREACHER' && (best.q.instruments.AEGIS ?? 0) <= 0) continue;
    const n = k === 'HAULER' || k === 'RUNNER' ? have : Math.floor(have * commit);
    if (n > 0) {
      send[k] = n;
      p.fleet[k] = have - n;
    }
  }
  if (fleetCount(send) === 0) return;

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
  const defenders: Fleet = { ...def.fleet, ...def.ground };
  // Seeded from the mission, so any battle can be re-derived from its inputs.
  const rng = mulberry32((m.from * 7919 + m.to * 104729 + m.arriveAt) >>> 0);
  const r = resolveCombat(m.fleet, defenders, def.shield, rng);

  for (const k of Object.keys(def.fleet) as (keyof Fleet)[]) {
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
    vaultProtects(def.buildings.VAULT, def.buildings.REFINERY, def.buildings.EXTRACTOR),
    r.grade,
    fleetCargo(r.attackerSurvivors),
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
  const survivingCargo = fleetCargo(r.attackerSurvivors);
  const remainingRaidable =
    Math.max(0, def.alloy - vaultProtects(def.buildings.VAULT, def.buildings.REFINERY, def.buildings.EXTRACTOR).alloy)
    + Math.max(0, def.crystal - vaultProtects(def.buildings.VAULT, def.buildings.REFINERY, def.buildings.EXTRACTOR).crystal)
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
      arriveAt: t + travelMinutes(m.distance, fleetSpeed(r.attackerSurvivors) * fleetSpeedMult(atk.orbit)),
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
