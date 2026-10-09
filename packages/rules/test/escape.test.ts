import { describe, expect, it } from 'vitest';
import {
  ESCAPE,
  HULLS,
  MULTI_WORLD,
  combatValue,
  escapeFuel,
  escapeLine,
  escapeVerdict,
  escapingShips,
  fleetEntries,
  fleetEscapeApplies,
  fleetEscapeMinimumApplies,
  fleetValue,
  missionFuel,
  mulberry32,
  outmatches,
  resolveCombat,
  resolveRaid,
  soloStack,
  type DefenderStack,
  type Fleet,
  type JointAttackerStack,
} from '../src/index.js';

/**
 * TAKTİK GERİ ÇEKİLME — THE FLEET ESCAPE. Owner decision, 2026-09-23.
 *
 * OGame's tactical retreat, with the two corrections this engine's own numbers asked for.
 * The ships of a defending line lift off instead of fighting when the wing that arrived
 * has at least 3.5 times the line's armed resource value AND the line would have been wiped out
 * anyway — and only if the world's tank can pay for the lift. The ground guns and the
 * Aegis stay and fight; everything else about the raid (loot, bash limit, recovery
 * shield) reads the battle that actually happened.
 *
 * Every case below is a sentence the owner approved or an edge the analysis note named.
 */

const NONE = { tech: {} };
const seed = () => mulberry32(24_680);

/** A mirrored T2 line the engine clears from 1.5× (measured 2026-09-23). */
const LINE: Fleet = { VIPER: 20, TALON: 10, SENTINEL: 8 };
/** Exactly 3.5 times LINE's armed resource value. */
const THRESHOLD: Fleet = { VIPER: 70, TALON: 35, SENTINEL: 28 };
/** One Viper short of the threshold. */
const JUST_UNDER: Fleet = { VIPER: 69, TALON: 35, SENTINEL: 28 };
/** Twice LINE — the fight between near-equals the owner wants left alone. */
const DOUBLE: Fleet = { VIPER: 40, TALON: 20, SENTINEL: 16 };

const TANK = 100_000;

const raid = (
  wing: Fleet | readonly JointAttackerStack[],
  line: Fleet,
  options: {
    shield?: number; deuterium?: number; escape?: boolean; rulesetVersion?: number;
    support?: readonly DefenderStack[]; preciseDamage?: boolean;
  } = {},
) => resolveRaid({
  stacks: Array.isArray(wing) ? wing : [soloStack(wing as Fleet, NONE)],
  line,
  shield: options.shield ?? 0,
  rng: seed,
  defender: NONE,
  deuterium: options.deuterium ?? TANK,
  escape: options.escape ?? true,
  minimumCombatShips: fleetEscapeMinimumApplies(options.rulesetVersion ?? MULTI_WORLD.rulesetVersion)
    ? ESCAPE.minimumCombatShips : 0,
  ...(options.support === undefined ? {} : { support: options.support }),
  ...(options.preciseDamage === undefined ? {} : { preciseDamage: options.preciseDamage }),
});

const plain = (wing: Fleet, line: Fleet, shield = 0) =>
  resolveCombat(wing, line, shield, seed(), { attacker: NONE, defender: NONE });

const mobileIn = (fleet: Fleet): number =>
  fleetEntries(fleet).filter(([id]) => !HULLS[id].ground).reduce((n, [, c]) => n + c, 0);

