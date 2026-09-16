import { describe, expect, it } from 'vitest';
import {
  FAULT,
  advanceEconomy,
  alloyRate,
  collectorCap,
  crystalRate,
  deuteriumRate,
  leakRates,
  storageCap,
  type FaultSet,
  type PlanetEconomyInput,
  type PlanetEconomyState,
} from '../src/index.js';

/**
 * ARIZALARIN EKONOMİYE DOKUNUŞU — `docs/colony-faults-plan.md` §2.1 ve §2.6.
 *
 * `advanceEconomy` oyundaki her transaction'ın tepesinde çalışıyor. Bu suite'in ilk
 * bloğu bu yüzden var: ARIZA YOKKEN ÇIKTININ BİT BİT AYNI KALDIĞINI kanıtlamak, arıza
 * varken durduğunu kanıtlamak kadar önemli.
 */

const world = (over: Partial<PlanetEconomyState> = {}): PlanetEconomyState => ({
  alloy: 10_000, crystal: 4_000, deuterium: 500,
  bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
  shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
  ...over,
});

const CORE = 12;
const base: PlanetEconomyInput = {
  refineryLevel: CORE, extractorLevel: CORE, plantLevel: CORE - 4,
  aegisLevel: 2, vaultLevel: CORE,
};
const rates = {
  alloy: alloyRate(base.refineryLevel),
  crystal: crystalRate(base.extractorLevel),
  deuterium: deuteriumRate(base.plantLevel),
};
const faulty = (faults: FaultSet, over: Partial<PlanetEconomyInput> = {}): PlanetEconomyInput =>
  ({ ...base, faults, ...over });

describe('arıza yokken hiçbir şey değişmez', () => {
  it('boş arıza listesi ile arızasız çağrı aynı sonucu verir', () => {
    const start = world({ bufferAlloy: 120, bufferCrystal: 40, shield: 10 });
    expect(advanceEconomy(start, faulty([]), 600)).toEqual(advanceEconomy(start, base, 600));
  });

  it('sızıntı alanları arıza yokken doğmaz', () => {
    const out = advanceEconomy(world(), base, 600);
    expect(out.pendingLeakAlloy ?? 0).toBe(0);
    expect(out.pendingLeakCrystal ?? 0).toBe(0);
    expect(out.pendingLeakDeuterium ?? 0).toBe(0);
    expect(out.alloy).toBe(10_000);
  });
});

describe('üretim arızaları', () => {
  const hour = 60;

  it('her biri yalnızca kendi sütununu durdurur', () => {
    const cases = [
      ['REFINERY_OUTAGE', 'bufferAlloy'],
      ['EXTRACTOR_OUTAGE', 'bufferCrystal'],
      ['PLANT_OUTAGE', 'bufferDeuterium'],
    ] as const;
    for (const [fault, stopped] of cases) {
      const out = advanceEconomy(world(), faulty([fault]), hour);
      const clean = advanceEconomy(world(), base, hour);
      expect(out[stopped]).toBe(0);
      for (const column of ['bufferAlloy', 'bufferCrystal', 'bufferDeuterium'] as const) {
        if (column !== stopped) expect(out[column]).toBe(clean[column]);
      }
    }
  });

  it('üçü birden hiçbir şey üretmez ama kalkan yine dolar', () => {
    const out = advanceEconomy(
      world(),
      faulty(['REFINERY_OUTAGE', 'EXTRACTOR_OUTAGE', 'PLANT_OUTAGE']),
      hour,
    );
    expect(out.bufferAlloy).toBe(0);
    expect(out.bufferCrystal).toBe(0);
    expect(out.bufferDeuterium).toBe(0);
    expect(out.shield).toBeGreaterThan(0);
  });

  it('ilgisiz bir arıza üretime dokunmaz', () => {
    const out = advanceEconomy(world(), faulty(['SHIPYARD_REVOLT', 'TELESCOPE_FAULT']), hour);
    expect(out).toEqual(advanceEconomy(world(), base, hour));
  });
});

