import { describe, expect, it } from 'vitest';
import { HULLS, raidLedger, resourceValue, type Fleet, type Resources } from '../src/index.js';

/**
 * BİR AKININ GERÇEK HESABI — VE ÜÇ FARKLI "KÂR" SORUSU.
 *
 * Bu oturumda akın kârlılığı üç kez ölçüldü ve üçünde de farklı çıktı, çünkü her seferinde başka
 * bir şey sayıldı: bir kez enkaz bedava sayıldı (oysa 345.830 birimlik bir enkazı kaldırmak 24
 * hurdacı = 624.000 AE sermaye ister), bir kez yağma kargo sınırı olmadan sayıldı (61 Citadel 28.975
 * ham birim taşır), bir kez de kayıplar `fleetValue` (A+C+D) ile fiyatlanıp yakıt `resourceValue`
 * (A+2C+32D) ile fiyatlandı.
 *
 * Bu yüzden defter TEK BİR SAYI DÖNDÜRMÜYOR. Üç soru gerçekten farklı:
 *   · LİKİT     — bugün bankaya ne girdi? (yağma + kurtarma − yakıt)
 *   · YENİLEME  — kalıcı olarak yok olan gövdeleri de düşünce ne kaldı?
 *   · SERVET    — ele geçirilen gövdeler de sayılınca? (varlık, likit değil)
 *
 * Ve savunanın kaybı hiçbirine girmiyor: o Dominion'un girdisi, saldıranın geliri değil.
 */
const res = (alloy = 0, crystal = 0, deuterium = 0): Resources => ({ alloy, crystal, deuterium });
const cost = (f: Fleet): Resources => {
  const out = res();
  for (const [id, n] of Object.entries(f) as [keyof typeof HULLS, number][]) {
    const h = HULLS[id];
    out.alloy += n * h.alloy;
    out.crystal += n * h.crystal;
    out.deuterium += n * h.deuterium;
  }
  return out;
};

describe('bir akının muhasebesi', () => {
  const base = {
    attackerLosses: {} as Fleet,
    defenderLosses: {} as Fleet,
    loot: res(),
    salvage: res(),
    fuelPaid: 0,
  };

  it('likit hesap yağma ve kurtarmayı toplar, yakıtı düşer', () => {
    const l = raidLedger({ ...base, loot: res(1000, 500), salvage: res(200), fuelPaid: 30 });
    expect(l.liquid).toEqual(res(1200, 500, -30));
  });

  /** Yakıt kalkışta ödenir ve hiç iade edilmez — eli boş dönen akın bile onu ödemiştir. */
  it('eli boş dönen akın yine de yakıtı ödemiş sayılır', () => {
    expect(raidLedger({ ...base, fuelPaid: 120 }).liquid).toEqual(res(0, 0, -120));
  });

  it('yenileme hesabı kalıcı olarak yok olan gövdeleri düşer', () => {
    const lost: Fleet = { BALLISTA: 10 };
    const l = raidLedger({ ...base, loot: res(50_000), attackerLosses: lost });
    const c = cost(lost);
    expect(l.replacement).toEqual(res(50_000 - c.alloy, -c.crystal, -c.deuterium));
  });

  /** Ele geçirilen gövde bir VARLIKTIR; likit sayılırsa akın "kârlı" görünürken bir sonraki kalkış fonlanamaz. */
  it('ele geçirilen gövdeyi servete yazar, likide yazmaz', () => {
    const l = raidLedger({ ...base, captured: { DART: 4 } });
    expect(l.liquid).toEqual(res());
    expect(l.wealth).toEqual(cost({ DART: 4 }));
    expect(l.ae.wealth).toBeGreaterThan(l.ae.liquid);
  });

  /** Savunanın kaybı Dominion'un girdisidir; saldıranın hiçbir hesabına girmez. */
  it('savunanın kaybını saldıranın gelirine yazmaz', () => {
    const l = raidLedger({ ...base, defenderLosses: { BALLISTA: 200 } });
    expect(l.liquid).toEqual(res());
    expect(l.replacement).toEqual(res());
    expect(l.wealth).toEqual(res());
    expect(l.denied).toEqual(cost({ BALLISTA: 200 }));
  });

  /** ENKAZ, KALDIRILDIĞI KADARDIR. Yörüngede duran alan, biri gidip toplayana kadar gelir değildir. */
  it('yalnızca gerçekten kaldırılan kurtarmayı sayar', () => {
    const l = raidLedger({ ...base, salvage: res(9_000, 3_000) });
    expect(l.liquid).toEqual(res(9_000, 3_000));
  });

  it('her üç görünümü tek bir değerlemeyle AE cinsinden verir', () => {
    const l = raidLedger({
      ...base, loot: res(1000, 500), salvage: res(200), fuelPaid: 30,
      attackerLosses: { DART: 2 }, captured: { DART: 1 },
    });
    expect(l.ae.liquid).toBeCloseTo(resourceValue(l.liquid), 6);
    expect(l.ae.replacement).toBeCloseTo(resourceValue(l.replacement), 6);
    expect(l.ae.wealth).toBeCloseTo(resourceValue(l.wealth), 6);
    expect(l.ae.replacement).toBeLessThan(l.ae.liquid);
  });

  /** Vektörler birincil: pozitif AE, oyuncuyu yakıtsız bırakabilir. */
  it('pozitif AE yakıt yeterliliğini garanti etmez', () => {
    const l = raidLedger({ ...base, loot: res(200_000), fuelPaid: 400 });
    expect(l.ae.liquid).toBeGreaterThan(0);
    expect(l.liquid.deuterium).toBeLessThan(0);
  });
});