describe('the escape rule, as the owner set it', () => {
  it('is 3.5 times the armed resource value, paid for with a 600-unit round trip', () => {
    expect(ESCAPE.ratio).toBe(3.5);
    expect(ESCAPE.fuelDistance).toBe(600);
  });

  it('arrives with the next season, never inside a running one', () => {
    expect(MULTI_WORLD.fleetEscapeRulesetVersion).toBe(11);
    expect(MULTI_WORLD.rulesetVersion).toBeGreaterThanOrEqual(MULTI_WORLD.fleetEscapeRulesetVersion);
    expect(fleetEscapeApplies(10)).toBe(false);
    expect(fleetEscapeApplies(11)).toBe(true);
    expect(fleetEscapeApplies(1)).toBe(false);
    expect(MULTI_WORLD.rulesetVersion).toBeGreaterThanOrEqual(MULTI_WORLD.fleetEscapeMinimumRulesetVersion);
    expect(fleetEscapeMinimumApplies(12)).toBe(false);
    expect(fleetEscapeMinimumApplies(13)).toBe(true);
  });

  it('requires five fighting ships in the defending line', () => {
    expect(ESCAPE.minimumCombatShips).toBe(5);
    for (const count of [1, 2, 3, 4]) {
      const line: Fleet = { DART: count };
      const wing: Fleet = { DART: count * 4 };
      expect(plain(wing, line).grade).toBe('DECISIVE');
      expect(raid(wing, line).escape).toBeNull();
    }
    expect(raid({ DART: 20 }, { DART: 5 }).escape?.kind).toBe('ESCAPED');
  });

  it('does not count transports or ground guns toward the minimum', () => {
    const line: Fleet = { DART: 4, COURIER: 20, THORN: 10 };
    expect(raid({ DART: 100 }, line).escape).toBeNull();
  });

  it('keeps the former escape rule in a season dealt before the minimum', () => {
    expect(raid({ DART: 4 }, { DART: 1 }, { rulesetVersion: 12 }).escape?.kind)
      .toBe('ESCAPED');
  });

  it('draws its line at the wing’s armed resource value divided by 3.5', () => {
    expect(combatValue(THRESHOLD) / combatValue(LINE)).toBe(3.5);
    expect(escapeLine(THRESHOLD)).toBe(combatValue(LINE));
    expect(escapeLine({ ATLAS: 50 })).toBe(0);
  });

  it('includes exactly 3.5, excludes anything below it and has no upper limit', () => {
    expect(outmatches(350, 100)).toBe(true);
    expect(outmatches(349.99, 100)).toBe(false);
    expect(outmatches(300, 100)).toBe(false);
    expect(outmatches(400, 100)).toBe(true);
    expect(outmatches(10_000, 100)).toBe(true);
    // A line that fires nothing is outmatched by anything that fires at all —
    // whether it RUNS is the DECISIVE guard's question, not this one's.
    expect(outmatches(1, 0)).toBe(true);
    expect(outmatches(0, 0)).toBe(true);
  });
});

describe('which ships lift off', () => {
  it('takes every ship in the line — armed and unarmed — and leaves the guns', () => {
    expect(escapingShips({ VIPER: 2, ATLAS: 3, BASTION: 4, HARPOON: 1 }))
      .toEqual({ VIPER: 2, ATLAS: 3 });
  });

  it('loses nothing and counts nothing twice', () => {
    const line: Fleet = { VIPER: 2, COURIER: 5, BASTION: 4, THORN: 7 };
    const ships = escapingShips(line);
    const ground = Object.fromEntries(
      fleetEntries(line).filter(([id]) => HULLS[id].ground),
    ) as Fleet;
    expect(fleetValue(ships) + fleetValue(ground)).toBe(fleetValue(line));
  });

  it('burns the round trip of the escape distance, the launch formula and nothing else', () => {
    expect(escapeFuel(LINE)).toBe(missionFuel(LINE, ESCAPE.fuelDistance, 2));
    expect(escapeFuel(LINE)).toBe(46);
    expect(escapeFuel({})).toBe(0);
  });
});

