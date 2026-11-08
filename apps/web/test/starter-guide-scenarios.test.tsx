import { STARTER_CRATES, crateStates, openingProgress, type VesselFact, type VesselProgress } from '@astera/rules';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { opportunityKey } from '../src/starter/opportunities.js';
import { waitMode } from '../src/starter/tutorial/script.js';
import { useStarterTutorial } from '../src/starter/tutorial/useStarterTutorial.js';
import { goalMarks, starterGoal } from '../src/starter/tutorial/visualGoal.js';
import { wireVessel } from './starterVesselFixture.js';

/**
 * PLAN F3, THE ACCEPTANCE SCENARIOS. One ship, read the way the shell reads it: the hook's answer and
 * offers, and the marks the shell lights from them with the guide on and off.
 */
const none = { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 };
const rich = { ...none, alloy: 50_000, crystal: 50_000 };
const state = vi.hoisted(() => ({
  wire: {},
  held: { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 },
  runs: [] as { departAt: Date; arriveAt: Date; homeAt: Date | null }[],
}));
vi.mock('../src/api/queries.js', () => ({
  usePlanet: () => ({ data: { vessel: vesselSchema.parse(wireVessel(state.wire)) }, dataUpdatedAt: Date.now() }),
  usePending: () => ({ data: { pending: [] } }),
  useMining: () => ({ data: { runs: state.runs } }),
  useGalaxy: () => ({ data: undefined }),
  useTraffic: () => ({ data: undefined }),
}));
vi.mock('../src/lib/projection.js', () => ({ useProjected: () => state.held }));
afterEach(() => { localStorage.clear(); state.wire = {}; state.held = none; state.runs = []; });

const MIN = 60_000;
/** A ship with these modules and facts; its crates are read off them, opened ones named. */
const ship = (modules: Record<string, number>, facts: VesselFact[] = [], opened: readonly string[] = [], over: Record<string, unknown> = {}) => {
  const progress: VesselProgress = { ...openingProgress(), modules: { ...openingProgress().modules, ...modules }, facts };
  state.wire = { progress, crates: crateStates(progress, opened), ...over };
};
const order = (subject: string, stage: number, minutes: number) => ({
  id: `${subject}-${String(stage)}`, queue: 'CONSTRUCTION', subject, stage, count: 1,
  startedAt: new Date(Date.now() - MIN).toISOString(), readyAt: new Date(Date.now() + minutes * MIN).toISOString(), cost: { alloy: 0, crystal: 0, deuterium: 0 },
});
const ALL_CRATES = STARTER_CRATES.map(c => c.id);
const tutorial = (view: 'galaxy' | 'ship' = 'galaxy') => {
  const hook = renderHook(() => useStarterTutorial(view));
  const now = () => {
    const current = hook.result.current;
    if (!current) throw new Error('no ship');
    return current;
  };
  return { now, rerender: hook.rerender };
};
const stepId = (answer: ReturnType<ReturnType<typeof tutorial>['now']>['answer']) => answer.kind === 'step' ? answer.id : answer.kind;

describe('the guide on and off', () => {
  it('points a player without the guide where the guide would, and holds nothing for them', () => {
    ship({}, [], [], { unlockToAnnounce: null });
    state.held = rich;
    const t = tutorial().now();
    expect(t.answer).toMatchObject({ kind: 'step', id: 'orderRefinery', strict: true });
    const guided = goalMarks(starterGoal(t, true));
    const alone = goalMarks(starterGoal(t, false));
    expect(starterGoal(t, false).step).toBeNull();
    expect(alone.marks).toEqual(guided.marks);
    expect(alone.hand).toBe(false);
  });

  it('gives the hand to the pick only while the guide is on', () => {
    ship({ REFINERY: 2 }, [], ALL_CRATES);
    state.held = rich;
    const first = tutorial().now();
    expect(first.answer.kind).toBe('advise');
    localStorage.setItem(`astera.starter.advice.ship-1`, JSON.stringify({ pick: opportunityKey(first.offers[0]!), shown: true }));
    const picked = tutorial().now();
    expect(goalMarks(starterGoal(picked, true)).hand).toBe(true);
    expect(goalMarks(starterGoal(picked, false)).hand).toBe(false);
  });
});

