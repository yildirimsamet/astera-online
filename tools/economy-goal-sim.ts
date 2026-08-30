#!/usr/bin/env -S pnpm exec tsx
/**
 * Fixed-goal economy simulator.
 *
 * This answers one deliberately narrow pacing question with the rules that are
 * currently configured: how long does a highly attentive commander need to reach
 * the owner's mid-game target if every spend serves that target?
 *
 * It is not a season/battle simulator. It does account for the real construction
 * and yard queues, projected queue gates, manual collection, storage and works
 * caps, level-dependent production, Foundry production, building rewards,
 * research clocks, research costs and the otherwise easy-to-miss Deuterium
 * requirement. Combat losses and ordinary fleet spending are excluded on
 * purpose, so the result is a progression baseline rather than a prediction of
 * what every human will do.
 *
 *   pnpm balance:goal
 */

import {
  BUILD,
  DEUTERIUM,
  GALAXY,
  HULLS,
  PLANET_START,
  PROSPECTOR,
  RESEARCH_PROJECTS,
  REWARD_CHAINS,
  SATELLITES,
  SATELLITE_IDS,
  START_BUILDINGS,
  advanceEconomy,
  alloyRate,
  buildMinutes,
  collect,
  crystalRate,
  deuteriumCollectorCap,
  generateGalaxy,
  instrumentCost,
  productionMult,
  researchMinutes,
  satelliteCost,
  satelliteSlots,
  shipMinutes,
  upgradeCost,
  type BuildingId,
  type InstrumentId,
  type InstrumentLevels,
  type PlanetEconomyState,
  type ResearchProjectId,
  type Resources,
  type SatelliteId,
} from '../packages/rules/src/index.js';

const STEP_MINUTES = 0.25;
const MAX_DAYS = 16;
const TARGET_DAYS = 8;
const DEVELOPMENT_SHARE = 0.5;
const DEVELOPMENT_MIN_DAYS = 6;
const DEVELOPMENT_MAX_DAYS = 7;
const RESEARCH_ORDER: readonly ResearchProjectId[] = [
  'ISOTOPE_SPECTROMETRY',
  'DENSE_FUEL_CELLS',
  'GRAVITIC_CHARGES',
  'DEATH_STAR_PROTOCOL',
];

const TARGET_BUILDINGS = {
  CORE: 12,
  REFINERY: 12,
  EXTRACTOR: 12,
  VAULT: 10,
  SHIPYARD: 1,
} as const satisfies Record<BuildingId, number>;

const TARGET_INSTRUMENTS = {
  TELESCOPE: 5,
  RADAR: 5,
} as const satisfies Partial<Record<InstrumentId, number>>;

type ActivityId = 'EIGHT_HOURS' | 'TWELVE_HOURS' | 'ALWAYS';

interface ActivityProfile {
  readonly id: ActivityId;
  readonly label: string;
  readonly active: (minuteOfDay: number) => boolean;
}

const ACTIVITY: readonly ActivityProfile[] = [
  {
    id: 'EIGHT_HOURS',
    label: '8h / 12h awake',
    // Four focused two-hour blocks with one-hour breaks. The last block ends at
    // hour eleven, leaving a realistic thirteen-hour overnight gap.
    active: (minute) =>
      (minute >= 0 && minute < 120)
      || (minute >= 180 && minute < 300)
      || (minute >= 360 && minute < 480)
      || (minute >= 540 && minute < 660),
  },
  {
    id: 'TWELVE_HOURS',
    label: '12h frequent checks',
    active: (minute) => minute >= 0 && minute < 720,
  },
  {
    id: 'ALWAYS',
    label: '24/7 lower bound',
    active: () => true,
  },
];

type OrderKind = 'BUILDING' | 'INSTRUMENT' | 'SATELLITE' | 'RESEARCH' | 'HULL';

interface SimOrder {
  readonly queue: 'CONSTRUCTION' | 'YARD';
  readonly kind: OrderKind;
  readonly subject: BuildingId | InstrumentId | SatelliteId | ResearchProjectId | 'PROSPECTOR';
  readonly cost: Resources;
  readonly minutes: number;
  readonly readyAt: number;
}

