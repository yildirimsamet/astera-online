import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CLAN } from '@astera/rules';
import { arenaAdmirals, arenaShips, arenaTeamMembers, clanMemberships, clans, notifications, planets, seasons } from '../src/db/schema.js';
import { chooseShip, endSortie, launchSortie, readHangar, recallOpenSorties } from '../src/services/arenaShips.js';
import { createTeam, joinTeam, leaveTeam, readTeam, readyTeam, startTeam, claimTeamLoot, housekeepArenaTeams, spectateTeam } from '../src/services/arenaTeams.js';
import { GameError, lockSeason } from '../src/services/planet.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let clanId: string;
const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const shareNews = () => f.db.select().from(notifications).where(eq(notifications.kind, 'arena_team_share'));
const end = { fuel: 100, ammo: 100, pilotKills: 0, assists: 0 };
const account = (n: number): string => f.accountIds[n]!;
const player = (n: number): string => f.playerIds[n]!;
const code = async (job: Promise<unknown>): Promise<string> => {
  try { await job; return 'ok'; } catch (error) { if (error instanceof GameError) return error.code; throw error; }
};
async function team() {
  const view = await createTeam(f.db, f.clock, account(0));
  if (!view.team) throw new Error('no team');
  return view.team.id;
}
async function ready(id: string, n: number) { return readyTeam(f.db, f.clock, account(n), { teamId: id, ready: true, tactic: 'radar' }); }
async function pair() {
  const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await ready(id, 0); await ready(id, 1);
  await startTeam(f.db, f.clock, account(0), id);
  return { id, a: await launchSortie(f.db, f.clock, account(0)), b: await launchSortie(f.db, f.clock, account(1)) };
}
async function stock(n: number) {
  const [row] = await f.db.select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[n]!));
  if (!row) throw new Error('no planet'); return row;
}

