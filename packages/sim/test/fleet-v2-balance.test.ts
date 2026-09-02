import { describe, expect, it } from 'vitest';
import {
  COMBAT_HULLS,
  HULLS,
  RESEARCH_TECH,
  counterMult,
  exposureMinutes,
  fleetCargo,
  fleetTravelExact,
  hullBulk,
  missionFuel,
  radarLead,
  resolveCombat,
  shieldHp,
  shipMinutes,
  type Fleet,
  type HullId,
} from '@astera/rules';
import { runSeason } from '../src/index.js';

const value = (id: HullId): number =>
  HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;

const fleetAtValue = (id: HullId, budget = 240_000): Fleet => ({
  [id]: Math.max(1, Math.floor(budget / value(id))),
});

const fleetAtBulk = (id: HullId, capacity = 600): Fleet => ({
  [id]: Math.max(1, Math.floor(capacity / hullBulk(id))),
});

const exchange = (attacker: Fleet, defender: Fleet, attackerTech = {}) => {
  const result = resolveCombat(
    attacker, defender, 0, () => 0.5, { attacker: { tech: attackerTech }, defender: { tech: {} } },
  );
  return result.defenderLossValue - result.attackerLossValue;
};

describe('Fleet V2 all-pairs calibration — D148', () => {
  it.each([
    ['equal resource value', fleetAtValue],
    ['equal hangar bulk', fleetAtBulk],
  ] as const)('%s preserves every strong and weak side of the visible counter cycle', (_, fleet) => {
    for (const attacker of COMBAT_HULLS) {
      let strong = 0;
      let weak = 0;
      for (const defender of COMBAT_HULLS) {
        const margin = exchange(fleet(attacker), fleet(defender));
        const multiplier = counterMult(HULLS[attacker].cls, HULLS[defender].cls);
        if (multiplier > 1) {
          expect(margin, `${attacker} should trade up into ${defender}`).toBeGreaterThan(0);
          strong++;
        }
        if (multiplier < 1) {
          expect(margin, `${attacker} should trade down into ${defender}`).toBeLessThan(0);
          weak++;
        }
      }
      expect(strong, `${attacker} has no rational strong matchup`).toBeGreaterThan(0);
      expect(weak, `${attacker} has no rational weak matchup`).toBeGreaterThan(0);
    }
  });

  it('keeps a counter-aware mixed fleet favorable without solving every mixed fight', () => {
    const half = (first: HullId, second: HullId): Fleet => ({
      [first]: Math.floor(120_000 / value(first)),
      [second]: Math.floor(120_000 / value(second)),
    });
    expect(exchange(half('DART', 'PIKE'), half('RAMPART', 'DART'))).toBeGreaterThan(0);
  });

  it('keeps a correct low-tier counter stronger than a fully researched wrong counter', () => {
    const max = RESEARCH_TECH.weaponMaxLevel;
    const correct = exchange(fleetAtValue('DART'), fleetAtValue('RAMPART'));
    const wrong = exchange(
      fleetAtValue('PIKE'),
      fleetAtValue('RAMPART'),
      { SHIP_POWER: max, SHIP_ARMOR: max },
    );
    expect(correct).toBeGreaterThan(0);
    expect(wrong).toBeLessThan(0);
  });

  it('makes T4 efficient but still answerable by the correct lower-tier class', () => {
    expect(exchange(fleetAtValue('CATACLYSM'), fleetAtValue('PIKE'))).toBeGreaterThan(0);
    expect(exchange(fleetAtValue('RAMPART'), fleetAtValue('CATACLYSM'))).toBeGreaterThan(0);
    expect(exchange(fleetAtValue('CITADEL'), fleetAtValue('RAMPART'))).toBeGreaterThan(0);
    expect(exchange(fleetAtValue('DART'), fleetAtValue('CITADEL'))).toBeGreaterThan(0);
  });
});

