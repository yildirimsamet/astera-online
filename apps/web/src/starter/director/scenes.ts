import { REPAIR_LADDER, VESSEL_SYSTEMS, isFeatureOpen, type RepairStep, type StarterFeature, type VesselLook, type VesselModule, type VesselSystem } from '@astera/rules';
import type { Focus } from '../../galaxy/FocusPanel.js';
import { scenePlayedFor, type Scene } from './director.js';

/**
 * THE FIRST SESSION'S SCENES (plan 2026-11-18 §5). What the ship is, where it is broken and where it is
 * going (the report); each repair of the first road shown on the hull, as it starts and as it comes back,
 * with what it is for; the hull's new look as a moment; the dark before the telescope; the first rock and
 * the first contact come close to. Each once for a ship.
 */
export interface ShipState {
  modules: Readonly<Record<string, number>>;
  queue: readonly { subject: string; stage: number }[];
  look: VesselLook;
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

const SHIP_REPORT: Scene = {
  id: 'shipReport',
  once: true,
  beats: [
    { id: 'round', shot: { kind: 'ship', turn: 1.7 }, ms: 3000, line: 'starter.director.shipReport.orbit', sound: 'rattle', tags: VESSEL_SYSTEMS },
    { id: 'drive', shot: { kind: 'bay', system: 'DRIVE' }, ms: 2600, line: 'starter.director.shipReport.goal', sound: 'charge' },
  ],
};

function work(step: RepairStep, name: string): Scene {
  return {
    id: `repair:${step.module}:${String(step.stage)}:work`,
    once: true,
    beats: [{ id: 'weld', shot: { kind: 'bay', system: step.system }, ms: 2400, line: 'starter.director.repair.work', vars: { name }, sound: 'weld' }],
  };
}

function done(step: RepairStep & { module: RoadModule }, name: string, look: VesselLook | null): Scene {
  return {
    id: `repair:${step.module}:${String(step.stage)}:done`,
    once: true,
    beats: [
      { id: 'back', shot: { kind: 'bay', system: step.system }, ms: 2600, line: `starter.director.repair.${step.module}`, vars: { name }, sound: 'ignite' },
      ...(look === 'PATCHED' || look === 'RENEWED'
        ? [{ id: 'hull', shot: { kind: 'ship' as const, turn: 0.9 }, ms: 2600, line: `starter.director.hull.${look}` as const, sound: 'rankup' as const }]
        : []),
    ],
  };
}

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
    if (!have(prev, step) && have(next, step)) scenes.push(done(roadStep, name(step.module), lookChanged));
    else if (!have(next, step) && !ordered(prev, step) && ordered(next, step)) scenes.push(work(step, name(step.module)));
  }
  const telescope = ROAD.find(step => step.module === 'TELESCOPE');
  const furnace = ROAD.find(step => step.module === 'EXTRACTOR');
  if (telescope && furnace && !have(prev, furnace) && have(next, furnace) && !have(next, telescope) && !ordered(next, telescope)) scenes.push(DARK);
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

/** A repair longer than this shows its clock, not a torch: the galaxy would otherwise draw every frame for hours. */
const WELD_UP_TO_MS = 120_000;

/** The systems whose bays weld right now (plan 2026-11-18 §4 İ2): a short repair under way, once each. */
export function weldingSystems(queue: readonly { subject: string; stage: number; queue: string; startedAt: Date; readyAt: Date }[], nowMs: number): VesselSystem[] {
  const systems = queue.flatMap(order => {
    const span = order.readyAt.getTime() - order.startedAt.getTime();
    if (order.queue !== 'CONSTRUCTION' || span > WELD_UP_TO_MS || order.readyAt.getTime() <= nowMs) return [];
    const step = REPAIR_LADDER.find(row => row.module === order.subject && row.stage === order.stage);
    return step ? [step.system] : [];
  });
  return [...new Set(systems)];
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
