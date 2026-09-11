import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RESEARCH_TECH,
  combatValue,
  forecastLines,
  forecastLoss,
  mulberry32,
  resolveCombat,
  wallKnowledgeOf,
  type Fleet,
  type ForecastInput,
  type TechLevels,
} from '../src/index.js';

/**
 * HOW MUCH OF A WALL THIS WING CAN TAKE. D199.
 *
 * The launch sheet put the wing's firepower beside the wall's and stopped there,
 * so the one question it is for — is this fight my size — was answered by losing
 * it. Measured on the battle engine: an equal wing only breaks a wall and loses
 * two thirds of itself doing it; a clean sweep wants about half as much again.
 *
 * These lines are that measurement, taken by the same engine the server grades
 * with, over every wall the reading still allows. They are an expectation, not a
 * verdict: the wall itself stays a probe's fuzzed, aged band.
 */

const none: TechLevels = {};
const maxed: TechLevels = {
  SHIP_POWER: RESEARCH_TECH.weaponMaxLevel,
  SHIP_ARMOR: RESEARCH_TECH.weaponMaxLevel,
  EMPLACEMENT_DOCTRINE: RESEARCH_TECH.weaponMaxLevel,
};

const blind = (over: Partial<ForecastInput> = {}): ForecastInput => ({
  attackerTech: none,
  defenderTech: none,
  shield: { low: 0, high: 0 },
  unarmed: { low: 0, high: 0 },
  wall: { kind: 'UNKNOWN' },
  ...over,
});

/** Where the engine itself lands at the mean roll — the thing every line is measured by. */
const flat = () => 0.5;
const grade = (sending: Fleet, wall: Fleet, input: ForecastInput) =>
  resolveCombat(sending, wall, input.shield.high, flat, {
    attacker: { tech: input.attackerTech },
    defender: { tech: input.defenderTech, ...(input.defenderDamageMult === undefined ? {} : { damageMult: input.defenderDamageMult }) },
  }).grade;

const spread = (s: { low: number; high: number }) => s.high / Math.max(1, s.low);

describe('the lines a wing is drawn against', () => {
  it('never clears more than it breaks', () => {
    fc.assert(fc.property(
      fc.record({
        DART: fc.integer({ min: 0, max: 30 }),
        TALON: fc.integer({ min: 0, max: 15 }),
        SENTINEL: fc.integer({ min: 0, max: 15 }),
        ATLAS: fc.integer({ min: 0, max: 3 }),
      }),
      (wing) => {
        const f = forecastLines(wing, blind());
        return f.clears.low <= f.breaks.low && f.clears.high <= f.breaks.high
          && f.clears.low <= f.clears.high && f.breaks.low <= f.breaks.high;
      },
    ), { numRuns: 25 });
  });

  it('sits where the battle engine grades, when the wall is known exactly', () => {
    const wing: Fleet = { TALON: 20 };
    const crew: Fleet = { TALON: 13 };
    const input = blind({ wall: { kind: 'EXACT', fleet: crew } });
    const f = forecastLines(wing, input);

    expect(f.clears.low).toBe(f.clears.high);
    expect(f.breaks.low).toBe(f.breaks.high);
    const firepower = combatValue(crew);
    expect(firepower < f.clears.low).toBe(grade(wing, crew, input) === 'DECISIVE');
    expect(firepower < f.breaks.low).toBe(grade(wing, crew, input) !== 'REPELLED');
  });

  /**
   * A CREW SEEN EXACTLY IS NEVER CONTRADICTED. Its point sits on the sheet beside the
   * lines, so the zone it lands in has to be the fight it would actually be. Checked
   * against crews that carry transports, because a transport's value counts toward
   * the 42% a PARTIAL needs and makes the outcome non-monotone in the crew's size —
   * one hull more of a warship can turn a loss into a break.
   */
  it('never contradicts the fight against a crew it has seen exactly', () => {
    const rng = mulberry32(31);
    const pool = ['DART', 'TALON', 'SENTINEL', 'VIPER', 'COURIER', 'WAYFARER', 'ATLAS'] as const;
    for (let trial = 0; trial < 40; trial++) {
      const crew: Fleet = {};
      for (let k = 0; k < 4; k++) {
        const id = pool[Math.floor(rng() * pool.length)]!;
        crew[id] = (crew[id] ?? 0) + 1 + Math.floor(rng() * 8);
      }
      if (combatValue(crew) === 0) crew.TALON = 1;
      const wing: Fleet = { TALON: 4 + Math.floor(rng() * 20), VIPER: Math.floor(rng() * 10) };
      const input = blind({ wall: { kind: 'EXACT', fleet: crew } });
      const f = forecastLines(wing, input);
      const g = grade(wing, crew, input);
      const at = combatValue(crew);
      expect(at < f.clears.low, `trial ${String(trial)} clears`).toBe(g === 'DECISIVE');
      expect(at < f.breaks.low, `trial ${String(trial)} breaks`).toBe(g !== 'REPELLED');
    }
  });

  /** The measured rule of thumb, reproduced by the engine rather than typed in. */
  it('asks for about half as much again to clear a wall like your own', () => {
    const wing: Fleet = { TALON: 30 };
    const f = forecastLines(wing, blind({ wall: { kind: 'EXACT', fleet: { TALON: 1 } } }));
    const mine = combatValue(wing);
    expect(f.clears.low).toBeGreaterThan(mine / 1.8);
    expect(f.clears.low).toBeLessThan(mine / 1.2);
    expect(f.breaks.low).toBeGreaterThan(mine * 0.9);
  });
});

