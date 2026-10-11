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
    const stop = queuePlanetTextures(gl, maps);
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
    const stopA = queuePlanetTextures(gl, [shared, abandoned]);
    const stopB = queuePlanetTextures(gl, [shared, kept]);
    expect(idle.size).toBe(1);
    stopA();
    runIdle(); runIdle();
    expect(gl.initTexture.mock.calls).toEqual([[shared], [kept]]);
    const stopC = queuePlanetTextures(gl, [shared]);
    expect(idle.size).toBe(0);
    stopC(); stopB();
  });

  it('prepares the same texture independently for two renderers', () => {
    const a = uploader(); const b = uploader(); const map = new THREE.Texture();
    const stopA = queuePlanetTextures(a, [map]);
    const stopB = queuePlanetTextures(b, [map]);
    runIdle(); runIdle();
    expect(a.initTexture).toHaveBeenCalledWith(map);
    expect(b.initTexture).toHaveBeenCalledWith(map);
    stopA(); stopB();
  });

  it('prepares an updated texture again without duplicating its other owners', () => {
    const gl = uploader(); const map = new THREE.Texture();
    const stopA = queuePlanetTextures(gl, [map]);
    runIdle();
    map.needsUpdate = true;
    const stopB = queuePlanetTextures(gl, [map]);
    runIdle();
    expect(gl.initTexture).toHaveBeenCalledTimes(2);
    stopA(); stopB();
  });

  it('cancels the pending callback when its last owner leaves, including repeated cleanup', () => {
    const gl = uploader();
    const stop = queuePlanetTextures(gl, [new THREE.Texture()]);
    stop(); stop();
    expect(idle.size).toBe(0);
    expect(cancel).toHaveBeenCalledOnce();
    expect(gl.initTexture).not.toHaveBeenCalled();
  });

  it('waits for an idle budget instead of forcing an upload while the browser is busy', () => {
    const gl = uploader();
    const stop = queuePlanetTextures(gl, [new THREE.Texture()]);
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
    const stop = queuePlanetTextures(gl, [new THREE.Texture(), new THREE.Texture()]);
    vi.runOnlyPendingTimers();
    expect(gl.initTexture).toHaveBeenCalledOnce();
    stop();
    vi.runOnlyPendingTimers();
    expect(gl.initTexture).toHaveBeenCalledOnce();
  });

  it('continues preparing the next map when one upload fails', () => {
    const gl = uploader(); const bad = new THREE.Texture(); const good = new THREE.Texture();
    gl.initTexture.mockImplementation(map => { if (map === bad) throw new Error('Context unavailable'); });
    const stop = queuePlanetTextures(gl, [bad, good]);
    expect(() => runIdle()).not.toThrow();
    expect(() => runIdle()).not.toThrow();
    expect(gl.initTexture).toHaveBeenLastCalledWith(good);
    expect(idle.size).toBe(0);
    stop();
  });

  it('pauses on context loss, re-prepares live maps after restoration and removes listeners on cleanup', () => {
    const gl = uploader(); const map = new THREE.Texture(); const waiting = new THREE.Texture();
    const stop = queuePlanetTextures(gl, [map, waiting]);
    runIdle();
    expect(idle.size).toBe(1);
    gl.domElement.dispatchEvent(new Event('webglcontextlost'));
    expect(idle.size).toBe(0);
    expect(cancel).toHaveBeenCalledOnce();
    const added = new THREE.Texture();
    const stopAdded = queuePlanetTextures(gl, [added]);
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
    queuePlanetTextures(gl, [])();
    expect(idle.size).toBe(0);
    expect(listen).not.toHaveBeenCalled();
  });
});
