import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  activeAsteroids, FAULT_KINDS, sensorReach, type AsteroidSpec, type FaultKind,
} from '@astera/rules';
import { battleReports, planetFaults, planets, sensorEpochs, units } from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { buildUnits, raiseInstrument, upgradeBuilding } from '../src/services/build.js';
import { breakFaults } from '../src/services/faults.js';
import { startFaultRepair } from '../src/services/faultRepair.js';
import { launchAttack } from '../src/services/mission.js';
import { launchMining } from '../src/services/mining.js';
import { launchTransfer } from '../src/services/movement.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import { sensorPosts } from '../src/services/traffic.js';
import { planetView } from '../src/services/planetView.js';
import {
  fuelUp, giveInstrument, giveResearch, giveSatellite, giveUnits, grant, placeAt, seedWorld, setLevel,
  settledAt, testDb,
  type Fixture,
} from './helpers.js';

/** A rock that is up now and still up when the craft would get there. */
function usableRock(f: Fixture): AsteroidSpec {
  const seasonStart = new Date('2026-01-01T00:00:00.000Z');
  for (let attempt = 0; attempt < 400; attempt++) {
    const minutes = (f.clock.now().getTime() - seasonStart.getTime()) / 60_000;
    const rock = activeAsteroids(f.asteroids, minutes).find((a) => a.expiresAt - minutes > 45);
    if (rock) return rock;
    f.clock.advance(30);
  }
  throw new Error('no usable asteroid in the disc — fixture assumption broke');
}