interface Projection {
  buildings: Record<BuildingId, number>;
  instruments: InstrumentLevels;
  orbit: SatelliteId[];
  research: Set<ResearchProjectId>;
}

interface SpendLedger {
  buildings: number;
  instruments: number;
  satellites: number;
  research: number;
  prospectors: number;
}

interface SimState {
  buildings: Record<BuildingId, number>;
  instruments: InstrumentLevels;
  orbit: SatelliteId[];
  research: Set<ResearchProjectId>;
  prospectors: number;
  economy: PlanetEconomyState;
  queues: { CONSTRUCTION: SimOrder[]; YARD: SimOrder[] };
  claimedRewards: Set<string>;
  milestones: Map<string, number>;
  spent: SpendLedger;
  produced: Resources;
  wasted: Resources;
  rewards: Resources;
  constructionBusyMinutes: number;
  constructionIdleActiveMinutes: number;
  constructionIdleOfflineMinutes: number;
}

interface SimOptions {
  readonly activity: ActivityProfile;
  readonly rewards: boolean;
  /** Net Deuterium delivered per day by two Prospectors with a Derrick. */
  readonly deuteriumPerDay: number;
  readonly foundryTier: number;
  /** Share of newly collected Alloy/Crystal reserved for this fixed goal. */
  readonly developmentShare: number;
}

interface SimResult {
  readonly options: SimOptions;
  readonly reachedAt: number | null;
  readonly state: SimState;
}

const emptyResources = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const total = (resources: Resources): number =>
  resources.alloy + resources.crystal + resources.deuterium;
const addResources = (target: Resources, amount: Resources): void => {
  target.alloy += amount.alloy;
  target.crystal += amount.crystal;
  target.deuterium += amount.deuterium;
};
const canAfford = (state: PlanetEconomyState, cost: Resources): boolean =>
  state.alloy + 1e-9 >= cost.alloy
  && state.crystal + 1e-9 >= cost.crystal
  && state.deuterium + 1e-9 >= cost.deuterium;

const minuteOfDay = (now: number): number => ((now % 1440) + 1440) % 1440;
const isActive = (profile: ActivityProfile, now: number): boolean =>
  profile.active(minuteOfDay(now));

function freshState(): SimState {
  return {
    buildings: { ...START_BUILDINGS },
    instruments: {},
    orbit: [],
    research: new Set(),
    prospectors: 0,
    economy: {
      alloy: PLANET_START.alloy,
      crystal: PLANET_START.crystal,
      deuterium: PLANET_START.deuterium,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      shield: 0,
      lastTickMinutes: 0,
      disruptedUntilMinutes: 0,
    },
    queues: { CONSTRUCTION: [], YARD: [] },
    claimedRewards: new Set(),
    milestones: new Map(),
    spent: { buildings: 0, instruments: 0, satellites: 0, research: 0, prospectors: 0 },
    produced: emptyResources(),
    wasted: emptyResources(),
    rewards: emptyResources(),
    constructionBusyMinutes: 0,
    constructionIdleActiveMinutes: 0,
    constructionIdleOfflineMinutes: 0,
  };
}

function projectConstruction(state: SimState): Projection {
  const projected: Projection = {
    buildings: { ...state.buildings },
    instruments: { ...state.instruments },
    orbit: [...state.orbit],
    research: new Set(state.research),
  };
  for (const order of state.queues.CONSTRUCTION) applyProjection(projected, order);
  return projected;
}

