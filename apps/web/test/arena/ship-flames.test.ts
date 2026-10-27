// @vitest-environment node
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShipFlames } from '../../src/arena/render/flames.js';
import { ENGINE_FLAME_VARIANTS } from '../../src/vfx/engineFlames.js';

/**
 * Owner 2026-10-21: the arena's engines burn the studio's own exhaust (src/vfx/engineFlames.ts).
 * Cruise is Cryo (blue-white), turbo is Solar (white-yellow throat, orange tail): the colour a
 * pilot already reads as "he is boosting" stays, now as a volume. One draw per ship.
 */
const NOZZLES = [new THREE.Vector3(1, 0, -5), new THREE.Vector3(-1, 0, -5)];
const flames = () => new ShipFlames(new THREE.DataTexture(), NOZZLES, 0.5, 20, 'mobile', 3);
const attribute = (subject: ShipFlames, name: string) => subject.mesh.geometry.getAttribute(name);
const style = (subject: ShipFlames, index: number) => ENGINE_FLAME_VARIANTS[attribute(subject, 'aFlame').getX(index)];
const throttle = (subject: ShipFlames, index: number) => attribute(subject, 'aFlame').getY(index);
const reach = (subject: ShipFlames, index: number) => attribute(subject, 'aDimensions').getY(index);

describe('a ship\'s engine flames', () => {
  it('give every nozzle a Cryo cruise flame and a Solar turbo flame, both sitting on the nozzle', () => {
    const subject = flames();
    subject.update(1, 1, 0);
    expect([0, 1].map(i => style(subject, i))).toEqual(['cryo', 'cryo']);
    expect([2, 3].map(i => style(subject, i))).toEqual(['solar', 'solar']);
    const matrix = new THREE.Matrix4();
    for (const [i, nozzle] of [[0, NOZZLES[0]], [2, NOZZLES[0]], [1, NOZZLES[1]], [3, NOZZLES[1]]] as const) {
      subject.mesh.getMatrixAt(i, matrix);
      expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual(nozzle?.toArray());
    }
  });

  it('burn Cryo with the lever in cruise and leave the Solar flames undrawn', () => {
    const subject = flames();
    subject.update(0.5, 0, 0);
    expect(throttle(subject, 0)).toBeCloseTo(0.5, 5);
    expect(throttle(subject, 1)).toBeCloseTo(0.5, 5);
    expect(subject.mesh.count).toBe(2);
  });

  it('hand the whole burn to Solar on turbo, whatever the lever, and reach further', () => {
    const subject = flames();
    subject.update(0.3, 1, 0);
    expect(throttle(subject, 0)).toBe(0);
    expect(throttle(subject, 2)).toBe(1);
    expect(subject.mesh.count).toBe(4);
    expect(reach(subject, 2)).toBeGreaterThan(reach(subject, 0));
  });

  it('cross-fade the two while turbo lights or dies, so the colour never jumps', () => {
    const subject = flames();
    subject.update(1, 0.25, 0);
    expect(throttle(subject, 0)).toBeCloseTo(0.75, 5);
    expect(throttle(subject, 2)).toBeCloseTo(0.25, 5);
  });

  it('run on the arena clock', () => {
    const subject = flames();
    subject.update(1, 0, 12.5);
    expect(subject.mesh.material.uniforms.uTime?.value).toBe(12.5);
  });

  it('free their own batch and leave the shared noise map to its owner', () => {
    const noise = new THREE.DataTexture();
    let noiseFreed = false; let materialFreed = false;
    noise.addEventListener('dispose', () => { noiseFreed = true; });
    const subject = new ShipFlames(noise, NOZZLES, 0.5, 20, 'mobile', 3);
    subject.mesh.material.addEventListener('dispose', () => { materialFreed = true; });
    subject.dispose();
    expect(materialFreed).toBe(true);
    expect(noiseFreed).toBe(false);
  });
});
