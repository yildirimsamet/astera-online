import { act, render } from '@testing-library/react';
import type * as Fiber from '@react-three/fiber';
import type * as Drei from '@react-three/drei';
import type { ReactNode } from 'react';
import { PerspectiveCamera } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
import { Labels } from '../src/galaxy/GalaxyCanvas.js';
import { planetNodes } from '../src/galaxy/scene.js';

/*
  2026-10-20, profiled on a Galaxy S22 as the admin: the names on the map re-rendered every second
  for a radiation clock, and their inline refs made React detach and re-attach every label — each
  one a forced layout (`offsetWidth`) and a requested galaxy frame, even behind a page that had
  stopped the disc. A label is measured when it mounts or resizes, never because a second passed.
*/
const fiber = vi.hoisted(() => ({ invalidate: vi.fn(), frame: null as null | ((state: unknown, delta: number) => void) }));
vi.mock('@react-three/fiber', async (original) => ({
  ...await original<typeof Fiber>(),
  useThree: (select: (state: { invalidate: () => void }) => unknown) => select({ invalidate: fiber.invalidate }),
  useFrame: (callback: (state: unknown, delta: number) => void) => { fiber.frame = callback; },
}));
vi.mock('@react-three/drei', async (original) => ({
  ...await original<typeof Drei>(),
  Html: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const node = planetNodes([galaxySchema.shape.planets.element.parse({ id: 'world', name: 'Kestrel', owner: 'Mira', country: 'JP',
  kind: 'CAPITAL', position: { x: 0, y: 0, z: 0 }, isSelf: false, intel: 'RESOLVED', state: { kind: 'NORMAL' } })])[0]!;
let reads = 0;

beforeEach(() => {
  vi.useFakeTimers();
  reads = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => { reads += 1; return 120; });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40);
  vi.stubGlobal('ResizeObserver', class { observe() { /* jsdom */ } unobserve() { /* jsdom */ } disconnect() { /* jsdom */ } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('measures a name when it mounts, and not again as the seconds pass', () => {
  const camera = new PerspectiveCamera(45, 350 / 640, 0.1, 600);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const view = render(<Labels nodes={[node]} hpRadiation={[]} selectedId={null} rivals={[]} />);
  act(() => { fiber.frame?.({ camera, size: { width: 350, height: 640 } }, 0.2); });
  expect(view.container.querySelector('[data-world-label="world"]')).not.toBeNull();
  expect(reads).toBeGreaterThan(0);

  reads = 0;
  fiber.invalidate.mockClear();
  act(() => { vi.advanceTimersByTime(5000); });
  expect(reads).toBe(0);
  expect(fiber.invalidate).not.toHaveBeenCalled();

  // The same props again (a parent render) must not re-attach the label either.
  view.rerender(<Labels nodes={[node]} hpRadiation={[]} selectedId={null} rivals={[]} />);
  expect(reads).toBe(0);
  expect(fiber.invalidate).not.toHaveBeenCalled();
});
