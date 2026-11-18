import { ALL_HULLS, REPAIR_LADDER, VESSEL_SYSTEMS, isFeatureOpen, jumpWindowOpen, type HullId, type RepairStep, type StarterFeature, type VesselFact, type VesselLook, type VesselModule, type VesselSystem } from '@astera/rules';
import type { Focus } from '../../galaxy/FocusPanel.js';
import { scenePlayedFor, type Beat, type DirectorLine, type Scene } from './director.js';

/**
 * THE FIRST SESSION'S SCENES (plan 2026-11-18 §5). What the ship is, where it is broken and where it is
 * going (the report); each repair of the first road shown on the hull, as it starts and as it comes back,
 * with what it is for; the hull's new look as a moment; the dark before the telescope; the first rock and
 * the first contact come close to; the probe's report, the yard it calls for and the first ships out of
 * it; the ship again after its first battle. Each once for a ship.
 */
export interface ShipState {
  modules: Readonly<Record<string, number>>;
  /** Each order under way, what it took from the stores when it was given, and when it is done. */
  queue: readonly { subject: string; stage: number; cost?: NonNullable<Beat['spend']>; readyAt?: Date }[];
  look: VesselLook;
  facts: readonly VesselFact[];
}

/** The road the first session walks: the required repairs, in the ladder's order. */
const ROAD: readonly RepairStep[] = REPAIR_LADDER.filter(step => step.required);
const have = (state: ShipState, step: RepairStep): boolean => (state.modules[step.module] ?? 0) >= step.stage;
const ordered = (state: ShipState, step: RepairStep): boolean => state.queue.some(order => order.subject === step.module && order.stage === step.stage);
/** Nothing past the first repair is done or under way: the ship as the prologue hands it over. */
const fresh = (state: ShipState): boolean => ROAD.every(step => !have(state, step) && !ordered(state, step));

type RoadModule = 'REFINERY' | 'EXTRACTOR' | 'TELESCOPE' | 'RADAR' | 'SURVEY' | 'SHIPYARD';
const isRoadModule = (module: string): module is RoadModule =>
  module === 'REFINERY' || module === 'EXTRACTOR' || module === 'TELESCOPE' || module === 'RADAR' || module === 'SURVEY' || module === 'SHIPYARD';

/** The hull's round with every system named on it (owner 2026-11-18: five names want time to be read). */
export const REPORT_ROUND_MS = 8000;
/** The ship is read again a moment after the work is due: the shot holds through that read. */
export const WORK_GRACE_MS = 2500;

const SHIP_REPORT: Scene = {
  id: 'shipReport',
  once: true,
  keep: true,
  beats: [
    { id: 'round', shot: { kind: 'ship', turn: 1.7 }, ms: REPORT_ROUND_MS, line: 'starter.director.shipReport.orbit', sound: 'rattle', tags: VESSEL_SYSTEMS },
    { id: 'drive', shot: { kind: 'bay', system: 'DRIVE' }, ms: 2600, line: 'starter.director.shipReport.goal', sound: 'charge' },
  ],
};

function work(step: RepairStep, name: string, state: ShipState): Scene {
  const order = state.queue.find(row => row.subject === step.module && row.stage === step.stage);
  // The stores fall under the letterbox: the shot says where it went (isolated player test 2026-11-18).
  const cost = order?.cost;
  // The camera stays on the bay until the repair is done, and the bay coming back takes over (owner 2026-11-18).
  const until = order?.readyAt ? { until: order.readyAt.getTime() + WORK_GRACE_MS, yields: true } : {};
  return {
    id: `repair:${step.module}:${String(step.stage)}:work`,
    once: true,
    beats: [{ id: 'weld', shot: { kind: 'bay', system: step.system }, ms: 2400, line: 'starter.director.repair.work', vars: { name }, sound: 'weld', ...(cost ? { spend: cost } : {}), ...until }],
  };
}

/**
 * What a repair hands over with it (plan §5 A11), and how it is said: the telescope's Prospector, found in
 * the cargo bay; the yard's first ships (owner phone playtest 2026-11-18, item 8: both were the yard's).
 */
