import { REPAIR_LADDER, STARTER, openingProgress, type VesselProgress } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { opportunities, type OpportunityInput } from '../src/starter/opportunities.js';

/**
 * ONE NEXT STEP, ALWAYS (owner 2026-11-06: after collecting or dismissing, the player was left on an
 * empty screen). Whatever state the ship is in, the first opportunity names the single thing to do
 * next; the ones after it are the other real choices of this moment (plan 2026-11-08 F1).
 */
const step = (module: string, stage: number) => {
  const found = REPAIR_LADDER.find(s => s.module === module && s.stage === stage);
  if (!found) throw new Error(`no ${module} ${String(stage)}`);
  return found;
};
const first = step('REFINERY', 2);

const next = (i: OpportunityInput) => opportunities(i)[0];

const input = (over: Partial<OpportunityInput> = {}): OpportunityInput => ({
  progress: openingProgress(),
  queue: [],
  held: { alloy: 10_000, crystal: 10_000, bufferAlloy: 0, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 },
  income: { alloyPerHour: 60, crystalPerHour: 0 },
  ...over,
});

describe('the next step', () => {
  it('asks for the first repair when the store can pay it', () => {
    expect(next(input())).toEqual({ kind: 'repair', step: first });
  });

  it('asks for a collect when only the works can make up the price', () => {
    const held = { alloy: first.alloy - 10, crystal: first.crystal, bufferAlloy: 60, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 };
    expect(next(input({ held }))).toEqual({ kind: 'collect' });
  });

  it('says how long to save when neither can pay', () => {
    const held = { alloy: 0, crystal: first.crystal, bufferAlloy: 0, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 };
    const answer = next(input({ held }));
    expect(answer).toMatchObject({ kind: 'save', step: first });
    expect(answer.kind === 'save' && answer.minutes).toBeCloseTo((first.alloy / 60) * 60, 5);
  });

  it('says what is being repaired, and when it is done, while the queue is full', () => {
    const readyAt = new Date('2026-11-06T12:00:00Z');
    const queue = Array.from({ length: STARTER.queues.construction }, () => ({ queue: 'CONSTRUCTION' as const, subject: 'REFINERY', stage: 2, readyAt }));
    expect(next(input({ queue }))).toMatchObject({ kind: 'wait', readyAt });
  });

  it('names the deed a repair waits on, not a price', () => {
    // Every repair whose only gate is a deed: the line must send the player to do it.
    const gated = REPAIR_LADDER.find(s => s.required && s.requires.some(need => need.kind === 'FACT'));
    expect(gated).toBeDefined();
    if (!gated) return;
    const fact = gated.requires.find(need => need.kind === 'FACT');
    const modules: Record<string, number> = {};
    for (const s of REPAIR_LADDER) if (s.required && !(s.module === gated.module && s.stage >= gated.stage)) modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
    for (const need of gated.requires) if (need.kind === 'MODULE') modules[need.module] = Math.max(modules[need.module] ?? 0, need.stage);
    const progress: VesselProgress = { ...openingProgress(), modules, facts: [] };
    expect(next(input({ progress }))).toMatchObject({ kind: 'fact', fact: fact?.kind === 'FACT' ? fact.fact : '' });
  });

  /**
   * THE FIRST DEEDS COME AS SOON AS THEIR SYSTEM DOES (onboarding design, Perde 1–2): the first probe
   * the moment the antenna is up, the first mining run the moment the shipyard is, not when a later
   * repair finally waits on them.
   */
  it('asks for the first probe once the antenna is up, after any repair it can pay for now', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 } };
    const poor = { alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 };
    expect(next(input({ progress, held: poor, features: ['production', 'intel'] }))).toEqual({ kind: 'probe' });
    expect(next(input({ progress, features: ['production', 'intel'] })).kind).toBe('repair');
  });

  it('says the probe is on its way while it flies, instead of asking for another', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 } };
    const poor = { alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 };
    expect(next(input({ progress, held: poor, features: ['production', 'intel'], probing: true })).kind).not.toBe('probe');
  });

  it('asks for the first mining run once the shipyard is up, and waits for the Prospector while it is out', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1, SHIPYARD: 1 }, facts: ['FIRST_PROBE_REPORT'] };
    const poor = { alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 };
    expect(next(input({ progress, held: poor, features: ['production', 'intel', 'fleet'] }))).toEqual({ kind: 'mine' });
    expect(next(input({ progress, held: poor, features: ['production', 'intel', 'fleet'], mining: true }))).toEqual({ kind: 'underway', what: 'mine' });
  });

  it('asks for fuel once every required repair is done, and for the jump when the tank is full', () => {
    const modules: Record<string, number> = {};
    for (const s of REPAIR_LADDER) if (s.required) modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
    const done: VesselProgress = { modules, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'], parts: STARTER.parts.needed, fuel: 0 };
    expect(next(input({ progress: done }))).toEqual({ kind: 'fuel' });
    expect(next(input({ progress: { ...done, fuel: STARTER.fuelForJump } }))).toEqual({ kind: 'jump' });
  });

  // The tank stays shut until the thrust assembly and the second plant are in: asking for fuel then is a dead end.
  it('waits for the last required repair in the queue before it asks for fuel', () => {
    const modules: Record<string, number> = {};
    for (const s of REPAIR_LADDER) if (s.required && s.module !== 'DRIVE_THRUST') modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
    const progress: VesselProgress = { modules, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'], parts: STARTER.parts.needed, fuel: 0 };
    const readyAt = new Date('2026-11-08T12:00:00Z');
    const queue = [{ queue: 'CONSTRUCTION', subject: 'DRIVE_THRUST', stage: 1, readyAt }];
    expect(next(input({ progress, queue }))).toEqual({ kind: 'wait', readyAt });
  });
});

