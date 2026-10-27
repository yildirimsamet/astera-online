import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSandboxWorld, remainingFlightSeconds, shipTuning } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { hudContext } from '../../src/arena/Hud.js';
import { createHudStore, type HudSnapshot } from '../../src/arena/store.js';

/** F19 (S22 2026-10-26): on a rock with no vein the HUD only said "landed"; nothing said there was nothing to mine. */
describe('the line the HUD shows on a landing', () => {
  let previous = 'en';
  beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
  afterEach(async () => { await i18n.changeLanguage(previous); });
  const flying = (patch: Partial<HudSnapshot>): HudSnapshot => {
    const store = createHudStore(); store.publish(createSandboxWorld({ bots: 0 }), 'flight', false, false);
    return { ...store.getSnapshot(), ...patch };
  };

  it('says a bare rock holds no ore and how to find one that does', () => {
    const c = arenaCopy();
    expect(hudContext(flying({ landed: true, landedOn: 'rock', depositKind: -1 }), c)).toEqual({ title: c.noOre, hint: c.noOreHint, tone: 'warn' });
    expect(c.noOreHint).toMatch(/damarlı/i);
  });

  it('keeps the plain landed line off rock, and the mining line on a vein', () => {
    const c = arenaCopy();
    expect(hudContext(flying({ landed: true, landedOn: 'structure', depositKind: -1 }), c)?.title).toBe(c.landed);
    expect(hudContext(flying({ landed: true, landedOn: 'rock', depositKind: 0, mining: true }), c)?.tone).toBe('crystal');
  });
});

/** F20 (S22 2026-10-26): the fuel clock read the throttle of the moment and jumped 15:00 ↔ 48:52 ↔ 231:15. */
describe('the fuel clock', () => {
  it('reads the tank at full throttle for this ship, whatever the throttle now', () => {
    const world = createSandboxWorld({ bots: 0, ship: 'akinci' });
    const store = createHudStore();
    const read = (throttle: number): number => { world.pilot.throttle = throttle; store.publish(world, 'flight', false, false); return store.getSnapshot().remaining; };
    const tuning = shipTuning(world.pilot.ship, world.pilot.level);
    expect([read(0.1), read(0.5), read(1)]).toEqual(Array(3).fill(remainingFlightSeconds(world.pilot.fuel, 1, false, tuning)));
  });
});
