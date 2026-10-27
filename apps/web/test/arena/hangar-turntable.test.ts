import { describe, expect, it } from 'vitest';
import { TURN, createTurntable, restHeight, dragTurntable, releaseTurntable, stepTurntable, zoomTurntable } from '../../src/arena/hangar/turntable.js';

/**
 * The hangar's ship turns on its pad by hand (owner 2026-10-23: "gemimi çevirip inceleyebileceğim").
 * The camera never leaves the apron, so no turn can put a wall between it and the ship.
 */
const run = (t: ReturnType<typeof createTurntable>, seconds: number) => { for (let i = 0; i < seconds * 60; i++) stepTurntable(t, 1 / 60); };

describe('the hangar turntable', () => {
  it('turns the ship with a sideways drag, all the way round', () => {
    const t = createTurntable();
    for (let i = 0; i < 100; i++) dragTurntable(t, 10, 1 / 60);
    expect(t.yaw).toBeCloseTo(100 * 10 * TURN.perPixel, 6);
    expect(t.yaw).toBeGreaterThan(2 * Math.PI);
  });

  it('keeps turning after the hand lets go, slowing to a stop', () => {
    const t = createTurntable();
    dragTurntable(t, 12, 1 / 60);
    releaseTurntable(t);
    const flung = t.spin;
    expect(flung).toBeGreaterThan(0);
    run(t, 1);
    expect(t.spin).toBeGreaterThan(0);
    expect(t.spin).toBeLessThan(flung / 4);
  });

  it('turns slowly on its own once left alone, and not while held', () => {
    const t = createTurntable();
    dragTurntable(t, 0, 1 / 60);
    run(t, 1);
    const held = t.yaw;
    expect(held).toBe(0);
    releaseTurntable(t);
    run(t, TURN.rest + 3);
    expect(t.spin).toBeCloseTo(TURN.autoSpin, 2);
    expect(t.yaw).toBeGreaterThan(held);
  });

  it('moves only the ship under a drag: the camera and the hangar stay put (owner 2026-10-23)', () => {
    const t = createTurntable();
    const camera = { ...t };
    for (let i = 0; i < 30; i++) dragTurntable(t, 8, 1 / 60);
    expect(t.yaw).not.toBe(camera.yaw);
    expect(t.distance).toBe(camera.distance);
    expect(Object.keys(t).sort()).toEqual(['distance', 'held', 'idle', 'spin', 'yaw']);
  });

  it('zooms only as far as the apron allows', () => {
    const t = createTurntable();
    zoomTurntable(t, 100);
    expect(t.distance).toBe(TURN.far);
    zoomTurntable(t, 0.001);
    expect(t.distance).toBe(TURN.near);
  });

  it('ignores a broken step or zoom', () => {
    const t = createTurntable();
    stepTurntable(t, Number.NaN);
    zoomTurntable(t, Number.NaN);
    dragTurntable(t, Number.NaN, 0);
    expect([t.yaw, t.spin, t.distance]).toEqual([0, 0, TURN.distance]);
  });
});

describe('the ship on its pad', () => {
  it('floats its lowest point clear of the deck, whatever the class\'s shape', () => {
    // A unit model centred on its origin reaches 0.2 below it; drawn 0.3 long on a deck at -0.19.
    const y = restHeight(-0.19, -0.2, 0.3);
    expect(y - 0.2 * 0.3).toBeGreaterThan(-0.19);
    // Its breathing never takes it down to the deck.
    expect(y - 0.2 * 0.3 - TURN.breath * 0.3).toBeGreaterThan(-0.19);
  });
});