/**
 * SEKİZ ETKİ. `docs/colony-faults-plan.md` Faz 3.
 *
 * Bu suite'in yarısı arıza VARKEN durduğunu, yarısı arıza YOKKEN durmadığını kanıtlıyor,
 * ve ikincisi daha önemli: `advanceEconomy` oyundaki her transaction'ın tepesinde,
 * `assertFreeBay` on üç kalkış lane'inde ve `sensorPosts` fog'un tamamında çalışıyor.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const breakIt = (f: Fixture, planetId: string, kind: FaultKind) =>
  f.db.insert(planetFaults).values({ planetId, kind, startedAt: f.clock.now() });

describe('üretim arızaları gerçek dünyada', () => {
  let f: Fixture;
  let colony: string;
  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 8);
    await setLevel(f.db, colony, 'REFINERY', 8);
    await setLevel(f.db, colony, 'EXTRACTOR', 8);
    // The Vault sizes the store, and the store sizes the leak. A world left at Vault 0
    // has almost nothing to bleed and the arithmetic below would be about nothing.
    await setLevel(f.db, colony, 'VAULT', 8);
  });

  const worksAfterAnHour = async (): Promise<{ alloy: number; crystal: number }> => {
    f.clock.advance(60);
    const view = await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    return { alloy: view.planet.bufferAlloy, crystal: view.planet.bufferCrystal };
  };

  it('arıza yokken işler çalışır', async () => {
    const works = await worksAfterAnHour();
    expect(works.alloy).toBeGreaterThan(0);
    expect(works.crystal).toBeGreaterThan(0);
  });

  it('rafineri arızası yalnızca alaşımı durdurur', async () => {
    await breakIt(f, colony, 'REFINERY_OUTAGE');
    const works = await worksAfterAnHour();
    expect(works.alloy).toBe(0);
    expect(works.crystal).toBeGreaterThan(0);
  });

  it('kristal arızası yalnızca kristali durdurur', async () => {
    await breakIt(f, colony, 'EXTRACTOR_OUTAGE');
    const works = await worksAfterAnHour();
    expect(works.alloy).toBeGreaterThan(0);
    expect(works.crystal).toBe(0);
  });

  it('gezegen payloadı duran üç tesisi de 0/saat diye yayınlar', async () => {
    await setLevel(f.db, colony, 'DEUTERIUM_PLANT', 8);
    await breakIt(f, colony, 'REFINERY_OUTAGE');
    await breakIt(f, colony, 'EXTRACTOR_OUTAGE');
    await breakIt(f, colony, 'PLANT_OUTAGE');

    const view = await f.db.transaction((tx) => planetView(tx, colony, f.clock));

    expect(view.planet.alloyPerHour).toBe(0);
    expect(view.planet.crystalPerHour).toBe(0);
    expect(view.planet.deuteriumPerHour).toBe(0);
    // Arıza detayının kaybı 0/saat diye göstermemesi için donanım kapasitesi de taşınır.
    expect(view.planet.nominalAlloyPerHour).toBeGreaterThan(0);
    expect(view.planet.nominalCrystalPerHour).toBeGreaterThan(0);
    expect(view.planet.nominalDeuteriumPerHour).toBeGreaterThan(0);
    // Arıza kapasiteyi yok etmez; onarım sonrası aynı havuz devam eder.
    expect(view.planet.bufferAlloyCap).toBeGreaterThan(0);
    expect(view.planet.bufferCrystalCap).toBeGreaterThan(0);
    expect(view.planet.bufferDeuteriumCap).toBeGreaterThan(0);
  });

  /**
   * SIZINTI ÜRETİMİ GEÇTİĞİ ANDAN İTİBAREN DEPOYA İNER, ve tam çekirdek kapısında
   * geçmez: core 6'da sızıntı 885/sa, üretim 899/sa. Havuz önce aktığı için üretim
   * depoyu perdeliyor ve kasadan hiçbir şey çıkmıyor — sahibin *"önce havuzdan akar"*
   * kuralının doğrudan sonucu, bir kaza değil. Core 7'den itibaren sızıntı öne geçiyor.
   */
  it('çekirdek kapısında sızıntı depoya inmez — havuz onu perdeler', async () => {
    await setLevel(f.db, colony, 'CORE', 6);
    await setLevel(f.db, colony, 'REFINERY', 6);
    await setLevel(f.db, colony, 'VAULT', 6);
    await grant(f.db, colony, 50_000, 20_000);
    await breakIt(f, colony, 'VAULT_LEAK');
    f.clock.advance(600);
    await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    const [row] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(row!.alloy).toBe(50_000);
    // Yine de üretim akıyor: kaybedilen, hiç varamayan cevher.
    expect(row!.pendingLeakAlloy).toBeGreaterThan(0);
  });

  it('kasadaki sızıntı depoyu boşaltır ve orbite koyar', async () => {
    await grant(f.db, colony, 50_000, 20_000);
    await breakIt(f, colony, 'VAULT_LEAK');
    f.clock.advance(120);
    await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    const [row] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(row!.alloy).toBeLessThan(50_000);
    expect(row!.pendingLeakAlloy).toBeGreaterThan(0);
  });

  it('iki lazy tick arasında pending sızıntıyı üst üste biriktirir', async () => {
    await grant(f.db, colony, 50_000, 20_000);
    await breakIt(f, colony, 'VAULT_LEAK');
    f.clock.advance(10);
    await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    const [first] = await f.db.select().from(planets).where(eq(planets.id, colony));

    f.clock.advance(10);
    await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    const [second] = await f.db.select().from(planets).where(eq(planets.id, colony));

    expect(first!.pendingLeakAlloy).toBeGreaterThan(0);
    expect(second!.pendingLeakAlloy).toBeGreaterThan(first!.pendingLeakAlloy * 1.5);
  });

  it('sızıntı yokken hiçbir şey orbite sızmaz', async () => {
    await grant(f.db, colony, 50_000, 20_000);
    f.clock.advance(120);
    await f.db.transaction((tx) => planetView(tx, colony, f.clock));
    const [row] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(row!.alloy).toBe(50_000);
    expect(row!.pendingLeakAlloy).toBe(0);
  });
});

