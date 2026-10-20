import { useContext, useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OpeningWork } from './OpeningViews.js';
import { queuePlanetTextures } from './planetTextureQueue.js';

const isMaterial = (value: unknown): value is THREE.Material => value instanceof THREE.Material;
const isTexture = (value: unknown): value is THREE.Texture => value instanceof THREE.Texture;

/** Live model replacement must not dispose a program compileAsync is still polling. */
function warmupSnapshot(scene: THREE.Object3D) {
  const probes = new THREE.Group();
  const materials = new Map<THREE.Material, THREE.Material>();
  const copy = (source: unknown): THREE.Material => {
    if (!isMaterial(source)) throw new Error('Invalid scene material');
    let material = materials.get(source);
    if (!material) {
      material = source.clone();
      material.onBeforeCompile = source.onBeforeCompile.bind(source);
      material.customProgramCacheKey = source.customProgramCacheKey.bind(source);
      if (material instanceof THREE.ShaderMaterial && source instanceof THREE.ShaderMaterial) material.uniforms = source.uniforms;
      materials.set(source, material);
    }
    return material;
  };
  // Compilation needs each renderable's geometry/defines, not its world transform.
  // Lights and environment come from the original scene, without duplicate lights.
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite)) return;
    const probe = object.clone(false);
    probe.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    probes.add(probe);
  });
  return { probes, dispose: () => { for (const material of materials.values()) material.dispose(); } };
}

/**
 * Mounted inside the scene's Suspense boundary, after its models have parsed.
 * compileAsync lets browsers with KHR_parallel_shader_compile finish programs
 * without synchronously checking every link. Unlike drei's Preload, it does not
 * render the entire scene six more times through a cube camera.
 */
export function SceneWarmup({ onCompiled, dataReady = true }: { onCompiled: () => void; dataReady?: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!dataReady) return;
    let live = true;
    const finish = () => {
      if (!live) return;
      onCompiled();
      invalidate();
    };
    // Give the opening's new DOM layers a paint before submitting shader work.
    const start = window.setTimeout(() => {
      const snapshot = warmupSnapshot(scene);
      const compiled = () => { snapshot.dispose(); finish(); };
      // On failure, attempt the normal draw/error boundary instead of stranding
      // the scene behind a permanently closed render gate.
      void gl.compileAsync(snapshot.probes, camera, scene)
        // Attach the prepared programs to current live materials before releasing
        // the copies, otherwise Three deletes their sole program reference.
        .then(() => { if (live) gl.compile(scene, camera); })
        .then(compiled, compiled);
    }, 0);
    return () => { live = false; window.clearTimeout(start); };
  }, [gl, scene, camera, invalidate, onCompiled, dataReady]);
  return null;
}

/** Every map a model's materials draw with, once each. */
function texturesOf(object: THREE.Object3D): THREE.Texture[] {
  const textures = new Set<THREE.Texture>();
  object.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    const materials: unknown[] = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!isMaterial(material)) continue;
      for (const value of Object.values(material)) if (isTexture(value)) textures.add(value);
    }
  });
  return [...textures];
}

/**
 * A MODEL THAT ARRIVES AFTER THE OPENING'S WARMUP PREPARES ITSELF. 2026-10-20 performance
 * recording (Galaxy S22): the first zoom out froze for 548 ms as +4 programs and +20
 * textures appeared in one frame — the eight monuments' maps, 1280² to 2048². Its shaders
 * compile in parallel the way `SceneWarmup` does it, then its maps go through the shared
 * texture queue one idle slot at a time, so the first frame that shows it only draws.
 */
export function useModelWarmup(object: THREE.Object3D): void {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const work = useContext(OpeningWork);
  useEffect(() => {
    let live = true;
    let cancelTextures = (): void => undefined;
    const snapshot = warmupSnapshot(object);
    const upload = () => {
      snapshot.dispose();
      if (!live) return;
      cancelTextures = queuePlanetTextures(gl, texturesOf(object), () => work?.covered ?? false).cancel;
    };
    void gl.compileAsync(snapshot.probes, camera, scene)
      .then(() => { if (live) gl.compile(object, camera, scene); })
      .then(upload, upload);
    return () => { live = false; cancelTextures(); };
  }, [gl, scene, camera, object, work]);
}

/**
 * Take over fiber's default render throughout startup. The composer below is
 * enabled only after warmup: an early automatic draw would block on the very
 * shaders compileAsync is still preparing. Mounted outside Suspense as well.
 */
export function SceneRenderGate() {
  useFrame(() => undefined, 1);
  return null;
}

/** The ready signal follows the composer's actual draw, never just its download. */
export function FirstSceneFrame({ ready, onDrawn, settled }: { ready: boolean; onDrawn: () => void; settled?: RefObject<boolean> }) {
  const gl = useThree(state => state.gl);
  const fired = useRef(false);
  const drawnFrame = useRef(0);
  useFrame(() => {
    if (!ready || fired.current || settled?.current === false || gl.getContext().isContextLost()) return;
    fired.current = true;
    drawnFrame.current = requestAnimationFrame(() => {
      // A context can disappear between the draw and this next-frame callback.
      if (gl.getContext().isContextLost()) { fired.current = false; return; }
      onDrawn();
    });
  }, 2);
  useEffect(() => () => { cancelAnimationFrame(drawnFrame.current); }, []);
  return null;
}
