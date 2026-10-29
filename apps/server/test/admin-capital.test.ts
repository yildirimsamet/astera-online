import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, describe, expect, it } from 'vitest';
import { INSTRUMENT_MAX_LEVEL } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { accounts, buildings, planets, satellites, seasons } from '../src/db/schema.js';
import { provisionAdminCapitals } from '../src/services/adminCapital.js';
import { makeAccount, placeAt, seedWorld, testDb, testEnv } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

describe('hidden admin capital', () => {
  it('can reconcile an admin in an ended season without preventing server boot', async () => {
    const f = await seedWorld(1);
    await f.db.update(accounts).set({ username: 'operator' }).where(eq(accounts.id, f.accountIds[0]!));
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(provisionAdminCapitals(f.db, new Set(['operator']), f.clock)).resolves.toBe(1);
  });
  it('centres and equips only allowlisted capitals, idempotently, and keeps them hidden from ordinary players', async () => {
    const f = await seedWorld(2);
    await f.db.update(accounts).set({ username: 'operator' }).where(eq(accounts.id, f.accountIds[0]!));
    const before = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!)))[0]!;
    await provisionAdminCapitals(f.db, new Set(['operator']), f.clock);
    const world = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!;
    expect(world).toMatchObject({ x: 0, y: 0, z: 0 });
    const hardware = await f.db.select().from(satellites).where(eq(satellites.planetId, world.id));
    expect(hardware.find(row => row.type === 'TELESCOPE')?.level).toBe(INSTRUMENT_MAX_LEVEL.TELESCOPE);
    expect(hardware.find(row => row.type === 'UPLINK')).toBeDefined();
    const core = await f.db.select().from(buildings).where(eq(buildings.planetId, world.id));
    expect(core.find(row => row.type === 'CORE')!.level).toBeGreaterThanOrEqual(INSTRUMENT_MAX_LEVEL.TELESCOPE!);
    await provisionAdminCapitals(f.db, new Set(['operator']), f.clock);
    expect(await f.db.select().from(satellites).where(eq(satellites.planetId, world.id))).toEqual(hardware);
    expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!)))[0]).toEqual(before);
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: 'operator' }), logger: pino({ level: 'silent' }) });
    await built.app.ready();
    try {
      await placeAt(f.db, f.planetIds[1]!, { x: 4400, y: 0, z: 0 });
      const admin = { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}` };
      const user = { authorization: `Bearer ${await built.app.tokens.issueAccess(f.accountIds[1]!)}` };
      const view = (await built.app.inject({ method: 'GET', url: '/api/galaxy', headers: admin })).json<{ planets: { id: string; intelState: string; controller?: unknown }[] }>();
      expect(view.planets.find(row => row.id === f.planetIds[1])?.controller).toBeDefined();
      const normal = (await built.app.inject({ method: 'GET', url: '/api/galaxy', headers: user })).json<{ planets: { id: string }[] }>();
      expect(normal.planets.map(row => row.id)).not.toContain(world.id);
      const ordinarySight = await built.projections.sensorsFor(f.playerIds[1]!, f.seasonId, [f.planetIds[1]!]);
      expect(ordinarySight[0]!.identify).toBeLessThan(4400);
      const sent = await built.app.inject({ method: 'POST', url: '/api/chat/messages', headers: admin, payload: { content: 'Operator' } });
      expect(sent.statusCode).toBe(200);
      const chat = (await built.app.inject({ method: 'GET', url: '/api/chat/messages', headers: user })).json<{ messages: { planetId?: string; admin?: boolean }[] }>();
      expect(chat.messages[0]).toMatchObject({ admin: true });
      expect(chat.messages[0]).not.toHaveProperty('planetId');
    } finally { await built.close(); }
  });

  it('provisions a new admin join in the join transaction and ignores forged display names', async () => {
    const f = await seedWorld(1);
    const admin = await makeAccount(f.db, 'New operator');
    await f.db.update(accounts).set({ displayName: admin.username }).where(eq(accounts.id, f.accountIds[0]!));
    const built = buildApp({ db: f.db, clock: f.clock, env: testEnv({ ADMIN_USERNAMES: admin.username }), logger: pino({ level: 'silent' }) });
    await built.app.ready();
    try {
      const servers = (await built.app.inject({ method: 'GET', url: '/api/servers' })).json<{ servers: { code: string }[] }>();
      const response = await built.app.inject({ method: 'POST', url: `/api/servers/${servers.servers[0]!.code}/join`, headers: { authorization: `Bearer ${await built.app.tokens.issueAccess(admin.id)}` } });
      expect(response.statusCode).toBe(200);
      const { planetId } = response.json<{ planetId: string }>();
      expect((await f.db.select().from(planets).where(eq(planets.id, planetId)))[0]).toMatchObject({ x: 0, y: 0, z: 0 });
    } finally { await built.close(); }
  });
});
