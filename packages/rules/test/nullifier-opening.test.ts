import { describe, expect, it } from 'vitest';
import { createBattleRecording, HULLS, mulberry32, resolveBattle, type HullId, type RecordedAegisStrike, type RecordedShot } from '../src/index.js';
import { resolveVolley, type VolleyShip } from '../src/randomBattle.js';
const ship = (hull: HullId, attack = 0, hp = 1000): VolleyShip => ({ hull, attack, hp, maxHp: hp, shield: 0, owner: 0, canFire: true, retreated: false });
const fire = (from: VolleyShip[], to: VolleyShip[], shield: number) => {
  const strikes: RecordedAegisStrike[] = [], shots: RecordedShot[] = [];
  const result = resolveVolley(from, to, 1, () => .99, shield, 1,
    { fromIds: from.map((_, i) => `A${i}`), toIds: to.map((_, i) => `D${i}`), shots, strikes });
  return { result, strikes, shots };
};
describe('approved global Nullifier opening before normal fire', () => {
  it('spends all opening bonus before a normal shooter even when the normal shooter is first in firing order', () => {
    const { result, strikes, shots } = fire([ship('TALON', 100), ship('NULLIFIER', 100)], [ship('HARPOON')], 300);
    expect(result.specialistAbsorbed).toBe(300); expect(result.normalAbsorbed).toBe(0);
    expect(result.hullDamage).toBe(200); expect(result.hp).toEqual([800]);
    expect(shots[0]!.sourceId).toBe('A0'); expect(strikes).toMatchObject([{ sourceId: 'A1', damage: 300, aegisBefore: 300, aegisAfter: 0 }]);
    expect(shots.every(shot => shot.hits.every(hit => hit.bonusAegisDamage === 0 && hit.aegisBefore === 0))).toBe(true);
  });
  it('does not interleave one Nullifier’s bonus shares with normal damage across two targets', () => {
    const { result, strikes } = fire([ship('NULLIFIER', 200)], [ship('HARPOON'), ship('HARPOON')], 800);
    expect(result.specialistAbsorbed).toBe(800); expect(result.normalAbsorbed).toBe(0);
    expect(result.hp).toEqual([900, 900]); expect(strikes).toHaveLength(1);
  });
  it('uses the standing armed line’s researched maximum HP and classes, with protected cargo excluded', () => {
    const targets = [{ ...ship('HARPOON', 0, 20), maxHp: 1000 }, ship('THORN'), ship('ARGOSY', 0, 100000)];
    const { result, strikes } = fire([ship('NULLIFIER', 100)], targets, 10000);
    // Lance against Lance = 1; against Skirmisher = 1.6, each with equal max HP.
    expect(strikes[0]!.classMultiplier).toBeCloseTo(1.3);
    expect(result.specialistAbsorbed).toBeCloseTo(520);
    expect(result.hullDamage).toBe(0); expect(result.personal).toBe(0);
    expect(result.credited).toEqual([0]);
  });
  it('combines every firing Nullifier and excludes dead, retreated or maintenance-disabled specialists', () => {
    const from = [ship('NULLIFIER', 100), ship('NULLIFIER', 200), { ...ship('NULLIFIER', 1000), canFire: false },
      { ...ship('NULLIFIER', 1000), retreated: true }, ship('NULLIFIER', 1000, 0)];
    const { result, strikes } = fire(from, [ship('HARPOON')], 10000);
    expect(result.specialistAbsorbed).toBe(1200); expect(strikes.map(strike => strike.sourceId)).toEqual(['A0', 'A1']);
    expect(strikes[1]!.aegisBefore).toBe(9600);
    expect(fire(from, [ship('HARPOON')], 0).strikes).toEqual([]);
  });
  it('keeps the bonus at each round opening while Aegis remains, without changing capture parity or RNG consumption', () => {
    const a = [{ contributionId: 'a', playerId: 'a', fleet: { NULLIFIER: 2 }, tech: { tech: {} } }];
    const d = [{ stackId: 'd', playerId: 'd', fleet: { RAMPART: 1 }, tech: { tech: {} } }];
    for (const hitLimit of [0, 1, 10000]) {
      const capture = createBattleRecording({ hitLimit }), recordedRng = mulberry32(20), plainRng = mulberry32(20);
      const recorded = resolveBattle(a, d, HULLS.NULLIFIER.atk * 100, recordedRng, 'HP_PLANET', true, capture);
      expect(recorded).toEqual(resolveBattle(a, d, HULLS.NULLIFIER.atk * 100, plainRng, 'HP_PLANET', true));
      expect(recordedRng()).toBe(plainRng());
      if (hitLimit < 2) { expect(capture.truncated).toBe(true); expect(capture.rounds).toEqual([]); }
      else {
        expect(capture.rounds.length).toBeGreaterThan(1);
        expect(capture.rounds.every(round => (round.aegisStrikes?.length ?? 0) > 0)).toBe(true);
      }
    }
  });
});
