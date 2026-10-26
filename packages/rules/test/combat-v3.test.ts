import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COMBAT, HULLS, battleBalance, counterMult, createBattleRecording, fleetCount, fleetEntries, fleetValue, handicapFactor,
  matchup, mulberry32, powerUnits, resolveBattle, retreatWindows, tempoScale,
  type Fleet, type HullId, type JointAttackerStack, type RecordedShot, type TechLevels,
  combatOutcomeTable,
} from '../src/index.js';
import { resolveVolley, type VolleyShip } from '../src/randomBattle.js';

/**
 * SAVAŞ v3 — owner decisions K1–K7, 2026-10-25 (docs/combat-v3-plan-2026-10-25.md).
 *
 * One target per shot, picked at random from the armed line, overflow carried (owner 2026-10-26:
 * strict counter-first targeting let a smaller mixed line bleed a larger one); one battle-wide tempo; the stronger
 * side's fire filed down by its advantage up to 1:2 and not at all from 1:3; ships hit below
 * 70% hull may break apart; only the weaker side retreats once the gap reaches 1:1.2; nobody
 * retreats from an enemy that can no longer fire; eight rounds.
 */
const ship = (hull: HullId, hp = 10000, attack = 0, shield = 0): VolleyShip =>
  ({ hull, hp, maxHp: hp, attack, shield, owner: 0, canFire: true, retreated: false });
function fire(targets: VolleyShip[], attack = 100, seed = 7, hull: HullId = 'DART') {
  const shots: RecordedShot[] = [];
  const result = resolveVolley([ship(hull, 10000, attack)], targets, 1, mulberry32(seed), 0, 1,
    { fromIds: ['a'], toIds: targets.map((_, i) => String(i)), shots });
  return { ...result, shot: shots[0]!, ids: shots[0]?.hits.map(hit => Number(hit.targetId)) ?? [] };
}
const attackers = (fleet: Fleet, tech: TechLevels = {}): JointAttackerStack[] =>
  [{ contributionId: 'a', playerId: 'a', fleet, tech: { tech } }];
const defenders = (fleet: Fleet, tech: TechLevels = {}) => [{ stackId: 'd', playerId: 'd', fleet, tech: { tech } }];
const side = (fleet: Fleet, tech: TechLevels = {}) => ({ units: powerUnits(fleet, { tech }) });
/** What a side still owns after the battle: physical survivors, retreated ones included. */
const kept = (start: Fleet, survivors: Fleet) => fleetValue(survivors) / fleetValue(start);

