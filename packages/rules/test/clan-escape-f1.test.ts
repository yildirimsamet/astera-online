import { describe, expect, it } from 'vitest';
import {
  DEFENCE_POSTURES,
  ESCAPE,
  escapeAllowed,
  escapeFuel,
  escapeVerdict,
  escapingShips,
  legacyPosture,
  mulberry32,
  postureFromToggles,
  resolveRaid,
  soloStack,
  supportAccepted,
  togglesOf,
  type DefencePosture,
  type DefenderStack,
  type Fleet,
} from '../src/index.js';

/**
 * KLAN DESTEĞİYLE BİRLİKTE KAÇIŞ — F1, owner decisions 2026-11-10
 * (`docs/klan-savunma-kacis-f1-2026-11-10.md`).
 *
 * The retreat is judged on the whole defending line (the host and every stationed wave).
 * When it fires, everybody lifts together; the host's tank pays only for the host's own
 * ships; a tank that cannot pay keeps the whole line standing.
 */

const NONE = { tech: {} };
const seed = () => mulberry32(24_680);
const TANK = 100_000;

/** The mirrored line the escape suite measures from; power is linear in the mix. */
const LINE: Fleet = { VIPER: 20, TALON: 10, SENTINEL: 8 };
const times = (fleet: Fleet, k: number): Fleet =>
  Object.fromEntries(Object.entries(fleet).map(([id, n]) => [id, n * k]));

const wave = (fleet: Fleet, stackId = 'w1'): DefenderStack =>
  ({ stackId, playerId: `p-${stackId}`, fleet, tech: NONE });

const raid = (wing: Fleet, line: Fleet, support: readonly DefenderStack[], options: { deuterium?: number; escape?: boolean } = {}) =>
  resolveRaid({
    stacks: [soloStack(wing, NONE)],
    line,
    shield: 0,
    rng: seed,
    defender: NONE,
    deuterium: options.deuterium ?? TANK,
    escape: options.escape ?? true,
    minimumCombatShips: ESCAPE.minimumCombatShips,
    support,
    hostPlayerId: 'host-player',
  });

describe('F1 postures — two independent toggles', () => {
  it('names four postures, the new one last', () => {
    expect([...DEFENCE_POSTURES]).toEqual(['ESCAPE', 'SUPPORT', 'HOLD', 'ESCAPE_SUPPORT']);
  });

  it('maps both toggles on to ESCAPE_SUPPORT and round-trips every posture', () => {
    expect(postureFromToggles({ escape: true, support: true })).toBe('ESCAPE_SUPPORT');
    expect(togglesOf('ESCAPE_SUPPORT')).toEqual({ escape: true, support: true });
    for (const posture of DEFENCE_POSTURES) expect(postureFromToggles(togglesOf(posture))).toBe(posture);
  });

  it('lets the two escape postures run and the two support postures receive', () => {
    const table: Record<DefencePosture, [boolean, boolean]> = {
      ESCAPE: [true, false], SUPPORT: [false, true], HOLD: [false, false], ESCAPE_SUPPORT: [true, true],
    };
    for (const posture of DEFENCE_POSTURES) {
      expect([escapeAllowed(15, posture), supportAccepted(posture)]).toEqual(table[posture]);
      // A season dealt before the postures keeps its automatic rule.
      expect(escapeAllowed(14, posture)).toBe(true);
    }
  });

  it('reads ESCAPE_SUPPORT as ESCAPE for the raider’s verdict', () => {
    const outmatched = { low: 80, high: 100 };
    expect(escapeVerdict(outmatched, false, 'ESCAPE_SUPPORT')).toBe(escapeVerdict(outmatched, false, 'ESCAPE'));
    expect(escapeVerdict(outmatched, false, 'ESCAPE_SUPPORT')).toBe('RUN');
  });

  it('shows an old client only the three postures it can parse', () => {
    expect(legacyPosture('ESCAPE_SUPPORT')).toBe('ESCAPE');
    expect(legacyPosture('ESCAPE')).toBe('ESCAPE');
    expect(legacyPosture('SUPPORT')).toBe('SUPPORT');
    expect(legacyPosture('HOLD')).toBe('HOLD');
  });
});

