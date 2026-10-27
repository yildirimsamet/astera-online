import { describe, expect, it } from 'vitest';
import { splitTeamLoot } from '../../src/arena/team.js';

describe('Y7 equal extracted loot', () => {
  it('shares the extracted pool with every launched member, including a member who brought back nothing', () => {
    const shares = splitTeamLoot([
      { playerId: 'a', extracted: { alloy: 300, crystal: 120, deuterium: 6 } },
      { playerId: 'b', extracted: { alloy: 0, crystal: 0, deuterium: 0 } },
    ]);
    expect(shares).toEqual([
      { playerId: 'a', share: { alloy: 150, crystal: 60, deuterium: 3 } },
      { playerId: 'b', share: { alloy: 150, crystal: 60, deuterium: 3 } },
    ]);
  });

  it('returns an empty pool without manufacturing a resource, and a single member gets their own cargo', () => {
    expect(splitTeamLoot([{ playerId: 'solo', extracted: { alloy: 123, crystal: 4, deuterium: 1 } }]))
      .toEqual([{ playerId: 'solo', share: { alloy: 123, crystal: 4, deuterium: 1 } }]);
    expect(splitTeamLoot([{ playerId: 'a', extracted: { alloy: 0, crystal: 0, deuterium: 0 } }])[0]?.share)
      .toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });

  it('refuses duplicate members, non-whole or unsafe resource counts', () => {
    const a = { playerId: 'a', extracted: { alloy: 1, crystal: 0, deuterium: 0 } };
    expect(() => splitTeamLoot([a, a])).toThrow();
    for (const n of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => splitTeamLoot([{ ...a, extracted: { ...a.extracted, alloy: n } }])).toThrow();
    }
    expect(() => splitTeamLoot([])).toThrow();
  });

  it('gives indivisible units to the largest extracted value, with a stable player-id tie break', () => {
    const rows = [
      { playerId: 'a', extracted: { alloy: 4, crystal: 0, deuterium: 0 } },
      { playerId: 'b', extracted: { alloy: 0, crystal: 0, deuterium: 3 } },
      { playerId: 'c', extracted: { alloy: 0, crystal: 0, deuterium: 0 } },
    ];
    expect(splitTeamLoot(rows)).toEqual([
      { playerId: 'a', share: { alloy: 1, crystal: 0, deuterium: 1 } },
      { playerId: 'b', share: { alloy: 2, crystal: 0, deuterium: 1 } },
      { playerId: 'c', share: { alloy: 1, crystal: 0, deuterium: 1 } },
    ]);
    const tied = [{ playerId: 'b', extracted: { alloy: 1, crystal: 0, deuterium: 0 } },
      { playerId: 'a', extracted: { alloy: 1, crystal: 0, deuterium: 0 } }, { playerId: 'c', extracted: { alloy: 0, crystal: 0, deuterium: 0 } }];
    expect(splitTeamLoot(tied).find(s => s.playerId === 'a')?.share.alloy).toBe(2);
  });
});
