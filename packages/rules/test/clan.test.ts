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
  clanTransferCargoCapacity,
  clanTransferFleetIsValid,
  normaliseClanName,
  normaliseClanTag,
  MULTI_WORLD,
  ECONOMY_TEMPO,
  HULLS,
  scaleResources,
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
      scaleResources(resources(5_000, 3_000, 0), ECONOMY_TEMPO.fixedPrice),
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
    expect(clanTransferCargoCapacity(transports)).toBe(
      2 * HULLS.WAYFARER.cargo + 20 * HULLS.COURIER.cargo + HULLS.ATLAS.cargo,
    );
    expect(clanTransferCargoCapacity({ DART: 20 })).toBe(0);
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
