import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../../src/app.js';
import { TokenService } from '../../src/auth/tokens.js';
import { arenaPilots, arenaShips, arenaTeams, clanMemberships, clans, planets } from '../../src/db/schema.js';
import { createTeam, readyTeam, startTeam } from '../../src/services/arenaTeams.js';
import { chooseShip, endSortie, launchSortie } from '../../src/services/arenaShips.js';
import { hangarSchema } from '../../../web/src/arena/hangarDesk.js';
import { teamSchema } from '../../../web/src/arena/teamDesk.js';
import { seedWorld, setLevel, testDb, testEnv } from '../helpers.js';

/** Real routes and DB answers must parse through the client's own boundary, including the new ranks. */
let built: BuiltApp | undefined;
afterEach(async () => { await built?.close(); built = undefined; });
afterAll(async () => { const { close } = await testDb(); await close(); });
describe('Yarık hangar contract', () => {
  it('uses the application clock for startup recall and leaves no empty solo share to claim', async () => {
    const f = await seedWorld(1, 7624); const account = f.accountIds[0]!;
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9); await chooseShip(f.db, f.clock, account, 'kilavuz');
    await f.db.insert(arenaPilots).values({ accountId: account, grantedAt: f.clock.now() });
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Solo Takım', nameKey: 'solo takim', tag: 'SLT', createdAt: f.clock.now() }).returning();
    if (!clan) throw new Error('no clan');
    await f.db.insert(clanMemberships).values({ clanId: clan.id, seasonId: f.seasonId, playerId: f.playerIds[0]!, role: 'LEADER', slot: 0,
      joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() });
    const view = await createTeam(f.db, f.clock, account); if (!view.team) throw new Error('no team');
    await readyTeam(f.db, f.clock, account, { teamId: view.team.id, ready: true, tactic: 'radar' });
    await startTeam(f.db, f.clock, account, view.team.id);
    built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ROLE: 'arena', ARENA_ENABLED: 'true' }) });
    await built.app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const answer = await built.app.inject({ method: 'GET', url: '/arena/team', headers: { authorization: `Bearer ${await tokens.issueAccess(account)}` } });
    expect(teamSchema.parse(answer.json()).claims).toEqual([]);
    const [match] = await f.db.select().from(arenaTeams).where(eq(arenaTeams.id, view.team.id));
    expect(match?.finishedAt).toEqual(f.clock.now());
  });
  it('authorises the team routes, rejects forged bodies and serves a shared match through the real client schema', async () => {
    const f = await seedWorld(3, 7424);
    for (let i = 0; i < 3; i++) {
      await setLevel(f.db, f.planetIds[i]!, 'CORE', 9);
      await chooseShip(f.db, f.clock, f.accountIds[i]!, 'kilavuz');
    }
    await f.db.insert(arenaPilots).values(f.accountIds.slice(0, 2).map(accountId => ({ accountId, grantedAt: f.clock.now() })));
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Yarık Takım', nameKey: 'yarik takim', tag: 'YRK', createdAt: f.clock.now() }).returning();
    if (!clan) throw new Error('no clan');
    await f.db.insert(clanMemberships).values([0, 1].map(i => ({ clanId: clan.id, seasonId: f.seasonId, playerId: f.playerIds[i]!, role: i === 0 ? 'LEADER' as const : 'MEMBER' as const,
      slot: i, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() })));
    built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ROLE: 'arena', ARENA_ENABLED: 'true' }) });
    await built.app.ready();
    const app = built.app; const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const headers = await Promise.all(f.accountIds.map(async a => ({ authorization: `Bearer ${await tokens.issueAccess(a)}` })));
    expect((await app.inject({ method: 'GET', url: '/arena/team' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/arena/team', headers: headers[2] })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/arena/team/create', headers: headers[0], payload: { clanId: clan.id } })).statusCode).toBe(400);
    const created = await app.inject({ method: 'POST', url: '/arena/team/create', headers: headers[0], payload: {} });
    expect(created.statusCode).toBe(200);
    const id = teamSchema.parse(created.json()).team?.id; if (!id) throw new Error('no team');
    expect((await app.inject({ method: 'POST', url: '/arena/team/join', headers: headers[1], payload: { teamId: id } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/arena/team/ready', headers: headers[0], payload: { teamId: id, ready: true, tactic: 'smoke', rank: 5 } })).statusCode).toBe(400);
    for (const h of headers.slice(0, 2)) expect((await app.inject({ method: 'POST', url: '/arena/team/ready', headers: h, payload: { teamId: id, ready: true, tactic: 'radar' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/arena/team/start', headers: headers[1], payload: { teamId: id } })).statusCode).toBe(403);
    const started = await app.inject({ method: 'POST', url: '/arena/team/start', headers: headers[0], payload: { teamId: id } });
    expect(started.statusCode).toBe(200); expect(teamSchema.parse(started.json()).team?.state).toBe('flying');
    const a = await launchSortie(f.db, f.clock, f.accountIds[0]!); const b = await launchSortie(f.db, f.clock, f.accountIds[1]!);
    await endSortie(f.db, f.clock, f.accountIds[0]!, a.sortieId, { outcome: 'extracted', fuel: 100, ammo: 100, hold: [200, 0, 0], pilotKills: 0, assists: 0 });
    await endSortie(f.db, f.clock, f.accountIds[1]!, b.sortieId, { outcome: 'dead', fuel: 100, ammo: 100, hold: [], pilotKills: 0, assists: 0 });
    const claim = await app.inject({ method: 'POST', url: '/arena/team/claim', headers: headers[0], payload: { teamId: id } });
    expect(claim.statusCode).toBe(200); expect(teamSchema.parse(claim.json()).receipt?.deposit.alloy).toBe(100);
  });
  it('reads separate ranks, spends a point and buys a shorter repair through the real authenticated routes', async () => {
    const f = await seedWorld(2, 7124);
    const account = f.accountIds[0]!; const capital = f.planetIds[0]!;
    await setLevel(f.db, capital, 'CORE', 9);
    await f.db.update(planets).set({ alloy: 1000, crystal: 1000, deuterium: 500 }).where(eq(planets.id, capital));
    await f.db.insert(arenaPilots).values({ accountId: account, grantedAt: f.clock.now() });
    await chooseShip(f.db, f.clock, account, 'kilavuz');
    await f.db.update(arenaShips).set({ level: 3 }).where(eq(arenaShips.playerId, f.playerIds[0]!));
    built = buildApp({ db: f.db, clock: f.clock, logger: pino({ level: 'silent' }), env: testEnv({ ROLE: 'arena', ARENA_ENABLED: 'true' }) });
    await built.app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const headers = { authorization: `Bearer ${await tokens.issueAccess(account)}` };
    const rank = await built.app.inject({ method: 'POST', url: '/arena/ability', headers, payload: { ability: 'smoke' } });
    expect(rank.statusCode).toBe(200);
    expect(hangarSchema.parse(rank.json()).ship?.abilities).toEqual({ smoke: 1 });
    const flight = await launchSortie(f.db, f.clock, account);
    await endSortie(f.db, f.clock, account, flight.sortieId, { outcome: 'dead', fuel: 0, ammo: 0, hold: [0, 0, 0], pilotKills: 0, assists: 0 });
    const repair = await built.app.inject({ method: 'POST', url: '/arena/repair', headers, payload: {} });
    expect(repair.statusCode).toBe(200);
    const view = hangarSchema.parse(repair.json());
    expect(view.ship).toMatchObject({ readyReason: 'repair', abilities: { smoke: 1 } });
    expect(Date.parse(view.ship?.readyAt ?? '') - f.clock.now().getTime()).toBe(17 * 60_000);
    const again = await built.app.inject({ method: 'POST', url: '/arena/repair', headers, payload: {} });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: 'REPAIR_NOT_SHORTER' });
  });
});
