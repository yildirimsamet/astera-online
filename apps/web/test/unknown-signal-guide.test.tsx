import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { UnknownSignalView } from '../src/api/schemas.js';
import { UnknownSignalGuide, UnknownSignalGuideTracker } from '../src/galaxy/UnknownSignalGuide.js';
import { createSignalGuideProjection } from '../src/galaxy/signalGuide.js';

const frames = vi.hoisted(() => {
  const callbacks: ((state: { camera: THREE.Camera; size: { width: number; height: number } }) => void)[] = [];
  return callbacks;
});
vi.mock('../src/galaxy/visualFrame.js', () => ({
  useVisualFrame: (callback: (state: { camera: THREE.Camera; size: { width: number; height: number } }) => void) => { frames.push(callback); },
}));

const viewport = { width: 1280, height: 812 };
const cameraFor = (width = viewport.width, height = viewport.height) => {
  const camera = new THREE.PerspectiveCamera(50, width / height, .1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
};
const signal = (over: Partial<UnknownSignalView> = {}): UnknownSignalView => ({
  id: '00000000-0000-4000-8000-000000000001', at: { x: 400, y: 0, z: 0 }, status: 'open',
  appearedAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3_600_000),
  originPlanetId: null, origin: null, fleet: null, damage: null, departAt: null, arriveAt: null,
  returnDepartAt: null, returnAt: null, recalledAt: null, outcome: null, deliveredAt: null, ...over,
});

describe('unknown signal camera direction', () => {
  it('moves beside the projected target and points toward it rather than staying at one HUD position', () => {
    const project = createSignalGuideProjection();
    const camera = cameraFor();
    const left = { ...project(new THREE.Vector3(-3, 2, 0), camera, viewport)! };
    const right = project(new THREE.Vector3(3, 2, 0), camera, viewport)!;
    expect(left.x).toBeLessThan(viewport.width / 2);
    expect(right.x).toBeGreaterThan(viewport.width / 2);
    expect(left.angle).toBeLessThan(0);
    expect(right.angle).toBeGreaterThan(0);
    expect(left.offscreen).toBe(false);
    const target = new THREE.Vector3(-3, 2, 0).project(camera);
    expect(left.x).toBeGreaterThan((target.x + 1) * viewport.width / 2);
    expect(left.y).toBeGreaterThan((1 - target.y) * viewport.height / 2);
  });

  it('follows camera rotation, translation, zoom and an offset projection', () => {
    const project = createSignalGuideProjection();
    const camera = cameraFor();
    const target = new THREE.Vector3(3, 2, 0);
    const initial = { ...project(target, camera, viewport)! };
    camera.lookAt(4, 0, 0);
    const rotated = { ...project(target, camera, viewport)! };
    expect(rotated.x).toBeLessThan(initial.x);
    expect(rotated.angle).not.toBe(initial.angle);
    camera.position.x += 2; camera.updateMatrixWorld();
    const panned = { ...project(target, camera, viewport)! };
    expect(panned.x).not.toBe(rotated.x);
    camera.zoom = 1.5; camera.updateProjectionMatrix();
    const zoomed = { ...project(target, camera, viewport)! };
    expect(zoomed.y).toBeLessThan(panned.y);
    camera.setViewOffset(viewport.width, viewport.height, 160, 0, viewport.width, viewport.height);
    expect(project(target, camera, viewport)!.x).not.toBe(zoomed.x);
  });

  it.each([[100, 0], [-100, 0], [0, 100], [0, -100], [100, 100], [-100, -100]])(
    'keeps an offscreen target (%i,%i) inside desktop and mobile safe edges', (x, y) => {
      for (const size of [viewport, { width: 350, height: 812 }, { width: 812, height: 350 }]) {
        const point = createSignalGuideProjection()(new THREE.Vector3(x, y, 0), cameraFor(size.width, size.height), size)!;
        expect(point.offscreen).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(28);
        expect(point.x).toBeLessThanOrEqual(size.width - 28);
        expect(point.y).toBeGreaterThanOrEqual(60);
        expect(point.y).toBeLessThanOrEqual(size.height - (size.width < 1100 ? 96 : 40));
      }
    },
  );

  it('keeps the bearing of a target behind the camera instead of mirroring its side', () => {
    const camera = cameraFor();
    const project = createSignalGuideProjection();
    const behindRight = { ...project(new THREE.Vector3(3, 0, 20), camera, viewport)! };
    const behindLeft = project(new THREE.Vector3(-3, 0, 20), camera, viewport)!;
    expect(behindRight.x).toBeGreaterThan(viewport.width / 2);
    expect(behindLeft.x).toBeLessThan(viewport.width / 2);
    expect(behindRight.offscreen).toBe(true);
    expect(behindLeft.offscreen).toBe(true);
  });

  it('handles centered, directly behind and near-plane targets without invalid positions', () => {
    const camera = cameraFor();
    const project = createSignalGuideProjection();
    for (const target of [new THREE.Vector3(), new THREE.Vector3(0, 0, 20), new THREE.Vector3(3, 0, 10)]) {
      const point = project(target, camera, viewport)!;
      expect([point.x, point.y, point.angle].every(Number.isFinite)).toBe(true);
    }
    const center = project(new THREE.Vector3(), camera, viewport)!;
    expect(center.x).toBe(viewport.width / 2);
    expect(center.y).toBeGreaterThan(viewport.height / 2);
    expect(center.angle).toBe(0);
    expect(project(camera.position, camera, viewport)).toBeNull();
    expect(project(new THREE.Vector3(), camera, { width: 0, height: 0 })).toBeNull();
  });

  it('reprojects safely when a phone viewport changes orientation', () => {
    const project = createSignalGuideProjection();
    for (const size of [{ width: 350, height: 812 }, { width: 812, height: 350 }, { width: 390, height: 844 }]) {
      const point = project(new THREE.Vector3(6, 3, 0), cameraFor(size.width, size.height), size)!;
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(size.width);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(size.height);
    }
  });
});

