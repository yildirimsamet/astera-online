import { describe, expect, it } from 'vitest';
import { COMBAT, HULLS, counterMult, mulberry32, resolveBattle, type HullId } from '../src/index.js';
import { createBattleRecording, type RecordedShot } from '../src/battleRecording.js';
import { resolveVolley, type VolleyShip } from '../src/randomBattle.js';

/**
 * TARGET SELECTION — combat v3 (owner 2026-10-25). One target per shot, the favourable
 * counter class first (owner 2026-10-25, carried over from the ten-target rule it replaces),
 * overflow carried to the next target by the same rule, cargo covered while armed ships stand.
 */
const ship = (hull: HullId, hp = 10000, attack = 0): VolleyShip =>
  ({ hull, hp, attack, shield: 0, owner: 0, canFire: true, retreated: false });
function fire(targets: VolleyShip[], attack = 100, seed = 7, hull: HullId = 'DART') {
  const shots: RecordedShot[] = [];
  const result = resolveVolley([ship(hull, 10000, attack)], targets, 1, mulberry32(seed), 0, 1,
    { fromIds: ['a'], toIds: targets.map((_, i) => String(i)), shots });
  return { ...result, shot: shots[0], ids: shots[0]?.hits.map(hit => hit.targetId) ?? [] };
}

describe('one target per shot, preferring favourable counters', () => {
  it.each([0, 1, 9, 10, 11, 200])('a shot that kills nothing touches one of %i eligible targets', count => {
    const result = fire(Array.from({ length: count }, () => ship('DART')));
    expect(result.ids).toHaveLength(Math.min(1, count));
    expect(result.hp.filter(hp => hp < 10000)).toHaveLength(Math.min(1, count));
    expect(result.hullDamage).toBeCloseTo(count > 0 ? 100 : 0, 8);
  });

  it('excludes dead and retreated targets, and never prioritises counter-weak cargo over an armed escort', () => {
    const targets = [ship('BASTION', 0), { ...ship('BASTION'), retreated: true },
      ship('HARPOON'), ...Array.from({ length: 20 }, () => ship('COURIER'))];
    for (let seed = 0; seed < 20; seed++) {
      const result = fire(targets, 100, seed);
      expect(result.ids).toEqual(['2']);
      expect(result.hp.slice(3).every(hp => hp === 10000)).toBe(true);
    }
  });

  it('kills through a line of weak targets one by one and records what was left over', () => {
    const targets = Array.from({ length: 20 }, () => ship('DART', 1));
    const result = fire(targets, 15);
    expect(result.hp.filter(hp => hp === 0)).toHaveLength(15);
    expect(result.shot?.hits.map(hit => hit.pass)).toEqual(Array.from({ length: 15 }, (_, i) => i));
    expect(result.shot?.unusedBaseDamage).toBe(0);
    const all = fire(Array.from({ length: 3 }, () => ship('DART', 1)), 1000);
    expect(all.hp).toEqual([0, 0, 0]);
    // Three kills cost one base each; with nothing left to hit, the rest goes unused.
    expect(all.shot?.unusedBaseDamage).toBeCloseTo(997, 8);
  });

  it('does not expose cargo while any escort stands, then spills into it', () => {
    const covered = fire([...Array.from({ length: 11 }, () => ship('DART', 1)), ship('COURIER', 1), ship('GARBAGE_COLLECTOR', 1)], 5);
    expect(covered.hp.slice(11)).toEqual([1, 1]);
    const spilled = fire([ship('DART', 1), ship('DART', 1), ...Array.from({ length: 30 }, () => ship('COURIER', 1))], 1000);
    expect(spilled.hp.slice(0, 2)).toEqual([0, 0]);
    expect(spilled.hp.filter(hp => hp === 0)).toHaveLength(32);
    expect(spilled.shot?.unusedBaseDamage).toBeCloseTo(1000 - 2 - 30 / COMBAT.strongMult, 8);
  });

  it('keeps per-shot base energy and the counters it used in the real battle recording', () => {
    const recording = createBattleRecording();
    const result = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { DART: 2 }, tech: { tech: {} } }],
      [{ stackId: 'd', playerId: 'd', fleet: { BASTION: 30 }, tech: { tech: {} } }], 0, mulberry32(7), 'HP_PLANET', true, recording);
    expect(result.rounds[0]).toHaveProperty('targetLimit', 1);
    for (const round of recording.rounds) for (const shot of [...round.attackerShots, ...round.defenderShots]) {
      expect(shot.hits.reduce((sum, hit) => sum + (hit.normalAegisDamage + hit.shieldDamage + hit.hullDamage) / hit.counter, shot.unusedBaseDamage)).toBeCloseTo(shot.baseDamage, 7);
      const source = recording.ships.find(s => s.id === shot.sourceId)!;
      for (const hit of shot.hits) expect(hit.counter).toBe(counterMult(HULLS[source.hull].cls, HULLS[recording.ships.find(s => s.id === hit.targetId)!.hull].cls));
    }
  });
});
