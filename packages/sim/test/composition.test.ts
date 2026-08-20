import { describe, expect, it } from 'vitest';
import { HULLS, counterMult, fleetValue, type Fleet, type HullId } from '@astera/rules';
import {
  ARCHETYPES, COMBAT_HULLS, GROUND_DEFENCE, adaptiveMix, runSeason, tradeScore,
  type ArchetypeName, type CombatHullId,
} from '../src/index.js';

/**
 * THE BUG THIS FILE EXISTS FOR.
 *
 * The hull buy loop walked `['BULWARK','LANCE','WASP']`, bought the first one it
 * could afford and stopped — so every bot in the galaxy spent its whole military
 * budget on the most expensive hull available to it, which is the inverse of the
 * dominant composition. It survived the entire project undetected because nothing
 * asserted what a bot ends up holding, only what the galaxy ends up measuring.
 */

const value = (f: Fleet, h: HullId): number => (f[h] ?? 0) * (HULLS[h].alloy + HULLS[h].crystal);

/** Value share of each combat hull in a fleet. Haulers are cargo and excluded. */
function shares(f: Fleet): Record<CombatHullId, number> {
  const total = COMBAT_HULLS.reduce((s, h) => s + value(f, h), 0);
  const out = {} as Record<CombatHullId, number>;
  for (const h of COMBAT_HULLS) out[h] = total > 0 ? value(f, h) / total : 0;
  return out;
}

describe('tradeScore ranks hulls by what they trade, not by what they cost', () => {
  it('prefers the hull that counters the defence it is scored against', () => {
    // Derived, not asserted against a hull name: whichever class the counter
    // matrix favours must come out on top, whatever the hull table says today.
    const defenceCls = HULLS[Object.keys(GROUND_DEFENCE)[0] as HullId].cls;
    const best = [...COMBAT_HULLS].sort(
      (x, y) => tradeScore(y, GROUND_DEFENCE) - tradeScore(x, GROUND_DEFENCE),
    )[0]!;
    expect(counterMult(HULLS[best].cls, defenceCls)).toBeGreaterThanOrEqual(1);
  });

  it('scores every buildable hull as worth something', () => {
    for (const h of COMBAT_HULLS) expect(tradeScore(h, GROUND_DEFENCE)).toBeGreaterThan(0);
  });

  it('is zero for a hull with nothing to shoot at', () => {
    expect(tradeScore('WASP', {})).toBe(0);
  });
});

describe('adaptiveMix', () => {
  it('names the top-scoring hull the Shipyard can actually build', () => {
    for (const yard of [0, 1, 2, 3, 4, 5]) {
      const mix = adaptiveMix(yard, { WASP: 1 });
      const buildable = COMBAT_HULLS.filter((h) => yard >= HULLS[h].minShipyard);
      const top = [...buildable].sort(
        (x, y) => tradeScore(y, GROUND_DEFENCE) - tradeScore(x, GROUND_DEFENCE),
      )[0];
      if (!top) continue;
      const named = (Object.keys(mix) as CombatHullId[]).sort((x, y) => mix[y]! - mix[x]!)[0];
      expect(named, `yard ${String(yard)}`).toBe(top);
    }
  });

  it('never names a hull the Shipyard cannot build', () => {
    for (const yard of [0, 1, 2, 3, 4, 5]) {
      for (const h of Object.keys(adaptiveMix(yard, { WASP: 1 })) as CombatHullId[]) {
        expect(HULLS[h].minShipyard, `yard ${String(yard)} named ${h}`).toBeLessThanOrEqual(yard);
      }
    }
  });

  it('hedges rather than solving — the second hull keeps a real share', () => {
    const mix = adaptiveMix(5, { WASP: 1 });
    const named = Object.keys(mix) as CombatHullId[];
    expect(named.length).toBe(2);
    expect(Math.min(...named.map((h) => mix[h]!))).toBeGreaterThanOrEqual(0.25);
  });
});

describe('every archetype declares a composition it can reach', () => {
  it.each(Object.keys(ARCHETYPES) as ArchetypeName[])('%s', (name) => {
    const a = ARCHETYPES[name];
    const named = Object.keys(a.composition) as CombatHullId[];
    expect(named.length, 'an empty composition buys nothing all season').toBeGreaterThan(0);
    const total = named.reduce((s, h) => s + a.composition[h]!, 0);
    expect(total).toBeGreaterThan(0.99);
    expect(total).toBeLessThan(1.01);
    // Something must be buildable from a standing start, or the archetype spends
    // the opening unable to field the eight ships an attack requires.
    expect(named.some((h) => HULLS[h].minShipyard === 0)).toBe(true);
  });

  it('only the informed archetype reasons about its fleet', () => {
    const adaptive = (Object.keys(ARCHETYPES) as ArchetypeName[]).filter(
      (n) => ARCHETYPES[n].adaptsComposition,
    );
    expect(adaptive).toEqual(['GRINDER']);
  });
});

/**
 * THE REGRESSION TEST, and the one that would have caught the original bug.
 *
 * Asserted against each archetype's DECLARED composition rather than against a
 * hull name, so it stays true when the combat constants move — which they are
 * about to. Under the old loop a TURTLE with a Shipyard of 4 held Bulwarks it had
 * never asked for, and that is what this refuses.
 */
describe('a bot holds the fleet its archetype asked for', () => {
  const { world } = runSeason({ players: 50, days: 14, seed: 42 });

  it('TURTLE names one hull and holds only that one', () => {
    const turtles = world.players.filter((p) => p.type === 'TURTLE' && fleetValue(p.fleet) > 0);
    expect(turtles.length).toBeGreaterThan(3);
    for (const p of turtles) {
      expect(shares(p.fleet).WASP, `${p.name} bought hulls its archetype never names`)
        .toBeGreaterThan(0.95);
    }
  });

  it('a two-hull archetype ends up holding both', () => {
    const raiders = world.players.filter(
      (p) => p.type === 'RAIDER' && p.buildings.SHIPYARD >= 2 && fleetValue(p.fleet) > 0,
    );
    expect(raiders.length).toBeGreaterThan(3);
    const mean = (h: CombatHullId) =>
      raiders.reduce((s, p) => s + shares(p.fleet)[h], 0) / raiders.length;
    for (const h of Object.keys(ARCHETYPES.RAIDER.composition) as CombatHullId[]) {
      expect(mean(h), `RAIDER holds no ${h} despite naming it`).toBeGreaterThan(0.05);
    }
  });

  it('no archetype spends its whole budget on the most expensive hull it can build', () => {
    // The exact shape of the old bug, stated without naming a hull.
    const dearest = [...COMBAT_HULLS].sort(
      (x, y) => HULLS[y].alloy + HULLS[y].crystal - (HULLS[x].alloy + HULLS[x].crystal),
    )[0]!;
    for (const p of world.players) {
      if (fleetValue(p.fleet) <= 0) continue;
      if (ARCHETYPES[p.type].composition[dearest]) continue; // it genuinely wants them
      if (ARCHETYPES[p.type].adaptsComposition) continue; // it may have chosen them
      expect(shares(p.fleet)[dearest], `${p.type} ${p.name}`).toBeLessThan(0.2);
    }
  });
});
