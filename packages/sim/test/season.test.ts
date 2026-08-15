import { describe, expect, it } from 'vitest';
import { median } from '@blindspace/rules';
import {
  BANDS, LEVERS, informedArchetypeWins, ladderByArchetype,
  runSeason, verdict, type InvariantKey,
} from '../src/index.js';

/**
 * THE REGRESSION GATE.
 *
 * A balance regression — someone nudges a constant and the vault silently starts
 * protecting 200% of storage again — is invisible to unit tests and catastrophic
 * in production. Running a full simulated season is the only thing that catches
 * it, and it costs a few seconds.
 */
const SEEDS = [42, 7, 99];
const CFG = { players: 120, days: 14 };

describe.each(SEEDS)('season on seed %i', (seed) => {
  const { world, days } = runSeason({ ...CFG, seed });
  // Days 1-2 are identical for everyone; measuring them says nothing.
  const settled = days.slice(2).map((d) => d.invariants);

  it.each(Object.keys(BANDS) as InvariantKey[])('%s holds its band', (key) => {
    const values = settled.map((d) => d[key]).filter((v) => !Number.isNaN(v));
    expect(values.length).toBeGreaterThan(0);
    const m = median(values);
    const v = verdict(key, m);
    expect(v, `${key} = ${m.toFixed(3)} is ${v}. Lever: ${LEVERS[key]}`).toBe('OK');
  });

  it('the informed archetype tops the ladder', () => {
    const board = ladderByArchetype(world.players);
    expect(informedArchetypeWins(world.players), JSON.stringify(board, null, 1)).toBe(true);
  });

  it('passive accumulation scores nothing', () => {
    const turtle = ladderByArchetype(world.players).find((r) => r.type === 'TURTLE');
    expect(turtle!.medianDominion).toBeLessThanOrEqual(0);
  });

  it('the season actually progressed', () => {
    const topCore = Math.max(...world.players.map((p) => p.buildings.CORE));
    expect(topCore).toBeGreaterThanOrEqual(9);
    expect(topCore).toBeLessThanOrEqual(18);
  });

  it('dominion is zero-sum across the whole galaxy', () => {
    const total = world.players.reduce((s, p) => s + p.ledger.taken - p.ledger.lost, 0);
    expect(Math.abs(total)).toBeLessThan(1);
  });
});