describe('v3 constants', () => {
  it('fights eight rounds, one target per shot, at a 0.2 tempo, breaking ships below 70% hull', () => {
    expect(COMBAT.rounds).toBe(8);
    expect(COMBAT.targetsPerShot).toBe(1);
    expect(COMBAT.tempo).toBe(0.2);
    expect(COMBAT.criticalBelow).toBe(0.7);
    expect(COMBAT.handicap.ratios).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3, 4]);
    expect(COMBAT.handicap.exponents).toHaveLength(COMBAT.handicap.ratios.length);
    expect(COMBAT.retreatTiers).toEqual([25_000, 100_000, 300_000]);
    expect(COMBAT.retreatRatios).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3]);
    expect(COMBAT.retreatWindows).toHaveLength(COMBAT.retreatTiers.length + 1);
    for (const tier of COMBAT.retreatWindows) {
      expect(tier).toHaveLength(COMBAT.retreatRatios.length);
      for (const window of tier) {
        expect(window.threshold).toBeGreaterThan(0); expect(window.threshold).toBeLessThanOrEqual(1);
        expect(window.chance).toBeGreaterThan(0); expect(window.chance).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('one target per shot, random across the armed line, overflow carried', () => {
  it('lands a shot that kills nothing on exactly one ship', () => {
    const r = fire(Array.from({ length: 40 }, () => ship('DART')));
    expect(r.ids).toHaveLength(1);
    expect(r.hp.filter(hp => hp < 10000)).toHaveLength(1);
    expect(r.hullDamage).toBeCloseTo(100, 8);
  });

  it('picks any armed ship alike whatever its class — ground guns too — and hits it with that class’s counter', () => {
    // A Dart is a Skirmisher: ×1.6 on Bulwark (Bastion), ×1 on Skirmisher (Thorn), ×0.625 on Lance (Harpoon).
    const all = [ship('HARPOON'), ship('THORN'), ship('BASTION'), ship('HARPOON'), ship('THORN')];
    const hits = [0, 0, 0, 0, 0];
    for (let seed = 0; seed < 1000; seed++) {
      const r = fire(all, 100, seed), index = r.ids[0]!;
      hits[index]!++;
      expect(r.hullDamage).toBeCloseTo(100 * counterMult('SKIRMISHER', HULLS[all[index]!.hull].cls), 8);
    }
    for (const count of hits) expect(count).toBeGreaterThan(150);
    expect(fire([ship('HARPOON')], 100).hullDamage).toBeCloseTo(100 * COMBAT.weakMult, 8);
  });

  it('repeats exactly for a seed', () => {
    const targets = [ship('DART'), ship('CITADEL'), ship('CATACLYSM')];
    expect(fire(targets, 100, 11)).toEqual(fire(targets, 100, 11));
  });

  it('carries overflow, at base value, to the next target chosen by the same rule', () => {
    // A Cataclysm is a Lance: ×1.6 on the Dart it rolls first, then ×0.625 on the Citadel.
    const r = resolveVolley([ship('CATACLYSM', 1000, 100)], [ship('CITADEL', 1000), ship('DART', 30)], 1, () => 0, 0, 1);
    expect(r.hp[1]).toBe(0);
    expect(r.hp[0]).toBeCloseTo(1000 - (100 - 30 / COMBAT.strongMult) * COMBAT.weakMult, 10);
  });

  it('keeps cargo covered while an armed ship stands, then spills overflow into it in the same shot', () => {
    const covered = fire([ship('DART', 1000), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)], 20);
    expect(covered.hp).toEqual([980, 100, 100]);
    const spill = fire([ship('DART', 5), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)], 20);
    expect(spill.hp[0]).toBe(0);
    expect(spill.hp.slice(1).filter(hp => hp < 100)).toHaveLength(1);
    expect(spill.hullDamage).toBeCloseTo(5 + 15 * COMBAT.strongMult, 8);
    expect(spill.shot.hits.map(hit => hit.pass)).toEqual([0, 1]);
  });

  it('conserves base damage through counters, shields, cargo and repeated overkill', () => {
    fc.assert(fc.property(fc.constantFrom<HullId>('DART', 'CITADEL', 'CATACLYSM'),
      fc.array(fc.record({ hull: fc.constantFrom<HullId>('DART', 'CITADEL', 'CATACLYSM', 'COURIER', 'GARBAGE_COLLECTOR', 'HARPOON'),
        hp: fc.integer({ min: 1, max: 1000 }), shield: fc.integer({ min: 0, max: 500 }), retreated: fc.boolean() }), { minLength: 1, maxLength: 25 }),
      fc.integer({ min: 1, max: 10000 }), fc.nat(), (hull, targets, power, seed) => {
        const to = targets.map(target => ({ ...ship(target.hull, target.hp, 0, target.shield), retreated: target.retreated }));
        const shots: RecordedShot[] = [];
        const r = resolveVolley([ship(hull, 1000, power)], to, 1, mulberry32(seed), 0, 1, { fromIds: ['a'], toIds: to.map((_, i) => String(i)), shots });
        let consumed = 0;
        for (let i = 0; i < to.length; i++) {
          if (to[i]!.retreated) { expect(r.hp[i]).toBe(to[i]!.hp); continue; }
          consumed += (to[i]!.hp - r.hp[i]! + to[i]!.shield - r.shields[i]!) / counterMult(HULLS[hull].cls, HULLS[to[i]!.hull].cls);
        }
        const unused = shots[0]?.unusedBaseDamage ?? power;
        expect(consumed + unused).toBeCloseTo(power, 6);
        for (const shot of shots) {
          const passes = shot.hits.map(hit => hit.pass);
          expect(passes).toEqual(passes.map((_, i) => i));
          expect(new Set(shot.hits.map(hit => hit.targetId)).size).toBe(shot.hits.length);
          // Every hit but the last killed its target: overflow only follows a kill.
          for (const hit of shot.hits.slice(0, -1)) expect(hit.hpAfter).toBe(0);
        }
      }), { seed: 20261025, numRuns: 150 });
  });
});

