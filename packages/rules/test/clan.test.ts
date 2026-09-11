import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  CLAN,
  clanAidAllowance,
  clanAidRemaining,
  clanAidTravelMinutes,
  clanAidValue,
  clanBayAvailable,
  clanChatMessageIsValid,
  clanNameIsReserved,
  clanNameIsValid,
  clanNameKey,
  clanPurseRemaining,
  clanTagIsValid,
  RESEARCH_TECH,
  TRANSFER_CARGO_HULLS,
  cargoMult,
  clanTransferCargoCapacity,
  transferCargoCapacity,
  clanTransferFleetIsValid,
  normaliseClanName,
  normaliseClanTag,
  MULTI_WORLD,
  HULLS,
  resourcesFit,
  splitClanRaidLoot,
  type Resources,
} from '../src/index.js';

const resources = (alloy: number, crystal: number, deuterium: number): Resources => ({
  alloy,
  crystal,
  deuterium,
});

describe('D114 clan identity and fixed rules', () => {
  it('locks the approved membership and economy figures', () => {
    expect(CLAN.maxMembers).toBe(5);
    expect(CLAN.founderCoreLevel).toBe(7);
    expect(CLAN.creationCost).toEqual(
      resources(8217, 4109, 0),
    );
    expect(CLAN.adaptationMinutes).toBe(720);
    expect(CLAN.attackLimit).toBe(5);
    expect(CLAN.raidLootShare).toBe(0.10);
    expect(CLAN.aidSpeedMultiplier).toBe(1.10);
    expect(MULTI_WORLD.neutralWorldRulesetVersion).toBe(2);
    expect(MULTI_WORLD.clanRulesetVersion).toBe(3);
  });

  it('normalises equivalent names and accepts only compact ASCII tags', () => {
    expect(normaliseClanName('  Kuzey   Yıldızı  ')).toBe('Kuzey Yıldızı');
    expect(clanNameKey('İSTİKBAL')).toBe(clanNameKey('istikbal'));
    expect(normaliseClanTag('  a7  ')).toBe('A7');
    expect(clanTagIsValid('a7')).toBe(true);
    expect(clanTagIsValid('A-7')).toBe(false);
    expect(clanTagIsValid('A')).toBe(false);
    expect(clanNameIsValid('Kuzey Yıldızı')).toBe(true);
    expect(clanNameIsReserved('Asterá')).toBe(true);
    expect(clanNameIsValid('admin')).toBe(false);
  });

  it('bounds chat by Unicode characters rather than UTF-16 units', () => {
    expect(clanChatMessageIsValid('🚀'.repeat(280))).toBe(true);
    expect(clanChatMessageIsValid('🚀'.repeat(281))).toBe(false);
    expect(clanChatMessageIsValid('   ')).toBe(false);
  });
});

