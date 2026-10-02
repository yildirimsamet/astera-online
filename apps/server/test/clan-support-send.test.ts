import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CLAN_SUPPORT,
  distance,
  hangarCapacity,
  hangarLoad,
  supportFuel,
  type Fleet,
} from '@astera/rules';
import {
  clanSupportWaves,
  missions,
  notifications,
  planets,
  players,
  seasons,
  units,
} from '../src/db/schema.js';
import { quoteClanSupport, sendClanSupport, setDefencePosture } from '../src/services/clanSupport.js';
import { totalUnitsOf } from '../src/services/planet.js';
import { planetView } from '../src/services/planetView.js';
import { giveUnits, setLevel, testDb, type Fixture } from './helpers.js';
import { formClan, namesOf, supportWorld } from './clanSupportFixture.js';

/**
 * KLAN SAVUNMA DESTEĞİ — sending a wave (`docs/clan-defense-support-plan.md`, P6).
 *
 * Commanders: 0 leads, 1 and 2 are members, 3 stands outside the clan.
 */

afterAll(async () => { await (await testDb()).close(); });
const silent = pino({ level: 'silent' });

const open = (f: Fixture, host: number) => f.db.transaction((tx) => setDefencePosture(tx, {
  planetId: f.planetIds[host]!,
  playerId: f.playerIds[host]!,
  toggles: { escape: false, support: true },
  clock: f.clock,
}));

const input = (f: Fixture, sender: number, host: number, fleet: Fleet, origin = sender) => ({
  senderPlayerId: f.playerIds[sender]!,
  originPlanetId: f.planetIds[origin]!,
  hostPlanetId: f.planetIds[host]!,
  fleet,
  clock: f.clock,
});

const send = (f: Fixture, sender: number, host: number, fleet: Fleet, origin = sender) =>
  f.db.transaction((tx) => sendClanSupport(tx, input(f, sender, host, fleet, origin)));

const quote = (f: Fixture, sender: number, host: number, fleet: Fleet, origin = sender) =>
  quoteClanSupport(f.db, input(f, sender, host, fleet, origin));

async function ready(seed: number): Promise<Fixture> {
  const f = await supportWorld(4, seed);
  await formClan(f, 0, [1, 2]);
  await open(f, 1);
  return f;
}

describe('a wave in a season without clan defence', () => {
  it('is refused outright', async () => {
    const f = await supportWorld(3, 15_201, 14);
    await expect(send(f, 0, 1, { DART: 5 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_UNAVAILABLE' });
  });
});

describe('a clean send', () => {
  it('flies a mission, keeps the ships in the sender’s Hangar and pays the round trip once', async () => {
    const f = await ready(15_202);
    const fleet: Fleet = { DART: 20, COURIER: 2 };
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const [host] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const senderOwnedBefore = hangarLoad(await totalUnitsOf(f.db, f.planetIds[0]!));
    const hostOwnedBefore = hangarLoad(await totalUnitsOf(f.db, f.planetIds[1]!));

    const q = await quote(f, 0, 1, fleet);
    expect(q.refusals).toEqual([]);
    expect(q.fuel).toBe(supportFuel(fleet, distance(origin!, host!)));
    expect(q.hostRoom).toEqual({ used: 0, reserved: 0, total: hangarCapacity(6), after: hangarLoad(fleet) });

    const sent = await send(f, 0, 1, fleet);
    const [wave] = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, sent.wave.id));
    expect(wave).toMatchObject({
      status: 'OUTBOUND',
      senderPlayerId: f.playerIds[0],
      hostPlayerId: f.playerIds[1],
      originPlanetId: f.planetIds[0],
      hostPlanetId: f.planetIds[1],
      fleet,
      reservedBulk: hangarLoad(fleet),
      fuelPaid: q.fuel,
    });
    expect(wave!.unitLocation.startsWith('support:')).toBe(true);

    const [mission] = await f.db.select().from(missions).where(eq(missions.id, wave!.outboundMissionId));
    expect(mission).toMatchObject({ kind: 'clan_support', status: 'in_flight', fuelPaid: q.fuel });

    // The ships sit under the origin, in the wave's own location, still the sender's.
    const parked = await f.db.select().from(units).where(eq(units.location, wave!.unitLocation));
    expect(parked.every((row) => row.planetId === f.planetIds[0] && row.ownerPlayerId === f.playerIds[0])).toBe(true);
    expect(Object.fromEntries(parked.map((row) => [row.hull, row.count]))).toEqual(fleet);

    // K2: the sender's Hangar still holds them; the host's never does.
    expect(hangarLoad(await totalUnitsOf(f.db, f.planetIds[0]!))).toBe(senderOwnedBefore);
    expect(hangarLoad(await totalUnitsOf(f.db, f.planetIds[1]!))).toBe(hostOwnedBefore);

    const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(origin!.deuterium - after!.deuterium).toBeCloseTo(q.fuel, 0);

    const told = await f.db.select().from(notifications).where(and(
      eq(notifications.playerId, f.playerIds[1]!),
      eq(notifications.kind, 'clan_support_inbound'),
    ));
    expect(told).toHaveLength(1);
    expect(told[0]!.payload).toMatchObject({
      waveId: wave!.id, arriveAt: wave!.arriveAt.toISOString(),
      senderName: (await namesOf(f, 0)).commander, hostPlanetName: (await namesOf(f, 1)).world,
    });

    const hostView = await f.db.transaction((tx) => planetView(tx, f.planetIds[1]!, f.clock));
    expect(hostView.clanSupport).toMatchObject({
      room: { used: 0, reserved: hangarLoad(fleet), total: hangarCapacity(6) },
    });
    expect(hostView.clanSupport!.waves).toHaveLength(1);
    expect(hostView.clanSupport!.waves[0]).toMatchObject({ id: wave!.id, status: 'OUTBOUND', bulk: hangarLoad(fleet) });
  });

  it('takes a flight bay at the origin for as long as the wave is out', async () => {
    const f = await ready(15_203);
    const before = (await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock))).flight;
    await send(f, 0, 1, { DART: 5 });
    const after = (await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock))).flight;
    expect(after.used).toBe(before.used + 1);
  });

  it('lets one sender stand several waves at one world', async () => {
    const f = await ready(15_204);
    await send(f, 0, 1, { DART: 5 });
    await send(f, 0, 1, { DART: 6 });
    const waves = await f.db.select().from(clanSupportWaves).where(eq(clanSupportWaves.hostPlanetId, f.planetIds[1]!));
    expect(waves).toHaveLength(2);
  });

  it('promises a stay of twelve hours from arrival', async () => {
    const f = await ready(15_205);
    const q = await quote(f, 0, 1, { DART: 5 });
    expect(new Date(q.stationUntil).getTime() - new Date(q.arriveAt).getTime())
      .toBe(CLAN_SUPPORT.stationHours * 3_600_000);
    expect(q.seasonClipped).toBe(false);
  });
});

