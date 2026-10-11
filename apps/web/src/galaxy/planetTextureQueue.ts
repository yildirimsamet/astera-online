import type { Texture } from 'three';

interface TextureUploader {
  domElement: HTMLCanvasElement;
  initTexture: (texture: Texture) => void;
}

interface PendingTexture {
  owners: Set<symbol>;
  pending: boolean;
}

interface TextureQueue {
  add: (textures: readonly Texture[]) => () => void;
}

const queues = new WeakMap<TextureUploader, TextureQueue>();

/** One renderer owns one idle slot, even when several approaching looks are ready together. */
function createQueue(gl: TextureUploader): TextureQueue {
  const textures = new Map<Texture, PendingTexture>();
  let prepared = new WeakMap<Texture, number>();
  let scheduled: { id: number; kind: 'idle' | 'timer' } | null = null;
  let paused = false;
  let owners = 0;
  const hasIdle = typeof window.requestIdleCallback === 'function' && typeof window.cancelIdleCallback === 'function';
  const requestIdle = hasIdle ? window.requestIdleCallback.bind(window) : null;
  const cancelIdle = hasIdle ? window.cancelIdleCallback.bind(window) : null;
  const cancel = () => {
    if (!scheduled) return;
    if (scheduled.kind === 'idle') cancelIdle?.(scheduled.id);
    else window.clearTimeout(scheduled.id);
    scheduled = null;
  };
  const hasPending = () => {
    for (const item of textures.values()) if (item.pending) return true;
    return false;
  };
  const schedule = () => {
    if (scheduled || paused || !hasPending()) return;
    const upload = () => {
      if (paused) return;
      for (const [texture, item] of textures) {
        if (!item.pending) continue;
        item.pending = false;
        try {
          gl.initTexture(texture);
          prepared.set(texture, texture.version);
        } catch {
          // Drawing owns upload errors; preparation can still finish the remaining maps.
        }
        break;
      }
      schedule();
    };
    if (requestIdle) {
      scheduled = { kind: 'idle', id: requestIdle(deadline => {
        scheduled = null;
        // An idle callback may be delivered with no usable time left. Never force a batch.
        if (deadline.timeRemaining() < 4) { schedule(); return; }
        upload();
      }) };
    } else {
      scheduled = { kind: 'timer', id: window.setTimeout(() => {
        scheduled = null;
        upload();
      }, 50) };
    }
  };
  const lost = () => { paused = true; cancel(); };
  const restored = () => {
    paused = false;
    prepared = new WeakMap<Texture, number>();
    for (const item of textures.values()) item.pending = true;
    schedule();
  };
  gl.domElement.addEventListener('webglcontextlost', lost);
  gl.domElement.addEventListener('webglcontextrestored', restored);

  return {
    add(maps) {
      const owner = Symbol();
      const unique = new Set(maps);
      owners += 1;
      for (const texture of unique) {
        let item = textures.get(texture);
        if (!item) {
          item = { owners: new Set<symbol>(), pending: false };
          textures.set(texture, item);
        }
        item.owners.add(owner);
        if (prepared.get(texture) !== texture.version) item.pending = true;
      }
      schedule();
      let live = true;
      return () => {
        if (!live) return;
        live = false;
        owners -= 1;
        for (const texture of unique) {
          const item = textures.get(texture);
          if (!item) continue;
          item.owners.delete(owner);
          if (item.owners.size === 0) textures.delete(texture);
        }
        if (!hasPending()) cancel();
        if (owners === 0) {
          gl.domElement.removeEventListener('webglcontextlost', lost);
          gl.domElement.removeEventListener('webglcontextrestored', restored);
          queues.delete(gl);
        }
      };
    },
  };
}

/** Cancellation removes only this component's interest; shared maps remain queued for their other owners. */
export function queuePlanetTextures(gl: TextureUploader, textures: readonly Texture[]): () => void {
  if (textures.length === 0) return () => undefined;
  let queue = queues.get(gl);
  if (!queue) { queue = createQueue(gl); queues.set(gl, queue); }
  return queue.add(textures);
}
