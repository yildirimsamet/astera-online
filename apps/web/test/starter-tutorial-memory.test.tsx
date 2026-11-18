import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { wireVessel } from './starterVesselFixture.js';
import { useStarterTutorial } from '../src/starter/tutorial/useStarterTutorial.js';
import { SCENE_WAIT_MS, playScene, raiseStage, resetDirector, skipBeat } from '../src/starter/director/director.js';
import { setTargetSheet } from '../src/starter/tutorial/targetSheet.js';

const empty = { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 };
const state = vi.hoisted(() => ({
  ship: 'memory-1',
  runs: [] as { departAt: Date; arriveAt: Date; homeAt: Date | null; status?: string }[],
  planets: undefined as { id: string; firstHunt?: boolean }[] | undefined,
  held: { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0 },
  extra: {},
  migration: undefined as { block: { code: string; flying?: number; daysLeft?: number } | null } | undefined,
  migrationEnabled: [] as (boolean | undefined)[],
}));
vi.mock('../src/api/queries.js', () => ({
  usePlanet: () => ({ data: { vessel: vesselSchema.parse(wireVessel({ id: state.ship, ...state.extra })) }, dataUpdatedAt: Date.now() }),
  usePending: () => ({ data: { pending: [] } }),
  useMining: () => ({ data: { runs: state.runs } }),
  useGalaxy: () => ({ data: state.planets ? { planets: state.planets } : undefined }),
  useIntel: () => ({ data: { probeReports: [] } }),
  useTraffic: () => ({ data: undefined }),
}));
vi.mock('../src/lib/projection.js', () => ({ useProjected: () => state.held }));
vi.mock('../src/starter/queries.js', async (importActual) => ({
  ...await importActual<Record<string, unknown>>(),
  useMigration: (options?: { enabled?: boolean }) => { state.migrationEnabled.push(options?.enabled); return { data: state.migration }; },
}));
afterEach(() => { localStorage.clear(); resetDirector(); state.held = empty; state.ship = 'memory-1'; state.planets = undefined; state.runs = []; state.extra = {}; state.migration = undefined; state.migrationEnabled = []; setTargetSheet(false); });

describe('tutorial acknowledgement memory', () => {
  it('reads once per ship, updates on acknowledgement and keeps ships separate', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    rerender(); rerender();
    expect(get.mock.calls.filter(([key]) => key === 'astera.starter.tutorial.memory-1')).toHaveLength(1);
    expect(result.current?.answer).toMatchObject({ id: 'orderRefinery' });
    act(() => { result.current?.ack('orderRefinery'); });
    expect(localStorage.getItem('astera.starter.tutorial.memory-1')).toContain('orderRefinery');
    expect(result.current?.answer).toMatchObject({ id: 'waitFirst' });
    state.ship = 'memory-2'; rerender();
    expect(result.current?.answer).toMatchObject({ id: 'orderRefinery' });
    state.ship = 'memory-1'; rerender();
    expect(result.current?.answer).toMatchObject({ id: 'waitFirst' });
    get.mockRestore();
  });
});

/** Plan F3 (N1): the hook hands the shell the advisor's offers and what the player picked from them. */
describe('the advisor in the tutorial', () => {
  it('offers what the ship can do, best first, and says where the player stands', () => {
    state.held = { ...empty, alloy: 10_000, crystal: 10_000 };
    const { result } = renderHook(() => useStarterTutorial('ship'));
    expect(result.current?.offers[0]).toMatchObject({ kind: 'repair', step: { module: 'REFINERY', stage: 2 } });
    expect(result.current?.pick).toBeUndefined();
    expect(result.current?.view).toBe('ship');
  });

  it('follows the pick stored for this ship while it is still on offer', () => {
    state.held = { ...empty, alloy: 10_000, crystal: 10_000, bufferAlloy: 50 };
    localStorage.setItem('astera.starter.advice.memory-1', JSON.stringify({ pick: 'collect', shown: true }));
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.pick).toEqual({ kind: 'collect' });
    state.held = { ...state.held, bufferAlloy: 0 };
    rerender();
    expect(result.current?.pick).toBeUndefined();
  });
});

/**
 * THE LINE AND THE LIT CONTROL READ THE SAME OFFERS (review 2026-11-08). The hook once left the first
 * hunt out: the line said "probe the outpost" while the pulse lit a repair, and a hunt the player
 * picked was dropped as no longer on offer.
 */
