import { describe, expect, it } from 'vitest';
import {
  FAULT,
  FAULT_KINDS,
  advanceLoyalty,
  alloyRate,
  crystalRate,
  deuteriumRate,
  deuteriumStorageCap,
  drawFault,
  drawFaults,
  eligibleFaults,
  faultTier,
  faultsPossible,
  leakColumn,
  leakBudget,
  leakRates,
  loyaltyRatePerHour,
  minutesUntilLoyalty,
  minutesUntilLoyaltyZero,
  nextLoyaltyMilestone,
  mulberry32,
  nextFaultGapMinutes,
  repairCost,
  repairMinutes,
  storageCap,
  type FaultKind,
} from '../src/index.js';

/**
 * KOLONİ ARIZALARI — `docs/colony-faults-plan.md`.
 *
 * SEKİZ ARIZA TEK BİR ŞEKİLDİR. "Tersanede isyan" ile "alaşım rafinerisinde elektrik
 * kesintisi" arasındaki fark yalnızca hangi etkiyi kapattıklarıdır; isimler flavor,
 * mekanik aynı. Bu suite o eşitliği koruyor: her iddia `FAULT_KINDS` üzerinde dönüyor,
 * tek bir arızaya özel hiçbir dal yok.
 */

const colony = (coreLevel: number, plantLevel = 0) =>
  ({ kind: 'COLONY', coreLevel, plantLevel }) as const;

describe('hangi arızalar mümkün', () => {
  it('capital hiçbir zaman bozulmaz', () => {
    expect(faultsPossible({ kind: 'CAPITAL', coreLevel: 30, plantLevel: 10 })).toBe(false);
    expect(eligibleFaults({ kind: 'CAPITAL', coreLevel: 30, plantLevel: 10 }, [])).toEqual([]);
  });

  it('tarafsız dünya bozulmaz — sahibi yok, onaracak kimse yok', () => {
    expect(faultsPossible({ kind: 'NEUTRAL', coreLevel: 12, plantLevel: 4 })).toBe(false);
  });

  it('çekirdek seviyesi kapıdır ve tam olarak 6dadır', () => {
    expect(faultsPossible(colony(FAULT.minCoreLevel - 1))).toBe(false);
    expect(faultsPossible(colony(FAULT.minCoreLevel))).toBe(true);
  });

  it('döteryum rafinerisi yoksa o arıza listede değildir', () => {
    expect(eligibleFaults(colony(6, 0), [])).not.toContain('PLANT_OUTAGE');
    expect(eligibleFaults(colony(6, 1), [])).toContain('PLANT_OUTAGE');
  });

  it('bir rafineri kurulunca arıza listesi tam sekize çıkar', () => {
    expect(eligibleFaults(colony(6, 1), [])).toHaveLength(FAULT_KINDS.length);
  });

  /**
   * "Aynı arıza aynı anda tekrar olamaz" bir kontrol değil, listenin yapısal sonucu.
   * Aktif olan aday değildir; başka hiçbir yerde tekrar sorulmaz.
   */
  it('aktif bir arıza aday listesinden düşer', () => {
    for (const kind of FAULT_KINDS) {
      expect(eligibleFaults(colony(20, 5), [kind])).not.toContain(kind);
    }
    expect(eligibleFaults(colony(20, 5), FAULT_KINDS)).toEqual([]);
  });

  it('hepsi aktifken çekim boş döner, patlamaz', () => {
    expect(drawFault(colony(20, 5), FAULT_KINDS, mulberry32(1))).toBeNull();
  });

  it('çekim yalnızca uygun ve aktif olmayan bir arıza döndürür', () => {
    const active: FaultKind[] = ['REFINERY_OUTAGE', 'SHIPYARD_REVOLT'];
    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawFault(colony(6, 0), active, mulberry32(seed));
      expect(drawn).not.toBeNull();
      expect(active).not.toContain(drawn!);
      expect(drawn).not.toBe('PLANT_OUTAGE');
    }
  });

  it('çekim uzun vadede her adayı seçer — sabit bir sıra yok', () => {
    const seen = new Set<FaultKind>();
    for (let seed = 0; seed < 2000; seed++) seen.add(drawFault(colony(6, 1), [], mulberry32(seed))!);
    expect(seen.size).toBe(FAULT_KINDS.length);
  });
});

