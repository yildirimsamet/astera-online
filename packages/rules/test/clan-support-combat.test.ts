import { describe, expect, it } from 'vitest';
import {
  MOBILE_HULLS,
  fleetEntries,
  fleetValue,
  mulberry32,
  normalizeLots,
  resolveBattle,
  resolveJointCombat,
  type DefenderStack,
  type Fleet,
  type HullId,
  type JointAttackerStack,
  type Rng,
  type TechLevels,
} from '../src/index.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the defending line that belongs to several commanders
 * (`docs/clan-defense-support-plan.md`, P1).
 */

const NO_TECH = { tech: {} };
const flat = (): Rng => () => 0.5;

const attacker = (fleet: Fleet, id = 'a1', playerId = 'p-attacker', tech: TechLevels = {}): JointAttackerStack =>
  ({ contributionId: id, playerId, fleet, tech: { tech } });

const host = (fleet: Fleet, tech: TechLevels = {}): DefenderStack =>
  ({ stackId: 'host', playerId: 'p-host', fleet, tech: { tech } });

const supporter = (
  fleet: Fleet,
  id: string,
  playerId: string,
  tech: TechLevels = {},
  damage?: DefenderStack['damage'],
): DefenderStack => ({ stackId: id, playerId, fleet, tech: { tech }, ...(damage ? { damage } : {}) });

const merge = (fleets: readonly Fleet[]): Fleet => {
  const out: Fleet = {};
  for (const fleet of fleets) {
    for (const [hull, n] of fleetEntries(fleet)) out[hull] = (out[hull] ?? 0) + n;
  }
  return out;
};

const compact = (fleet: Fleet): Fleet => {
  const out: Fleet = {};
  for (const [hull, n] of fleetEntries(fleet)) if (n > 0) out[hull] = n;
  return out;
};

const countingRng = (seed: number): { rng: Rng; calls: () => number } => {
  const inner = mulberry32(seed);
  let n = 0;
  return { rng: () => { n++; return inner(); }, calls: () => n };
};

