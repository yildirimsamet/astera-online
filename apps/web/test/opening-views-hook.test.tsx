import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { StrictMode } from 'react';
import { createOpeningPreparation } from '../src/galaxy/openingPreparation.js';
import { useOpeningViews, useOpeningWork, OpeningWork } from '../src/galaxy/OpeningViews.js';
const fiber = vi.hoisted(() => ({ frames: new Map<number, () => void>(), invalidate: vi.fn() }));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => void, priority: number) => { fiber.frames.set(priority, callback); },
  useThree: (select: (value: unknown) => unknown) => select({
    gl: { domElement: document.createElement('canvas'), info: { memory: { geometries: 1, textures: 1 }, programs: [], render: { calls: 1, triangles: 1 } } },
    invalidate: fiber.invalidate,
  }),
}));
let now = 0;
function frame(time: number) {
  now = time;
  act(() => { for (const [, draw] of [...fiber.frames].sort((a, b) => a[0] - b[0])) draw(); });
}
function setup() {
  const camera = new PerspectiveCamera();
  const controls = new OrbitControls(camera, document.createElement('canvas'));
  controls.target.set(10, 0, 0);
  camera.position.set(10, 6, 8);
  controls.update();
  const settled = { current: false };
  const view = renderHook(({ covered, ready }) => useOpeningViews({
    controls: { current: controls }, covered, ready, settled,
    wideDistance: 100, homeDistance: 7, work: createOpeningPreparation(true),
  }), { initialProps: { covered: true, ready: true } });
  return { camera, controls, settled, view };
}
beforeEach(() => {
  fiber.frames.clear(); now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
describe('hidden camera preparation', () => {
  it('survives StrictMode effect replay without cancelling the opening barrier', () => {
    const camera = new PerspectiveCamera();
    const controls = new OrbitControls(camera, document.createElement('canvas'));
    controls.target.set(10, 0, 0);
    camera.position.set(10, 6, 8);
    controls.update();
    const work = createOpeningPreparation(true);
    const pending = work.begin();
    const settled = { current: false };
    const view = renderHook(() => useOpeningViews({
      controls: { current: controls }, covered: true, ready: true, settled,
      wideDistance: 100, homeDistance: 7, work,
    }), { wrapper: StrictMode });
    try {
      expect(work.result).toBe(null);
      expect(work.size).toBe(1);
      frame(0); frame(16); frame(32);
      expect(settled.current).toBe(false);
      expect(camera.position.length()).toBeCloseTo(100);
      pending();
      frame(48); frame(64); frame(80); frame(96); frame(112); frame(128);
      expect(work.result).toBe('ready');
      expect(camera.position.distanceTo(controls.target)).toBeCloseTo(7);
    } finally { view.unmount(); controls.dispose(); }
  });
  it('restores on GPU loss and does not sweep again on recovery', () => {
    const { camera, controls, settled, view } = setup();
    frame(0);
    view.rerender({ covered: true, ready: false });
    expect(settled.current).toBe(true);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(7);
    view.rerender({ covered: true, ready: true });
    frame(200);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(7);
    view.unmount(); controls.dispose();
  });
  it('restores controls when unmounted during preparation', () => {
    const { camera, controls, view } = setup();
    frame(0); view.unmount();
    expect(controls.target.toArray()).toEqual([10, 0, 0]);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(7);
    expect(controls.enabled).toBe(true);
    controls.dispose();
  });
  it('restores the intended near framing before readiness and leaves later camera movements alone on unmount', () => {
    const { camera, controls, settled, view } = setup();
    frame(0);
    expect(camera.position.length()).toBeCloseTo(100);
    expect(controls.enabled).toBe(false);
    frame(200); frame(210); frame(410); frame(420);
    expect(settled.current).toBe(false);
    frame(620);
    expect(settled.current).toBe(true);
    expect(controls.target.toArray()).toEqual([10, 0, 0]);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(7);
    expect(controls.enabled).toBe(true);
    camera.position.set(90, 80, 70);
    view.unmount();
    expect(camera.position.toArray()).toEqual([90, 80, 70]);
    controls.dispose();
  });
  it('restores before paint if the parent cover expires between animation frames', () => {
    const { camera, controls, settled, view } = setup();
    frame(0);
    view.rerender({ covered: false, ready: true });
    expect(settled.current).toBe(true);
    expect(controls.target.toArray()).toEqual([10, 0, 0]);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(7);
    expect(controls.enabled).toBe(true);
    view.unmount(); controls.dispose();
  });
});

describe('opening resource ownership', () => {
  it('tracks pending work per canvas and releases it on completion and unmount', () => {
    const work = createOpeningPreparation(true);
    const view = renderHook(({ pending }) => { useOpeningWork(pending); }, {
      initialProps: { pending: true },
      wrapper: ({ children }) => <OpeningWork.Provider value={work}>{children}</OpeningWork.Provider>,
    });
    expect(work.size).toBe(1);
    view.rerender({ pending: false });
    expect(work.size).toBe(0);
    view.rerender({ pending: true });
    expect(work.size).toBe(1);
    view.unmount();
    expect(work.size).toBe(0);
  });
});