describe('komuta merkezinde kesinti', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, theirs, { x: 400 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await fuelUp(f.db, id);
      await grant(f.db, id, 80_000, 20_000);
    }
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, mine));
    f.clock.advance(250);
  });

  const raid = async (): Promise<typeof battleReports.$inferSelect> => {
    await giveUnits(f.db, theirs, { DART: 40 });
    const incoming = await launchAttack(f.db, theirs, mine, { DART: 40 }, f.clock);
    f.clock.set(settledAt(incoming.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, incoming.missionId));
    return report!;
  };

  const groundAt = async (planetId: string): Promise<number> => {
    const rows = await f.db.select().from(units).where(eq(units.planetId, planetId));
    return rows.filter((r) => r.hull === 'THORN' && r.location === 'home')
      .reduce((sum, r) => sum + r.count, 0);
  };

  it('arıza yokken yer savunması ateş eder', async () => {
    await giveUnits(f.db, mine, { THORN: 20 });
    const report = await raid();
    expect(report.defenderFleet).toMatchObject({ THORN: 20 });
    expect(Object.keys(report.attackerLosses).length).toBeGreaterThan(0);
  });

  it('arıza varken yer savunması savaşa girmez', async () => {
    await giveUnits(f.db, mine, { THORN: 20 });
    await breakIt(f, mine, 'CORE_OUTAGE');
    const report = await raid();
    expect(report.defenderFleet).not.toHaveProperty('THORN');
  });

  /** EN KOLAY KAÇIRILACAK HATA: girmeyen birim `?? 0` ile yok sayılıp silinebilir. */
  it('savaşa girmeyen yer savunması imha da edilmez', async () => {
    await giveUnits(f.db, mine, { THORN: 20 });
    await breakIt(f, mine, 'CORE_OUTAGE');
    await raid();
    expect(await groundAt(mine)).toBe(20);
  });

  it('arıza varken kalkan söner', async () => {
    await setLevel(f.db, mine, 'CORE', 8);
    await f.db.update(planets).set({ shield: 5_000 }).where(eq(planets.id, mine));
    await giveUnits(f.db, mine, { THORN: 20 });
    await breakIt(f, mine, 'CORE_OUTAGE');
    const report = await raid();
    const absorbed = report.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0);
    expect(absorbed).toBe(0);
  });

  it('evdeki gemiler yine savaşır — susan yalnızca kalkan ve emplasmanlar', async () => {
    await giveUnits(f.db, mine, { DART: 30 });
    await breakIt(f, mine, 'CORE_OUTAGE');
    const report = await raid();
    expect(report.defenderFleet).toMatchObject({ DART: 30 });
  });
});

describe('teleskop arızası', () => {
  let f: Fixture;
  let colony: string;
  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await setLevel(f.db, colony, 'CORE', 10);
    /*
      THE UPLINK IS THE GATE, NOT AN EXTRA. D25: `instrumentLevels` reports a Telescope
      with no active Uplink as level 0, so without this the world reads the naked-eye
      floor before the fault and the test proves nothing.
    */
    await giveSatellite(f.db, colony, 'UPLINK');
  });

  const reachOf = async (): Promise<number> =>
    (await sensorPosts(f.db, [colony]))[0]!.identify;

  it('arıza varken görüş çıplak göze düşer', async () => {
    await giveInstrument(f.db, colony, 'TELESCOPE', 4);
    const withScope = await reachOf();
    expect(withScope).toBeGreaterThan(sensorReach(0));

    await breakIt(f, colony, 'TELESCOPE_FAULT');
    expect(await reachOf()).toBe(sensorReach(0));
  });

  it('başka bir arıza görüşe dokunmaz', async () => {
    await giveInstrument(f.db, colony, 'TELESCOPE', 4);
    const before = await reachOf();
    await breakIt(f, colony, 'SHIPYARD_REVOLT');
    expect(await reachOf()).toBe(before);
  });

  it('kalıcı sensör geçmişini arıza başında kapatır, onarımda yeniden açar', async () => {
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'DEUTERIUM_PLANT', 1);
    await giveInstrument(f.db, colony, 'TELESCOPE', 4);
    await grant(f.db, colony, 20_000, 10_000);
    await f.db.transaction((tx) => refreshSensorEpoch(tx, colony, f.clock.now()));
    const before = await f.db.select().from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, colony));
    expect(before.find((row) => row.endsAt === null)!.reach).toBeGreaterThan(sensorReach(0));

    for (const kind of FAULT_KINDS.filter((kind) => kind !== 'TELESCOPE_FAULT')) {
      await breakIt(f, colony, kind);
    }
    f.clock.advance(1);
    const brokeAt = f.clock.now();
    const written = await f.db.transaction((tx) => breakFaults(tx, {
      seasonId: f.seasonId,
      planetId: colony,
      now: brokeAt,
      count: 1,
      seed: 'only-telescope-remains',
    }));
    expect(written).toEqual(['TELESCOPE_FAULT']);

    const broken = await f.db.select().from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, colony));
    expect(broken.find((row) => row.endsAt === null)!.reach).toBe(sensorReach(0));
    expect(broken.some((row) => row.endsAt?.getTime() === brokeAt.getTime())).toBe(true);

    const [fault] = await f.db.select().from(planetFaults)
      .where(eq(planetFaults.kind, 'TELESCOPE_FAULT'));
    const { readyAt } = await startFaultRepair(f.db, colony, fault!.id, f.clock, f.playerIds[0]!);
    f.clock.set(new Date(readyAt.getTime() + 1000));
    await new EventWorker(
      f.db,
      f.clock,
      { pollMs: 1000, batch: 100, staleMinutes: 5 },
      silent,
    ).tick();

    const repaired = await f.db.select().from(sensorEpochs)
      .where(eq(sensorEpochs.planetId, colony));
    expect(repaired.find((row) => row.endsAt === null)!.reach).toBeGreaterThan(sensorReach(0));
  });
});

