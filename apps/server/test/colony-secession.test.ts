import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { FAULT, FAULT_KINDS, SERVERS } from '@astera/rules';
import {
  buildOrders, buildings, neutralPlanetState, notifications, planetFaults, planets,
  satellites, scheduledEvents, units,
} from '../src/db/schema.js';
import { EventWorker } from '../src/worker/loop.js';
import { colonyStanding } from '../src/services/ownership.js';
import {
  giveInstrument, giveSatellite, giveUnits, grant, seedWorld, setLevel, testDb, type Fixture,
} from './helpers.js';

/**
 * SADAKAT SIFIRA İNİNCE KOLONİ KOPAR. `docs/colony-faults-plan.md` §5, Faz 6.
 *
 * BU FAZ D179'U GERİ AÇIYOR. `ownership.ts`'de `releasePlanetControl`'ün neden silindiği
 * hâlâ yazılı duruyor; sahibin kararıyla geri geliyor, ama D167/D179'un ödediği her
 * bedelin yeniden ödenmesi gerekiyor — bu suite o bedellerin listesi.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('sadakat uyarıları', () => {
  let f: Fixture;
  let colony: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
    for (const kind of FAULT_KINDS) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }
  });

  const watch = () => f.db.transaction((tx) => import('../src/services/loyalty.js')
    .then((m) => m.scheduleLoyaltyWatch(tx, {
      seasonId: f.seasonId, planetId: colony, loyalty: 100,
      activeCount: FAULT_KINDS.length, now: f.clock.now(),
    })));

  it('düşen bir koloni kendine bir izleyici kurar', async () => {
    await watch();
    const pending = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.status, 'pending')));
    expect(pending).toHaveLength(1);
  });

  it('ilk eşikte uyarı gelir ve izleyici bir sonrakine geçer', async () => {
    await watch();
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'colony_secession'));
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();

    const notes = await f.db.select().from(notifications)
      .where(eq(notifications.kind, 'colony_loyalty_warning'));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.payload).toMatchObject({ planetId: colony });
    expect(notes[0]!.payload.minutesLeft).toBeGreaterThan(0);

    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.kind).toBe('COLONY');
    const pending = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.status, 'pending')));
    expect(pending).toHaveLength(1);
  });

  it('tek bir onarım sayacı durdurur değil yavaşlatır — kopuş ileri gider', async () => {
    await watch();
    const [first] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'colony_secession'));
    await f.db.delete(planetFaults)
      .where(and(eq(planetFaults.planetId, colony), eq(planetFaults.kind, 'CORE_OUTAGE')));
    await f.db.transaction((tx) => import('../src/services/loyalty.js')
      .then((m) => m.rescheduleLoyaltyWatch(tx, { seasonId: f.seasonId, planetId: colony, now: f.clock.now() })));

    const [second] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.status, 'pending')));
    expect(second!.resolveAt.getTime()).toBeGreaterThan(first!.resolveAt.getTime());
  });

  it('hepsi onarılınca izleyici kalkar — sadakat artık yükseliyor', async () => {
    await watch();
    await f.db.delete(planetFaults).where(eq(planetFaults.planetId, colony));
    await f.db.transaction((tx) => import('../src/services/loyalty.js')
      .then((m) => m.rescheduleLoyaltyWatch(tx, { seasonId: f.seasonId, planetId: colony, now: f.clock.now() })));
    const pending = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'colony_secession'), eq(scheduledEvents.status, 'pending')));
    expect(pending).toHaveLength(0);
  });
});

describe('koloni koptuğunda', () => {
  let f: Fixture;
  let colony: string;
  let capital: string;
  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const secede = async (): Promise<void> => {
    await f.db.transaction((tx) => import('../src/services/loyalty.js')
      .then((m) => m.scheduleLoyaltyWatch(tx, {
        seasonId: f.seasonId, planetId: colony, loyalty: 0.0001,
        activeCount: FAULT_KINDS.length, now: f.clock.now(),
      })));
    f.clock.advance(5);
    await worker().tick();
  };

  beforeEach(async () => {
    f = await seedWorld(2);
    [capital, colony] = [f.planetIds[1]!, f.planetIds[0]!];
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]! })
      .where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
    await grant(f.db, colony, 100_000, 40_000);
    await f.db.update(planets).set({ loyalty: 0 }).where(eq(planets.id, colony));
    for (const kind of FAULT_KINDS) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }
  });

  it('dünya tarafsıza düşer ve komutanı kalmaz', async () => {
    await secede();
    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.kind).toBe('NEUTRAL');
    expect(world!.controllerPlayerId).toBeNull();
  });

  it('bakıcı kaydı yazılır ve kademesi çekirdekten türetilir', async () => {
    await secede();
    const [state] = await f.db.select().from(neutralPlanetState)
      .where(eq(neutralPlanetState.planetId, colony));
    expect(state).toBeTruthy();
    expect([1, 2, 3]).toContain(state!.tier);
  });

  /**
   * DÜŞEN KOLONİ BİR ÖDÜLDÜR: HİÇBİR SEVİYE İNMEZ, STOK SIFIRLANMAZ.
   *
   * `reinforceNeutral` bakıcı dünyaları şablona göre YÜKSELTİYOR ama asla indirmiyor, ve
   * bu testin koruduğu şey o asimetrinin kopuş yolunda da geçerli olduğu: core-18 bir
   * koloni düştüğünde haritada core-18 binalarıyla duruyor, tier-3 şablonunun core-8'ine
   * sıfırlanmıyor. Onu ilk alan büyük bir dünya kazanıyor.
   *
   * Stokta "hiç değişmedi" DEMİYOR, ve dememeli: kopuş anına kadar duran arızalar — bu
   * fixture'da sekizi de duruyor, kasadaki sızıntı dahil — o son dakikaların bedelini
   * almaya devam ediyor. Dünya son ana kadar bozuktu.
   */
  it('binalar, yörünge ve stok yerinde kalır — düşen koloni bir ödüldür', async () => {
    await giveInstrument(f.db, colony, 'AEGIS', 3);
    await giveSatellite(f.db, colony, 'FOUNDRY');
    const [before] = await f.db.select().from(planets).where(eq(planets.id, colony));
    const buildingsBefore = await f.db.select().from(buildings)
      .where(eq(buildings.planetId, colony));
    const orbitBefore = await f.db.select().from(satellites)
      .where(eq(satellites.planetId, colony));

    await secede();

    const [after] = await f.db.select().from(planets).where(eq(planets.id, colony));
    const buildingsAfter = await f.db.select().from(buildings)
      .where(eq(buildings.planetId, colony));
    const orbitAfter = await f.db.select().from(satellites)
      .where(eq(satellites.planetId, colony));

    // Beş binanın hepsi, tek tek, aynı seviyede.
    expect(buildingsAfter.toSorted((a, b) => a.type.localeCompare(b.type)))
      .toEqual(buildingsBefore.toSorted((a, b) => a.type.localeCompare(b.type)));
    // Aegis ve yörüngedeki uydu da öyle.
    expect(orbitAfter.toSorted((a, b) => a.type.localeCompare(b.type)))
      .toEqual(orbitBefore.toSorted((a, b) => a.type.localeCompare(b.type)));
    // Stok yerinde: bakıcı şablonunun `captureStock` rakamına sıfırlanmadı.
    expect(after!.alloy).toBeGreaterThan(before!.alloy * 0.99);
    expect(after!.crystal).toBeGreaterThan(before!.crystal * 0.99);
    // Kalkan duvar saatiyle doluyor ve kopuştan önceki beş dakikada doldu; iddia onun
    // sıfırlanmadığı, sabit kaldığı değil.
    expect(after!.shield).toBeGreaterThanOrEqual(before!.shield);
  });

  /**
   * BAKICI SAATİ DE KURULUYOR, ve kurulmadığı sürece görünmez bir boşluktu.
   *
   * `reinforceNeutral` bir bakıcı dünyayı ayakta tutan tek şey ve yalnızca bir
   * `neutral_reinforce` event'inden koşuyor. Onsuz düşen koloni, eski komutanının
   * bıraktığı emplasmanlarla kalır ve BİR DAHA ASLA toparlanmazdı — sezon başında
   * doğmuş bir tarafsız dünyadan kesinlikle daha yumuşak, ve alınacak bir dünya değil
   * sağılacak bir dünya: bir kez akın et, bir daha karşına hiçbir şey çıkmaz.
   */
  it('düşen dünya bakıcı takviyesine bağlanır', async () => {
    await secede();
    const [state] = await f.db.select().from(neutralPlanetState)
      .where(eq(neutralPlanetState.planetId, colony));
    expect(state!.nextReinforcementAt).not.toBeNull();
    const armed = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'neutral_reinforce'),
      eq(scheduledEvents.refId, colony),
      eq(scheduledEvents.status, 'pending'),
    ));
    expect(armed).toHaveLength(1);
  });

  /** Filo savaşsız kaybedilmez: mobil gemiler eve alınır, emplasmanlar dünyayla kalır. */
  it('mobil filo capitale alınır, yer savunması bakıcıya kalır', async () => {
    await giveUnits(f.db, colony, { DART: 12, THORN: 4 });
    await giveUnits(f.db, capital, { DART: 3 });
    await secede();

    const left = await f.db.select().from(units).where(eq(units.planetId, colony));
    expect(left.find((u) => u.hull === 'DART')?.count ?? 0).toBe(0);
    const thorn = left.find((u) => u.hull === 'THORN');
    expect(thorn!.count).toBe(4);
    expect(thorn!.ownerPlayerId).toBeNull();

    const home = await f.db.select().from(units).where(eq(units.planetId, capital));
    expect(home.find((u) => u.hull === 'DART')?.count).toBe(15);
  });

  /**
   * ARIZA SİSTEMİNİN SAATLERİ GİDER, BAKICININKİ KALIR.
   *
   * Bu test "bu dünyada bekleyen hiçbir şey yok" diyordu ve bakıcı takviyesi eklenince
   * doğru olarak kırıldı: `neutral_reinforce` artık kasten kuruluyor. İddia hep "arıza
   * sisteminin bıraktığı hiçbir saat kalmaz" idi; şimdi tam olarak onu söylüyor.
   */
  it('arızalar, onarımlar ve arıza saatleri silinir', async () => {
    const faultRows = await f.db.select().from(planetFaults)
      .where(eq(planetFaults.planetId, colony));
    const repairing = faultRows[0]!;
    const readyAt = new Date(f.clock.now().getTime() + 60 * 60_000);
    await f.db.update(planetFaults).set({
      repairSlot: 0,
      repairStartedAt: f.clock.now(),
      repairReadyAt: readyAt,
      repairCost: { alloy: 1, crystal: 0, deuterium: 0 },
    }).where(eq(planetFaults.id, repairing.id));
    await f.db.insert(scheduledEvents).values({
      seasonId: f.seasonId,
      kind: 'fault_repair_complete',
      refId: repairing.id,
      resolveAt: readyAt,
    });

    await secede();
    expect(await f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony)))
      .toHaveLength(0);
    const leftovers = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.refId, colony),
      eq(scheduledEvents.status, 'pending'),
      inArray(scheduledEvents.kind, ['fault_spawn', 'vault_leak_flush', 'colony_secession']),
    ));
    expect(leftovers).toHaveLength(0);
    const repairLeftovers = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'fault_repair_complete'),
      inArray(scheduledEvents.refId, faultRows.map((fault) => fault.id)),
      eq(scheduledEvents.status, 'pending'),
    ));
    expect(repairLeftovers).toHaveLength(0);
  });

  it('koloni kotasında yer açılır', async () => {
    const before = await f.db.transaction((tx) => colonyStanding(tx, f.playerIds[1]!));
    await secede();
    const after = await f.db.transaction((tx) => colonyStanding(tx, f.playerIds[1]!));
    expect(after.colonies).toBe(before.colonies - 1);
  });

  it('komutan haberdar edilir', async () => {
    await secede();
    const notes = await f.db.select().from(notifications)
      .where(eq(notifications.kind, 'colony_lost'));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.playerId).toBe(f.playerIds[1]!);
  });

  it('aynı dünya yeniden alınıp tekrar koparsa ikinci kayıp da bildirilir', async () => {
    await secede();
    const { transferPlanetControl } = await import('../src/services/ownership.js');
    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colony,
      newPlayerId: f.playerIds[1]!,
      expectedControllerPlayerId: null,
      now: f.clock.now(),
      protectedUntil: f.clock.now(),
    }));
    await f.db.update(planets).set({ loyalty: 0, lastTickAt: f.clock.now() })
      .where(eq(planets.id, colony));
    for (const kind of FAULT_KINDS) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }

    await secede();

    const notes = await f.db.select().from(notifications)
      .where(eq(notifications.kind, 'colony_lost'));
    expect(notes).toHaveLength(2);
  });

  /** D2: dominion sıfır toplamlıdır ve yalnızca savaş üretir. İhmal savaş değildir. */
  it('kopuş dominion üretmez', async () => {
    const before = await f.db.select().from(planets).where(eq(planets.id, colony));
    await secede();
    const { dominionEvents } = await import('../src/db/schema.js');
    const events = await f.db.select().from(dominionEvents);
    expect(events).toHaveLength(0);
    expect(before).toHaveLength(1);
  });

  it('sadakat sıfırda değilse kopuş olmaz', async () => {
    await f.db.update(planets).set({ loyalty: 40 }).where(eq(planets.id, colony));
    await f.db.delete(planetFaults).where(eq(planetFaults.planetId, colony));
    await secede();
    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.kind).toBe('COLONY');
  });

  it('bekleyen inşaat emirleri terk edilir', async () => {
    await f.db.insert(buildOrders).values({
      planetId: colony, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'REFINERY',
      startedAt: f.clock.now(), readyAt: new Date(f.clock.now().getTime() + 600_000),
      remainingSeconds: 600, cost: { alloy: 100, crystal: 0, deuterium: 0 },
    });
    await secede();
    const orders = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, colony));
    expect(orders.every((o) => o.status !== 'BUILDING')).toBe(true);
  });
});

