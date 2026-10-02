import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { Fleet } from '@astera/rules';
import {
  battleReports,
  clanSupportDominionEvents,
  clanSupportWaves,
  missions,
  notifications,
  planets,
  players,
  seasonResults,
  units,
} from '../src/db/schema.js';
import { reconcileClanPlayerReclaim } from '../src/services/clan.js';
import { recallClanSupport, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { secedeColony } from '../src/services/loyalty.js';
import { launchAttack } from '../src/services/mission.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { planetView } from '../src/services/planetView.js';
import { busy } from '../src/services/reclaim.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, testDb, type Fixture } from './helpers.js';
import { formClan, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — what the rest of the game does to a wave
 * (`docs/clan-defense-support-plan.md`, P10).
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);
const at = async (f: Fixture, ms: number) => {
  f.clock.set(new Date(ms));
  await worker(f).tick();
};
const landAll = async (f: Fixture) => {
  const rows = await f.db.select({ arriveAt: missions.arriveAt }).from(missions).where(eq(missions.status, 'in_flight'));
  const latest = rows.reduce((max, row) => Math.max(max, row.arriveAt.getTime()), f.clock.now().getTime());
  await at(f, latest + 30_000);
};

const open = (f: Fixture, planet: number, owner: number) => f.db.transaction((tx) => setDefencePosture(tx, {
  planetId: f.planetIds[planet]!,
  playerId: f.playerIds[owner]!,
  toggles: { escape: false, support: true },
  clock: f.clock,
}));
const send = (f: Fixture, sender: number, origin: number, host: number, fleet: Fleet) =>
  f.db.transaction((tx) => sendClanSupport(tx, {
    senderPlayerId: f.playerIds[sender]!,
    originPlanetId: f.planetIds[origin]!,
    hostPlanetId: f.planetIds[host]!,
    fleet,
    clock: f.clock,
  }));
const waveOf = async (f: Fixture, id: string) =>
  (await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, id)))[0]!;

/** World `planet` becomes a colony of commander `owner` (the donor seat keeps nothing). */
async function colony(f: Fixture, planet: number, owner: number): Promise<string> {
  const id = f.planetIds[planet]!;
  await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[owner]! }).where(eq(planets.id, id));
  await f.db.update(units).set({ ownerPlayerId: f.playerIds[owner]! }).where(eq(units.planetId, id));
  return id;
}

describe('a host world changing hands', () => {
  it('sends every wave there home and drops the posture back to the retreat', async () => {
    const f = await supportWorld(5, 15_601);
    await formClan(f, 0, [1]);
    const host = await colony(f, 4, 1);
    await open(f, 4, 1);
    const { wave } = await send(f, 0, 0, 4, { DART: 10 });
    await landAll(f);
    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: host,
      newPlayerId: f.playerIds[2]!,
      expectedControllerPlayerId: f.playerIds[1]!,
      now: f.clock.now(),
      protectedUntil: f.clock.now(),
    }));
    expect(await waveOf(f, wave.id)).toMatchObject({ status: 'RETURNING', returnReason: 'WORLD_CHANGED' });
    const [world] = await f.db.select({ posture: planets.defencePosture }).from(planets).where(eq(planets.id, host));
    expect(world!.posture).toBe('ESCAPE');
  });

  it('does the same when the colony secedes', async () => {
    const f = await supportWorld(5, 15_602);
    await formClan(f, 0, [1]);
    const host = await colony(f, 4, 1);
    await open(f, 4, 1);
    const { wave } = await send(f, 0, 0, 4, { DART: 10 });
    await landAll(f);
    await f.db.transaction((tx) => secedeColony(tx, host, f.clock.now(), crypto.randomUUID()));
    expect(await waveOf(f, wave.id)).toMatchObject({ status: 'RETURNING', returnReason: 'WORLD_CHANGED' });
  });
});

