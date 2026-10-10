import { COSMETIC_IDS } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skinCollectionSchema as collectionSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { accounts, cosmeticEntitlements } from '../src/db/schema.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

afterAll(async () => { const { close } = await testDb(); await close(); });

describe('inventory compatibility across cosmetic catalogue releases', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof buildApp>['app'];
  let close: () => Promise<void>;
  let authorization: string;
  beforeEach(async () => {
    fixture = await seedWorld(1);
    for (const id of ['ring-saturn', 'engine-aurora', 'ship-shark']) await fixture.db.insert(cosmeticEntitlements)
      .values({ accountId: fixture.accountIds[0]!, cosmeticId: id, source: 'MANUAL', orderRef: `compat-${id}` });
    await fixture.db.update(accounts).set({ cosmeticEquipment: {
      RING: 'ring-saturn', ENGINE: 'engine-aurora', SHIP: { CITADEL: 'ship-shark' }, FLAG: 'flag-bastion',
    } }).where(eq(accounts.id, fixture.accountIds[0]!));
    const built = buildApp({ db: fixture.db, env: testEnv(), clock: fixture.clock, logger: pino({ level: 'silent' }) });
    app = built.app; close = built.close; await app.ready();
    authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(fixture.accountIds[0]!)}`;
  });
  afterEach(async () => { await close(); });
  const read = async (known?: string) => collectionSchema.parse((await app.inject({ method: 'GET', url: '/api/skins',
    headers: { authorization, ...(known === undefined ? {} : { 'x-astera-cosmetics': known }) } })).json());

  it.each([undefined, '', '   '])('keeps pre-wave-two inventories readable with declaration %j without revoking new rights', async known => {
    const legacy = await read(known);
    expect(legacy.ownedCosmeticIds?.sort()).toEqual(['engine-aurora', 'ship-shark']);
    expect(legacy.equipment).toEqual({ ENGINE: 'engine-aurora', SHIP: { CITADEL: 'ship-shark' } });
    const current = await read(COSMETIC_IDS.join(','));
    expect(current.ownedCosmeticIds?.sort()).toEqual(['engine-aurora', 'ring-saturn', 'ship-shark']);
    expect(current.equipment).toEqual({ RING: 'ring-saturn', ENGINE: 'engine-aurora', SHIP: { CITADEL: 'ship-shark' }, FLAG: 'flag-bastion' });
    expect(legacy.ownedSkinIds).toEqual(current.ownedSkinIds);
    expect(legacy.planets).toEqual(current.planets);
    const rights = await fixture.db.select().from(cosmeticEntitlements).where(eq(cosmeticEntitlements.accountId, fixture.accountIds[0]!));
    expect(rights).toHaveLength(3);
    expect(rights.every(right => right.revokedAt === null)).toBe(true);
  });

  it.each([
    ['ring-saturn', ['ring-saturn'], { RING: 'ring-saturn' }],
    ['ship-shark', ['ship-shark'], { SHIP: { CITADEL: 'ship-shark' } }],
    ['__proto__, ring-saturn ,unreleased', ['ring-saturn'], { RING: 'ring-saturn' }],
    ['unreleased', [], {}],
  ] as const)('limits the view to declared known IDs %s while retaining the full ledger', async (known, owned, equipment) => {
    const result = await read(known);
    expect(result.ownedCosmeticIds).toEqual(owned);
    expect(result.equipment).toEqual(equipment);
    expect(await fixture.db.select().from(cosmeticEntitlements)).toHaveLength(3);
  });

  it('bounds untrusted declarations and still requires authentication and ownership', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: { authorization, 'x-astera-cosmetics': 'x'.repeat(4097) } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/skins', headers: { 'x-astera-cosmetics': COSMETIC_IDS.join(',') } })).statusCode).toBe(401);
    const refused = await app.inject({ method: 'POST', url: '/api/cosmetics/equip', headers: { authorization, 'x-astera-cosmetics': COSMETIC_IDS.join(',') },
      payload: { category: 'RING', cosmeticId: 'ring-inferno' } });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ error: 'SKIN_NOT_OWNED' });
  });
});
