import { describe, expect, it } from 'vitest';
import { STARTER, fleetCount, hangarLoad, migrationCargo } from '../src/index.js';

const plenty = { alloy: 99_999, crystal: 99_999, deuterium: 99_999 };

describe('what the hold carries down', () => {
  it('caps each resource', () => {
    const cargo = migrationCargo({ ...plenty, fleet: {}, damage: [] });
    expect(cargo).toMatchObject({ alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal, deuterium: STARTER.carry.deuterium });
  });

  it('carries what is there when it is under the cap', () => {
    expect(migrationCargo({ alloy: 100, crystal: 50, deuterium: 5, fleet: {}, damage: [] }))
      .toEqual({ alloy: 100, crystal: 50, deuterium: 5, fleet: {} });
  });

  it('rounds resources down, never up', () => {
    expect(migrationCargo({ alloy: 100.9, crystal: 50.9, deuterium: 5.9, fleet: {}, damage: [] }))
      .toMatchObject({ alloy: 100, crystal: 50, deuterium: 5 });
  });

  it('carries at most six ships', () => {
    const cargo = migrationCargo({ ...plenty, fleet: { DART: 8, WARDEN: 8 }, damage: [] });
    expect(fleetCount(cargo.fleet)).toBe(STARTER.carry.ships);
  });

  it('takes the most valuable ships first', () => {
    expect(migrationCargo({ ...plenty, fleet: { DART: 8, WARDEN: 4 }, damage: [] }).fleet).toEqual({ WARDEN: 4, DART: 2 });
  });

  it('leaves damaged ships behind', () => {
    const cargo = migrationCargo({
      ...plenty,
      fleet: { DART: 3, WARDEN: 2 },
      damage: [{ hull: 'WARDEN', count: 2, damageBp: 500 }, { hull: 'DART', count: 1, damageBp: 100 }],
    });
    expect(cargo.fleet).toEqual({ DART: 2 });
  });

  it('counts two lots of the same hull', () => {
    const cargo = migrationCargo({
      ...plenty,
      fleet: { DART: 3 },
      damage: [{ hull: 'DART', count: 1, damageBp: 100 }, { hull: 'DART', count: 1, damageBp: 9000 }],
    });
    expect(cargo.fleet).toEqual({ DART: 1 });
  });

  it('always fits the hangar it lands in', () => {
    const FIRST_HANGAR_ROOM = 80;
    const FIRST_SEASON_ROOM = 20;
    const cargo = migrationCargo({ ...plenty, fleet: { WARDEN: 6, PROSPECTOR: 6 }, damage: [] });
    expect(hangarLoad(cargo.fleet) + FIRST_SEASON_ROOM).toBeLessThanOrEqual(FIRST_HANGAR_ROOM);
  });
});
