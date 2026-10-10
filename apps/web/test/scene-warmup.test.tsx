import { act, render } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneWarmup } from '../src/galaxy/SceneWarmup.js';

interface WarmupState {
  gl: {
    compileAsync: (scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Scene) => Promise<THREE.Object3D>;
    compile: (scene: THREE.Object3D, camera: THREE.Camera) => Set<THREE.Material>;
  };
  scene: THREE.Scene;
  camera: THREE.Camera;
  invalidate: () => void;
}
const context = vi.hoisted(() => ({ read: vi.fn<() => WarmupState>() }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: WarmupState) => unknown) => select(context.read()),
  useFrame: vi.fn(),
}));

const compile = vi.fn<WarmupState['gl']['compileAsync']>();
const attach = vi.fn<WarmupState['gl']['compile']>();
const onCompiled = vi.fn();
const invalidate = vi.fn();
let scene: THREE.Scene;
let source: THREE.MeshStandardMaterial;
let geometry: THREE.BoxGeometry;
let texture: THREE.Texture;
let complete: (value: THREE.Object3D) => void;

function warmedMesh() {
  const mesh = compile.mock.calls[0]?.[0].getObjectByName('changing-monument');
  if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing warmup mesh');
  return { mesh, material: mesh.material };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  scene = new THREE.Scene();
  texture = new THREE.Texture();
  source = new THREE.MeshStandardMaterial({ map: texture });
  source.onBeforeCompile = vi.fn();
  source.customProgramCacheKey = () => 'monument-rim-patch';
  geometry = new THREE.BoxGeometry();
  const mesh = new THREE.Mesh(geometry, source);
  mesh.name = 'changing-monument';
  scene.add(mesh);
  compile.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  attach.mockReturnValue(new Set());
  context.read.mockReturnValue({ gl: { compileAsync: compile, compile: attach }, scene, camera: new THREE.PerspectiveCamera(), invalidate });
});
afterEach(() => { vi.useRealTimers(); });

describe('scene warmup while public models change', () => {
  it('attaches the ready shaders to live materials before freeing the snapshot, so the first draw reuses them', async () => {
    render(<SceneWarmup onCompiled={onCompiled} />);
    act(() => { vi.runOnlyPendingTimers(); });
    const { material } = warmedMesh();
    let attached = false;
    attach.mockImplementation(() => { attached = true; return new Set([source]); });
    let releasedWhileInUse = false;
    material.addEventListener('dispose', () => { releasedWhileInUse = attached; });
    await act(async () => { complete(scene); await Promise.resolve(); });
    expect(attach).toHaveBeenCalledWith(scene, context.read().camera);
    expect(releasedWhileInUse).toBe(true);
    expect(onCompiled).toHaveBeenCalledOnce();
  });
  it('keeps compiling materials alive when the live monument is replaced and disposed', async () => {
    const originalDispose = vi.spyOn(source, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    render(<SceneWarmup onCompiled={onCompiled} />);
    act(() => { vi.runOnlyPendingTimers(); });
    const { mesh, material } = warmedMesh();
    expect(material).not.toBe(source);
    expect(mesh.geometry).toBe(geometry);
    expect(material.map).toBe(texture);
    expect(material.customProgramCacheKey()).toBe(source.customProgramCacheKey());
    expect(compile.mock.calls[0]?.[2]).toBe(scene);
    const compiledDispose = vi.spyOn(material, 'dispose');
    scene.clear();
    source.dispose();
    expect(compiledDispose).not.toHaveBeenCalled();
    await act(async () => { complete(scene); await Promise.resolve(); });
    expect(compiledDispose).toHaveBeenCalledOnce();
    expect(originalDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(onCompiled).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('retains the snapshot until compilation finishes after unmount, then releases it without announcing readiness', async () => {
    const view = render(<SceneWarmup onCompiled={onCompiled} />);
    act(() => { vi.runOnlyPendingTimers(); });
    const { material } = warmedMesh();
    const disposed = vi.spyOn(material, 'dispose');
    view.unmount();
    expect(disposed).not.toHaveBeenCalled();
    await act(async () => { complete(scene); await Promise.resolve(); });
    expect(disposed).toHaveBeenCalledOnce();
    expect(onCompiled).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });

  it('still opens the normal drawing fallback and releases its own materials when compilation rejects', async () => {
    compile.mockRejectedValue(new Error('GPU compilation unavailable'));
    const originalDispose = vi.spyOn(source, 'dispose');
    render(<SceneWarmup onCompiled={onCompiled} />);
    act(() => { vi.runOnlyPendingTimers(); });
    const { material } = warmedMesh();
    const disposed = vi.spyOn(material, 'dispose');
    await act(async () => { await Promise.resolve(); });
    expect(disposed).toHaveBeenCalledOnce();
    expect(originalDispose).not.toHaveBeenCalled();
    expect(onCompiled).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledOnce();
    expect(attach).not.toHaveBeenCalled();
  });

  it('waits for opening data before preparing shaders', () => {
    const view = render(<SceneWarmup onCompiled={onCompiled} dataReady={false} />);
    act(() => { vi.runOnlyPendingTimers(); });
    expect(compile).not.toHaveBeenCalled();
    view.rerender(<SceneWarmup onCompiled={onCompiled} dataReady />);
    act(() => { vi.runOnlyPendingTimers(); });
    expect(compile).toHaveBeenCalledOnce();
  });

  it('shares each shader copy across mesh slots and keeps point shader textures and hooks', async () => {
    const mesh = scene.getObjectByName('changing-monument');
    if (!(mesh instanceof THREE.Mesh)) throw new Error('Missing source mesh');
    mesh.material = [source, source];
    const shader = new THREE.ShaderMaterial({ uniforms: { map: { value: texture } } });
    shader.onBeforeCompile = vi.fn();
    const points = new THREE.Points(geometry, shader);
    points.name = 'starfield';
    scene.add(points);
    render(<SceneWarmup onCompiled={onCompiled} />);
    act(() => { vi.runOnlyPendingTimers(); });
    const snapshot = compile.mock.calls[0]?.[0];
    const warmed = snapshot?.getObjectByName('changing-monument');
    const stars = snapshot?.getObjectByName('starfield');
    if (!(warmed instanceof THREE.Mesh) || !Array.isArray(warmed.material) || !(stars instanceof THREE.Points)
      || !(stars.material instanceof THREE.ShaderMaterial)) throw new Error('Missing shader snapshot');
    expect(warmed.material[0]).not.toBe(source);
    expect(warmed.material[0]).toBe(warmed.material[1]);
    expect(stars.material).not.toBe(shader);
    expect(stars.material.uniforms.map?.value).toBe(texture);
    expect(stars.material.customProgramCacheKey()).toBe(shader.customProgramCacheKey());
    const disposed = vi.spyOn(warmed.material[0], 'dispose');
    await act(async () => { complete(scene); await Promise.resolve(); });
    expect(disposed).toHaveBeenCalledOnce();
  });
});
