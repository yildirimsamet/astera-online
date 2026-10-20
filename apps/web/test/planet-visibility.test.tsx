import { Children, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode, type RefObject } from 'react';
import { renderHook } from '@testing-library/react';
import { useFrame, type RootState, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { DefaultPlanetModel } from '../src/galaxy/PlanetSkinModel.js';
import { placeBodies } from '../src/galaxy/planetPick.js';
import { GalaxyVisualPhase } from '../src/galaxy/visualFrame.js';

const assets = vi.hoisted(() => ({ read: vi.fn<() => { scene: THREE.Group }>(), invalidate: vi.fn() }));
vi.mock('@react-three/drei', () => ({ useGLTF: Object.assign(() => assets.read(), { preload: vi.fn() }) }));
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn(), useThree: () => assets.invalidate }));
vi.mock('../src/galaxy/tap.js', () => ({ wasTap: () => true, markHit: vi.fn() }));

interface DrawProps {
  name: string;
  args: [THREE.BufferGeometry | undefined, THREE.Material | undefined, number];
  ref: RefObject<THREE.InstancedMesh | null>;
  onPointerUp?: (event: Pick<ThreeEvent<PointerEvent>, 'instanceId' | 'stopPropagation'>) => void;
  children?: ReactNode;
}
function draw(tree: ReactNode, name: string): ReactElement<DrawProps> {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<DrawProps>(child)) continue;
    if (child.props.name === name) return child;
    if (child.props.children) {
      try { return draw(child.props.children, name); } catch { /* Continue siblings. */ }
    }
  }
  throw new Error(`Missing draw ${name}`);
}
function isComponent<P>(type: ReactElement<P>['type']): type is (props: P) => ReactNode {
  return typeof type === 'function' && !String(type).startsWith('class');
}
function evaluate<P>(element: ReactElement<P>): ReactNode {
  if (element.type === Fragment && isValidElement<{ children?: ReactNode }>(element)) {
    return Children.map(element.props.children, child => isValidElement(child) ? evaluate(child) : child);
  }
  if (!isComponent(element.type)) throw new Error('Expected a function');
  return element.type(element.props);
}
const node = (id: string, x: number): ComponentProps<typeof DefaultPlanetModel>['nodes'][number] => ({ id, position: [x, 0, -10] as [number, number, number], radius: 1, stance: 'watched' as const, intel: 'RESOLVED' as const });

it.each(['full', 'far'] as const)('keeps %s body compaction separate from pick identity and restores current matrices', lod => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial()));
  assets.read.mockReturnValue({ scene });
  const nodes = [node('off', 100), node('visible', 0)];
  const onSelect = vi.fn();
  let body: THREE.InstancedMesh | undefined, hits: THREE.InstancedMesh | undefined;
  const { result, rerender } = renderHook(({ members }) => {
    const tree = evaluate(DefaultPlanetModel({ url: `visibility-${lod}`, lod, nodes: members, capacity: 4, onSelect }));
    const bodyElement = draw(tree, `planet-models-${lod}`);
    const hitsElement = draw(tree, `planet-models-${lod}-hits`);
    body ??= new THREE.InstancedMesh(...bodyElement.props.args);
    hits ??= new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial(), 4);
    // Fiber attaches refs before the component's layout effects run.
    bodyElement.props.ref.current = body;
    hitsElement.props.ref.current = hits;
    return { body, hits, pick: hitsElement.props.onPointerUp };
  }, { initialProps: { members: nodes }, wrapper: GalaxyVisualPhase });
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
  const state = { camera, clock: { elapsedTime: 1 } } as RootState;
  const frame = () => { vi.mocked(useFrame).mock.lastCall![0](state, 0); };
  const mesh = result.current.body;
  // 2026-10-20 admin profile: an empty bucket still walked the whole render path every frame.
  expect(mesh.visible).toBe(false);
  frame();
  expect(mesh.count).toBe(1);
  expect(mesh.visible).toBe(true);
  expect(mesh.instanceMatrix.count).toBe(4);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(result.current.hits)[0];
  expect(hit?.instanceId).toBe(1);
  if (hit?.instanceId === undefined) throw new Error('Missing planet hit');
  result.current.pick?.({ instanceId: hit.instanceId, stopPropagation: vi.fn() });
  expect(onSelect).toHaveBeenCalledWith('visible');
  const version = mesh.instanceMatrix.version;
  frame();
  if (lod === 'far') expect(mesh.instanceMatrix.version).toBe(version);
  camera.position.x = 200;
  frame();
  expect(mesh.count).toBe(0);
  expect(mesh.visible).toBe(false);
  camera.position.x = 0;
  state.clock.elapsedTime = 30;
  frame();
  const reference = new THREE.InstancedMesh(mesh.geometry, mesh.material, 1);
  placeBodies(reference, [nodes[1]!], lod === 'far' ? 0 : 30);
  expect(Array.from(mesh.instanceMatrix.array.slice(0, 16))).toEqual(Array.from(reference.instanceMatrix.array));
  // Same camera, new server payload: position and instance tint must refresh.
  const replacement = { ...node('replacement', 3), intel: 'REMEMBERED' as const };
  rerender({ members: [replacement] });
  frame();
  expect(mesh.count).toBe(1);
  expect(mesh.visible).toBe(true);
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(0, matrix);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBe(3);
  const intersections = new THREE.Raycaster(new THREE.Vector3(3, 0, 0), new THREE.Vector3(0, 0, -1)).intersectObject(result.current.hits);
  expect(intersections[0]?.instanceId).toBe(0);
  reference.dispose();
});
