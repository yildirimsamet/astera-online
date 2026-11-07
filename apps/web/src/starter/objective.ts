import {
  REPAIR_LADDER, STARTER, canLoadFuel, isJumpReady, nextRequiredStep,
  type RepairStep, type StarterFeature, type VesselFact, type VesselProgress,
} from '@astera/rules';
import { timeToAfford } from './steps.js';

export type ShipObjective =
  | { kind: 'repair'; step: RepairStep }
  | { kind: 'collect' }
  | { kind: 'save'; step: RepairStep; minutes: number | null }
  | { kind: 'wait'; readyAt: Date }
  | { kind: 'probe' }
  | { kind: 'mine' }
  | { kind: 'underway'; what: 'probe' | 'mine' }
  | { kind: 'fact'; fact: VesselFact }
  | { kind: 'parts'; count: number }
  | { kind: 'fuel' }
  | { kind: 'jump' };

export interface ObjectiveInput {
  progress: VesselProgress;
  queue: readonly { queue: string; subject: string; stage: number; readyAt: Date }[];
  held: { alloy: number; crystal: number; bufferAlloy: number; bufferCrystal: number };
  income: { alloyPerHour: number; crystalPerHour: number };
  /** What the ship has opened; the first deeds follow their system at once. */
  features?: readonly StarterFeature[];
  /** A probe of this ship's in the air, and a Prospector out mining. */
  probing?: boolean;
  mining?: boolean;
}

const DEED_FACT = { probe: 'FIRST_PROBE_REPORT', mine: 'FIRST_MINING_RETURN' } as const satisfies Record<'probe' | 'mine', VesselFact>;

/**
 * THE ONE THING TO DO NEXT (owner 2026-11-06: after a collect or a dismissed note the player was left
 * on an empty screen). Read off the same ladder the ship screen orders from, as if the queue had run.
 */
export function shipObjective({ progress, queue, held, income, features = [], probing = false, mining = false }: ObjectiveInput): ShipObjective {
  const repairs = queue.filter(order => order.queue === 'CONSTRUCTION');
  const queued = repairs.flatMap(order => REPAIR_LADDER.find(s => s.module === order.subject && s.stage === order.stage) ?? []);
  const soonest = (): Date => new Date(Math.min(...repairs.map(order => order.readyAt.getTime())));
  const next = nextRequiredStep(progress, queued);
  // Every required repair is done or queued. The tank opens only once the thrust and the second plant are in.
  if (!next) return isJumpReady(progress) ? { kind: 'jump' } : canLoadFuel(progress) ? { kind: 'fuel' } : { kind: 'wait', readyAt: soonest() };
  const queueFull = repairs.length >= STARTER.queues.construction;
  const { step } = next;
  const storePays = held.alloy >= step.alloy && held.crystal >= step.crystal;
  if (features.includes('fleet') && !progress.facts.includes('FIRST_MINING_RETURN') && !mining) return { kind: 'mine' };
  // A repair that can be paid now goes first: the queue keeps working while the deed is done.
  if (next.missing.length === 0 && !queueFull && storePays) return { kind: 'repair', step };
  // The first probe once the antenna is up, the first mining run once the shipyard is.
  const flying = { probe: probing, mine: mining };
  const opened = { probe: features.includes('intel'), mine: features.includes('fleet') };
  const deeds = (['probe', 'mine'] as const).filter(deed => opened[deed] && !progress.facts.includes(DEED_FACT[deed]));
  const todo = deeds.find(deed => !flying[deed]);
  if (todo) return { kind: todo };
  const out = deeds[0];
  if (out) return { kind: 'underway', what: out };
  const fact = next.missing.find(need => need.kind === 'FACT');
  if (fact?.kind === 'FACT') return { kind: 'fact', fact: fact.fact };
  const parts = next.missing.find(need => need.kind === 'PARTS');
  // The rule names the whole need; the line asks only for what the hold still lacks.
  if (parts?.kind === 'PARTS') return { kind: 'parts', count: Math.max(0, parts.count - progress.parts) };
  if (repairs.length > 0 && (next.missing.length > 0 || queueFull)) return { kind: 'wait', readyAt: soonest() };
  if (storePays && next.missing.length === 0) return { kind: 'repair', step };
  if (held.alloy + held.bufferAlloy >= step.alloy && held.crystal + held.bufferCrystal >= step.crystal) return { kind: 'collect' };
  return { kind: 'save', step, minutes: timeToAfford(step, held, income) };
}
