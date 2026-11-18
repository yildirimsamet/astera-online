import { REPAIR_LADDER, openingProgress, vesselLook, type VesselProgress } from '@astera/rules';
import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { directorNow, resetDirector, skipBeat } from '../src/starter/director/director.js';
import { FIRST_LOOK_MS, useStarterScenes } from '../src/starter/director/useStarterScenes.js';
import { REVEAL_FLEETS_MS } from '../src/starter/tutorial/sightLesson.js';
import i18n from '../src/i18n/index.js';
import { wireVessel } from './starterVesselFixture.js';

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); resetDirector(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); resetDirector(); });

const order = (subject: string, stage: number) => ({
  id: `o-${subject}`, queue: 'CONSTRUCTION', subject, stage, count: 1,
  startedAt: '2026-11-18T10:00:00.000Z', readyAt: '2026-11-18T10:00:05.000Z', cost: { alloy: 1, crystal: 1, deuterium: 0 },
});
const ship = (progress: VesselProgress, queue: unknown[] = []) => vesselSchema.parse(wireVessel({ progress, queue }));
const playing = (): string => { const now = directorNow(); return now ? `${now.scene.id}/${now.beat.id}` : 'none'; };
type Props = Parameters<typeof useStarterScenes>[0];
const props = (over: Partial<Props>): Props => ({
  ship: ship(openingProgress()), shipOpen: false, onCloseShip: vi.fn(), nearestRockId: null, unknownContactId: null, probing: false, probeTarget: null, onAwaken: vi.fn(), ...over,
});

