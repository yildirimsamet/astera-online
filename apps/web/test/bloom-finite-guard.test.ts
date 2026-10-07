import { readFileSync } from 'node:fs';
import { BloomEffect } from 'postprocessing';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FINITE_SAMPLE, guardBloomInput, LUMINANCE_SAMPLE } from '../src/galaxy/finiteGuard.js';

/**
 * BLACK RECTANGLES ON THE GALAXY. Owner report, 2026-10-06: "ekranın bir kısmına siyah
 * kare/dikdörtgen alanlar çıkıyor — sanki ekran kırılmış ve o bölge ölmüş gibi."
 *
 * The scene renders into a half-float target and Bloom's mipmap blur downsamples it six
 * times. One NaN or Inf pixel — a `pow` of a negative, a `sqrt` of a rounding error below
 * zero, an overflow past 65,504 — is averaged into every texel of every level above it,
 * and the composite adds the blur back: a square of black the size of a mip block, where
 * the bad pixel happens to be this frame. `meteor.ts` already met this once.
 *
 * The guard is a firewall at the one door the blur has: the luminance pass. A pixel that is
 * not finite enters the mip chain as nothing, so no single bad pixel can become a block.
 */

describe('the bloom input guard', () => {
  it('finds the luminance sample in the shipped postprocessing build', () => {
    const bloom = new BloomEffect({ luminanceThreshold: 0.78, mipmapBlur: true });
    expect(bloom.luminanceMaterial.fragmentShader).toContain(LUMINANCE_SAMPLE);
  });

  it('sends nothing that is not finite into the mip chain', () => {
    const bloom = new BloomEffect({ luminanceThreshold: 0.78, mipmapBlur: true });
    expect(guardBloomInput(bloom)).toBe(true);
    const shader = bloom.luminanceMaterial.fragmentShader;
    expect(shader).toContain(FINITE_SAMPLE);
    expect(shader).not.toContain(LUMINANCE_SAMPLE);
    // The helper is declared before `main` reads it.
    expect(shader.indexOf('vec4 asteraFinite(')).toBeLessThan(shader.indexOf('void main('));
    expect(shader).toMatch(/all\(lessThan\(abs\(c\),vec4\(6\.0e4\)\)\)/);
  });

  it('patches once, however often the ref is called', () => {
    const bloom = new BloomEffect({ luminanceThreshold: 0.78 });
    guardBloomInput(bloom);
    const once = bloom.luminanceMaterial.fragmentShader;
    expect(guardBloomInput(bloom)).toBe(true);
    expect(bloom.luminanceMaterial.fragmentShader).toBe(once);
  });

  it('leaves a shader it does not recognise alone, rather than breaking it', () => {
    const material = new THREE.ShaderMaterial({ fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}' });
    expect(guardBloomInput({ luminanceMaterial: material })).toBe(false);
    expect(material.fragmentShader).toBe('void main(){gl_FragColor=vec4(1.0);}');
  });

  it('guards every bloom the game mounts', () => {
    for (const file of ['src/galaxy/GalaxyCanvas.tsx', 'src/landing/LandingScene.tsx']) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toMatch(/<Bloom\s+ref=\{guardBloomRef\}/);
    }
  });
});

/**
 * AND THE SHADERS THAT COULD MAKE ONE. GLSL leaves `pow(x, y)` undefined for x < 0, `sqrt`
 * for x < 0 and `atan(0, 0)` everywhere — ANGLE on D3D and most phone GPUs answer NaN.
 */
describe('the shaders that could feed it a NaN', () => {
  const sky = readFileSync('src/galaxy/sky.ts', 'utf8');
  const rings = readFileSync('src/galaxy/SensorRings.tsx', 'utf8');
  const satellites = readFileSync('src/galaxy/Satellites.tsx', 'utf8');

  it('never raises a signed value to a power', () => {
    expect(sky).not.toMatch(/exp\(-pow\(/);
    expect(sky).not.toMatch(/pow\(0\.5 \+ 0\.5 \* cos/);
    expect(rings).not.toMatch(/pow\(1\.0 - facing/);
    expect(satellites).not.toMatch(/pow\(1\.0 - abs\(dot/);
  });

  it('never takes the root of a value rounding can push below zero', () => {
    expect(sky).not.toMatch(/sqrt\(reach\(/);
  });

  it('never asks atan for the angle of the origin', () => {
    expect(rings).not.toMatch(/= atan\(p\.z, p\.x\)/);
    expect(satellites).not.toMatch(/= atan\(n\.z, n\.x\)/);
  });
});
