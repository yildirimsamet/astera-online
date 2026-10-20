import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RADIATION_BOMB_VISUAL } from '@astera/rules';
import { MISSILE_SIZE, STRATEGIC_HULL_SCALE_MULT } from '../src/galaxy/scene.js';
import { PLUME_WIDTH } from '../src/galaxy/StrategicExhaust.js';
import { readFileSync } from 'node:fs';
import { RADIATION_MARK, trackingMarkStyle, trackingTicksGeometry } from '../src/galaxy/trackingMark.js';

/**
 * A MISSILE IN FLIGHT HAS TO BE SEEN. Owner, 2026-10-16: *"Tüm füzelerin modellerinin
 * boyutunu, şuanki boyutlarının 2 katına çıkart. Tüm füzelerin egzoz alevinin genişliğini 4
 * katına çıkart … Ayrıca ölüm yıldızı giderken etrafında kırmızı bir çember oluşuyor ama
 * radyasyon füzelerinde bu yok. Radyasyon füzeleri için de uygun yeşilimsi bir çember ekle."*
 */
describe('how large a missile is drawn', () => {
  it('draws every missile at twice its former size', () => {
    expect(MISSILE_SIZE).toBe(2);
    expect(STRATEGIC_HULL_SCALE_MULT).toBeCloseTo(3.4 * 2, 9);
    expect([1, 2, 3].map((level) => RADIATION_BOMB_VISUAL[level as 1 | 2 | 3].length))
      .toEqual([0.96, 1.28, 1.68]);
  });

  it('makes the exhaust four times as wide as it was, the doubled hull included', () => {
    expect(PLUME_WIDTH * MISSILE_SIZE).toBe(4);
  });
});

describe('the reticle a missile wears', () => {
  it('gives a radiation bomb the Death Star’s ring and ticks, in radiation green', () => {
    const bomb = trackingMarkStyle('radiation_bomb', '#ffffff');
    const star = trackingMarkStyle('death_star', '#ff4d67');
    expect(bomb).toMatchObject({ ring: true, ticks: true, colour: RADIATION_MARK });
    expect(star).toMatchObject({ ring: true, ticks: true, colour: '#ff4d67' });
  });

  it('leaves the other kinds as they were', () => {
    expect(trackingMarkStyle('fleet', '#8fd8ff')).toMatchObject({ ring: false, ticks: true });
    expect(trackingMarkStyle('probe', '#8fd8ff')).toMatchObject({ ring: true, ticks: false });
  });
});

/*
  2026-10-20 performance recording: every fleet contact drew its four reticle ticks as four
  meshes — four draw calls a fleet, on a wide view of 34 contacts and ~500 calls. The ticks
  are one geometry and one draw; the picture is unchanged.
*/
describe('the reticle ticks in one draw', () => {
  it('holds four quads, each a tick length along its own radius', () => {
    const ticks = trackingTicksGeometry(2, 0.1, 0.6);
    expect(ticks.index?.count).toBe(4 * 6);
    expect(ticks.getAttribute('position').count).toBe(4 * 4);
    ticks.computeBoundingBox();
    const box = ticks.boundingBox!;
    for (const value of [box.max.x, box.max.y, -box.min.x, -box.min.y]) expect(value).toBeCloseTo(2 + 0.3);
    expect(box.min.z).toBe(0);
    expect(box.max.z).toBe(0);
    ticks.dispose();
  });

  it('places the top tick upright on the ring and the right tick lying on it', () => {
    const ticks = trackingTicksGeometry(2, 0.1, 0.6);
    const position = ticks.getAttribute('position');
    const quads = [0, 1, 2, 3].map(quad => {
      const box = new THREE.Box3();
      for (let i = quad * 4; i < quad * 4 + 4; i++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, i));
      return box;
    });
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const upright = quads.find(box => near(box.min.y, 1.7) && near(box.max.y, 2.3));
    const lying = quads.find(box => near(box.min.x, 1.7) && near(box.max.x, 2.3));
    expect(upright && near(upright.max.x - upright.min.x, 0.1)).toBe(true);
    expect(lying && near(lying.max.y - lying.min.y, 0.1)).toBe(true);
    ticks.dispose();
  });

  it('is what the fleet reticle draws', () => {
    const source = readFileSync('src/galaxy/Fleets.tsx', 'utf8');
    expect(source).toContain('trackingTicksGeometry(');
    expect(source).not.toContain('[0, 1, 2, 3].map((quarter)');
  });
});
