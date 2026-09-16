import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { FAULT, FAULT_KINDS, repairCost } from '@astera/rules';
import {
  buildings, debrisFields, notifications, planetFaults, planets, scheduledEvents,
} from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { armFaults, scheduleLeakFlush } from '../src/services/faults.js';
import { startFaultRepair } from '../src/services/faultRepair.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * ARIZANIN ÖMRÜ: gelir, durur, onarılır. `docs/colony-faults-plan.md` Faz 4.
 *
 * Bu suite'in ana derdi ETKİ değil, DAYANIKLILIK: bir event iki kez işlenirse ne olur,
 * dört onarım aynı anda istenirse ne olur, kaynak yetmezse ne düşülür. Worker bir kez
 * çöküp geri geldiğinde galaksinin durması bu projenin en pahalı saatiydi (D47).
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const pendingOf = (f: Fixture, kind: 'fault_spawn' | 'vault_leak_flush' | 'fault_repair_complete') =>
  f.db.select().from(scheduledEvents)
    .where(and(eq(scheduledEvents.kind, kind), eq(scheduledEvents.status, 'pending')));

const faultsOf = (f: Fixture, planetId: string) =>
  f.db.select().from(planetFaults).where(eq(planetFaults.planetId, planetId));

describe('arızalar gelmeye başlar', () => {
  let f: Fixture;
  let colony: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const arm = () => f.db.transaction((tx) => armFaults(tx, {
    seasonId: f.seasonId, planetId: colony, kind: 'COLONY', coreLevel: 12, now: f.clock.now(),
  }));

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
    await setLevel(f.db, colony, 'DEUTERIUM_PLANT', 6);
    await grant(f.db, colony, 500_000, 200_000);
  });

  it('kapıyı geçen koloni kendine bir sayaç kurar', async () => {
    await arm();
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(1);
  });

  it('iki kez kurmak ikinci sayacı doğurmaz', async () => {
    await arm();
    await arm();
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(1);
  });

  it('worker sayacı claim etmişken yeniden arm etmek ikinci sayacı doğurmaz', async () => {
    await arm();
    const [claimed] = await pendingOf(f, 'fault_spawn');
    await f.db.update(scheduledEvents).set({ status: 'processing' })
      .where(eq(scheduledEvents.id, claimed!.id));

    await arm();

    const active = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'fault_spawn'),
      inArray(scheduledEvents.status, ['pending', 'processing']),
    ));
    expect(active).toHaveLength(1);
  });

  it('ana gezegen sayaç kurmaz', async () => {
    await f.db.transaction((tx) => armFaults(tx, {
      seasonId: f.seasonId, planetId: f.planetIds[1]!, kind: 'CAPITAL', coreLevel: 30, now: f.clock.now(),
    }));
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(0);
  });

  it('kapının altında sayaç kurulmaz', async () => {
    await f.db.transaction((tx) => armFaults(tx, {
      seasonId: f.seasonId, planetId: colony, kind: 'COLONY',
      coreLevel: FAULT.minCoreLevel - 1, now: f.clock.now(),
    }));
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(0);
  });

  /** Sayaç ateşlenince bir arıza yazar ve KENDİNİ yeniden kurar — süpürme yok. */
  it('ateşlenen sayaç bir arıza bırakır ve yerine geçer', async () => {
    await arm();
    const [event] = await pendingOf(f, 'fault_spawn');
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();

    expect(await faultsOf(f, colony)).toHaveLength(1);
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(1);
  });

  it('arıza yazılmadan önce temiz geçen zamanı üretim olarak kapatır', async () => {
    await f.db.update(planets).set({
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, colony));
    await arm();
    const [event] = await pendingOf(f, 'fault_spawn');
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));

    await worker().tick();

    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.lastTickAt.getTime()).toBe(f.clock.now().getTime());
    expect(world!.bufferAlloy + world!.bufferCrystal).toBeGreaterThan(0);
  });

  it('bu arada tarafsızlaşmış dünyada yeni sayaç zinciri kurmaz', async () => {
    await arm();
    const [event] = await pendingOf(f, 'fault_spawn');
    await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null })
      .where(eq(planets.id, colony));
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));

    await worker().tick();

    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(0);
    expect(await faultsOf(f, colony)).toHaveLength(0);
  });

  it('arıza bildirimi hangi koloni, hangi tab, hangi item diye söyler', async () => {
    await arm();
    const [event] = await pendingOf(f, 'fault_spawn');
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();

    const [note] = await f.db.select().from(notifications)
      .where(eq(notifications.kind, 'colony_fault'));
    const [fault] = await faultsOf(f, colony);
    expect(note!.payload).toMatchObject({ planetId: colony, fault: fault!.kind });
    expect(note!.payload.group).toBeTruthy();
    expect(note!.payload.itemId).toBeTruthy();
  });

  /**
   * D47'NİN DERSİ: commit edip complete() edemeden ölen worker'ın satırı reaper
   * tarafından geri veriliyor. İkinci işleyiş İKİNCİ bir sayaç kurarsa koloni sezonun
   * kalanı boyunca iki kat hızlı bozulur ve bunu hiçbir şey fark etmez.
   */
  it('aynı event iki kez işlenirse ne ikinci arıza ne ikinci sayaç doğar', async () => {
    await arm();
    const [event] = await pendingOf(f, 'fault_spawn');
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();
    const after = await faultsOf(f, colony);

    await f.db.update(scheduledEvents).set({ status: 'pending' })
      .where(eq(scheduledEvents.id, event!.id));
    await worker().tick();

    expect(await faultsOf(f, colony)).toHaveLength(after.length);
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(1);
  });

  it('hepsi bozukken sayaç yine de yerinde kalır', async () => {
    for (const kind of FAULT_KINDS) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }
    await arm();
    const [event] = await pendingOf(f, 'fault_spawn');
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();

    expect(await faultsOf(f, colony)).toHaveLength(FAULT_KINDS.length);
    expect(await pendingOf(f, 'fault_spawn')).toHaveLength(1);
  });
});

