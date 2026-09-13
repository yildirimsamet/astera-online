import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_HULLS,
  DEBRIS,
  FUEL,
  HULLS,
  MOBILE_HULLS,
  NON_COMBATANT_HULLS,
  PIRATE,
  SALVAGE,
  TRANSFER_CARGO_HULLS,
  combatValue,
  fleetCargo,
  fleetValue,
  generatePirateSchedule,
  hullFuelMass,
  hullFuelRate,
  hullRoundTrip,
  missionFuel,
  mulberry32,
  pirateRoster,
  pirateHoard,
  pirateAdmissionCost,
  profileFlightSpeed,
  resourceValue,
  resolveCombat,
  salvageCapacity,
  seededFrom,
  settleWreck,
  transferCargoCapacity,
  unarmedCount,
  type Fleet,
  type Resources,
} from '../src/index.js';

const total = (r: Resources): number => r.alloy + r.crystal + r.deuterium;
const NO_TECH = { attacker: { tech: {} }, defender: { tech: {} } } as const;

/**
 * THE GARBAGE COLLECTOR. D200, owner instruction.
 *
 * *"Filo ile gider yük gemisi gibi en son atışları bu gemi yer yani en arkada
 * durur, savaş bitiminde geri dönerken debris oluşmuşsa 15k debris'ten alır."*
 *
 * A Special hull that fires nothing, flies behind the line like a transport, and
 * on the way home lifts up to `SALVAGE.perCollector` of the wreck its own battle
 * made — split the way the wreck is split. It is never a hold: the loot ceiling
 * does not see it, and it can never be aimed at a field or a rock on its own.
 */
