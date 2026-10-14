import { renderHook } from '@testing-library/react';
import type * as Drei from '@react-three/drei';
import type * as Fiber from '@react-three/fiber';
import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import { shareStructure } from '../src/api/structural.js';
import { FormationWakes, Traffic, Wake } from '../src/galaxy/Fleets.js';
import { EngineJets, type EngineUnit } from '../src/galaxy/EngineJets.js';
import { GalaxyVisualPhase } from '../src/galaxy/visualFrame.js';
import { markersFor } from '../src/galaxy/Squadrons.js';
import type { Vec3Tuple } from '../src/galaxy/scene.js';

// Run the actual hook lifecycles and real Three resources without a WebGL context.
vi.mock('@react-three/fiber', async (original) => ({
  ...await original<typeof Fiber>(),
  useFrame: vi.fn(),
}));
const assets = vi.hoisted(() => ({
  read: vi.fn<() => { scene: THREE.Group }>(),
  texture: vi.fn<(input: string | string[]) => THREE.Texture | THREE.Texture[]>(),
}));
vi.mock('@react-three/drei', async (original) => ({
  ...await original<typeof Drei>(),
  useGLTF: Object.assign(() => assets.read(), { preload: vi.fn() }),
  useTexture: Object.assign((input: string | string[]) => assets.texture(input), { preload: vi.fn() }),
}));

function component<P>(tree: ReactNode, name: string): ReactElement<P> {
  const search = (children: ReactNode): ReactElement<P> | undefined => {
    for (const child of Children.toArray(children)) {
      if (!isValidElement<P & { children?: ReactNode }>(child)) continue;
      if (typeof child.type === 'function' && child.type.name === name) return child;
      const found = search(child.props.children);
      if (found) return found;
    }
    return undefined;
  };
  const found = search(tree);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

function isFunctionComponent<P>(type: ReactElement<P>['type']): type is (props: P) => ReactNode {
  return typeof type === 'function' && !String(type).startsWith('class');
}

function evaluate<P>(element: ReactElement<P>): ReactNode {
  if (!isFunctionComponent(element.type)) throw new Error('Expected a synchronous function component');
  return element.type(element.props);
}

interface ForeignProps { contact: Contact; nodes: []; focused: boolean; onSelect: () => void }
type FormationProps = ComponentProps<typeof FormationWakes> & { focused: boolean; showPips: boolean };
interface DrawProps { geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial; name?: string }

function draw(tree: ReactNode, name?: string): DrawProps {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<DrawProps & { children?: ReactNode }>(child)) continue;
    if (child.props.geometry instanceof THREE.BufferGeometry && (!name || child.props.name === name)) return child.props;
    if (child.props.children) {
      try { return draw(child.props.children, name); } catch { /* Search the next sibling. */ }
    }
  }
  throw new Error(`Missing draw ${name ?? ''}`);
}

function isGeometry(value: unknown): value is THREE.BufferGeometry {
  return value instanceof THREE.BufferGeometry;
}

function instancedDraw(tree: ReactNode): DrawProps & { count: number } {
  if (!isValidElement<{ args?: readonly unknown[] }>(tree)) throw new Error('Missing instanced draw');
  const [geometry, material, count] = tree.props.args ?? [];
  if (!isGeometry(geometry) || !(material instanceof THREE.ShaderMaterial) || typeof count !== 'number') {
    throw new Error('Invalid instanced resources');
  }
  return { geometry, material, count };
}

const contact = (patch: Partial<Contact> = {}): Contact => ({
  id: 'formation-contact', kind: 'fleet', fleet: { DART: 13, PIKE: 10 },
  from: { x: 0, y: 0, z: 0 }, to: { x: 100, y: 20, z: 30 },
  startAt: new Date('2026-10-11T10:00:00Z'), endAt: new Date('2026-10-11T11:00:00Z'),
  ...patch,
});