function applyProjection(projected: Projection, order: SimOrder): void {
  if (order.kind === 'BUILDING') {
    projected.buildings[order.subject as BuildingId] += 1;
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

function effectiveOrbit(projected: Projection): SatelliteId[] {
  return projected.orbit.slice(0, satelliteSlots(projected.buildings.CORE));
}

function constructionOrder(
  now: number,
  state: SimState,
  projected: Projection,
  kind: Exclude<OrderKind, 'HULL'>,
  subject: BuildingId | InstrumentId | SatelliteId | ResearchProjectId,
  cost: Resources,
  research = false,
): SimOrder {
  const minutes = research
    ? researchMinutes(cost, projected.buildings.CORE)
    : buildMinutes(cost, projected.buildings.CORE);
  const startsAt = state.queues.CONSTRUCTION.at(-1)?.readyAt ?? now;
  return {
    queue: 'CONSTRUCTION',
    kind,
    subject,
    cost,
    minutes,
    readyAt: startsAt + Math.max(1, Math.ceil(minutes * 60)) / 60,
  };
}

function buildingCandidate(
  now: number,
  state: SimState,
  projected: Projection,
  id: BuildingId,
): SimOrder {
  return constructionOrder(
    now,
    state,
    projected,
    'BUILDING',
    id,
    upgradeCost(projected.buildings[id]),
  );
}

function nextEconomyBuilding(projected: Projection): BuildingId | null {
  const { CORE: core, REFINERY: refinery, EXTRACTOR: extractor, VAULT: vault } =
    projected.buildings;
  const desiredVault = Math.min(TARGET_BUILDINGS.VAULT, Math.max(0, Math.min(refinery, extractor) - 2));
  if (vault < desiredVault) return 'VAULT';
  if (refinery < TARGET_BUILDINGS.REFINERY && refinery < core && refinery <= extractor) {
    return 'REFINERY';
  }
  if (extractor < TARGET_BUILDINGS.EXTRACTOR && extractor < core) return 'EXTRACTOR';
  if (core < TARGET_BUILDINGS.CORE) return 'CORE';
  return null;
}

function researchCandidate(
  now: number,
  state: SimState,
  projected: Projection,
): SimOrder | null {
  for (const id of RESEARCH_ORDER) {
    if (projected.research.has(id)) continue;
    const project = RESEARCH_PROJECTS[id];
    if (now < project.availableAtMinutes) continue;
    if ((project.requiredCore ?? 0) > projected.buildings.CORE) continue;
    if (project.prerequisite !== null && !projected.research.has(project.prerequisite)) continue;
    // Dense Fuel and Gravitic Charges are normally discovered through combat.
    // This focused economy run assumes those insights have been earned at the
    // earliest legal opportunity; the output calls that assumption out.
    return constructionOrder(now, state, projected, 'RESEARCH', id, project.costAt(1), true);
  }
  return null;
}

function satelliteCandidate(
  now: number,
  state: SimState,
  projected: Projection,
  id: SatelliteId,
): SimOrder | null {
  if (projected.orbit.includes(id)) return null;
  if (projected.orbit.length >= satelliteSlots(projected.buildings.CORE)) return null;
  return constructionOrder(now, state, projected, 'SATELLITE', id, satelliteCost(id));
}

function instrumentCandidate(
  now: number,
  state: SimState,
  projected: Projection,
): SimOrder | null {
  if (!effectiveOrbit(projected).includes('UPLINK')) return null;
  const telescope = projected.instruments.TELESCOPE ?? 0;
  const radar = projected.instruments.RADAR ?? 0;
  const id: InstrumentId = telescope <= radar ? 'TELESCOPE' : 'RADAR';
  const level = projected.instruments[id] ?? 0;
  const target = TARGET_INSTRUMENTS[id];
  if (level >= target || level >= projected.buildings.CORE) {
    const other: InstrumentId = id === 'TELESCOPE' ? 'RADAR' : 'TELESCOPE';
    const otherLevel = projected.instruments[other] ?? 0;
    const otherTarget = TARGET_INSTRUMENTS[other];
    if (otherLevel >= otherTarget || otherLevel >= projected.buildings.CORE) return null;
    return constructionOrder(
      now,
      state,
      projected,
      'INSTRUMENT',
      other,
      instrumentCost(other, otherLevel),
    );
  }
  return constructionOrder(
    now,
    state,
    projected,
    'INSTRUMENT',
    id,
    instrumentCost(id, level),
  );
}

function constructionCandidates(
  now: number,
  state: SimState,
  options: SimOptions,
): SimOrder[] {
  const projected = projectConstruction(state);
  const candidates: (SimOrder | null)[] = [];
  const minimumProducer = Math.min(
    projected.buildings.REFINERY,
    projected.buildings.EXTRACTOR,
  );

  // Time-gated research gets first refusal. If its special material has not yet
  // arrived, an affordable production action may still use the otherwise idle
  // queue instead of pretending the player stops developing.
  candidates.push(researchCandidate(now, state, projected));

  if (minimumProducer >= 3 && projected.buildings.SHIPYARD < TARGET_BUILDINGS.SHIPYARD) {
    candidates.push(buildingCandidate(now, state, projected, 'SHIPYARD'));
  }

  if (projected.buildings.CORE >= 3) {
    candidates.push(satelliteCandidate(now, state, projected, 'DERRICK'));
  }
  if (minimumProducer >= options.foundryTier) {
    candidates.push(satelliteCandidate(now, state, projected, 'FOUNDRY'));
  }

  const economy = nextEconomyBuilding(projected);
  if (economy !== null) candidates.push(buildingCandidate(now, state, projected, economy));

  const economyComplete = economy === null;
  if (economyComplete) {
    candidates.push(satelliteCandidate(now, state, projected, 'UPLINK'));
    candidates.push(satelliteCandidate(now, state, projected, 'BEACON'));
    for (const id of SATELLITE_IDS) candidates.push(satelliteCandidate(now, state, projected, id));
    candidates.push(instrumentCandidate(now, state, projected));
  }

  return candidates.filter((candidate): candidate is SimOrder => candidate !== null);
}

function enqueue(state: SimState, order: SimOrder): void {
  state.economy.alloy -= order.cost.alloy;
  state.economy.crystal -= order.cost.crystal;
  state.economy.deuterium -= order.cost.deuterium;
  state.queues[order.queue].push(order);
  const amount = total(order.cost);
  if (order.kind === 'BUILDING') state.spent.buildings += amount;
  else if (order.kind === 'INSTRUMENT') state.spent.instruments += amount;
  else if (order.kind === 'SATELLITE') state.spent.satellites += amount;
  else if (order.kind === 'RESEARCH') state.spent.research += amount;
  else state.spent.prospectors += amount;
}

function fillConstruction(now: number, state: SimState, options: SimOptions): void {
  let guard = 0;
  while (state.queues.CONSTRUCTION.length < BUILD.queueDepth && guard < 12) {
    guard += 1;
    const candidate = constructionCandidates(now, state, options)
      .find((order) => canAfford(state.economy, order.cost));
    if (!candidate) break;
    enqueue(state, candidate);
  }
}

function fillYard(now: number, state: SimState): void {
  if (state.buildings.SHIPYARD < HULLS.PROSPECTOR.minShipyard) return;
  let projectedProspectors = state.prospectors
    + state.queues.YARD.filter((order) => order.subject === 'PROSPECTOR').length;
  while (state.queues.YARD.length < BUILD.queueDepth && projectedProspectors < 2) {
    const cost = {
      alloy: HULLS.PROSPECTOR.alloy,
      crystal: HULLS.PROSPECTOR.crystal,
      deuterium: HULLS.PROSPECTOR.deuterium,
    };
    if (!canAfford(state.economy, cost)) break;
    const minutes = shipMinutes(cost, state.buildings.SHIPYARD, {});
    const startsAt = state.queues.YARD.at(-1)?.readyAt ?? now;
    enqueue(state, {
      queue: 'YARD',
      kind: 'HULL',
      subject: 'PROSPECTOR',
      cost,
      minutes,
      readyAt: startsAt + Math.max(1, Math.ceil(minutes * 60)) / 60,
    });
    projectedProspectors += 1;
  }
}

function completeOrders(now: number, state: SimState): void {
  for (const queueId of ['CONSTRUCTION', 'YARD'] as const) {
    const queue = state.queues[queueId];
    while (queue[0]?.readyAt !== undefined && queue[0].readyAt <= now + 1e-9) {
      const order = queue.shift()!;
      if (order.kind === 'BUILDING') {
        state.buildings[order.subject as BuildingId] += 1;
      } else if (order.kind === 'INSTRUMENT') {
        const id = order.subject as InstrumentId;
        state.instruments[id] = (state.instruments[id] ?? 0) + 1;
      } else if (order.kind === 'SATELLITE') {
        const id = order.subject as SatelliteId;
        if (!state.orbit.includes(id)) state.orbit.push(id);
      } else if (order.kind === 'RESEARCH') {
        state.research.add(order.subject as ResearchProjectId);
      } else {
        state.prospectors += 1;
      }
      recordMilestones(order.readyAt, state);
    }
  }
}

function claimBuildingRewards(state: SimState): void {
  for (const chain of REWARD_CHAINS) {
    if (chain.id !== 'CORE' && chain.id !== 'REFINERY' && chain.id !== 'EXTRACTOR') continue;
    const level = state.buildings[chain.id];
    for (const tier of chain.tiers) {
      const id = `${chain.id}:${String(tier.goal)}`;
      if (level < tier.goal || state.claimedRewards.has(id)) continue;
      state.claimedRewards.add(id);
      state.economy.alloy += tier.reward.alloy;
      state.economy.crystal += tier.reward.crystal;
      state.economy.deuterium += tier.reward.deuterium;
      addResources(state.rewards, tier.reward);
    }
  }
}

function economyInput(state: SimState) {
  return {
    refineryLevel: state.buildings.REFINERY,
    extractorLevel: state.buildings.EXTRACTOR, plantLevel: 0,
    vaultLevel: state.buildings.VAULT,
    aegisLevel: 0,
    production: productionMult(state.orbit),
  };
}

function advanceProduction(
  from: number,
  to: number,
  state: SimState,
  options: SimOptions,
): void {
  const hours = (to - from) / 60;
  const input = economyInput(state);
  const expectedAlloy = alloyRate(input.refineryLevel) * input.production * hours;
  const expectedCrystal = crystalRate(input.extractorLevel) * input.production * hours;
  const beforeAlloy = state.economy.bufferAlloy;
  const beforeCrystal = state.economy.bufferCrystal;
  state.economy = advanceEconomy(state.economy, input, to);
  const acceptedAlloy = state.economy.bufferAlloy - beforeAlloy;
  const acceptedCrystal = state.economy.bufferCrystal - beforeCrystal;
  state.produced.alloy += expectedAlloy;
  state.produced.crystal += expectedCrystal;
  state.wasted.alloy += Math.max(0, expectedAlloy - acceptedAlloy);
  state.wasted.crystal += Math.max(0, expectedCrystal - acceptedCrystal);

  if (state.research.has('ISOTOPE_SPECTROMETRY') && state.prospectors > 0) {
    const derrickMultiplier = state.orbit.includes('DERRICK') ? SATELLITES.DERRICK.hold : 1;
    const fullFleetShare = state.prospectors / 2;
    const expectedDeuterium =
      options.deuteriumPerDay / SATELLITES.DERRICK.hold
      * derrickMultiplier
      * fullFleetShare
      * ((to - from) / 1440);
    const cap = deuteriumCollectorCap(
      crystalRate(state.buildings.EXTRACTOR) * productionMult(state.orbit),
    );
    const accepted = Math.min(expectedDeuterium, Math.max(0, cap - state.economy.bufferDeuterium));
    state.economy.bufferDeuterium += accepted;
    state.produced.deuterium += expectedDeuterium;
    state.wasted.deuterium += expectedDeuterium - accepted;
  }
}

function recordMilestones(now: number, state: SimState): void {
  const entries: readonly (readonly [string, boolean])[] = [
    ['Command Core L12', state.buildings.CORE >= 12],
    ['Alloy Refinery L12', state.buildings.REFINERY >= 12],
    ['Crystal Extractor L12', state.buildings.EXTRACTOR >= 12],
    ['Vault L10', state.buildings.VAULT >= 10],
    ['Telescope L5', (state.instruments.TELESCOPE ?? 0) >= 5],
    ['Radar L5', (state.instruments.RADAR ?? 0) >= 5],
    ['All four satellites', SATELLITE_IDS.every((id) => state.orbit.includes(id))],
    ['Development package complete', developmentPackageReached(state)],
    ['Two Prospectors', state.prospectors >= 2],
    ...RESEARCH_ORDER.map((id) => [`Research: ${id}`, state.research.has(id)] as const),
  ];
  for (const [label, reached] of entries) {
    if (reached && !state.milestones.has(label)) state.milestones.set(label, now);
  }
}

function developmentPackageReached(state: SimState): boolean {
  return state.buildings.CORE >= TARGET_BUILDINGS.CORE
    && state.buildings.REFINERY >= TARGET_BUILDINGS.REFINERY
    && state.buildings.EXTRACTOR >= TARGET_BUILDINGS.EXTRACTOR
    && state.buildings.VAULT >= TARGET_BUILDINGS.VAULT
    && (state.instruments.TELESCOPE ?? 0) >= TARGET_INSTRUMENTS.TELESCOPE
    && (state.instruments.RADAR ?? 0) >= TARGET_INSTRUMENTS.RADAR
    && SATELLITE_IDS.every((id) => state.orbit.includes(id));
}

function targetReached(state: SimState): boolean {
  return developmentPackageReached(state)
    && RESEARCH_ORDER.every((id) => state.research.has(id));
}

function simulate(options: SimOptions): SimResult {
  const state = freshState();
  if (options.rewards) claimBuildingRewards(state);
  fillYard(0, state);
  fillConstruction(0, state, options);

  const limit = MAX_DAYS * 1440;
  for (let now = STEP_MINUTES; now <= limit + 1e-9; now += STEP_MINUTES) {
    const from = now - STEP_MINUTES;
    if (state.queues.CONSTRUCTION.length > 0) {
      state.constructionBusyMinutes += STEP_MINUTES;
    } else if (isActive(options.activity, from)) {
      state.constructionIdleActiveMinutes += STEP_MINUTES;
    } else {
      state.constructionIdleOfflineMinutes += STEP_MINUTES;
    }

    advanceProduction(from, now, state, options);
    completeOrders(now, state);
    if (isActive(options.activity, now)) {
      const collection = collect(state.economy, economyInput(state));
      state.economy = collection.state;
      // This is the only behavioural abstraction in the goal model. What is not
      // reserved for the fixed target represents ordinary hulls, defence and
      // losses; removing it at collection keeps the assumption explicit instead
      // of inventing battles whose outcome the model cannot justify.
      state.economy.alloy -= collection.moved.alloy * (1 - options.developmentShare);
      state.economy.crystal -= collection.moved.crystal * (1 - options.developmentShare);
      if (options.rewards) claimBuildingRewards(state);
      // The utility craft is a prerequisite for the special material and has its
      // own queue, so it gets first use of an active player's newly collected ore.
      fillYard(now, state);
      fillConstruction(now, state, options);
    }
    if (targetReached(state)) return { options, reachedAt: now, state };
  }
  return { options, reachedAt: null, state };
}

function bestFoundryTier(
  activity: ActivityProfile,
  rewards: boolean,
  deuteriumPerDay: number,
  developmentShare = 1,
): SimResult {
  const results: SimResult[] = [];
  for (let foundryTier = 3; foundryTier <= 12; foundryTier += 1) {
    results.push(simulate({
      activity,
      rewards,
      deuteriumPerDay,
      foundryTier,
      developmentShare,
    }));
  }
  return results.sort((left, right) =>
    (left.reachedAt ?? Infinity) - (right.reachedAt ?? Infinity))[0]!;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return `>${String(MAX_DAYS)}d`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.round(minutes % 60);
  return `${String(days)}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
}

const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-US');
const percent = (part: number, whole: number): string =>
  `${(100 * part / Math.max(1, whole)).toFixed(1)}%`;

function printScenarioTable(): SimResult {
  console.log('\nFIXED GOAL — CURRENT RULES');
  console.log(
    'Core/Refinery/Extractor L12 · Vault L10 · Telescope/Radar L5 · four satellites · four research projects',
  );
  console.log(
    'Mining assumption: two Prospectors, net 300 Deuterium/day with Derrick; combat discoveries occur at their earliest legal opportunity.',
  );
  console.log(
    `Calibration target: complete checklist ~= ${String(TARGET_DAYS)} days; `
    + `${String(DEVELOPMENT_SHARE * 100)}% development budget = `
    + `${String(DEVELOPMENT_MIN_DAYS)}-${String(DEVELOPMENT_MAX_DAYS)} days.`,
  );
  console.log('\nactivity             rewards  Foundry at  development     complete target');
  let primary: SimResult | null = null;
  for (const activity of ACTIVITY) {
    for (const rewards of [true, false]) {
      const result = bestFoundryTier(activity, rewards, 300);
      if (activity.id === 'EIGHT_HOURS' && rewards) primary = result;
      const development = result.state.milestones.get('Development package complete') ?? null;
      console.log(
        `${activity.label.padEnd(20)} ${(rewards ? 'yes' : 'no').padEnd(8)}`
        + ` L${String(result.options.foundryTier).padEnd(10)}`
        + ` ${formatDuration(development).padEnd(15)}`
        + ` ${formatDuration(result.reachedAt)}`,
      );
    }
  }
  return primary!;
}

function printMiningSensitivity(activity: ActivityProfile): void {
  console.log('\nSPECIAL-MATERIAL SENSITIVITY — 8h route, building rewards claimed');
  console.log('net delivered/day  finish          Death Star research');
  for (const rate of [150, 200, 250, 300, 375, 450, 600]) {
    const result = bestFoundryTier(activity, true, rate);
    const protocol = result.state.milestones.get('Research: DEATH_STAR_PROTOCOL') ?? null;
    console.log(
      `${formatNumber(rate).padStart(17)}  ${formatDuration(result.reachedAt).padEnd(15)}`
      + ` ${formatDuration(protocol)}`,
    );
  }
}

function printBehaviourSensitivity(activity: ActivityProfile): void {
  console.log('\nDEVELOPMENT-BUDGET SENSITIVITY — 8h route, rewards, 300 special material/day');
  console.log('share kept for goal  development set  complete target');
  for (const share of [1, 0.75, 0.5, 0.35, 0.25]) {
    const result = bestFoundryTier(activity, true, 300, share);
    const development = result.state.milestones.get('Development package complete') ?? null;
    console.log(
      (String(Math.round(share * 100)) + '%').padStart(19)
      + `  ${formatDuration(development).padEnd(15)}`
      + ` ${formatDuration(result.reachedAt)}`,
    );
  }
}

function printMilestones(result: SimResult): void {
  console.log('\nPRIMARY ROUTE MILESTONES — 8h / 12h awake, rewards, 300 special material/day');
  for (const [label, at] of [...result.state.milestones.entries()].sort((a, b) => a[1] - b[1])) {
    console.log(`  ${formatDuration(at).padEnd(14)} ${label}`);
  }
}

function printProductionLadder(): void {
  console.log('\nPASSIVE PRODUCTION USED BY THE SIMULATION');
  console.log('level    Alloy/h  Crystal/h   with Foundry A/C');
  for (const level of [1, 3, 5, 8, 10, 12]) {
    const alloy = alloyRate(level);
    const crystal = crystalRate(level);
    console.log(
      `L${String(level).padEnd(7)} ${formatNumber(alloy).padStart(7)}`
      + ` ${formatNumber(crystal).padStart(10)}`
      + `   ${formatNumber(alloy * 1.06).padStart(7)} / ${formatNumber(crystal * 1.06)}`,
    );
  }
}

function printBudget(result: SimResult): void {
  const state = result.state;
  console.log('\nPRIMARY ROUTE RESOURCE LEDGER');
  console.log(
    `  passive + mining generated: ${formatNumber(total(state.produced))}`
    + ` (${formatNumber(state.produced.alloy)} A / ${formatNumber(state.produced.crystal)} C /`
    + ` ${formatNumber(state.produced.deuterium)} D)`,
  );
  console.log(
    `  building rewards:          ${formatNumber(total(state.rewards))}`
    + ` (${formatNumber(state.rewards.alloy)} A / ${formatNumber(state.rewards.crystal)} C)`,
  );
  console.log(`  buildings:                 ${formatNumber(state.spent.buildings)}`);
  console.log(`  instruments:               ${formatNumber(state.spent.instruments)}`);
  console.log(`  satellites:                ${formatNumber(state.spent.satellites)}`);
  console.log(`  research:                  ${formatNumber(state.spent.research)}`);
  console.log(`  enabling Prospectors:      ${formatNumber(state.spent.prospectors)}`);
  console.log(
    `  works overflow lost:       ${formatNumber(total(state.wasted))}`
    + ` (${percent(total(state.wasted), total(state.produced))}; includes the post-development research wait)`,
  );
}

function printCalibrationDiagnosis(result: SimResult): void {
  const development = result.state.milestones.get('Development package complete') ?? null;
  const full = result.reachedAt;
  console.log('\nCALIBRATION DIAGNOSIS');
  console.log(`  buildings + instruments + satellites: ${formatDuration(development)}`);
  console.log(`  complete target including research:   ${formatDuration(full)}`);
  if (development !== null && full !== null) {
    console.log(`  special-material/research tail:        ${formatDuration(full - development)}`);
  }
  if (development !== null && development < TARGET_DAYS * 1440 * 0.5) {
    console.log(
      '  WARNING: the eight-day finish is dominated by special-material supply; it does not validate passive-economy pacing.',
    );
  }
}

function printFieldSupplyCeiling(): void {
  const seeds = [7, 42, 99, 1337, 9001] as const;
  const required = RESEARCH_ORDER.reduce(
    (sum, id) => sum + RESEARCH_PROJECTS[id].costAt(1).deuterium,
    0,
  );
  const supplies = seeds.map((seed) => generateGalaxy(seed, 0).asteroids
    .filter((rock) => rock.isotopeRich && rock.appearsAt <= TARGET_DAYS * 1440)
    .reduce((sum, rock) => sum + rock.ore * rock.deuteriumShare, 0));
  const average = supplies.reduce((sum, supply) => sum + supply, 0) / supplies.length;
  const finishers = supplies.map((supply) => Math.floor(supply / required));
  const averageShare = required / average;
  const averageRichShare = (DEUTERIUM.isotopeShareMin + DEUTERIUM.isotopeShareMax) / 2;
  const twoCraftLoad = 2 * PROSPECTOR.hold * SATELLITES.DERRICK.hold * averageRichShare;

  console.log('\nGALAXY-WIDE SPECIAL-MATERIAL CEILING — five deterministic fields through day 8');
  console.log(`  one commander needs:               ${formatNumber(required)}`);
  console.log(`  average total field supply:        ${formatNumber(average)}`);
  console.log(
    `  maximum complete commanders:      ${String(Math.min(...finishers))}-${String(Math.max(...finishers))}`
    + ' (assumes literally no mining loss or competition waste)',
  );
  console.log(
    `  equal share at ${String(GALAXY.defaultSlots)} commanders:     `
    + `${formatNumber(average / GALAXY.defaultSlots)} by day 8`,
  );
  console.log(`  equal share at 300 commanders:     ${formatNumber(average / 300)} by day 8`);
  console.log(
    `  one active finisher must capture:  ${percent(averageShare, 1)} of the whole field supply`,
  );
  console.log(
    `  two Derrick Prospectors average:   ${formatNumber(twoCraftLoad)} per full rich-rock return;`
    + ` about ${(required / twoCraftLoad).toFixed(1)} such returns fund all four projects.`,
  );
}

const primary = printScenarioTable();
printMiningSensitivity(ACTIVITY[0]!);
printBehaviourSensitivity(ACTIVITY[0]!);
printMilestones(primary);
printProductionLadder();
printBudget(primary);
printCalibrationDiagnosis(primary);
printFieldSupplyCeiling();

const halfBudget = bestFoundryTier(ACTIVITY[0]!, true, 300, DEVELOPMENT_SHARE);
const halfBudgetDevelopment =
  halfBudget.state.milestones.get('Development package complete') ?? null;

if (primary.reachedAt === null) {
  console.error(`\nFAIL: the primary route did not finish inside ${String(MAX_DAYS)} days.`);
  process.exitCode = 1;
} else {
  const delta = primary.reachedAt / 1440 - TARGET_DAYS;
  console.log(
    `\nTARGET DELTA: primary ideal route is ${Math.abs(delta).toFixed(2)} days `
    + `${delta > 0 ? 'slower' : 'faster'} than the ${String(TARGET_DAYS)}-day calibration anchor.`,
  );
}

if (
  halfBudgetDevelopment === null
  || halfBudgetDevelopment < DEVELOPMENT_MIN_DAYS * 1440
  || halfBudgetDevelopment > DEVELOPMENT_MAX_DAYS * 1440
) {
  console.error(
    `\nFAIL: reserving ${String(DEVELOPMENT_SHARE * 100)}% for development must finish the `
    + `development package in ${String(DEVELOPMENT_MIN_DAYS)}-${String(DEVELOPMENT_MAX_DAYS)} days; `
    + `measured ${formatDuration(halfBudgetDevelopment)}.`,
  );
  process.exitCode = 1;
}
