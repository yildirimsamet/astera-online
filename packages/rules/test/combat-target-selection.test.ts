import { describe, expect, it } from 'vitest';
import { COMBAT, HULLS, counterMult, mulberry32, resolveBattle, type HullId } from '../src/index.js';
import { createBattleRecording, type RecordedShot } from '../src/battleRecording.js';
import { resolveVolley, type VolleyShip } from '../src/randomBattle.js';

const ship = (hull: HullId, hp = 10000, attack = 0): VolleyShip =>
  ({ hull, hp, attack, shield: 0, owner: 0, canFire: true, retreated: false });
function fire(targets: VolleyShip[], attack = 100, seed = 7, hull: HullId = 'DART') {
  const shots: RecordedShot[] = [];
  const result = resolveVolley([ship(hull, 10000, attack)], targets, 1, mulberry32(seed), 0, 1,
    { fromIds: ['a'], toIds: targets.map((_, i) => String(i)), shots });
  return { ...result, shot: shots[0], ids: new Set(shots[0]?.hits.map(hit => hit.targetId)) };
}

describe('ten distinct targets per shot, preferring favourable counters', () => {
  it.each([0, 1, 9, 10, 11, 200])('hits at most ten of %i eligible targets', count => {
    const result = fire(Array.from({ length: count }, () => ship('DART')));
    expect(result.ids.size).toBe(Math.min(10, count));
    expect(result.hp.filter(hp => hp < 10000)).toHaveLength(Math.min(10, count));
    expect(result.hullDamage).toBeCloseTo(count > 0 ? 100 : 0, 8);
  });

  it('selects distinct targets randomly within an equal-priority class and repeats deterministically', () => {
    const targets = Array.from({ length: 40 }, () => ship('DART'));
    expect(fire(targets, 100, 7)).toEqual(fire(targets, 100, 7));
    expect([...fire(targets, 100, 7).ids]).not.toEqual([...fire(targets, 100, 8).ids]);
    expect([...fire(targets).ids]).not.toEqual(Array.from({ length: 10 }, (_, i) => String(i)));
  });

  it('fills the cap with favourable targets before neutral and unfavourable targets, including ground guns', () => {
    const targets = [...Array.from({ length: 15 }, () => ship('HARPOON')),
      ...Array.from({ length: 15 }, () => ship('THORN')), ...Array.from({ length: 15 }, () => ship('BASTION'))];
    const result = fire(targets);
    expect(result.ids.size).toBe(10);
    expect([...result.ids].every(id => targets[Number(id)]!.hull === 'BASTION')).toBe(true);
    const mixed = fire([ship('BASTION'), ship('BASTION'), ship('BASTION'),
      ...Array.from({ length: 4 }, () => ship('THORN')), ...Array.from({ length: 20 }, () => ship('HARPOON'))]);
    expect(mixed.ids.size).toBe(10);
    expect([...mixed.ids].filter(id => Number(id) < 3)).toHaveLength(3);
    expect([...mixed.ids].filter(id => Number(id) >= 3 && Number(id) < 7)).toHaveLength(4);
    expect([...mixed.ids].filter(id => Number(id) >= 7)).toHaveLength(3);
  });

  it('excludes dead and retreated targets, and never prioritises counter-weak cargo over an armed escort', () => {
    const targets = [ship('BASTION', 0), { ...ship('BASTION'), retreated: true },
      ship('HARPOON'), ...Array.from({ length: 20 }, () => ship('COURIER'))];
    const result = fire(targets);
    expect([...result.ids]).toEqual(['2']);
    expect(result.hp.slice(3).every(hp => hp === 10000)).toBe(true);
  });

  it('spends overflow only inside the selected ten and records the unused budget after all ten die', () => {
    const targets = Array.from({ length: 20 }, () => ship('DART', 1));
    const result = fire(targets, 1000);
    expect(result.ids.size).toBe(10);
    expect(result.hp.filter(hp => hp === 0)).toHaveLength(10);
    expect(result.hullDamage).toBeCloseTo(10, 8);
    expect(result.shot?.unusedBaseDamage).toBeCloseTo(990, 8);
  });

  it('can spill into cargo in the same shot using only the remaining distinct-target slots', () => {
    const targets = [ship('DART', 1), ship('DART', 1), ...Array.from({ length: 30 }, () => ship('COURIER', 1))];
    const result = fire(targets, 1000);
    expect(result.ids.size).toBe(10);
    expect(result.ids.has('0') && result.ids.has('1')).toBe(true);
    expect(result.hp.filter(hp => hp === 0)).toHaveLength(10);
    expect(result.shot?.hits.filter(hit => Number(hit.targetId) >= 2).every(hit => hit.pass > 0)).toBe(true);
    expect(result.shot?.unusedBaseDamage).toBeCloseTo(1000 - 2 - 8 / COMBAT.strongMult, 8);
  });

  it('does not expose cargo when selected escorts die but unselected escorts remain', () => {
    const targets = [...Array.from({ length: 11 }, () => ship('DART', 1)), ship('COURIER', 1), ship('GARBAGE_COLLECTOR', 1)];
    const result = fire(targets, 1000);
    expect(result.ids.size).toBe(10);
    expect(result.hp.slice(11)).toEqual([1, 1]);
  });

  it('uses a fresh selection per shooter, preserving total per-shot base energy and the real battle recording', () => {
    const recording = createBattleRecording();
    const result = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { DART: 2 }, tech: { tech: {} } }],
      [{ stackId: 'd', playerId: 'd', fleet: { BASTION: 30 }, tech: { tech: {} } }], 0, mulberry32(7), 'HP_PLANET', true, recording);
    expect(result.rounds[0]).toHaveProperty('targetLimit', 10);
    const shots = recording.rounds[0]!.attackerShots;
    expect(shots).toHaveLength(2);
    expect(shots.map(s => s.hits.map(h => h.targetId))[0]).not.toEqual(shots.map(s => s.hits.map(h => h.targetId))[1]);
    for (const round of recording.rounds) for (const shot of [...round.attackerShots, ...round.defenderShots]) {
      expect(new Set(shot.hits.map(hit => hit.targetId)).size).toBeLessThanOrEqual(10);
      expect(shot.hits.reduce((sum, hit) => sum + (hit.normalAegisDamage + hit.shieldDamage + hit.hullDamage) / hit.counter, shot.unusedBaseDamage)).toBeCloseTo(shot.baseDamage, 7);
      const source = recording.ships.find(s => s.id === shot.sourceId)!;
      for (const hit of shot.hits) expect(hit.counter).toBe(counterMult(HULLS[source.hull].cls, HULLS[recording.ships.find(s => s.id === hit.targetId)!.hull].cls));
    }
  });
});