describe('tempo: one battle-wide pace', () => {
  it('scales both sides so the geometric-mean share of a line lost per round is the tempo', () => {
    for (const [a, d] of [[{ CATACLYSM: 20 }, { CATACLYSM: 20 }], [{ CITADEL: 20 }, { CITADEL: 20 }], [{ DART: 50 }, { PIKE: 30 }]] as [Fleet, Fleet][]) {
      const m = matchup(side(a), side(d));
      const s = tempoScale(m);
      expect(Math.sqrt((s * m.attacker.dps / m.defender.ehp) * (s * m.defender.dps / m.attacker.ehp))).toBeCloseTo(COMBAT.tempo, 10);
    }
  });

  it('leaves a fight one side cannot shoot back in at raw damage', () => {
    expect(tempoScale(matchup(side({ DART: 5 }), side({ COURIER: 3 })))).toBe(1);
    expect(tempoScale(matchup(side({ COURIER: 5 }), side({ DART: 3 })))).toBe(1);
  });

  it('lets a Cataclysm mirror and a Citadel mirror both run for several rounds', () => {
    for (const fleet of [{ CATACLYSM: 20 }, { CITADEL: 20 }] as Fleet[]) {
      let rounds = 0, firstRoundDeaths = 0;
      for (let seed = 0; seed < 20; seed++) {
        const r = resolveBattle(attackers(fleet), defenders(fleet), 0, mulberry32(seed));
        rounds += r.rounds.length / 20;
        firstRoundDeaths += (fleetCount(r.rounds[0]!.attackerLosses) + fleetCount(r.rounds[0]!.defenderLosses)) / 20;
      }
      expect(rounds).toBeGreaterThanOrEqual(4);
      expect(firstRoundDeaths).toBeLessThan(10);
    }
  });
});

