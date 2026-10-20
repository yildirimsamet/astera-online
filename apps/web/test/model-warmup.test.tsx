import { act, render } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelWarmup } from '../src/galaxy/SceneWarmup.js';

/*
  2026-10-20 performance recording (Galaxy S22): the first zoom out froze the phone for
  548 ms while +4 programs and +20 textures appeared at once — the eight monuments' maps
  (1280²–2048²) compiled and uploaded inside one frame. A model that arrives after the
  opening's warmup prepares its own shaders and queues its maps one idle slot at a time.
*/
interface WarmupState {
  gl: {
    compileAsync: (scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Object3D) => Promise<THREE.Object3D>;
    compile: (scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Object3D) => Set<THREE.Material>;
  };
  scene: THREE.Scene;
  camera: THREE.Camera;
}
const context = vi.hoisted(() => ({ read: vi.fn<() => WarmupState>() }));
const queue = vi.hoisted(() => ({ add: vi.fn(), cancel: vi.fn() }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: WarmupState) => unknown) => select(context.read()),
  useFrame: vi.fn(),
}));
vi.mock('../src/galaxy/planetTextureQueue.js', () => ({
  queuePlanetTextures: (...args: unknown[]) => { queue.add(...args); return { ready: Promise.resolve('ready'), cancel: queue.cancel }; },
}));

const compile = vi.fn<WarmupState['gl']['compileAsync']>();
const attach = vi.fn<WarmupState['gl']['compile']>();
let scene: THREE.Scene;
let camera: THREE.Camera;
let model: THREE.Group;
let source: THREE.MeshStandardMaterial;
let colour: THREE.Texture;
let normal: THREE.Texture;
let complete: (value: THREE.Object3D) => void;

function Warm({ object }: { object: THREE.Object3D }) {
  useModelWarmup(object);
  return null;
}

const snapshotMaterial = () => {
  const mesh = compile.mock.calls[0]?.[0].getObjectByName('monument-hull');
  if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing snapshot');
  return mesh.material;
};

beforeEach(() => {
  vi.clearAllMocks();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();
  colour = new THREE.Texture();
  normal = new THREE.Texture();
  source = new THREE.MeshStandardMaterial({ map: colour, normalMap: normal });
  model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
  mesh.name = 'monument-hull';
  model.add(mesh);
  compile.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  attach.mockReturnValue(new Set());
  context.read.mockReturnValue({ gl: { compileAsync: compile, compile: attach }, scene, camera });
});
afterEach(() => { vi.useRealTimers(); });

describe('a model that arrives after the opening prepares itself', () => {
  it('compiles a snapshot against the live scene lights, then attaches the programs to the live model', async () => {
    render(<Warm object={model} />);
    expect(compile).toHaveBeenCalledOnce();
    expect(compile.mock.calls[0]?.[1]).toBe(camera);
    expect(compile.mock.calls[0]?.[2]).toBe(scene);
    const copy = snapshotMaterial();
    expect(copy).not.toBe(source);
    const disposed = vi.spyOn(copy, 'dispose');
    await act(async () => { complete(model); await Promise.resolve(); await Promise.resolve(); });
    expect(attach).toHaveBeenCalledWith(model, camera, scene);
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('queues every map the model draws with, once each, only after its shaders are ready', async () => {
    const twin = new THREE.Mesh(new THREE.BoxGeometry(), source);
    model.add(twin);
    render(<Warm object={model} />);
    expect(queue.add).not.toHaveBeenCalled();
    await act(async () => { complete(model); await Promise.resolve(); await Promise.resolve(); });
    expect(queue.add).toHaveBeenCalledOnce();
    const [, textures] = queue.add.mock.calls[0] as [unknown, THREE.Texture[]];
    expect(new Set(textures)).toEqual(new Set([colour, normal]));
    expect(textures).toHaveLength(2);
  });

  it('releases its snapshot and queues nothing when the model leaves before compilation ends', async () => {
    const view = render(<Warm object={model} />);
    const disposed = vi.spyOn(snapshotMaterial(), 'dispose');
    view.unmount();
    await act(async () => { complete(model); await Promise.resolve(); await Promise.resolve(); });
    expect(disposed).toHaveBeenCalledOnce();
    expect(attach).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('withdraws its queued maps when the model leaves', async () => {
    const view = render(<Warm object={model} />);
    await act(async () => { complete(model); await Promise.resolve(); await Promise.resolve(); });
    view.unmount();
    expect(queue.cancel).toHaveBeenCalledOnce();
  });

  it('still queues the maps when the GPU cannot compile ahead, so the draw path stays the fallback', async () => {
    compile.mockRejectedValue(new Error('GPU compilation unavailable'));
    render(<Warm object={model} />);
    const disposed = vi.spyOn(snapshotMaterial(), 'dispose');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(disposed).toHaveBeenCalledOnce();
    expect(attach).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledOnce();
  });

  it('never touches the source model’s materials', async () => {
    const disposed = vi.spyOn(source, 'dispose');
    const view = render(<Warm object={model} />);
    await act(async () => { complete(model); await Promise.resolve(); await Promise.resolve(); });
    view.unmount();
    expect(disposed).not.toHaveBeenCalled();
  });
});