describe('every refusal, listed together on the quote', () => {
  it('refuses support to your own world', async () => {
    const f = await ready(15_206);
    await expect(send(f, 1, 1, { DART: 5 }, 1)).rejects.toMatchObject({ code: 'CLAN_SUPPORT_SELF' });
  });

  it('refuses a host outside the sender’s clan', async () => {
    const f = await ready(15_207);
    const q = await quote(f, 0, 3, { DART: 5 });
    expect(q.refusals.map((row) => row.code)).toContain('CLAN_SUPPORT_MEMBERSHIP');
    await expect(send(f, 0, 3, { DART: 5 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_MEMBERSHIP' });
  });

  it('refuses a sender still adapting to the clan', async () => {
    const f = await supportWorld(4, 15_208);
    // The founder is mature the instant the clan exists; the new member is not.
    await formClan(f, 0, [1], { matured: false });
    await open(f, 0);
    await expect(send(f, 1, 0, { DART: 5 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_MEMBER_IMMATURE' });
  });

  it('refuses a sender behind the newcomer shield', async () => {
    const f = await ready(15_209);
    await f.db.update(players)
      .set({ newcomerShieldUntil: new Date(f.clock.now().getTime() + 3_600_000) })
      .where(eq(players.id, f.playerIds[0]!));
    const q = await quote(f, 0, 1, { DART: 5 });
    expect(q.senderShieldUntil).not.toBeNull();
    // `context: 'ships'` picks the client's wording for ships, not the clan-aid one for resources.
    await expect(send(f, 0, 1, { DART: 5 })).rejects.toMatchObject({ code: 'SHIELDED_SENDER', params: { context: 'ships' } });
  });

  it('refuses a world whose posture is not SUPPORT', async () => {
    const f = await ready(15_210);
    await expect(send(f, 0, 2, { DART: 5 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_CLOSED' });
  });

  it('refuses a sender outside the host’s tier band', async () => {
    const f = await ready(15_211);
    // Tier 5 against tier 1: four tiers apart, outside the ±1 band.
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 15);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 1);
    const q = await quote(f, 0, 1, { DART: 5 });
    const band = q.refusals.find((row) => row.code === 'CLAN_SUPPORT_TIER_BAND');
    expect(band).toBeDefined();
    expect(q.band.ok).toBe(false);
    await expect(send(f, 0, 1, { DART: 5 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_TIER_BAND' });
  });

  it('refuses a wave the host’s support bay cannot hold', async () => {
    const f = await ready(15_212);
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 1);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 500 });
    await expect(send(f, 0, 1, { DART: 500 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_ROOM_FULL' });
  });

  it('refuses a world with every bay in use', async () => {
    const f = await ready(15_213);
    const total = (await f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock))).flight.total;
    for (let i = 0; i < total; i++) await send(f, 0, 1, { DART: 1 });
    await expect(send(f, 0, 1, { DART: 1 })).rejects.toMatchObject({ code: 'NO_FREE_BAY', params: { used: total, total } });
  });

  it('refuses an empty tank', async () => {
    const f = await ready(15_214);
    await f.db.update(planets).set({ deuterium: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await expect(send(f, 0, 1, { DART: 5 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUEL', params: { needed: expect.any(Number) as number, have: 0 },
    });
  });

  it('refuses a mining craft — support is a fighting line', async () => {
    const f = await ready(15_215);
    await giveUnits(f.db, f.planetIds[0]!, { PROSPECTOR: 1 });
    await expect(send(f, 0, 1, { PROSPECTOR: 1 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_NONCOMBATANT' });
  });

  it('refuses more ships than stand at home', async () => {
    const f = await ready(15_216);
    await expect(send(f, 0, 1, { DART: 10_000 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
  });

  it('refuses a wave that could not get home before the galaxy ends', async () => {
    const f = await ready(15_217);
    await f.db.update(seasons).set({ endsAt: new Date(f.clock.now().getTime() + 60_000) })
      .where(eq(seasons.id, f.seasonId));
    await expect(send(f, 0, 1, { DART: 5 })).rejects.toMatchObject({ code: 'CLAN_SUPPORT_SEASON_TOO_SHORT' });
  });

  it('clips the stay so the flight home lands inside the season', async () => {
    const f = await ready(15_218);
    const q0 = await quote(f, 0, 1, { DART: 5 });
    const arrive = new Date(q0.arriveAt).getTime();
    await f.db.update(seasons).set({ endsAt: new Date(arrive + 3 * 3_600_000) }).where(eq(seasons.id, f.seasonId));
    const q = await quote(f, 0, 1, { DART: 5 });
    expect(q.seasonClipped).toBe(true);
    expect(new Date(q.stationUntil).getTime()).toBeLessThan(arrive + CLAN_SUPPORT.stationHours * 3_600_000);
    expect(new Date(q.stationUntil).getTime() + q.returnMinutes * 60_000).toBeLessThanOrEqual(arrive + 3 * 3_600_000);
  });
});

describe('two senders racing for the last of the room', () => {
  it('lets exactly one of them in', async () => {
    const f = await ready(15_219);
    await setLevel(f.db, f.planetIds[1]!, 'HANGAR', 1);
    const room = hangarCapacity(1);
    const each = Math.ceil((room / hangarLoad({ DART: 1 })) * 0.6);
    const results = await Promise.allSettled([
      send(f, 0, 1, { DART: each }),
      send(f, 2, 1, { DART: each }),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((row) => row.status === 'rejected');
    expect(refused).toMatchObject({ reason: { code: 'CLAN_SUPPORT_ROOM_FULL' } });
  });
});

describe('the HTTP surface', () => {
  it('replays one idempotency key as one wave and one fuel charge', async () => {
    const f = await ready(15_220);
    const { buildApp } = await import('../src/app.js');
    const { TokenService } = await import('../src/auth/tokens.js');
    const { testEnv } = await import('./helpers.js');
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
      const headers = {
        authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}`,
        'idempotency-key': 'clan-support-send-0001',
      };
      const request = () => built.app.inject({
        method: 'POST',
        url: '/api/clan/support',
        headers,
        payload: { originPlanetId: f.planetIds[0], hostPlanetId: f.planetIds[1], fleet: { DART: 7 } },
      });
      const [first, replay] = await Promise.all([request(), request()]);
      expect(first.statusCode).toBe(200);
      expect(replay.json()).toEqual(first.json());
      const waves = await f.db.select().from(clanSupportWaves);
      expect(waves).toHaveLength(1);

      const quoted = await built.app.inject({
        method: 'POST',
        url: '/api/clan/support/quote',
        headers: { authorization: headers.authorization },
        payload: { originPlanetId: f.planetIds[0], hostPlanetId: f.planetIds[1], fleet: { DART: 7 } },
      });
      expect(quoted.statusCode).toBe(200);
      expect(quoted.json()).toMatchObject({ refusals: [] });
    } finally {
      await built.close();
    }
  });
});