describe('the first hunt in the hook', () => {
  it('offers the hunt the map marks, and keeps it when the player picks it', () => {
    state.planets = [{ id: 'post-1', firstHunt: true }];
    localStorage.setItem('astera.starter.advice.memory-1', JSON.stringify({ pick: 'hunt:probe', shown: true }));
    const { result } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.offers.some(offer => offer.kind === 'hunt')).toBe(true);
    expect(result.current?.pick).toMatchObject({ kind: 'hunt', hunt: { stage: 'probe', target: 'post-1' } });
  });

  it('does not count a finished mining run as one in the air', () => {
    state.planets = [{ id: 'post-1', firstHunt: true }];
    state.runs = [{ departAt: new Date('2026-11-06T12:00:00Z'), arriveAt: new Date('2026-11-06T12:01:00Z'), homeAt: new Date('2026-11-06T12:02:00Z'), status: 'done' }];
    const { result } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.offers.find(offer => offer.kind === 'hunt')).toMatchObject({ mining: false });
  });
});

// Live play 2026-11-18: the telescope came back in a scene, then the guide asked for its card to be closed.
describe('a system the director has shown coming back', () => {
  it('asks for no card to be closed once its scene has shown it', () => {
    state.extra = { unlockToAnnounce: 'telescope', progress: { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, facts: [] } };
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.answer).toMatchObject({ nav: 'dismissUnlock' });
    act(() => { playScene({ id: 'repair:TELESCOPE:1:done', once: true, beats: [{ id: 'back', shot: { kind: 'wide' }, ms: 100 }] }, 'memory-1'); skipBeat(); });
    rerender();
    expect(result.current?.answer).not.toMatchObject({ nav: 'dismissUnlock' });
  });

  // Code review 2026-11-19: a scene let go unseen said nothing; its card is asked for again.
  it('waits for the scene while it waits for the sky, and asks for the card once it is let go unseen', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    state.extra = { unlockToAnnounce: 'telescope', progress: { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, facts: [] } };
    const { result } = renderHook(() => useStarterTutorial('galaxy'));
    act(() => { playScene({ id: 'repair:TELESCOPE:1:done', once: true, beats: [{ id: 'back', shot: { kind: 'wide' }, ms: 100 }] }, 'memory-1'); });
    expect(result.current?.answer).not.toMatchObject({ nav: 'dismissUnlock' });
    vi.setSystemTime(Date.now() + SCENE_WAIT_MS + 1000);
    let lower = (): void => undefined;
    act(() => { lower = raiseStage(); });
    expect(result.current?.answer).toMatchObject({ nav: 'dismissUnlock' });
    act(() => { lower(); });
    vi.useRealTimers();
  });
});

// Code review 2026-11-19: the guide asked "jump now?" while the drive's panel held the jump and drew no control.
describe('the jump the server holds', () => {
  const open = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 }, facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] };

  it('hears why from the drive\'s panel once the window is open, and only then asks the panel', () => {
    state.extra = { progress: { modules: { REFINERY: 2 }, facts: [] } };
    const { result, rerender } = renderHook(() => useStarterTutorial('ship'));
    expect(state.migrationEnabled.every(enabled => enabled === false)).toBe(true);
    state.extra = { progress: open };
    state.migration = { block: { code: 'MIGRATION_FLEET_OUT', flying: 1 } };
    rerender();
    expect(state.migrationEnabled.at(-1)).toBe(true);
    expect(result.current?.jumpBlock).toBe('fleet');
    expect(result.current?.answer).not.toMatchObject({ id: 'jumpAsk' });
    for (const [code, block] of [['MIGRATION_SEASON_WAIT', 'season'], ['NO_FRONTIER', 'frontier']] as const) {
      state.migration = { block: { code, daysLeft: 3 } };
      rerender();
      expect(result.current?.jumpBlock).toBe(block);
    }
    state.migration = { block: null };
    rerender();
    expect(result.current?.jumpBlock).toBeUndefined();
  });
});

// Owner phone playtest 2026-11-19: the probe's target was open when the Prospector came home, and the guide
// had it closed for the salvage card; the probe was then walked again from the start.
describe('the step in the player\'s hands', () => {
  const sensors = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 }, facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN'] };
  const PROBE = ['[data-guide="probe"]', '[data-guide="objective"]'];

  it('is kept while a world is open on the galaxy, and given up once it is put down', () => {
    state.extra = { progress: sensors, unlockToAnnounce: null, crates: [] };
    const { result, rerender } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.answer).toMatchObject({ id: 'probe', marks: PROBE });
    act(() => { setTargetSheet(true); });
    state.extra = { progress: sensors, unlockToAnnounce: 'salvage', crates: [] };
    rerender();
    expect(result.current?.answer).toMatchObject({ id: 'probe', marks: PROBE });
    act(() => { setTargetSheet(false); });
    expect(result.current?.answer).toMatchObject({ id: 'probe', nav: 'dismissUnlock' });
  });

  it('is not taken up from a world opened before the step came', () => {
    state.extra = { progress: sensors, unlockToAnnounce: 'salvage', crates: [] };
    act(() => { setTargetSheet(true); });
    const { result } = renderHook(() => useStarterTutorial('galaxy'));
    expect(result.current?.answer).toMatchObject({ id: 'probe', nav: 'dismissUnlock' });
  });
});