function useForeign(value: Contact, focused = false): ReactNode {
  return evaluate(component<ForeignProps>(Traffic({ contacts: [value], nodes: [], focusedId: focused ? value.id : null, onSelect: vi.fn() }), 'Foreign'));
}

function useFormation(value: Contact, focused = false) {
  const tree = useForeign(value, focused);
  const wakes = component<ComponentProps<typeof FormationWakes>>(tree, 'FormationWakes').props;
  const lights = evaluate(component<FormationProps>(tree, 'FormationLightField'));
  const pips = evaluate(component<FormationProps>(lights, 'FormationPips'));
  const ranks = evaluate(component<FormationProps>(lights, 'FormationRanks'));
  const jets = evaluate(component<ComponentProps<typeof EngineJets>>(lights, 'EngineJets'));
  return { markers: wakes.markers, slots: wakes.slots, wake: draw(FormationWakes(wakes)), lights: instancedDraw(jets), pips: draw(pips), ranks: draw(ranks) };
}

beforeEach(() => {
  // Mirror useTexture's shared cache while leaving real GPU resource lifetimes observable.
  const textures = new Map<string, THREE.Texture>();
  assets.texture.mockImplementation(input => {
    const load = (url: string) => {
      let texture = textures.get(url);
      if (!texture) {
        texture = new THREE.Texture();
        textures.set(url, texture);
      }
      return texture;
    };
    return typeof input === 'string' ? load(input) : input.map(load);
  });
  // The atlas texture is real; glyph rasterization is irrelevant to its lifetime.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('contact formation allocations', () => {
  it('retains markers, slots and all buffers when a polling update only moves the contact', () => {
    const initial = contact();
    const { result, rerender } = renderHook(({ value }) => useFormation(value), { initialProps: { value: initial } });
    const first = result.current;
    let previous = initial;
    for (let index = 1; index <= 3; index += 1) {
      const next = shareStructure(previous, contact({
        from: { x: index, y: 0, z: 0 }, to: { x: 100 + index, y: 20, z: 30 },
        startAt: new Date(initial.startAt.getTime() + index * 5_000),
        endAt: new Date(initial.endAt.getTime() + index * 5_000),
      }));
      expect(next).not.toBe(previous);
      expect(next.fleet).toBe(previous.fleet);
      rerender({ value: next });
      expect(result.current.markers).toBe(first.markers);
      expect(result.current.slots).toBe(first.slots);
      for (const key of ['wake', 'lights', 'pips', 'ranks'] as const) {
        expect(result.current[key].geometry).toBe(first[key].geometry);
        expect(result.current[key].material).toBe(first[key].material);
      }
      previous = next;
    }
  });

  it('refreshes the partial tally and hulls when the manifest changes', () => {
    const initial = contact();
    const { result, rerender } = renderHook(({ value }) => useFormation(value), { initialProps: { value: initial } });
    const first = result.current;
    rerender({ value: contact({ fleet: { DART: 14, PIKE: 10 } }) });
    expect(result.current.markers).toEqual(markersFor({ DART: 14, PIKE: 10 }));
    expect(result.current.pips.geometry).not.toBe(first.pips.geometry);
    rerender({ value: contact({ fleet: { COURIER: 20 } }) });
    expect(result.current.markers).toEqual(markersFor({ COURIER: 20 }));
    expect(result.current.wake.geometry).not.toBe(first.wake.geometry);
  });

  it('retains formation data through focus, threat and remembered-status changes', () => {
    const initial = contact();
    const { result, rerender } = renderHook(({ value, focused }) => useFormation(value, focused), { initialProps: { value: initial, focused: false } });
    const first = result.current;
    rerender({ value: { ...initial, inbound: true, remembered: true }, focused: true });
    expect(result.current.markers).toBe(first.markers);
    expect(result.current.slots).toBe(first.slots);
    expect(result.current.wake.geometry).toBe(first.wake.geometry);
    expect(result.current.pips.geometry).not.toBe(first.pips.geometry);
    expect(result.current.pips.material).toBe(first.pips.material);
  });

  it.each(['mining', 'harvest'] as const)('updates the %s craft count and mass-only silhouette', (kind) => {
    const { result, rerender } = renderHook(({ value }) => useForeign(value), { initialProps: { value: contact({ kind, fleet: undefined, craft: 1 }) } });
    const markers = () => component<ComponentProps<typeof FormationWakes>>(result.current, 'FormationWakes').props.markers;
    expect(markers()).toEqual(markersFor({ PROSPECTOR: 1 }));
    rerender({ value: contact({ kind, fleet: undefined, craft: 11 }) });
    expect(markers()).toEqual(markersFor({ PROSPECTOR: 11 }));
    rerender({ value: contact({ fleet: undefined, mass: 'HEAVY' }) });
    expect(markers()).toHaveLength(16);
    rerender({ value: contact({ fleet: undefined, mass: 'LIGHT' }) });
    expect(markers()).toHaveLength(3);
    rerender({ value: contact({ fleet: {} }) });
    expect(markers()).toEqual([]);
  });

  it.each(['unknown', 'probe', 'death_star'] as const)('removes formation rendering when intel changes to %s', (kind) => {
    const { result, rerender } = renderHook(({ value }) => useForeign(value), { initialProps: { value: contact() } });
    expect(() => component(result.current, 'FormationWakes')).not.toThrow();
    rerender({ value: contact({ kind, fleet: undefined }) });
    expect(() => component(result.current, 'FormationWakes')).toThrow('Missing FormationWakes');
    rerender({ value: contact({ kind: 'pirate', fleet: { PIKE: 10 } }) });
    expect(component<ComponentProps<typeof FormationWakes>>(result.current, 'FormationWakes').props.markers).toEqual(markersFor({ PIKE: 10 }));
  });
});

