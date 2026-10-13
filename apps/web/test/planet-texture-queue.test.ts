import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queuePlanetTextures } from '../src/galaxy/planetTextureQueue.js';

const idle = new Map<number, IdleRequestCallback>();
let next = 0;
const request = vi.fn((callback: IdleRequestCallback) => {
  const id = ++next;
  idle.set(id, callback);
  return id;
});
const cancel = vi.fn((id: number) => { idle.delete(id); });

function runIdle(budget = 20) {
  const entry = idle.entries().next().value;
  if (!entry) throw new Error('No pending idle callback');
  const [id, callback] = entry;
  idle.delete(id);
  callback({ didTimeout: false, timeRemaining: () => budget });
}

function uploader() {
  return { domElement: document.createElement('canvas'), initTexture: vi.fn<(texture: THREE.Texture) => void>() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  idle.clear();
  next = 0;
  vi.stubGlobal('requestIdleCallback', request);
  vi.stubGlobal('cancelIdleCallback', cancel);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('planet texture preparation without a batch upload in one frame', () => {
  it('shares a queue and uploads at most one texture in each idle callback', () => {
    const gl = uploader();
    const maps = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
    const stop = queuePlanetTextures(gl, maps).cancel;
    expect(gl.initTexture).not.toHaveBeenCalled();
    expect(idle.size).toBe(1);
    runIdle();
    expect(gl.initTexture.mock.calls).toEqual([[maps[0]]]);
    runIdle();
    expect(gl.initTexture.mock.calls).toEqual([[maps[0]], [maps[1]]]);
    runIdle();
    expect(gl.initTexture.mock.calls).toEqual(maps.map(map => [map]));
    expect(idle.size).toBe(0);
    stop();
  });

  it('deduplicates maps across owners without cancelling another owner', () => {
    const gl = uploader();
    const shared = new THREE.Texture();
    const abandoned = new THREE.Texture();
    const kept = new THREE.Texture();
    const stopA = queuePlanetTextures(gl, [shared, abandoned]).cancel;
    const stopB = queuePlanetTextures(gl, [shared, kept]).cancel;
    expect(idle.size).toBe(1);
    stopA();
    runIdle(); runIdle();
    expect(gl.initTexture.mock.calls).toEqual([[shared], [kept]]);
    const stopC = queuePlanetTextures(gl, [shared]).cancel;
    expect(idle.size).toBe(0);
    stopC(); stopB();
  });

  it('prepares the same texture independently for two renderers', () => {
    const a = uploader(); const b = uploader(); const map = new THREE.Texture();
    const stopA = queuePlanetTextures(a, [map]).cancel;
    const stopB = queuePlanetTextures(b, [map]).cancel;
    runIdle(); runIdle();
    expect(a.initTexture).toHaveBeenCalledWith(map);
    expect(b.initTexture).toHaveBeenCalledWith(map);
    stopA(); stopB();
  });

  it('prepares an updated texture again without duplicating its other owners', () => {
    const gl = uploader(); const map = new THREE.Texture();
    const stopA = queuePlanetTextures(gl, [map]).cancel;
    runIdle();
    map.needsUpdate = true;
    const stopB = queuePlanetTextures(gl, [map]).cancel;
    runIdle();
    expect(gl.initTexture).toHaveBeenCalledTimes(2);
    stopA(); stopB();
  });

  it('cancels the pending callback when its last owner leaves, including repeated cleanup', () => {
    const gl = uploader();
    const stop = queuePlanetTextures(gl, [new THREE.Texture()]).cancel;
    stop(); stop();
    expect(idle.size).toBe(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(gl.initTexture).not.toHaveBeenCalled();
  });

  it('waits for an idle budget instead of forcing an upload while the browser is busy', () => {
    const gl = uploader();
    const stop = queuePlanetTextures(gl, [new THREE.Texture()]).cancel;
    runIdle(0);
    expect(gl.initTexture).not.toHaveBeenCalled();
    expect(idle.size).toBe(1);
    runIdle(20);
    expect(gl.initTexture).toHaveBeenCalledOnce();
    stop();
  });

  it('uses a cancellable timer fallback, still one upload at a time', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('cancelIdleCallback', undefined);
    const gl = uploader();
    const stop = queuePlanetTextures(gl, [new THREE.Texture(), new THREE.Texture()]).cancel;
    vi.runOnlyPendingTimers();
    expect(gl.initTexture).toHaveBeenCalledOnce();
    stop();
    vi.runOnlyPendingTimers();
    expect(gl.initTexture).toHaveBeenCalledOnce();
  });

  it('continues preparing the next map when one upload fails', () => {
    const gl = uploader(); const bad = new THREE.Texture(); const good = new THREE.Texture();
    gl.initTexture.mockImplementation(map => { if (map === bad) throw new Error('Context unavailable'); });
    const stop = queuePlanetTextures(gl, [bad, good]).cancel;
    expect(() => { runIdle(); }).not.toThrow();
    expect(() => { runIdle(); }).not.toThrow();
    expect(gl.initTexture).toHaveBeenLastCalledWith(good);
    expect(idle.size).toBe(0);
    stop();
  });

  it('pauses on context loss, re-prepares live maps after restoration and removes listeners on cleanup', () => {
    const gl = uploader(); const map = new THREE.Texture(); const waiting = new THREE.Texture();
    const stop = queuePlanetTextures(gl, [map, waiting]).cancel;
    runIdle();
    expect(idle.size).toBe(1);
    gl.domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(idle.size).toBe(0);
    expect(cancel).toHaveBeenCalledOnce();
    const added = new THREE.Texture();
    const stopAdded = queuePlanetTextures(gl, [added]).cancel;
    expect(idle.size).toBe(0);
    expect(gl.initTexture).toHaveBeenCalledTimes(1);
    gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    runIdle(); runIdle(); runIdle();
    expect(gl.initTexture.mock.calls).toEqual([[map], [map], [waiting], [added]]);
    stop(); stopAdded();
    gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    expect(idle.size).toBe(0);
  });

  it('does not schedule or retain listeners for an empty request', () => {
    const gl = uploader(); const listen = vi.spyOn(gl.domElement, 'addEventListener');
    queuePlanetTextures(gl, []).cancel();
    expect(idle.size).toBe(0);
    expect(listen).not.toHaveBeenCalled();
  });
});


describe('explicit texture completion', () => {
  it('resolves only after every unique texture is submitted', async () => {
    const gl = uploader(); const a = new THREE.Texture(); const b = new THREE.Texture();
    const task = queuePlanetTextures(gl, [a, a, b]);
    const done = vi.fn(); void task.ready.then(done);
    runIdle(); await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    runIdle(); await expect(task.ready).resolves.toBe('ready');
    expect(gl.initTexture.mock.calls).toEqual([[a], [b]]);
    task.cancel();
  });
  it('returns failure without an unhandled rejection and completes the other maps', async () => {
    const gl = uploader(); const bad = new THREE.Texture(); const good = new THREE.Texture();
    gl.initTexture.mockImplementation(map => { if (map === bad) throw new Error('upload failed'); });
    const task = queuePlanetTextures(gl, [bad, good]);
    runIdle(); runIdle();
    await expect(task.ready).resolves.toBe('failed');
    expect(gl.initTexture).toHaveBeenLastCalledWith(good);
    task.cancel();
  });
  it('settles cancelled owners independently of a shared owner', async () => {
    const gl = uploader(); const map = new THREE.Texture();
    const a = queuePlanetTextures(gl, [map]); const b = queuePlanetTextures(gl, [map]);
    a.cancel(); a.cancel();
    await expect(a.ready).resolves.toBe('cancelled');
    runIdle(); await expect(b.ready).resolves.toBe('ready'); b.cancel();
  });
  it('reports context loss, rather than claiming that the lost upload completed', async () => {
    const gl = uploader(); const map = new THREE.Texture();
    const task = queuePlanetTextures(gl, [map]);
    gl.domElement.dispatchEvent(new Event('webglcontextlost'));
    await expect(task.ready).resolves.toBe('context-lost');
    gl.domElement.dispatchEvent(new Event('webglcontextrestored'));
    runIdle(); expect(gl.initTexture).toHaveBeenCalledOnce(); task.cancel();
  });
  it('progresses one texture per timer under the cover without waiting for idle time', async () => {
    const gl = uploader(); let covered = true;
    const task = queuePlanetTextures(gl, [new THREE.Texture(), new THREE.Texture()], () => covered);
    expect(idle.size).toBe(0);
    vi.advanceTimersByTime(16);
    expect(gl.initTexture).toHaveBeenCalledOnce();
    covered = false;
    vi.advanceTimersByTime(16);
    expect(gl.initTexture).toHaveBeenCalledOnce();
    expect(idle.size).toBe(1);
    runIdle(); await expect(task.ready).resolves.toBe('ready'); task.cancel();
  });
  it('promotes an already idle-scheduled shared texture when a covered owner needs it', async () => {
    const gl = uploader(); const map = new THREE.Texture();
    const normal = queuePlanetTextures(gl, [map]);
    expect(idle.size).toBe(1);
    const opening = queuePlanetTextures(gl, [map], () => true);
    expect(idle.size).toBe(0);
    vi.advanceTimersByTime(16);
    await expect(opening.ready).resolves.toBe('ready');
    await expect(normal.ready).resolves.toBe('ready');
    normal.cancel(); opening.cancel();
  });
  it('does not report a texture ready if its version changes during upload', async () => {
    const gl = uploader(); const map = new THREE.Texture();
    gl.initTexture.mockImplementationOnce(texture => { texture.needsUpdate = true; });
    const task = queuePlanetTextures(gl, [map]); const done = vi.fn(); void task.ready.then(done);
    runIdle(); await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    runIdle(); await expect(task.ready).resolves.toBe('ready'); task.cancel();
  });
});