describe('what the reading still leaves open', () => {
  it('leaves a single-class wing a far wider gamble than a mixed one', () => {
    const mono = forecastLines({ TALON: 21 }, blind());
    const mixed = forecastLines({ VIPER: 7, TALON: 7, SENTINEL: 7 }, blind());
    expect(spread(mono.clears)).toBeGreaterThan(spread(mixed.clears));
  });

  it('narrows once a probe has named the wall', () => {
    const wing: Fleet = { TALON: 21 };
    const unknown = forecastLines(wing, blind());
    const bulwark = forecastLines(wing, blind({ wall: { kind: 'DOMINANT', cls: 'BULWARK' } }));
    // A Bulwark wall is exactly what Lances fear, so the kind end of the range is gone.
    expect(bulwark.clears.high).toBeLessThan(unknown.clears.high);
    expect(spread(bulwark.clears)).toBeLessThan(spread(unknown.clears));
  });

  it('is one line once the split is known to a single class', () => {
    const f = forecastLines({ VIPER: 10, TALON: 10 }, blind({
      wall: { kind: 'SHARES', shares: { SKIRMISHER: 0, BULWARK: 0, LANCE: 100 } },
    }));
    expect(f.clears.low).toBeGreaterThan(0);
    expect(spread(f.clears)).toBeLessThan(spread(forecastLines({ VIPER: 10, TALON: 10 }, blind()).clears));
  });
});

