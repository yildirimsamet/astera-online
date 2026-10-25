import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { mulberry32, resolveBattle, type BattleReplayData, type BattleReplayStatus } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { battleReplays, battleReports, missions } from '../src/db/schema.js';
import type { Tx } from '../src/db/client.js';
import { prepareBattleReplay, persistBattleReplay, readBattleReplay } from '../src/services/battleReplay.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, setLevel, settledAt, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const logger = pino({ level: 'silent' });
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('private immutable real battle replays', () => {
  let f: Fixture, app: FastifyInstance, close: (() => Promise<void>) | undefined;
  const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
  beforeEach(async () => {
    f = await seedWorld(3, 20261025);
    const built = buildApp({ env: testEnv(), logger, db: f.db, clock: f.clock });
    app = built.app; close = built.close; await app.ready();
  });
  afterEach(async () => { await close?.(); close = undefined; });
  const auth = async (index: number) => ({ authorization: `Bearer ${await tokens.issueAccess(f.accountIds[index]!)}` });
  const makeReport = async (tx: Tx, attackers = 2, defenders = 4, capture = true) => {
    const a = [{ contributionId: 'secret-wave', playerId: f.playerIds[0]!, fleet: { DART: attackers }, tech: { tech: {} } }];
    const d = [{ stackId: 'secret-host', playerId: f.playerIds[1]!, fleet: { DART: defenders }, tech: { tech: {} } }];
    const prepared = prepareBattleReplay(a, d);
    const result = resolveBattle(a, d, 0, mulberry32(6), 'HP_PLANET', true, prepared.recording);
    const [mission] = await tx.insert(missions).values({ seasonId: f.seasonId, kind: 'attack', status: 'resolved',
      ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!, fleet: a[0]!.fleet,
      distance: 1, fuelPaid: 0, departAt: f.clock.now(), arriveAt: f.clock.now() }).returning({ id: missions.id });
    const [report] = await tx.insert(battleReports).values({ seasonId: f.seasonId, missionId: mission!.id,
      attackerPlayerId: f.playerIds[0]!, defenderPlayerId: f.playerIds[1]!, targetPlanetId: f.planetIds[1]!, targetKind: 'PLAYER',
      grade: result.grade, rounds: result.rounds, loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: result.attackerLosses, defenderLosses: result.defenderLosses,
      attackerFleet: a[0]!.fleet, defenderFleet: d[0]!.fleet, createdAt: f.clock.now() }).returning({ id: battleReports.id });
    const input = { source: { kind: 'BATTLE' as const, id: report!.id }, seasonId: f.seasonId, capture: prepared, result,
      context: { environment: 'PLANET' as const, aegisCapacity: 0, defenceOffline: false, escape: null, control: null }, at: f.clock.now() };
    if (capture) await persistBattleReplay(tx, input);
    return input;
  };
  const saved = (a = 2, d = 4, capture = true) => f.db.transaction(tx => makeReport(tx, a, d, capture));
  const replay = async (id: string, reader: number) => app.inject({ method: 'GET', url: `/api/reports/BATTLE/${id}/replay`, headers: await auth(reader) });
  const statusFor = async (reader: number, id: string) => {
    const response = await app.inject({ method: 'GET', url: '/api/reports', headers: await auth(reader) });
    expect(response.statusCode).toBe(200);
    return response.json<{ reports: { id: string; replayStatus?: BattleReplayStatus }[] }>().reports.find(report => report.id === id)?.replayStatus;
  };

  it('captures an actual mission settlement, with the exact report rounds and damage', async () => {
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 8);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 8);
    f.clock.advance(250);
    await grant(f.db, f.planetIds[1]!, 40000, 4000);
    await giveUnits(f.db, f.planetIds[1]!, { BASTION: 6 });
    await giveUnits(f.db, f.planetIds[0]!, { DART: 68, COURIER: 3 });
    const launch = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 68, COURIER: 3 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, logger).tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launch.missionId));
    expect(report).toBeDefined();
    const response = await replay(report!.id, 1);
    expect(response.statusCode).toBe(200);
    const { replay: data } = response.json<{ replay: BattleReplayData }>();
    expect(data.recording.rounds.map(round => round.round)).toEqual(report!.rounds.map(round => round.round));
    expect(data.result.grade).toBe(report!.grade);
    expect(data.recording.rounds.flatMap(round => round.attackerShots).length).toBeGreaterThan(0);
    expect(data.recording.ships.filter(ship => ship.ground)).toHaveLength(6);
  });

  it('serves the frozen recording to both sides, with the viewer side and no private IDs in the data', async () => {
    const input = await saved();
    for (const [reader, side] of [[0, 'ATTACK'], [1, 'DEFENCE']] as const) {
      const response = await replay(input.source.id, reader);
      expect(response.statusCode).toBe(200);
      const body = response.json<{ viewer: string; ownPlayerIds: string[]; replay: BattleReplayData }>();
      expect(body.ownPlayerIds).toEqual([`${side}:P1`]);
      expect(body.viewer).toBe(side); expect(body.replay.recording.rounds.length).toBeGreaterThan(0);
      expect(JSON.stringify(body.replay)).not.toContain(f.playerIds[0]!);
      expect(JSON.stringify(body.replay)).not.toContain('secret-wave');
      expect(await statusFor(reader, input.source.id)).toBe('AVAILABLE');
    }
    const listing = await app.inject({ method: 'GET', url: '/api/reports', headers: await auth(0) });
    expect(listing.body).not.toContain('"recording"');
    expect(listing.body).not.toContain('"owners"');
  });

  it('enforces the half-power rule on the server while the defender can still watch', async () => {
    const input = await saved(1, 4);
    expect(await statusFor(0, input.source.id)).toBe('INSUFFICIENT_FORCE');
    expect(await statusFor(1, input.source.id)).toBe('AVAILABLE');
    const denied = await replay(input.source.id, 0);
    expect(denied.statusCode).toBe(403); expect(denied.body).not.toContain('"recording"');
    expect((await replay(input.source.id, 1)).statusCode).toBe(200);
  });

  it('requires authentication and participation and does not reveal whether another report exists', async () => {
    const input = await saved();
    expect((await app.inject({ method: 'GET', url: `/api/reports/BATTLE/${input.source.id}/replay` })).statusCode).toBe(401);
    const stranger = await replay(input.source.id, 2), nonexistent = await replay(randomUUID(), 2);
    expect(stranger.statusCode).toBe(404); expect(nonexistent.statusCode).toBe(404);
    expect(stranger.json<{ error: string }>().error).toBe(nonexistent.json<{ error: string }>().error);
  });

  it('does not invent a recording for an older report', async () => {
    const input = await saved(2, 4, false);
    expect(await statusFor(0, input.source.id)).toBe('NOT_RECORDED');
    expect((await replay(input.source.id, 0)).statusCode).toBe(404);
  });

  it('is atomic and cascade-deletes the recording with the report', async () => {
    const before = await f.db.select().from(battleReports);
    await expect(f.db.transaction(async tx => { await makeReport(tx); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect(await f.db.select().from(battleReports)).toHaveLength(before.length);
    expect(await f.db.select().from(battleReplays)).toHaveLength(0);
    const input = await saved();
    await f.db.delete(battleReports).where(eq(battleReports.id, input.source.id));
    expect(await f.db.select().from(battleReplays)).toHaveLength(0);
  });

  it('rejects a participant in a different season and explains a bounded recording without serving fragments', async () => {
    const input = await saved(2, 4, false);
    await expect(readBattleReplay(f.db, { playerId: f.playerIds[0]!, seasonId: randomUUID() }, input.source)).rejects.toMatchObject({ status: 404 });
    await f.db.transaction(tx => persistBattleReplay(tx, { ...input, capture: { ...input.capture, recording: undefined, reason: 'TOO_LARGE' } }));
    expect(await statusFor(1, input.source.id)).toBe('TOO_LARGE');
    const response = await replay(input.source.id, 1);
    expect(response.statusCode).toBe(409); expect(response.body).not.toContain('recording');
  });

  it('never overwrites a frozen replay on repeated delivery', async () => {
    const input = await saved();
    const first = (await replay(input.source.id, 0)).body;
    input.capture.attackerVisible = false;
    await f.db.transaction(tx => persistBattleReplay(tx, input));
    expect((await replay(input.source.id, 0)).body).toBe(first);
    expect(await f.db.select().from(battleReplays)).toHaveLength(1);
  });
});