/**
 * CODE REVIEW'DA BULUNAN DÖRT HATA. Hiçbiri bir testin yakaladığı şey değildi —
 * dördü de "bu tabloya kim daha bakıyor" sorusunu sormakla çıktı.
 */
describe('gözden kaçanlar', () => {
  let f: Fixture;
  let colony: string;
  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
  });

  /**
   * Ele geçirilen dünya eski sahibinin sadakatiyle geliyordu: %8'de yakalanan bir koloni
   * uğruna Death Star ödeyen komutandan bir saat içinde, hiç uyarı almadan koparadı.
   */
  it('el değiştiren dünya sadakatini sıfırdan başlatır, arızalarını korur', async () => {
    await f.db.update(planets).set({ loyalty: 8 }).where(eq(planets.id, colony));
    await f.db.insert(planetFaults)
      .values({ planetId: colony, kind: 'CORE_OUTAGE', startedAt: f.clock.now() });
    const { transferPlanetControl } = await import('../src/services/ownership.js');

    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colony,
      newPlayerId: f.playerIds[1]!,
      expectedControllerPlayerId: f.playerIds[0]!,
      now: f.clock.now(),
      protectedUntil: f.clock.now(),
    }));

    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world!.loyalty).toBe(FAULT.loyaltyMax);
    // Ödül sorunlarıyla birlikte geliyor: dünya hâlâ bozuk.
    expect(await f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony)))
      .toHaveLength(1);
  });

  /**
   * Yerleşilen bir dünyayı hiçbir şey silahlandırmıyordu: tek silahlandıran yol Core'un
   * kapıyı geçmesi, ve core 12'de alınmış bir dünya çoktan geçmiş oluyor.
   */
  it('el değiştiren dünya kendine yeni bir sayaç kurar', async () => {
    await f.db.delete(scheduledEvents);
    const { transferPlanetControl } = await import('../src/services/ownership.js');
    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colony,
      newPlayerId: f.playerIds[1]!,
      expectedControllerPlayerId: f.playerIds[0]!,
      now: f.clock.now(),
      protectedUntil: f.clock.now(),
    }));
    const armed = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'fault_spawn'), eq(scheduledEvents.refId, colony)));
    expect(armed).toHaveLength(1);
  });

  /**
   * `events_dedupe_key_idx` KALICI. Gezegeni adlandıran bir anahtar, o gezegenin bir
   * önceki hayatından kalıp yeni hayatını sessizce silahsız bırakıyordu.
   */
  it('kopmuş ve yeniden alınmış dünya tekrar silahlanabilir', async () => {
    const { armFaults } = await import('../src/services/faults.js');
    const arm = () => f.db.transaction((tx) => armFaults(tx, {
      seasonId: f.seasonId, planetId: colony, kind: 'COLONY', coreLevel: 12, now: f.clock.now(),
    }));
    await arm();
    /*
      TAMAMLA, SİLME. Bu testin ilk hâli önceki hayatın event satırını siliyordu — ve satırla
      birlikte hatanın kendisini, yani kalıcı anahtarı da siliyordu. Gerçekte bir event
      `done` olur ve tabloda kalır; `events_dedupe_key_idx` o anahtarı sezon boyunca tutar.
      Silen bir test, düzeltme olsa da olmasa da geçerdi.
    */
    await f.db.update(scheduledEvents).set({ status: 'done' })
      .where(and(eq(scheduledEvents.kind, 'fault_spawn'), eq(scheduledEvents.refId, colony)));
    await arm();

    const armed = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'fault_spawn'),
      eq(scheduledEvents.refId, colony),
      eq(scheduledEvents.status, 'pending'),
    ));
    expect(armed).toHaveLength(1);
  });
});