describe('onarım', () => {
  let f: Fixture;
  let colony: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const breakIt = async (kind: (typeof FAULT_KINDS)[number]): Promise<string> => {
    const [row] = await f.db.insert(planetFaults)
      .values({ planetId: colony, kind, startedAt: f.clock.now() })
      .returning({ id: planetFaults.id });
    return row!.id;
  };

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
    await grant(f.db, colony, 500_000, 200_000);
  });

  it('onarım başlar, fiyatı düşer, biteceği an yazılır', async () => {
    const id = await breakIt('REFINERY_OUTAGE');
    const [before] = await f.db.select().from(planets).where(eq(planets.id, colony));
    const result = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);

    // `grant` RAISES the Core to whatever holds the purse it was asked for, so the
    // price has to be read off the world rather than off the level the test set.
    const [core] = await f.db.select().from(buildings)
      .where(and(eq(buildings.planetId, colony), eq(buildings.type, 'CORE')));
    const cost = repairCost('REFINERY_OUTAGE', core!.level);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(before!.alloy - after!.alloy).toBeCloseTo(cost.alloy, 3);
    expect(result.readyAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
  });

  /** Sekiz arızanın hepsi, ama üçer üçer: lane sayısı üç ve dördüncüsü reddedilir. */
  it('süre her zaman beş ile on beş dakika arasındadır', async () => {
    for (const kind of FAULT_KINDS) {
      const id = await breakIt(kind);
      const { readyAt } = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
      const minutes = (readyAt.getTime() - f.clock.now().getTime()) / 60_000;
      expect(minutes).toBeGreaterThanOrEqual(FAULT.repairMinMinutes);
      expect(minutes).toBeLessThanOrEqual(FAULT.repairMaxMinutes);
      f.clock.set(new Date(readyAt.getTime() + 1000));
      await worker().tick();
    }
  });

  it('üç lane dolunca dördüncü reddedilir ve hiçbir şey düşülmez', async () => {
    const ids = await Promise.all(
      (['REFINERY_OUTAGE', 'EXTRACTOR_OUTAGE', 'VAULT_LEAK', 'CORE_OUTAGE'] as const).map(breakIt),
    );
    for (const id of ids.slice(0, FAULT.repairSlots)) {
      await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    }
    const [before] = await f.db.select().from(planets).where(eq(planets.id, colony));
    await expect(startFaultRepair(f.db, colony, ids[3]!, f.clock, f.playerIds[0]!))
      .rejects.toMatchObject({ code: 'FAULT_REPAIR_SLOTS_FULL' });
    const [after] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(after!.alloy).toBe(before!.alloy);
  });

  it('kaynak yetmezse reddedilir ve hiçbir şey düşülmez', async () => {
    await f.db.update(planets).set({ alloy: 1, crystal: 1 }).where(eq(planets.id, colony));
    const id = await breakIt('CORE_OUTAGE');
    await expect(startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    const [after] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(after!.alloy).toBe(1);
  });

  it('koşan bir onarım ikinci kez başlatılamaz', async () => {
    const id = await breakIt('REFINERY_OUTAGE');
    await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    await expect(startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!))
      .rejects.toMatchObject({ code: 'FAULT_ALREADY_REPAIRING' });
  });

  it('başkasının dünyası onarılamaz', async () => {
    const id = await breakIt('REFINERY_OUTAGE');
    await expect(startFaultRepair(f.db, colony, id, f.clock, f.playerIds[1]!))
      .rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  });

  it('biten onarım arızayı siler', async () => {
    const id = await breakIt('REFINERY_OUTAGE');
    const { readyAt } = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(readyAt.getTime() + 1000));
    await worker().tick();
    expect(await faultsOf(f, colony)).toHaveLength(0);
  });

  it('geç çalışan worker arızayı yalnız readyAt anına kadar uygular', async () => {
    await setLevel(f.db, colony, 'REFINERY', 8);
    await f.db.update(planets).set({
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, colony));
    const id = await breakIt('REFINERY_OUTAGE');
    const { readyAt } = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(readyAt.getTime() + 60 * 60_000));

    await worker().tick();

    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.bufferAlloy).toBeGreaterThan(0);
    expect(world!.lastTickAt.getTime()).toBe(f.clock.now().getTime());
  });

  it('sadakat sıfıra vardığında geç kalan onarımla kopuş kaçıralamaz', async () => {
    const id = await breakIt('REFINERY_OUTAGE');
    await f.db.update(planets).set({ loyalty: 0, lastTickAt: f.clock.now() })
      .where(eq(planets.id, colony));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, colony));

    await expect(startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!))
      .rejects.toMatchObject({ code: 'COLONY_SECESSION_PENDING' });

    const [after] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(after!.alloy).toBe(before!.alloy);
    expect(after!.crystal).toBe(before!.crystal);
  });

  it('biten onarım iki kez işlenirse ikincisi hiçbir şey yapmaz', async () => {
    const id = await breakIt('REFINERY_OUTAGE');
    const { readyAt } = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(readyAt.getTime() + 1000));
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'fault_repair_complete'));
    await worker().tick();
    await f.db.update(scheduledEvents).set({ status: 'pending' }).where(eq(scheduledEvents.id, event!.id));
    await expect(worker().tick()).resolves.toBeDefined();
    expect(await faultsOf(f, colony)).toHaveLength(0);
  });
});