describe('independent resource lifetimes', () => {
  const engine: EngineUnit = { at: [0, 0, 0], nozzles: [[0, 0, -0.4]], size: 1,
    colour: '#aabbcc', intensity: 1, widthFactor: 1, lengthFactor: 1 };
  function useJets(units: readonly EngineUnit[]) {
    return instancedDraw(EngineJets({ units, aimDistance: { current: 100 } }));
  }

  it('retains the engine shader and cached maps when the number of motors changes', () => {
    const { result, rerender, unmount } = renderHook(({ units }) => useJets(units), { initialProps: { units: [engine] } });
    const first = result.current;
    const geometryDispose = vi.spyOn(first.geometry, 'dispose');
    const materialDispose = vi.spyOn(first.material, 'dispose');
    const grunge: unknown = first.material.uniforms.uGrunge!.value;
    if (!(grunge instanceof THREE.Texture)) throw new Error('Missing cached engine map');
    const textureDispose = vi.spyOn(grunge, 'dispose');
    expect(first.count).toBe(24);
    rerender({ units: [engine, engine] });
    expect(result.current.count).toBe(48);
    expect(result.current.geometry).not.toBe(first.geometry);
    expect(result.current.material).toBe(first.material);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).not.toHaveBeenCalled();
    const secondDispose = vi.spyOn(result.current.geometry, 'dispose');
    rerender({ units: [] });
    expect(result.current.count).toBe(0);
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(materialDispose).not.toHaveBeenCalled();
    const finalDispose = vi.spyOn(result.current.geometry, 'dispose');
    unmount();
    expect(finalDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).not.toHaveBeenCalled();
  });

  it('retains the engine buffer when texture replacement rebuilds its shader', () => {
    const { result, rerender, unmount } = renderHook(() => useJets([engine]));
    const first = result.current;
    const geometryDispose = vi.spyOn(first.geometry, 'dispose');
    const materialDispose = vi.spyOn(first.material, 'dispose');
    assets.texture.mockReturnValue([new THREE.Texture(), new THREE.Texture()]);
    rerender();
    expect(result.current.geometry).toBe(first.geometry);
    expect(result.current.material).not.toBe(first.material);
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
    const finalDispose = vi.spyOn(result.current.material, 'dispose');
    unmount();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(finalDispose).toHaveBeenCalledOnce();
  });

  it.each([false, true])('retains body materials when focus replaces the outline (array: %s)', (array) => {
    const sources = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    const geometry = new THREE.BoxGeometry();
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, array ? sources : sources[0]));
    assets.read.mockReturnValue({ scene });
    const sourceDisposals = sources.map(source => vi.spyOn(source, 'dispose'));
    const sourceGeometryDispose = vi.spyOn(geometry, 'dispose');
    const value = contact({ fleet: { DART: 10 } });
    const useHull = (focused: boolean) => {
      const formation = evaluate(component(useForeign(value, focused), 'FormationHulls'));
      const bucket = evaluate(component(formation, 'FormationHullBucket'));
      const loaded = evaluate(component(bucket, 'LoadedFormationHullBucket'));
      const part = evaluate(component(loaded, 'FormationHullPartMesh'));
      if (!isValidElement<{ children: ReactNode }>(part)) throw new Error('Missing hull part draws');
      const materials: THREE.Material[] = [];
      for (const child of Children.toArray(part.props.children)) {
        if (isValidElement<{ args: [THREE.BufferGeometry, THREE.Material | THREE.Material[], number] }>(child)) {
          const material = child.props.args[1];
          materials.push(...(Array.isArray(material) ? material : [material]));
        }
      }
      return { outline: materials[0]!, bodies: materials.slice(1) };
    };
    const { result, rerender, unmount } = renderHook(({ focused }) => useHull(focused), { initialProps: { focused: false } });
    const first = result.current;
    const oldOutlineDispose = vi.spyOn(first.outline, 'dispose');
    const bodyDisposals = first.bodies.map(material => vi.spyOn(material, 'dispose'));
    rerender({ focused: true });
    expect(result.current.bodies).toEqual(first.bodies);
    expect(result.current.outline).not.toBe(first.outline);
    expect(oldOutlineDispose).toHaveBeenCalledOnce();
    bodyDisposals.forEach(dispose => { expect(dispose).not.toHaveBeenCalled(); });
    const finalOutlineDispose = vi.spyOn(result.current.outline, 'dispose');
    unmount();
    bodyDisposals.forEach(dispose => { expect(dispose).toHaveBeenCalledOnce(); });
    expect(oldOutlineDispose).toHaveBeenCalledOnce();
    expect(finalOutlineDispose).toHaveBeenCalledOnce();
    sourceDisposals.forEach(dispose => { expect(dispose).not.toHaveBeenCalled(); });
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
  });

  it('replaces a wake colour buffer without disposing the live shader', () => {
    const { result, rerender, unmount } = renderHook(({ colour }) => draw(Wake({ scale: 1, colour })), { initialProps: { colour: '#aabbcc' } });
    const first = result.current;
    const geometryDispose = vi.spyOn(first.geometry, 'dispose');
    const materialDispose = vi.spyOn(first.material, 'dispose');
    rerender({ colour: '#ff3300' });
    expect(result.current.geometry).not.toBe(first.geometry);
    expect(result.current.material).toBe(first.material);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).not.toHaveBeenCalled();
    const finalDispose = vi.spyOn(result.current.geometry, 'dispose');
    unmount();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(finalDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('releases retired formation buffers while retaining shaders until unmount', () => {
    const initial = contact();
    const { result, rerender, unmount } = renderHook(({ value, focused }) => useFormation(value, focused), { initialProps: { value: initial, focused: false } });
    const first = result.current;
    const resources = [first.wake, first.lights, first.pips, first.ranks];
    const oldGeometries = resources.map(resource => vi.spyOn(resource.geometry, 'dispose'));
    const materials = resources.map(resource => vi.spyOn(resource.material, 'dispose'));
    rerender({ value: contact({ fleet: { PIKE: 20 } }), focused: true });
    oldGeometries.forEach(dispose => { expect(dispose).toHaveBeenCalledOnce(); });
    materials.forEach(dispose => { expect(dispose).not.toHaveBeenCalled(); });
    const current = result.current;
    const finalGeometries = [current.wake, current.lights, current.pips, current.ranks].map(resource => vi.spyOn(resource.geometry, 'dispose'));
    unmount();
    oldGeometries.forEach(dispose => { expect(dispose).toHaveBeenCalledOnce(); });
    finalGeometries.forEach(dispose => { expect(dispose).toHaveBeenCalledOnce(); });
    materials.forEach(dispose => { expect(dispose).toHaveBeenCalledOnce(); });
  });

  it('owns separate resources for simultaneous formations, including an empty formation', () => {
    const props = { markers: markersFor({ DART: 10 }), slots: [[0, 0, 0] satisfies Vec3Tuple], scale: 1, aimDistance: { current: 100 } };
    const first = renderHook(() => draw(FormationWakes(props)));
    const second = renderHook(() => draw(FormationWakes({ ...props, markers: [] })));
    expect(first.result.current.geometry).not.toBe(second.result.current.geometry);
    expect(first.result.current.material).not.toBe(second.result.current.material);
    expect(second.result.current.geometry.getAttribute('position').count).toBe(0);
    const dispose = vi.spyOn(second.result.current.material, 'dispose');
    first.unmount();
    expect(dispose).not.toHaveBeenCalled();
    second.unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });
});

