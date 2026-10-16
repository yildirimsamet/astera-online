import { describe, expect, it } from 'vitest';
import { RADIATION_BOMB_VISUAL } from '@astera/rules';
import { MISSILE_SIZE, STRATEGIC_HULL_SCALE_MULT } from '../src/galaxy/scene.js';
import { PLUME_WIDTH } from '../src/galaxy/StrategicExhaust.js';
import { RADIATION_MARK, trackingMarkStyle } from '../src/galaxy/trackingMark.js';

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
