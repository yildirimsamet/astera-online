import { describe, expect, it } from 'vitest';
import { instrumentCost, investedInInstrument, shieldHp } from '../src/index.js';

// Owner-approved table, rather than expectations generated from implementation.
const TABLE = [
  [150, 197, 148], [225, 315, 237], [338, 504, 379], [506, 807, 606],
  [759, 1291, 970], [1139, 2066, 1552], [1709, 3305, 2483], [2563, 5288, 3973],
  [3844, 8461, 6357], [5767, 13538, 10170], [8650, 21660, 16273],
  [12975, 34657, 26036], [19462, 55451, 41658], [29193, 88721, 66653],
  [43789, 141953, 106645], [65684, 227126, 170632], [98526, 363401, 273012],
  [147789, 581441, 436819], [221684, 930306, 698910], [332526, 1488490, 1118256],
] as const;

describe('the October Aegis table', () => {
  it.each(TABLE.map(([hp, alloy, crystal], i) => ({ level: i + 1, hp, alloy, crystal })))(
    'holds the approved capacity and upgrade price at level $level', ({ level, hp, alloy, crystal }) => {
      expect(shieldHp(level)).toBe(hp);
      expect(instrumentCost('AEGIS', level - 1)).toEqual({ alloy, crystal, deuterium: 0 });
    });

  it('has no capacity or investment without an installed Aegis', () => {
    expect(shieldHp(0)).toBe(0);
    expect(shieldHp(-1)).toBe(0);
    expect(investedInInstrument('AEGIS', 0)).toBe(0);
  });

  it('totals the new investment without compounding rounded prices', () => {
    expect(investedInInstrument('AEGIS', 8)).toBe(13773 + 10348);
    expect(investedInInstrument('AEGIS', 20)).toBe(3968978 + 2981769);
  });

  it('does not cap the Aegis table at level 20', () => {
    expect(shieldHp(21)).toBe(498789);
    expect(instrumentCost('AEGIS', 20)).toEqual({ alloy: 2381584, crystal: 1789210, deuterium: 0 });
  });
});
