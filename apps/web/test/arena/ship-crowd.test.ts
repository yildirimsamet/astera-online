// @vitest-environment node
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CROWD_BAND, CROWD_RANGE, ShipCrowd } from '../../src/arena/render/crowd.js';
import { Effects } from '../../src/arena/render/effects.js';
import { proceduralShip } from '../../src/arena/render/procedural.js';
import { LIGHTS_RANGE, ShipVisual, type ShipPose } from '../../src/arena/render/ships.js';

/**
 * S22, 2026-10-23, 36 ships in view: drawing the ships past 800 m not at all took the fight
 * from 38.6 to 43.4 fps. Past CROWD_RANGE a phone sees the farthest hull level and the engine
 * glow and nothing else, so those ships are drawn together: one instanced draw per hull part of
 * each model, one point draw for every engine. A ship that is flashing from a hit, shielded or
 * cloaked keeps its own visual, so what a pilot reads about it never changes with the distance.
 */
const LENGTH = 15;
const pose = (z: number, patch: Partial<ShipPose> = {}): ShipPose => ({
  position: new THREE.Vector3(0, 0, z), quaternion: new THREE.Quaternion(), throttle: 1, speed: 80, turbo: false,
  omegaYaw: 0.8, omegaPitch: 0, landed: false, mining: false, shield: 0, cloak: 0, hull: 300, hullMax: 300, visible: true, hitAt: -10,
  normal: new THREE.Vector3(0, 1, 0), ward: 0, mend: false, hologram: false, ...patch,
});
const setup = (registered = true) => {
  const scene = new THREE.Scene();
  const model = proceduralShip();
  const crowd = new ShipCrowd(scene, undefined, registered ? [model] : [], 50, { noise: new THREE.DataTexture(), quality: 'mobile' });
  const make = (): ShipVisual => new ShipVisual(model, new Map(), LENGTH, false, scene, new Effects(scene, new Map()), { noise: new THREE.DataTexture(), quality: 'mobile' }, crowd);
  const camera = new THREE.PerspectiveCamera(60, 0.5, 1, 6000);
  camera.position.set(0, 0, 0); camera.lookAt(0, 0, 1); camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let time = 0;
  /** One frame: every ship at its pose, then the crowd closes and each ship looks at the camera. */
  const frame = (ships: [ShipVisual, ShipPose][]): void => {
    time += 1 / 60;
    crowd.begin();
    for (const [ship, p] of ships) ship.update(p, time, 1 / 60);
    crowd.end(camera, 1170);
    for (const [ship] of ships) ship.view(camera.position, frustum, 1 / 60);
  };
  const hulls = (): THREE.InstancedMesh[] => scene.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
  const glows = (): THREE.Points => { const p = scene.children.find((c): c is THREE.Points => c instanceof THREE.Points); if (!p) throw new Error('no glow batch'); return p; };
  const flames = (): THREE.InstancedMesh => {
    const found = scene.children.find((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.name === 'astera-engine-flames');
    if (!found) throw new Error('no flame batch');
    return found;
  };
  return { model, crowd, make, frame, hulls: () => hulls().filter(h => h.name !== 'astera-engine-flames'), glows, flames };
};

describe('ships past CROWD_RANGE are drawn together', () => {
  it('draws a far ship in the crowd: its own hull hidden, its body and engines in the batches', () => {
    const { model, make, frame, hulls, glows } = setup();
    const ship = make();
    // Half a second into a turn: the bank has eased in.
    for (let i = 0; i < 30; i++) frame([[ship, pose(CROWD_RANGE + 200 + i)]]);
    expect(ship.group.visible).toBe(false);
    const parts = hulls();
    expect(parts).toHaveLength((model.lods?.at(-1) ?? model).parts.length);
    for (const part of parts) expect(part.count).toBe(1);
    // The instance sits where the ship's own body would: position, heading and the bank of its turn.
    const matrix = new THREE.Matrix4(); parts[0]?.getMatrixAt(0, matrix);
    const at = new THREE.Vector3(); const turn = new THREE.Quaternion(); const scale = new THREE.Vector3();
    matrix.decompose(at, turn, scale);
    expect(at.z).toBeCloseTo(CROWD_RANGE + 229, 3);
    expect(scale.x).toBeCloseTo(LENGTH, 3);
    expect(turn.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.3);
    expect(glows().geometry.drawRange.count).toBe(model.engines.length);
  });

  it('keeps a near ship\'s hull its own; its engine glows and nav lights go to the one point draw', () => {
    const { model, make, frame, hulls, glows } = setup();
    const ship = make();
    frame([[ship, pose(300)]]); frame([[ship, pose(301)]]);
    expect(ship.group.visible).toBe(true);
    for (const part of hulls()) expect(part.count).toBe(0);
    // S22 A/B, 2026-10-23: a sprite apiece was 28 draws and 4 fps in a 36-ship fight.
    let sprites = 0; ship.group.traverse(o => { if (o instanceof THREE.Sprite) sprites++; });
    expect(sprites).toBe(0);
    // Both wingtip lights always; the tail strobe only while it flashes.
    expect(glows().geometry.drawRange.count).toBeGreaterThanOrEqual(model.engines.length + 2);
  });

  it('drops the nav lights from the batch past LIGHTS_RANGE and while cloaked', () => {
    const { model, make, frame, glows } = setup();
    const ship = make();
    frame([[ship, pose(LIGHTS_RANGE + 40)]]); frame([[ship, pose(LIGHTS_RANGE + 40)]]);
    expect(glows().geometry.drawRange.count).toBe(model.engines.length);
    frame([[ship, pose(300, { cloak: 1 })]]); frame([[ship, pose(300, { cloak: 1 })]]);
    expect(glows().geometry.drawRange.count).toBe(0);
  });

  it(`holds a ship's way of drawing inside ±${String(CROWD_BAND)} m of the edge`, () => {
    const { make, frame } = setup();
    const ship = make();
    frame([[ship, pose(CROWD_RANGE - CROWD_BAND - 10)]]); frame([[ship, pose(CROWD_RANGE + CROWD_BAND / 2)]]); frame([[ship, pose(CROWD_RANGE + CROWD_BAND / 2)]]);
    expect(ship.group.visible).toBe(true);
    frame([[ship, pose(CROWD_RANGE + CROWD_BAND + 10)]]); frame([[ship, pose(CROWD_RANGE + CROWD_BAND + 10)]]);
    expect(ship.group.visible).toBe(false);
    frame([[ship, pose(CROWD_RANGE - CROWD_BAND / 2)]]); frame([[ship, pose(CROWD_RANGE - CROWD_BAND / 2)]]);
    expect(ship.group.visible).toBe(false);
    frame([[ship, pose(CROWD_RANGE - CROWD_BAND - 10)]]); frame([[ship, pose(CROWD_RANGE - CROWD_BAND - 10)]]);
    expect(ship.group.visible).toBe(true);
  });

  it('gives a far ship its own visual while a hit flashes it, and while it is shielded', () => {
    const { make, frame, hulls } = setup();
    const ship = make();
    const far = CROWD_RANGE + 200;
    frame([[ship, pose(far)]]); frame([[ship, pose(far)]]);
    expect(ship.group.visible).toBe(false);
    frame([[ship, pose(far, { hitAt: 5 })]]);
    expect(ship.group.visible).toBe(true);
    for (const part of hulls()) expect(part.count).toBe(0);
    for (let i = 0; i < 30; i++) frame([[ship, pose(far, { hitAt: 5 })]]);
    expect(ship.group.visible).toBe(false);
    frame([[ship, pose(far, { shield: 40 })]]);
    expect(ship.group.visible).toBe(true);
  });

  it('gives a far ship its own visual while a Muhafız shield or a repair is on it (Y4c): the crowd draws neither', () => {
    const { make, frame } = setup();
    const ship = make();
    const far = CROWD_RANGE + 200;
    frame([[ship, pose(far)]]); frame([[ship, pose(far)]]);
    expect(ship.group.visible).toBe(false);
    frame([[ship, pose(far, { ward: 0.5 })]]);
    expect(ship.group.visible).toBe(true);
    frame([[ship, pose(far)]]);
    expect(ship.group.visible).toBe(false);
    frame([[ship, pose(far, { mend: true })]]);
    expect(ship.group.visible).toBe(true);
  });

  it('draws the pilot\'s own illusion (Y4d) as a hologram in its own visual: the crowd never takes it', () => {
    const { make, frame } = setup();
    const ship = make();
    const far = CROWD_RANGE + 200;
    frame([[ship, pose(far, { hologram: true })]]); frame([[ship, pose(far, { hologram: true })]]);
    expect(ship.group.visible).toBe(true);
    const materials = new Set<string>(); ship.group.traverse(o => { if (o instanceof THREE.Mesh && o.visible && o.material instanceof THREE.Material) materials.add(o.material.name); });
    expect(materials.has('astera-hologram')).toBe(true);
    frame([[ship, pose(far)]]); frame([[ship, pose(far)]]);
    expect(ship.group.visible).toBe(false);
  });

  it('has room for a full room\'s glows and lights: fifty near ships, every engine and wingtip', () => {
    const { model, make, frame, glows } = setup();
    const fleet = Array.from({ length: 50 }, (_, i) => [make(), pose(100 + i * 10)] as [ShipVisual, ShipPose]);
    frame(fleet); frame(fleet);
    expect(glows().geometry.drawRange.count).toBeGreaterThanOrEqual(50 * (model.engines.length + 2));
  });

  it('counts each frame afresh: two far ships, then one', () => {
    const { make, frame, hulls, glows, model } = setup();
    const a = make(); const b = make();
    frame([[a, pose(1200)], [b, pose(1300)]]); frame([[a, pose(1200)], [b, pose(1300)]]);
    expect(hulls()[0]?.count).toBe(2);
    expect(glows().geometry.drawRange.count).toBe(2 * model.engines.length);
    frame([[a, pose(1200)]]);
    expect(hulls()[0]?.count).toBe(1);
    expect(glows().geometry.drawRange.count).toBe(model.engines.length);
  });

  it('never batches a model it was not given', () => {
    const { make, frame, hulls } = setup(false);
    const ship = make();
    frame([[ship, pose(1500)]]); frame([[ship, pose(1500)]]);
    expect(ship.group.visible).toBe(true);
    expect(hulls()).toHaveLength(0);
  });

  // S22 A/B, 2026-10-23: a flame draw apiece was 26 draws and 4.5 fps in a 36-ship fight.
  it('burns every near ship\'s flames in one draw: Cryo per nozzle, Solar too on turbo, none cloaked or landed', () => {
    const { model, make, frame, flames } = setup();
    const a = make(); const b = make();
    let own = 0; a.group.traverse(o => { if (o instanceof THREE.InstancedMesh) own++; });
    expect(own).toBe(0);
    frame([[a, pose(200)], [b, pose(300)]]); frame([[a, pose(200)], [b, pose(300)]]);
    expect(flames().count).toBe(2 * model.engines.length);
    for (let i = 0; i < 40; i++) frame([[a, pose(200, { turbo: true })], [b, pose(300)]]);
    expect(flames().count).toBe(3 * model.engines.length);
    frame([[a, pose(200, { cloak: 1 })], [b, pose(300, { landed: true })]]);
    expect(flames().count).toBe(0);
    // A flame sits on its nozzle, behind the ship, in world space.
    frame([[a, pose(200)]]);
    const matrix = new THREE.Matrix4(); flames().getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).z).toBeLessThan(200);
  });

  it('turns a glow orange and larger on turbo, as the ship\'s own sprites do', () => {
    const { make, frame, glows } = setup();
    const ship = make();
    for (let i = 0; i < 3; i++) frame([[ship, pose(1200)]]);
    const size = glows().geometry.getAttribute('glowSize').getX(0); const red = glows().geometry.getAttribute('glowColor').getX(0);
    for (let i = 0; i < 40; i++) frame([[ship, pose(1200, { turbo: true })]]);
    expect(glows().geometry.getAttribute('glowSize').getX(0)).toBeGreaterThan(size);
    expect(glows().geometry.getAttribute('glowColor').getX(0)).toBeGreaterThan(red);
  });
});