describe('the Garbage Collector in the catalogue', () => {
  const gc = HULLS.GARBAGE_COLLECTOR;

  it('is a tier-three Special hull behind the Nullifier’s gate', () => {
    expect(gc).toMatchObject({
      id: 'GARBAGE_COLLECTOR',
      tier: 3,
      family: 'SPECIALIST',
      profile: 'COLLECTOR',
      cls: 'SUPPORT',
      minShipyard: 4,
      ground: false,
    });
    expect(gc.requiredResearch).toEqual([{ project: 'STARSHIP_ENGINEERING', level: 1 }]);
  });

  it('costs exactly what the owner set: 10k alloy and 5k crystal, nothing else', () => {
    expect([gc.alloy, gc.crystal, gc.deuterium]).toEqual([10_000, 5_000, 0]);
  });

  it('fires nothing and carries nothing', () => {
    expect(gc.atk).toBe(0);
    expect(gc.cargo).toBe(0);
  });

  it('is exactly as sturdy as the transport of its tier', () => {
    expect(gc.hp).toBe(HULLS.ATLAS.hp);
  });

  /**
   * "ORTALAMA BİR HIZ." The pivot trip is the middle of the counter triangle —
   * Skirmisher 15, Lance 20, Bulwark 25 — and the trip fuel and holds are neutral
   * at, so a Lance wing is not slowed by one and a Bulwark wing never is.
   */
  it('flies at the pivot pace, the middle of the combat triangle', () => {
    expect(hullRoundTrip('GARBAGE_COLLECTOR')).toBe(FUEL.pivotRoundTrip);
    expect(gc.speed).toBeCloseTo(profileFlightSpeed(FUEL.pivotRoundTrip), 9);
    expect(gc.speed).toBe(HULLS.PIKE.speed);
    expect(gc.speed).toBeLessThan(HULLS.DART.speed);
    expect(gc.speed).toBeGreaterThan(HULLS.RAMPART.speed);
  });

  /**
   * THE ONE HULL WHOSE THIRST IS SET BY HAND. Owner instruction: *"19.1 döteryum
   * yakıt çok. 10 yap."* Off its price it would drink 19.1 per thousand units — two
   * and a half Argosies — for a hull that fires nothing and carries nothing. The
   * owner's figure is the card's own unit, so it is stated in it.
   */
  it('drinks the owner’s ten per thousand units, not what its price would say', () => {
    expect(hullFuelRate('GARBAGE_COLLECTOR')).toBe(10);
    expect(hullFuelMass('GARBAGE_COLLECTOR')).toBe(SALVAGE.fuelMass);
    expect(hullFuelMass('GARBAGE_COLLECTOR')).toBeLessThan(Math.ceil(15_000 * FUEL.perValue));
    // Every other hull still drinks off its price.
    expect(hullFuelMass('ARGOSY')).toBe(
      Math.ceil(resourceValue(HULLS.ARGOSY) * FUEL.perValue * (FUEL.pivotRoundTrip / 38)),
    );
  });

  it('charges its fixed thirst on every leg like any other mass', () => {
    const alone = missionFuel({ DART: 10 }, 1_000, 2);
    const withOne = missionFuel({ DART: 10, GARBAGE_COLLECTOR: 1 }, 1_000, 2);
    expect(withOne).toBe(Math.ceil(((10 * hullFuelMass('DART') + SALVAGE.fuelMass) * 1_000) / FUEL.scale) * 2);
    expect(withOne).toBeGreaterThan(alone);
  });

  it('flies with a fleet but is neither a warship, a transport nor a civilian', () => {
    expect(MOBILE_HULLS).toContain('GARBAGE_COLLECTOR');
    expect(COMBAT_HULLS).not.toContain('GARBAGE_COLLECTOR');
    expect(TRANSFER_CARGO_HULLS as readonly string[]).not.toContain('GARBAGE_COLLECTOR');
    expect(NON_COMBATANT_HULLS).not.toContain('GARBAGE_COLLECTOR');
  });

  it('adds nothing to the loot ceiling or to a convoy hold', () => {
    const wing: Fleet = { DART: 4, COURIER: 1, GARBAGE_COLLECTOR: 3 };
    expect(fleetCargo(wing, {})).toBe(fleetCargo({ DART: 4, COURIER: 1 }, {}));
    expect(fleetCargo(wing, { CARGO_HOLDS: 4 })).toBe(fleetCargo({ DART: 4, COURIER: 1 }, { CARGO_HOLDS: 4 }));
    expect(transferCargoCapacity(wing, {})).toBe(transferCargoCapacity({ COURIER: 1 }, {}));
  });

  it('is part of what a fleet is worth, never part of what it can fire', () => {
    expect(fleetValue({ GARBAGE_COLLECTOR: 2 })).toBe(30_000);
    expect(combatValue({ DART: 1, GARBAGE_COLLECTOR: 2 })).toBe(combatValue({ DART: 1 }));
    expect(unarmedCount({ DART: 1, GARBAGE_COLLECTOR: 2 })).toBe(2);
  });
});

describe('the Garbage Collector in a fight', () => {
  it('deals no damage on its own', () => {
    const result = resolveCombat({ GARBAGE_COLLECTOR: 5 }, { DART: 1 }, 0, () => 0.5, NO_TECH);
    for (const round of result.rounds) expect(round.attackerDamage).toBe(0);
    expect(result.defenderLosses).toEqual({});
  });

  it('eats the last shots: covered while a combat hull on its side lives', () => {
    const result = resolveCombat(
      { DART: 30, GARBAGE_COLLECTOR: 2 },
      { BASTION: 1 },
      0,
      () => 0.5,
      NO_TECH,
    );
    const first = result.rounds[0];
    if (!first) throw new Error('missing first round');
    expect(first.attackerLosses.GARBAGE_COLLECTOR).toBeUndefined();
  });

  it('is prey once the line in front of it is gone', () => {
    const result = resolveCombat(
      { DART: 1, GARBAGE_COLLECTOR: 1 },
      { BASTION: 20 },
      0,
      () => 0.5,
      NO_TECH,
    );
    expect(result.attackerLosses.GARBAGE_COLLECTOR).toBe(1);
  });
});

