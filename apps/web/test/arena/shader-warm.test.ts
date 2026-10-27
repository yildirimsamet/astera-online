import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { compileFor } from '../../src/arena/render/post.js';

/**
 * S22 profile 2026-10-23: ten programs still compiled mid-fight (one 130 ms) after the
 * loading-screen warm-up. The warm-up compiled for the screen, but the scene is drawn into the
 * composer's half-float target: a different tone-mapping/colour-space program key, so every
 * object not on screen in the first frame compiled again the first time it came into view.
 */
describe('shader warm-up', () => {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera();
  const target = new THREE.WebGLRenderTarget(4, 4);

  it('compiles while the scene’s real render target is bound, then restores the previous one', async () => {
    let bound: THREE.WebGLRenderTarget | null = null; let boundAtCompile: THREE.WebGLRenderTarget | null = null;
    const renderer = {
      getRenderTarget: () => bound,
      setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { bound = next; },
      compileAsync: vi.fn(() => { boundAtCompile = bound; return Promise.resolve(scene); }),
    };
    await compileFor(renderer, target, scene, camera);
    expect(renderer.compileAsync).toHaveBeenCalledWith(scene, camera);
    expect(boundAtCompile).toBe(target);
    expect(bound).toBeNull();
  });

  it('restores the previous target when compiling fails', async () => {
    let bound: THREE.WebGLRenderTarget | null = null;
    const renderer = {
      getRenderTarget: () => bound,
      setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { bound = next; },
      compileAsync: () => Promise.reject(new Error('lost')),
    };
    await expect(compileFor(renderer, target, scene, camera)).rejects.toThrow('lost');
    expect(bound).toBeNull();
  });
});