describe('ritim — öğrenilebilir bir periyot olamaz', () => {
  const sample = (n: number): number[] => {
    const rng = mulberry32(20260916);
    return Array.from({ length: n }, () => nextFaultGapMinutes(rng));
  };

  it('sekiz arıza ortalama 48 saatte tamamlanır', () => {
    const gaps = sample(200_000);
    const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length / 60;
    expect(mean).toBeGreaterThan(5.8);
    expect(mean).toBeLessThan(6.2);
    expect(mean * FAULT_KINDS.length).toBeGreaterThan(46);
    expect(mean * FAULT_KINDS.length).toBeLessThan(50);
  });

  it('arızaların kayda değer bir kısmı arka arkaya gelir', () => {
    const gaps = sample(100_000);
    const backToBack = gaps.filter((g) => g < 60).length / gaps.length;
    expect(backToBack).toBeGreaterThan(0.2);
    expect(backToBack).toBeLessThan(0.4);
  });

  it('hiçbir gap tabanın altına inmez', () => {
    for (const gap of sample(50_000)) expect(gap).toBeGreaterThanOrEqual(FAULT.minGapSeconds / 60);
  });

  /**
   * SABİT BİR ARALIK YOK. Varyasyon katsayısı birin civarında ya da üstünde olmalı;
   * daraltılmış bir dağılım oyuncuya "altı saatte bir bak" öğretirdi.
   */
  it('dağılım dar değil', () => {
    const gaps = sample(100_000);
    const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((s, v) => s + (v - mean) ** 2, 0) / gaps.length);
    expect(sd / mean).toBeGreaterThan(0.9);
  });

  it('ardışık gapler birbirini haber vermez', () => {
    const gaps = sample(100_000);
    const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    let cov = 0;
    gaps.forEach((gap, i) => { if (i > 0) cov += (gaps[i - 1]! - mean) * (gap - mean); });
    const sd2 = gaps.reduce((s, v) => s + (v - mean) ** 2, 0) / gaps.length;
    expect(Math.abs(cov / (gaps.length - 1) / sd2)).toBeLessThan(0.05);
  });
});

