import { act, cleanup, render } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanetWarmup } from '../src/galaxy/PlanetSkinModel.js';
import { planetLook } from '../src/ui/assets.js';

interface WarmupState {
  gl: {
    domElement: HTMLCanvasElement;
    compileAsync: (scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Scene) => Promise<THREE.Object3D>;
    initTexture: (texture: THREE.Texture) => void;
  };
  camera: THREE.Camera;
  scene: THREE.Scene;
}
const context = vi.hoisted(() => ({ read: vi.fn<() => WarmupState>(), load: vi.fn<() => { scene: THREE.Scene }>() }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: WarmupState) => unknown) => select(context.read()),
  useFrame: vi.fn(),
}));
vi.mock('@react-three/drei', () => ({ useGLTF: () => context.load() }));
vi.mock('../src/galaxy/PlanetField.jsx', () => ({ bodyLight: () => 1 }));

const idle = new Map<number, IdleRequestCallback>();
let next = 0;
const compile = vi.fn<WarmupState['gl']['compileAsync']>();
const upload = vi.fn<WarmupState['gl']['initTexture']>();
const usedLooks = new Set<number>();
let id: string;
let maps: THREE.Texture[];

function runIdle() {
  const entry = idle.entries().next().value;
  if (!entry) throw new Error('No pending idle callback');
  const [key, callback] = entry;
  idle.delete(key);
  act(() => { callback({ didTimeout: false, timeRemaining: () => 20 }); });
}

beforeEach(() => {
  vi.clearAllMocks(); idle.clear(); next = 0;
  for (let i = 0; ; i += 1) {
    id = `warmup-effect-${String(i)}`;
    const look = planetLook(id);
    if (!usedLooks.has(look)) { usedLooks.add(look); break; }
  }
  maps = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
  const model = new THREE.Scene();
  model.add(new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshStandardMaterial({
    map: maps[0], normalMap: maps[1], roughnessMap: maps[2],
  })));
  context.load.mockReturnValue({ scene: model });
  compile.mockImplementation(probes => Promise.resolve(probes));
  context.read.mockReturnValue({ gl: { domElement: document.createElement('canvas'), compileAsync: compile, initTexture: upload }, camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene() });
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => { const key = ++next; idle.set(key, callback); return key; });
  vi.stubGlobal('cancelIdleCallback', (key: number) => { idle.delete(key); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('planet preparation is isolated from drawing and component lifetime', () => {
  it('compiles first, then uploads only one full-detail map per idle callback', async () => {
    render(<PlanetWarmup id={id} lod="full" />);
    expect(upload).not.toHaveBeenCalled();
    await act(async () => { await Promise.resolve(); });
    runIdle();
    expect(upload).toHaveBeenCalledTimes(1);
    runIdle(); runIdle();
    expect(upload.mock.calls).toEqual(maps.map(map => [map]));
  });

  it('prepares only the colour map for a light model', async () => {
    render(<PlanetWarmup id={id} lod="lite" />);
    await act(async () => { await Promise.resolve(); });
    runIdle();
    expect(upload.mock.calls).toEqual([[maps[0]]]);
    expect(idle.size).toBe(0);
  });

  it('still prepares both opening-world tiers and deduplicates a map shared by them', async () => {
    render(<PlanetWarmup id={id} />);
    expect(compile).toHaveBeenCalledTimes(2);
    await act(async () => { await Promise.resolve(); });
    runIdle(); runIdle(); runIdle();
    expect(upload.mock.calls).toEqual(maps.map(map => [map]));
    expect(idle.size).toBe(0);
  });

  it('cancels queued uploads on unmount while retaining the shared geometry and material', async () => {
    const view = render(<PlanetWarmup id={id} lod="full" />);
    const probe = compile.mock.calls[0]?.[0].children[0];
    if (!(probe instanceof THREE.Mesh) || Array.isArray(probe.material)) throw new Error('Missing preparation probe');
    const geometryDispose = vi.spyOn(probe.geometry, 'dispose');
    const materialDispose = vi.spyOn(probe.material, 'dispose');
    await act(async () => { await Promise.resolve(); });
    view.unmount();
    expect(idle.size).toBe(0);
    expect(upload).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
  });

  it('does not enqueue uploads when async compilation completes after unmount', async () => {
    let finish: ((value: THREE.Object3D) => void) | undefined;
    compile.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<PlanetWarmup id={id} lod="full" />);
    view.unmount();
    await act(async () => { finish?.(new THREE.Group()); await Promise.resolve(); });
    expect(idle.size).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it('handles preparation rejection so the normal model drawing can still proceed', async () => {
    compile.mockRejectedValue(new Error('Parallel compilation failed'));
    render(<PlanetWarmup id={id} lod="full" />);
    await act(async () => { await Promise.resolve(); });
    expect(upload).not.toHaveBeenCalled();
    expect(idle.size).toBe(0);
  });

  it('also keeps a synchronous renderer preparation failure inside the background preparation', () => {
    compile.mockImplementation(() => { throw new Error('Renderer unavailable'); });
    expect(() => render(<PlanetWarmup id={id} lod="full" />)).not.toThrow();
    expect(upload).not.toHaveBeenCalled();
    expect(idle.size).toBe(0);
  });
});
