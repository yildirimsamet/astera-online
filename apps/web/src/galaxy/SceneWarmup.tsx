import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

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
      // On failure, attempt the normal draw/error boundary instead of stranding
      // the scene behind a permanently closed render gate.
      void gl.compileAsync(scene, camera).then(finish, finish);
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