describe('arızalı item sunucu kapısı', () => {
  let f: Fixture;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
    await setLevel(f.db, colony, 'SHIPYARD', 1);
    await giveSatellite(f.db, colony, 'UPLINK');
    await giveResearch(f.db, colony, 'DEUTERIUM_SYNTHESIS', 1);
    await grant(f.db, colony, 500_000, 200_000);
  });

  it.each([
    ['REFINERY_OUTAGE', 'REFINERY'],
    ['EXTRACTOR_OUTAGE', 'EXTRACTOR'],
    ['PLANT_OUTAGE', 'DEUTERIUM_PLANT'],
    ['VAULT_LEAK', 'VAULT'],
    ['CORE_OUTAGE', 'CORE'],
    ['SHIPYARD_REVOLT', 'SHIPYARD'],
  ] as const)('%s varken %s yükseltilemez', async (fault, building) => {
    await breakIt(f, colony, fault);
    await expect(upgradeBuilding(f.db, colony, building, f.clock, f.playerIds[0]))
      .rejects.toMatchObject({ code: 'FAULT_ITEM_BROKEN' });
  });

  it('bozuk teleskop yükseltilemez', async () => {
    await breakIt(f, colony, 'TELESCOPE_FAULT');
    await expect(raiseInstrument(f.db, colony, 'TELESCOPE', f.clock, f.playerIds[0]))
      .rejects.toMatchObject({ code: 'FAULT_ITEM_BROKEN' });
  });

  it('bozuk Prospector yeniden üretilemez ama başka bir gemi üretilebilir', async () => {
    await breakIt(f, colony, 'PROSPECTOR_FAULT');
    await expect(buildUnits(f.db, colony, 'PROSPECTOR', 1, f.clock, f.playerIds[0]))
      .rejects.toMatchObject({ code: 'FAULT_ITEM_BROKEN' });
    await expect(buildUnits(f.db, colony, 'DART', 1, f.clock, f.playerIds[0]))
      .resolves.toMatchObject({ hull: 'DART' });
  });
});

