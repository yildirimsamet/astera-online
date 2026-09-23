import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  INTEL,
  RESEARCH_TECH,
  combatValue,
  forecastLines,
  forecastLoss,
  matchupsAgainst,
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
 * it. Raider-profile mirrors historically needed about half as much again for a
 * clean sweep. Attack-led Lances can instead erase both sides in one salvo, so
 * that rule of thumb must not be treated as a universal combat invariant.
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
  it('asks for about half as much again to clear a Raider-profile mirror', () => {
    const wing: Fleet = { VIPER: 30 };
    const f = forecastLines(wing, blind({ wall: { kind: 'EXACT', fleet: { VIPER: 1 } } }));
    const mine = combatValue(wing);
    expect(f.clears.low).toBeGreaterThan(mine / 1.8);
    expect(f.clears.low).toBeLessThan(mine / 1.2);
    expect(f.breaks.low).toBeGreaterThan(mine * 0.9);
  });

  it('matches attack-led Lance mirrors without treating DECISIVE as survival', () => {
    const wing: Fleet = { TALON: 30 };
    for (const count of [28, 29, 30, 31, 32, 33]) {
      const crew: Fleet = { TALON: count };
      const input = blind({ wall: { kind: 'EXACT', fleet: crew } });
      const f = forecastLines(wing, input);
      const r = resolveCombat(wing, crew, 0, flat, {
        attacker: { tech: none }, defender: { tech: none },
      });
      expect(combatValue(crew) < f.clears.low, `clears ${String(count)}`).toBe(r.grade === 'DECISIVE');
      expect(combatValue(crew) < f.breaks.low, `breaks ${String(count)}`).toBe(r.grade !== 'REPELLED');
      if (count === 30) {
        expect(r.grade).toBe('DECISIVE');
        expect(combatValue(r.attackerSurvivors)).toBe(0);
        expect(combatValue(r.defenderSurvivors)).toBe(0);
      }
    }
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

/**
 * SALDIRI EKRANINDA KARŞI-SINIF KURALI — VE OKUMANIN SINIRI. 2026-09-21.
 *
 * `MatchupMark` (×1.6 / ×0.625'i çizen bileşen) D124'ten beri var, unit-test'li ve uygulamada
 * HİÇBİR YERDE kullanılmıyordu. Docblock'u sebebini söylüyordu ve o sebep yazıldığında doğruydu:
 * *"a probe reports a defence value and a ship count and never a composition (D127)"*. D199 bunu
 * değiştirdi — `classReading` sonda raporuna girdi — ve bileşen eski kuralın altında kapalı kaldı.
 *
 * Ölçülen bedel: aynı duvara aynı bütçeyle ayna sınıf gönderen 631.777 kaybediyor, doğru
 * karşı-sınıf 159.289 — dört kat. Oyuncu bunu yalnızca filosunu kaybettikten sonra öğreniyordu.
 *
 * AMA BU YÜZEY OKUMADAN FAZLASINI SÖYLEYEMEZ. Par bir sonda (doğruluk 0,55) yalnızca ÇOĞUNLUĞU
 * adlandırır; 51/49 bir duvar da, saf bir duvar da `DOMINANT` okunur. Ölçüldü: aynı tavsiyeye karşı
 * Citadel kaybı 256.277 → 504.946 AE. Bu yüzden yüzey "ne bilinmiyor"u da taşımak zorunda —
 * `forecastLines`/`shapesFor` bu belirsizliği zaten doğru modelliyor, bu fonksiyon onu tek sınıfa
 * çökertmemeli.
 */
describe('gönderilen filonun karşı-sınıf eşleşmesi', () => {
  const wing = { PIKE: 10, DART: 5, RAMPART: 2 };

  it('okuma yoksa hiçbir şey söylemez', () => {
    for (const r of [undefined, { kind: 'UNREAD' } as const, { kind: 'NONE' } as const]) {
      expect(matchupsAgainst(wing, r)).toBeNull();
    }
  });

  /** ÇOĞUNLUK OKUMASI BİR ORANDIR, BİR DUVAR DEĞİL: kalanı okunmadı ve seni karşılayabilir. */
  it('çoğunluk okumasında okunmayan payı açıkça taşır', () => {
    const m = matchupsAgainst(wing, { kind: 'DOMINANT', cls: 'LANCE' })!;
    expect(m.kind).toBe('MAJORITY');
    expect(m.unknownShare).toBeCloseTo(1 - INTEL.classMajority, 6);
    expect(m.beats).toBe('BULWARK');
  });

  it('çoğunluk okumasında satırlar yalnızca BİLİNEN paya konuşur', () => {
    const m = matchupsAgainst(wing, { kind: 'DOMINANT', cls: 'LANCE' })!;
    const by = new Map(m.rows.map((r) => [r.cls, r]));
    expect(by.get('BULWARK')!.strongShare).toBeCloseTo(INTEL.classMajority, 6);
    expect(by.get('BULWARK')!.weakShare).toBe(0);
    expect(by.get('SKIRMISHER')!.weakShare).toBeCloseTo(INTEL.classMajority, 6);
  });

  /** ÖZELLİK: tavsiye 100/0, 60/40 ve 51/49 için aynı derecede DOĞRU kalmalı. */
  it('saf duvarla 51/49 duvarı aynı kesinlikte sunmaz', () => {
    const m = matchupsAgainst(wing, { kind: 'DOMINANT', cls: 'LANCE' })!;
    expect(m.unknownShare).toBeGreaterThan(0);
  });

  it('tam dağılımda hiçbir sıfır olmayan sınıfı sessizce atmaz', () => {
    const m = matchupsAgainst(wing, {
      kind: 'SHARES', shares: { SKIRMISHER: 20, LANCE: 30, BULWARK: 50 },
    })!;
    expect(m.kind).toBe('SPLIT');
    expect(m.unknownShare).toBe(0);
    const bulwark = m.rows.find((r) => r.cls === 'BULWARK')!;
    expect(bulwark.strongShare).toBeCloseTo(0.30, 6);
    expect(bulwark.weakShare).toBeCloseTo(0.20, 6);
  });

  /** ÖZELLİK: daha iyi bir okuma belirsizliği asla GENİŞLETMEZ. */
  it('daha iyi okuma belirsizliği daraltır', () => {
    const majority = matchupsAgainst(wing, { kind: 'DOMINANT', cls: 'LANCE' })!;
    const split = matchupsAgainst(wing, {
      kind: 'SHARES', shares: { SKIRMISHER: 20, LANCE: 60, BULWARK: 20 },
    })!;
    expect(split.unknownShare).toBeLessThanOrEqual(majority.unknownShare);
  });

  it('dengeli dağılımda tek bir sert counter olmadığını söyler', () => {
    const m = matchupsAgainst(wing, { kind: 'EVEN' })!;
    expect(m.kind).toBe('MIXED');
    expect(m.beats).toBeNull();
    expect(m.unknownShare).toBe(1);
  });

  it('tek sınıflı filoyu işaretler — counteri okunmayan kısımda olabilir', () => {
    expect(matchupsAgainst({ PIKE: 10 }, { kind: 'EVEN' })!.wingSingleClass).toBe(true);
    expect(matchupsAgainst(wing, { kind: 'EVEN' })!.wingSingleClass).toBe(false);
  });

  /** Taşıyıcı döngünün dışında; uydurma bir basamak çizilmemeli. */
  it('destek sınıfını satır olarak saymaz', () => {
    expect(matchupsAgainst({ COURIER: 9 }, { kind: 'DOMINANT', cls: 'LANCE' })!.rows).toEqual([]);
  });

  it('satırları filonun ağırlığına göre sıralar', () => {
    const m = matchupsAgainst({ PIKE: 1, RAMPART: 40 }, { kind: 'DOMINANT', cls: 'LANCE' })!;
    expect(m.rows[0]!.cls).toBe('BULWARK');
  });

  /** Dağılımda "ne getirmeliyim" en iyi net payı olan sınıftır, en büyük paya körü körüne değil. */
  it('dağılımda net payı en iyi sınıfı önerir', () => {
    const m = matchupsAgainst(wing, {
      kind: 'SHARES', shares: { SKIRMISHER: 10, LANCE: 60, BULWARK: 30 },
    })!;
    expect(m.beats).toBe('BULWARK');
  });

  /** Okumanın ADLANDIRDIĞI sınıf, arayüzün "ağırlıklı X" cümlesini kurabilmesi için. */
  it('okumanın adlandırdığı duvar sınıfını taşır', () => {
    expect(matchupsAgainst(wing, { kind: 'DOMINANT', cls: 'LANCE' })!.wall).toBe('LANCE');
    expect(matchupsAgainst(wing, {
      kind: 'SHARES', shares: { SKIRMISHER: 10, LANCE: 60, BULWARK: 30 },
    })!.wall).toBe('LANCE');
    expect(matchupsAgainst(wing, { kind: 'EVEN' })!.wall).toBeNull();
  });

  it('counter çarpanları COMBAT sabitlerinden gelir', () => {
    expect(COMBAT.strongMult).toBeGreaterThan(1);
    expect(COMBAT.weakMult).toBeLessThan(1);
  });
});

/**
 * THE WHOLE READING, NOT JUST THE PART MY WING HAPPENS TO ANSWER. Owner review, 2026-09-21.
 *
 * `rows` is keyed by the classes the PLAYER is carrying, which is the right shape for "what does
 * my Bulwark do here" — and it silently threw away everything else the probe paid for. A SHARES
 * reading of 60 Lance · 30 Bulwark · 10 Skirmisher reached the screen as two numbers hanging off
 * one Bulwark row, with the target's own class names gone; pick an empty wing and the distribution
 * vanished entirely. The plan's acceptance test for 0.2 is explicit: *a SHARES reading must not
 * silently drop any non-zero class.*
 */
describe('the distribution a reading resolved', () => {
  const shares = { SKIRMISHER: 0.1, BULWARK: 0.3, LANCE: 0.6 };

  it('carries every non-zero class of a SHARES reading, largest first', () => {
    const m = matchupsAgainst({}, { kind: 'SHARES', shares })!;
    expect(m.wallShares.map((r) => r.cls)).toEqual(['LANCE', 'BULWARK', 'SKIRMISHER']);
    expect(m.wallShares.map((r) => r.share)).toEqual([0.6, 0.3, 0.1]);
  });

  it('carries the distribution whatever the player happens to be flying', () => {
    const empty = matchupsAgainst({}, { kind: 'SHARES', shares })!;
    const oneClass = matchupsAgainst({ RAMPART: 10 }, { kind: 'SHARES', shares })!;
    expect(oneClass.wallShares).toEqual(empty.wallShares);
  });

  it('drops a class the reading measured at zero', () => {
    const m = matchupsAgainst({}, {
      kind: 'SHARES', shares: { SKIRMISHER: 0, BULWARK: 0.4, LANCE: 0.6 },
    })!;
    expect(m.wallShares.map((r) => r.cls)).toEqual(['LANCE', 'BULWARK']);
  });

  /** A majority reading resolved one class and nothing else; the rest is `unknownShare`. */
  it('carries only the named majority on a DOMINANT reading', () => {
    const m = matchupsAgainst({}, { kind: 'DOMINANT', cls: 'LANCE' })!;
    expect(m.wallShares.map((r) => r.cls)).toEqual(['LANCE']);
    expect(m.wallShares[0]!.share + m.unknownShare).toBeCloseTo(1, 9);
  });

  it('carries nothing at all when the reading resolved nothing', () => {
    expect(matchupsAgainst({ RAMPART: 10 }, { kind: 'EVEN' })!.wallShares).toEqual([]);
  });

  /** Whatever it carries, the shares it names and what it admits it did not read add up. */
  it('never loses any of the wall between what it named and what it did not', () => {
    for (const reading of [
      { kind: 'SHARES' as const, shares },
      { kind: 'SHARES' as const, shares: { SKIRMISHER: 0.34, BULWARK: 0.33, LANCE: 0.33 } },
      { kind: 'DOMINANT' as const, cls: 'BULWARK' as const },
    ]) {
      const m = matchupsAgainst({ PIKE: 4 }, reading)!;
      const named = m.wallShares.reduce((sum, r) => sum + r.share, 0);
      expect(named + m.unknownShare).toBeCloseTo(1, 9);
    }
  });
});