describe('sadakat', () => {
  it('arıza yokken dolar, dolunca durur', () => {
    expect(loyaltyRatePerHour(0)).toBeGreaterThan(0);
    expect(advanceLoyalty(0, 0, FAULT.loyaltyRecoverHours * 60)).toBe(FAULT.loyaltyMax);
    expect(advanceLoyalty(FAULT.loyaltyMax, 0, 10_000)).toBe(FAULT.loyaltyMax);
  });

  it('sekiz arıza tam olarak on iki saatte sıfırlar', () => {
    expect(advanceLoyalty(100, 8, FAULT.loyaltyCollapseHours * 60)).toBeCloseTo(0, 9);
    expect(advanceLoyalty(100, 8, FAULT.loyaltyCollapseHours * 60 - 1)).toBeGreaterThan(0);
  });

  it('her arıza bir öncekinden daha çok hızlandırır', () => {
    for (let k = 1; k < FAULT_KINDS.length; k++) {
      const step = Math.abs(loyaltyRatePerHour(k + 1)) - Math.abs(loyaltyRatePerHour(k));
      const prev = k === 1 ? 0 : Math.abs(loyaltyRatePerHour(k)) - Math.abs(loyaltyRatePerHour(k - 1));
      expect(step).toBeGreaterThan(prev);
    }
  });

  it('tek arıza dünyayı hemen götürmez', () => {
    expect(minutesUntilLoyaltyZero(100, 1)! / 60).toBeGreaterThan(48);
  });

  it('sıfırın altına inmez', () => {
    expect(advanceLoyalty(1, 8, 100_000)).toBe(0);
  });

  it('geriye giden ya da sıfır aralık hiçbir şeyi değiştirmez', () => {
    expect(advanceLoyalty(42, 8, 0)).toBe(42);
    expect(advanceLoyalty(42, 8, -600)).toBe(42);
  });

  it('kalan süre arızasızken yoktur, arızalıyken okunabilir', () => {
    expect(minutesUntilLoyaltyZero(50, 0)).toBeNull();
    expect(minutesUntilLoyaltyZero(0, 4)).toBe(0);
    expect(minutesUntilLoyaltyZero(100, 8)).toBeCloseTo(FAULT.loyaltyCollapseHours * 60, 6);
  });

  /**
   * HEDEF: ihmal edilen bir koloni ~48 saatte kopar, ~34'te değil. Sahip talimatı.
   * Monte Carlo, `nextFaultGapMinutes`in kendi dağılımıyla — iki sabit birbirine
   * bağlı olduğu için ayrı ayrı doğrulanamaz.
   */
  it('hiç ilgilenilmeyen koloni ortalama 46-52 saatte kopar', () => {
    const rng = mulberry32(7);
    const runs: number[] = [];
    for (let run = 0; run < 4000; run++) {
      const at: number[] = [];
      let t = 0;
      for (const _ of FAULT_KINDS) { t += nextFaultGapMinutes(rng); at.push(t); }
      let loyalty: number = FAULT.loyaltyMax;
      let now = 0;
      let k = 0;
      for (let i = 0; i <= FAULT_KINDS.length; i++) {
        const next = i < FAULT_KINDS.length ? at[i]! : Number.POSITIVE_INFINITY;
        const left = minutesUntilLoyaltyZero(loyalty, k);
        if (left !== null && now + left <= next) { runs.push(now + left); break; }
        loyalty = advanceLoyalty(loyalty, k, next - now);
        now = next;
        k++;
      }
    }
    const mean = runs.reduce((s, v) => s + v, 0) / runs.length / 60;
    expect(runs).toHaveLength(4000);
    expect(mean).toBeGreaterThan(46);
    expect(mean).toBeLessThan(52);
  });
});

describe('onarım fiyatı', () => {
  it('üç kademe, sekiz arıza, hepsi bir kademede', () => {
    for (const kind of FAULT_KINDS) expect([1, 2, 3]).toContain(faultTier(kind));
  });

  it('sahibin verdiği çapa noktalarını tutturur', () => {
    const at = (core: number) => [1, 2, 3].map((tier) =>
      repairCost(FAULT_KINDS.find((k) => faultTier(k) === tier)!, core).alloy);
    expect(at(6)).toEqual([25, 50, 100]);
    expect(at(12)).toEqual([300, 500, 800]);
    expect(at(18)).toEqual([1000, 1500, 2000]);
  });

  it('kademe bir yalnızca alaşım, ikisi ve üçü alaşım+kristal ister', () => {
    for (const kind of FAULT_KINDS) {
      const cost = repairCost(kind, 12);
      expect(cost.deuterium).toBe(0);
      expect(cost.crystal > 0).toBe(faultTier(kind) > 1);
    }
  });

  it('her seviyede artar ve otuzda durur', () => {
    for (const kind of FAULT_KINDS) {
      for (let core: number = FAULT.minCoreLevel; core < 30; core++) {
        expect(repairCost(kind, core + 1).alloy).toBeGreaterThan(repairCost(kind, core).alloy);
      }
      expect(repairCost(kind, 31)).toEqual(repairCost(kind, 30));
      expect(repairCost(kind, 99)).toEqual(repairCost(kind, 30));
    }
  });

  it('kapının altında sorulursa kapının fiyatını verir', () => {
    for (const kind of FAULT_KINDS) {
      expect(repairCost(kind, 0)).toEqual(repairCost(kind, FAULT.minCoreLevel));
    }
  });

  it('onarım her zaman beş ile on beş dakika arasındadır', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 20_000; i++) {
      const minutes = repairMinutes(rng);
      expect(minutes).toBeGreaterThanOrEqual(FAULT.repairMinMinutes);
      expect(minutes).toBeLessThanOrEqual(FAULT.repairMaxMinutes);
    }
  });
});