const HANDED_LINE: Partial<Record<RoadModule, DirectorLine>> = { TELESCOPE: 'starter.director.ships.TELESCOPE', SHIPYARD: 'starter.director.ships.SHIPYARD' };
function shipsHanded(step: RepairStep & { module: RoadModule }): { hull: HullId; count: number; line: DirectorLine } | null {
  const [entry] = ALL_HULLS.flatMap(hull => {
    const count = step.grants?.fleet?.[hull] ?? 0;
    return count > 0 ? [{ hull, count }] : [];
  });
  const line = HANDED_LINE[step.module];
  return entry && line ? { ...entry, line } : null;
}

/** The telescope's pull back from the ship (owner 2026-11-18, item 19): a little wider than the whole-ship shot, quickly. */
export const TELESCOPE_PULL = { range: 7.5, seconds: 1.2 } as const;
/** The breath between the camera settling and the reach opening. */
const REACH_BREATH_MS = 500;

function done(step: RepairStep & { module: RoadModule }, name: (module: string) => string, look: VesselLook | null): Scene {
  const ships = shipsHanded(step);
  const line = { line: `starter.director.repair.${step.module}` as const, vars: { name: name(step.module) }, sound: 'ignite' as const };
  const reach = TELESCOPE_PULL.seconds * 1000 + REACH_BREATH_MS;
  const back: Beat = step.module === 'TELESCOPE'
    ? { id: 'back', shot: { kind: 'ship', range: TELESCOPE_PULL.range, seconds: TELESCOPE_PULL.seconds }, ms: reach + 1800, ...line, reach }
    : { id: 'back', shot: { kind: 'bay', system: step.system }, ms: 2600, ...line, awaken: { system: step.system, module: step.module } };
  return {
    id: `repair:${step.module}:${String(step.stage)}:done`,
    once: true,
    beats: [
      back,
      // The craft come out of the cargo bay, seen from far enough to watch them, and dock again (OwnVessel).
      ...(ships
        ? [{ id: 'ships', shot: { kind: 'ship' as const, turn: 0.6 }, ms: 4200, line: ships.line, vars: { count: ships.count, hull: name(ships.hull) }, sound: 'launch' as const, craft: { hull: ships.hull, count: ships.count } }]
        : []),
      ...(look === 'PATCHED' || look === 'RENEWED'
        ? [{ id: 'hull', shot: { kind: 'ship' as const, turn: 0.9 }, ms: 2600, line: `starter.director.hull.${look}` as const, sound: 'rankup' as const }]
        : []),
    ],
  };
}

/** The ship again after its first battle (§5 A13): every system as it is now, then the drive, the way out. */
const secondReport = (state: ShipState): Scene => ({
  id: 'shipReport2',
  once: true,
  keep: true,
  beats: [
    { id: 'round', shot: { kind: 'ship', turn: 1.7 }, ms: REPORT_ROUND_MS, line: 'starter.director.report2.round', sound: 'rattle', tags: VESSEL_SYSTEMS },
    { id: 'drive', shot: { kind: 'bay', system: 'DRIVE' }, ms: 2600, line: jumpWindowOpen(state) ? 'starter.director.report2.ready' : 'starter.director.report2.drive', sound: 'charge', tags: ['DRIVE'] },
  ],
});

const DARK: Scene = {
  id: 'dark',
  once: true,
  beats: [{ id: 'blind', shot: { kind: 'wide' }, ms: 2800, line: 'starter.director.dark', sound: 'tick' }],
};

/** The scenes a change of the ship calls for, in the order they play. */
export function scenesFor(prev: ShipState | null, next: ShipState, name: (module: string) => string): Scene[] {
  if (prev === null) return fresh(next) ? [SHIP_REPORT] : [];
  const scenes: Scene[] = [];
  const lookChanged = prev.look !== next.look ? next.look : null;
  for (const step of ROAD) {
    if (!isRoadModule(step.module)) continue;
    const roadStep = { ...step, module: step.module };
    if (!have(prev, step) && have(next, step)) scenes.push(done(roadStep, name, lookChanged));
    else if (!have(next, step) && !ordered(prev, step) && ordered(next, step)) scenes.push(work(step, name(step.module), next));
  }
  const telescope = ROAD.find(step => step.module === 'TELESCOPE');
  const furnace = ROAD.find(step => step.module === 'EXTRACTOR');
  if (telescope && furnace && !have(prev, furnace) && have(next, furnace) && !have(next, telescope) && !ordered(next, telescope)) scenes.push(DARK);
  if (!prev.facts.includes('FIRST_BATTLE_REPORT') && next.facts.includes('FIRST_BATTLE_REPORT')) scenes.push(secondReport(next));
  return scenes;
}

