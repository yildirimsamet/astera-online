import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { notifications, planets } from '../src/db/schema.js';
import { clanActor, disbandClan, kickClanMember, leaveClan, readClanPresence } from '../src/services/clan.js';
import { setDefencePosture } from '../src/services/clanSupport.js';
import { planetView } from '../src/services/planetView.js';
import { pino } from 'pino';
import { EventBus } from '../src/stream/bus.js';
import { TEST_DATABASE_URL, testDb, type Fixture } from './helpers.js';
import { formClan, namesOf, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the defence posture (`docs/clan-defense-support-plan.md`, P5).
 */

afterAll(async () => { await (await testDb()).close(); });

const post = (
  f: Fixture,
  player: number,
  toggles: { escape: boolean; support: boolean },
  planet = player,
) => f.db.transaction((tx) => setDefencePosture(tx, {
  planetId: f.planetIds[planet]!,
  playerId: f.playerIds[player]!,
  toggles,
  clock: f.clock,
}));

const stored = async (f: Fixture, planet: number) => {
  const [row] = await f.db.select({ posture: planets.defencePosture })
    .from(planets).where(eq(planets.id, f.planetIds[planet]!));
  return row!.posture;
};

const viewOf = (f: Fixture, planet: number) =>
  f.db.transaction((tx) => planetView(tx, f.planetIds[planet]!, f.clock));

describe('the posture is the season’s rule from ruleset 15 only', () => {
  it('refuses any change in a season dealt before clan defence', async () => {
    const f = await supportWorld(2, 15_101, 14);
    await expect(post(f, 0, { escape: false, support: false })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_UNAVAILABLE' });
    expect((await viewOf(f, 0)).defencePosture).toBeNull();
  });
});

describe('the two toggles', () => {
  it('opens every world on the retreat, with support locked outside a clan', async () => {
    const f = await supportWorld(2, 15_102);
    expect((await viewOf(f, 0)).defencePosture).toEqual({
      posture: 'ESCAPE',
      escape: true,
      support: false,
      supportLocked: 'NOT_IN_CLAN',
    });
  });

  it('refuses both on at once — the one state the rule forbids', async () => {
    const f = await supportWorld(2, 15_103);
    await formClan(f, 0, [1]);
    await expect(post(f, 0, { escape: true, support: true })).rejects.toMatchObject({ code: 'POSTURE_CONFLICT' });
    expect(await stored(f, 0)).toBe('ESCAPE');
  });

  it('refuses support to a commander with no clan, and lets them hold', async () => {
    const f = await supportWorld(2, 15_104);
    await expect(post(f, 0, { escape: false, support: true })).rejects.toMatchObject({ code: 'NOT_IN_CLAN' });
    const held = await post(f, 0, { escape: false, support: false });
    expect(held.planet.defencePosture).toMatchObject({ posture: 'HOLD', escape: false, support: false });
    expect(await stored(f, 0)).toBe('HOLD');
  });

  it('opens support for a member — even one still adapting — and closes the retreat with it', async () => {
    const f = await supportWorld(2, 15_105);
    await formClan(f, 0, [1], { matured: false });
    const result = await post(f, 1, { escape: false, support: true });
    expect(result.returnedWaves).toBe(0);
    expect(result.planet.defencePosture).toEqual({
      posture: 'SUPPORT',
      escape: false,
      support: true,
      supportLocked: null,
    });
    expect(await stored(f, 1)).toBe('SUPPORT');
    // And back to the retreat.
    await post(f, 1, { escape: true, support: false });
    expect(await stored(f, 1)).toBe('ESCAPE');
  });

  it('refuses a world the caller does not hold', async () => {
    const f = await supportWorld(2, 15_106);
    await expect(post(f, 0, { escape: false, support: false }, 1)).rejects.toThrow();
    expect(await stored(f, 1)).toBe('ESCAPE');
  });
});

describe('leaving the clan drops a supporting world back to the retreat', () => {
  const resets = (f: Fixture, player: number) => f.db.select().from(notifications).where(and(
    eq(notifications.playerId, f.playerIds[player]!),
    eq(notifications.kind, 'defence_posture_reset'),
  ));

  it('on leave — a HOLD world stays held, a SUPPORT world returns to ESCAPE', async () => {
    const f = await supportWorld(3, 15_107);
    await formClan(f, 0, [1]);
    await post(f, 1, { escape: false, support: true });
    await f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[1]!), now: f.clock.now() }));
    expect(await stored(f, 1)).toBe('ESCAPE');
    const told = await resets(f, 1);
    expect(told).toHaveLength(1);
    expect(told[0]!.payload).toMatchObject({ planetIds: [f.planetIds[1]!], planetNames: [(await namesOf(f, 1)).world] });
  });

  it('leaves a HOLD world alone and tells nobody', async () => {
    const f = await supportWorld(3, 15_108);
    await formClan(f, 0, [1]);
    await post(f, 1, { escape: false, support: false });
    await f.db.transaction(async (tx) => leaveClan(tx, { actor: await clanActor(tx, f.accountIds[1]!), now: f.clock.now() }));
    expect(await stored(f, 1)).toBe('HOLD');
    expect(await resets(f, 1)).toHaveLength(0);
  });

  it('on a kick', async () => {
    const f = await supportWorld(3, 15_109);
    await formClan(f, 0, [1, 2]);
    await post(f, 2, { escape: false, support: true });
    await post(f, 1, { escape: false, support: true });
    await f.db.transaction(async (tx) => kickClanMember(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      playerId: f.playerIds[2]!,
      now: f.clock.now(),
    }));
    expect(await stored(f, 2)).toBe('ESCAPE');
    expect(await stored(f, 1)).toBe('SUPPORT');
  });

  it('on a disband, for every member', async () => {
    const f = await supportWorld(3, 15_110);
    await formClan(f, 0, [1, 2]);
    for (const player of [0, 1, 2]) await post(f, player, { escape: false, support: true });
    await f.db.transaction(async (tx) => disbandClan(tx, {
      actor: await clanActor(tx, f.accountIds[0]!),
      now: f.clock.now(),
      acknowledgeTreasuryBurn: true,
    }));
    for (const player of [0, 1, 2]) expect(await stored(f, player)).toBe('ESCAPE');
  });
});

