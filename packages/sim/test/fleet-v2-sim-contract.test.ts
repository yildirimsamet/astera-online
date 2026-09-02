import { describe, expect, it } from 'vitest';
import { HULLS, type Fleet, type HullProfile, type MobileHullId } from '@astera/rules';
import {
  ARCHETYPES,
  COMBAT_HULLS,
  adaptiveMix,
  runSeason,
  type ArchetypeName,
  type CombatHullId,
} from '../src/index.js';

const retired = ['WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER'] as const;
const combat = [
  'DART', 'PIKE', 'RAMPART', 'WARDEN',
  'VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL',
  'TEMPEST', 'BALLISTA', 'LEVIATHAN', 'PRAETORIAN', 'NULLIFIER',
  'CATACLYSM', 'CITADEL',
] as const;
const cargo = ['COURIER', 'WAYFARER', 'ATLAS'] as const;

describe('Fleet V2 simulator contract — D148', () => {
  it('derives the combat pool without admitting transports', () => {
    expect([...COMBAT_HULLS].sort()).toEqual([...combat].sort());
    for (const id of COMBAT_HULLS) expect(HULLS[id].profile).not.toBe('TRANSPORT');
  });

  it('models Raider, Striker, Fortress and Escort habits plus a cargo preference', () => {
    const represented = new Set<HullProfile>();
    for (const name of Object.keys(ARCHETYPES) as ArchetypeName[]) {
      const archetype = ARCHETYPES[name];
      for (const id of Object.keys(archetype.composition) as CombatHullId[]) {
        represented.add(HULLS[id].profile);
      }
      expect(archetype.cargoPreference.length, `${name} cargo preference`).toBeGreaterThan(0);
      for (const id of archetype.cargoPreference) {
        expect(cargo, `${name} cargo hull ${id}`).toContain(id);
      }
    }
    expect(represented).toEqual(new Set(['RAIDER', 'STRIKER', 'FORTRESS', 'ESCORT']));
  });

  it('keeps locked T3/T4 hulls out of adaptive choices until research is held', () => {
    const defence: Fleet = { BASTION: 10, THORN: 10 };
    const permitted = ['TEMPEST', 'BALLISTA', 'CATACLYSM'] as CombatHullId[];
    expect(adaptiveMix(6, { DART: 1 }, defence, permitted, {})).toEqual({ DART: 1 });

    const opened = adaptiveMix(6, { DART: 1 }, defence, permitted, {
      STARSHIP_ENGINEERING: 2,
      SHIP_POWER: 4,
      SHIP_ARMOR: 2,
    });
    expect(Object.keys(opened).length).toBeGreaterThan(0);
    expect(Object.keys(opened).every((id) => permitted.includes(id as CombatHullId))).toBe(true);
  });

  it('gives the informed archetype a path to every advanced combat gate', () => {
    expect(ARCHETYPES.GRINDER.researchTargets).toMatchObject({
      STARSHIP_ENGINEERING: 2,
      SHIP_POWER: 4,
      SHIP_ARMOR: 4,
      SHIP_PROPULSION: 2,
      GRAVITIC_CHARGES: 1,
    });
  });

  it('never emits a retired hull in a short season', () => {
    const { world } = runSeason({ players: 20, days: 3, seed: 148 });
    for (const player of world.players) {
      for (const id of retired) expect((player.fleet as Record<string, number>)[id]).toBeUndefined();
      for (const id of Object.keys(player.fleet)) {
        expect([...combat, ...cargo, 'PROSPECTOR'] as readonly string[]).toContain(id);
      }
    }
    for (const mission of world.missions) {
      for (const id of Object.keys(mission.fleet) as MobileHullId[]) {
        expect([...combat, ...cargo]).toContain(id);
      }
    }
  });
});