describe('a sender’s origin world changing hands', () => {
  it('re-anchors the wave on the sender’s capital: the new owner inherits neither ships nor a bay', async () => {
    const f = await supportWorld(5, 15_603);
    await formClan(f, 0, [1]);
    const origin = await colony(f, 4, 0);
    await giveUnits(f.db, origin, { DART: 30 });
    await open(f, 1, 1);
    const fleet: Fleet = { DART: 12 };
    const { wave } = await send(f, 0, 4, 1, fleet);
    await landAll(f);
    await f.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: origin,
      newPlayerId: f.playerIds[2]!,
      expectedControllerPlayerId: f.playerIds[0]!,
      now: f.clock.now(),
      protectedUntil: f.clock.now(),
    }));
    const moved = await waveOf(f, wave.id);
    expect(moved.status).toBe('STATIONED');
    expect(moved.originPlanetId).toBe(f.planetIds[0]);
    const parked = await f.db.select().from(units).where(eq(units.location, moved.unitLocation));
    expect(parked.every((row) => row.planetId === f.planetIds[0])).toBe(true);
    expect(parked.reduce((sum, row) => sum + row.count, 0)).toBe(12);
    // The world the new owner holds carries none of those ships in its Hangar count.
    const stranger = await f.db.select().from(units)
      .where(and(eq(units.planetId, origin), eq(units.location, moved.unitLocation)));
    expect(stranger).toHaveLength(0);
    const bays = (await f.db.transaction((tx) => planetView(tx, origin, f.clock))).flight.used;
    expect(bays).toBe(0);

    // And it flies home to the capital when recalled.
    await f.db.transaction((tx) => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId: wave.id, clock: f.clock }));
    await landAll(f);
    expect((await waveOf(f, wave.id)).status).toBe('HOME');
  });
});

describe('three hands on one wave at once', () => {
  it('lets the sender, the host and a clan change race without a deadlock — one turn home', async () => {
    const f = await supportWorld(4, 15_608);
    await formClan(f, 0, [1, 2]);
    await open(f, 1, 1);
    const { wave } = await send(f, 0, 0, 1, { DART: 10 });
    await landAll(f);
    const { clanActor, leaveClan } = await import('../src/services/clan.js');
    const { sendBackClanSupport } = await import('../src/services/clanSupport.js');
    const results = await Promise.allSettled([
      f.db.transaction((tx) => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId: wave.id, clock: f.clock })),
      f.db.transaction((tx) => sendBackClanSupport(tx, { playerId: f.playerIds[1]!, waveId: wave.id, clock: f.clock })),
      f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[1]!), now: f.clock.now() })),
    ]);
    for (const row of results) {
      if (row.status === 'rejected') expect(String(row.reason)).not.toMatch(/deadlock/i);
    }
    const turned = await waveOf(f, wave.id);
    expect(turned.status).toBe('RETURNING');
    const legs = await f.db.select().from(missions).where(eq(missions.parentMissionId, turned.outboundMissionId));
    expect(legs).toHaveLength(1);
  });
});

describe('the reclaim sweep', () => {
  it('treats a live wave as business on both ends', async () => {
    const f = await supportWorld(4, 15_604);
    await formClan(f, 0, [1]);
    await open(f, 1, 1);
    await send(f, 0, 0, 1, { DART: 5 });
    await landAll(f);
    const rows = { runIds: [], raidIds: [], tradeIds: [], convoyIds: [] };
    await f.db.transaction(async (tx) => {
      expect(await busy(tx, [f.planetIds[0]!], f.playerIds[0]!, rows)).toBe(true);
      expect(await busy(tx, [f.planetIds[1]!], f.playerIds[1]!, rows)).toBe(true);
      expect(await busy(tx, [f.planetIds[2]!], f.playerIds[2]!, rows)).toBe(false);
    });
  });
});

