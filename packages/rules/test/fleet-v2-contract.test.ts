import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  COMBAT,
  GROUND_HULLS,
  HULLS,
  MOBILE_HULLS,
  MULTI_WORLD,
  NON_COMBATANT_HULLS,
  OPENING_BONUS,
  PLANET_START,
  REWARD_CHAINS,
  RESEARCH_PROJECT_IDS,
  START,
  counterMult,
  fleetCargo,
  fleetSpeed,
  hullBulk,
  hullBuildable,
  hullRequirementsMet,
  resolveCombat,
  transferCargoCapacity,
  upgradeCost,
} from '../src/index.js';

const fleetV2 = [
  { id: 'DART', tier: 1, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER' },
  { id: 'PIKE', tier: 1, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE' },
  { id: 'RAMPART', tier: 1, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK' },
  { id: 'WARDEN', tier: 1, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK' },
  { id: 'COURIER', tier: 1, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT' },
  { id: 'VIPER', tier: 2, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER' },
  { id: 'TALON', tier: 2, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE' },
  { id: 'STRONGHOLD', tier: 2, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK' },
  { id: 'SENTINEL', tier: 2, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK' },
  { id: 'WAYFARER', tier: 2, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT' },
  { id: 'TEMPEST', tier: 3, family: 'OFFENSIVE', profile: 'RAIDER', cls: 'SKIRMISHER' },
  { id: 'BALLISTA', tier: 3, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE' },
  { id: 'LEVIATHAN', tier: 3, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK' },
  { id: 'PRAETORIAN', tier: 3, family: 'DEFENSIVE', profile: 'ESCORT', cls: 'BULWARK' },
  { id: 'ATLAS', tier: 3, family: 'CARGO', profile: 'TRANSPORT', cls: 'SUPPORT' },
  { id: 'NULLIFIER', tier: 3, family: 'SPECIALIST', profile: 'SHIELD_BREAKER', cls: 'LANCE' },
  { id: 'CATACLYSM', tier: 4, family: 'OFFENSIVE', profile: 'STRIKER', cls: 'LANCE' },
  { id: 'CITADEL', tier: 4, family: 'DEFENSIVE', profile: 'FORTRESS', cls: 'BULWARK' },
] as const;

const fleetV2Ids = fleetV2.map(({ id }) => id);
const preservedIds = ['BASTION', 'THORN', 'PROSPECTOR'] as const;
const retiredIds = ['WASP', 'LANCE', 'BULWARK', 'HAULER', 'RUNNER', 'BREACHER'] as const;
const shipyardGate = {
  DART: 0,
  PIKE: 0,
  RAMPART: 0,
  WARDEN: 0,
  COURIER: 1,
  VIPER: 2,
  TALON: 2,
  STRONGHOLD: 2,
  SENTINEL: 2,
  WAYFARER: 2,
  TEMPEST: 4,
  BALLISTA: 4,
  LEVIATHAN: 4,
  PRAETORIAN: 4,
  ATLAS: 4,
  NULLIFIER: 4,
  CATACLYSM: 6,
  CITADEL: 6,
} as const;

const researchGate: Record<string, readonly { project: string; level: number }[]> = {
  DART: [],
  PIKE: [],
  RAMPART: [],
  WARDEN: [],
  COURIER: [],
  VIPER: [],
  TALON: [],
  STRONGHOLD: [],
  SENTINEL: [],
  WAYFARER: [],
  TEMPEST: [
    { project: 'STARSHIP_ENGINEERING', level: 1 },
    { project: 'SHIP_POWER', level: 2 },
  ],
  BALLISTA: [
    { project: 'STARSHIP_ENGINEERING', level: 1 },
    { project: 'SHIP_POWER', level: 2 },
  ],
  LEVIATHAN: [
    { project: 'STARSHIP_ENGINEERING', level: 1 },
    { project: 'SHIP_ARMOR', level: 2 },
  ],
  PRAETORIAN: [
    { project: 'STARSHIP_ENGINEERING', level: 1 },
    { project: 'SHIP_ARMOR', level: 2 },
  ],
  ATLAS: [
    { project: 'STARSHIP_ENGINEERING', level: 1 },
    { project: 'SHIP_PROPULSION', level: 2 },
  ],
  NULLIFIER: [
    { project: 'STARSHIP_ENGINEERING', level: 1 },
    { project: 'GRAVITIC_CHARGES', level: 1 },
  ],
  CATACLYSM: [
    { project: 'STARSHIP_ENGINEERING', level: 2 },
    { project: 'SHIP_POWER', level: 4 },
    { project: 'SHIP_ARMOR', level: 2 },
  ],
  CITADEL: [
    { project: 'STARSHIP_ENGINEERING', level: 2 },
    { project: 'SHIP_ARMOR', level: 4 },
    { project: 'SHIP_POWER', level: 2 },
  ],
};

const hullByRuntimeId = (id: string) =>
  Object.entries(HULLS).find(([candidate]) => candidate === id)?.[1];

const runtimeProperty = (value: object, property: string): unknown =>
  Object.entries(value).find(([candidate]) => candidate === property)?.[1];

describe('Fleet V2 catalog contract — D148', () => {
  it('replaces every retired ordinary hull with all eighteen supplied craft', () => {
    expect([...Object.keys(HULLS)].sort()).toEqual([...fleetV2Ids, ...preservedIds].sort());
    expect([...ALL_HULLS].sort()).toEqual([...fleetV2Ids, ...preservedIds].sort());
    expect([...MOBILE_HULLS].sort()).toEqual([...fleetV2Ids].sort());
    expect(GROUND_HULLS).toEqual(['BASTION', 'THORN']);
    expect(NON_COMBATANT_HULLS).toEqual(['PROSPECTOR']);

    for (const retired of retiredIds) {
      expect(hullByRuntimeId(retired), retired).toBeUndefined();
    }
  });

  it('publishes tier, family and tactical profile instead of reconstructing them in callers', () => {
    for (const expected of fleetV2) {
      const hull = hullByRuntimeId(expected.id);
      if (!hull) throw new Error(`missing Fleet V2 hull ${expected.id}`);

      expect(hull.id).toBe(expected.id);
      expect(hull.cls).toBe(expected.cls);
      expect(runtimeProperty(hull, 'tier'), `${expected.id} tier`).toBe(expected.tier);
      expect(runtimeProperty(hull, 'family'), `${expected.id} family`).toBe(expected.family);
      expect(runtimeProperty(hull, 'profile'), `${expected.id} profile`).toBe(expected.profile);
      expect(runtimeProperty(hull, 'requiredResearch'), `${expected.id} requirements`)
        .toBeInstanceOf(Array);
      expect(hull.minShipyard, `${expected.id} Shipyard gate`).toBe(shipyardGate[expected.id]);
      expect(hull.ground).toBe(false);
      expect(hull.speed).toBeGreaterThan(0);

      const requirements = runtimeProperty(hull, 'requiredResearch');
      if (!Array.isArray(requirements)) {
        throw new Error(`invalid research requirements for ${expected.id}`);
      }
      expect(requirements, `${expected.id} research gate`).toEqual(researchGate[expected.id]);
    }

    const nullifier = hullByRuntimeId('NULLIFIER');
    if (!nullifier) throw new Error('missing Fleet V2 hull NULLIFIER');
    expect(runtimeProperty(nullifier, 'requiredResearch')).toEqual(expect.arrayContaining([
      expect.objectContaining({ project: 'GRAVITIC_CHARGES', level: 1 }),
    ]));
  });

  it('answers the full Shipyard and research gate from one shared rule', () => {
    expect(hullRequirementsMet('DART', {})).toBe(true);
    expect(hullBuildable('DART', 0, {})).toBe(true);
    expect(hullBuildable('COURIER', 0, {})).toBe(false);
    expect(hullBuildable('COURIER', 1, {})).toBe(true);

    expect(hullBuildable('TEMPEST', 4, {
      STARSHIP_ENGINEERING: 1,
      SHIP_POWER: 1,
    })).toBe(false);
    expect(hullBuildable('TEMPEST', 3, {
      STARSHIP_ENGINEERING: 1,
      SHIP_POWER: 2,
    })).toBe(false);
    expect(hullBuildable('TEMPEST', 4, {
      STARSHIP_ENGINEERING: 1,
      SHIP_POWER: 2,
    })).toBe(true);

    expect(hullRequirementsMet('CATACLYSM', {
      STARSHIP_ENGINEERING: 2,
      SHIP_POWER: 4,
      SHIP_ARMOR: 1,
    })).toBe(false);
    expect(hullRequirementsMet('CATACLYSM', {
      STARSHIP_ENGINEERING: 2,
      SHIP_POWER: 4,
      SHIP_ARMOR: 2,
    })).toBe(true);
  });

  it('leaves the ground and mining craft numerically untouched', () => {
    expect(HULLS.BASTION).toMatchObject({
      id: 'BASTION', cls: 'BULWARK', atk: 118, hp: 906, speed: 0, cargo: 0,
      minShipyard: 1, ground: true,
    });
    expect(HULLS.THORN).toMatchObject({
      id: 'THORN', cls: 'SKIRMISHER', atk: 49, hp: 174, speed: 0, cargo: 0,
      minShipyard: 0, ground: true,
    });
    expect(HULLS.PROSPECTOR).toMatchObject({
      id: 'PROSPECTOR', cls: 'SUPPORT', atk: 0, hp: 150, speed: 825, cargo: 300,
      minShipyard: 1, ground: false,
    });
  });

  it('keeps the visible counter cycle and bounded three-round combat', () => {
    expect(counterMult('SKIRMISHER', 'BULWARK')).toBe(1.6);
    expect(counterMult('BULWARK', 'LANCE')).toBe(1.6);
    expect(counterMult('LANCE', 'SKIRMISHER')).toBe(1.6);
    expect(counterMult('BULWARK', 'SKIRMISHER')).toBe(0.625);
    expect(COMBAT).toMatchObject({
      rounds: 3,
      varianceMin: 0.92,
      varianceMax: 1.08,
      strongMult: 1.6,
      weakMult: 0.625,
    });
  });

  it('derives speed, cargo and price-based bulk from the new catalog partitions', () => {
    const dart = hullByRuntimeId('DART');
    const courier = hullByRuntimeId('COURIER');
    const citadel = hullByRuntimeId('CITADEL');
    if (!dart || !courier || !citadel) throw new Error('missing Fleet V2 derived-mechanic fixture');

    const mixedFleet: Record<string, number> = { DART: 2, COURIER: 3, CITADEL: 1 };
    expect(fleetSpeed(mixedFleet)).toBe(Math.min(dart.speed, courier.speed, citadel.speed));
    expect(fleetCargo(mixedFleet, {})).toBe(2 * dart.cargo + 3 * courier.cargo + citadel.cargo);
    expect(transferCargoCapacity(mixedFleet)).toBe(3 * courier.cargo);
    expect(courier.cargo).toBeGreaterThan(dart.cargo);

    for (const id of fleetV2Ids) {
      const hull = hullByRuntimeId(id);
      if (!hull) throw new Error(`missing Fleet V2 hull ${id}`);
      expect(hullBulk(hull.id), `${id} bulk`).toBeGreaterThan(0);
    }
  });

  it('keeps cargo protected by combat escorts', () => {
    const escorted: Record<string, number> = { DART: 30, COURIER: 10 };
    const result = resolveCombat(
      escorted,
      { BASTION: 1 },
      0,
      () => 0.5,
      { attacker: { tech: {} }, defender: { tech: {} } },
    );
    const firstRound = result.rounds[0];
    if (!firstRound) throw new Error('missing escorted-combat round');
    expect(runtimeProperty(firstRound.attackerLosses, 'COURIER')).toBeUndefined();
  });

  it('exposes support only after its last combat escort is gone', () => {
    const result = resolveCombat(
      { DART: 1, COURIER: 10 },
      { BASTION: 20 },
      0,
      () => 0.5,
      { attacker: { tech: {} }, defender: { tech: {} } },
    );

    const [firstRound, ...laterRounds] = result.rounds;
    if (!firstRound) throw new Error('missing support-order round');
    expect(runtimeProperty(firstRound.attackerLosses, 'COURIER')).toBeUndefined();
    expect(laterRounds.some(
      (round) => Number(runtimeProperty(round.attackerLosses, 'COURIER') ?? 0) > 0,
    )).toBe(true);
  });

  it('makes the scouted counter win the equal-budget exchange in the full resolver', () => {
    const budget = 120_000;
    const favorablePairs = [
      ['DART', 'RAMPART'],
      ['RAMPART', 'PIKE'],
      ['PIKE', 'DART'],
    ] as const;

    for (const [attacker, defender] of favorablePairs) {
      const attackingHull = hullByRuntimeId(attacker);
      const defendingHull = hullByRuntimeId(defender);
      if (!attackingHull || !defendingHull) {
        throw new Error(`missing equal-budget fixture ${attacker}/${defender}`);
      }
      const attackerCost = attackingHull.alloy + attackingHull.crystal + attackingHull.deuterium;
      const defenderCost = defendingHull.alloy + defendingHull.crystal + defendingHull.deuterium;
      const attackCount = Math.max(1, Math.floor(budget / attackerCost));
      const defendCount = Math.max(1, Math.floor(budget / defenderCost));
      const result = resolveCombat(
        { [attacker]: attackCount },
        { [defender]: defendCount },
        0,
        () => 0.5,
        { attacker: { tech: {} }, defender: { tech: {} } },
      );

      expect(
        result.defenderLossValue,
        `${attacker} should exchange favorably into ${defender}`,
      ).toBeGreaterThan(result.attackerLossValue);
    }
  });

  it('moves the shield-only specialist trace to Nullifier without allowing spill', () => {
    const nullifiers: Record<string, number> = { NULLIFIER: 4 };
    const withoutShield = resolveCombat(
      nullifiers, { BASTION: 1 }, 0, () => 0.5, { attacker: { tech: {} }, defender: { tech: {} } },
    );
    const almostEmptyShield = resolveCombat(
      nullifiers, { BASTION: 1 }, 1, () => 0.5, { attacker: { tech: {} }, defender: { tech: {} } },
    );
    const firstRound = almostEmptyShield.rounds[0];
    if (!firstRound) throw new Error('missing Nullifier combat round');

    expect(runtimeProperty(firstRound, 'shieldBreakerDamage')).toBe(1);
    expect(almostEmptyShield.defenderSurvivors).toEqual(withoutShield.defenderSurvivors);
    expect(almostEmptyShield.defenderLosses).toEqual(withoutShield.defenderLosses);
    expect(withoutShield.rounds.every(
      (round) => runtimeProperty(round, 'shieldBreakerDamage') === 0,
    )).toBe(true);
  });

  it('derives the guided opening from exactly two Darts', () => {
    const dart = hullByRuntimeId('DART');
    if (!dart) throw new Error('missing guided-opening hull DART');
    const step = upgradeCost(1);

    expect(START).toEqual({
      alloy: 3 * step.alloy + 2 * dart.alloy,
      crystal: 3 * step.crystal + 2 * dart.crystal,
      deuterium: 0,
    });
    expect(PLANET_START).toEqual({
      alloy: START.alloy + OPENING_BONUS.alloy,
      crystal: START.crystal + OPENING_BONUS.crystal,
      deuterium: START.deuterium + OPENING_BONUS.deuterium,
    });
  });

  it('uses only Fleet V2 hulls in new-season neutral fleets', () => {
    const allowed = new Set<string>(fleetV2Ids);
    const tierOne = MULTI_WORLD.neutral[1].fleet as Record<string, number>;
    const tierTwo = MULTI_WORLD.neutral[2].fleet as Record<string, number>;
    const tierThree = MULTI_WORLD.neutral[3].fleet as Record<string, number>;

    expect(Object.keys(tierOne)).toHaveLength(0);
    expect(Object.keys(tierTwo).length).toBeGreaterThan(0);
    expect(Object.keys(tierThree).length).toBeGreaterThan(0);
    for (const fleet of [tierOne, tierTwo, tierThree]) {
      for (const id of Object.keys(fleet)) expect(allowed.has(id), id).toBe(true);
      for (const retired of retiredIds) expect(fleet[retired], retired).toBeUndefined();
    }
  });

  it('expresses settlement as exactly two Couriers without a retired Hauler field', () => {
    expect(runtimeProperty(MULTI_WORLD.settlement, 'transportHull')).toBe('COURIER');
    expect(runtimeProperty(MULTI_WORLD.settlement, 'transports')).toBe(2);
    expect(runtimeProperty(MULTI_WORLD.settlement, 'haulers')).toBeUndefined();
  });

  it('keeps the ship reward generic and above the two staged opening craft', () => {
    const chain = REWARD_CHAINS.find(({ id }) => id === 'SHIPS');
    expect(chain?.metric).toBe('count');
    expect(chain?.tiers[0]?.goal).toBeGreaterThan(2);
  });
});

describe('Fleet V2 research identity contract', () => {
  it('replaces four obsolete space projects and preserves Emplacement Doctrine', () => {
    const expected = [
      'ISOTOPE_SPECTROMETRY',
      'DENSE_FUEL_CELLS',
      'GRAVITIC_CHARGES',
      'DEATH_STAR_PROTOCOL',
      'DEUTERIUM_SYNTHESIS',
      'YARD_AUTOMATION',
      'PROSPECTOR_HOLDS',
      'CARGO_HOLDS',
      'STARSHIP_ENGINEERING',
      'SHIP_POWER',
      'SHIP_ARMOR',
      'SHIP_PROPULSION',
      'EMPLACEMENT_DOCTRINE',
      'INTERCEPTION_GRID',
      'STRATEGIC_STOCKPILE',
    ];

    expect([...RESEARCH_PROJECT_IDS].sort()).toEqual(expected.sort());
    expect(RESEARCH_PROJECT_IDS).toContain('EMPLACEMENT_DOCTRINE');
    for (const retired of [
      'WASP_DOCTRINE', 'LANCE_DOCTRINE', 'BULWARK_DOCTRINE', 'WEAPONS_GENERAL',
    ]) {
      expect(RESEARCH_PROJECT_IDS, retired).not.toContain(retired);
    }
  });
});
