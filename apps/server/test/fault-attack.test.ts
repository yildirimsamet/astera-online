import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { FAULT, FAULT_KINDS, type FaultKind } from '@astera/rules';
import {
  battleReports, missions, notifications, planetFaults, planets, scheduledEvents, strategicAssets,
} from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb, type Fixture,
} from './helpers.js';

/**
 * AĞIR BİR SALDIRI KOLONİYİ BOZAR. Sahip talimatı:
 *
 *   *"eğer bir koloni saldırı yemiş ve kalkan verilmesine sebep olmuş kadar bir saldırı
 *   yemişse: eklenebiliyorsa direk en az 2 tane arıza rastgele eklensin. eklenemiyorsa
 *   1 eklensin, tüm arızalar zaten varsa bişey olmasın."*
 *
 * "KALKAN VERİLMESİNE SEBEP OLMUŞ KADAR" BİR ŞİDDET ÖLÇÜSÜ, bir satır yazımı değil. Kalkan
 * iki durumda kasten VERİLMİYOR ama saldırı yine de o kadar ağır: savunanın kendi akını
 * havadaysa (saldırırken korunmak kalkanın amacını tersine çevirir) ve komutan sunucunun
 * oynadığı bir botsa. Arıza koruma değil HASAR — bu yüzden ikisinde de geliyor. Tek istisna
 * kalkan sisteminin kendisinin kapalı olması: o zaman hiçbir saldırı "kalkan verilmesine
 * sebep olan" saldırı değil.
 *
 * Fixture `recovery-shield.test.ts`'in: aynı ağır akın, aynı kayıp eşiği.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('ağır bir saldırı', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let colony: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  const faultsOf = async (planetId: string): Promise<FaultKind[]> =>
    (await f.db.select({ kind: planetFaults.kind }).from(planetFaults)
      .where(eq(planetFaults.planetId, planetId))).map((row) => row.kind);

  const HEAVY: Record<string, number> = { DART: 240, COURIER: 60 };

  /** Savunanın dayanamayacağı, ambarında hepsine yer olan bir akın. Kalkanı hak ettirir. */
  const overwhelm = async (target: string) => {
    await grant(f.db, target, 60_000, 15_000);
    await giveUnits(f.db, target, { DART: 2 });
    await giveUnits(f.db, mine, HEAVY);
    await fuelUp(f.db, mine);
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, target, HEAVY, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report, 'fixture akını çözülmedi').toBeDefined();
    expect(report!.grade).toBe('DECISIVE');
    return { launch, report: report! };
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs, colony] = f.planetIds as [string, string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 8);
      await setLevel(f.db, id, 'SHIPYARD', 4);
    }
    await f.db.update(planets)
      .set({
        controllerPlayerId: f.playerIds[1]!,
        kind: 'COLONY',
        statsOwnerPlayerId: f.playerIds[1]!,
        seasonTelemetry: {
          produced: { alloy: 0, crystal: 0, deuterium: 0 },
          productiveSeconds: 0,
          shipsBuilt: {},
        },
      })
      .where(eq(planets.id, colony));
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
  });

  it('kolonide yer varsa tam iki arıza bırakır', async () => {
    const { report } = await overwhelm(colony);
    expect(report.recoveryShieldUntil, 'fixture kalkanı hak etmedi').not.toBeNull();
    const faults = await faultsOf(colony);
    expect(faults).toHaveLength(FAULT.attackFaults);
    expect(new Set(faults).size).toBe(FAULT.attackFaults);
  });

  it('tek uygun arıza kaldıysa bir tane bırakır', async () => {
    const standing = FAULT_KINDS.filter((kind) => kind !== 'VAULT_LEAK');
    for (const kind of standing) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }
    await overwhelm(colony);
    const faults = await faultsOf(colony);
    expect(faults).toHaveLength(FAULT_KINDS.length);
    expect(faults).toContain('VAULT_LEAK');
  });

  it('hepsi zaten bozuksa hiçbir şey olmaz ve savaş yine çözülür', async () => {
    for (const kind of FAULT_KINDS) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }
    const { report } = await overwhelm(colony);
    expect(report.grade).toBe('DECISIVE');
    expect(await faultsOf(colony)).toHaveLength(FAULT_KINDS.length);
  });

  it('eşiğin altında kalan bir akın hiçbir şey bozmaz', async () => {
    // A loss in a resource no world produces has no finite recovery time and always
    // earns the shield; this fixture is about a raid BELOW the bar, so it makes fuel.
    for (const id of f.planetIds) await setLevel(f.db, id, 'DEUTERIUM_PLANT', 8);
    await grant(f.db, colony, 400_000, 100_000);
    await giveUnits(f.db, colony, { DART: 2 });
    await giveUnits(f.db, mine, { DART: 60 });
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, colony, { DART: 60 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();

    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report?.recoveryShieldUntil ?? null, 'fixture yanlışlıkla kalkan kazandı').toBeNull();
    expect(await faultsOf(colony)).toHaveLength(0);
  });

  /** Capital asla bozulmaz — ağır bir yenilgide bile. Kalkan ise yine verilir. */
  it('capitale yapılan ağır akın arıza bırakmaz', async () => {
    const { report } = await overwhelm(theirs);
    expect(report.recoveryShieldUntil).not.toBeNull();
    expect(await faultsOf(theirs)).toHaveLength(0);
  });

  /**
   * KAPININ ALTI — SERVİS ÜZERİNDEN, AKIN ÜZERİNDEN DEĞİL.
   *
   * İlk yazılışı gerçek bir akın kuruyordu ve tier bandı Core 5'e Core 8'den saldırıyı
   * reddedince `return` ile HİÇBİR ŞEY iddia etmeden geçiyordu. Kapı arıza kırıcının
   * kendisinde; onu doğrudan soran test hiçbir koşulda boş geçemez.
   */
  it('çekirdek kapısının altındaki koloni bozulmaz', async () => {
    await setLevel(f.db, colony, 'CORE', FAULT.minCoreLevel - 1);
    const { breakFaults } = await import('../src/services/faults.js');
    const written = await f.db.transaction((tx) => breakFaults(tx, {
      seasonId: f.seasonId, planetId: colony, now: f.clock.now(),
      count: FAULT.attackFaults, seed: 'test-below-gate',
    }));
    expect(written).toEqual([]);
    expect(await faultsOf(colony)).toHaveLength(0);
  });

  /**
   * SAHİP KARARI: SALDIRININ BOZDUKLARI SAVAŞ RAPORUNDA YAZAR, AYRI BİLDİRİM OLARAK DEĞİL.
   *
   * Önceki hâli akınla aynı anda iki ayrı arıza satırı gönderiyordu — `raided`'ın hemen
   * yanında, katlanmayan, akından geldiğini söylemeyen iki satır. Raporun kendisi zaten
   * "bu savaş ne yaptı"yı anlatan yer.
   */
  it('saldırının bozdukları ayrı arıza bildirimi göndermez', async () => {
    await overwhelm(colony);
    expect(await faultsOf(colony)).toHaveLength(FAULT.attackFaults);
    const notes = await f.db.select().from(notifications)
      .where(and(eq(notifications.kind, 'colony_fault'), eq(notifications.playerId, f.playerIds[1]!)));
    expect(notes).toHaveLength(0);
  });

  it('rapor, savaşın bozduğu arızaları tam olarak kaydeder', async () => {
    const { report } = await overwhelm(colony);
    expect([...report.colonyFaults].sort()).toEqual([...await faultsOf(colony)].sort());
  });

  it('savunan raporda bozulanları görür, saldırgan görmez', async () => {
    const { launch } = await overwhelm(colony);
    const broken = await faultsOf(colony);
    const { readBattleReports } = await import('../src/services/reports.js');

    const defenderView = (await readBattleReports(f.db, f.playerIds[1]!)).reports
      .find((row) => row.kind !== 'STRATEGIC' && row.missionId === launch.missionId);
    const attackerView = (await readBattleReports(f.db, f.playerIds[0]!)).reports
      .find((row) => row.kind !== 'STRATEGIC' && row.missionId === launch.missionId);

    expect(defenderView && 'colonyFaults' in defenderView ? [...defenderView.colonyFaults].sort() : null)
      .toEqual([...broken].sort());
    // Saldırgana söylemek "kubbeleri söndü, tersanesi isyanda" demek olurdu.
    expect(attackerView && 'colonyFaults' in attackerView ? attackerView.colonyFaults : null)
      .toEqual([]);
  });

  it('hiçbir şey bozulmadıysa rapor boş liste taşır', async () => {
    const { report } = await overwhelm(theirs);
    expect(report.colonyFaults).toEqual([]);
  });

  /** İki arıza birden geldi: iniş çizgisi dikleşti, izleyici yeniden kurulmalı. */
  it('sadakat izleyicisi yeni arıza sayısıyla kurulur', async () => {
    await overwhelm(colony);
    const watch = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'colony_secession'),
      eq(scheduledEvents.refId, colony),
      eq(scheduledEvents.status, 'pending'),
    ));
    expect(watch).toHaveLength(1);
  });

  /**
   * D47'NİN DERSİ, BİR KEZ DAHA. Commit edip `complete()` edemeden ölen worker'ın satırı
   * geri geliyor; ikinci işleyiş İKİ ARIZA DAHA bırakırsa ağır bir akın dört arıza sayılır.
   */
  it('aynı varış iki kez işlenirse ikinci kez arıza bırakmaz', async () => {
    const { launch } = await overwhelm(colony);
    const before = await faultsOf(colony);
    await f.db.update(scheduledEvents).set({ status: 'pending' }).where(and(
      eq(scheduledEvents.kind, 'mission_arrival'),
      eq(scheduledEvents.refId, launch.missionId),
    ));
    await worker().tick();
    /*
      ÖNCE YENİDEN İŞLENDİĞİNİ KANITLA. Worker satırı hiç almasaydı "ikinci arıza yok"
      iddiası kendiliğinden doğru olurdu ve test hiçbir şey söylemezdi.
    */
    const [redelivered] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'mission_arrival'),
      eq(scheduledEvents.refId, launch.missionId),
    ));
    expect(redelivered!.status).toBe('done');
    expect(redelivered!.attempts).toBeGreaterThanOrEqual(2);
    expect(await faultsOf(colony)).toHaveLength(before.length);
  });

  /**
   * KALKAN VERİLMEDİ AMA SALDIRI O KADAR AĞIRDI. Savunanın kendi akını havadayken kalkan
   * kasten reddediliyor; arıza bir koruma değil, hasar — geliyor.
   */
  it('savunanın kendi akını havadayken de bozar', async () => {
    await grant(f.db, colony, 60_000, 15_000);
    await giveUnits(f.db, colony, { DART: 2, COURIER: 2 });
    await giveUnits(f.db, mine, HEAVY);
    await fuelUp(f.db, mine);
    await fuelUp(f.db, colony);
    await levelWorld(f.db, f.planetIds);
    const launch = await launchAttack(f.db, mine, colony, HEAVY, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    const outbound = await launchAttack(f.db, colony, mine, { DART: 2 }, f.clock);
    expect(outbound.arriveAt.getTime()).toBeGreaterThan(f.clock.now().getTime());
    await worker().tick();

    const [report] = await f.db.select().from(battleReports)
      .where(eq(battleReports.missionId, launch.missionId));
    expect(report?.recoveryShieldUntil ?? null, 'kalkan reddedilmeliydi').toBeNull();
    expect(await faultsOf(colony)).toHaveLength(FAULT.attackFaults);
  });

  /** Kalkan sistemi kapalıyken hiçbir saldırı "kalkan verilmesine sebep olan" saldırı değil. */
  it('kalkan sistemi kapalıyken saldırı arıza bırakmaz', async () => {
    vi.stubEnv('RECOVERY_SHIELD_ENABLED', 'false');
    try {
      await overwhelm(colony);
      expect(await faultsOf(colony)).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  /** Death Star'ın ilk vuruşu kalkanı koşulsuz veriyor — koloniyi de bozuyor. */
  it('Death Star ilk vuruşu koloniye iki arıza bırakır', async () => {
    await grant(f.db, colony, 200_000, 50_000);
    await setLevel(f.db, mine, 'CORE', 5);
    await f.db.insert(strategicAssets).values({
      planetId: mine, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0,
    });
    const launched = await launchDeathStar(f.db, mine, colony, f.clock);
    f.clock.set(settledAt(launched.arriveAt));
    await worker().tick();

    const [struck] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(struck?.controllerPlayerId, 'ilk vuruş dünyayı ele geçirmemeli').toBe(f.playerIds[1]!);
    expect(await faultsOf(colony)).toHaveLength(FAULT.attackFaults);
  });

  it('dönüş bacağı saldırganın dünyasını bozmaz', async () => {
    const { launch } = await overwhelm(colony);
    const [home] = await f.db.select().from(missions).where(and(
      eq(missions.parentMissionId, launch.missionId),
      eq(missions.kind, 'return'),
    ));
    if (home) {
      f.clock.set(settledAt(home.arriveAt));
      await worker().tick();
    }
    expect(await faultsOf(mine)).toHaveLength(0);
  });
});

describe('arıza kırıcının sınırları', () => {
  let f: Fixture;
  let colony: string;
  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    colony = f.planetIds[0]!;
    await f.db.update(planets).set({ kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 12);
  });

  /**
   * TUZAĞI İMKÂNSIZ KIL. `spawn_event_id` unique; aynı spawn kimliğiyle ikinci satır
   * sessizce reddedilir. İki arıza isteyip bir tane almak hiçbir hata vermeden olurdu.
   */
  it('spawn kimliğiyle birden fazla arıza istemek reddedilir', async () => {
    const { breakFaults } = await import('../src/services/faults.js');
    await expect(f.db.transaction((tx) => breakFaults(tx, {
      seasonId: f.seasonId, planetId: colony, now: f.clock.now(),
      count: 2, seed: 'x', spawnEventId: '00000000-0000-4000-8000-000000000001',
    }))).rejects.toThrow(/spawnEventId/);
    expect(await f.db.select().from(planetFaults)).toHaveLength(0);
  });

  /**
   * BOZULAMAYAN BİR DÜNYADA SAYAÇ KENDİNİ YENİDEN KURMAZ.
   *
   * "Ne olursa olsun yeniden kur" kuralı, her şeyi bozuk bir dünya için doğru — bir onarım
   * yer açmak üzere. Hiç bozulamayan bir dünya için değil: orada sayaç hiçbir şey yapmadan
   * altı saatte bir sonsuza dek ateşlenir. Dünya tekrar bozulabilir olduğunda (Core kapıya
   * çıkınca, ya da el değiştirince) onu silahlandıran yollar zaten var.
   */
  it('kapının altındaki kolonide sayaç yeniden kurulmaz', async () => {
    const { armFaults } = await import('../src/services/faults.js');
    await f.db.transaction((tx) => armFaults(tx, {
      seasonId: f.seasonId, planetId: colony, kind: 'COLONY', coreLevel: 12, now: f.clock.now(),
    }));
    await setLevel(f.db, colony, 'CORE', FAULT.minCoreLevel - 1);
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'fault_spawn'));
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();

    const [fired] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.id, event!.id));
    expect(fired!.status, 'sayaç hiç ateşlenmedi — test bir şey söylemez').toBe('done');
    const pending = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'fault_spawn'), eq(scheduledEvents.status, 'pending'),
    ));
    expect(pending).toHaveLength(0);
  });

  it('tarafsıza düşmüş bir dünyada da yeniden kurulmaz', async () => {
    const { armFaults } = await import('../src/services/faults.js');
    await f.db.transaction((tx) => armFaults(tx, {
      seasonId: f.seasonId, planetId: colony, kind: 'COLONY', coreLevel: 12, now: f.clock.now(),
    }));
    await f.db.update(planets).set({ kind: 'NEUTRAL', controllerPlayerId: null, statsOwnerPlayerId: null })
      .where(eq(planets.id, colony));
    const [event] = await f.db.select().from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'fault_spawn'));
    f.clock.set(new Date(event!.resolveAt.getTime() + 1000));
    await worker().tick();
    const pending = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'fault_spawn'), eq(scheduledEvents.status, 'pending'),
    ));
    expect(pending).toHaveLength(0);
  });
});