describe('üstünlük törpüsü: the stronger side’s fire is filed down by its advantage', () => {
  it('is R^-exponent, the exponent read off the ratio table by linear interpolation, gone past its last ratio', () => {
    const { ratios, exponents } = COMBAT.handicap;
    expect(handicapFactor(1)).toBe(1);
    expect(handicapFactor(0.5)).toBe(1);
    for (let i = 1; i < ratios.length - 1; i++) expect(handicapFactor(ratios[i]!)).toBeCloseTo(ratios[i]! ** -exponents[i]!, 12);
    const mid = (ratios[3]! + ratios[4]!) / 2;
    expect(handicapFactor(mid)).toBeCloseTo(mid ** -((exponents[3]! + exponents[4]!) / 2), 12);
    expect(exponents.at(-1)).toBe(0);
    expect(handicapFactor(ratios.at(-1)!)).toBe(1);
    expect(handicapFactor(10)).toBe(1);
    expect(handicapFactor(Infinity)).toBe(1);
  });

  it('never turns the stronger side into the weaker, and keeps the balance from falling as the ratio grows', () => {
    // Above 2 the stronger side would lose a larger share per round than the weaker one.
    expect(Math.max(...COMBAT.handicap.exponents)).toBeLessThanOrEqual(2);
    let last = 1;
    for (let r = 1; r <= 6; r += 0.01) {
      const effective = r * Math.sqrt(handicapFactor(r));
      expect(effective).toBeGreaterThanOrEqual(last - 1e-12);
      last = effective;
    }
    expect(last).toBeGreaterThan(5);
  });

  it('files down whichever side is stronger, attacker or defender, and never the weaker', () => {
    const attack = battleBalance(matchup(side({ CORSAIR: 16 }), side({ CORSAIR: 10 })));
    expect(attack.stronger).toBe('ATTACK');
    expect(attack.ratio).toBeCloseTo(1.6, 10);
    expect(attack.handicap).toBeCloseTo(handicapFactor(attack.ratio), 12);
    expect(attack.handicap).toBeLessThan(1);
    const defence = battleBalance(matchup(side({ CORSAIR: 10 }), side({ CORSAIR: 16 })));
    expect(defence.stronger).toBe('DEFENCE');
    expect(defence.handicap).toBeCloseTo(attack.handicap, 12);
    const even = battleBalance(matchup(side({ CORSAIR: 10 }), side({ CORSAIR: 10 })));
    expect(even.stronger).toBeNull();
    expect(even.handicap).toBe(1);
  });

  it('records the powers, tempo, handicap and retreat windows the battle was fought with', () => {
    const r = resolveBattle(attackers({ CORSAIR: 16 }), defenders({ CORSAIR: 10 }), 0, mulberry32(3));
    const b = battleBalance(matchup(side({ CORSAIR: 16 }), side({ CORSAIR: 10 })));
    expect(r.balance).toEqual({ attackerPower: b.attackerPower, defenderPower: b.defenderPower, tempo: b.tempo, handicap: b.handicap,
      attackerRetreat: b.attacker, defenderRetreat: b.defender });
    // The stronger attacker past 1:1.2 has no window; the weaker defender has its own.
    expect(r.balance?.attackerRetreat).toBeNull();
    expect(r.balance?.defenderRetreat).not.toBeNull();
  });
});

describe('kaçış: weak side, by ratio and tier', () => {
  const [low, mid] = [COMBAT.retreatRatios[1], COMBAT.retreatRatios[2]];
  it('reads the weak window by ratio with linear interpolation inside the weaker side’s tier', () => {
    const tier = COMBAT.retreatWindows[0]!, a = tier[1]!, b = tier[2]!;
    const w = retreatWindows((low + mid) / 2, 10_000).weak;
    expect(w.threshold).toBeCloseTo((a.threshold + b.threshold) / 2, 12);
    expect(w.chance).toBeCloseTo((a.chance + b.chance) / 2, 12);
    expect(retreatWindows(99, 10_000).weak).toEqual(tier.at(-1));
    expect(retreatWindows(Infinity, 10_000).weak).toEqual(tier.at(-1));
  });

  it('gives both sides of an even fight the tier’s 1:1 window and fades the stronger out by 1:1.2', () => {
    for (const [power, tier] of [[10_000, 0], [25_000, 1], [99_999, 1], [100_000, 2], [300_000, 3], [5e6, 3]] as const) {
      const even = retreatWindows(1, power);
      expect(even.weak).toEqual(COMBAT.retreatWindows[tier]![0]);
      expect(even.strong).toEqual(COMBAT.retreatWindows[tier]![0]);
    }
    const half = retreatWindows(1.1, 10_000).strong!;
    expect(half.threshold).toBe(COMBAT.retreatWindows[0]![0]!.threshold);
    expect(half.chance).toBeCloseTo(COMBAT.retreatWindows[0]![0]!.chance / 2, 12);
    expect(retreatWindows(1.2, 10_000).strong).toBeNull();
    expect(retreatWindows(3, 10_000).strong).toBeNull();
  });

  it('hands the windows to the right sides in the battle balance', () => {
    const b = battleBalance(matchup(side({ CORSAIR: 10 }), side({ CORSAIR: 16 })));
    expect(b.attacker).toEqual(retreatWindows(b.ratio, b.attackerPower).weak);
    expect(b.defender).toBeNull();
  });

  it('gives no window to a side without a gun: unescorted holds are taken (owner 2026-10-06)', () => {
    const b = battleBalance(matchup(side({ DART: 1 }), side({ ATLAS: 1, COURIER: 3 })));
    expect(b.ratio).toBe(Infinity);
    expect(b.defender).toBeNull();
    for (let seed = 0; seed < 32; seed++) {
      const r = resolveBattle(attackers({ DART: 1 }), defenders({ ATLAS: 1 }), 0, mulberry32(seed), 'HP_PLANET');
      expect(r.defenderRetreated ?? {}).toEqual({});
    }
  });

  it('never lets an unarmed hull retreat, however wide the window: holds leave only with a fleet escape', () => {
    // At 1:3 the window opens to nearly a whole hull, and the armed escort does use it.
    expect(battleBalance(matchup(side({ VIPER: 15 }), side({ ATLAS: 40, COURIER: 10, SENTINEL: 6 }))).defender?.threshold).toBeGreaterThanOrEqual(0.9);
    let escorts = 0;
    for (let seed = 0; seed < 32; seed++) {
      const r = resolveBattle(attackers({ VIPER: 15 }), defenders({ ATLAS: 40, COURIER: 10, SENTINEL: 6 }), 0, mulberry32(seed), 'HP_PLANET');
      expect(r.defenderRetreated?.ATLAS ?? 0).toBe(0);
      expect(r.defenderRetreated?.COURIER ?? 0).toBe(0);
      escorts += r.defenderRetreated?.SENTINEL ?? 0;
    }
    expect(escorts).toBeGreaterThan(0);
  });

  it('never retreats from an enemy that can no longer fire, nor after the last round', () => {
    for (let seed = 0; seed < 64; seed++) {
      const recording = createBattleRecording();
      const r = resolveBattle(attackers({ CORSAIR: 10 }), defenders({ CORSAIR: 10 }), 0, mulberry32(seed), 'HP_PLANET', false, recording);
      const last = r.rounds.at(-1)!;
      if (last.round === COMBAT.rounds) expect(last.retreats).toEqual([]);
      for (const { after, retreated } of recording.rounds) {
        // Both sides decide on the state after the volleys; a ship leaving in the same breath still threatens.
        const firing = (prefix: string) => after.some(s => s.id.startsWith(prefix) && (s.status === 'ACTIVE' || retreated.includes(s.id)));
        for (const id of retreated) {
          const enemy = id.startsWith('A') ? 'D' : 'A';
          expect(firing(enemy)).toBe(true);
        }
      }
    }
  });
});