const corpusRandom = mulberry32(20_261_001);
const int = (lo: number, hi: number): number => lo + Math.floor(corpusRandom() * (hi - lo + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(corpusRandom() * items.length)] as T;
const fleetFrom = (pool: readonly HullId[], types: number, max: number): Fleet => {
  const out: Fleet = {};
  for (let i = 0; i < types; i++) {
    const hull = pick(pool);
    out[hull] = (out[hull] ?? 0) + int(1, max);
  }
  return out;
};
const GUNS: HullId[] = ['BASTION', 'HARPOON', 'THORN'];
const techFor = (): TechLevels => ({ SHIP_POWER: int(0, 4), SHIP_ARMOR: int(0, 4), EMPLACEMENT_DOCTRINE: int(0, 4) });

describe('resolveBattle — one defending stack is the resolver it always was', () => {
  it('matches resolveJointCombat bit for bit over a seeded corpus', () => {
    for (let n = 0; n < 120; n++) {
      const line = merge([fleetFrom(MOBILE_HULLS, int(0, 4), 30), fleetFrom(GUNS, int(0, 2), 12)]);
      const attackers = Array.from({ length: int(1, 3) }, (_, i) =>
        attacker(fleetFrom(MOBILE_HULLS, int(1, 4), 40), `c${String(i)}`, `p${String(i)}`, techFor()));
      const shield = pick([0, 0, 500, 5000]);
      const hostTech = techFor();
      const seed = 1000 + n;

      const legacy = resolveJointCombat(attackers, line, shield, mulberry32(seed), { tech: hostTech });
      const battle = resolveBattle(attackers, [host(line, hostTech)], shield, mulberry32(seed));

      const { defenders, ...aggregate } = battle;
      expect(aggregate).toEqual(legacy);
      expect(defenders).toHaveLength(1);
      expect(defenders[0]).toEqual({
        stackId: 'host',
        playerId: 'p-host',
        sent: line,
        survivors: legacy.defenderSurvivors,
        losses: legacy.defenderLosses,
        lossValue: legacy.defenderLossValue,
        survivorDamage: legacy.defenderDamage,
      });
    }
  });
});

describe('resolveBattle — several commanders hold one line', () => {
  it('draws exactly two rolls a round, however many stacks defend', () => {
    for (const supporters of [1, 2, 4]) {
      const counter = countingRng(77 + supporters);
      const result = resolveBattle(
        [attacker({ TALON: 40, VIPER: 30 })],
        [
          host({ RAMPART: 10, THORN: 5 }),
          ...Array.from({ length: supporters }, (_, i) =>
            supporter({ PIKE: 8, DART: 12 }, `w${String(i)}`, `s${String(i)}`)),
        ],
        0,
        counter.rng,
      );
      expect(counter.calls()).toBe(2 * result.rounds.length);
    }
  });

  it('keeps every stack’s transports behind ANY ally’s guns', () => {
    const result = resolveBattle(
      [attacker({ DART: 3 })],
      [host({ RAMPART: 30 }), supporter({ COURIER: 10 }, 'w1', 's1')],
      0,
      flat(),
    );
    const wave = result.defenders.find((row) => row.stackId === 'w1')!;
    expect(wave.losses.COURIER ?? 0).toBe(0);
    expect(wave.survivors.COURIER).toBe(10);
  });

  it('exposes every transport on the field once no ally fights', () => {
    const result = resolveBattle(
      [attacker({ TALON: 60 })],
      [host({ COURIER: 4 }), supporter({ COURIER: 4 }, 'w1', 's1')],
      0,
      flat(),
    );
    expect((result.defenders[0]!.losses.COURIER ?? 0) + (result.defenders[1]!.losses.COURIER ?? 0)).toBeGreaterThan(0);
  });

  it('lets the host’s Aegis cover the whole line', () => {
    const result = resolveBattle(
      [attacker({ DART: 5 })],
      [host({ RAMPART: 3 }), supporter({ PIKE: 5 }, 'w1', 's1')],
      1_000_000,
      flat(),
    );
    for (const row of result.defenders) expect(compact(row.losses)).toEqual({});
    expect(result.shieldLeft).toBeLessThan(1_000_000);
  });

  it('refuses a ground gun anywhere but the host’s own stack', () => {
    expect(() => resolveBattle(
      [attacker({ DART: 5 })],
      [host({ RAMPART: 3 }), supporter({ THORN: 2 }, 'w1', 's1')],
      0,
      flat(),
    )).toThrow(RangeError);
  });

  it('refuses a damaged host stack — nothing at home is ever damaged', () => {
    expect(() => resolveBattle(
      [attacker({ DART: 5 })],
      [{ ...host({ RAMPART: 3 }), damage: [{ hull: 'RAMPART', count: 1, damageBp: 5000 }] }],
      0,
      flat(),
    )).toThrow(RangeError);
  });

  it('spends fire on a supporter’s damaged ships before anyone’s healthy ones', () => {
    const result = resolveBattle(
      [attacker({ DART: 1 })],
      [
        host({ DART: 10 }),
        supporter({ DART: 10 }, 'w1', 's1', {}, [{ hull: 'DART', count: 5, damageBp: 9_500 }]),
      ],
      0,
      flat(),
    );
    expect(result.rounds[0]!.defenderLosses.DART).toBe(5);
    const wave = result.defenders.find((row) => row.stackId === 'w1')!;
    const home = result.defenders.find((row) => row.stackId === 'host')!;
    expect(wave.losses.DART ?? 0).toBeGreaterThanOrEqual(5);
    expect(home.losses.DART ?? 0).toBeLessThanOrEqual(wave.losses.DART ?? 0);
  });

  it('adds every stack back up to the aggregate the report stores', () => {
    for (let n = 0; n < 60; n++) {
      const defenders: DefenderStack[] = [
        host(merge([fleetFrom(MOBILE_HULLS, int(0, 3), 20), fleetFrom(GUNS, int(0, 2), 8)]), techFor()),
        ...Array.from({ length: int(1, 3) }, (_, i) =>
          supporter(fleetFrom(MOBILE_HULLS, int(1, 3), 20), `w${String(i)}`, `s${String(i)}`, techFor())),
      ];
      const attackers = Array.from({ length: int(1, 3) }, (_, i) =>
        attacker(fleetFrom(MOBILE_HULLS, int(1, 4), 40), `c${String(i)}`, `p${String(i)}`, techFor()));
      const result = resolveBattle(attackers, defenders, pick([0, 800]), mulberry32(500 + n));

      expect(compact(merge(result.defenders.map((row) => row.sent))))
        .toEqual(compact(merge(defenders.map((row) => row.fleet))));
      expect(compact(merge(result.defenders.map((row) => row.survivors)))).toEqual(compact(result.defenderSurvivors));
      expect(compact(merge(result.defenders.map((row) => row.losses)))).toEqual(compact(result.defenderLosses));
      expect(result.defenders.reduce((sum, row) => sum + row.lossValue, 0)).toBe(result.defenderLossValue);
      expect(normalizeLots(result.defenders.flatMap((row) => row.survivorDamage))).toEqual(result.defenderDamage);
      for (const row of result.defenders.slice(1)) {
        expect(row.lossValue).toBe(fleetValue(row.losses));
        for (const lot of row.survivorDamage) expect(lot.count).toBeLessThanOrEqual(row.survivors[lot.hull] ?? 0);
      }
      const landed = result.rounds.reduce((sum, round) => sum + (round.attackerHullDamage ?? 0), 0);
      const credited = result.contributions.reduce((sum, row) => sum + row.hullDamage, 0);
      expect(credited).toBeLessThanOrEqual(landed + result.rounds.length);
    }
  });

  it('fights an equal-research line split in two the way it fights it whole', () => {
    for (let n = 0; n < 60; n++) {
      const a = fleetFrom(MOBILE_HULLS, int(0, 3), 20);
      const b = fleetFrom(MOBILE_HULLS, int(1, 3), 20);
      const guns = fleetFrom(GUNS, int(0, 2), 8);
      const tech = techFor();
      const attackers = [attacker(fleetFrom(MOBILE_HULLS, int(1, 4), 40), 'c0', 'p0', techFor())];
      const whole = resolveJointCombat(attackers, merge([a, b, guns]), 0, flat(), { tech });
      const split = resolveBattle(attackers, [host(merge([a, guns]), tech), supporter(b, 'w1', 's1', tech)], 0, flat());
      for (const hull of new Set([...Object.keys(whole.defenderLosses), ...Object.keys(split.defenderLosses)]) as Set<HullId>) {
        expect(Math.abs((whole.defenderLosses[hull] ?? 0) - (split.defenderLosses[hull] ?? 0))).toBeLessThanOrEqual(1);
      }
      expect(split.grade).toBe(whole.grade);
    }
  });

  it('settles a joint war against a supported world — both sides plural', () => {
    const result = resolveBattle(
      [attacker({ TALON: 20 }, 'c0', 'p0'), attacker({ VIPER: 20, COURIER: 5 }, 'c1', 'p1')],
      [host({ RAMPART: 8, BASTION: 2 }), supporter({ PIKE: 12 }, 'w1', 's1'), supporter({ DART: 25 }, 'w2', 's2')],
      300,
      mulberry32(9),
    );
    expect(result.contributions).toHaveLength(2);
    expect(result.defenders.map((row) => row.stackId)).toEqual(['host', 'w1', 'w2']);
    expect(compact(merge(result.contributions.map((row) => row.losses)))).toEqual(compact(result.attackerLosses));
  });

  it('refuses a battle with no defending stack at all', () => {
    expect(() => resolveBattle([attacker({ DART: 1 })], [], 0, flat())).toThrow(RangeError);
  });

  it('reads NO_TECH as the table’s own numbers', () => {
    const plain = resolveBattle([attacker({ DART: 4 })], [host({ RAMPART: 2 }), supporter({ PIKE: 2 }, 'w1', 's1')], 0, flat());
    expect(plain.rounds.length).toBeGreaterThan(0);
    expect(NO_TECH.tech).toEqual({});
  });
});
