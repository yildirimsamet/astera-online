import {
  REPAIR_LADDER, STARTER, afterQueue, deuteriumRate, missingForStep, moduleStage,
  type RepairStep, type StepRequirement, type VesselProgress,
} from '@astera/rules';
import type { VesselView } from '../api/starterSchemas.js';

const HOUR_MS = 3_600_000;

export type PlanShip = Pick<VesselView, 'modules' | 'facts' | 'parts' | 'fuel' | 'deuterium' | 'bufferDeuterium'>
  & { queue: readonly { queue: string; subject: string; stage: number; readyAt: Date }[] };

export type EngineState =
  | { state: 'done' }
  | { state: 'queued'; readyAt: Date }
  | { state: 'open'; minutes: number }
  | { state: 'waiting'; missing: StepRequirement[] };

export interface FuelOutlook {
  /** The tank, the store and the works: everything that can still go into the tank. */
  have: number;
  needed: number;
  /** What the plants make once the queue has run. */
  perHour: number;
  /** When it is all aboard if none of it is flown; null while no plant runs. */
  readyAt: Date | null;
  /** The same, were the second plant repaired now: shown only while the first one runs alone. */
  lever: Date | null;
}

export interface DeparturePlan {
  hull: EngineState;
  thrust: EngineState;
  fuel: FuelOutlook;
  /** When both engines are in, if the queue says so. */
  enginesAt: Date | null;
  /** Which of the two the jump waits on, when both times are known. */
  waitsOn: 'engines' | 'fuel' | null;
}

const stepOf = (module: string, stage: number): RepairStep | undefined =>
  REPAIR_LADDER.find(s => s.module === module && s.stage === stage);

function engine(module: 'DRIVE_HULL' | 'DRIVE_THRUST', progress: VesselProgress, ahead: VesselProgress, repairs: PlanShip['queue']): EngineState {
  if (moduleStage(progress, module) >= 1) return { state: 'done' };
  const queued = repairs.find(order => order.subject === module);
  if (queued) return { state: 'queued', readyAt: queued.readyAt };
  const step = stepOf(module, 1)!;
  const missing = missingForStep(ahead, step);
  return missing.length === 0 ? { state: 'open', minutes: step.minutes } : { state: 'waiting', missing };
}

/** When `left` units have been made, from a plant that changes stage at the given moments. */
function filledAt(left: number, stage: number, changes: readonly { at: number; stage: number }[], nowMs: number): Date | null {
  if (left <= 0) return new Date(nowMs);
  let at = nowMs, rate = deuteriumRate(stage), rest = left;
  for (const change of changes) {
    const made = rate * (change.at - at) / HOUR_MS;
    if (rate > 0 && made >= rest) return new Date(at + rest / rate * HOUR_MS);
    rest -= made;
    at = change.at;
    rate = Math.max(rate, deuteriumRate(change.stage));
  }
  return rate > 0 ? new Date(at + rest / rate * HOUR_MS) : null;
}

/**
 * THE JUMP'S LAST STRETCH AS ONE PLAN (plan 2026-11-08 F7, moment 15). Read off the same ladder and
 * queue as the ship screen: an engine on the queue is queued, never ready, and the fuel's time assumes
 * none of it is flown, which the panel says.
 */
export function departurePlan(ship: PlanShip, nowMs: number): DeparturePlan {
  const progress: VesselProgress = { modules: ship.modules, facts: ship.facts, parts: ship.parts, fuel: ship.fuel };
  const repairs = ship.queue.filter(order => order.queue === 'CONSTRUCTION');
  const ahead = afterQueue(progress, repairs.flatMap(order => stepOf(order.subject, order.stage) ?? []));
  const hull = engine('DRIVE_HULL', progress, ahead, repairs);
  const thrust = engine('DRIVE_THRUST', progress, ahead, repairs);

  const have = Math.floor(ship.fuel + ship.deuterium + ship.bufferDeuterium);
  const needed = STARTER.fuelForJump;
  const plant = moduleStage(progress, 'DEUTERIUM_PLANT');
  const changes = repairs.filter(order => order.subject === 'DEUTERIUM_PLANT')
    .map(order => ({ at: order.readyAt.getTime(), stage: order.stage })).sort((a, b) => a.at - b.at);
  const readyAt = filledAt(needed - have, plant, changes, nowMs);
  const plant2 = stepOf('DEUTERIUM_PLANT', 2)!;
  const lever = plant === 1 && changes.length === 0 && have < needed
    ? filledAt(needed - have, plant, [{ at: nowMs + plant2.minutes * 60_000, stage: 2 }], nowMs)
    : null;
  const fuel: FuelOutlook = { have, needed, perHour: deuteriumRate(moduleStage(ahead, 'DEUTERIUM_PLANT')), readyAt, lever };

  const enginesAt = thrust.state === 'done' ? new Date(nowMs) : thrust.state === 'queued' ? thrust.readyAt : null;
  const waitsOn = enginesAt && readyAt ? (readyAt > enginesAt ? 'fuel' : 'engines') : null;
  return { hull, thrust, fuel, enginesAt, waitsOn };
}

const DAY_MS = 86_400_000;

export type JumpOutlook =
  | { kind: 'noFrontier' }
  | { kind: 'seasonClosed'; daysLeft: number }
  | { kind: 'seasonLate'; closesAt: Date };

/**
 * WHAT THE JUMP WILL MEET, SAID WHILE THERE IS STILL TIME (plan F7, moment 16). The server refuses
 * the same things at the press (`departureBlock`); this reads them early from the target the panel
 * already has, and from when the plan says the ship will be ready.
 */
export function jumpOutlook(target: { seasonEndsAt: Date } | null, readyAt: Date | null, nowMs: number): JumpOutlook | null {
  if (!target) return { kind: 'noFrontier' };
  const endsAt = target.seasonEndsAt.getTime();
  const closesAt = endsAt - STARTER.migrationCutoffDays * DAY_MS;
  if (nowMs >= closesAt) return { kind: 'seasonClosed', daysLeft: Math.ceil((endsAt - nowMs) / DAY_MS) };
  if (readyAt && readyAt.getTime() > closesAt) return { kind: 'seasonLate', closesAt: new Date(closesAt) };
  return null;
}
