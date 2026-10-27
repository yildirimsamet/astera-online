// @vitest-environment node
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShipCrowd, TRAIL_AGE, TRAIL_POINTS, TRAIL_WIDTH } from '../../src/arena/render/crowd.js';
import { Effects } from '../../src/arena/render/effects.js';
import { proceduralShip } from '../../src/arena/render/procedural.js';
import { LIGHTS_RANGE, PLUME_RANGE, ShipVisual, type ShipPose } from '../../src/arena/render/ships.js';

/**
 * S22, 2026-10-23, 36–43 ships in view (docs/komutan-gemisi/18-kademeli-gorunurluk-plani.md):
 * ~220 draws a frame, 90 % of the main thread. Every trail drew and re-uploaded its ribbon
 * every frame, on screen or not; skipping the trails alone was 39.6 → 46.6 fps. A ship now drops
 * what a phone cannot show at its distance — nav lights past LIGHTS_RANGE, flames and trails
 * past PLUME_RANGE — a trail off screen is neither drawn nor uploaded, and every trail drawn
 * shares one draw. Its history keeps flowing while hidden, so it reappears whole.
 */
const LENGTH = 15;
const pose = (z: number): ShipPose => ({
  position: new THREE.Vector3(0, 0, z), quaternion: new THREE.Quaternion(), throttle: 1, speed: 80, turbo: false,
  omegaYaw: 0, omegaPitch: 0, landed: false, mining: false, shield: 0, cloak: 0, hull: 300, hullMax: 300, visible: true, hitAt: -10,
  normal: new THREE.Vector3(0, 1, 0), ward: 0, mend: false, hologram: false,
});
const setup = () => {
  const scene = new THREE.Scene();
  const model = proceduralShip();
  const crowd = new ShipCrowd(scene, undefined, [model], 50, { noise: new THREE.DataTexture(), quality: 'mobile' });
  const ship = new ShipVisual(model, new Map(), LENGTH, false, scene, new Effects(scene, new Map()), { noise: new THREE.DataTexture(), quality: 'mobile' }, crowd);
  const camera = new THREE.PerspectiveCamera(60, 0.5, 1, 6000);
  const batch = (): THREE.Mesh => {
    const found = scene.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'astera-ship-trails');
    if (!found) throw new Error('no trail batch');
    return found;
  };
  const trails = (): number => batch().geometry.drawRange.count / ((TRAIL_POINTS - 1) * 6);
  const glows = (): number => { const p = scene.children.find((c): c is THREE.Points => c instanceof THREE.Points); return p?.geometry.drawRange.count ?? -1; };
  const hulls = (): number => scene.children.find((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.name !== 'astera-engine-flames')?.count ?? -1;
  let time = 0;
  /** Flies the ship along +z for `frames` frames, the camera at the origin looking at `look`. */
  const fly = (from: number, frames: number, look: THREE.Vector3): void => {
    camera.position.set(0, 0, 0); camera.lookAt(look); camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (let i = 0; i < frames; i++) {
      time += 1 / 60;
      crowd.begin();
      ship.update(pose(from + i * 80 / 60), time, 1 / 60);
      crowd.end(camera, 1170);
      ship.view(camera.position, frustum, 1 / 60);
    }
  };
  const flames = (): number => scene.children.find((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.name === 'astera-engine-flames')?.count ?? -1;
  return { ship, model, batch, trails, glows, hulls, flames, fly, ahead: new THREE.Vector3(0, 0, 1), behind: new THREE.Vector3(0, 0, -1) };
};

describe('a ship shows what a phone can see at its distance', () => {
  it('keeps everything close by: lights, flames and trails', () => {
    const { model, trails, glows, flames, fly, ahead } = setup();
    fly(300, 4, ahead);
    expect(trails()).toBe(model.engines.length);
    // Both wingtip lights always; the tail strobe only while it flashes.
    expect(glows()).toBeGreaterThanOrEqual(model.engines.length + 2);
    expect(flames()).toBe(model.engines.length);
  });

  it('drops the nav lights past LIGHTS_RANGE, then flames and trails past PLUME_RANGE', () => {
    const { model, trails, glows, hulls, flames, fly, ahead } = setup();
    expect(LIGHTS_RANGE).toBeLessThan(PLUME_RANGE);
    fly(LIGHTS_RANGE + 50, 4, ahead);
    expect(glows()).toBe(model.engines.length);
    expect(trails()).toBe(model.engines.length);
    expect(flames()).toBe(model.engines.length);
    fly(PLUME_RANGE + 50, 4, ahead);
    expect(trails()).toBe(0);
    expect(flames()).toBe(0);
    // The hull and its engine glow stay: a far ship is still a ship.
    expect(hulls()).toBe(1);
    expect(glows()).toBe(model.engines.length);
  });

  it('neither draws nor uploads a trail off screen', () => {
    const { batch, trails, fly, behind } = setup();
    fly(300, 4, behind);
    expect(trails()).toBe(0);
    const version = (): number => { const a = batch().geometry.getAttribute('position'); return a instanceof THREE.BufferAttribute ? a.version : -1; };
    const before = version();
    fly(306, 10, behind);
    expect(version()).toBe(before);
  });

  it('brings a trail back whole: its history kept flowing while it was hidden', () => {
    const { batch, trails, fly, ahead, behind } = setup();
    fly(300, 30, behind);
    // A ship draws from the camera of the frame before (the client moves the camera after the ships): one frame late.
    fly(340, 2, ahead);
    expect(trails()).toBeGreaterThan(0);
    const position = batch().geometry.getAttribute('position');
    // Half a second of history: the ribbon's tail lies metres behind its head, not on it.
    expect(Math.abs(position.getZ(0) - position.getZ(2 * (TRAIL_POINTS - 2)))).toBeGreaterThan(20);
  });

  // Owner 2026-10-27: a ship 700–800 m out was too hard to pick out; its trail is 30 % longer and
  // 30 % wider (0.55 s and 0.8 × the nozzle before), sampled no coarser than before.
  it('leaves a trail 30 % longer and 30 % wider than before, as finely sampled', () => {
    expect(TRAIL_AGE).toBeCloseTo(0.55 * 1.3, 6);
    expect(TRAIL_WIDTH).toBeCloseTo(0.8 * 1.3, 6);
    expect(TRAIL_AGE / TRAIL_POINTS).toBeLessThanOrEqual(0.55 / 24 + 1e-9);
  });
});