describe('what a collector lifts off a wreck', () => {
  it('is fifteen thousand a hull, and only collectors count', () => {
    expect(SALVAGE.perCollector).toBe(15_000);
    expect(salvageCapacity({})).toBe(0);
    expect(salvageCapacity({ DART: 40, ARGOSY: 3 })).toBe(0);
    expect(salvageCapacity({ GARBAGE_COLLECTOR: 1 })).toBe(15_000);
    expect(salvageCapacity({ DART: 4, GARBAGE_COLLECTOR: 3 })).toBe(45_000);
  });

  it('takes in the wreck’s own proportions and leaves the rest in orbit', () => {
    const wreck = { alloy: 20_000, crystal: 8_000, deuterium: 2_000 };
    const { salvage, field } = settleWreck(wreck, { GARBAGE_COLLECTOR: 1 });
    expect(salvage).toEqual({ alloy: 10_000, crystal: 4_000, deuterium: 1_000 });
    expect(field).toEqual({ alloy: 10_000, crystal: 4_000, deuterium: 1_000 });
  });

  it('never takes more than its room, however big the wreck', () => {
    const wreck = { alloy: 123_456.7, crystal: 45_678.9, deuterium: 3_210.5 };
    for (let n = 1; n <= 4; n++) {
      const { salvage } = settleWreck(wreck, { GARBAGE_COLLECTOR: n });
      expect(total(salvage)).toBeLessThanOrEqual(n * SALVAGE.perCollector);
      expect(total(salvage)).toBeGreaterThan(n * SALVAGE.perCollector - 3);
    }
  });

  it('takes the whole wreck when it has the room, and leaves no field behind', () => {
    const wreck = { alloy: 6_000.4, crystal: 2_500.9, deuterium: 300.2 };
    const { salvage, field } = settleWreck(wreck, { GARBAGE_COLLECTOR: 1 });
    expect(salvage).toEqual({ alloy: 6_000, crystal: 2_500, deuterium: 300 });
    expect(field).toBeNull();
  });

  it('takes scraps a public field would not be worth, since it is already there', () => {
    const wreck = { alloy: 150, crystal: 50, deuterium: 0 };
    expect(total(wreck)).toBeLessThan(DEBRIS.minimum);
    const { salvage, field } = settleWreck(wreck, { GARBAGE_COLLECTOR: 1 });
    expect(salvage).toEqual({ alloy: 150, crystal: 50, deuterium: 0 });
    expect(field).toBeNull();
  });

  it('changes nothing about a wreck when no collector came home', () => {
    const wreck = { alloy: 3_141.59, crystal: 2_718.28, deuterium: 161.8 };
    for (const survivors of [{}, { DART: 9 }, { ARGOSY: 2, PALADIN: 1 }] as Fleet[]) {
      const { salvage, field } = settleWreck(wreck, survivors);
      expect(salvage).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
      expect(field).toEqual(wreck);
    }
  });

  it('keeps the public floor on what is LEFT, not on what the battle made', () => {
    // 15,200 made, 15,000 lifted: 200 stays, and 200 is no field at all.
    const made = { alloy: 15_200, crystal: 0, deuterium: 0 };
    expect(settleWreck(made, { GARBAGE_COLLECTOR: 1 }).field).toBeNull();
    // No collector: the old rule, exactly.
    expect(settleWreck({ alloy: DEBRIS.minimum - 1, crystal: 0, deuterium: 0 }, {}).field).toBeNull();
    expect(settleWreck({ alloy: DEBRIS.minimum, crystal: 0, deuterium: 0 }, {}).field)
      .toEqual({ alloy: DEBRIS.minimum, crystal: 0, deuterium: 0 });
  });

  it('never creates ore: salvage plus field is the wreck, column by column', () => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 500; i++) {
      const wreck = {
        alloy: rng() * 60_000,
        crystal: rng() * 25_000,
        deuterium: rng() * 3_000,
      };
      const n = Math.floor(rng() * 5);
      const { salvage, field } = settleWreck(wreck, { GARBAGE_COLLECTOR: n });
      for (const k of ['alloy', 'crystal', 'deuterium'] as const) {
        expect(Number.isInteger(salvage[k])).toBe(true);
        expect(salvage[k]).toBeGreaterThanOrEqual(0);
        expect(salvage[k]).toBeLessThanOrEqual(wreck[k]);
        if (field) expect(salvage[k] + field[k]).toBeCloseTo(wreck[k], 6);
      }
      expect(total(salvage)).toBeLessThanOrEqual(n * SALVAGE.perCollector);
    }
  });

  it('refuses nothing it is handed: an empty or negative wreck lifts nothing', () => {
    expect(settleWreck({ alloy: 0, crystal: 0, deuterium: 0 }, { GARBAGE_COLLECTOR: 2 }))
      .toEqual({ salvage: { alloy: 0, crystal: 0, deuterium: 0 }, field: null });
    expect(settleWreck({ alloy: -5, crystal: 0, deuterium: 0 }, { GARBAGE_COLLECTOR: 2 }).salvage)
      .toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
});

