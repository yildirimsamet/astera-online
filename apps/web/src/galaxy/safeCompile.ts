import type * as THREE from 'three';

interface Renderer {
  compile: (scene: THREE.Object3D, camera: THREE.Camera, targetScene?: THREE.Scene | null) => Set<THREE.Material>;
  getContext: () => { isContextLost: () => boolean };
  properties: { get: (object: unknown) => unknown };
}

/** The material's program in the renderer's current table, if it still has one. */
function programOf(entry: unknown): { isReady: () => boolean } | null {
  if (typeof entry !== 'object' || entry === null || !('currentProgram' in entry)) return null;
  const program = entry.currentProgram;
  if (typeof program !== 'object' || program === null || !('isReady' in program)) return null;
  const isReady = program.isReady;
  return typeof isReady === 'function' ? { isReady: () => Boolean(isReady.call(program)) } : null;
}

/**
 * THREE'S `compileAsync`, MINUS ITS CRASH ON A PHONE THAT TAKES THE GPU BACK (Sentry WEB-2).
 *
 * three polls each material's program every 10 ms and never asks whether the context survived.
 * A restore in between rebuilds the renderer's `properties` table, the material has no program in
 * it, and `program.isReady()` throws from a bare timer. Here a lost context ends the wait (the
 * callers already fall back on a rejection), and a material the restore wiped is no longer ours to
 * wait for: the next draw compiles it on the new context.
 */
export function compileWhileLive(gl: Renderer, scene: THREE.Object3D, camera: THREE.Camera,
  targetScene: THREE.Scene | null = null): Promise<THREE.Object3D> {
  const lost = () => gl.getContext().isContextLost();
  if (lost()) return Promise.reject(new Error('WebGL context lost'));
  const pending = gl.compile(scene, camera, targetScene);
  return new Promise((resolve, reject) => {
    const check = (): void => {
      if (lost()) { reject(new Error('WebGL context lost')); return; }
      for (const material of pending) {
        const program = programOf(gl.properties.get(material));
        if (!program || program.isReady()) pending.delete(material);
      }
      if (pending.size === 0) resolve(scene);
      else setTimeout(check, 10);
    };
    check();
  });
}

/** Every `gl.compileAsync` in the scene (warmup, late models, planet skins) gets the guard at once. */
export function guardCompileAsync(gl: Renderer & Pick<THREE.WebGLRenderer, 'compileAsync'>): void {
  gl.compileAsync = (scene, camera, targetScene) => compileWhileLive(gl, scene, camera, targetScene ?? null);
}