describe('the season’s close', () => {
  async function supportedRaid(seed: number) {
    const f = await supportWorld(4, seed);
    await formClan(f, 0, [1, 2]);
    await giveUnits(f.db, f.planetIds[0]!, { PIKE: 80 });
    await open(f, 1, 1);
    await send(f, 0, 0, 1, { PIKE: 40 });
    await landAll(f);
    await giveUnits(f.db, f.planetIds[3]!, { DART: 150 });
    const launched = await launchAttack(f.db, f.planetIds[3]!, f.planetIds[1]!, { DART: 150 }, f.clock, f.playerIds[3], true);
    await landAll(f);
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    return { f, report: report! };
  }

  it('closes a season whose ladder moved through a supported line', async () => {
    const { f, report } = await supportedRaid(15_605);
    expect(report.defenderCount).toBe(2);
    // The wave is still standing: bring it home so nothing holds the close.
    const [wave] = await f.db.select().from(clanSupportWaves);
    await f.db.transaction((tx) => recallClanSupport(tx, { playerId: f.playerIds[0]!, waveId: wave!.id, clock: f.clock }));
    await landAll(f);
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const results = await f.db.select().from(seasonResults).where(eq(seasonResults.seasonId, f.seasonId));
    expect(results.length).toBeGreaterThan(0);
  });

  it('refuses to close a season whose support journal was tampered with', async () => {
    const { f } = await supportedRaid(15_606);
    const [row] = await f.db.select().from(clanSupportDominionEvents)
      .where(eq(clanSupportDominionEvents.role, 'DEFENDER'));
    await f.db.update(clanSupportDominionEvents).set({ delta: row!.delta + 1 })
      .where(eq(clanSupportDominionEvents.id, row!.id));
    await expect(forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId)).rejects.toThrow();
  });

  it('books the host’s statistics with the host’s own losses, and the supporter’s with theirs', async () => {
    const { f, report } = await supportedRaid(15_607);
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const accountOf = async (player: number) => (await f.db.select({ id: players.accountId }).from(players)
      .where(eq(players.id, f.playerIds[player]!)))[0]!.id;
    const [host] = await f.db.select().from(seasonResults).where(and(
      eq(seasonResults.seasonId, f.seasonId), eq(seasonResults.accountId, await accountOf(1)),
    ));
    const [supporter] = await f.db.select().from(seasonResults).where(and(
      eq(seasonResults.seasonId, f.seasonId), eq(seasonResults.accountId, await accountOf(0)),
    ));
    const pikesLost = report.defenderLosses.PIKE ?? 0;
    expect(host!.stats!.competition.shipsLostByHull.PIKE ?? 0).toBe(0);
    expect(supporter!.stats!.competition.defences).toBe(1);
    expect(supporter!.stats!.competition.shipsLostByHull.PIKE ?? 0).toBe(pikesLost);
  });
});

/*
  THE CLAN THE SYSTEM DISSOLVES. A reclaimed leader with no active member to succeed them
  takes the clan with them (`reconcileClanPlayerReclaim`) — the same end as a leader's own
  disband, and the support it ends must settle the same way (owner K4): every SUPPORT world
  of the remaining commanders back to the retreat, they are told, and every wave goes home.
*/
describe('a clan the system dissolves', () => {
  it('drops every member’s supporting world back to the retreat and sends their waves home', async () => {
    const f = await supportWorld(4, 15_608);
    // Commander 0 leads; 1 hosts at SUPPORT; 2 stands a wave there.
    await formClan(f, 0, [1, 2]);
    await open(f, 1, 1);
    const { wave } = await send(f, 2, 2, 1, { DART: 12 });
    await landAll(f);
    expect((await waveOf(f, wave.id)).status).toBe('STATIONED');

    // Nobody is active against a cutoff a day ahead: the leader goes and nobody succeeds.
    const now = f.clock.now();
    await f.db.transaction((tx) => reconcileClanPlayerReclaim(tx, {
      playerId: f.playerIds[0]!,
      seasonId: f.seasonId,
      displayName: 'Leader',
      now,
      activeCutoff: new Date(now.getTime() + 24 * 3_600_000),
    }));

    const [world] = await f.db.select({ posture: planets.defencePosture }).from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(world!.posture).toBe('ESCAPE');
    const told = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[1]!),
      eq(notifications.kind, 'defence_posture_reset'),
    ));
    expect(told).toHaveLength(1);
    expect(await waveOf(f, wave.id)).toMatchObject({ status: 'RETURNING', returnReason: 'MEMBERSHIP' });
  });

  it('leaves the arrangement alone when an active member takes the lead instead', async () => {
    const f = await supportWorld(4, 15_609);
    await formClan(f, 0, [1, 2]);
    await open(f, 1, 1);
    const { wave } = await send(f, 2, 2, 1, { DART: 12 });
    await landAll(f);
    const now = f.clock.now();
    // Everyone counts as active against a cutoff a day behind: a successor exists.
    await f.db.transaction((tx) => reconcileClanPlayerReclaim(tx, {
      playerId: f.playerIds[0]!,
      seasonId: f.seasonId,
      displayName: 'Leader',
      now,
      activeCutoff: new Date(now.getTime() - 24 * 3_600_000),
    }));
    const [world] = await f.db.select({ posture: planets.defencePosture }).from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(world!.posture).toBe('SUPPORT');
    expect((await waveOf(f, wave.id)).status).toBe('STATIONED');
  });
});