beforeEach(async () => {
  f = await seedWorld(4, 7324);
  for (let n = 0; n < 4; n++) {
    await setLevel(f.db, f.planetIds[n]!, 'CORE', 9);
    await f.db.update(planets).set({ alloy: 1000, crystal: 1000, deuterium: 500 }).where(eq(planets.id, f.planetIds[n]!));
    await chooseShip(f.db, f.clock, account(n), 'kilavuz');
  }
  const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Yarık Ekibi', nameKey: 'yarik ekibi', tag: 'YRK', createdAt: f.clock.now() }).returning();
  if (!clan) throw new Error('no clan'); clanId = clan.id;
  await f.db.insert(clanMemberships).values([0, 1, 2].map(n => ({ seasonId: f.seasonId, clanId, playerId: player(n), role: n === 0 ? 'LEADER' as const : 'MEMBER' as const,
    slot: n, joinedAt: f.clock.now(), matureAt: f.clock.now(), aidPolicyChangedAt: f.clock.now() })));
});
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('Y7 team lobby', () => {
  it('does not invert the galaxy’s planet-before-clan locks during a joint launch', async () => {
    const id = await team(); await ready(id, 0);
    let proceed: () => void = () => undefined; let locked: () => void = () => undefined;
    const gate = new Promise<void>(resolve => { proceed = resolve; }); const entered = new Promise<void>(resolve => { locked = resolve; });
    const galaxy = f.db.transaction(async tx => {
      await lockSeason(tx, f.seasonId);
      await tx.select().from(planets).where(eq(planets.id, f.planetIds[0]!)).for('update');
      locked(); await gate;
      await tx.select().from(clans).where(eq(clans.id, clanId)).for('update');
    });
    await entered; const launch = startTeam(f.db, f.clock, account(0), id);
    await new Promise(resolve => setTimeout(resolve, 60)); proceed();
    const [, started] = await Promise.all([galaxy, launch]); expect(started.team?.state).toBe('flying');
  });
  it('takes the season lock before crash recall can close a shared flight', async () => {
    await pair();
    let release: () => void = () => undefined; let locked: () => void = () => undefined;
    const gate = new Promise<void>(resolve => { release = resolve; }); const entered = new Promise<void>(resolve => { locked = resolve; });
    const freeze = f.db.transaction(async tx => { await tx.select().from(seasons).where(eq(seasons.id, f.seasonId)).for('update'); locked(); await gate; });
    await entered;
    let recalled = false; const recall = recallOpenSorties(f.db, f.clock).then(() => { recalled = true; });
    try { await new Promise(resolve => setTimeout(resolve, 60)); expect(recalled).toBe(false); }
    finally { release(); await freeze; await recall; }
  });
  it('releases a departed forming member before a solo launch while keeping the other lobby members', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id);
    await f.db.update(clanMemberships).set({ leftAt: f.clock.now() }).where(eq(clanMemberships.playerId, player(1)));
    expect(await code(launchSortie(f.db, f.clock, account(1)))).toBe('ok');
    expect((await readTeam(f.db, f.clock, account(0))).team?.members.map(m => m.playerId)).toEqual([player(0)]);
  });
  it('drops a disbanded forming lobby from the former leader’s desk', async () => {
    await team(); await f.db.update(clans).set({ disbandedAt: f.clock.now() }).where(eq(clans.id, clanId));
    expect((await readTeam(f.db, f.clock, account(0))).team).toBeNull();
  });
  it('requires the current clan leader to join the launch roster after a leadership transfer', async () => {
    const id = await team(); await ready(id, 0);
    await f.db.update(clanMemberships).set({ role: 'MEMBER' }).where(eq(clanMemberships.playerId, player(0)));
    await f.db.update(clanMemberships).set({ role: 'LEADER' }).where(eq(clanMemberships.playerId, player(2)));
    expect(await code(startTeam(f.db, f.clock, account(2), id))).toBe('TEAM_NOT_JOINED');
    expect((await f.db.select().from(arenaShips)).every(s => s.sortieId === null)).toBe(true);
    await joinTeam(f.db, f.clock, account(2), id); await ready(id, 2);
    expect((await startTeam(f.db, f.clock, account(2), id)).team?.state).toBe('flying');
  });
  it('is clan-private, uses clan capacity, lets only the leader create, and joins/leaves once', async () => {
    expect(await code(createTeam(f.db, f.clock, account(1)))).toBe('TEAM_LEADER_ONLY');
    const id = await team();
    expect((await readTeam(f.db, f.clock, account(0))).capacity).toBe(CLAN.maxMembers);
    expect((await readTeam(f.db, f.clock, account(1))).team?.id).toBe(id);
    expect((await readTeam(f.db, f.clock, account(3))).team).toBeNull();
    expect(await code(joinTeam(f.db, f.clock, account(3), id))).toBe('NO_CLAN');
    await Promise.all([joinTeam(f.db, f.clock, account(1), id), joinTeam(f.db, f.clock, account(1), id)]);
    expect((await readTeam(f.db, f.clock, account(0))).team?.members).toHaveLength(2);
    await leaveTeam(f.db, f.clock, account(1), id);
    expect((await readTeam(f.db, f.clock, account(0))).team?.members).toHaveLength(1);
  });

  it('refuses an unready ship, resets readiness after a ship change, and launches only under current leadership', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id);
    expect(await code(startTeam(f.db, f.clock, account(0), id))).toBe('TEAM_NOT_READY');
    await f.db.update(arenaShips).set({ readyReason: 'repair', readyAt: new Date(f.clock.now().getTime() + 60000) }).where(eq(arenaShips.playerId, player(1)));
    expect(await code(ready(id, 1))).toBe('SHIP_NOT_READY');
    await f.db.update(arenaShips).set({ readyReason: null, readyAt: null }).where(eq(arenaShips.playerId, player(1)));
    await ready(id, 0); await ready(id, 1);
    await f.db.update(arenaShips).set({ level: 2 }).where(eq(arenaShips.playerId, player(1)));
    expect((await readTeam(f.db, f.clock, account(0))).team?.members.find(m => m.playerId === player(1))?.ready).toBe(false);
    expect(await code(startTeam(f.db, f.clock, account(0), id))).toBe('TEAM_NOT_READY');
    expect(await code(startTeam(f.db, f.clock, account(1), id))).toBe('TEAM_LEADER_ONLY');
  });

  // Codex review CR3: an escorting ship was counted ready and the joint launch failed at the last step.
  it('never counts a ship that escorts a fleet as ready', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await ready(id, 1);
    const [task] = await f.db.insert(arenaAdmirals).values({ playerId: player(1), seasonId: f.seasonId, ship: 'kilavuz', level: 1, createdAt: f.clock.now() }).returning();
    await f.db.update(arenaShips).set({ admiralId: task!.id }).where(eq(arenaShips.playerId, player(1)));
    const member = (await readTeam(f.db, f.clock, account(0))).team?.members.find(m => m.playerId === player(1));
    expect(member).toMatchObject({ blocked: 'ADMIRAL_AWAY', ready: false });
    expect(await code(ready(id, 1))).toBe('ADMIRAL_AWAY');
  });

  it('rolls every charge and ship back if one member can no longer afford the launch; a repeated launch charges once', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id);
    await f.db.update(arenaShips).set({ fuel: 0, ammo: 0 });
    await ready(id, 0); await ready(id, 1);
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, f.planetIds[1]!));
    const before = await stock(0);
    expect(await code(startTeam(f.db, f.clock, account(0), id))).toBe('NOT_ENOUGH_DEUTERIUM');
    expect(await stock(0)).toEqual(before);
    expect((await f.db.select().from(arenaShips)).every(s => s.sortieId === null)).toBe(true);
    await f.db.update(planets).set({ deuterium: 500 }).where(eq(planets.id, f.planetIds[1]!));
    await Promise.all([startTeam(f.db, f.clock, account(0), id), startTeam(f.db, f.clock, account(0), id)]);
    expect((await stock(0)).deuterium).toBe(438);
    const first = await launchSortie(f.db, f.clock, account(0));
    expect((await launchSortie(f.db, f.clock, account(0))).sortieId).toBe(first.sortieId);
    expect((await stock(0)).deuterium).toBe(438);
  });

  it('puts extracted cargo in one durable pool, includes the dead member and claims a share only once', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await ready(id, 0); await ready(id, 1);
    await startTeam(f.db, f.clock, account(0), id);
    const a = await launchSortie(f.db, f.clock, account(0)); const b = await launchSortie(f.db, f.clock, account(1));
    const report = await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [300, 120, 6] });
    expect(report?.deposit).toEqual(zero); expect((await stock(0)).alloy).toBe(1000);
    expect(await code(claimTeamLoot(f.db, f.clock, account(0), id))).toBe('TEAM_UNFINISHED');
    expect(await code(launchSortie(f.db, f.clock, account(0)))).toBe('TEAM_IN_FLIGHT');
    await f.db.update(clanMemberships).set({ leftAt: f.clock.now() }).where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.playerId, player(1))));
    await endSortie(f.db, f.clock, account(1), b.sortieId, { ...end, outcome: 'dead', hold: [100, 0, 0] });
    expect(await endSortie(f.db, f.clock, account(1), b.sortieId, { ...end, outcome: 'extracted', hold: [999, 0, 0] })).toBeNull();
    await Promise.all([claimTeamLoot(f.db, f.clock, account(0), id), claimTeamLoot(f.db, f.clock, account(0), id)]);
    expect((await stock(0)).alloy).toBe(1150);
    await claimTeamLoot(f.db, f.clock, account(1), id);
    expect((await stock(1)).alloy).toBe(1150);
    expect(await code(claimTeamLoot(f.db, f.clock, account(3), id))).toBe('TEAM_SHARE_NOT_FOUND');
  });

  it('tells each member with a share, once, when the last flight ends, and nobody whose share is empty', async () => {
    const { id, a, b } = await pair();
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [300, 120, 6] });
    expect(await shareNews()).toHaveLength(0);
    await endSortie(f.db, f.clock, account(1), b.sortieId, { ...end, outcome: 'dead', hold: [100, 0, 0] });
    const news = await shareNews();
    expect(news.map(n => n.playerId).sort()).toEqual([player(0), player(1)].sort());
    expect(news.every(n => n.refId === id)).toBe(true);
    expect(news.find(n => n.playerId === player(0))?.payload).toEqual({ teamId: id, share: { alloy: 150, crystal: 60, deuterium: 3 } });
    await claimTeamLoot(f.db, f.clock, account(0), id); await claimTeamLoot(f.db, f.clock, account(1), id);
    await f.db.update(arenaShips).set({ readyAt: null, readyReason: null });
    const empty = await pair();
    await endSortie(f.db, f.clock, account(0), empty.a.sortieId, { ...end, outcome: 'dead', hold: [50, 0, 0] });
    await endSortie(f.db, f.clock, account(1), empty.b.sortieId, { ...end, outcome: 'towed', hold: [0, 0, 0] });
    expect(await shareNews()).toHaveLength(2);
  });

  it('keeps an extracted pool through a process recall and closes the other reserved flights', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await ready(id, 0); await ready(id, 1);
    await startTeam(f.db, f.clock, account(0), id);
    const a = await launchSortie(f.db, f.clock, account(0));
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [200, 0, 0] });
    await recallOpenSorties(f.db, f.clock);
    await claimTeamLoot(f.db, f.clock, account(1), id);
    expect((await stock(1)).alloy).toBe(1100);
  });

  it('treats a one-member team as a solo exit, with no delayed claim or extra deposit', async () => {
    const id = await team(); await ready(id, 0); await startTeam(f.db, f.clock, account(0), id);
    const a = await launchSortie(f.db, f.clock, account(0));
    expect(a.teamId).toBeUndefined();
    const report = await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [123, 0, 0] });
    expect(report?.deposit.alloy).toBe(123); expect(report?.teamId).toBeUndefined();
    expect((await readTeam(f.db, f.clock, account(0))).claims).toHaveLength(0);
    await claimTeamLoot(f.db, f.clock, account(0), id);
    expect((await stock(0)).alloy).toBe(1123);
  });

  it('uses the same daily transfer cap for a team share and a later solo extraction', async () => {
    const { id, a, b } = await pair(); const cap = (await readHangar(f.db, f.clock, account(0))).cap.alloy;
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [2 * cap + 100, 0, 0] });
    await endSortie(f.db, f.clock, account(1), b.sortieId, { ...end, outcome: 'dead', hold: [] });
    const claimed = await claimTeamLoot(f.db, f.clock, account(0), id);
    expect(claimed.receipt).toMatchObject({ deposit: { alloy: cap }, overflow: { alloy: 50 } });
    f.clock.advance(10);
    const solo = await launchSortie(f.db, f.clock, account(0));
    const report = await endSortie(f.db, f.clock, account(0), solo.sortieId, { ...end, outcome: 'extracted', hold: [1, 0, 0] });
    expect(report).toMatchObject({ deposit: zero, overflow: { alloy: 1 } });
  });

  it('lets an ended member observe without relaunching and recalls an unconnected reservation after thirty seconds', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await ready(id, 0); await ready(id, 1); await startTeam(f.db, f.clock, account(0), id);
    const a = await launchSortie(f.db, f.clock, account(0));
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [200, 0, 0] });
    expect(await spectateTeam(f.db, f.clock, account(0))).toMatchObject({ sortieId: a.sortieId, spectating: 'extracted' });
    f.clock.advance(0.49); await housekeepArenaTeams(f.db, f.clock);
    expect(await code(claimTeamLoot(f.db, f.clock, account(0), id))).toBe('TEAM_UNFINISHED');
    f.clock.advance(0.01); await housekeepArenaTeams(f.db, f.clock);
    expect((await claimTeamLoot(f.db, f.clock, account(0), id)).receipt?.deposit.alloy).toBe(100);
    expect(await code(spectateTeam(f.db, f.clock, account(0)))).toBe('TEAM_NOT_SPECTATING');
  });

  // Codex review CR4: a member past the window was still handed the reservation, at another entrance.
  it('turns away a teammate who comes after the thirty-second window and brings the ship home at once', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await ready(id, 0); await ready(id, 1); await startTeam(f.db, f.clock, account(0), id);
    await launchSortie(f.db, f.clock, account(0));
    f.clock.advance(0.51);
    expect(await code(launchSortie(f.db, f.clock, account(1)))).toBe('TEAM_CONNECT_EXPIRED');
    expect((await readHangar(f.db, f.clock, account(1))).ship?.flying).toBe(false);
    expect((await readTeam(f.db, f.clock, account(1))).team?.members.find(m => m.playerId === player(1))?.outcome).toBe('recalled');
  });

  it('automatically claims an untouched share at seven days, exactly once', async () => {
    const { id, a, b } = await pair();
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [200, 0, 0] });
    await endSortie(f.db, f.clock, account(1), b.sortieId, { ...end, outcome: 'dead', hold: [] });
    f.clock.advance(7 * 1440 - 1); await housekeepArenaTeams(f.db, f.clock);
    expect((await readTeam(f.db, f.clock, account(0))).claims).toHaveLength(1);
    f.clock.advance(1); await housekeepArenaTeams(f.db, f.clock);
    const members = await f.db.select().from(arenaTeamMembers).where(eq(arenaTeamMembers.teamId, id));
    expect(members.every(m => m.claimedAt !== null && m.receipt?.deposit.alloy === 100)).toBe(true);
    const after = await stock(0); await housekeepArenaTeams(f.db, f.clock); expect(await stock(0)).toEqual(after);
  });

  it('auto-claims past a member who left the lobby before launch: that row has no share and stops nothing', async () => {
    const id = await team(); await joinTeam(f.db, f.clock, account(1), id); await joinTeam(f.db, f.clock, account(2), id);
    await leaveTeam(f.db, f.clock, account(2), id);
    await ready(id, 0); await ready(id, 1); await startTeam(f.db, f.clock, account(0), id);
    const a = await launchSortie(f.db, f.clock, account(0)); const b = await launchSortie(f.db, f.clock, account(1));
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [200, 0, 0] });
    await endSortie(f.db, f.clock, account(1), b.sortieId, { ...end, outcome: 'dead', hold: [] });
    f.clock.advance(7 * 1440);
    await housekeepArenaTeams(f.db, f.clock);
    expect([(await stock(0)).alloy, (await stock(1)).alloy]).toEqual([1100, 1100]);
  });

  it('lands durable shares before the real season freeze and refuses new team commitments afterward', async () => {
    const { id, a } = await pair();
    await endSortie(f.db, f.clock, account(0), a.sortieId, { ...end, outcome: 'extracted', hold: [200, 0, 0] });
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const members = await f.db.select().from(arenaTeamMembers).where(eq(arenaTeamMembers.teamId, id));
    expect(members.every(m => m.claimedAt !== null && m.receipt?.deposit.alloy === 100)).toBe(true);
    // The share is already deposited: no news asks the members to claim it.
    expect(await shareNews()).toHaveLength(0);
    expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]?.status).toBe('frozen');
    expect(await code(createTeam(f.db, f.clock, account(0)))).toBe('SEASON_FROZEN');
  });
});
