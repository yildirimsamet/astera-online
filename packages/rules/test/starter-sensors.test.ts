import { describe, expect, it } from 'vitest';
import { STARTER, probeAccuracy, sensorZone, vesselProbeAccuracy, vesselSphere } from '../src/index.js';

const AT = { x: 0, y: 0, z: 0 };
const away = (x: number) => ({ x, y: 0, z: 0 });

describe('a ship\'s eyes', () => {
  it('sees the naked-eye distance with nothing repaired', () => {
    expect(vesselSphere(AT, 0, 0)).toEqual({ at: AT, identify: 150, detect: 0 });
  });

  it('reads this galaxy\'s rungs, not the main game\'s', () => {
    STARTER.telescope.forEach((reach, stage) => {
      if (stage > 0) expect(vesselSphere(AT, stage, 0).identify).toBe(reach);
    });
    STARTER.radar.forEach((reach, stage) => { expect(vesselSphere(AT, 0, stage).detect).toBe(reach); });
  });

  it('stops at the top rung', () => {
    expect(vesselSphere(AT, 9, 9)).toEqual({ at: AT, identify: 1100, detect: 1500 });
  });

  it('carries the ship\'s id when it is given', () => {
    expect(vesselSphere(AT, 1, 1, 'ship').planetId).toBe('ship');
  });

  it('feeds the main sensor rule', () => {
    const sphere = vesselSphere(AT, 1, 1);
    expect(sensorZone([sphere], away(450))).toBe('IDENTIFIED');
    expect(sensorZone([sphere], away(750))).toBe('CONTACT');
    expect(sensorZone([sphere], away(751))).toBe('NONE');
  });

  // Owner 2026-11-18 (item 28): the first radar hears a band twice as wide as it was, 300 past the telescope.
  it('hears a wide band past the first telescope with the first radar', () => {
    expect(STARTER.radar[1]).toBe(750);
    expect(STARTER.radar[1] - STARTER.telescope[1]).toBe(300);
  });
});

describe('a probe\'s reading', () => {
  it('uses one rung below the antenna\'s stage', () => {
    expect(vesselProbeAccuracy(1)).toBe(probeAccuracy(0, 0));
    expect(vesselProbeAccuracy(3)).toBe(probeAccuracy(2, 0));
  });

  it('sharpens at every stage', () => {
    expect(vesselProbeAccuracy(2)).toBeGreaterThan(vesselProbeAccuracy(1));
    expect(vesselProbeAccuracy(3)).toBeGreaterThan(vesselProbeAccuracy(2));
  });
});