describe('kasada sızıntı', () => {
  const leak = leakRates(rates, base.vaultLevel);

  it('bir saatlik sızıntı orbite çıkar ve depodan düşer', () => {
    const out = advanceEconomy(world(), faulty(['VAULT_LEAK']), 60);
    // Üretim havuza giriyor, sızıntı önce oradan alıyor: bu seviyede sızıntı üretimden
    // hızlı, yani havuz boş kalıyor ve fark depodan iniyor.
    expect(out.bufferAlloy).toBe(0);
    expect(out.alloy).toBeCloseTo(10_000 - (leak.alloy - rates.alloy), 6);
    expect(out.pendingLeakAlloy).toBeCloseTo(leak.alloy, 6);
  });

  it('havuzda duran önce gider', () => {
    const start = world({ bufferAlloy: collectorCap(rates.alloy) });
    const out = advanceEconomy(start, faulty(['VAULT_LEAK']), 6);
    expect(out.bufferAlloy).toBeLessThan(start.bufferAlloy);
    expect(out.alloy).toBe(10_000);
  });

  it('boş bir dünya negatife düşmez ve üretileni akıtır', () => {
    const start = world({ alloy: 0, crystal: 0, deuterium: 0 });
    const out = advanceEconomy(start, faulty(['VAULT_LEAK']), 600);
    expect(out.alloy).toBe(0);
    expect(out.bufferAlloy).toBe(0);
    expect(out.pendingLeakAlloy).toBeGreaterThan(0);
  });

  it('üretim arızasıyla birlikte: üretilmeyen sütun yine de sızar', () => {
    const out = advanceEconomy(world(), faulty(['VAULT_LEAK', 'REFINERY_OUTAGE']), 60);
    expect(out.bufferAlloy).toBe(0);
    expect(out.alloy).toBeCloseTo(10_000 - leak.alloy, 6);
    expect(out.pendingLeakAlloy).toBeCloseTo(leak.alloy, 6);
  });

  it('birikim üst üste toplanır — flush onu sıfırlayana kadar', () => {
    const once = advanceEconomy(world(), faulty(['VAULT_LEAK']), 60);
    const twice = advanceEconomy(once, faulty(['VAULT_LEAK']), 120);
    expect(twice.pendingLeakAlloy).toBeCloseTo((once.pendingLeakAlloy ?? 0) * 2, 4);
  });

  /** Sahibin tavanı: bir arıza en fazla bir depo dolusuna mal olur. */
  it('bütçe dolduysa artık akmaz ve üretim normale döner', () => {
    const spent = {
      alloy: storageCap(rates.alloy, base.vaultLevel) * FAULT.leakTotalStores,
      crystal: storageCap(rates.crystal, base.vaultLevel) * FAULT.leakTotalStores,
      deuterium: 1e12,
    };
    const out = advanceEconomy(world(), faulty(['VAULT_LEAK'], { leakedSoFar: spent }), 60);
    expect(out.pendingLeakAlloy ?? 0).toBe(0);
    expect(out.alloy).toBe(10_000);
    expect(out.bufferAlloy).toBeCloseTo(rates.alloy, 6);
  });

  /**
   * SIZINTI DA ÜRETKEN DAKİKALARI KULLANIR. `disruptedUntil` "yüzey çalışmıyor"
   * demek, ve çalışmayan bir tesisin kasası da akmıyor. Kalkan rejenerasyonu bu
   * kuralın tek istisnası ve öyle kalıyor — o ayrı bir sistem.
   */
  it('kesinti sırasında sızıntı da durur', () => {
    const start = world({ disruptedUntilMinutes: 60 });
    const out = advanceEconomy(start, faulty(['VAULT_LEAK']), 60);
    expect(out.pendingLeakAlloy ?? 0).toBe(0);
    expect(out.alloy).toBe(10_000);
    expect(out.shield).toBeGreaterThan(0);
  });

  it('sıfır aralık hiçbir şey akıtmaz', () => {
    const start = world({ lastTickMinutes: 100 });
    expect(advanceEconomy(start, faulty(['VAULT_LEAK']), 100)).toBe(start);
  });
});