describe('offscreen formation buffers', () => {
  it.each([false, true])('stops jet uploads offscreen and restores the current animation on re-entry (bounded drift: %s)', async drifting => {
    const { useFrame } = await import('@react-three/fiber');
    const units: EngineUnit[] = [{ at: [0, 0, 0], nozzles: [[0, 0, 0]], size: 1, colour: '#fff', intensity: 1, widthFactor: 1, lengthFactor: 1 }];
    const { result } = renderHook(() => EngineJets({ units, aimDistance: { current: 100 }, longitudinalOffset: drifting ? () => 0.25 : undefined, longitudinalOffsetBound: drifting ? 0.25 : undefined }), { wrapper: GalaxyVisualPhase });
    const element = result.current;
    if (!isValidElement<{ args: [THREE.BufferGeometry, THREE.Material, number]; ref: RefObject<THREE.InstancedMesh | null> }>(element)) throw new Error('Missing jet draw');
    const node = new THREE.InstancedMesh(...element.props.args);
    element.props.ref.current = node;
    const parent = new THREE.Group(); parent.add(node); parent.position.z = -10;
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
    const callback = vi.mocked(useFrame).mock.lastCall![0];
    const state = { camera, clock: { elapsedTime: 1 } } as Fiber.RootState;
    callback(state, 0);
    const version = node.instanceMatrix.version;
    const initial = node.instanceMatrix.array.slice();
    parent.position.x = 100;
    state.clock.elapsedTime = 5;
    callback(state, 0);
    expect(node.visible).toBe(false);
    expect(node.instanceMatrix.version).toBe(version);
    parent.position.x = 0;
    state.clock.elapsedTime = 10;
    callback(state, 0);
    expect(node.visible).toBe(true);
    expect(node.instanceMatrix.version).toBeGreaterThan(version);
    expect(node.instanceMatrix.array).not.toEqual(initial);
    expect((node.material as THREE.ShaderMaterial).uniforms.uTime?.value).toBe(10);
  });

  it('stops wake uploads offscreen but retains unbounded caller animation', async () => {
    const { useFrame } = await import('@react-three/fiber');
    const props = { markers: markersFor({ DART: 1 }), slots: [[0, 0, 0] as Vec3Tuple], scale: 1, aimDistance: { current: 100 } };
    const { result, rerender } = renderHook(({ animated }) => FormationWakes({ ...props, longitudinalOffset: animated ? () => 0 : undefined }), { initialProps: { animated: false }, wrapper: GalaxyVisualPhase });
    const element = result.current;
    if (!isValidElement<DrawProps & { ref: RefObject<THREE.Mesh | null> }>(element)) throw new Error('Missing wake draw');
    const node = new THREE.Mesh(element.props.geometry, element.props.material);
    element.props.ref.current = node;
    node.position.set(100, 0, -10);
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
    const state = { camera, clock: { elapsedTime: 1 } } as Fiber.RootState;
    const positions = node.geometry.getAttribute('position') as THREE.BufferAttribute;
    const version = positions.version;
    vi.mocked(useFrame).mock.lastCall![0](state, 0);
    expect(node.visible).toBe(false);
    expect(positions.version).toBe(version);
    rerender({ animated: true });
    vi.mocked(useFrame).mock.lastCall![0](state, 0);
    expect(node.visible).toBe(true);
    expect(positions.version).toBeGreaterThan(version);
  });
});

