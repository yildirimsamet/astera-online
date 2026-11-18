import type * as Drei from '@react-three/drei';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shipHullModels } from '../src/galaxy/shipCosmetics.js';
import { directorNow, playScene, resetDirector, skipBeat } from '../src/starter/director/director.js';
import { RADAR_LESSON, RADAR_LESSON_CONTACT } from '../src/starter/director/radarLesson.js';
import { RADAR_LESSON_SCENE, scenesFor, type ShipState } from '../src/starter/director/scenes.js';
import { useRadarLessonContact } from '../src/starter/director/useRadarLesson.js';

const preload = vi.hoisted(() => vi.fn());
vi.mock('@react-three/drei', async (importActual) => {
  const actual = await importActual<typeof Drei>();
  return { ...actual, useGLTF: Object.assign((...args: Parameters<typeof actual.useGLTF>) => actual.useGLTF(...args), { ...actual.useGLTF, preload }) };
});

beforeEach(() => { localStorage.clear(); resetDirector(); vi.useFakeTimers(); preload.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); resetDirector(); });

/**
 * THE STAGED CONTACT RIDES THE RADAR'S SCENE (owner phone playtest 2026-11-18, item 28): it is there, still,
 * while both spheres are shown; it moves once the camera has come round to its side, and is inside the
 * telescope's sphere two seconds later, whatever the shots do; after the scene it flies on out of the
 * radar's reach and is gone.
 */
const sensor = { at: { x: 0, y: 0, z: 0 }, identify: 300, detect: 700 };
const before: ShipState = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, queue: [], look: 'PATCHED', facts: [] };
const lesson = () => {
  const scene = scenesFor(before, { ...before, modules: { ...before.modules, RADAR: 1 } }, String).find(row => row.id === RADAR_LESSON_SCENE);
  if (!scene) throw new Error('no radar lesson');
  return scene;
};
const start = () => {
  const view = renderHook(() => useRadarLessonContact(sensor));
  act(() => { playScene(lesson(), 'v1'); });
  return view;
};
/** On to a shot, one at a time, each drawn: as a hold passes them. */
const on = (beat: string) => {
  while (directorNow() !== null && directorNow()?.beat.id !== beat) act(() => { skipBeat(); });
};

describe('the radar lesson\'s contact', () => {
  it('is nowhere outside its scene', () => {
    const { result } = renderHook(() => useRadarLessonContact(sensor));
    expect(result.current).toBeNull();
  });

  it('waits still in the radar\'s band while both spheres are shown', () => {
    const { result } = start();
    expect(result.current).toMatchObject({ id: RADAR_LESSON_CONTACT, kind: 'unknown' });
    expect(result.current?.from).toEqual(result.current?.to);
    on('radar');
    expect(result.current?.from).toEqual(result.current?.to);
  });

  it('waits for the camera to come round to its side, then is seen for what it is two seconds later', () => {
    const { result } = start();
    on('caught');
    expect(result.current?.from).toEqual(result.current?.to);
    act(() => { vi.advanceTimersByTime(RADAR_LESSON.settleMs + 50); });
    expect(result.current).toMatchObject({ kind: 'unknown' });
    expect(result.current?.from).not.toEqual(result.current?.to);
    act(() => { vi.advanceTimersByTime(RADAR_LESSON.enterMs); });
    expect(result.current).toMatchObject({ kind: 'fleet', fleet: RADAR_LESSON.fleet });
  });

  it('comes into the sphere a moment after the close shot starts, however the shots were hurried to it', () => {
    const { result } = start();
    on('radar');
    act(() => { skipBeat(); });
    act(() => { skipBeat(); });
    expect(result.current).toMatchObject({ kind: 'unknown' });
    act(() => { vi.advanceTimersByTime(RADAR_LESSON.leadMs + 50); });
    expect(result.current).toMatchObject({ kind: 'fleet' });
  });

  it('is inside the sphere already once the scene has moved past its close shot', () => {
    const { result } = start();
    on('calm');
    expect(result.current).toMatchObject({ kind: 'fleet' });
  });

  it('flies on after the scene, and is gone once it has left the radar\'s reach', () => {
    const { result } = start();
    on('calm');
    act(() => { skipBeat(); });
    expect(directorNow()).toBeNull();
    expect(result.current).toMatchObject({ kind: 'fleet' });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current).toBeNull();
  });

  it('starts afresh when its scene is shown again, even while the last one is still flying', () => {
    const { result } = start();
    on('calm');
    act(() => { skipBeat(); });
    expect(result.current).toMatchObject({ kind: 'fleet' });
    act(() => { localStorage.clear(); resetDirector(); });
    act(() => { playScene(lesson(), 'v1'); });
    expect(result.current).toMatchObject({ kind: 'unknown' });
    expect(result.current?.from).toEqual(result.current?.to);
  });

  // A Dart formation's first draw waits on its models; fetched as the scene starts, they are there when it is seen.
  it('fetches its ships\' models as its scene starts', () => {
    const { lodModel, model } = shipHullModels('DART');
    renderHook(() => useRadarLessonContact(sensor));
    expect(preload).not.toHaveBeenCalled();
    act(() => { playScene(lesson(), 'v1'); });
    expect(preload).toHaveBeenCalledWith(model, false);
    expect(preload).toHaveBeenCalledWith(lodModel, false);
  });

  it('is nothing without a radar to hear it', () => {
    const { result } = renderHook(() => useRadarLessonContact({ ...sensor, detect: 0 }));
    act(() => { playScene(lesson(), 'v1'); });
    expect(result.current).toBeNull();
  });
});
