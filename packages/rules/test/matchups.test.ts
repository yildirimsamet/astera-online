import { describe, expect, it } from 'vitest';
import { COMBAT, INTEL, matchupsAgainst } from '../src/index.js';

/**
 * A COMBAT v3 PROBE READS EACH CLASS AS A RANGE (owner 2026-10-25): never an exact split. The
 * counter line carries the ranges as read — floors as the share known for certain, tops beside
 * them — and names what to bring from the middle of each range, which is all the reading allows.
 */
describe('a class reading of ranges', () => {
  const reading = {
    kind: 'RANGES' as const,
    shares: { SKIRMISHER: { low: 0, high: 20 }, BULWARK: { low: 20, high: 40 }, LANCE: { low: 50, high: 70 } },
  };

  it('carries every class the range admits, largest first, with its floor and its top', () => {
    const m = matchupsAgainst({}, reading)!;
    expect(m.kind).toBe('RANGES');
    expect(m.wallShares).toEqual([
      { cls: 'LANCE', share: 0.5, high: 0.7 },
      { cls: 'BULWARK', share: 0.2, high: 0.4 },
      { cls: 'SKIRMISHER', share: 0, high: 0.2 },
    ]);
    expect(m.unknownShare).toBeCloseTo(0.3, 9);
  });

  it('drops a class the reading rules out', () => {
    const m = matchupsAgainst({}, { kind: 'RANGES', shares: { ...reading.shares, SKIRMISHER: { low: 0, high: 0 } } })!;
    expect(m.wallShares.map((row) => row.cls)).toEqual(['LANCE', 'BULWARK']);
  });

  it('names the wall and what beats it from the middle of each range', () => {
    const m = matchupsAgainst({ PIKE: 10 }, reading)!;
    expect(m.wall).toBe('LANCE');
    expect(m.beats).toBe('BULWARK');
  });

  it('gives each class of the wing its strong and weak share as ranges', () => {
    const m = matchupsAgainst({ RAMPART: 10 }, reading)!;
    expect(m.rows).toEqual([{ cls: 'BULWARK', strongShare: 0.5, strongHigh: 0.7, weakShare: 0, weakHigh: 0.2 }]);
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
 * Citadel kaybı 256.277 → 504.946 AE. Bu yüzden yüzey "ne bilinmiyor"u da taşımak zorunda; bu
 * fonksiyon belirsizliği tek sınıfa çökertmemeli.
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

