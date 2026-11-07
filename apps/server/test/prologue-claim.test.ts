import { COMMUNITY_POLICY_VERSION, STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accounts, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

describe('claiming the ship from the prologue', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const claim = (extra: object) => world.app.inject({
    method: 'POST', url: '/api/onboarding/claim',
    payload: { username: 'prologue_pilot', password: 'a-long-enough-password', countryCode: 'TR', communityPolicyVersion: COMMUNITY_POLICY_VERSION, intents: [], ...extra },
  });
  const ship = async () => {
    const [account] = await world.f.db.select().from(accounts).where(eq(accounts.username, 'prologue_pilot'));
    const [row] = await world.f.db.select().from(vessels).where(eq(vessels.accountId, account!.id));
    return row!;
  };

  it('builds exactly the opening the prologue ended on', async () => {
    const answer = await claim({});
    expect(answer.statusCode).toBe(200);
    const row = await ship();
    expect(row.alloy).toBe(STARTER.opening.alloy);
    expect(row.crystal).toBe(STARTER.opening.crystal);
    expect(row.deuterium).toBe(STARTER.opening.deuterium);
    expect(row.modules).toEqual(STARTER.opening.modules);
  });

  it('does not take the browser\'s word for anything', async () => {
    await claim({ intents: [{ kind: 'build', building: 'REFINERY', level: 9 }], alloy: 999_999, modules: { DRIVE_THRUST: 4 } }).catch(() => undefined);
    const [account] = await world.f.db.select().from(accounts).where(eq(accounts.username, 'prologue_pilot'));
    if (!account) return;
    const row = await ship();
    expect(row.alloy).toBe(STARTER.opening.alloy);
    expect(row.modules).toEqual(STARTER.opening.modules);
  });
});
