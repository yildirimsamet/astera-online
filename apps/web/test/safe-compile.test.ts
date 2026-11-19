import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileWhileLive, guardCompileAsync } from '../src/galaxy/safeCompile.js';

/*
  Sentry WEB-2 (2026-11-19, live d637eabf, Android): a phone sent to the background lost the WebGL
  context while three's `compileAsync` was still polling. On restore three builds a fresh
  `properties` table, the pending poll looked its materials up in it, found no program, and threw
  "Cannot read properties of undefined (reading 'isReady')" from a bare setTimeout.
*/
interface Program { isReady: () => boolean }
let lost = false;
let table: Map<object, { currentProgram?: Program }>;
let compiled: Set<THREE.Material>;
const compile = vi.fn(() => new Set(compiled));
const gl = {
  getContext: () => ({ isContextLost: () => lost }),
  properties: { get: (object: unknown) => (typeof object === 'object' && object !== null ? table.get(object) ?? {} : {}) },
  compile,
};
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

beforeEach(() => {
  vi.useFakeTimers();
  compile.mockClear();
  lost = false;
  table = new Map();
  compiled = new Set();
});
afterEach(() => { vi.useRealTimers(); });

function material(ready: () => boolean): THREE.Material {
  const made = new THREE.MeshBasicMaterial();
  table.set(made, { currentProgram: { isReady: ready } });
  compiled.add(made);
  return made;
}

describe('shader warmup survives a lost GPU', () => {
  it('resolves with the scene once every program reports ready', async () => {
    let ready = false;
    material(() => ready);
    const done = vi.fn();
    void compileWhileLive(gl, scene, camera, null).then(done);
    expect(compile).toHaveBeenCalledWith(scene, camera, null);
    await vi.advanceTimersByTimeAsync(50);
    expect(done).not.toHaveBeenCalled();
    ready = true;
    await vi.advanceTimersByTimeAsync(20);
    expect(done).toHaveBeenCalledWith(scene);
  });

  it('rejects without compiling when the context is already gone', async () => {
    lost = true;
    await expect(compileWhileLive(gl, scene, camera, null)).rejects.toThrow(/context lost/u);
    expect(compile).not.toHaveBeenCalled();
  });

  it('stops polling and rejects when the context is lost mid-compile', async () => {
    const isReady = vi.fn(() => false);
    material(isReady);
    const result = compileWhileLive(gl, scene, camera, null);
    const settled = expect(result).rejects.toThrow(/context lost/u);
    await vi.advanceTimersByTimeAsync(30);
    lost = true;
    await vi.advanceTimersByTimeAsync(20);
    await settled;
    const calls = isReady.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(isReady).toHaveBeenCalledTimes(calls);
  });

  it('does not throw when a restore between polls left a material without a program (WEB-2)', async () => {
    const pending = material(() => false);
    const result = compileWhileLive(gl, scene, camera, null);
    await vi.advanceTimersByTimeAsync(20);
    table.set(pending, {});
    await vi.advanceTimersByTimeAsync(20);
    await expect(result).resolves.toBe(scene);
  });

  it('replaces the renderer’s own compileAsync so every caller gets the guard', async () => {
    const renderer = { ...gl, compileAsync: vi.fn() };
    guardCompileAsync(renderer);
    lost = true;
    await expect(renderer.compileAsync(scene, camera)).rejects.toThrow(/context lost/u);
  });
});