describe('Fleet V2 mission-profile calibration — D148', () => {
  it('keeps Tempest as the combat speed ceiling and the heavy siege visibly slower', () => {
    expect(HULLS.TEMPEST.speed).toBe(Math.max(...COMBAT_HULLS.map((id) => HULLS[id].speed)));
    const fast = fleetTravelExact(800, { TEMPEST: 10 });
    const heavy = fleetTravelExact(800, { CITADEL: 10 });
    expect(fast).toBeLessThan(heavy);
    expect(exposureMinutes(fast)).toBeLessThan(exposureMinutes(heavy));
    expect(radarLead(400, 800, fast)).toBeLessThan(radarLead(400, 800, heavy));
  });

  it('keeps Courier useful for speed and Atlas useful for capacity efficiency', () => {
    expect(HULLS.COURIER.speed).toBeGreaterThan(HULLS.ATLAS.speed);
    expect(HULLS.ATLAS.cargo / value('ATLAS')).toBeGreaterThan(
      HULLS.COURIER.cargo / value('COURIER'),
    );
    expect(fleetTravelExact(800, { COURIER: 2 }))
      .toBeLessThan(fleetTravelExact(800, { ATLAS: 1 }));
    expect(fleetCargo({ ATLAS: 1 }, {})).toBeGreaterThan(fleetCargo({ COURIER: 2 }, {}));
  });

  it('charges heavy fleets more fuel and more replacement time', () => {
    expect(missionFuel({ CITADEL: 10 }, 800, 2)).toBeGreaterThan(
      missionFuel({ DART: 10 }, 800, 2),
    );
    expect(shipMinutes(HULLS.CITADEL, 6, {})).toBeGreaterThan(shipMinutes(HULLS.DART, 6, {}));
  });

  it('exposes unescorted cargo while escorts absorb the first casualties', () => {
    const bare = resolveCombat(
      { COURIER: 10 }, { DART: 10 }, 0, () => 0.5, { attacker: { tech: {} }, defender: { tech: {} } },
    );
    const escorted = resolveCombat(
      { DART: 10, COURIER: 10 }, { DART: 10 }, 0, () => 0.5, { attacker: { tech: {} }, defender: { tech: {} } },
    );
    expect(bare.rounds[0]?.attackerLosses.COURIER ?? 0).toBeGreaterThan(0);
    expect(escorted.rounds[0]?.attackerLosses.COURIER).toBeUndefined();
  });

  it('keeps Nullifier poor without a shield and bounded to live shield with one', () => {
    expect(exchange(fleetAtValue('NULLIFIER'), fleetAtValue('BASTION'))).toBeLessThan(
      exchange(fleetAtValue('BALLISTA'), fleetAtValue('BASTION')),
    );
    const result = resolveCombat(
      { NULLIFIER: 20 }, { BASTION: 4 }, shieldHp(5), () => 0.5,
      { attacker: { tech: {} }, defender: { tech: {} } },
    );
    expect(result.rounds.some((round) => round.shieldBreakerDamage > 0)).toBe(true);
    for (const round of result.rounds) {
      expect(round.shieldBreakerDamage).toBeLessThanOrEqual(round.shieldBefore ?? 0);
    }
  });

  it('leaves the preserved Bastion/Thorn mixture costly to assault', () => {
    const ground: Fleet = {
      BASTION: Math.floor(120_000 / value('BASTION')),
      THORN: Math.floor(120_000 / value('THORN')),
    };
    const counters: Fleet = {
      DART: Math.floor(120_000 / value('DART')),
      PIKE: Math.floor(120_000 / value('PIKE')),
    };
    const result = resolveCombat(
      counters, ground, 0, () => 0.5, { attacker: { tech: {} }, defender: { tech: {} } },
    );
    expect(result.attackerLossValue).toBeGreaterThan(120_000);
    expect(result.defenderLossValue).toBeGreaterThan(48_000);
  });
});

describe('Fleet V2 research pacing — D148', () => {
  it('opens T3 in the midgame and T4 in the late game rather than the opening', () => {
    const at = (days: number) => runSeason({
      players: 50,
      days,
      seed: 42,
      strategicLayer: false,
    }).world.players.filter((player) => player.type === 'GRINDER');

    const day7 = at(7);
    const day2 = at(2);
    const day4 = at(4);
    expect(day2.every((player) => (player.tech.SHIP_POWER ?? 0) === 0)).toBe(true);
    expect(day4.every((player) => (player.tech.SHIP_POWER ?? 0) <= 1)).toBe(true);
    expect(day7.some((player) =>
      (player.tech.STARSHIP_ENGINEERING ?? 0) >= 1
      && (player.tech.SHIP_POWER ?? 0) >= 2)).toBe(true);
    expect(day7.some((player) => (player.tech.SHIP_POWER ?? 0) >= 4)).toBe(false);

    const day12 = at(12);
    expect(day12.some((player) =>
      (player.tech.STARSHIP_ENGINEERING ?? 0) >= 2
      && (player.tech.SHIP_POWER ?? 0) >= 4
      && (player.tech.SHIP_ARMOR ?? 0) >= 2)).toBe(true);
    expect(day12.some((player) => (player.tech.SHIP_POWER ?? 0) < 4)).toBe(true);
  });
});
