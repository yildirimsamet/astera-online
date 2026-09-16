import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { FAULT, FAULT_KINDS } from '@astera/rules';
import { planetFaults, planets } from '../src/db/schema.js';
import { loadLocked } from '../src/services/planet.js';
import { planetView } from '../src/services/planetView.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * KOLONİ ARIZALARI — depolama ve okuma. `docs/colony-faults-plan.md` Faz 2.
 *
 * Burada hiçbir arıza kendiliğinden doğmuyor ve hiçbir etkisi yok; elle yazılmış bir
 * satırın yazılabildiği, iki kez yazılamadığı, kilidin altında okunduğu ve istemciye
 * ulaştığı kanıtlanıyor. Etkiler Faz 3'ün suite'i.
 */

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const colonyOf = async (f: Fixture, planetId: string): Promise<void> => {
  await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, planetId));
};

const breakIt = async (
  f: Fixture,
  planetId: string,
  kind: (typeof FAULT_KINDS)[number],
  repair?: { slot: number; readyAt: Date },
): Promise<string> => {
  const [row] = await f.db.insert(planetFaults).values({
    planetId,
    kind,
    startedAt: f.clock.now(),
    ...(repair
      ? {
        repairSlot: repair.slot,
        repairStartedAt: f.clock.now(),
        repairReadyAt: repair.readyAt,
        repairCost: { alloy: 25, crystal: 0, deuterium: 0 },
      }
      : {}),
  }).returning({ id: planetFaults.id });
  return row!.id;
};

describe('arıza satırının kendisi', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2);
    await colonyOf(f, f.planetIds[0]!);
  });

  it('aynı arıza aynı dünyada iki kez duramaz', async () => {
    await breakIt(f, f.planetIds[0]!, 'REFINERY_OUTAGE');
    await expect(breakIt(f, f.planetIds[0]!, 'REFINERY_OUTAGE')).rejects.toThrow();
  });

  it('aynı arıza iki ayrı dünyada durabilir', async () => {
    await breakIt(f, f.planetIds[0]!, 'REFINERY_OUTAGE');
    await expect(breakIt(f, f.planetIds[1]!, 'REFINERY_OUTAGE')).resolves.toBeTruthy();
  });

  it('sekizi birden durabilir', async () => {
    for (const kind of FAULT_KINDS) await breakIt(f, f.planetIds[0]!, kind);
    const rows = await f.db.select().from(planetFaults)
      .where(eq(planetFaults.planetId, f.planetIds[0]!));
    expect(rows).toHaveLength(FAULT_KINDS.length);
  });

  /** Üç lane eşzamanlı çalışır — build kuyruğunun aksine. */
  it('üç onarım aynı anda koşar, dördüncü aynı yuvayı alamaz', async () => {
    const ready = new Date(f.clock.now().getTime() + 600_000);
    await breakIt(f, f.planetIds[0]!, 'REFINERY_OUTAGE', { slot: 0, readyAt: ready });
    await breakIt(f, f.planetIds[0]!, 'EXTRACTOR_OUTAGE', { slot: 1, readyAt: ready });
    await breakIt(f, f.planetIds[0]!, 'VAULT_LEAK', { slot: 2, readyAt: ready });
    await expect(
      breakIt(f, f.planetIds[0]!, 'CORE_OUTAGE', { slot: 1, readyAt: ready }),
    ).rejects.toThrow();
  });

  it('onarılmayan arızalar yuva tutmaz', async () => {
    await breakIt(f, f.planetIds[0]!, 'REFINERY_OUTAGE');
    await breakIt(f, f.planetIds[0]!, 'EXTRACTOR_OUTAGE');
    await breakIt(f, f.planetIds[0]!, 'CORE_OUTAGE');
    await breakIt(f, f.planetIds[0]!, 'VAULT_LEAK');
    const rows = await f.db.select().from(planetFaults)
      .where(and(eq(planetFaults.planetId, f.planetIds[0]!)));
    expect(rows.every((row) => row.repairSlot === null)).toBe(true);
  });

  it('yarım bir onarım yazılamaz — yuva, başlangıç ve bitiş birlikte gider', async () => {
    await expect(f.db.insert(planetFaults).values({
      planetId: f.planetIds[0]!,
      kind: 'REFINERY_OUTAGE',
      startedAt: f.clock.now(),
      repairSlot: 0,
    })).rejects.toThrow();
  });

  it('yuva numarası üçe kadardır', async () => {
    const ready = new Date(f.clock.now().getTime() + 600_000);
    await expect(
      breakIt(f, f.planetIds[0]!, 'REFINERY_OUTAGE', { slot: 3, readyAt: ready }),
    ).rejects.toThrow();
  });
});