/** The ship's changes become scenes (plan 2026-11-18 §5, Faz 5.2–5.6), as the galaxy sees them. */
describe('the first session, directed', () => {
  it('shows a new ship its report once the galaxy\'s opening flight has landed', () => {
    renderHook(useStarterScenes, { initialProps: props({}) });
    expect(playing()).toBe('none');
    act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
    expect(playing()).toBe('shipReport/round');
  });

  // Live play 2026-11-18: under React's strict mode the effect runs twice; the second run took the
  // ship as already seen and the report never played.
  it('still shows the report when the first look is read twice', () => {
    renderHook(useStarterScenes, { initialProps: props({}), wrapper: StrictMode });
    act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
    expect(playing()).toBe('shipReport/round');
  });

  it('steps the ship\'s page aside for a repair of the road, and shows it being done', () => {
    const onCloseShip = vi.fn();
    const first = props({ shipOpen: true, onCloseShip });
    const view = renderHook(useStarterScenes, { initialProps: first });
    act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); skipBeat(); skipBeat(); });
    view.rerender({ ...first, ship: ship(openingProgress(), [order('REFINERY', 2)]) });
    expect(onCloseShip).toHaveBeenCalledOnce();
    expect(playing()).toBe('repair:REFINERY:2:work/weld');
  });

  it('beats the bay of a repair as the camera reaches it', () => {
    const onAwaken = vi.fn();
    const first = props({ onAwaken, ship: ship(openingProgress(), [order('REFINERY', 2)]) });
    const view = renderHook(useStarterScenes, { initialProps: first });
    act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
    view.rerender({ ...first, ship: ship({ modules: { REFINERY: 2 }, facts: [] }) });
    expect(playing()).toBe('repair:REFINERY:2:done/back');
    expect(onAwaken).toHaveBeenCalledWith('REFINERY');
  });

  it('comes close to the first rock once the telescope\'s sky has landed, and not after the first dig', () => {
    const sight = ship({ modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, facts: [] });
    renderHook(useStarterScenes, { initialProps: props({ ship: sight, nearestRockId: 'rock-9' }) });
    act(() => { vi.advanceTimersByTime(REVEAL_FLEETS_MS); });
    expect(playing()).toBe('rock/field');
    act(() => { skipBeat(); });
    expect(playing()).toBe('rock/approach');
    expect(directorNow()?.beat.shot).toEqual({ kind: 'subject', focus: { kind: 'asteroid', id: 'rock-9' }, range: 2.4 });
    resetDirector();
    const dug = ship({ modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, facts: ['FIRST_MINING_SENT'] });
    renderHook(useStarterScenes, { initialProps: props({ ship: dug, nearestRockId: 'rock-9' }) });
    act(() => { vi.advanceTimersByTime(REVEAL_FLEETS_MS); });
    expect(playing()).toBe('none');
  });

  // Owner 2026-11-18: "gemi birden parlamış cillop gibi olmuş bile" — the hull changed under the player's hands.
  it('keeps the hull as it was while the bay comes back, and changes it on the hull\'s own shot', () => {
    let modules: Record<string, number> = { ...openingProgress().modules };
    let turn: { before: Record<string, number>; after: Record<string, number> } | null = null;
    for (const step of REPAIR_LADDER.filter(row => row.required)) {
      const next = { ...modules, [step.module]: step.stage };
      if (vesselLook({ modules: next, facts: [] }) !== vesselLook({ modules, facts: [] })) { turn = { before: modules, after: next }; break; }
      modules = next;
    }
    if (!turn) throw new Error('the first road never changes the hull');
    const first = props({ ship: ship({ modules: turn.before, facts: [] }) });
    const view = renderHook(useStarterScenes, { initialProps: first });
    act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
    const old = vesselLook({ modules: turn.before, facts: [] });
    expect(view.result.current).toBe(old);
    view.rerender({ ...first, ship: ship({ modules: turn.after, facts: [] }) });
    expect(playing()).toMatch(/:done\/back$/u);
    expect(view.result.current).toBe(old);
    act(() => { skipBeat(); });
    expect(playing()).toMatch(/:done\/hull$/u);
    expect(view.result.current).toBe(vesselLook({ modules: turn.after, facts: [] }));
    // A scene already shown is not shown again, and holds nothing back: the hull takes its look at once.
    act(() => { resetDirector({ keepMemory: true }); });
    view.rerender({ ...first, ship: ship({ modules: turn.before, facts: [] }) });
    view.rerender({ ...first, ship: ship({ modules: turn.after, facts: [] }) });
    expect(playing()).toBe('none');
    expect(view.result.current).toBe(vesselLook({ modules: turn.after, facts: [] }));
  });

  it('turns to the first radar return, and to none before the radar is mended', () => {
    renderHook(useStarterScenes, { initialProps: props({ ship: ship({ modules: { REFINERY: 2 }, facts: [] }), unknownContactId: 'c-1' }) });
    expect(playing()).toBe('none');
    cleanup();
    renderHook(useStarterScenes, { initialProps: props({ ship: ship({ modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, facts: ['FIRST_MINING_SENT'] }), unknownContactId: 'c-1' }) });
    expect(playing()).toBe('contact/turn');
  });

  // Plan §5 A9: the report coming home is a moment of its own, on the ship it read.
  describe('the probe\'s report', () => {
    const SURVEYED = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 };
    const out = ship({ modules: SURVEYED, facts: ['FIRST_MINING_SENT'] });
    const home = ship({ modules: SURVEYED, facts: ['FIRST_MINING_SENT', 'FIRST_PROBE_REPORT'] });
    const vega = { id: 'ship-2', name: 'Vega' };

    it('turns to the ship the probe read as its report comes home', () => {
      const first = props({ ship: out });
      const view = renderHook(useStarterScenes, { initialProps: first });
      act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
      view.rerender({ ...first, ship: home, probeTarget: vega });
      expect(playing()).toBe('probe/turn');
      expect(directorNow()?.beat.vars).toEqual({ name: 'Vega' });
    });

    it('waits for the report itself when the news of it comes first', () => {
      const first = props({ ship: out });
      const view = renderHook(useStarterScenes, { initialProps: first });
      act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
      view.rerender({ ...first, ship: home });
      expect(playing()).toBe('none');
      view.rerender({ ...first, ship: home, probeTarget: vega });
      expect(playing()).toBe('probe/turn');
    });

    it('turns to no report read before this visit', () => {
      renderHook(useStarterScenes, { initialProps: props({ ship: home, probeTarget: vega }) });
      act(() => { vi.advanceTimersByTime(FIRST_LOOK_MS); });
      expect(playing()).toBe('none');
    });
  });

  // Plan §5 A10: the yard is needed before it is asked for, while the probe is out.
  it('shows the empty yard while the probe is out and the yard is not ordered', () => {
    const surveyed = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 };
    renderHook(useStarterScenes, { initialProps: props({ ship: ship({ modules: surveyed, facts: ['FIRST_MINING_SENT'] }), probing: true }) });
    expect(playing()).toBe('yardNeed/yard');
    cleanup();
    resetDirector();
    renderHook(useStarterScenes, { initialProps: props({ ship: ship({ modules: surveyed, facts: ['FIRST_MINING_SENT'] }, [order('SHIPYARD', 1)]), probing: true }) });
    expect(playing()).toBe('none');
    cleanup();
    renderHook(useStarterScenes, { initialProps: props({ ship: ship({ modules: surveyed, facts: ['FIRST_MINING_SENT'] }), probing: false }) });
    expect(playing()).toBe('none');
  });
});
