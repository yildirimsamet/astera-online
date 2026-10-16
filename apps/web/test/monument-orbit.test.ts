import { monumentMotion, motionPositionAt, motionVelocityAt, toWorld } from '@astera/rules';
import { PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMonumentOrbit } from '../src/galaxy/monumentOrbit.js';

const motion = monumentMotion({ x: 6200, y: 1800, z: -900 }, 1000);
const camera = new PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(180, 140, 240);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

describe('monument trajectories and direction cues', () => {
  it('samples the real 3D orbit in world space rather than flattening it into a ring', () => {
    const orbit = createMonumentOrbit(motion, 6.4);
    const now = motion.epochMs + 123_456;
    orbit.update(now, camera, 850, false, false);
    const points = orbit.path.geometry.getAttribute('position');
    for (const index of [0, 32, 128, points.count - 1]) {
      const at = now + Math.max(motion.periodXMs, motion.periodYMs) * index / (points.count - 1);
      const expected = toWorld(motionPositionAt(motion, at));
      expect(new Vector3().fromBufferAttribute(points, index).distanceTo(new Vector3(...expected))).toBeLessThan(0.00002);
    }
    expect(Math.abs(points.getY(32) - points.getY(128))).toBeGreaterThan(1);
    orbit.dispose();
  });

  it('does not force a false closing segment for unequal, non-repeating periods', () => {
    const orbit = createMonumentOrbit({ ...motion, periodXMs: motion.periodYMs * 1.7 }, 6.4);
    orbit.update(500_000, camera, 850, false, false);
    const points = orbit.path.geometry.getAttribute('position');
    expect(new Vector3().fromBufferAttribute(points, 0).distanceTo(new Vector3().fromBufferAttribute(points, points.count - 1))).toBeGreaterThan(1);
    orbit.dispose();
  });

  it('points chevrons along the true forward tangent and keeps them ahead of the hull from different views', () => {
    const orbit = createMonumentOrbit(motion, 6.4);
    const now = 900_000;
    for (const position of [[180, 140, 240], [-140, -180, 90]] as const) {
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      orbit.update(now, camera, 850, true, true);
      const points = orbit.arrows.geometry.getAttribute('position');
      const tip = new Vector3().fromBufferAttribute(points, 1);
      const left = new Vector3().fromBufferAttribute(points, 0);
      const right = new Vector3().fromBufferAttribute(points, 3);
      const heading = tip.clone().sub(left.add(right).multiplyScalar(0.5)).normalize();
      const current = new Vector3(...toWorld(motionPositionAt(motion, now)));
      const velocity = motionVelocityAt(motion, now);
      expect(heading.dot(new Vector3(velocity.x, velocity.y, velocity.z).normalize())).toBeGreaterThan(0.97);
      expect(tip.clone().sub(current).dot(heading)).toBeGreaterThan(3.2);
      expect(left.distanceTo(right)).toBeGreaterThan(0.1);
    }
    orbit.dispose();
  });

  it('reconciles jumps in either direction using the server clock and reuses its buffers', () => {
    const orbit = createMonumentOrbit(motion, 6.4);
    const points = orbit.path.geometry.getAttribute('position');
    const arrows = orbit.arrows.geometry.getAttribute('position');
    for (const now of [3600_000, 7200_000, -3600_000]) {
      orbit.update(now, camera, 850, false, false);
      expect(orbit.path.geometry.getAttribute('position')).toBe(points);
      expect(orbit.arrows.geometry.getAttribute('position')).toBe(arrows);
      expect(new Vector3().fromBufferAttribute(points, 0).distanceTo(new Vector3(...toWorld(motionPositionAt(motion, now))))).toBeLessThan(0.00002);
    }
    orbit.dispose();
  });

  it('clamps the future at the server stop and removes motion cues once stopped', () => {
    const stopAtMs = 600_000;
    const orbit = createMonumentOrbit({ ...motion, stopAtMs }, 6.4);
    orbit.update(stopAtMs - 1, camera, 850, false, false);
    const points = orbit.path.geometry.getAttribute('position');
    expect(new Vector3().fromBufferAttribute(points, points.count - 1).distanceTo(new Vector3(...toWorld(motionPositionAt(motion, stopAtMs))))).toBeLessThan(0.00002);
    for (const now of [stopAtMs, stopAtMs + 1_000_000]) {
      orbit.update(now, camera, 850, false, false);
      expect(orbit.object.visible).toBe(false);
    }
    orbit.update(stopAtMs - 60_000, camera, 850, false, false);
    expect(orbit.object.visible).toBe(true);
    orbit.dispose();
  });

  it('draws no movement for a zero-radius body and never intercepts scene taps or shows through worlds', () => {
    const orbit = createMonumentOrbit(monumentMotion({ x: 0, y: 0, z: 0 }, 0), 6.4);
    orbit.update(0, camera, 850, false, false);
    expect(orbit.object.visible).toBe(false);
    for (const line of [orbit.path, orbit.arrows]) {
      expect(line.material.depthTest).toBe(true);
      expect(line.material.depthWrite).toBe(false);
      // These overlays must never steal the planet/monument/empty-space tap.
      expect(new Raycaster().intersectObject(line)).toEqual([]);
    }
    orbit.dispose();
  });

  it('emphasizes the selected orbit and disposes its GPU resources', () => {
    const orbit = createMonumentOrbit(motion, 6.4);
    orbit.update(0, camera, 850, false, false);
    const opacity = orbit.path.material.opacity;
    const colours = orbit.path.geometry.getAttribute('color');
    expect(colours.getW(0)).toBeGreaterThan(colours.getW(128) * 5);
    expect(colours.getW(128)).toBeGreaterThan(0);
    orbit.update(0, camera, 850, true, true);
    expect(orbit.path.material.opacity).toBeGreaterThan(opacity);
    orbit.update(0, camera, 850, false, true);
    expect(orbit.path.material.opacity).toBeLessThan(opacity);
    const dispose = [orbit.path.geometry, orbit.path.material, orbit.arrows.geometry, orbit.arrows.material].map(resource => vi.spyOn(resource, 'dispose'));
    orbit.dispose();
    for (const spy of dispose) expect(spy).toHaveBeenCalledOnce();
  });

  /**
   * AT REST THE TRAJECTORY IS A WHISPER. Owner, 2026-10-16: *"Anıtların yörüngelerini gösteren
   * çizgiler çok belirgin … bir anıta tıklayınca focus olunca zaten yörünge çizgisinin
   * parlaklığı artıyor belli oluyor."* His capture read the idle loops at ~0.16 over the whole
   * orbit, so the material's own opacity is the ceiling that has to come down; the focus
   * is what makes a path legible.
   */
  it('keeps an unfocused trajectory faint and lets focus bring it out', () => {
    const orbit = createMonumentOrbit(motion, 6.4);
    orbit.update(0, camera, 850, false, false);
    const idle = orbit.path.material.opacity;
    expect(idle).toBeLessThanOrEqual(0.03);
    orbit.update(0, camera, 850, true, true);
    expect(orbit.path.material.opacity).toBeGreaterThanOrEqual(idle * 10);
    orbit.update(0, camera, 850, false, true);
    expect(orbit.path.material.opacity).toBeLessThan(idle);
    orbit.dispose();
  });

  /**
   * THE CHEVRONS WEAR THE ROUTE'S OPACITY UNTIL THE MONUMENT IS CHOSEN. Owner, 2026-10-16:
   * *"bu üçgenlerde aynı saydamlıkta olsun … focus olunca zaten hem üçgenlerin hem rotanın
   * parlaklığı artıyor."*
   */
  it('draws the direction chevrons at the route’s opacity, and brightens both on focus', () => {
    const orbit = createMonumentOrbit(motion, 6.4);
    for (const hasFocus of [false, true]) {
      orbit.update(0, camera, 850, false, hasFocus);
      expect(orbit.arrows.material.opacity).toBe(orbit.path.material.opacity);
    }
    orbit.update(0, camera, 850, false, false);
    const idle = orbit.arrows.material.opacity;
    orbit.update(0, camera, 850, true, true);
    expect(orbit.arrows.material.opacity).toBeGreaterThanOrEqual(idle * 10);
    expect(orbit.path.material.opacity).toBeGreaterThanOrEqual(idle * 10);
    orbit.dispose();
  });
});