it('keeps the first mining flight ahead of another affordable repair', () => {
  const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 3, SURVEY: 1, VAULT: 1, SHIPYARD: 1 }, facts: ['FIRST_PROBE_REPORT'] };
  expect(next(input({ progress, features: ['production', 'intel', 'fleet'] }))).toEqual({ kind: 'mine' });
});

/** The line counts what is still to find, as the NPC's hint does: a part in the hold is not asked for again. */
it('asks only for the thrust parts still missing', () => {
  const modules: Record<string, number> = {};
  for (const s of REPAIR_LADDER) if (s.required && s.module !== 'DRIVE_THRUST') modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
  const progress: VesselProgress = { modules, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'], parts: 1, fuel: 0 };
  expect(next(input({ progress }))).toEqual({ kind: 'parts', count: STARTER.parts.needed - 1 });
});

/** Every required repair in, the thrust parts in the hold: what is left is the tank. */
const departureReady = (): VesselProgress => {
  const modules: Record<string, number> = {};
  for (const s of REPAIR_LADDER) if (s.required) modules[s.module] = Math.max(modules[s.module] ?? 0, s.stage);
  return { modules, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT'], parts: STARTER.parts.needed, fuel: 0 };
};
const empty = { alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0 };

describe('the tank', () => {
  it('loads from the store, and asks for a collect first when the Deuterium is still in the works', () => {
    expect(next(input({ progress: departureReady(), held: { ...empty, deuterium: 40 } }))).toEqual({ kind: 'fuel' });
    expect(next(input({ progress: departureReady(), held: { ...empty, bufferDeuterium: 40 } }))).toEqual({ kind: 'collect' });
  });
});

describe('a probe needs someone to probe', () => {
  const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 } };
  it('is not offered when no other ship is in this galaxy', () => {
    const answers = opportunities(input({ progress, held: empty, features: ['production', 'intel'], alone: true }));
    expect(answers.map(answer => answer.kind)).not.toContain('probe');
  });
});

describe('the other choices of this moment', () => {
  const kinds = (i: OpportunityInput) => opportunities(i).slice(1);

  it('never repeats the first one', () => {
    const [head, ...rest] = opportunities(input());
    expect(head).toEqual({ kind: 'repair', step: first });
    expect(rest).not.toContainEqual(head);
  });

  it('lists every repair the store pays and the queue can take, the required ones first', () => {
    const rest = kinds(input());
    const repairs = rest.flatMap(answer => answer.kind === 'repair' ? [answer.step] : []);
    expect(repairs.length).toBeGreaterThan(0);
    for (const s of repairs) expect(s.alloy <= 10_000 && s.crystal <= 10_000).toBe(true);
    const firstOptional = repairs.findIndex(s => !s.required);
    if (firstOptional >= 0) expect(repairs.slice(firstOptional).every(s => !s.required)).toBe(true);
  });

  it('offers a repair that stands on one still in the queue, as the server takes it', () => {
    const queue = [{ queue: 'CONSTRUCTION', subject: 'REFINERY', stage: 2, readyAt: new Date('2026-11-08T12:00:00Z') }];
    const [head, ...rest] = opportunities(input({ queue }));
    expect(head).toMatchObject({ kind: 'repair' });
    expect([head, ...rest]).not.toContainEqual({ kind: 'repair', step: first });
  });

  it('offers no repair while the queue is full', () => {
    const readyAt = new Date('2026-11-08T12:00:00Z');
    const queue = Array.from({ length: STARTER.queues.construction }, (_, slot) => ({ queue: 'CONSTRUCTION', subject: 'REFINERY', stage: 2 + slot, readyAt }));
    expect(opportunities(input({ queue })).some(answer => answer.kind === 'repair')).toBe(false);
  });

  it('offers nothing the store cannot pay', () => {
    expect(kinds(input({ held: empty })).some(answer => answer.kind === 'repair')).toBe(false);
  });

  it('keeps the first probe among the choices when a repair comes first', () => {
    const progress: VesselProgress = { ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 } };
    const [head, ...rest] = opportunities(input({ progress, features: ['production', 'intel'] }));
    expect(head.kind).toBe('repair');
    expect(rest).toContainEqual({ kind: 'probe' });
  });

  it('offers a collect once the works hold something', () => {
    expect(kinds(input({ held: { ...empty, alloy: 10_000, crystal: 10_000, bufferAlloy: 30 } }))).toContainEqual({ kind: 'collect' });
    expect(kinds(input())).not.toContainEqual({ kind: 'collect' });
  });
});