describe('kilidin altında okumak', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2);
    await colonyOf(f, f.planetIds[0]!);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', FAULT.minCoreLevel);
  });

  it('arızasız bir dünya boş liste taşır', async () => {
    const locked = await f.db.transaction((tx) => loadLocked(tx, f.planetIds[0]!, f.clock));
    expect(locked.faults).toEqual([]);
    expect(locked.loyalty).toBe(FAULT.loyaltyMax);
  });

  it('duran arızalar kilidin altında görünür', async () => {
    await breakIt(f, f.planetIds[0]!, 'SHIPYARD_REVOLT');
    await breakIt(f, f.planetIds[0]!, 'TELESCOPE_FAULT');
    const locked = await f.db.transaction((tx) => loadLocked(tx, f.planetIds[0]!, f.clock));
    expect([...locked.faults].sort()).toEqual(['SHIPYARD_REVOLT', 'TELESCOPE_FAULT']);
  });
});

describe('istemciye ne gidiyor', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2);
    await colonyOf(f, f.planetIds[0]!);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 12);
  });

  it('her arıza kendi tabı, kendi item’ı ve kendi fiyatıyla yayınlanır', async () => {
    await breakIt(f, f.planetIds[0]!, 'VAULT_LEAK');
    const view = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    expect(view.faults).toHaveLength(1);
    const fault = view.faults[0]!;
    expect(fault.kind).toBe('VAULT_LEAK');
    expect(fault.repair).toBeNull();
    // Core 12, üçüncü kademe: plandaki çapa noktası.
    expect(fault.cost.alloy).toBe(800);
    expect(fault.cost.crystal).toBe(400);
  });

  it('koşan bir onarım bitiş anını taşır ve iptal edilemez olduğunu söyler', async () => {
    const ready = new Date(f.clock.now().getTime() + 9 * 60_000);
    await breakIt(f, f.planetIds[0]!, 'CORE_OUTAGE', { slot: 2, readyAt: ready });
    const view = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    expect(view.faults[0]!.repair).toEqual({ slot: 2, readyAt: ready });
  });

  it('sadakat ve kalan süre kolonide yayınlanır', async () => {
    for (const kind of FAULT_KINDS) await breakIt(f, f.planetIds[0]!, kind);
    await f.db.update(planets).set({ loyalty: 50 }).where(eq(planets.id, f.planetIds[0]!));
    const view = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    expect(view.loyalty!.value).toBeCloseTo(50, 3);
    // Sekiz arıza → tam hızda düşüş; yarı sadakat yarım çöküş süresi demek.
    expect(view.loyalty!.minutesLeft).toBeCloseTo(FAULT.loyaltyCollapseHours * 60 / 2, 2);
  });

  it('ana gezegende sadakat yoktur — orada arıza da olmaz', async () => {
    const view = await f.db.transaction((tx) => planetView(tx, f.planetIds[1]!, f.clock));
    expect(view.loyalty).toBeNull();
    expect(view.faults).toEqual([]);
  });

  it('çekirdek kapısının altındaki koloni sadakat taşımaz', async () => {
    await setLevel(f.db, f.planetIds[0]!, 'CORE', FAULT.minCoreLevel - 1);
    const view = await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock));
    expect(view.loyalty).toBeNull();
  });
});