/** The telescope's field (§5 A6), then its first rock come close to before it is asked for (A7): the rock left closed. */
export const rockScene = (asteroidId: string): Scene => ({
  id: 'rock',
  once: true,
  beats: [
    { id: 'field', shot: { kind: 'wide', range: 11 }, ms: 2400, line: 'starter.director.field', sound: 'confirm' },
    { id: 'approach', shot: { kind: 'subject', focus: { kind: 'asteroid', id: asteroidId }, range: 2.4 }, ms: 2800, line: 'starter.director.rock', sound: 'mining' },
  ],
});

/** The first contact on the radar, turned to (§5 A8): what the antenna will be for. */
export const contactScene = (focus: Extract<Focus, { kind: 'contact' | 'unknownSignal' }>): Scene => ({
  id: 'contact',
  once: true,
  beats: [{ id: 'turn', shot: { kind: 'subject', focus }, ms: 2800, line: 'starter.director.contact', sound: 'alert' }],
});

/** The probe's report come home (§5 A9): the camera turns to the ship it read, which is no longer a blank. */
export const probeScene = (target: { id: string; name: string }): Scene => ({
  id: 'probe',
  once: true,
  beats: [{ id: 'turn', shot: { kind: 'subject', focus: { kind: 'planet', id: target.id } }, ms: 2800, line: 'starter.director.probe', vars: { name: target.name }, sound: 'confirm' }],
});

/** The yard's empty bay while the probe is out (§5 A10): a haul needs ships to carry it, before it is asked for. */
export const yardNeedScene = (): Scene => ({
  id: 'yardNeed',
  once: true,
  beats: [{ id: 'yard', shot: { kind: 'bay', system: 'CARGO' }, ms: 2800, line: 'starter.director.yardNeed', sound: 'tick' }],
});

/** A repair longer than this shows its clock, not a torch: the galaxy would otherwise draw every frame for hours. */
const WELD_UP_TO_MS = 120_000;

/** The bays that weld right now (plan 2026-11-18 §4 İ2): a short repair under way, once each, with what it repairs. */
export function weldingBays(queue: readonly { subject: string; stage: number; queue: string; startedAt: Date; readyAt: Date }[], nowMs: number): { system: VesselSystem; module: VesselModule }[] {
  const bays = new Map<VesselSystem, VesselModule>();
  for (const order of queue) {
    const span = order.readyAt.getTime() - order.startedAt.getTime();
    if (order.queue !== 'CONSTRUCTION' || span > WELD_UP_TO_MS || order.readyAt.getTime() <= nowMs) continue;
    const step = REPAIR_LADDER.find(row => row.module === order.subject && row.stage === order.stage);
    // One weld to a bay: the first repair at it names what it burns (a crystal repair throws crystal sparks).
    if (step && !bays.has(step.system)) bays.set(step.system, step.module);
  }
  return [...bays].map(([system, module]) => ({ system, module }));
}

const atStage = (module: VesselModule, stage: number): { modules: Partial<Record<VesselModule, number>>; facts: [] } => {
  const modules: Partial<Record<VesselModule, number>> = {};
  modules[module] = stage;
  return { modules, facts: [] };
};

/**
 * The scene that announces a system (live play 2026-11-18): the return of the road's repair that opens
 * it. A system an event opens, or one open before the road, has none and keeps its card.
 */
export function sceneAnnouncing(feature: StarterFeature): string | null {
  const step = ROAD.find(row => !isFeatureOpen(atStage(row.module, row.stage - 1), feature) && isFeatureOpen(atStage(row.module, row.stage), feature));
  return step ? `repair:${step.module}:${String(step.stage)}:done` : null;
}

/** The system has been seen coming back on the hull: its card would only say it again. */
export function announcedByScene(vesselId: string, feature: StarterFeature | null): boolean {
  const scene = feature ? sceneAnnouncing(feature) : null;
  return scene !== null && scenePlayedFor(vesselId, scene);
}