describe('kasada sızıntı', () => {
  const rates = (core: number) => ({
    alloy: alloyRate(core),
    crystal: crystalRate(core),
    deuterium: deuteriumRate(Math.max(0, core - 4)),
  });

  it('hız hiçbir zaman üretimin iki katını geçmez', () => {
    for (let core: number = FAULT.minCoreLevel; core <= 40; core++) {
      const r = rates(core);
      const leak = leakRates(r, core);
      expect(leak.alloy).toBeLessThanOrEqual(r.alloy * FAULT.leakIncomeCap + 1e-6);
      expect(leak.crystal).toBeLessThanOrEqual(r.crystal * FAULT.leakIncomeCap + 1e-6);
      expect(leak.deuterium).toBeLessThanOrEqual(r.deuterium * FAULT.leakIncomeCap + 1e-6);
    }
  });

  it('tavan bağlamadığı seviyede tam depo 48 saatte akar', () => {
    const core = 6;
    const r = rates(core);
    expect(leakRates(r, core).alloy).toBeCloseTo(storageCap(r.alloy, core) / FAULT.leakDrainHours, 6);
  });

  it('döteryum sütunu kendi üretimine göre ölçülür, kristalin deposuna göre değil', () => {
    const core = 12;
    const r = rates(core);
    const store = deuteriumStorageCap(r.deuterium, r.crystal, core);
    expect(store / FAULT.leakDrainHours).toBeGreaterThan(r.deuterium * FAULT.leakIncomeCap);
    expect(leakRates(r, core).deuterium).toBeCloseTo(r.deuterium * FAULT.leakIncomeCap, 6);
  });

  it('toplam bütçe sütun başına bir depo doluşudur', () => {
    const core = 9;
    const r = rates(core);
    expect(leakBudget(r, core).alloy).toBeCloseTo(storageCap(r.alloy, core) * FAULT.leakTotalStores, 6);
  });

  /* ── tek sütunun akışı ─────────────────────────────────────────────── */

  const column = (over: Partial<Parameters<typeof leakColumn>[0]> = {}) => leakColumn({
    store: 1000, buffer: 500, cap: 800, produce: 100, leak: 200, hours: 1, budget: 1e12, ...over,
  });

  it('önce havuzdan akar', () => {
    const out = column({ store: 1000, buffer: 500, produce: 0, leak: 200, hours: 1 });
    expect(out.buffer).toBe(300);
    expect(out.store).toBe(1000);
    expect(out.leaked).toBe(200);
  });

  it('havuz bitince depodan devam eder', () => {
    const out = column({ store: 1000, buffer: 100, produce: 0, leak: 200, hours: 1 });
    expect(out.buffer).toBe(0);
    expect(out.store).toBe(900);
    expect(out.leaked).toBe(200);
  });

  it('malzeme yokken üretilen doldukça akar — havuz idle kalmaz', () => {
    const out = column({ store: 0, buffer: 0, cap: 800, produce: 100, leak: 200, hours: 10 });
    expect(out.buffer).toBe(0);
    expect(out.store).toBe(0);
    expect(out.leaked).toBe(1000);
  });

  it('boş bir gezegen negatife düşmez', () => {
    const out = column({ store: 0, buffer: 0, produce: 0, leak: 200, hours: 100 });
    expect(out.store).toBe(0);
    expect(out.buffer).toBe(0);
    expect(out.leaked).toBe(0);
  });

  /**
   * SIZINTI ÜRETİMDEN YAVAŞSA DEPO HİÇ AZALMAZ, ve bu doğru okuma: havuz dolu
   * kalır, kaybedilen yalnızca akan üretimdir. Blok hesabı burada sürekli modelden
   * ayrılıyordu — uzun bir yokluğu depoyu da boşaltmış gibi okuyordu.
   */
  it('sızıntı üretimden yavaşsa depoya dokunmaz', () => {
    const out = column({ store: 5000, buffer: 0, cap: 800, produce: 200, leak: 100, hours: 100 });
    expect(out.store).toBe(5000);
    expect(out.buffer).toBe(800);
    expect(out.leaked).toBe(100 * 100);
  });

  it('bütçe dolunca akış durur ve üretim normale döner', () => {
    const out = column({ store: 10_000, buffer: 0, cap: 800, produce: 100, leak: 200, hours: 100, budget: 1000 });
    expect(out.leaked).toBe(1000);
    // 1000 birim 5 saatte akar; kalan 95 saat sıradan üretim.
    expect(out.buffer).toBe(800);
    expect(out.store).toBe(10_000 - (200 - 100) * 5);
  });

  it('sıfır aralık hiçbir şeyi değiştirmez', () => {
    const out = column({ hours: 0 });
    expect(out).toEqual({ store: 1000, buffer: 500, leaked: 0 });
  });
});