describe('resolveRaid', () => {
  it('fights a three-to-one raid now that the threshold is 3.5', () => {
    const wing: Fleet = { VIPER: 60, TALON: 30, SENTINEL: 24 };
    const outcome = raid(wing, LINE);
    expect(plain(wing, LINE).grade).toBe('DECISIVE');
    expect(outcome.escape).toBeNull();
    expect(outcome.result.rounds).toEqual(plain(wing, LINE).rounds);
  });

  it('counts active ground guns in the ratio, even when the ships alone qualify', () => {
    const line: Fleet = { ...LINE, BASTION: 4 };
    expect(combatValue(THRESHOLD)).toBe(3.5 * combatValue(LINE));
    expect(combatValue(THRESHOLD)).toBeLessThan(3.5 * combatValue(line));
    expect(plain(THRESHOLD, line).grade).toBe('DECISIVE');
    expect(raid(THRESHOLD, line).escape).toBeNull();
  });

  it('charges for the transports that lift too, without counting them toward the ratio', () => {
    const line: Fleet = { ...LINE, COURIER: 5 };
    const fuel = escapeFuel(line);
    expect(fuel).toBeGreaterThan(escapeFuel(LINE));
    expect(raid(THRESHOLD, line, { deuterium: fuel }).escape)
      .toEqual({ kind: 'ESCAPED', ships: line, fuel });
    expect(raid(THRESHOLD, line, { deuterium: fuel - 1 }).escape)
      .toEqual({ kind: 'STRANDED', ships: line, fuel, available: fuel - 1 });
  });

  it('never lifts a supported line, and rejects a caller that enables both rules', () => {
    const support: DefenderStack[] = [{
      stackId: 'support', playerId: 'ally', fleet: { DART: 5 }, tech: NONE,
    }];
    const wing: Fleet = { VIPER: 600 };
    expect(raid(wing, LINE, { escape: false, support }).escape).toBeNull();
    expect(() => raid(wing, LINE, { support })).toThrow('a line holding clan support never lifts');
  });

  it('preserves sub-bp attacker damage when an escape becomes a walkover', () => {
    const damage = [{ hull: 'VIPER' as const, count: 70, damageBp: 0, remainderBp: 0.125 }];
    const outcome = raid([soloStack(THRESHOLD, NONE, damage)], LINE, { preciseDamage: true });
    expect(outcome.escape?.kind).toBe('ESCAPED');
    expect(outcome.result.attackerDamage).toEqual(damage);
    expect(outcome.result.defenderDamage).toEqual([]);
  });

  it('lets a 1:2 fight happen exactly as it always did', () => {
    const outcome = raid(DOUBLE, LINE);
    expect(outcome.escape).toBeNull();
    const before = plain(DOUBLE, LINE);
    expect(outcome.result.grade).toBe(before.grade);
    expect(outcome.result.rounds).toEqual(before.rounds);
    expect(outcome.result.defenderLosses).toEqual(before.defenderLosses);
    expect(outcome.result.attackerLosses).toEqual(before.attackerLosses);
  });

  it('lifts every ship off when the wing has exactly 3.5 times the line’s armed resource value', () => {
    const outcome = raid(THRESHOLD, LINE);
    expect(outcome.escape).toEqual({ kind: 'ESCAPED', ships: LINE, fuel: 46 });
    // No ship stood in the line, so no ship died — a walkover, as D173 has it.
    expect(mobileIn(outcome.result.defenderLosses)).toBe(0);
    expect(outcome.result.rounds).toEqual([]);
    expect(outcome.result.grade).toBe('DECISIVE');
    expect(outcome.result.attackerLossValue).toBe(0);
  });

  it('fights when the wing is one Viper short of the threshold', () => {
    expect(combatValue(JUST_UNDER)).toBeLessThan(3.5 * combatValue(LINE));
    const outcome = raid(JUST_UNDER, LINE);
    expect(outcome.escape).toBeNull();
    expect(outcome.result.grade).toBe('DECISIVE');
    expect(mobileIn(outcome.result.defenderLosses)).toBe(mobileIn(LINE));
  });

  it('counts only what fires: holds packed with cargo do not buy the threshold', () => {
    const padded: Fleet = { ...DOUBLE, ATLAS: 60 };
    expect(fleetValue(padded)).toBeGreaterThan(3.5 * combatValue(LINE));
    expect(raid(padded, LINE).escape).toBeNull();
  });

  it('keeps a transport wall standing: a line the wing cannot clear never runs', () => {
    const wall: Fleet = { ATLAS: 40, SENTINEL: 6 };
    const wing: Fleet = { VIPER: 27 };
    expect(combatValue(wing)).toBeGreaterThanOrEqual(3.5 * combatValue(wall));
    expect(plain(wing, wall).grade).not.toBe('DECISIVE');
    const outcome = raid(wing, wall);
    expect(outcome.escape).toBeNull();
    expect(outcome.result.grade).toBe(plain(wing, wall).grade);
  });

  it('stays under a dome that holds', () => {
    expect(plain(THRESHOLD, LINE, 400_000).grade).toBe('REPELLED');
    expect(raid(THRESHOLD, LINE, { shield: 400_000 }).escape).toBeNull();
  });

  it('has nothing to lift when only guns stand, and changes nothing', () => {
    const guns: Fleet = { BASTION: 4 };
    const outcome = raid(THRESHOLD, guns);
    expect(outcome.escape).toBeNull();
    expect(outcome.result.rounds).toEqual(plain(THRESHOLD, guns).rounds);
  });

  it('does nothing against an empty world', () => {
    const outcome = raid(THRESHOLD, {});
    expect(outcome.escape).toBeNull();
    expect(outcome.result.grade).toBe('DECISIVE');
  });

  it('leaves the guns to fight alone when the ships run', () => {
    const line: Fleet = { ...LINE, BASTION: 4 };
    const wing: Fleet = { VIPER: 100, TALON: 50, SENTINEL: 40 };
    expect(combatValue(wing)).toBeGreaterThanOrEqual(3.5 * combatValue(line));
    const outcome = raid(wing, line);
    expect(outcome.escape).toEqual({ kind: 'ESCAPED', ships: LINE, fuel: 46 });
    const fought = plain(wing, { BASTION: 4 });
    expect(outcome.result.rounds).toEqual(fought.rounds);
    expect(outcome.result.defenderLosses).toEqual({ BASTION: 4 });
    expect(outcome.result.defenceSalvage).toEqual(fought.defenceSalvage);
  });

  it('strands the fleet when the tank is one drop short, and the fight stands', () => {
    const outcome = raid(THRESHOLD, LINE, { deuterium: 45 });
    expect(outcome.escape).toEqual({ kind: 'STRANDED', ships: LINE, fuel: 46, available: 45 });
    expect(outcome.result.rounds).toEqual(plain(THRESHOLD, LINE).rounds);
    expect(mobileIn(outcome.result.defenderLosses)).toBe(mobileIn(LINE));
  });

  it('lifts off on exactly the fuel it needs', () => {
    expect(raid(THRESHOLD, LINE, { deuterium: 46 }).escape?.kind).toBe('ESCAPED');
  });

  it('reads a fraction of a drop as nothing and a corrupt tank as empty', () => {
    expect(raid(THRESHOLD, LINE, { deuterium: 45.99 }).escape)
      .toEqual({ kind: 'STRANDED', ships: LINE, fuel: 46, available: 45 });
    for (const broken of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(raid(THRESHOLD, LINE, { deuterium: broken }).escape)
        .toEqual({ kind: 'STRANDED', ships: LINE, fuel: 46, available: 0 });
    }
  });

  it('is off in a season below the boundary, however lopsided the fight', () => {
    const outcome = raid({ VIPER: 600 }, LINE, { escape: false });
    expect(outcome.escape).toBeNull();
    expect(mobileIn(outcome.result.defenderLosses)).toBe(mobileIn(LINE));
  });

  it('adds up all joint-war waves before comparing them with the line', () => {
    const waves = ['a', 'b', 'c'].map((id): JointAttackerStack => ({
      contributionId: id,
      playerId: `p-${id}`,
      fleet: id === 'c' ? { VIPER: 30, TALON: 15, SENTINEL: 12 } : { ...LINE },
      tech: NONE,
    }));
    const outcome = raid(waves, LINE);
    expect(outcome.escape?.kind).toBe('ESCAPED');
    expect(outcome.result.contributions).toHaveLength(3);
  });

  it('resolves the same inputs the same way every time', () => {
    expect(raid(THRESHOLD, { ...LINE, BASTION: 2 })).toEqual(raid(THRESHOLD, { ...LINE, BASTION: 2 }));
  });

  /**
   * THE PROPERTY THE GUARD EXISTS FOR: running never leaves the defender worse off.
   *
   * A fleet only lifts off from a fight it would have lost outright, so the escape can
   * only ever SAVE ships — the ground guns meet at most what they met anyway, and the
   * grade cannot fall below the DECISIVE it would have been.
   */
  it('never leaves the defender worse off than standing would have', () => {
    const rng = mulberry32(99);
    const pick = (max: number) => Math.floor(rng() * (max + 1));
    let escapes = 0;
    for (let trial = 0; trial < 400; trial++) {
      const line: Fleet = {
        VIPER: pick(20), TALON: pick(12), SENTINEL: pick(8), COURIER: pick(6),
        BASTION: pick(4), HARPOON: pick(3), THORN: pick(6),
      };
      const scale = 1 + rng() * 6;
      const wing: Fleet = {
        VIPER: Math.round(20 * scale), TALON: Math.round(10 * scale), SENTINEL: Math.round(8 * scale),
      };
      const shield = rng() < 0.3 ? pick(20_000) : 0;
      const standing = plain(wing, line, shield);
      const outcome = raid(wing, line, { shield });
      if (outcome.escape?.kind !== 'ESCAPED') {
        expect(outcome.result.rounds).toEqual(standing.rounds);
        continue;
      }
      escapes++;
      expect(standing.grade).toBe('DECISIVE');
      expect(mobileIn(outcome.result.defenderLosses)).toBe(0);
      for (const [id, lost] of fleetEntries(outcome.result.defenderLosses)) {
        expect(lost).toBeLessThanOrEqual(standing.defenderLosses[id] ?? 0);
      }
    }
    // The generator must actually exercise the rule, or this proves nothing.
    expect(escapes).toBeGreaterThan(20);
  });
});