describe('D114 clan aid', () => {
  it('allows only ordinary mobile hulls and gives cargo capacity only to transports', () => {
    expect(clanTransferFleetIsValid({ DART: 1, COURIER: 2 })).toBe(true);
    expect(clanTransferFleetIsValid({ PROSPECTOR: 1 })).toBe(false);
    expect(clanTransferFleetIsValid({ BASTION: 1 })).toBe(false);
    expect(clanTransferFleetIsValid({ DART: 0 })).toBe(false);
    const transports = { WAYFARER: 2, COURIER: 20, ATLAS: 1 };
    expect(clanTransferCargoCapacity(transports, {})).toBe(
      2 * HULLS.WAYFARER.cargo + 20 * HULLS.COURIER.cargo + HULLS.ATLAS.cargo,
    );
    expect(clanTransferCargoCapacity({ DART: 20 }, {})).toBe(0);
  });

  /**
   * EVERY DEDICATED TRANSPORT COUNTS, READ OFF THE LIST RATHER THAN RETYPED.
   *
   * This function named its three carriers by hand, so D196's fourth arrived
   * invisible: an Argosy loaded with ore for a clanmate measured as a hold of
   * ZERO. `TRANSFER_CARGO_HULLS` is the one statement of which hulls carry, and
   * the two ways to move ore have to read the same list or a hull that moves ore
   * between a commander's own worlds cannot move it to a teammate.
   */
  it('counts every dedicated transport, including the ones added later', () => {
    for (const id of TRANSFER_CARGO_HULLS) {
      expect(clanTransferCargoCapacity({ [id]: 1 }, {}), id).toBe(HULLS[id].cargo);
    }
    const all = Object.fromEntries(TRANSFER_CARGO_HULLS.map((id) => [id, 2]));
    expect(clanTransferCargoCapacity(all, {})).toBe(
      TRANSFER_CARGO_HULLS.reduce((sum, id) => sum + 2 * HULLS[id].cargo, 0),
    );
  });

  /**
   * CARGO HOLDS LIFTS A CLANMATE'S DELIVERY TOO. D197, owner instruction:
   * *"sayılmalı"*.
   *
   * D181 put the research on `fleetCargo` AND `transferCargoCapacity` for a reason
   * it stated plainly — a commander who buys a project called Cargo Holds and
   * watches a hold carry exactly what it carried yesterday has learned the game
   * lied to them — and then left clan aid out, which made the lie smaller rather
   * than gone: the hold grew for your own worlds and not for your teammate's.
   *
   * `tech` IS REQUIRED, like the other two. An optional argument is how a caller
   * silently gets the unlifted figure, and this function has three callers.
   */
  it('lifts a clanmate delivery by exactly the same ladder', () => {
    const fleet = { ATLAS: 2, COURIER: 4 };
    for (let level = 0; level <= RESEARCH_TECH.cargoLadder.length; level += 1) {
      const tech = { CARGO_HOLDS: level };
      expect(clanTransferCargoCapacity(fleet, tech), `L${String(level)}`)
        .toBe(Math.floor(clanTransferCargoCapacity(fleet, {}) * cargoMult(tech)));
    }
    const top = { CARGO_HOLDS: RESEARCH_TECH.cargoLadder.length };
    expect(clanTransferCargoCapacity(fleet, top))
      .toBeGreaterThan(clanTransferCargoCapacity(fleet, {}));
  });

  /** And it lifts it by the SAME amount a commander's own transfer gets. */
  it('never diverges from a commander own transfer', () => {
    const fleet = { ATLAS: 3, WAYFARER: 2 };
    for (const level of [0, 2, RESEARCH_TECH.cargoLadder.length]) {
      const tech = { CARGO_HOLDS: level };
      expect(clanTransferCargoCapacity(fleet, tech), `L${String(level)}`)
        .toBe(transferCargoCapacity(fleet, tech));
    }
  });

  it('charges gifted hulls at full per-resource build cost', () => {
    const fleet = { DART: 2, COURIER: 1, NULLIFIER: 1 } as const;
    const cargo = resources(100, 200, 30);
    expect(clanAidValue(fleet, cargo)).toEqual(resources(
      cargo.alloy + 2 * HULLS.DART.alloy + HULLS.COURIER.alloy + HULLS.NULLIFIER.alloy,
      cargo.crystal + 2 * HULLS.DART.crystal + HULLS.COURIER.crystal + HULLS.NULLIFIER.crystal,
      cargo.deuterium
        + 2 * HULLS.DART.deuterium + HULLS.COURIER.deuterium + HULLS.NULLIFIER.deuterium,
    ));
  });

  it('derives receiver-wide allowances and never carries debt between resources', () => {
    const allowance = clanAidAllowance({
      alloyPerHour: 1_250.9,
      crystalPerHour: 700.9,
      deuteriumCapacity: 9_999,
    });
    expect(allowance).toEqual(resources(5_003, 2_803, 1_999));
    expect(clanAidRemaining(allowance, resources(6_000, 803, 2_000)))
      .toEqual(resources(0, 2_000, 0));
    expect(resourcesFit(resources(100, 201, 0), resources(100, 200, 999))).toBe(false);
  });

  it('reserves the extra bay solely for clan aid and applies speed to time', () => {
    expect(clanBayAvailable(5, 4, false)).toBe(true);
    expect(clanBayAvailable(5, 5, false)).toBe(false);
    expect(clanBayAvailable(5, 5, true)).toBe(true);
    expect(clanBayAvailable(5, 6, true)).toBe(false);
    expect(clanAidTravelMinutes(110)).toBeCloseTo(100);
  });
});

