import { STARTER, alloyRate, crystalRate, collectorCap, openingProgress, vesselAegisHp, vaultProtects, storageCap } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { planetSchema } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { wireVessel } from './starterVesselFixture.js';

const view = (over: Parameters<typeof wireVessel>[0] = {}) => vesselToPlanetView(vesselSchema.parse(wireVessel(over)));
/** Across the wire and back through the real schema, which is the only contract the screens have. */
const parsed = (over: Parameters<typeof wireVessel>[0] = {}) => planetSchema.parse(JSON.parse(JSON.stringify(view(over))));

describe('a ship, as the planet screens read it', () => {
  it('survives the real planet schema', () => {
    expect(planetSchema.safeParse(JSON.parse(JSON.stringify(view()))).success).toBe(true);
  });

  it('carries the ship itself, so one read serves the galaxy and the ship screen', () => {
    const progress = { ...openingProgress(), modules: { REFINERY: 2 }, parts: 2 };
    expect(parsed({ progress }).vessel).toMatchObject({ id: 'ship-1', parts: 2, modules: { REFINERY: 2 }, features: ['production'] });
  });

  it('keeps the ship as its identity', () => {
    expect(parsed().planet).toMatchObject({ id: 'ship-1', name: 'Newcomer', kind: 'CAPITAL', position: { x: 120, y: -40, z: 8 } });
  });

  it('carries what the ship holds, whole numbers in the store as on a planet', () => {
    expect(parsed({ alloy: 650.7, crystal: 300.2, deuterium: 4.9 }).planet).toMatchObject({ alloy: 650, crystal: 300, deuterium: 4 });
  });

  it('carries the works, since the top bar collects from them', () => {
    expect(parsed({ bufferAlloy: 12.5, bufferCrystal: 3.25 }).planet).toMatchObject({ bufferAlloy: 12.5, bufferCrystal: 3.25 });
  });

  it('reads rates and ceilings from the main rules, at the repair stage', () => {
    const progress = { ...openingProgress(), modules: { REFINERY: 3, EXTRACTOR: 2, VAULT: 1 } };
    const { planet } = parsed({ progress });
    expect(planet.alloyPerHour).toBe(Math.round(alloyRate(3) * STARTER.outputMult));
    expect(planet.crystalPerHour).toBe(Math.round(crystalRate(2) * STARTER.outputMult));
    expect(planet.bufferAlloyCap).toBe(collectorCap(alloyRate(3) * STARTER.outputMult));
    expect(planet.alloyCap).toBe(storageCap(alloyRate(3) * STARTER.outputMult, 1));
    expect(planet.vaultCapacity).toEqual(vaultProtects(1, 3, 2, 0));
  });

  it('makes nothing from a module nobody has repaired', () => {
    expect(parsed().planet.crystalPerHour).toBe(0);
    expect(parsed().planet.deuteriumPerHour).toBe(0);
  });

  it('shows the repair stages as levels, and a Command Core of 1 on every ship', () => {
    const progress = { ...openingProgress(), modules: { REFINERY: 2, SHIPYARD: 1, TELESCOPE: 1, RADAR: 2, AEGIS: 1 } };
    const planet = parsed({ progress });
    expect(planet.buildings).toMatchObject({ CORE: 1, REFINERY: 2, SHIPYARD: 1, EXTRACTOR: 0 });
    expect(planet.instruments).toMatchObject({ TELESCOPE: 1, RADAR: 2, AEGIS: 1, VEIL: 0 });
  });

  it('gives a repaired shipyard its first hangar, as the rules do', () => {
    const progress = { ...openingProgress(), modules: { SHIPYARD: 1 } };
    expect(parsed({ progress }).buildings.HANGAR).toBe(1);
    expect(parsed({ progress }).capacity?.hangar).toBe(STARTER.hangarRoom[0]);
  });

  it('holds this galaxy\'s hangar, not the main game\'s', () => {
    const progress = { ...openingProgress(), modules: { SHIPYARD: 1, HANGAR: 3 } };
    expect(parsed({ progress }).capacity?.hangar).toBe(STARTER.hangarRoom[2]);
  });

  it('holds this galaxy\'s Aegis: half the wall of the main game', () => {
    const progress = { ...openingProgress(), modules: { AEGIS: 1 } };
    const { planet } = parsed({ progress, shield: 40 });
    expect(planet.shield).toBe(40);
    expect(planet.shieldMax).toBe(vesselAegisHp(1));
  });

  it('has no Aegis on a new ship, and so no wall to regrow', () => {
    expect(parsed().planet).toMatchObject({ shield: 0, shieldMax: 0, shieldPerHour: 0 });
  });

  it('lists the repair queue with absolute clocks, so a countdown reads the shared clock', () => {
    const planet = parsed({ queue: [{
      id: 'order-1', queue: 'CONSTRUCTION', subject: 'REFINERY', stage: 2, count: 1,
      startedAt: '2026-11-04T10:00:00.000Z', readyAt: '2026-11-04T10:01:00.000Z', cost: { alloy: 154, crystal: 20, deuterium: 0 },
    }] });
    expect(planet.queues?.CONSTRUCTION).toEqual([expect.objectContaining({
      id: 'order-1', slot: 0, kind: 'BUILDING', subject: 'REFINERY', count: 1, finishesAt: new Date('2026-11-04T10:01:00.000Z'),
    })]);
    expect(planet.queues?.YARD).toEqual([]);
  });

  it('files an instrument repair as an instrument', () => {
    const planet = parsed({ queue: [{
      id: 'order-2', queue: 'CONSTRUCTION', subject: 'TELESCOPE', stage: 1, count: 1,
      startedAt: '2026-11-04T10:00:00.000Z', readyAt: '2026-11-04T11:30:00.000Z', cost: { alloy: 700, crystal: 500, deuterium: 0 },
    }] });
    expect(planet.queues?.CONSTRUCTION[0]).toMatchObject({ kind: 'INSTRUMENT', subject: 'TELESCOPE' });
  });

  it('keeps the ships at home at home', () => {
    expect(parsed({ fleet: { DART: 2, PROSPECTOR: 1 } }).fleet).toEqual({ DART: 2, PROSPECTOR: 1 });
    expect(parsed({ fleet: { DART: 2 } }).fleetAway).toEqual({});
  });

  it('never claims Dominion or colonies: this galaxy has neither', () => {
    const planet = parsed();
    expect(planet.score).toEqual({ wealth: 0, dominion: 0 });
    expect(planet.colonies).toBeUndefined();
    expect(planet.academyStep).toBeNull();
  });
});