describe('sızıntının kenarları', () => {
  /** `leaking === dry` yığınları TAM olarak siler, ve tam olarak float'ın duramadığı yer. */
  it('yığınlar tam bittiğinde bakiye negatife düşmez', () => {
    for (let i = 1; i <= 500; i++) {
      const produce = i * 0.37;
      const leak = produce * 3;
      const out = leakColumn({
        store: i * 13.7, buffer: i * 4.1, cap: 1e9, produce, leak,
        hours: (i * 13.7 + i * 4.1) / (leak - produce), budget: 1e15,
      });
      expect(out.store).toBeGreaterThanOrEqual(0);
      expect(out.buffer).toBeGreaterThanOrEqual(0);
      expect(out.leaked).toBeGreaterThanOrEqual(0);
    }
  });

  it('sızıntı üretime tam eşitse hiçbir pile azalmaz', () => {
    const out = leakColumn({
      store: 5000, buffer: 100, cap: 900, produce: 200, leak: 200, hours: 50, budget: 1e9,
    });
    expect(out.store).toBe(5000);
    expect(out.buffer).toBe(100);
    expect(out.leaked).toBe(200 * 50);
  });

  it('bütçe sıfırsa arıza dururken hiçbir şey akmaz', () => {
    const out = leakColumn({
      store: 5000, buffer: 0, cap: 900, produce: 100, leak: 400, hours: 10, budget: 0,
    });
    expect(out.leaked).toBe(0);
    expect(out.store).toBe(5000);
    expect(out.buffer).toBe(900);
  });
});

describe('sadakatin duraklari', () => {
  it('iniş sırası hep aşağı doğru ve sıfırla biter', () => {
    expect(nextLoyaltyMilestone(100, 8)).toBe(FAULT.loyaltyWarnAt[0]);
    expect(nextLoyaltyMilestone(FAULT.loyaltyWarnAt[0], 8)).toBe(FAULT.loyaltyWarnAt[1]);
    expect(nextLoyaltyMilestone(FAULT.loyaltyWarnAt[2], 8)).toBe(0);
    expect(nextLoyaltyMilestone(5, 8)).toBe(0);
  });

  it('yükselen ya da bitmiş bir dünyanın durağı yoktur', () => {
    expect(nextLoyaltyMilestone(100, 0)).toBeNull();
    expect(nextLoyaltyMilestone(0, 8)).toBeNull();
  });

  it('bir durağa varış süresi düşüş hızıyla tutarlı', () => {
    // 100'den 50'ye, tam hızda: tam çöküşün yarısı.
    expect(minutesUntilLoyalty(100, 8, 50)).toBeCloseTo(FAULT.loyaltyCollapseHours * 60 / 2, 6);
    expect(minutesUntilLoyalty(50, 8, 0)).toBeCloseTo(FAULT.loyaltyCollapseHours * 60 / 2, 6);
  });

  it('çoktan geçilmiş bir durak sıfır dakikadır, gelecekte değil', () => {
    expect(minutesUntilLoyalty(10, 8, 25)).toBe(0);
  });

  it('düşmeyen bir dünya hiçbir durağa varmaz', () => {
    expect(minutesUntilLoyalty(80, 0, 50)).toBeNull();
  });

  /**
   * DURAKLAR YAKINLAŞARAK GELİR, ve bu küpün istenen sonucu: uyarılar tam da yapacak
   * vakit azalırken sıklaşıyor.
   */
  it('uyarılar birbirine yaklaşarak gelir', () => {
    const stops = [100, ...FAULT.loyaltyWarnAt];
    const gaps = stops.slice(0, -1).map((from, i) =>
      minutesUntilLoyalty(from, 8, stops[i + 1]!)!);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThan(gaps[i - 1]!);
  });
});

