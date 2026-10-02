import { describe, expect, it } from 'vitest';
import {
  CLAN_SUPPORT,
  DEFENCE_POSTURES,
  MULTI_WORLD,
  clanAidTravelMinutes,
  clanDefenseApplies,
  escapeAllowed,
  escapeVerdict,
  hangarCapacity,
  missionFuel,
  postureFromToggles,
  resolveRaid,
  supportBayRoom,
  supportFuel,
  supportTravelMinutes,
  togglesOf,
  type Fleet,
} from '../src/index.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the pure half (docs/clan-defense-support-plan.md, P0).
 */
describe('clan defence support — gate and constants', () => {
  it('arrives with ruleset 15 and never inside an older season', () => {
    expect(MULTI_WORLD.clanDefenseRulesetVersion).toBe(15);
    expect(clanDefenseApplies(14)).toBe(false);
    expect(clanDefenseApplies(15)).toBe(true);
    expect(clanDefenseApplies(16)).toBe(true);
  });

  it('is dealt to every new season once the whole feature is in (K11, P13)', () => {
    expect(MULTI_WORLD.rulesetVersion).toBeGreaterThanOrEqual(MULTI_WORLD.clanDefenseRulesetVersion);
    expect(clanDefenseApplies(MULTI_WORLD.rulesetVersion)).toBe(true);
  });

  it('holds a wave twelve hours and multiplies the host’s Dominion by at most five', () => {
    expect(CLAN_SUPPORT.stationHours).toBe(12);
    expect(CLAN_SUPPORT.maxDominionFactor).toBe(5);
  });
});

describe('defence posture — two toggles, never both on', () => {
  it('names exactly three postures', () => {
    expect([...DEFENCE_POSTURES]).toEqual(['ESCAPE', 'SUPPORT', 'HOLD']);
  });

  it('maps the toggles to a posture', () => {
    expect(postureFromToggles({ escape: true, support: false })).toBe('ESCAPE');
    expect(postureFromToggles({ escape: false, support: true })).toBe('SUPPORT');
    expect(postureFromToggles({ escape: false, support: false })).toBe('HOLD');
  });

  it('refuses both toggles on — the one state the rule forbids', () => {
    expect(() => postureFromToggles({ escape: true, support: true })).toThrow(RangeError);
  });

  it('round-trips every posture through its toggles', () => {
    for (const posture of DEFENCE_POSTURES) {
      expect(postureFromToggles(togglesOf(posture))).toBe(posture);
    }
    expect(togglesOf('ESCAPE')).toEqual({ escape: true, support: false });
    expect(togglesOf('SUPPORT')).toEqual({ escape: false, support: true });
    expect(togglesOf('HOLD')).toEqual({ escape: false, support: false });
  });
});

describe('escapeAllowed — the posture decides only in a season dealt the feature', () => {
  it('keeps the old automatic rule below ruleset 15, whatever the stored posture', () => {
    for (const posture of DEFENCE_POSTURES) {
      expect(escapeAllowed(10, posture)).toBe(false); // before the escape rule existed
      expect(escapeAllowed(11, posture)).toBe(true);
      expect(escapeAllowed(14, posture)).toBe(true);
    }
  });

  it('lets only an ESCAPE world run from ruleset 15', () => {
    expect(escapeAllowed(15, 'ESCAPE')).toBe(true);
    expect(escapeAllowed(15, 'SUPPORT')).toBe(false);
    expect(escapeAllowed(15, 'HOLD')).toBe(false);
  });
});

describe('support logistics — reuse the clan aid lane, never a second formula', () => {
  const fleet: Fleet = { DART: 12, COURIER: 3 };

  it('charges the round trip once, at the hostile rate clan aid pays', () => {
    expect(supportFuel(fleet, 900)).toBe(missionFuel(fleet, 900, 2));
  });

  it('flies at the clan aid speed', () => {
    expect(supportTravelMinutes(60)).toBe(clanAidTravelMinutes(60));
    expect(supportTravelMinutes(60)).toBeLessThan(60);
  });

  it('sizes the support bay to the host world’s own Hangar room', () => {
    expect(supportBayRoom(3, 0)).toEqual({ total: hangarCapacity(3), used: 0, free: hangarCapacity(3) });
    expect(supportBayRoom(3, 100)).toEqual({ total: hangarCapacity(3), used: 100, free: hangarCapacity(3) - 100 });
    // A world seeded before the Hangar keeps the base rung, as its own fleet does.
    expect(supportBayRoom(0, 0).total).toBe(hangarCapacity(1));
    // Never a negative free figure, even if a battle report raced a send.
    expect(supportBayRoom(1, hangarCapacity(1) + 5).free).toBe(0);
  });
});

describe('escape verdict and the raid — the posture is part of the rule', () => {
  const wall = { low: 100, high: 120 };
  const clears = { low: 5_000, high: 6_000 };

  it('lets a SUPPORT or HOLD world always STAND, whatever the reading says', () => {
    expect(escapeVerdict(10_000, wall, clears)).toBe('RUN');
    expect(escapeVerdict(10_000, wall, clears, false, 'ESCAPE')).toBe('RUN');
    expect(escapeVerdict(10_000, wall, clears, false, 'SUPPORT')).toBe('STAND');
    expect(escapeVerdict(10_000, wall, clears, false, 'HOLD')).toBe('STAND');
  });

  it('fights a supported line as one battle and never lifts it', () => {
    const outcome = resolveRaid({
      stacks: [{ contributionId: '', playerId: '', fleet: { TALON: 200 }, tech: { tech: {} } }],
      line: { DART: 6 },
      shield: 0,
      rng: () => () => 0.5,
      defender: { tech: {} },
      deuterium: 1_000_000,
      escape: false,
      minimumCombatShips: 0,
      support: [{ stackId: 'w1', playerId: 's1', fleet: { PIKE: 4 }, tech: { tech: {} } }],
    });
    expect(outcome.escape).toBeNull();
    expect(outcome.result.defenders.map((row) => row.stackId)).toEqual(['host', 'w1']);
  });

  it('refuses a raid that asks a supported line to run — the posture already forbids it', () => {
    expect(() => resolveRaid({
      stacks: [{ contributionId: '', playerId: '', fleet: { TALON: 200 }, tech: { tech: {} } }],
      line: { DART: 6 },
      shield: 0,
      rng: () => () => 0.5,
      defender: { tech: {} },
      deuterium: 1_000_000,
      escape: true,
      minimumCombatShips: 0,
      support: [{ stackId: 'w1', playerId: 's1', fleet: { PIKE: 4 }, tech: { tech: {} } }],
    })).toThrow(RangeError);
  });

  it('still hands the host back as the one defending stack on an ordinary raid', () => {
    const outcome = resolveRaid({
      stacks: [{ contributionId: '', playerId: '', fleet: { TALON: 5 }, tech: { tech: {} } }],
      line: { RAMPART: 6 },
      shield: 0,
      rng: () => () => 0.5,
      defender: { tech: {} },
      deuterium: 0,
      escape: true,
      minimumCombatShips: 0,
    });
    expect(outcome.result.defenders).toHaveLength(1);
    expect(outcome.result.defenders[0]!.sent).toEqual({ RAMPART: 6 });
  });
});