/**
 * BOŞTA KOLTUK, BOZUK BİR KOLONİYLE. Code review'da bulunan ilk hata.
 *
 * AYRI BİR describe, ÇÜNKÜ İLK YAZILIŞI HİÇBİR ŞEYİ TEST ETMİYORDU. Paylaşılan fixture
 * komutanın TEK dünyasını koloniye çeviriyordu; `reclaimIdleSeats` adayları CAPITAL
 * üzerinden seçtiği için o komutan hiç aday olmadı, hiçbir şey silinmedi, arıza satırı
 * yerinde kaldı — ve test bunu "geri alındı ama arıza kaldı" diye okudu. Gerçek senaryo
 * bir capital ARTI bozuk bir koloni.
 */
describe('boşta koltuk geri alınırken', () => {
  let f: Fixture;
  let capital: string;
  let colony: string;
  beforeEach(async () => {
    f = await seedWorld(3);
    capital = f.planetIds[0]!;
    colony = f.planetIds[2]!;
    // Üçüncü dünya ilk komutanın kolonisi olur; capital'i yerinde kalır.
    await f.db.update(planets)
      .set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]!, statsOwnerPlayerId: f.playerIds[0]! })
      .where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
  });

  /**
   * `planet_faults` gezegene referans veriyor. `demolish` onu silmiyordu, yani bozuk bir
   * kolonisi olan boşta koltuk `delete(planets)` üzerinde patlar ve BİR DAHA ASLA geri
   * alınamazdı — dosyanın kendi docblock'unda iki kez anlatılan arızanın aynısı.
   */
  it('bozuk koloni engel olmaz ve arıza satırları gider', async () => {
    await f.db.insert(planetFaults)
      .values({ planetId: colony, kind: 'VAULT_LEAK', startedAt: f.clock.now() });
    const { reclaimIdleSeats } = await import('../src/services/reclaim.js');
    const { players } = await import('../src/db/schema.js');
    /*
      BİR GÜN FAZLA, TAM EŞİK DEĞİL. `reclaimIdleSeats` `lastActiveAt < cutoff` soruyor —
      kesin küçük — ve eşik tam `idleDays` gün. İlk yazılışta tam 72 saat veriyordum,
      sınırın üstüne düşüp koltuğu hiç aday yapmıyordu ve test `demolish`'e HİÇ ulaşmadan
      "arıza satırı kaldı" diye kırılıyordu: düzeltmeli de düzeltmesiz de aynı şekilde.
      `reclaim.test.ts` aynı sebeple `idleDays + 1` kullanıyor.
    */
    const idle = new Date(f.clock.now().getTime() - (SERVERS.idleDays + 1) * 86_400_000);
    await f.db.update(players).set({ lastActiveAt: idle, joinedAt: idle })
      .where(eq(players.id, f.playerIds[0]!));

    const result = await reclaimIdleSeats(f.db, f.clock);

    // Önce koltuğun GERÇEKTEN geri alındığını kanıtla — yoksa aşağıdakiler bir şey söylemez.
    expect(result.failed).toBe(0);
    expect(result.reclaimed.length).toBeGreaterThan(0);
    expect(await f.db.select().from(planets).where(eq(planets.id, capital))).toHaveLength(0);
    expect(await f.db.select().from(planets).where(eq(planets.id, colony))).toHaveLength(0);
    expect(await f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony)))
      .toHaveLength(0);
  });
});