it('does not use a stale parent pose to hide engines in automatic-render previews', async () => {
  const { useFrame } = await import('@react-three/fiber');
  const units: EngineUnit[] = [{ at: [0, 0, 0], nozzles: [[0, 0, 0]], size: 1, colour: '#fff', intensity: 1, widthFactor: 1, lengthFactor: 1 }];
  // A gallery has no GalaxyVisualPhase: both child and parent use priority 0.
  const { result } = renderHook(() => EngineJets({ units, aimDistance: { current: 100 } }));
  const element = result.current;
  if (!isValidElement<{ args: [THREE.BufferGeometry, THREE.Material, number]; ref: RefObject<THREE.InstancedMesh | null> }>(element)) throw new Error('Missing jet draw');
  const node = new THREE.InstancedMesh(...element.props.args);
  element.props.ref.current = node;
  const parent = new THREE.Group(); parent.add(node); parent.position.set(100, 0, -10);
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
  const state = { camera, clock: { elapsedTime: 1 } } as Fiber.RootState;
  const [callback, priority] = vi.mocked(useFrame).mock.lastCall!;
  expect(priority).toBe(0);
  // Child effects subscribe before the parent's movement effect at equal priority.
  callback(state, 0);
  parent.position.x = 0;
  parent.updateMatrixWorld(true);
  expect(node.visible).toBe(true);
});


