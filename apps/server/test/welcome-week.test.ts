import { WELCOME_WEEK, welcomeBox } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accounts, cosmeticEntitlements, planets, vessels, welcomeWeek } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { TOKENS, bearer, starterWorld } from './starterFixture.js';
import { aboard, get, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface Welcome { welcome: { opened: number; box: number | null; readyAt: string | null; preview: { alloy: number; crystal: number } | null } | null }

/**
 * NEW COMMANDER 7 DAYS (plan 2026-11-06 §7.2, Faz 4.9). Once an account, from the landing on (plan
 * 2026-11-18 S6: never in the starter galaxy); no streak; the next box 20 hours after the last opening;
 * into the capital's store, where a raid can take it.
 */
describe('the welcome week', () => {
  let world: StarterWorld;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const shipOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;
  const read = (headers: Record<string, string>) => get<Welcome>(world, '/api/welcome', headers);
  const open = (headers: Record<string, string>) => post(world, '/api/welcome/open', headers);
  /** A commander who has landed: the ship departed, the account holds the seeded capital now. */
  const landed = async () => {
    const ship = await aboard(world, 'Landed');
    await world.f.db.update(vessels).set({ accountId: world.f.accountIds[0]!, status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, ship.vesselId));
    return bearer(await TOKENS.issueAccess(world.f.accountIds[0]!));
  };

  it('is not there aboard: the week starts at the landing (S6)', async () => {
    const me = await aboard(world, 'Me');
    const before = await shipOf(me.vesselId);
    expect(await read(me.headers)).toEqual({ welcome: null });
    expect((await open(me.headers)).json<{ error: string }>().error).toBe('WELCOME_NOT_ELIGIBLE');
    const after = await shipOf(me.vesselId);
    expect([after.alloy, after.crystal]).toEqual([before.alloy, before.crystal]);
  });

  it('has the first box ready on landing, then waits 20 hours, then the next', async () => {
    const headers = await landed();
    const first = (await read(headers)).welcome!;
    expect(first).toMatchObject({ opened: 0, box: 1, readyAt: world.f.clock.now().toISOString() });
    const opened = await open(headers);
    expect(opened.statusCode).toBe(200);
    expect(opened.json<{ granted: { alloy: number; crystal: number } }>().granted).toEqual(first.preview);

    expect((await open(headers)).json<{ error: string }>().error).toBe('WELCOME_NOT_READY');
    world.f.clock.advance(WELCOME_WEEK.gapHours * 60 - 1);
    expect((await open(headers)).statusCode).toBe(409);
    world.f.clock.advance(1);
    expect((await read(headers)).welcome).toMatchObject({ opened: 1, box: 2 });
    expect((await open(headers)).statusCode).toBe(200);
  });

  it('gives one box for two presses at once', async () => {
    const headers = await landed();
    const answers = await Promise.all([open(headers), open(headers)]);
    expect(answers.map(answer => answer.statusCode).sort()).toEqual([200, 409]);
    expect((await world.f.db.select().from(welcomeWeek))[0]?.opened).toBe(1);
  });

  it('is not offered to an account that never had a ship', async () => {
    const veteran = bearer(await TOKENS.issueAccess(world.f.accountIds[0]!));
    expect(await read(veteran)).toEqual({ welcome: null });
    expect((await open(veteran)).json<{ error: string }>().error).toBe('WELCOME_NOT_ELIGIBLE');
  });

  it('grants fixed escalating resources, deuterium from box 4+, and cosmetics on boxes 3 and 7', async () => {
    const headers = await landed();
    const capital = world.f.planetIds[0]!;
    const accountId = world.f.accountIds[0]!;
    const stock = async () => (await world.f.db.select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium }).from(planets).where(eq(planets.id, capital)))[0]!;
    await world.f.db.update(planets).set({ alloy: 0, crystal: 0, deuterium: 0 }).where(eq(planets.id, capital));
    const preview = (await read(headers)).welcome!.preview!;
    expect(preview).toEqual(welcomeBox(1));
    expect((await open(headers)).statusCode).toBe(200);
    expect(await stock()).toEqual({ alloy: preview.alloy, crystal: preview.crystal, deuterium: 0 });

    for (let box = 2; box <= WELCOME_WEEK.boxes; box++) {
      world.f.clock.advance(WELCOME_WEEK.gapHours * 60);
      const next = (await read(headers)).welcome!;
      expect(next.box).toBe(box);
      expect(next.preview).toEqual(welcomeBox(box));
      expect((await open(headers)).statusCode).toBe(200);
    }

    const total = WELCOME_WEEK.rewards.reduce(
      (acc, r) => ({ alloy: acc.alloy + r.alloy, crystal: acc.crystal + r.crystal, deuterium: acc.deuterium + r.deuterium }),
      { alloy: 0, crystal: 0, deuterium: 0 },
    );
    expect(await stock()).toEqual(total);

    const rights = await world.f.db.select({ id: cosmeticEntitlements.cosmeticId }).from(cosmeticEntitlements)
      .where(eq(cosmeticEntitlements.accountId, accountId));
    expect(rights.map(r => r.id).sort()).toEqual(['engine-titan', 'ring-helios']);
    const [owner] = await world.f.db.select({ equipment: accounts.cosmeticEquipment }).from(accounts)
      .where(eq(accounts.id, accountId));
    expect(owner?.equipment).toMatchObject({ RING: 'ring-helios', ENGINE: 'engine-titan' });

    world.f.clock.advance(WELCOME_WEEK.gapHours * 60);
    expect((await read(headers)).welcome).toMatchObject({ opened: 7, box: null, readyAt: null, preview: null });
    expect((await open(headers)).json<{ error: string }>().error).toBe('WELCOME_DONE');
  });
});
