import {
  REPAIR_LADDER, STARTER, afterQueue, canLoadFuel, isJumpReady, nextRequiredStep, nextSteps,
  type RepairStep, type StarterFeature, type VesselFact, type VesselProgress,
} from '@astera/rules';
import { timeToAfford } from './steps.js';

export type Opportunity =
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

export interface OpportunityInput {
  progress: VesselProgress;
  queue: readonly { queue: string; subject: string; stage: number; readyAt: Date }[];
  /** The store, and the works (the pool) that a collect empties into it. */
  held: { alloy: number; crystal: number; deuterium: number; bufferAlloy: number; bufferCrystal: number; bufferDeuterium: number };
  income: { alloyPerHour: number; crystalPerHour: number };
  /** What the ship has opened; the first deeds follow their system at once. */
  features?: readonly StarterFeature[];
  /** A probe of this ship's in the air, and a Prospector out mining. */
  probing?: boolean;
  mining?: boolean;
  /** No other ship is in this galaxy: there is nobody to probe. */
  alone?: boolean;
}

const DEED_FACT = { probe: 'FIRST_PROBE_REPORT', mine: 'FIRST_MINING_RETURN' } as const satisfies Record<'probe' | 'mine', VesselFact>;

/** One name per offer, stable while it is on offer: what a pick is remembered by. */
export const opportunityKey = (o: Opportunity): string => o.kind === 'repair' || o.kind === 'save' ? `${o.kind}:${o.step.module}:${String(o.step.stage)}` : o.kind;

/**
 * WHAT THIS SHIP CAN DO, BEST FIRST (plan 2026-11-08 F1). The first entry is the one thing the line
 * names, and may be a state (a wait, a deed under way, a price to save for). The entries after it are
 * the other things the player could do this moment, each doable now: the choices an advisor offers.
 * Read off the same ladder and queue rule the server orders by, so nothing here is refused there.
 */
export function opportunities(input: OpportunityInput): [Opportunity, ...Opportunity[]] {
  const head = firstOpportunity(input);
  return [head, ...choices(input).filter(o => opportunityKey(o) !== opportunityKey(head))];
}

function repairQueue(input: OpportunityInput) {
  const repairs = input.queue.filter(order => order.queue === 'CONSTRUCTION');
  const queued = repairs.flatMap(order => REPAIR_LADDER.find(s => s.module === order.subject && s.stage === order.stage) ?? []);
  return { repairs, queued, full: repairs.length >= STARTER.queues.construction };
}

/** The first deeds, once their system is open and the fact is still missing. A probe needs a ship to probe. */
function deedsLeft(input: OpportunityInput): ('probe' | 'mine')[] {
  const features = input.features ?? [];
  const opened = { probe: features.includes('intel') && input.alone !== true, mine: features.includes('fleet') };
  return (['probe', 'mine'] as const).filter(deed => opened[deed] && !input.progress.facts.includes(DEED_FACT[deed]));
}

const flyingFor = (input: OpportunityInput) => ({ probe: input.probing === true, mine: input.mining === true });

/** Fuel moves from the store; Deuterium still in the works is one collect away. */
function tank(input: OpportunityInput): Opportunity {
  return input.held.deuterium < 1 && input.held.bufferDeuterium >= 1 ? { kind: 'collect' } : { kind: 'fuel' };
}

/** Everything doable this moment, in the order an advisor would offer it. */
function choices(input: OpportunityInput): Opportunity[] {
  const { queued, full } = repairQueue(input);
  const { held, progress } = input;
  const pays = (s: RepairStep) => held.alloy >= s.alloy && held.crystal >= s.crystal;
  const repairs = full ? [] : nextSteps(afterQueue(progress, queued)).filter(pays);
  const flying = flyingFor(input);
  const deeds = deedsLeft(input).filter(deed => !flying[deed]).map((kind): Opportunity => ({ kind }));
  const works = held.bufferAlloy >= 1 || held.bufferCrystal >= 1 || held.bufferDeuterium >= 1;
  const fuel = canLoadFuel(progress) && !isJumpReady(progress) && held.deuterium >= 1;
  return [
    ...repairs.filter(s => s.required).map((step): Opportunity => ({ kind: 'repair', step })),
    ...deeds,
    ...repairs.filter(s => !s.required).map((step): Opportunity => ({ kind: 'repair', step })),
    ...(works ? [{ kind: 'collect' } as const] : []),
    ...(fuel ? [{ kind: 'fuel' } as const] : []),
  ];
}

/**
 * THE ONE THING TO DO NEXT (owner 2026-11-06: after a collect or a dismissed note the player was left
 * on an empty screen). Read off the same ladder the ship screen orders from, as if the queue had run.
 */
function firstOpportunity(input: OpportunityInput): Opportunity {
  const { progress, held, income } = input;
  const features = input.features ?? [];
  const { repairs, queued, full } = repairQueue(input);
  const soonest = (): Date => new Date(Math.min(...repairs.map(order => order.readyAt.getTime())));
  const next = nextRequiredStep(progress, queued);
  // Every required repair is done or queued. The tank opens only once the thrust and the second plant are in.
  if (!next) return isJumpReady(progress) ? { kind: 'jump' } : canLoadFuel(progress) ? tank(input) : { kind: 'wait', readyAt: soonest() };
  const { step } = next;
  const storePays = held.alloy >= step.alloy && held.crystal >= step.crystal;
  if (features.includes('fleet') && !progress.facts.includes('FIRST_MINING_RETURN') && input.mining !== true) return { kind: 'mine' };
  // A repair that can be paid now goes first: the queue keeps working while the deed is done.
  if (next.missing.length === 0 && !full && storePays) return { kind: 'repair', step };
  // The first probe once the antenna is up, the first mining run once the shipyard is.
  const flying = flyingFor(input);
  const deeds = deedsLeft(input);
  const todo = deeds.find(deed => !flying[deed]);
  if (todo) return { kind: todo };
  const out = deeds[0];
  if (out) return { kind: 'underway', what: out };
  const fact = next.missing.find(need => need.kind === 'FACT');
  if (fact?.kind === 'FACT') return { kind: 'fact', fact: fact.fact };
  const parts = next.missing.find(need => need.kind === 'PARTS');
  // The rule names the whole need; the line asks only for what the hold still lacks.
  if (parts?.kind === 'PARTS') return { kind: 'parts', count: Math.max(0, parts.count - progress.parts) };
  if (repairs.length > 0 && (next.missing.length > 0 || full)) return { kind: 'wait', readyAt: soonest() };
  if (storePays && next.missing.length === 0) return { kind: 'repair', step };
  if (held.alloy + held.bufferAlloy >= step.alloy && held.crystal + held.bufferCrystal >= step.crystal) return { kind: 'collect' };
  return { kind: 'save', step, minutes: timeToAfford(step, held, income) };
}