describe('a move the advisor did not recommend', () => {
  it('counts as progress: nothing is taught about it, it leaves the offers, and the pick stands', () => {
    ship({ REFINERY: 2 }, [], ALL_CRATES);
    state.held = rich;
    const before = tutorial().now();
    const [recommended, other] = before.offers;
    expect(other?.kind).toBe('repair');
    if (other?.kind !== 'repair' || !recommended) throw new Error('two repairs on offer');
    localStorage.setItem(`astera.starter.advice.ship-1`, JSON.stringify({ pick: opportunityKey(recommended), shown: true }));
    ship({ REFINERY: 2 }, [], ALL_CRATES, { queue: [order(other.step.module, other.step.stage, 30)] });
    const after = tutorial().now();
    expect(after.answer.kind).toBe('advise');
    expect(after.offers.map(opportunityKey)).not.toContain(opportunityKey(other));
    expect(after.pick && opportunityKey(after.pick)).toBe(opportunityKey(recommended));
  });

  it('lets the pick go once the player has done it', () => {
    ship({ REFINERY: 2 }, [], ALL_CRATES);
    state.held = rich;
    const [recommended] = tutorial().now().offers;
    if (recommended?.kind !== 'repair') throw new Error('a repair first');
    localStorage.setItem(`astera.starter.advice.ship-1`, JSON.stringify({ pick: opportunityKey(recommended), shown: true }));
    ship({ REFINERY: 2 }, [], ALL_CRATES, { queue: [order(recommended.step.module, recommended.step.stage, 30)] });
    expect(tutorial().now().pick).toBeUndefined();
  });
});

/** No ship can spend itself into a corner (`starter-ladder`): what is left is a time, never a dead end. */
describe('spending everything', () => {
  const saving = (held: typeof none) => {
    state.held = held;
    const t = tutorial().now();
    expect(t.answer.kind).toBe('advise');
    const head = t.offers[0];
    expect(head?.kind).toBe('save');
    expect(head?.kind === 'save' && head.minutes).toBeGreaterThan(0);
    expect(goalMarks(starterGoal(t, true)).marks).toEqual([]);
  };

  it('says how long until the next repair once the Extractor runs, and points at nothing', () => {
    ship({ REFINERY: 2, EXTRACTOR: 1 }, [], ALL_CRATES);
    saving(none);
  });

  it('says the same before it, with the crystal the ladder leaves for the Extractor', () => {
    ship({ REFINERY: 2, VAULT: 1 }, [], ALL_CRATES);
    saving({ ...none, crystal: 61 });
  });
});

describe('leaving at minute two', () => {
  it('comes back on another phone past the core, to the crate the first repair opened', () => {
    ship({ REFINERY: 2 });
    const t = tutorial().now();
    expect(t.answer).toMatchObject({ kind: 'step', id: 'firstCrate', strict: false, nav: 'openShip' });
    expect(stepId(t.answer)).not.toMatch(/^(online|collect|orderRefinery|waitFirst)$/);
  });

  it('teaches nothing again once the crate is open', () => {
    ship({ REFINERY: 2 }, [], [STARTER_CRATES[0]!.id]);
    expect(tutorial().now().answer.kind).toBe('advise');
  });
});

describe('leaving while a flight is out', () => {
  const yard = { REFINERY: 3, SURVEY: 1, SHIPYARD: 1, EXTRACTOR: 3 };
  const run = () => [{ departAt: new Date(Date.now() - 2 * MIN), arriveAt: new Date(Date.now() + 2 * MIN), homeAt: null }];

  it('says when it is back and steps aside until then', () => {
    ship(yard, ['FIRST_PROBE_REPORT'], ALL_CRATES);
    localStorage.setItem('astera.starter.tutorial.ship-1', JSON.stringify(['report']));
    state.runs = run();
    const t = tutorial().now();
    expect(t.answer).toMatchObject({ kind: 'step', id: 'mineFlying', step: 'wait' });
    expect(t.wait?.until.getTime()).toBe(t.homeAt?.getTime());
    expect(waitMode(t.wait)).toBe('away');
    expect(t.offers[0]).toEqual({ kind: 'underway', what: 'mine' });
  });

  it('asks for the haul on return, with the guide or without', () => {
    ship(yard, ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'], ALL_CRATES);
    localStorage.setItem('astera.starter.tutorial.ship-1', JSON.stringify(['report']));
    state.held = { ...none, bufferAlloy: 80 };
    const t = tutorial().now();
    expect(t.answer).toMatchObject({ kind: 'step', id: 'collectMine' });
    expect(t.offers.map(o => o.kind)).toContain('collect');
    expect(goalMarks(starterGoal({ ...t, pick: { kind: 'collect' } }, false)).marks).toEqual(['[data-guide="works"]']);
  });
});
