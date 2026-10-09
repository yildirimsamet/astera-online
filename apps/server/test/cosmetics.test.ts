import { clanActor, createClan } from '../src/services/clan.js';
import { clanCosmeticFlags } from '../src/services/cosmeticEquipment.js';
import { decorateCosmeticContacts } from '../src/services/cosmeticTraffic.js';
import { loadTrafficSnapshot } from '../src/services/traffic.js';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, cosmeticEntitlements, planets, seasons } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, grant, setLevel, type Fixture } from './helpers.js';
import { publicWorlds, silhouetteOf } from '../src/services/publicGalaxy.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { secedeColony } from '../src/services/loyalty.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { skinCollectionSchema } from '../../web/src/api/schemas.js';

afterAll(async () => { const { close } = await testDb(); await close(); });

describe('planet skin ownership and equipment', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof buildApp>['app'];
  let close: () => Promise<void>;
  let admin: { authorization: string };
  let player: { authorization: string };
  let recipientUsername: string;

  beforeEach(async () => {
    fixture = await seedWorld(2);
    const [row] = await fixture.db.select({ username: accounts.username }).from(accounts)
      .where(eq(accounts.id, fixture.accountIds[0]!));
    const [recipient] = await fixture.db.select({ username: accounts.username }).from(accounts)
      .where(eq(accounts.id, fixture.accountIds[1]!));
    recipientUsername = recipient!.username;
    const built = buildApp({
      env: testEnv({ ADMIN_USERNAMES: row!.username }),
      db: fixture.db,
      clock: fixture.clock,
      logger: pino({ level: 'silent' }),
    });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    admin = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[0]!)}` };
    player = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[1]!)}` };
  });
  afterEach(async () => { await close(); });

  it('equips ship skins independently, validates the hull, and removes only the selected or revoked look', async () => {
    const equip = (cosmeticId: string | null, hull?: string) => app.inject({
      method: 'POST', url: '/api/cosmetics/equip', headers: player,
      payload: { category: 'SHIP', cosmeticId, ...(hull ? { hull } : {}) },
    });
    expect((await equip('ship-shark')).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', payload: { category: 'SHIP', cosmeticId: 'ship-shark' } })).statusCode).toBe(401);
    for (const skinId of ['ship-red-dragon', 'ship-shark']) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/cosmetics/grant', headers: admin,
        payload: { username: recipientUsername, skinId, orderRef: `ships-${skinId}` },
      })).statusCode).toBe(200);
    }
    expect((await equip('ship-shark', 'CORSAIR')).statusCode).toBe(400);
    expect((await equip(null)).statusCode).toBe(400);
    expect((await equip(null, 'unknown-hull')).statusCode).toBe(400);
    expect((await equip(null, '__proto__')).statusCode).toBe(400);
    const results = await Promise.all([equip('ship-red-dragon'), equip('ship-shark', 'CITADEL')]);
    expect(results.map(result => result.statusCode)).toEqual([200, 200]);
    const read = async () => skinCollectionSchema.parse((await app.inject({ method: 'GET', url: '/api/skins', headers: player })).json());
    expect((await read()).equipment).toEqual({ SHIP: { CORSAIR: 'ship-red-dragon', CITADEL: 'ship-shark' } });
    expect((await equip(null, 'CITADEL')).statusCode).toBe(200);
    expect((await read()).equipment).toEqual({ SHIP: { CORSAIR: 'ship-red-dragon' } });
    await fixture.db.update(cosmeticEntitlements).set({ revokedAt: fixture.clock.now() })
      .where(eq(cosmeticEntitlements.cosmeticId, 'ship-red-dragon'));
    expect((await read()).equipment).toEqual({});
    expect((await equip('ship-red-dragon')).statusCode).toBe(403);
  });

  it('lets the leader lend an owned flag, keeps free flags available and never decorates unknown contacts', async () => {
    await fixture.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, fixture.seasonId));
    await grant(fixture.db, fixture.planetIds[1]!, 120_000, 60_000);
    await setLevel(fixture.db, fixture.planetIds[1]!, 'CORE', 10);
    const actor = await clanActor(fixture.db, fixture.accountIds[1]!);
    const clan = await fixture.db.transaction(tx => createClan(tx, {
      actor, name: 'Cosmetic Guard', tag: 'CG', description: '', recruiting: true, clock: fixture.clock,
    }));
    expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: player,
      payload: { category: 'FLAG', cosmeticId: 'flag-orbit' },
    })).statusCode).toBe(200);
    expect((await clanCosmeticFlags(fixture.db, fixture.seasonId)).get(clan.clanId)).toBe('flag-orbit');
    expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: player,
      payload: { category: 'FLAG', cosmeticId: 'flag-helios' },
    })).statusCode).toBe(403);
    const contacts = [{ id: randomUUID(), kind: 'unknown' as const, from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 1, z: 1 }, startAt: fixture.clock.now(), endAt: fixture.clock.now() }];
    const snapshot = await loadTrafficSnapshot(fixture.db, fixture.seasonId, fixture.clock.now());
    expect(decorateCosmeticContacts(contacts, snapshot.cosmeticAppearances)).toEqual(contacts);
  });

  it('serializes concurrent slot changes without losing either appearance', async () => {
    for (const skinId of ['ring-aurora', 'engine-aurora']) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/cosmetics/grant', headers: admin,
        payload: { username: recipientUsername, skinId, orderRef: `concurrent-${skinId}` },
      })).statusCode).toBe(200);
    }
    const results = await Promise.all([
      app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: player, payload: { category: 'RING', cosmeticId: 'ring-aurora' } }),
      app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: player, payload: { category: 'ENGINE', cosmeticId: 'engine-aurora' } }),
    ]);
    expect(results.map(result => result.statusCode)).toEqual([200, 200]);
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: player })).json()).toMatchObject({
      equipment: { RING: 'ring-aurora', ENGINE: 'engine-aurora' },
    });
  });

  it('authorizes independent cosmetic slots and preserves existing planet rights', async () => {
    const equip = (category: string, cosmeticId: string | null) => app.inject({
      method: 'POST', url: '/api/cosmetics/equip', headers: player, payload: { category, cosmeticId },
    });
    expect((await equip('RING', 'ring-aurora')).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/admin/cosmetics/grant', headers: admin,
      payload: { username: recipientUsername, skinId: 'ring-aurora', orderRef: 'ring-order-1' },
    })).statusCode).toBe(200);
    expect((await equip('ENGINE', 'ring-aurora')).statusCode).toBe(400);
    expect((await equip('RING', 'ring-aurora')).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: player })).json()).toMatchObject({
      ownedCosmeticIds: ['ring-aurora'], equipment: { RING: 'ring-aurora' }, ownedSkinIds: [],
    });
    const [world] = await publicWorlds(fixture.db, fixture.seasonId, fixture.clock.now(), [fixture.planetIds[1]!]);
    expect(world).toHaveProperty('ringId', 'ring-aurora');
    await fixture.db.update(cosmeticEntitlements).set({ revokedAt: fixture.clock.now() })
      .where(eq(cosmeticEntitlements.cosmeticId, 'ring-aurora'));
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: player })).json()).toMatchObject({ equipment: {} });
    const [revokedWorld] = await publicWorlds(fixture.db, fixture.seasonId, fixture.clock.now(), [fixture.planetIds[1]!]);
    expect(revokedWorld).not.toHaveProperty('ringId');
    expect((await equip('RING', null)).statusCode).toBe(200);
    expect((await equip('RING', '__proto__')).statusCode).toBe(400);
    expect((await equip('FLAG', 'flag-vanguard')).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/cosmetics/equip', payload: { category: 'RING', cosmeticId: null } })).statusCode).toBe(401);
  });

  it('requires an operator to grant, then lets the recipient equip only owned worlds', async () => {
    const ownWorld = fixture.planetIds[1]!;
    const otherWorld = fixture.planetIds[0]!;
    expect((await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: player,
      payload: { username: recipientUsername, skinId: 'planet-lava', orderRef: 'shop-123' },
    })).statusCode).toBe(403);
    const grant = await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { username: recipientUsername, skinId: 'planet-lava', orderRef: 'shop-123' },
    });
    expect(grant.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/skins/planets/${otherWorld}`, headers: player,
      payload: { skinId: 'planet-lava' },
    })).statusCode).toBe(403);
    const equip = await app.inject({ method: 'POST', url: `/api/skins/planets/${ownWorld}`, headers: player,
      payload: { skinId: 'planet-lava' },
    });
    expect(equip.statusCode).toBe(200);
    const [equipped] = await fixture.db.select({ skin: planets.equippedSkinId }).from(planets)
      .where(eq(planets.id, ownWorld));
    expect(equipped?.skin).toBe('planet-lava');
    const collection = await app.inject({ method: 'GET', url: '/api/skins', headers: player });
    expect(collection.json()).toMatchObject({ ownedSkinIds: ['planet-lava'] });
    expect(collection.json<{ planets: { id: string; skinId: string | null }[] }>().planets)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: ownWorld, skinId: 'planet-lava' })]));
  });

  it('grants and equips a country world through the existing cosmetic entitlement flow', async () => {
    const world = fixture.planetIds[1]!;
    const grant = await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { username: recipientUsername, skinId: 'planet-turkey', orderRef: 'country-1' },
    });
    expect(grant.statusCode).toBe(200);
    const equip = await app.inject({ method: 'POST', url: `/api/skins/planets/${world}`, headers: player,
      payload: { skinId: 'planet-turkey' },
    });
    expect(equip.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: player })).json())
      .toMatchObject({ ownedSkinIds: ['planet-turkey'] });
    const [publicWorld] = await publicWorlds(fixture.db, fixture.seasonId, fixture.clock.now(), [world]);
    expect(publicWorld?.skin).toEqual({ id: 'planet-turkey', status: 'NORMAL' });
  });

  it('is idempotent for a verified order, rejects forged products, and allows default again', async () => {
    const body = { username: recipientUsername, skinId: 'planet-ice', orderRef: 'order-9' };
    for (let i = 0; i < 2; i++) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
        payload: body,
      })).statusCode).toBe(200);
    }
    const rights = await fixture.db.select().from(cosmeticEntitlements)
      .where(eq(cosmeticEntitlements.accountId, fixture.accountIds[1]!));
    expect(rights).toHaveLength(1);
    expect((await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { ...body, skinId: '__proto__' },
    })).statusCode).toBe(400);
    const world = fixture.planetIds[1]!;
    expect((await app.inject({ method: 'POST', url: `/api/skins/planets/${world}`, headers: player,
      payload: { skinId: 'planet-lava' },
    })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `/api/skins/planets/${world}`, headers: player,
      payload: { skinId: null },
    })).statusCode).toBe(200);
  });

  it('projects only the active recovery shield as the purchased skin\'s damaged look', async () => {
    const id = fixture.planetIds[1]!;
    const now = fixture.clock.now();
    await fixture.db.update(planets).set({
      equippedSkinId: 'planet-toxic',
      recoveryBoostUntil: new Date(now.getTime() + 6 * 60 * 60_000),
    }).where(eq(planets.id, id));
    const [damaged] = await publicWorlds(fixture.db, fixture.seasonId, now, [id]);
    expect(damaged?.skin).toEqual({ id: 'planet-toxic', status: 'RECOVERY_SHIELD' });
    expect(silhouetteOf(damaged!).skin).toEqual(damaged?.skin);
    const [normal] = await publicWorlds(fixture.db, fixture.seasonId,
      new Date(now.getTime() + 6 * 60 * 60_000), [id]);
    expect(normal?.skin).toEqual({ id: 'planet-toxic', status: 'NORMAL' });
    await fixture.db.update(planets).set({
      recoveryBoostUntil: null,
      protectedUntil: new Date(now.getTime() + 60_000),
    }).where(eq(planets.id, id));
    const [protectedWorld] = await publicWorlds(fixture.db, fixture.seasonId, now, [id]);
    expect(protectedWorld?.skin).toEqual({ id: 'planet-toxic', status: 'NORMAL' });
  });

  it('removes the previous owner\'s look when a world changes control', async () => {
    const [colony] = await fixture.db.insert(planets).values({
      controllerPlayerId: fixture.playerIds[1],
      seasonId: fixture.seasonId,
      kind: 'COLONY',
      name: 'Taken world',
      slotIndex: 99998,
      x: 120,
      y: 0,
      z: 0,
      equippedSkinId: 'planet-lava',
    }).returning({ id: planets.id });
    await fixture.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: colony!.id,
      expectedControllerPlayerId: fixture.playerIds[1]!,
      newPlayerId: fixture.playerIds[0]!,
      protectedUntil: fixture.clock.now(),
      now: fixture.clock.now(),
    }));
    const [world] = await fixture.db.select({ skinId: planets.equippedSkinId }).from(planets)
      .where(eq(planets.id, colony!.id));
    expect(world?.skinId).toBeNull();
    const [publicWorld] = await publicWorlds(fixture.db, fixture.seasonId, fixture.clock.now(), [colony!.id]);
    expect(publicWorld).not.toHaveProperty('skin');
  });

  it('lets one right dress several owned planets while another planet uses a different right', async () => {
    const [colony] = await fixture.db.insert(planets).values({
      controllerPlayerId: fixture.playerIds[1],
      seasonId: fixture.seasonId,
      kind: 'COLONY',
      name: 'Second world',
      slotIndex: 99999,
      x: 100,
      y: 0,
      z: 0,
    }).returning({ id: planets.id });
    for (const [skinId, orderRef] of [['planet-lava', 'two-lava'], ['planet-ice', 'two-ice']] as const) {
      expect((await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
        payload: { username: recipientUsername, skinId, orderRef },
      })).statusCode).toBe(200);
    }
    const equip = async (id: string, skinId: string) => app.inject({
      method: 'POST', url: `/api/skins/planets/${id}`, headers: player, payload: { skinId },
    });
    expect((await equip(fixture.planetIds[1]!, 'planet-lava')).statusCode).toBe(200);
    expect((await equip(colony!.id, 'planet-lava')).statusCode).toBe(200);
    const both = await fixture.db.select({ skin: planets.equippedSkinId }).from(planets)
      .where(eq(planets.controllerPlayerId, fixture.playerIds[1]!));
    expect(both.map((row) => row.skin)).toEqual(['planet-lava', 'planet-lava']);
    expect((await equip(colony!.id, 'planet-ice')).statusCode).toBe(200);
    const different = await fixture.db.select({ id: planets.id, skin: planets.equippedSkinId })
      .from(planets).where(eq(planets.controllerPlayerId, fixture.playerIds[1]!));
    expect(new Map(different.map((row) => [row.id, row.skin]))).toEqual(new Map([
      [fixture.planetIds[1]!, 'planet-lava'], [colony!.id, 'planet-ice'],
    ]));
  });

  it('shows the cosmetic to the owner while omitting it from an unknown world', async () => {
    const mine = fixture.planetIds[0]!;
    const theirs = fixture.planetIds[1]!;
    await fixture.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, mine));
    await fixture.db.update(planets).set({
      x: 1900, y: 0, z: 0, equippedSkinId: 'planet-lava',
    }).where(eq(planets.id, theirs));
    const visible = await app.inject({ method: 'GET', url: '/api/galaxy', headers: player });
    expect(visible.statusCode).toBe(200);
    expect(visible.json<{ planets: { id: string; skin?: unknown }[] }>().planets.find((p) => p.id === theirs)?.skin)
      .toEqual({ id: 'planet-lava', status: 'NORMAL' });
    const hidden = await app.inject({ method: 'GET', url: '/api/galaxy', headers: admin });
    expect(hidden.statusCode).toBe(200);
    const unknown = hidden.json<{ planets: { id: string; intel: string; skin?: unknown }[] }>()
      .planets.find((p) => p.id === theirs);
    expect(unknown?.intel).toBe('UNKNOWN');
    expect(unknown).not.toHaveProperty('skin');
    await fixture.db.update(planets).set({ x: 10 }).where(eq(planets.id, theirs));
    app.projections.invalidate(fixture.seasonId);
    const discovered = await app.inject({ method: 'GET', url: '/api/galaxy', headers: admin });
    const resolved = discovered.json<{ planets: { id: string; intel: string; skin?: unknown }[] }>()
      .planets.find((p) => p.id === theirs);
    expect(resolved?.intel).toBe('RESOLVED');
    expect(resolved?.skin).toEqual({ id: 'planet-lava', status: 'NORMAL' });
  });

  it('treats two simultaneous deliveries of the same order as one right', async () => {
    const request = () => app.inject({
      method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { username: recipientUsername, skinId: 'planet-desert', orderRef: 'simultaneous-42' },
    });
    const responses = await Promise.all([request(), request()]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const rights = await fixture.db.select().from(cosmeticEntitlements)
      .where(eq(cosmeticEntitlements.accountId, fixture.accountIds[1]!));
    expect(rights).toHaveLength(1);
  });

  it('binds a verified order reference to one skin and one account', async () => {
    const orderRef = 'shop-item-77';
    const grant = (username: string, skinId: string) => app.inject({
      method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { username, skinId, orderRef },
    });
    expect((await grant(recipientUsername, 'planet-lava')).statusCode).toBe(200);
    expect((await grant(recipientUsername, 'planet-ice')).statusCode).toBe(409);
    const [operator] = await fixture.db.select({ username: accounts.username }).from(accounts)
      .where(eq(accounts.id, fixture.accountIds[0]!));
    expect((await grant(operator!.username, 'planet-ice')).statusCode).toBe(409);
  });

  it('keeps the verified purchase record when the buyer deletes their account', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { username: recipientUsername, skinId: 'planet-lava', orderRef: 'kept-order-1' },
    })).statusCode).toBe(200);
    await deleteAccount(fixture.db, fixture.clock, recipientUsername);
    const [kept] = await fixture.db.select().from(cosmeticEntitlements)
      .where(eq(cosmeticEntitlements.orderRef, 'kept-order-1'));
    expect(kept).toMatchObject({
      accountId: null,
      cosmeticId: 'planet-lava',
      source: 'MANUAL',
      grantedByAccountId: fixture.accountIds[0],
    });
    const [operator] = await fixture.db.select({ username: accounts.username }).from(accounts)
      .where(eq(accounts.id, fixture.accountIds[0]!));
    // A fulfilled order stays fulfilled: it cannot be granted to a new account.
    expect((await app.inject({ method: 'POST', url: '/api/admin/skins/grant', headers: admin,
      payload: { username: operator!.username, skinId: 'planet-lava', orderRef: 'kept-order-1' },
    })).statusCode).toBe(409);
  });

  it('clears the look when a colony secedes to the galaxy', async () => {
    const [colony] = await fixture.db.insert(planets).values({
      controllerPlayerId: fixture.playerIds[1],
      seasonId: fixture.seasonId,
      kind: 'COLONY',
      name: 'Seceding world',
      slotIndex: 99997,
      x: 140,
      y: 0,
      z: 0,
      equippedSkinId: 'planet-ice',
    }).returning({ id: planets.id });
    const seceded = await fixture.db.transaction((tx) =>
      secedeColony(tx, colony!.id, fixture.clock.now(), randomUUID()));
    expect(seceded).toBe(true);
    const [world] = await fixture.db.select({ skinId: planets.equippedSkinId }).from(planets)
      .where(eq(planets.id, colony!.id));
    expect(world?.skinId).toBeNull();
  });
});