describe('sızıntı orbite çıkar', () => {
  let f: Fixture;
  let colony: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    for (const b of ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT'] as const) {
      await setLevel(f.db, colony, b, 12);
    }
    await grant(f.db, colony, 500_000, 200_000);
  });

  const leak = async (): Promise<string> => {
    const [row] = await f.db.insert(planetFaults)
      .values({ planetId: colony, kind: 'VAULT_LEAK', startedAt: f.clock.now() })
      .returning({ id: planetFaults.id });
    await f.db.transaction((tx) => scheduleLeakFlush(tx, {
      seasonId: f.seasonId, planetId: colony, now: f.clock.now(), cause: `test:${row!.id}`,
    }));
    return row!.id;
  };

  it('flush birikmişi herkese açık bir tarlaya çevirir', async () => {
    await leak();
    f.clock.advance(FAULT.leakFlushMinutes + 1);
    await worker().tick();

    const fields = await f.db.select().from(debrisFields).where(eq(debrisFields.planetId, colony));
    expect(fields).toHaveLength(1);
    expect(fields[0]!.alloy).toBeGreaterThan(0);
    // Hiçbir savaşın ürünü değil: bu tarlanın bir mission'ı yok.
    expect(fields[0]!.missionId).toBeNull();

    const [row] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(row!.pendingLeakAlloy).toBe(0);
  });

  it('flush kendini yeniden kurar', async () => {
    await leak();
    f.clock.advance(FAULT.leakFlushMinutes + 1);
    await worker().tick();
    expect(await pendingOf(f, 'vault_leak_flush')).toHaveLength(1);
  });

  it('akan miktar eşiğin altındaysa tarla yazılmaz ama birikim durmaz', async () => {
    await f.db.update(planets).set({ alloy: 0, crystal: 0, deuterium: 0 })
      .where(eq(planets.id, colony));
    for (const b of ['REFINERY', 'EXTRACTOR'] as const) await setLevel(f.db, colony, b, 1);
    await leak();
    f.clock.advance(1);
    await worker().tick();
    expect(await f.db.select().from(debrisFields)).toHaveLength(0);
  });

  /**
   * ONARIM DA BİR FLUSH'TIR. Ekibin geldiği ana kadar akmış olan geri dönmüyor: kasaya
   * iade etmek, flush'ın en son ne zaman ateşlendiğine göre değişen bir indirim olurdu.
   */
  it('arıza onarılınca flush durur ve son birikim orbite gider', async () => {
    const id = await leak();
    f.clock.advance(FAULT.leakFlushMinutes - 1);
    const before = await f.db.select().from(debrisFields);

    const { readyAt } = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(readyAt.getTime() + 1000));
    await worker().tick();

    expect(await pendingOf(f, 'vault_leak_flush')).toHaveLength(0);
    expect((await f.db.select().from(debrisFields)).length).toBeGreaterThan(before.length);
  });

  it('onarım eşik altındaki son birikimi de boşaltır ve pending bırakmaz', async () => {
    const id = await leak();
    for (const b of ['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT'] as const) {
      await setLevel(f.db, colony, b, 0);
    }
    await f.db.update(planets).set({
      pendingLeakAlloy: 1,
      pendingLeakCrystal: 0,
      pendingLeakDeuterium: 0,
      lastTickAt: f.clock.now(),
    }).where(eq(planets.id, colony));
    const { readyAt } = await startFaultRepair(f.db, colony, id, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(readyAt.getTime() + 1000));

    await worker().tick();

    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world).toMatchObject({
      pendingLeakAlloy: 0,
      pendingLeakCrystal: 0,
      pendingLeakDeuterium: 0,
    });
    const fields = await f.db.select().from(debrisFields)
      .where(eq(debrisFields.planetId, colony));
    expect(fields).toHaveLength(1);
    expect(fields[0]!.alloy).toBeCloseTo(1, 6);
  });
});
