import { STARTER_CRATES, crateStates, openingProgress, type VesselFact, type VesselProgress } from '@astera/rules';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { opportunityKey } from '../src/starter/opportunities.js';

import { playScene, resetDirector, skipBeat } from '../src/starter/director/director.js';
import { setLandingSheet } from '../src/starter/tutorial/landingSheet.js';
import { COLLECT_MARK } from '../src/starter/tutorial/script.js';
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
  useIntel: () => ({ data: undefined }),
}));
vi.mock('../src/lib/projection.js', () => ({ useProjected: () => state.held }));
vi.mock('../src/starter/queries.js', async (importActual) => ({ ...await importActual<Record<string, unknown>>(), useMigration: () => ({ data: undefined }) }));
afterEach(() => { localStorage.clear(); state.wire = {}; state.held = none; state.runs = []; resetDirector(); setLandingSheet(false); });

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
/** The road has been walked: what is left is the advisor's. */
const walked = () => { localStorage.setItem('astera.starter.tutorial.ship-1', JSON.stringify(['farewell'])); };
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

// Plan 2026-11-13 §5.1: the handover reads the jump window the server opens, not the share alone.
describe('the handover and the jump window', () => {
  const loop = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };
  it('knows the window is open once the loop\'s repairs and deeds are all in', () => {
    ship(loop, ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT']);
    expect(tutorial().now().windowOpen).toBe(true);
  });
  it('knows it is shut while a deed of the loop is missing', () => {
    ship(loop, ['FIRST_MINING_SENT', 'FIRST_PROBE_REPORT']);
    expect(tutorial().now().windowOpen).toBe(false);
  });

  // Owner phone playtest 2026-11-18, item 24: shown first, then asked; the landing is the player's alone.
  it('asks about the jump once the drive\'s scene has been seen, and says nothing while the landing is chosen', () => {
    ship(loop, ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'], ALL_CRATES, { unlockToAnnounce: null });
    localStorage.setItem('astera.starter.tutorial.ship-1', JSON.stringify(['openIntel', 'openReport', 'report', 'collectMine']));
    const shown = tutorial('ship');
    act(() => { playScene({ id: 'jumpReady', once: true, keep: true, beats: [{ id: 'lit', shot: { kind: 'bay', system: 'DRIVE' }, ms: 2000 }] }, 'ship-1'); });
    shown.rerender();
    expect(stepId(shown.now().answer)).not.toBe('jumpAsk');
    act(() => { skipBeat(); });
    shown.rerender();
    // The line on the screen is read first: one thing at a time (owner phone playtest 2026-11-19).
    expect(stepId(shown.now().answer)).toBe('farewell');
    act(() => { shown.now().ack('farewell'); });
    expect(stepId(shown.now().answer)).toBe('jumpAsk');
    act(() => { setLandingSheet(true); });
    shown.rerender();
    expect(shown.now().answer).toEqual({ kind: 'quiet' });
  });
});

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
    walked();
    const first = tutorial().now();
    expect(first.answer.kind).toBe('advise');
    localStorage.setItem(`astera.starter.advice.ship-1`, JSON.stringify({ pick: opportunityKey(first.offers[0]!), shown: true }));
    const picked = tutorial().now();
    expect(goalMarks(starterGoal(picked, true)).hand).toBe(true);
    expect(goalMarks(starterGoal(picked, false)).hand).toBe(false);
  });
});

describe('a move the advisor did not recommend', () => {
  const PAST_ROAD = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };
  const deeds: VesselFact[] = ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'];
  // The first loop done and the hold not yet full, so a repair leads and the jump waits (plan 2026-11-13 §5.1).
  const roomLeft = { ...none, alloy: 50_000, crystal: 900 };
  // The road walked, and the report and the haul read when they came.
  const walkedAll = () => { localStorage.setItem('astera.starter.tutorial.ship-1', JSON.stringify(['farewell', 'jumpAsk', 'jumpGo', 'openIntel', 'openReport', 'report', 'collectMine'])); };

  it('counts as progress: nothing is taught about it, it leaves the offers, and the pick stands', () => {
    ship(PAST_ROAD, deeds, ALL_CRATES);
    state.held = roomLeft;
    walkedAll();
    const before = tutorial().now();
    const [recommended] = before.offers;
    const other = before.offers.slice(1).find(offer => offer.kind === 'repair');
    expect(recommended?.kind).toBe('repair');
    if (other?.kind !== 'repair' || !recommended) throw new Error('two repairs on offer');
    localStorage.setItem(`astera.starter.advice.ship-1`, JSON.stringify({ pick: opportunityKey(recommended), shown: true }));
    ship(PAST_ROAD, deeds, ALL_CRATES, { queue: [order(other.step.module, other.step.stage, 30)] });
    const after = tutorial().now();
    expect(after.answer.kind).toBe('advise');
    expect(after.offers.map(opportunityKey)).not.toContain(opportunityKey(other));
    expect(after.pick && opportunityKey(after.pick)).toBe(opportunityKey(recommended));
  });

  it('lets the pick go once the player has done it', () => {
    ship(PAST_ROAD, deeds, ALL_CRATES);
    state.held = roomLeft;
    walkedAll();
    const [recommended] = tutorial().now().offers;
    if (recommended?.kind !== 'repair') throw new Error('a repair first');
    localStorage.setItem(`astera.starter.advice.ship-1`, JSON.stringify({ pick: opportunityKey(recommended), shown: true }));
    ship(PAST_ROAD, deeds, ALL_CRATES, { queue: [order(recommended.step.module, recommended.step.stage, 30)] });
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
    walked();
    saving(none);
  });

  it('says the same before it, with the crystal the ladder leaves for the Extractor', () => {
    ship({ REFINERY: 2, VAULT: 1 }, [], ALL_CRATES);
    walked();
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

  it('does not teach the crate again once it is open: the road goes on', () => {
    ship({ REFINERY: 2 }, [], [STARTER_CRATES[0]!.id]);
    expect(tutorial().now().answer).toMatchObject({ id: 'orderExtractor', strict: false });
  });
});

describe('leaving while a flight is out', () => {
  const yard = { REFINERY: 3, EXTRACTOR: 3, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };
  const out = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 };
  const run = () => [{ departAt: new Date(Date.now() - 2 * MIN), arriveAt: new Date(Date.now() + 2 * MIN), homeAt: null }];

  it('does not stop the road for the flight, and the line says it is under way', () => {
    ship(out, [], ALL_CRATES);
    state.held = rich;
    state.runs = run();
    const t = tutorial('ship').now();
    expect(t.answer).toMatchObject({ kind: 'step', id: 'orderSurvey', strict: false });
    expect(t.offers.map(o => o.kind)).not.toContain('mine');
  });

  it('asks for the haul on return, with the guide or without', () => {
    ship(yard, ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'], ALL_CRATES);
    localStorage.setItem('astera.starter.tutorial.ship-1', JSON.stringify(['report']));
    state.held = { ...none, bufferAlloy: 80 };
    const t = tutorial().now();
    expect(t.answer).toMatchObject({ kind: 'step', id: 'collectMine' });
    expect(t.offers.map(o => o.kind)).toContain('collect');
    expect(goalMarks(starterGoal({ ...t, pick: { kind: 'collect' } }, false)).marks).toEqual([COLLECT_MARK]);
  });
});