describe('kritik hasar: a ship hit below 70% hull may break apart', () => {
  it('only ever destroys ships that took hull damage that round', () => {
    // Wounded cargo sits behind escorts all battle: never hit, so it never breaks apart.
    let checked = 0;
    for (let seed = 0; seed < 40; seed++) {
      const recording = createBattleRecording();
      const r = resolveBattle(attackers({ DART: 6 }), [{ stackId: 'd', playerId: 'd', fleet: { CITADEL: 3, COURIER: 4 }, tech: { tech: {} },
        damage: [{ hull: 'COURIER', count: 4, damageBp: 6000 }] }], 0, mulberry32(seed), 'MONUMENT', false, recording);
      if ((r.defenderSurvivors.CITADEL ?? 0) > 0) { checked++; expect(r.defenderSurvivors.COURIER).toBe(4); }
      for (const round of recording.rounds) {
        const hit = new Set([...round.attackerShots, ...round.defenderShots].flatMap(shot => shot.hits.filter(h => h.hullDamage > 0).map(h => h.targetId)));
        for (const id of round.exploded ?? []) expect(hit.has(id)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('breaks a ship apart with chance 1 − hull share, reported as a death and an explosion', () => {
    let exploded = 0, rolls = 0;
    for (let seed = 0; seed < 300; seed++) {
      const recording = createBattleRecording();
      const r = resolveBattle(attackers({ CORSAIR: 1 }), defenders({ CORSAIR: 1 }), 0, mulberry32(seed), 'HP_PLANET', false, recording);
      for (const round of recording.rounds) {
        for (const state of round.after) {
          const snapshot = recording.ships.find(s => s.id === state.id)!;
          const hits = [...round.attackerShots, ...round.defenderShots].flatMap(shot => shot.hits).filter(h => h.targetId === state.id);
          const hp = hits.at(-1)?.hpAfter;
          if (hp === undefined || hits.every(h => h.hullDamage === 0)) continue;
          if (hp > 0 && hp / snapshot.maxHp < COMBAT.criticalBelow) {
            rolls += 1 - hp / snapshot.maxHp;
            if ((round.exploded ?? []).includes(state.id)) exploded++;
          }
        }
      }
      for (const round of r.rounds) for (const row of round.explosions ?? []) {
        const deaths = (round.casualties ?? []).find(c => c.side === row.side && c.stackId === row.stackId)!;
        for (const [hull, n] of fleetEntries(row.fleet)) expect(deaths.fleet[hull] ?? 0).toBeGreaterThanOrEqual(n);
      }
    }
    expect(rolls).toBeGreaterThan(20);
    expect(Math.abs(exploded - rolls)).toBeLessThan(4 * Math.sqrt(rolls));
  });
});

describe('gemi sayısından bağımsızlık', () => {
  it('ends Pike against Dart alike at 3, 10 and 100 ships a side', () => {
    const at = (n: number) => {
      let total = 0;
      const seeds = n >= 100 ? 12 : 60;
      for (let seed = 0; seed < seeds; seed++) {
        const r = resolveBattle(attackers({ PIKE: n }), defenders({ DART: n }), 0, mulberry32(seed));
        total += kept({ PIKE: n }, r.attackerSurvivors) / seeds;
      }
      return total;
    };
    const [three, ten, hundred] = [at(3), at(10), at(100)];
    expect(Math.abs(three - hundred)).toBeLessThan(0.12);
    expect(Math.abs(ten - hundred)).toBeLessThan(0.08);
  });
});

describe('rounds as recorded', () => {
  it('marks each round single-target on the per-ship model', () => {
    const r = resolveBattle(attackers({ DART: 20 }), defenders({ PIKE: 12 }), 0, mulberry32(5));
    expect(r.rounds.length).toBeGreaterThan(0);
    expect(r.rounds.every(round => round.distributedFire === true && round.targetLimit === 1)).toBe(true);
  });
});

/** The owner's table (2026-10-25), as the attack sheet, the Wiki and the calibration read it. */
describe('the outcome table the fight is tuned to', () => {
  it('states each side’s average share by entry ratio, with the weak side never under its tier’s even share', () => {
    const rows = combatOutcomeTable();
    expect(rows.map(row => row.ratio)).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3]);
    expect(rows[0]).toEqual({ ratio: 1, weakKeeps: { low: 0.1, high: 0.25 }, strongLoses: { low: 0.75, high: 0.9 } });
    expect(rows[1]).toEqual({ ratio: 1.2, weakKeeps: { low: 0.2, high: 0.25 }, strongLoses: { low: 0.54, high: 0.54 } });
    expect(rows.slice(2).map(row => [row.weakKeeps.low, row.strongLoses.low]))
      .toEqual([[0.25, 0.39], [0.3, 0.3], [0.4, 0.22], [0.5, 0.13], [0.6, 0.08], [0.7, 0.03]]);
  });

  it('never has the stronger side lose more than the weaker one in absolute terms (owner 2026-10-26)', () => {
    // At 1:R the stronger fleet is R times the weaker: its share lost × R is its loss in weaker-fleet units.
    const rows = combatOutcomeTable().slice(1);
    for (const row of rows) expect(row.strongLoses.high * row.ratio, `1:${String(row.ratio)}`).toBeLessThan(1 - row.weakKeeps.low);
    // ...and the stronger side's edge grows with its lead, but it always pays something.
    const shares = rows.map(row => row.strongLoses.high * row.ratio / (1 - row.weakKeeps.low));
    for (let i = 1; i < shares.length; i++) expect(shares[i]!).toBeLessThan(shares[i - 1]!);
    for (const row of rows) expect(row.strongLoses.high).toBeGreaterThan(0);
  });
});
