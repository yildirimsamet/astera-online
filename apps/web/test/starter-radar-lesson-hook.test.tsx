import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { directorNow, playScene, resetDirector, skipBeat } from '../src/starter/director/director.js';
import { RADAR_LESSON, RADAR_LESSON_CONTACT } from '../src/starter/director/radarLesson.js';
import { RADAR_LESSON_SCENE, scenesFor, type ShipState } from '../src/starter/director/scenes.js';
import { useRadarLessonContact } from '../src/starter/director/useRadarLesson.js';

beforeEach(() => { localStorage.clear(); resetDirector(); vi.useFakeTimers(); });
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

  it('is inside the sphere already when the shots are hurried past it', () => {
    const { result } = start();
    on('radar');
    act(() => { skipBeat(); skipBeat(); });
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

  it('is nothing without a radar to hear it', () => {
    const { result } = renderHook(() => useRadarLessonContact({ ...sensor, detect: 0 }));
    act(() => { playScene(lesson(), 'v1'); });
    expect(result.current).toBeNull();
  });
});