/**
 * AĞIR BİR SALDIRI KOLONİYİ BOZAR. Sahip talimatı:
 * *"kalkan verilmesine sebep olmuş kadar bir saldırı yemişse: eklenebiliyorsa direk en az
 * 2 tane arıza rastgele eklensin. eklenemiyorsa 1 eklensin, tüm arızalar zaten varsa
 * bişey olmasın."*
 *
 * Kural "iki, sığdığı kadar": iki uygun arıza varsa iki, bir varsa bir, hiç yoksa hiçbiri.
 */
describe('bir seferde birden fazla arıza', () => {
  it('saldırının getirdiği sayı tek yerden gelir', () => {
    expect(FAULT.attackFaults).toBe(2);
  });

  it('yer varsa tam istenen kadar, birbirinden farklı çeker', () => {
    for (let seed = 0; seed < 500; seed++) {
      const drawn = drawFaults(colony(12, 4), [], 2, mulberry32(seed));
      expect(drawn).toHaveLength(2);
      expect(new Set(drawn).size).toBe(2);
    }
  });

  it('tek bir uygun arıza kaldıysa bir tane çeker', () => {
    const active = FAULT_KINDS.filter((kind) => kind !== 'VAULT_LEAK');
    expect(drawFaults(colony(12, 4), active, 2, mulberry32(1))).toEqual(['VAULT_LEAK']);
  });

  it('hepsi zaten bozuksa hiçbir şey çekmez', () => {
    expect(drawFaults(colony(12, 4), FAULT_KINDS, 2, mulberry32(1))).toEqual([]);
  });

  it('rafinerisi olmayan dünyada döteryum arızası yedinci değil, hiç çekilmez', () => {
    const active = FAULT_KINDS.filter((kind) => kind !== 'VAULT_LEAK' && kind !== 'PLANT_OUTAGE');
    expect(drawFaults(colony(12, 0), active, 2, mulberry32(1))).toEqual(['VAULT_LEAK']);
  });

  it('aktif bir arızayı asla tekrar çekmez', () => {
    const active: FaultKind[] = ['CORE_OUTAGE', 'SHIPYARD_REVOLT', 'TELESCOPE_FAULT'];
    for (let seed = 0; seed < 500; seed++) {
      for (const kind of drawFaults(colony(12, 4), active, 2, mulberry32(seed))) {
        expect(active).not.toContain(kind);
      }
    }
  });

  it('capital ve kapının altı hiçbir şey çekmez', () => {
    expect(drawFaults({ kind: 'CAPITAL', coreLevel: 30, plantLevel: 9 }, [], 2, mulberry32(1)))
      .toEqual([]);
    expect(drawFaults(colony(FAULT.minCoreLevel - 1), [], 2, mulberry32(1))).toEqual([]);
  });

  it('sıfır ya da negatif istek hiçbir şey çekmez', () => {
    expect(drawFaults(colony(12, 4), [], 0, mulberry32(1))).toEqual([]);
    expect(drawFaults(colony(12, 4), [], -3, mulberry32(1))).toEqual([]);
  });

  /** Aynı saldırı aynı arızaları verir: rapor yeniden türetilebilir olmalı. */
  it('aynı tohum aynı arızaları verir', () => {
    expect(drawFaults(colony(12, 4), [], 2, mulberry32(77)))
      .toEqual(drawFaults(colony(12, 4), [], 2, mulberry32(77)));
  });

  it('uzun vadede her uygun arıza bir saldırıyla gelebilir', () => {
    const seen = new Set<FaultKind>();
    for (let seed = 0; seed < 2000; seed++) {
      for (const kind of drawFaults(colony(12, 4), [], 2, mulberry32(seed))) seen.add(kind);
    }
    expect(seen.size).toBe(FAULT_KINDS.length);
  });
});