/**
 * WHAT THE LAUNCH SHEET MAY SAY BEFORE THE PRESS. CLAUDE.md, predictability: the
 * player forms an expectation and can be wrong about it. The rule is applied to the
 * reading the commander bought — the defence band and the clear line — and never to
 * the truth; the tank stays unknown to a raider, so even RUN is "if they can pay".
 */
describe('escapeVerdict', () => {
  it('cannot promise retreat from a power reading that does not reveal ship count', () => {
    const clears = { low: 20_000, high: 30_000 };
    expect(escapeVerdict(35_000, { low: 4_000, high: 9_000 }, clears, true))
      .toBe('UNSURE');
    expect(escapeVerdict(35_000, { low: 10_001, high: 14_000 }, clears, true))
      .toBe('STAND');
  });
  const clears = { low: 20_000, high: 30_000 };

  it('says they run when the whole band sits under the line and is cleared everywhere', () => {
    expect(escapeVerdict(35_000, { low: 4_000, high: 9_000 }, clears)).toBe('RUN');
  });

  it('says they stand when even the bottom of the band is over the line', () => {
    expect(escapeVerdict(35_000, { low: 10_001, high: 14_000 }, clears)).toBe('STAND');
  });

  it('says they stand when the wing cannot clear the band anywhere', () => {
    expect(escapeVerdict(300_000, { low: 31_000, high: 40_000 }, clears)).toBe('STAND');
  });

  it('says it is open when the band straddles the line', () => {
    expect(escapeVerdict(35_000, { low: 8_000, high: 12_000 }, clears)).toBe('UNSURE');
  });

  it('says it is open when the band is under the line but might not be cleared', () => {
    expect(escapeVerdict(105_000, { low: 18_000, high: 25_000 }, clears)).toBe('UNSURE');
  });

  it('counts the line itself as running, as the rule does', () => {
    expect(escapeVerdict(35_000, { low: 10_000, high: 10_000 }, clears)).toBe('RUN');
  });
});