describe('unknown signal direction visibility', () => {
  it('opens the current signal from its arrow', () => {
    const current = signal(); const onSelect = vi.fn();
    render(<UnknownSignalGuide signals={[current]} element={{ current: null }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith(current.id);
  });

  it.each(['outbound', 'returning', 'done', 'expired', 'recalled', 'lost'] as const)('removes the arrow as soon as the signal becomes %s', status => {
    const current = signal(); const props = { element: { current: null }, onSelect: vi.fn() };
    const view = render(<UnknownSignalGuide {...props} signals={[current]} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    view.rerender(<UnknownSignalGuide {...props} signals={[{ ...current, status }]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not point at an expired signal or an empty list', () => {
    const props = { element: { current: null }, onSelect: vi.fn() };
    const view = render(<UnknownSignalGuide {...props} signals={[signal({ expiresAt: new Date(Date.now() - 1) })]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    view.rerender(<UnknownSignalGuide {...props} signals={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('removes an open arrow when its lifetime ends without waiting for the network', () => {
    vi.useFakeTimers();
    try {
      render(<UnknownSignalGuide signals={[signal({ expiresAt: new Date(Date.now() + 1000) })]} element={{ current: null }} onSelect={vi.fn()} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('updates the DOM from the current camera and hides a dispatched arrow', () => {
    const element = { current: document.createElement('button') };
    const current = signal(); const camera = cameraFor();
    const view = render(<UnknownSignalGuideTracker element={element} signals={[current]} />);
    frames.at(-1)!({ camera, size: viewport });
    const transform = element.current.style.transform;
    expect(transform).toContain('translate3d');
    expect(element.current.style.visibility).toBe('visible');
    camera.lookAt(5, 1, 0); camera.updateMatrixWorld();
    frames.at(-1)!({ camera, size: viewport });
    expect(element.current.style.transform).not.toBe(transform);
    view.rerender(<UnknownSignalGuideTracker element={element} signals={[{ ...current, status: 'outbound' }]} />);
    frames.at(-1)!({ camera, size: viewport });
    expect(element.current.style.visibility).toBe('hidden');
  });
});
