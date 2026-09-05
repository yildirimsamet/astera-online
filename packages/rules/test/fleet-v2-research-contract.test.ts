import { describe, expect, it } from 'vitest';
import * as rules from '../src/index.js';
import type { TechLevels } from '../src/index.js';

interface RuntimeHullTech { atk: number; hp: number; speed: number }
interface RuntimeProject {
  maxLevel: number;
  prerequisite: string | null;
};

const fleetV2Combat = [
  'DART', 'PIKE', 'RAMPART', 'WARDEN',
  'VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL',
  'TEMPEST', 'BALLISTA', 'LEVIATHAN', 'PRAETORIAN',
  'NULLIFIER', 'CATACLYSM', 'CITADEL',
] as const;
const fleetV2Cargo = ['COURIER', 'WAYFARER', 'ATLAS'] as const;
const fleetV2 = [...fleetV2Combat, ...fleetV2Cargo] as const;
const preserved = ['BASTION', 'THORN', 'PROSPECTOR'] as const;

const hullTechAt = (tech: TechLevels, id: string): RuntimeHullTech =>
  (rules.hullTech as unknown as (
    levels: TechLevels,
    hull: string,
  ) => RuntimeHullTech)(tech, id);

const runtimeProperty = (value: object, property: string): unknown =>
  Object.entries(value).find(([candidate]) => candidate === property)?.[1];

const projectAt = (id: string): RuntimeProject | undefined =>
  (rules.RESEARCH_PROJECTS as unknown as Record<string, RuntimeProject>)[id];

const researchEffectAt = (id: string, level: number): number =>
  (rules.researchEffectAt as unknown as (project: string, rung: number) => number)(id, level);

const fleetSpeedAt = (fleet: Record<string, number>, tech: TechLevels = {}): number =>
  (rules.fleetSpeed as unknown as (
    manifest: Record<string, number>,
    levels: TechLevels,
  ) => number)(fleet, tech);

const fleetTravelAt = (
  distance: number,
  fleet: Record<string, number>,
  tech: TechLevels = {},
): number => (rules.fleetTravelExact as unknown as (
  span: number,
  manifest: Record<string, number>,
  boost: number,
  levels: TechLevels,
) => number)(distance, fleet, 1, tech);