/**
 * A PIRATE NEVER FLIES ONE, AND THE LANE IS BYTE-FOR-BYTE WHAT IT WAS.
 *
 * A pirate is a pure function of the season key, re-derived on every read — so a
 * hull that joined the pool would re-deal every level-3 and level-4 roster in a
 * LIVE season, under crews commanders have already shot pieces off. The literals
 * below were recorded with the catalogue as it stood before the collector existed.
 */
describe('the pirate lane is untouched by the collector', () => {
  const recorded: Record<3 | 4, Fleet[]> = {
    3: [
      { BALLISTA: 1, LEVIATHAN: 1, TALON: 1, WARDEN: 1 },
      { LEVIATHAN: 2, TEMPEST: 1, RAMPART: 1, BALLISTA: 1 },
      { BALLISTA: 1, RAMPART: 1, LEVIATHAN: 1 },
      { LEVIATHAN: 1, COURIER: 1 },
    ],
    4: [
      { PALADIN: 1, RAMPART: 1, SENTINEL: 1, CATACLYSM: 2 },
      { PALADIN: 1, CITADEL: 1, VIPER: 1 },
      { CORSAIR: 1, BALLISTA: 1 },
      { CORSAIR: 1, TALON: 1, NULLIFIER: 1, DART: 1 },
    ],
  };

  it('deals the same rosters it dealt before', () => {
    for (const level of [3, 4] as const) {
      recorded[level].forEach((roster, seed) => {
        expect(pirateRoster(level, seededFrom('golden', level, seed))).toEqual(roster);
      });
    }
  });

  it('keeps the recorded admission prices and field membership through hull recalibration', () => {
    expect(pirateAdmissionCost({ VIPER: 1, CATACLYSM: 1 }))
      .toEqual({ alloy: 5250, crystal: 1380, deuterium: 88 });
    const field = generatePirateSchedule(mulberry32(7), 60 * 24 * 3);
    expect(field).toHaveLength(46);
    const atPreviousReward = (roster: Fleet): Resources => {
      const worth = total(pirateAdmissionCost(roster)) * PIRATE.hoardAdmissionValueMult;
      return {
        alloy: Math.floor(worth * PIRATE.hoardShare.alloy),
        crystal: Math.floor(worth * PIRATE.hoardShare.crystal),
        deuterium: Math.floor(worth * PIRATE.hoardShare.deuterium),
      };
    };
    const legacyDigest = createHash('sha256')
      .update(JSON.stringify(field.map((p) => [p.level, p.roster, atPreviousReward(p.roster)])))
      .digest('hex');
    expect(legacyDigest).toBe('77367da58012298942c177950c78b1a7b9bf4b352187caa38cb3ca93a3f381f2');

    // Rewards follow current replacement prices; admission and target IDs do not.
    for (const p of field) expect(p.hoard).toEqual(pirateHoard(p.roster));
    for (const id of MOBILE_HULLS) {
      const frozen = pirateAdmissionCost({ [id]: 1 });
      for (const key of ['alloy', 'crystal', 'deuterium'] as const) {
        expect(HULLS[id][key], `${id}: frozen admission must cover current liability`).toBeLessThanOrEqual(frozen[key]);
      }
    }
  });

  it('never puts a collector in a pirate crew', () => {
    for (const level of [1, 2, 3, 4] as const) {
      for (let seed = 0; seed < 400; seed++) {
        expect(pirateRoster(level, seededFrom('no-collector', level, seed)).GARBAGE_COLLECTOR)
          .toBeUndefined();
      }
    }
  });
});