/*
  WHETHER A CLANMATE'S WORLD TAKES SUPPORT, READ BEFORE ANYONE PICKS A SHIP. The send sheet
  used to learn it only from the quote, after the ships were chosen. The posture is no secret
  inside the clan — an enemy probe reads it exactly — so the presence that already names the
  clanmates' worlds says which of them are open.
*/
describe('the clan presence', () => {
  it('says which clanmate worlds take clan support', async () => {
    const f = await supportWorld(3, 15_108);
    await formClan(f, 0, [1, 2]);
    await post(f, 1, { escape: false, support: true });
    const presence = await readClanPresence(f.db, f.playerIds[2]!);
    const worlds = new Map(presence!.members.flatMap((member) => member.worlds.map((world) => [world.planetId, world])));
    expect(worlds.get(f.planetIds[1]!)!.supportOpen).toBe(true);
    expect(worlds.get(f.planetIds[0]!)!.supportOpen).toBe(false);
  });

  it('tells every clanmate when a world opens or closes its door, and nobody else', async () => {
    const f = await supportWorld(4, 15_109);
    await formClan(f, 0, [1, 2]);
    const bus = new EventBus(TEST_DATABASE_URL, pino({ level: 'silent' }));
    await bus.start();
    const heard = new Map<number, string[]>([[0, []], [2, []], [3, []]]);
    const stops = [...heard.keys()].map((index) =>
      bus.subscribe(f.playerIds[index]!, (event) => heard.get(index)!.push(event.kind)));
    try {
      await post(f, 1, { escape: false, support: true });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(heard.get(0)).toContain('private:clan-posture');
      expect(heard.get(2)).toContain('private:clan-posture');
      expect(heard.get(3)).not.toContain('private:clan-posture');
      // Closing it again is news too; switching between the two closed postures is not.
      heard.get(2)!.length = 0;
      await post(f, 1, { escape: true, support: false });
      await post(f, 1, { escape: false, support: false });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(heard.get(2)!.filter((kind) => kind === 'private:clan-posture')).toHaveLength(1);
    } finally {
      for (const stop of stops) stop();
      await bus.stop();
    }
  });
});