describe('tersanede isyan', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, theirs, { x: 400 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
      await fuelUp(f.db, id);
      await grant(f.db, id, 200_000, 80_000);
    }
    await giveUnits(f.db, theirs, { DART: 20 });
    await giveUnits(f.db, mine, { DART: 20, COURIER: 5, PROSPECTOR: 2 });
    f.clock.advance(250);
  });

  it('arıza yokken her lane kalkar', async () => {
    await expect(launchAttack(f.db, mine, theirs, { DART: 5 }, f.clock)).resolves.toBeTruthy();
  });

  it('saldırı kalkamaz', async () => {
    await breakIt(f, mine, 'SHIPYARD_REVOLT');
    await expect(launchAttack(f.db, mine, theirs, { DART: 5 }, f.clock))
      .rejects.toMatchObject({ code: 'FAULT_SHIPYARD' });
  });

  it('transfer de kalkamaz — "hiçbir yere" hiçbir yer demek', async () => {
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, theirs));
    await breakIt(f, mine, 'SHIPYARD_REVOLT');
    await expect(launchTransfer(f.db, f.playerIds[0]!, mine, theirs, { COURIER: 1 },
      { alloy: 0, crystal: 0, deuterium: 0 }, f.clock))
      .rejects.toMatchObject({ code: 'FAULT_SHIPYARD' });
  });

  it('kazıcı da kalkamaz', async () => {
    await breakIt(f, mine, 'SHIPYARD_REVOLT');
    await expect(launchMining(f.db, mine, usableRock(f).index, 1, f.clock))
      .rejects.toThrow();
  });

  it('başka bir arıza kalkışı engellemez', async () => {
    await breakIt(f, mine, 'REFINERY_OUTAGE');
    await expect(launchAttack(f.db, mine, theirs, { DART: 5 }, f.clock)).resolves.toBeTruthy();
  });
});

describe('kazıcı merkezinde arıza', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, theirs, { x: 400 });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
      await fuelUp(f.db, id);
      await grant(f.db, id, 200_000, 80_000);
      await giveUnits(f.db, id, { DART: 20 });
    }
    await giveUnits(f.db, mine, { DART: 20, PROSPECTOR: 2 });
    f.clock.advance(250);
  });

  it('prospector kullanılamaz', async () => {
    await breakIt(f, mine, 'PROSPECTOR_FAULT');
    await expect(launchMining(f.db, mine, usableRock(f).index, 1, f.clock))
      .rejects.toMatchObject({ code: 'FAULT_PROSPECTOR' });
  });

  it('savaş filosu etkilenmez', async () => {
    await breakIt(f, mine, 'PROSPECTOR_FAULT');
    await expect(launchAttack(f.db, mine, theirs, { DART: 5 }, f.clock)).resolves.toBeTruthy();
  });
});

/**
 * SONDA, BOZUK BİR DÜNYAYI DOĞRU OKUR. Code review'da bulundu.
 *
 * `economyAt` hedefi rapor anına ilerletiyor ve arızaları bilmiyordu — altı saattir
 * karanlık bir rafinerisi olan dünyanın stoğuna var olmayan altı saatlik alaşım
 * ekliyordu. Bilgi katmanı, bu oyunda bir sayı hakkında yanılmaması gereken tek yer.
 */
describe('sonda arızalı bir dünyayı okurken', () => {
  let f: Fixture;
  let target: string;
  beforeEach(async () => {
    f = await seedWorld(2);
    target = f.planetIds[1]!;
    await setLevel(f.db, target, 'CORE', 10);
    await setLevel(f.db, target, 'REFINERY', 10);
    await setLevel(f.db, target, 'EXTRACTOR', 10);
  });

  const stockOf = async (): Promise<{ alloy: number; crystal: number }> => {
    const { standingAt } = await import('../src/services/intel.js');
    const [row] = await f.db.select().from(planets).where(eq(planets.id, target));
    return f.db.transaction(async (tx) => {
      const state = await standingAt(tx, row!, f.clock.now());
      return { alloy: state.bufferAlloy, crystal: state.bufferCrystal };
    });
  };

  it('duran bir rafineri raporda da durur', async () => {
    f.clock.advance(360);
    const running = await stockOf();
    expect(running.alloy).toBeGreaterThan(0);

    await breakIt(f, target, 'REFINERY_OUTAGE');
    const dark = await stockOf();
    expect(dark.alloy).toBe(0);
    expect(dark.crystal).toBe(running.crystal);
  });
});
