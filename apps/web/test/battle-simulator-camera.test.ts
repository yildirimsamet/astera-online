import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, simulateScenario } from '../src/battle-simulator/scenario.js';
import { battleCameraRange, battlePlanet, fitBattleCamera, fitWorldLabel, focusBattleCamera, layoutBattle } from '../src/battle-simulator/sceneLayout.js';

describe('battle camera frames both complete fleets', () => {
  it('keeps world and escape-area names inside the phone viewport at either edge', () => {
    for (const anchor of [-20, 0, 35, 175, 320, 350, 380]) {
      const offset = fitWorldLabel(anchor, 180, 350);
      expect(anchor - 90 + offset).toBeGreaterThanOrEqual(8);
      expect(anchor + 90 + offset).toBeLessThanOrEqual(342);
    }
    expect(fitWorldLabel(175, 180, 350)).toBe(0);
  });
  it('allows the camera to frame a real 2,000-unit recording without clipping or a 260-unit orbit clamp', () => {
    const sample = simulateScenario(DEFAULT_SCENARIO).recording.ships.find(ship => ship.side === 'DEFENCE')!;
    const recording = { schemaVersion: 1 as const, roundLimit: 6, initialAegis: 0, rounds: [],
      ships: Array.from({ length: 2000 }, (_, i) => ({ ...sample, id: String(i), side: i === 0 ? 'ATTACK' as const : 'DEFENCE' as const, ground: false })) };
    const poses = layoutBattle(recording), aspect = 350 / 480;
    const { far, maxDistance } = battleCameraRange(poses, aspect), fit = fitBattleCamera(poses, 'ATTACK', aspect);
    const distance = Math.hypot(fit.position.x - fit.center.x, fit.position.y - fit.center.y, fit.position.z - fit.center.z);
    expect(maxDistance).toBeGreaterThan(distance);
    const camera = new THREE.PerspectiveCamera(43, aspect, .1, far);
    camera.position.set(fit.position.x, fit.position.y, fit.position.z); camera.lookAt(fit.center.x, fit.center.y, fit.center.z); camera.updateMatrixWorld();
    for (const pose of poses.values()) expect(new THREE.Vector3(pose.x, pose.y, pose.z).project(camera).z).toBeLessThan(1);
  });
  it.each(['ATTACK', 'DEFENCE'] as const)('focuses any surface gun from %s without putting the planet between the camera and gun', viewer => {
    const scenario = structuredClone(DEFAULT_SCENARIO);
    scenario.attackers[0]!.fleet = { DART: 1 }; scenario.defenders[0]!.fleet = { BASTION: 399 };
    const { recording } = simulateScenario(scenario), poses = layoutBattle(recording), planet = battlePlanet(recording.ships, poses);
    const guns = recording.ships.filter(ship => ship.ground); expect(guns).toHaveLength(399);
    const sign = viewer === 'ATTACK' ? 1 : -1;
    for (const ship of guns) {
      const pose = poses.get(ship.id)!, fit = focusBattleCamera(pose, viewer, 350 / 480, planet);
      const gun = new THREE.Vector3(pose.x * sign, pose.y, pose.z * sign), start = new THREE.Vector3(fit.position.x, fit.position.y, fit.position.z);
      const center = new THREE.Vector3(planet.x * sign, planet.y, planet.z * sign);
      for (let step = 0; step <= 100; step++) expect(start.clone().lerp(gun, step / 100).distanceTo(center)).toBeGreaterThan(planet.radius);
    }
  });
  it('focuses a selected unit at a usable size in both perspectives, including its parked escape slot', () => {
    const pose = { x: 21, y: .2, z: -16, scale: 2 };
    for (const viewer of ['ATTACK', 'DEFENCE'] as const) {
      const fit = focusBattleCamera(pose, viewer, .7), sign = viewer === 'ATTACK' ? 1 : -1;
      expect(fit.center.x).toBe(pose.x * sign);
      const camera = new THREE.PerspectiveCamera(43, .7, .1, 600);
      camera.position.set(fit.position.x, fit.position.y, fit.position.z);
      camera.lookAt(fit.center.x, fit.center.y, fit.center.z); camera.updateMatrixWorld();
      const left = new THREE.Vector3(fit.center.x - pose.scale / 2, fit.center.y, fit.center.z).project(camera);
      const right = new THREE.Vector3(fit.center.x + pose.scale / 2, fit.center.y, fit.center.z).project(camera);
      expect(Math.abs(right.x - left.x)).toBeGreaterThan(.15); expect(Math.abs(right.x - left.x)).toBeLessThan(1.6);
      const projected = new THREE.Vector3(pose.x * sign, pose.y, pose.z * sign).project(camera);
      expect(projected.y).toBeGreaterThan(.35); // Above the mobile inspector, not behind its plate.
    }
  });
  it('keeps ordinary ships readable in the default phone overview instead of spending the view on the planet', () => {
    const { recording } = simulateScenario(DEFAULT_SCENARIO), poses = layoutBattle(recording);
    const fit = fitBattleCamera(poses, 'ATTACK', 350 / 520);
    const camera = new THREE.PerspectiveCamera(43, 350 / 520, .1, 600);
    camera.position.set(fit.position.x, fit.position.y, fit.position.z); camera.lookAt(fit.center.x, fit.center.y, fit.center.z);
    camera.updateMatrixWorld();
    for (const ship of recording.ships.filter(ship => ship.side === 'ATTACK')) {
      const pose = poses.get(ship.id)!;
      const left = new THREE.Vector3(pose.x - pose.scale / 2, pose.y, pose.z).project(camera);
      const right = new THREE.Vector3(pose.x + pose.scale / 2, pose.y, pose.z).project(camera);
      expect(Math.abs(right.x - left.x) * 175).toBeGreaterThan(15);
    }
  });
  it.each(['ATTACK', 'DEFENCE'] as const)('keeps every unit visible from %s on portrait and desktop screens', viewer => {
    const { recording } = simulateScenario(DEFAULT_SCENARIO), poses = layoutBattle(recording);
    for (const aspect of [350 / 480, 1020 / 710]) {
      const frame = fitBattleCamera(poses, viewer, aspect);
      const camera = new THREE.PerspectiveCamera(43, aspect, .1, 600);
      camera.position.set(frame.position.x, frame.position.y, frame.position.z);
      camera.lookAt(frame.center.x, frame.center.y, frame.center.z);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const sign = viewer === 'ATTACK' ? 1 : -1;
      for (const pose of poses.values()) for (const x of [-.5, .5]) for (const y of [-.5, 1]) for (const z of [-.5, .5]) {
        const projected = new THREE.Vector3(sign * (pose.x + x * pose.scale), pose.y + y * pose.scale, sign * (pose.z + z * pose.scale)).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(.9);
        expect(Math.abs(projected.y)).toBeLessThan(.9);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
    }
  });
});