describe('Fleet V2 research effects — D148', () => {
  it('has a neutral value for every hull when no Fleet V2 research is held', () => {
    for (const id of [...fleetV2, ...preserved]) {
      expect(hullTechAt({}, id), id).toEqual({ atk: 1, hp: 1, speed: 1 });
    }
  });

  it('keeps Power, Armor, Propulsion and Emplacement inside their exact hull boundaries', () => {
    const max = rules.RESEARCH_TECH.weaponMaxLevel;
    const power: TechLevels = { SHIP_POWER: max };
    const armor: TechLevels = { SHIP_ARMOR: max };
    const propulsion: TechLevels = { SHIP_PROPULSION: max };
    const emplacement: TechLevels = { EMPLACEMENT_DOCTRINE: max };

    for (const id of fleetV2Combat) {
      expect(hullTechAt(power, id), `${id} power`).toMatchObject({ hp: 1, speed: 1 });
      expect(hullTechAt(power, id).atk, `${id} power`).toBeGreaterThan(1);
    }
    for (const id of fleetV2Cargo) {
      expect(hullTechAt(power, id), `${id} no power`).toEqual({ atk: 1, hp: 1, speed: 1 });
    }
    for (const id of preserved) {
      expect(hullTechAt(power, id), `${id} no power`).toEqual({ atk: 1, hp: 1, speed: 1 });
    }

    for (const id of fleetV2) {
      expect(hullTechAt(armor, id).hp, `${id} armor`).toBeGreaterThan(1);
      expect(hullTechAt(armor, id)).toMatchObject({ atk: 1, speed: 1 });
      expect(hullTechAt(propulsion, id).speed, `${id} propulsion`).toBeGreaterThan(1);
      expect(hullTechAt(propulsion, id)).toMatchObject({ atk: 1, hp: 1 });
    }
    for (const id of preserved) {
      expect(hullTechAt(armor, id), `${id} no armor`).toEqual({ atk: 1, hp: 1, speed: 1 });
      expect(hullTechAt(propulsion, id), `${id} no propulsion`)
        .toEqual({ atk: 1, hp: 1, speed: 1 });
    }

    // D169: the doctrine ladder is authored, not derived from the ceiling.
    const preservedDirectFactor = rules.RESEARCH_TECH.doctrineLadder.at(-1) ?? 1;
    for (const id of ['BASTION', 'THORN'] as const) {
      const effect = hullTechAt(emplacement, id);
      expect(effect.atk, `${id} preserved attack factor`).toBeCloseTo(preservedDirectFactor, 12);
      expect(effect.hp, `${id} preserved hp factor`).toBeCloseTo(preservedDirectFactor, 12);
      expect(effect.speed).toBe(1);
    }
    for (const id of [...fleetV2, 'PROSPECTOR'] as const) {
      expect(hullTechAt(emplacement, id), `${id} no emplacement`)
        .toEqual({ atk: 1, hp: 1, speed: 1 });
    }
  });

  it('splits the 25% military product ceiling between Power and Armor', () => {
    const max = rules.RESEARCH_TECH.weaponMaxLevel;
    const power = hullTechAt({ SHIP_POWER: max }, 'DART');
    const armor = hullTechAt({ SHIP_ARMOR: max }, 'DART');
    const both = hullTechAt({ SHIP_POWER: max, SHIP_ARMOR: max }, 'DART');
    const side = rules.RESEARCH_TECH.fleetStatLadder.at(-1) ?? 1;

    expect(power.atk).toBeCloseTo(side, 12);
    expect(power.hp).toBe(1);
    expect(armor.atk).toBe(1);
    expect(armor.hp).toBeCloseTo(side, 12);
    expect(both.atk * both.hp).toBeCloseTo(rules.RESEARCH_TECH.powerCeiling, 12);

    for (const id of fleetV2Combat) {
      const effect = hullTechAt({ SHIP_POWER: 99, SHIP_ARMOR: 99 }, id);
      expect(effect.atk * effect.hp, `${id} military product`)
        .toBeLessThanOrEqual(rules.RESEARCH_TECH.powerCeiling + 1e-9);
    }
  });

  /** D152 replaced the old ten-percent ceiling with a doubling over four rungs. */
  it('caps Propulsion at a doubling of speed and at nothing else', () => {
    const max = rules.RESEARCH_TECH.propulsionMaxLevel;
    const atMax = hullTechAt({ SHIP_PROPULSION: max }, 'DART').speed;
    const beyond = hullTechAt({ SHIP_PROPULSION: 99 }, 'DART').speed;

    expect(max).toBe(4);
    expect(atMax).toBeCloseTo(2, 12);
    expect(beyond).toBe(atMax);
    expect(hullTechAt({ SHIP_PROPULSION: 1 }, 'DART').speed).toBeCloseTo(1.25, 12);

    const fleet = { DART: 2, CITADEL: 1 };
    const baseFleetSpeed = fleetSpeedAt(fleet);
    expect(fleetSpeedAt(fleet, { SHIP_PROPULSION: max }))
      .toBeCloseTo(baseFleetSpeed * 2, 12);
    expect(fleetTravelAt(600, fleet, { SHIP_PROPULSION: max }))
      .toBeLessThan(fleetTravelAt(600, fleet));
  });

  it('publishes the exact research-tree gates and useful ladder ceilings', () => {
    const expected: Record<string, RuntimeProject> = {
      STARSHIP_ENGINEERING: { maxLevel: 2, prerequisite: null },
      SHIP_POWER: { maxLevel: 5, prerequisite: 'STARSHIP_ENGINEERING' },
      SHIP_ARMOR: { maxLevel: 5, prerequisite: 'STARSHIP_ENGINEERING' },
      SHIP_PROPULSION: { maxLevel: 4, prerequisite: 'DENSE_FUEL_CELLS' },
      EMPLACEMENT_DOCTRINE: { maxLevel: 5, prerequisite: null },
    };

    for (const [id, contract] of Object.entries(expected)) {
      expect(projectAt(id), id).toMatchObject(contract);
      for (let level = 1; level <= contract.maxLevel; level++) {
        expect(researchEffectAt(id, level), `${id} L${String(level)}`)
          .not.toBe(researchEffectAt(id, level - 1));
      }
      expect(researchEffectAt(id, contract.maxLevel + 1), `${id} ceiling`)
        .toBe(researchEffectAt(id, contract.maxLevel));
    }
  });

  it('exposes exactly combat-changing projects to probe and report consumers', () => {
    expect(runtimeProperty(rules, 'COMBAT_RESEARCH_PROJECTS')).toEqual([
      'SHIP_POWER', 'SHIP_ARMOR', 'EMPLACEMENT_DOCTRINE',
    ]);
  });
});
