import { act, render } from '@testing-library/react';
import type * as Fiber from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ViewOffset } from '../src/galaxy/ViewOffset.js';

/*
  2026-10-20, profiled on a Galaxy S22: the view offset re-read the canvas and every page's box
  after each DOM change on the page — a forced layout per change, 3% of a camera drag, while no
  page was open at all. With nothing that can cover the galaxy, there is nothing to measure.
*/
const fiber = vi.hoisted(() => ({ invalidate: vi.fn() }));
const canvas = document.createElement('canvas');
vi.mock('@react-three/fiber', async (original) => ({
  ...await original<typeof Fiber>(),
  useThree: (select: (state: unknown) => unknown) => select({
    camera: new PerspectiveCamera(), size: { width: 360, height: 780 }, gl: { domElement: canvas }, invalidate: fiber.invalidate,
  }),
  useFrame: vi.fn(),
}));

let frames: FrameRequestCallback[] = [];
const flush = async () => {
  await act(async () => { await Promise.resolve(); });
  act(() => { const due = frames; frames = []; for (const run of due) run(0); });
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => { frames.push(run); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it('measures nothing while no page or trial stands over the galaxy, and measures once one does', async () => {
  const measured = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  render(<ViewOffset />);
  await flush();
  for (let i = 0; i < 5; i++) {
    document.body.append(document.createElement('div'));
    await flush();
  }
  expect(measured).not.toHaveBeenCalled();

  const page = document.createElement('div');
  page.dataset.sheetPanel = '';
  document.body.append(page);
  await flush();
  expect(measured).toHaveBeenCalled();
});
