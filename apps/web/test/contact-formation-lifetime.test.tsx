import { renderHook } from '@testing-library/react';
import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import { shareStructure } from '../src/api/structural.js';
import { FormationWakes, Traffic, Wake } from '../src/galaxy/Fleets.js';
import { markersFor } from '../src/galaxy/Squadrons.js';
import type { Vec3Tuple } from '../src/galaxy/scene.js';

// Run the actual hook lifecycles and real Three resources without a WebGL context.
vi.mock('@react-three/fiber', async (original) => ({
  ...await original<typeof import('@react-three/fiber')>(),
  useFrame: vi.fn(),
}));
const assets = vi.hoisted(() => ({ read: vi.fn<() => { scene: THREE.Group }[]>() }));
vi.mock('@react-three/drei', async (original) => ({
  ...await original<typeof import('@react-three/drei')>(),
  useGLTF: Object.assign(() => assets.read(), { preload: vi.fn() }),
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

type ForeignProps = { contact: Contact; nodes: []; focused: boolean; onSelect: () => void };
type FormationProps = ComponentProps<typeof FormationWakes> & { focused: boolean; showPips: boolean };
type DrawProps = { geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial; name?: string };

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
  return { markers: wakes.markers, slots: wakes.slots, wake: draw(FormationWakes(wakes)), lights: draw(lights), pips: draw(pips), ranks: draw(ranks) };
}

beforeEach(() => {
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
  it.each([false, true])('retains body materials when focus replaces the outline (array: %s)', (array) => {
    const sources = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    const geometry = new THREE.BoxGeometry();
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, array ? sources : sources[0]));
    assets.read.mockReturnValue([{ scene }]);
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
