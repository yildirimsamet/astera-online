import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const isMaterial = (value: unknown): value is THREE.Material => value instanceof THREE.Material;

/** Live model replacement must not dispose a program compileAsync is still polling. */
function warmupSnapshot(scene: THREE.Scene) {
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
export function FirstSceneFrame({ ready, onDrawn }: { ready: boolean; onDrawn: () => void }) {
  const fired = useRef(false);
  const drawnFrame = useRef(0);
  useFrame(() => {
    if (!ready || fired.current) return;
    fired.current = true;
    drawnFrame.current = requestAnimationFrame(onDrawn);
  }, 2);
  useEffect(() => () => { cancelAnimationFrame(drawnFrame.current); }, []);
  return null;
}