describe('F1 raid — the whole line judges and the whole line lifts', () => {
  it('lifts host and support together when the wing has the ratio over the combined line', () => {
    const outcome = raid(times(LINE, 8), LINE, [wave(LINE)]);
    expect(outcome.escape?.kind).toBe('ESCAPED');
    if (outcome.escape?.kind !== 'ESCAPED') return;
    expect(outcome.escape.ships).toEqual(escapingShips(LINE));
    expect(outcome.escape.support).toEqual([{ stackId: 'w1', ships: LINE }]);
    // Only the host's guns stood; no wave fought.
    expect(outcome.result.defenders.map((row) => row.stackId)).toEqual(['host']);
    expect(outcome.result.defenders[0]!.sent).toEqual({});
  });

  it('measures the ratio on the combined line: a wing that outmatches the host alone still meets the support', () => {
    const wing = times(LINE, ESCAPE.ratio);
    // Alone, the host would run from this wing.
    expect(raid(wing, LINE, []).escape?.kind).toBe('ESCAPED');
    // A wave as strong as the host halves the ratio: the whole line fights (F1-K5).
    const outcome = raid(wing, LINE, [wave(LINE)]);
    expect(outcome.escape).toBeNull();
    expect(outcome.result.defenders.map((row) => row.stackId)).toEqual(['host', 'w1']);
  });

  it('charges the host only for its own ships — a wave lifts free', () => {
    const outcome = raid(times(LINE, 8), LINE, [wave(LINE)]);
    expect(outcome.escape?.kind).toBe('ESCAPED');
    expect(outcome.escape?.fuel).toBe(escapeFuel(escapingShips(LINE)));
  });

  it('lifts a wave beside a host with no ships of its own, for no fuel', () => {
    const support = { DART: 10 };
    const outcome = raid({ DART: 200 }, { THORN: 10 }, [wave(support)], { deuterium: 0 });
    expect(outcome.escape).toEqual({ kind: 'ESCAPED', ships: {}, fuel: 0, support: [{ stackId: 'w1', ships: support }] });
    expect(outcome.result.defenders.map((row) => row.stackId)).toEqual(['host']);
    expect(outcome.result.defenders[0]!.sent).toEqual({ THORN: 10 });
  });

  it('keeps the whole line standing when the host’s tank cannot pay (F1-K4)', () => {
    const outcome = raid(times(LINE, 8), LINE, [wave(LINE)], { deuterium: 0 });
    expect(outcome.escape?.kind).toBe('STRANDED');
    expect(outcome.result.defenders.map((row) => row.stackId)).toEqual(['host', 'w1']);
    expect(outcome.result.defenders[1]!.sent).toEqual(LINE);
  });

  it('counts the five-ship floor across the whole line', () => {
    expect(raid({ DART: 100 }, { DART: 3 }, [wave({ DART: 2 })]).escape?.kind).toBe('ESCAPED');
    expect(raid({ DART: 100 }, { DART: 3 }, [wave({ DART: 1 })]).escape).toBeNull();
  });

  it('judges a wave by the ships that can fight, as the battle does under maintenance', () => {
    // Two of the wave's three Darts are past fighting: the line holds 4 fighters, under the floor.
    const wounded: DefenderStack = { ...wave({ DART: 3 }), damage: [{ hull: 'DART', count: 2, damageBp: 9_600, remainderBp: 0 }] };
    const outcome = resolveRaid({
      stacks: [soloStack({ DART: 100 }, NONE)], line: { DART: 3 }, shield: 0, rng: seed, defender: NONE,
      deuterium: TANK, escape: true, minimumCombatShips: ESCAPE.minimumCombatShips, maintenance: true,
      preciseDamage: true, support: [wounded],
    });
    expect(outcome.escape).toBeNull();
  });

  it('lists every escaping wave in its own stack', () => {
    const outcome = raid(times(LINE, 12), LINE, [wave({ VIPER: 5 }, 'a'), wave({ TALON: 4 }, 'b')]);
    expect(outcome.escape?.kind).toBe('ESCAPED');
    if (outcome.escape?.kind !== 'ESCAPED') return;
    expect(outcome.escape.support).toEqual([{ stackId: 'a', ships: { VIPER: 5 } }, { stackId: 'b', ships: { TALON: 4 } }]);
  });

  it('fights a supported line that does not qualify exactly as it fought before', () => {
    const wing = times(LINE, 2);
    const asked = raid(wing, LINE, [wave(LINE)]);
    const held = raid(wing, LINE, [wave(LINE)], { escape: false });
    expect(asked.escape).toBeNull();
    expect(asked.result).toEqual(held.result);
  });

  it('leaves an unsupported raid without the support field', () => {
    const outcome = raid({ DART: 30 }, { DART: 5 }, []);
    expect(outcome.escape).toEqual({ kind: 'ESCAPED', ships: { DART: 5 }, fuel: escapeFuel({ DART: 5 }) });
  });
});