describe('D114 clan loot purse', () => {
  it('uses the stricter of production, deuterium and protected-storage ceilings', () => {
    expect(clanPurseRemaining({
      alloyPerHour: 1_000,
      crystalPerHour: 500,
      deuteriumCapacity: 5_000,
      storageCapacity: resources(10_000, 4_000, 2_000),
      vaultProtection: resources(3_500, 1_500, 500),
      unclaimed: resources(400, 300, 300),
    })).toEqual(resources(1_000, 160, 180));
  });

  it('splits the approved five-person example without creating resources', () => {
    const recipients = Array.from({ length: 5 }, (_, index) => ({
      playerId: `p${index}`,
      capacityRemaining: resources(1_000, 1_000, 1_000),
    }));
    const split = splitClanRaidLoot(resources(1_000, 503, 99), recipients);

    expect(split.pool).toEqual(resources(100, 50, 9));
    expect(split.offerPerMember).toEqual(resources(20, 10, 1));
    expect(split.credited).toEqual(resources(100, 50, 5));
    expect(split.attackerLanding).toEqual(resources(900, 453, 94));
  });

  it('keeps a blocked share and rounding remainder with the attacker', () => {
    const split = splitClanRaidLoot(resources(1_000, 0, 0), [
      { playerId: 'attacker', capacityRemaining: resources(1_000, 0, 0) },
      { playerId: 'full', capacityRemaining: resources(0, 0, 0) },
      { playerId: 'member', capacityRemaining: resources(1_000, 0, 0) },
    ]);

    expect(split.offerPerMember.alloy).toBe(33);
    expect(split.credited.alloy).toBe(66);
    expect(split.attackerLanding.alloy).toBe(934);
  });

  it('does not share for a solo snapshot', () => {
    const split = splitClanRaidLoot(resources(1_000, 500, 100), [{
      playerId: 'attacker',
      capacityRemaining: resources(1_000, 1_000, 1_000),
    }]);
    expect(split.credited).toEqual(resources(0, 0, 0));
    expect(split.attackerLanding).toEqual(resources(1_000, 500, 100));
  });

  it('property: every credited unit is deducted from the landing exactly once', () => {
    fc.assert(fc.property(
      fc.record({
        alloy: fc.integer({ min: 0, max: 1_000_000 }),
        crystal: fc.integer({ min: 0, max: 1_000_000 }),
        deuterium: fc.integer({ min: 0, max: 1_000_000 }),
      }),
      fc.array(fc.record({
        alloy: fc.integer({ min: 0, max: 100_000 }),
        crystal: fc.integer({ min: 0, max: 100_000 }),
        deuterium: fc.integer({ min: 0, max: 100_000 }),
      }), { minLength: 0, maxLength: 5 }),
      (returned, capacities) => {
        const split = splitClanRaidLoot(returned, capacities.map((capacity, index) => ({
          playerId: `p${index}`,
          capacityRemaining: capacity,
        })));
        expect(split.attackerLanding.alloy + split.credited.alloy).toBe(returned.alloy);
        expect(split.attackerLanding.crystal + split.credited.crystal).toBe(returned.crystal);
        expect(split.attackerLanding.deuterium + split.credited.deuterium).toBe(returned.deuterium);
      },
    ));
  });
});