it('keeps every engine particle attached to a drifting convoy hull without rebuilding the draw', async () => {
  const { useFrame } = await import('@react-three/fiber');
  const units: EngineUnit[] = [{ at: [0, 0, 0], nozzles: [[0, 0, -0.42]], size: 1, colour: '#fff', intensity: 1, widthFactor: 1, lengthFactor: 1 }];
  const drift = vi.fn((index: number, seconds: number) => index + seconds * 0.25);
  const { result, rerender } = renderHook(({ drifting }) => EngineJets({ units, aimDistance: { current: 100 }, longitudinalOffset: drifting ? drift : undefined }), { initialProps: { drifting: false } });
  const element = result.current;
  if (!isValidElement<{ args: [THREE.BufferGeometry, THREE.Material, number]; ref: RefObject<THREE.InstancedMesh | null> }>(element)) throw new Error('Missing jet draw');
  const node = new THREE.InstancedMesh(...element.props.args);
  element.props.ref.current = node;
  const state = { camera: new THREE.PerspectiveCamera(60, 1, 0.1, 100), clock: { elapsedTime: 1 } } as Fiber.RootState;
  vi.mocked(useFrame).mock.lastCall![0](state, 0);
  const initial = node.instanceMatrix.array.slice();
  const resources = instancedDraw(result.current);
  rerender({ drifting: true });
  expect(instancedDraw(result.current).geometry).toBe(resources.geometry);
  expect(instancedDraw(result.current).material).toBe(resources.material);
  vi.mocked(useFrame).mock.lastCall![0](state, 0);
  expect(drift).toHaveBeenCalledWith(0, 1);
  for (let i = 0; i < node.count; i++) {
    expect(node.instanceMatrix.array[i * 16 + 14]! - initial[i * 16 + 14]!).toBeCloseTo(0.25, 5);
  }
  expect(units[0]!.at).toEqual([0, 0, 0]);
});
