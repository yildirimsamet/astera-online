import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { addPlanetImpact } from '../src/galaxy/planetImpactMaterial.js';

/*
  Owner, 2026-11-12: a thin dashed red line ran pole to pole over an EMP-struck world. The fissure
  mask is wrapped by longitude, which jumps from +180° to −180° on one meridian; the GPU read that
  jump as the whole mask passing in one pixel and sampled its blurriest level — the mask's average
  red — along the seam, one 2×2 block at a time.
*/

function fakeCanvas(): void {
  const context = new Proxy({}, { get: () => () => undefined, set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
  vi.stubGlobal('Path2D', class { moveTo = vi.fn(); lineTo = vi.fn(); });
}

function compiledFragment(level: number): string {
  fakeCanvas();
  const material = new THREE.MeshStandardMaterial();
  addPlanetImpact(material, level, { value: 0 });
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader.fragmentShader;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('planet impact mask seam', () => {
  it('reads the mask with explicit gradients, never the implicit ones that jump on the seam', () => {
    const fragment = compiledFragment(2);
    expect(fragment).toMatch(/textureGrad\(\s*uPlanetImpactMask/);
    expect(fragment).not.toMatch(/texture2D\(\s*uPlanetImpactMask/);
  });

  it('folds the longitude jump out of the gradient', () => {
    const fragment = compiledFragment(3);
    // A whole turn across one pixel is the seam, not detail: subtract the nearest whole number.
    expect(fragment).toMatch(/dFdx\(impactUv\)/);
    expect(fragment).toMatch(/dFdy\(impactUv\)/);
    expect(fragment).toMatch(/floor\(impactDx\.x \+ 0\.5\)/);
    expect(fragment).toMatch(/floor\(impactDy\.x \+ 0\.5\)/);
  });

  it('cached programs from before the fix are not reused', () => {
    fakeCanvas();
    const material = new THREE.MeshStandardMaterial();
    addPlanetImpact(material, 1, { value: 0 });
    expect(material.customProgramCacheKey()).toContain('planet-impact-uv-v4');
  });
});
