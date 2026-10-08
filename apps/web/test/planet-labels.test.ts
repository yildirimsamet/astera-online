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
    expect(layout([node('near')], 78)).toHaveLength(1);
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
  it('keeps a background name while the actual foreground label still leaves a gap', () => {
    const nodes = [node('own', { isOwned: true }), node('background', { position: [0, 1, 0] })];
    const names = layoutPlanetLabels({ nodes, camera: camera(), width: 350, height: 640, selectedId: null, rivals: [], now: 0,
      sizes: new Map([
        ['own', { width: 120, height: 32, detail: true, intel: 'RESOLVED' }],
        ['background', { width: 64, height: 22, detail: false, intel: 'RESOLVED' }],
      ]),
    });
    expect(names.map((label) => label.id)).toEqual(['own', 'background']);
  });
  it('still hides the lower-priority name when the measured labels really overlap', () => {
    const nodes = [node('own', { isOwned: true }), node('background', { position: [0, 0.4, 0] })];
    const names = layoutPlanetLabels({ nodes, camera: camera(), width: 350, height: 640, selectedId: null, rivals: [], now: 0,
      sizes: new Map([
        ['own', { width: 120, height: 32, detail: true, intel: 'RESOLVED' }],
        ['background', { width: 64, height: 22, detail: false, intel: 'RESOLVED' }],
      ]),
    });
    expect(names.map((label) => label.id)).toEqual(['own']);
  });
  it('uses the current label form after a compact world becomes selected', () => {
    const nodes = [node('selected')];
    const names = layoutPlanetLabels({ nodes, camera: camera(), width: 350, height: 640, selectedId: 'selected', rivals: [], now: 0,
      sizes: new Map([['selected', { width: 64, height: 22, detail: false, intel: 'RESOLVED' }]]),
    });
    expect(names[0]!.detail).toBe(true);
    expect(names[0]!.height).toBeGreaterThan(22);
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

describe('a nearer world hides the names behind it', () => {
  // Camera at z=20 looking at the origin: a unit world at z=10 is a 77px disc
  // round the screen centre; a name at z=-10 sits 48px above that centre.
  const sized = (nodes: PlanetNode[], sizes: [string, { width: number; height: number; detail: boolean }][]) =>
    layoutPlanetLabels({ nodes, camera: camera(), width: 350, height: 640, selectedId: null, rivals: [], now: 0,
      sizes: new Map(sizes.map(([id, size]) => [id, { ...size, intel: 'RESOLVED' as const }])) });
  const back = () => node('back', { radius: 1, position: [0, 0, -10] });
  const front = (position: [number, number, number]) => node('front', { intel: 'UNKNOWN', radius: 1, position });

  it('hides a name whose world sits behind a nearer world, even an unidentified one', () => {
    expect(layout([back()]).map((label) => label.id)).toEqual(['back']);
    expect(layout([front([0, 0, 10]), back()])).toEqual([]);
  });
  it('keeps the name of a covered world while the name itself clears the nearer limb, as its 3D pin does', () => {
    const small = node('front', { intel: 'UNKNOWN', radius: 0.5, position: [0, 0, 10] });
    expect(layout([small, back()]).map((label) => label.id)).toEqual(['back']);
  });
  it('keeps the name when the nearer world is beside the line of sight', () => {
    expect(layout([front([0, -3, 10]), back()]).map((label) => label.id)).toEqual(['back']);
  });
  it('hides a name whose box only clips the nearer world limb, and restores it once clear', () => {
    const size: [string, { width: number; height: number; detail: boolean }] = ['back', { width: 100, height: 24, detail: false }];
    expect(sized([front([1.45, 0.78, 10]), back()], [size])).toEqual([]);
    expect(sized([front([1.85, 0.78, 10]), back()], [size]).map((label) => label.id)).toEqual(['back']);
  });
  it('never lets a farther world hide a nearer name, however large it is drawn', () => {
    const giant = node('giant', { intel: 'UNKNOWN', radius: 9, position: [0, 0, -10] });
    expect(layout([giant, node('near', { radius: 1, position: [0, 0, 10] })]).map((label) => label.id)).toEqual(['near']);
  });
  it('lets worlds side by side at one depth keep their names', () => {
    const above = node('above', { intel: 'UNKNOWN', radius: 1, position: [0, 2.6, 0] });
    expect(layout([above, node('level', { radius: 1, position: [0, 0, 0] })]).map((label) => label.id)).toEqual(['level']);
  });
  it('does not let a hidden name keep the space of a visible neighbour', () => {
    const own = node('own', { isOwned: true, radius: 1, position: [0, 0, -10] });
    const side = node('side', { radius: 1, position: [4.27, 0, -10] });
    const sizes: [string, { width: number; height: number; detail: boolean }][] = [
      ['own', { width: 160, height: 36, detail: true }],
      ['side', { width: 80, height: 24, detail: false }],
    ];
    expect(sized([own, side], sizes).map((label) => label.id)).toEqual(['own']);
    expect(sized([front([0, 0, 10]), own, side], sizes).map((label) => label.id)).toEqual(['side']);
  });
});
