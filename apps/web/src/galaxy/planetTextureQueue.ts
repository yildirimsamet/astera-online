import type { Texture } from 'three';
import type { PreparationResult } from './openingPreparation.js';

interface TextureUploader {
  domElement: HTMLCanvasElement;
  initTexture: (texture: Texture) => void;
  getContext?: () => { isContextLost: () => boolean };
}

export interface TexturePreparation {
  /** Upload commands submitted, not a GPU fence. Failures resolve as results. */
  ready: Promise<PreparationResult>;
  cancel: () => void;
}

interface Request {
  remaining: Set<Texture>;
  failed: boolean;
  done: boolean;
  resolve: (result: PreparationResult) => void;
  loading: () => boolean;
}
interface PendingTexture { owners: Set<Request>; pending: boolean }
interface TextureQueue { add: (maps: readonly Texture[], loading: () => boolean) => TexturePreparation }
const queues = new WeakMap<TextureUploader, TextureQueue>();
const ordinaryLoading = () => false;

/** One renderer, one scheduled slot, at most one texture upload per turn. */
function createQueue(gl: TextureUploader): TextureQueue {
  const textures = new Map<Texture, PendingTexture>();
  const requests = new Set<Request>();
  let prepared = new WeakMap<Texture, number>();
  let scheduled: { id: number; kind: 'idle' | 'timer' | 'loading' } | null = null;
  let paused = gl.getContext?.().isContextLost() ?? false;
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
  const underCover = () => {
    for (const request of requests) if (!request.done && request.loading()) return true;
    return false;
  };
  const settle = (request: Request, result: PreparationResult) => {
    if (request.done) return;
    request.done = true;
    request.resolve(result);
  };
  const schedule = () => {
    if (paused || !hasPending()) return;
    const loading = underCover();
    if (scheduled) {
      if (!loading || scheduled.kind === 'loading') return;
      // A covered owner can promote a texture already waiting for an idle slot.
      cancel();
    }
    const upload = () => {
      if (paused) return;
      for (const [texture, item] of textures) {
        if (!item.pending) continue;
        item.pending = false;
        const version = texture.version;
        let failed = false;
        try {
          gl.initTexture(texture);
          if (gl.getContext?.().isContextLost()) { lost(); return; }
          prepared.set(texture, version);
          // An onUpdate hook may have changed the texture while it was submitted.
          if (texture.version !== version) { item.pending = true; break; }
        } catch {
          failed = true;
        }
        for (const owner of item.owners) {
          if (owner.done) continue;
          owner.failed ||= failed;
          owner.remaining.delete(texture);
          if (owner.remaining.size === 0) settle(owner, owner.failed ? 'failed' : 'ready');
        }
        break;
      }
      schedule();
    };
    if (loading) {
      // Startup must make progress even when continuous frames leave no idle time.
      scheduled = { kind: 'loading', id: window.setTimeout(() => {
        scheduled = null;
        if (!underCover()) { schedule(); return; }
        upload();
      }, 16) };
    } else if (requestIdle) {
      scheduled = { kind: 'idle', id: requestIdle(deadline => {
        scheduled = null;
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
  const lost = () => {
    paused = true;
    cancel();
    for (const request of requests) settle(request, 'context-lost');
  };
  const restored = () => {
    paused = false;
    prepared = new WeakMap<Texture, number>();
    for (const item of textures.values()) item.pending = true;
    schedule();
  };
  gl.domElement.addEventListener('webglcontextlost', lost);
  gl.domElement.addEventListener('webglcontextrestored', restored);

  return {
    add(maps, loading) {
      let resolve: Request['resolve'] = () => undefined;
      const ready = new Promise<PreparationResult>(finish => { resolve = finish; });
      const owner: Request = { remaining: new Set<Texture>(), failed: false, done: false, resolve, loading };
      const unique = new Set(maps);
      requests.add(owner);
      for (const texture of unique) {
        let item = textures.get(texture);
        if (!item) {
          item = { owners: new Set<Request>(), pending: false };
          textures.set(texture, item);
        }
        item.owners.add(owner);
        if (prepared.get(texture) !== texture.version) {
          item.pending = true;
          owner.remaining.add(texture);
        }
      }
      if (paused) settle(owner, 'context-lost');
      else if (owner.remaining.size === 0) settle(owner, 'ready');
      schedule();
      let live = true;
      return { ready, cancel: () => {
        if (!live) return;
        live = false;
        settle(owner, 'cancelled');
        requests.delete(owner);
        for (const texture of unique) {
          const item = textures.get(texture);
          if (!item) continue;
          item.owners.delete(owner);
          if (item.owners.size === 0) textures.delete(texture);
        }
        if (!hasPending()) cancel();
        if (requests.size === 0) {
          gl.domElement.removeEventListener('webglcontextlost', lost);
          gl.domElement.removeEventListener('webglcontextrestored', restored);
          queues.delete(gl);
        }
      } };
    },
  };
}

/** Cancellation releases only this owner's interest; shared maps keep preparing. */
export function queuePlanetTextures(
  gl: TextureUploader, textures: readonly Texture[], loading: () => boolean = ordinaryLoading,
): TexturePreparation {
  if (textures.length === 0) return { ready: Promise.resolve('ready'), cancel: () => undefined };
  let queue = queues.get(gl);
  if (!queue) { queue = createQueue(gl); queues.set(gl, queue); }
  return queue.add(textures, loading);
}
