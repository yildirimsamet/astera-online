import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { planetNodes, type PlanetNode } from '../src/galaxy/scene.js';
import { layoutPlanetLabels } from '../src/galaxy/planetLabels.js';

const node = (id: string, over: Partial<PlanetNode> = {}): PlanetNode => ({
  ...planetNodes([{ id, name: `World ${id}`, owner: `Commander ${id}`, country: 'JP',
    position: { x: 0, y: 0, z: 0 }, intel: 'RESOLVED', satellites: [], shielded: false,
    coreTier: 1, coreLevel: 1, state: { kind: 'NORMAL' }, isSelf: false }])[0]!,
  ...over,
});
const camera = (range = 20) => {
  const value = new PerspectiveCamera(45, 350 / 640, 0.1, 600);
  value.position.set(0, 0, range);
  value.lookAt(0, 0, 0);
  value.updateMatrixWorld();
  return value;
};
const layout = (nodes: PlanetNode[], range = 20, selectedId: string | null = null) =>
  layoutPlanetLabels({ nodes, camera: camera(range), width: 350, height: 640, selectedId, rivals: [], now: 0 });

describe('nearby planet names without a tap', () => {
  it('labels an ordinary known planet automatically at a readable nearby zoom', () => {
    expect(layout([node('near')]).map((label) => label.id)).toEqual(['near']);
  });
  it('removes ordinary names beyond the zoom threshold and restores them on approaching', () => {
    expect(layout([node('near')], 90)).toEqual([]);
    expect(layout([node('near')], 50)).toHaveLength(1);
  });
  it('does not reveal unknown names or owners; a selected unknown only gets a state label', () => {
    const hidden = node('hidden', { intel: 'UNKNOWN' });
    expect(layout([hidden])).toEqual([]);
    expect(layout([hidden], 20, 'hidden')).toHaveLength(1);
  });
  it('preserves remembered names so their dated records remain readable', () => {
    expect(layout([node('old', { intel: 'REMEMBERED', seenAt: new Date(0) })])).toHaveLength(1);
  });
  it('gives selection priority over a colliding ordinary or owned world', () => {
    expect(layout([node('ordinary'), node('own', { isOwned: true }), node('selected')], 20, 'selected').map((label) => label.id)).toEqual(['selected']);
  });
  it('prefers the owned world when nearby names collide', () => {
    expect(layout([node('ordinary'), node('own', { isOwned: true })]).map((label) => label.id)).toEqual(['own']);
  });
  it('does not reserve a long-name box that hides a short neighbouring identity on a phone', () => {
    const nearby = node('short', { name: 'Vega', owner: 'Mira', position: [4.5, 0, -5] });
    const names = layout([node('own', { isOwned: true }), nearby]);
    expect(names.map((label) => label.id)).toEqual(['own', 'short']);
    expect(names.find((label) => label.id === 'short')!.width).toBeLessThan(100);
  });
  it('keeps label boxes inside a narrow viewport', () => {
    for (const label of layout([node('edge', { position: [-3.5, 0, 0] })])) {
      expect(label.left).toBeGreaterThanOrEqual(8);
      expect(label.left + label.width).toBeLessThanOrEqual(342);
      expect(label.top).toBeGreaterThanOrEqual(8);
      expect(label.top + label.height).toBeLessThanOrEqual(632);
    }
    expect(layout([node('edge', { position: [-3.5, 0, 0] })])).toHaveLength(1);
  });
  it('ignores worlds behind the camera and beyond the viewport', () => {
    expect(layout([node('behind', { position: [0, 0, 30] }), node('off', { position: [100, 0, 0] })])).toEqual([]);
  });
  it('keeps a crowded galaxy to a bounded pool of non-overlapping labels', () => {
    const camera = new PerspectiveCamera(45, 3840 / 2160, 0.1, 600);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const nodes = Array.from({ length: 324 }, (_, i) => node(String(i), { position: [(i % 18 - 9) * 1.5, (Math.floor(i / 18) - 9) * 0.8, 0] }));
    const names = layoutPlanetLabels({ nodes, camera, width: 3840, height: 2160, selectedId: null, rivals: [], now: 0 });
    expect(names).toHaveLength(32);
    for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) {
      const a = names[i]!;
      const b = names[j]!;
      expect(a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top).toBe(false);
    }
  });
});
