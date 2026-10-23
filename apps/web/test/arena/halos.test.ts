import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBillboards, createHalos } from '../../src/arena/render/halos.js';

/**
 * Perf study 2026-10-22: the ~340 farm glows were one Sprite (and one material, and one draw
 * call) each. They are one instanced billboard now: same texture, colour, world size, additive
 * glow fading to nothing in fog — one draw.
 */
describe('farm glows', () => {
  const halos = createHalos(new THREE.Texture(), [
    { p: { x: 10, y: 20, z: 30 }, color: '#ff8800', size: 50 },
    { p: { x: -5, y: 0, z: 7 }, color: '#00ccff', size: 12 },
  ]);

  it('draws every glow in one instanced mesh, additive, never culled as a whole', () => {
    expect(halos.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(halos.mesh.count).toBe(2);
    expect(halos.mesh.frustumCulled).toBe(false);
    const m = halos.mesh.material;
    expect(m.blending).toBe(THREE.AdditiveBlending);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.toneMapped).toBe(false);
  });

  it('keeps each glow where, how big and what colour it was', () => {
    const at = new THREE.Matrix4(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    halos.mesh.getMatrixAt(0, at); at.decompose(p, q, s);
    expect(p.toArray()).toEqual([10, 20, 30]);
    expect(s.x).toBeCloseTo(50);
    const color = new THREE.Color(); halos.mesh.getColorAt(1, color);
    expect(color.getHexString()).toBe(new THREE.Color('#00ccff').getHexString());
  });

  it('sets each glow\'s strength per frame, and fades to black in fog', () => {
    halos.setOpacity(1, 0.4);
    const strength = halos.mesh.geometry.getAttribute('strength');
    expect(strength.getX(1)).toBeCloseTo(0.4);
    halos.setFog(0.002);
    expect(halos.mesh.material.uniforms.fogDensity?.value).toBe(0.002);
    expect(halos.mesh.material.fragmentShader).not.toContain('fogColor');
  });
});

/** The belt nebulae and the dust clouds: the same one-draw billboards, each its own blending and fog. */
describe('cloud billboards', () => {
  const entries = [{ p: { x: 0, y: 0, z: 0 }, color: '#a88d68', size: 300, turn: 1.2 }, { p: { x: 9, y: 0, z: 0 }, color: '#a88d68', size: 400, turn: 0.3 }];

  it('draws dust as one normal-blended mesh, mixing into the fog colour like a sprite', () => {
    const dust = createBillboards(new THREE.Texture(), entries, { blending: THREE.NormalBlending, fog: 'mix' });
    expect(dust.mesh.count).toBe(2);
    expect(dust.mesh.material.blending).toBe(THREE.NormalBlending);
    expect(dust.mesh.material.fragmentShader).toContain('fogColor');
    expect(dust.mesh.geometry.getAttribute('turn').getX(0)).toBeCloseTo(1.2);
    dust.setFog(0.003, new THREE.Color('#1c160f'));
    expect(dust.mesh.material.uniforms.fogDensity?.value).toBe(0.003);
  });

  it('draws nebula haze additive and unfogged, turning slowly as one', () => {
    const haze = createBillboards(new THREE.Texture(), entries, { blending: THREE.AdditiveBlending, fog: 'none' });
    expect(haze.mesh.material.fragmentShader).not.toContain('fogColor');
    haze.setSpin(0.5);
    expect(haze.mesh.material.uniforms.spin?.value).toBe(0.5);
  });

  it('collapses a billboard faded to nothing, so a cloud around the lens costs no fill', () => {
    const haze = createBillboards(new THREE.Texture(), entries, { blending: THREE.AdditiveBlending, fog: 'none' });
    expect(haze.mesh.material.vertexShader).toMatch(/if \(strength < [0-9.]+\) \{ gl_Position = vec4\(0\.0, 0\.0, 2\.0, 1\.0\); return; \}/);
  });

  it('places a cloud relative to its mesh, so the cloud sorts against other glass by its centre', () => {
    const dust = createBillboards(new THREE.Texture(), entries, { blending: THREE.NormalBlending, fog: 'mix', centre: { x: 100, y: 0, z: 0 } });
    expect(dust.mesh.position.x).toBe(100);
    const at = new THREE.Matrix4(); dust.mesh.getMatrixAt(1, at);
    expect(new THREE.Vector3().setFromMatrixPosition(at).x).toBe(-91);
  });
});