describe('what moves the lines', () => {
  const wing: Fleet = { VIPER: 7, TALON: 7, SENTINEL: 7 };

  it('moves out with your research and in with theirs', () => {
    const base = forecastLines(wing, blind());
    const ours = forecastLines(wing, blind({ attackerTech: maxed }));
    const theirs = forecastLines(wing, blind({ defenderTech: maxed }));
    expect(ours.clears.low).toBeGreaterThan(base.clears.low);
    expect(theirs.clears.high).toBeLessThan(base.clears.high);
  });

  it('comes in behind a charged shield', () => {
    const bare = forecastLines(wing, blind());
    const shielded = forecastLines(wing, blind({ shield: { low: 2_000, high: 2_000 } }));
    expect(shielded.clears.low).toBeLessThan(bare.clears.low);
    expect(shielded.clears.high).toBeLessThan(bare.clears.high);
  });

  it('comes in when unarmed hulls stand in the line', () => {
    const empty = forecastLines({ DART: 8 }, blind());
    const hangar = forecastLines({ DART: 8 }, blind({ unarmed: { low: 6, high: 6 } }));
    expect(hangar.clears.low).toBeLessThan(empty.clears.low);
  });

  it('goes out against a pirate that hits softly', () => {
    const crew: Fleet = { TALON: 12 };
    const full = forecastLines(wing, blind({ wall: { kind: 'EXACT', fleet: crew } }));
    const soft = forecastLines(wing, blind({ wall: { kind: 'EXACT', fleet: crew }, defenderDamageMult: 0.5 }));
    expect(soft.clears.low).toBeGreaterThanOrEqual(full.clears.low);
  });

  /** A wing of transports clears a world with nothing in it, and nothing else. */
  it('gives a wing that cannot fire nothing past the empty world', () => {
    const f = forecastLines({ ATLAS: 3 }, blind());
    expect(f.clears.low).toBeGreaterThan(0);
    expect(f.clears.high).toBeLessThan(8_000);
    const blocked = forecastLines({ ATLAS: 3 }, blind({ unarmed: { low: 2, high: 2 } }));
    expect(blocked.clears.low).toBe(0);
    expect(blocked.breaks.low).toBe(0);
  });

  it('is the same answer every time it is asked', () => {
    expect(forecastLines(wing, blind())).toEqual(forecastLines(wing, blind()));
  });
});

describe('what the fight is expected to cost', () => {
  const wing: Fleet = { TALON: 20 };

  it('costs nothing against nothing', () => {
    expect(forecastLoss(wing, { low: 0, high: 0 }, blind())).toEqual({ low: 0, high: 0 });
  });

  it('costs more against more, and never more than everything', () => {
    const light = forecastLoss(wing, { low: 4_000, high: 4_000 }, blind());
    const heavy = forecastLoss(wing, { low: 18_000, high: 18_000 }, blind());
    expect(heavy.low).toBeGreaterThanOrEqual(light.low);
    expect(heavy.high).toBeGreaterThanOrEqual(light.high);
    for (const s of [light, heavy]) {
      expect(s.low).toBeGreaterThanOrEqual(0);
      expect(s.high).toBeLessThanOrEqual(1);
      expect(s.low).toBeLessThanOrEqual(s.high);
    }
  });

  it('is one figure against a crew seen exactly', () => {
    const crew: Fleet = { TALON: 13 };
    const s = forecastLoss(wing, { low: combatValue(crew), high: combatValue(crew) }, blind({
      wall: { kind: 'EXACT', fleet: crew },
    }));
    expect(s.low).toBe(s.high);
    expect(s.low).toBeGreaterThan(0);
  });
});

describe('turning a probe reading into what the lines may assume', () => {
  it('maps every reading, and treats an unread or empty one as unknown', () => {
    expect(wallKnowledgeOf(undefined)).toEqual({ kind: 'UNKNOWN' });
    expect(wallKnowledgeOf({ kind: 'UNREAD' })).toEqual({ kind: 'UNKNOWN' });
    expect(wallKnowledgeOf({ kind: 'NONE' })).toEqual({ kind: 'UNKNOWN' });
    expect(wallKnowledgeOf({ kind: 'EVEN' })).toEqual({ kind: 'EVEN' });
    expect(wallKnowledgeOf({ kind: 'DOMINANT', cls: 'LANCE' })).toEqual({ kind: 'DOMINANT', cls: 'LANCE' });
    expect(wallKnowledgeOf({ kind: 'SHARES', shares: { SKIRMISHER: 20, BULWARK: 30, LANCE: 50 } }))
      .toEqual({ kind: 'SHARES', shares: { SKIRMISHER: 20, BULWARK: 30, LANCE: 50 } });
  });
});
