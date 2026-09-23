import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CLAN, MULTI_WORLD } from '@astera/rules';
import { players, seasons } from '../src/db/schema.js';
import { launchClanAid, quoteClanAid } from '../src/services/clanAid.js';
import { acceptClanRequest, applyToClan, clanActor, createClan } from '../src/services/clan.js';
import { fuelUp, giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * A SHIELDED COMMANDER'S ORE DOES NOT LEAVE. Plan §15.6 — *"korumalı/yeni oyuncu kaynağının klan
 * yardımı ve transferle dışa akışı denetlenir."*
 *
 * THE OTHER HALF OF THE SYBIL DEFENCE. Gating who COUNTS toward the asteroid supply stops fake
 * accounts inflating the sky; it does nothing about fake accounts being FARMED. Every new
 * commander lands with an opening grant and an Academy exit worth several thousand
 * alloy-equivalent, and a clan delivery moves resources between two different players — so a
 * hundred throwaway accounts could be emptied into one real one in an afternoon.
 *
 * A TRANSFER CANNOT DO THIS and never could: both ends of `launchTransfer` are checked to be the
 * same commander's worlds. Clan aid is the only lane that crosses commanders, so it is the only
 * one that needs the guard.
 *
 * INBOUND AID IS UNTOUCHED. A clan helping a newcomer is the thing the feature is for; what is
 * refused is the newcomer's ore flowing OUT while they are still standing behind the shield that
 * exists to protect them.
 */
describe('a shielded commander may not ship their grant away', () => {
  let f: Fixture;
  let giver: string;
  let taker: string;

  const shield = async (playerId: string, until: Date | null): Promise<void> => {
    await f.db.update(players).set({ newcomerShieldUntil: until }).where(eq(players.id, playerId));
  };

  const sendAid = async () => {
    const [sender, recipient] = f.playerIds as [string, string];
    return f.db.transaction((tx) => launchClanAid(tx, {
      senderPlayerId: sender,
      originPlanetId: giver,
      recipientPlayerId: recipient,
      targetPlanetId: taker,
      fleet: { COURIER: 2 },
      cargo: { alloy: 500, crystal: 0, deuterium: 0 },
      clock: f.clock,
    }));
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    // Clans only exist from the joint-war ruleset onward.
    await f.db.update(seasons)
      .set({ rulesetVersion: MULTI_WORLD.clanJointWarRulesetVersion })
      .where(eq(seasons.id, f.seasonId));
    [giver, taker] = f.planetIds as [string, string, string];
    for (const id of [giver, taker]) {
      await setLevel(f.db, id, 'CORE', 6);
      await setLevel(f.db, id, 'SHIPYARD', 2);
      await grant(f.db, id, 200_000, 60_000);
      await fuelUp(f.db, id, 50_000);
    }
    await giveUnits(f.db, giver, { COURIER: 4 });

    const leader = await clanActor(f.db, f.accountIds[0]!);
    const { clanId } = await f.db.transaction((tx) => createClan(tx, {
      actor: leader, name: 'Orion Guard', tag: 'OG',
      description: 'Two commanders, one purse.', recruiting: true, clock: f.clock,
    }));
    const candidate = await clanActor(f.db, f.accountIds[1]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate, clanId, now: f.clock.now(),
    }));
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: leader,
      requestId: application.requestId,
      acknowledgeHostile: true,
      now: f.clock.now(),
    }));
    // Aid only flows once the clan has settled; the same wait every clan test takes.
    f.clock.advance(CLAN.adaptationMinutes);
    await shield(f.playerIds[0]!, null);
    await shield(f.playerIds[1]!, null);
  });

  it('lets an unshielded commander send aid as before', async () => {
    await expect(sendAid()).resolves.toBeTruthy();
  });

  it('refuses aid out of a commander still behind the newcomer shield', async () => {
    await shield(f.playerIds[0]!, new Date(f.clock.now().getTime() + 60 * 60_000));
    await expect(sendAid()).rejects.toMatchObject({ code: 'SHIELDED_SENDER' });
  });

  it('lets them send the moment the shield lapses', async () => {
    await shield(f.playerIds[0]!, new Date(f.clock.now().getTime() - 1_000));
    await expect(sendAid()).resolves.toBeTruthy();
  });

  /**
   * THE QUOTE SAYS SO BEFORE THE BUTTON DOES. Self-review 2026-09-23, R4.
   *
   * The refusal only ever arrived on commit, so a shielded commander composed a whole convoy and
   * learned the rule by losing the attempt to it. The quote now carries the sender's shield, which
   * is the fact the sheet needs to hold the button and say why.
   */
  it('tells the sender in the quote that their shield holds the aid back', async () => {
    const [sender, recipient] = f.playerIds as [string, string];
    const quote = () => quoteClanAid(f.db, {
      senderPlayerId: sender, originPlanetId: giver, recipientPlayerId: recipient,
      targetPlanetId: taker, fleet: { COURIER: 2 },
      cargo: { alloy: 500, crystal: 0, deuterium: 0 }, now: f.clock.now(),
    });
    expect((await quote()).senderShieldUntil).toBeNull();
    const until = new Date(f.clock.now().getTime() + 60 * 60_000);
    await shield(sender, until);
    expect((await quote()).senderShieldUntil).toBe(until.toISOString());
  });

  /** Receiving is the point of the feature and is never refused. */
  it('still lets a shielded commander receive aid', async () => {
    await shield(f.playerIds[1]!, new Date(f.clock.now().getTime() + 60 * 60_000));
    await expect(sendAid()).resolves.toBeTruthy();
  });
});
