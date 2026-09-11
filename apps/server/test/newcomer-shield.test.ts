import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ABUSE } from '@astera/rules';
import { players, strategicAssets } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { baysInUse } from '../src/services/flight.js';
import { joinSeason } from '../src/services/player.js';
import {
  giveNewcomerShield,
  makeAccount,
  giveUnits,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * THE FIRST DAY IN A GALAXY IS SAFE, AND FIRING GIVES IT UP. D183, owner
 * instruction: *"Server'a da gezegenini yeni oluşturan herkes: ilk 1 gün
 * saldırılamaz kalkanı olmalı. Kişi kendisi saldırı yapmak isterse uyarı verilir ve
 * kabul ederse kalkanı kalkar. Bu ilk kez gelen kullanıcılar için değil, herkes
 * için, her sezon."*
 *
 * THIS REVERSES D14 AND PAYS ITS COST ON PURPOSE. That decision removed a
 * four-hour grace with a live argument — "a world where a new arrival is
 * untouchable is a world where the first hours are safe, and this game's first
 * hours are supposed to teach you that they are not". What answers it is the second
 * half of the rule: the shield is a POSITION, not a gift. A beginner is never
 * untouchable, they are un-reached — and the moment they reach out, the galaxy can
 * reach back.
 *
 * THE TWO HALVES ARE THE TWO HALVES OF THIS FILE: nobody may raid a shielded
 * commander, and a shielded commander who raids stops being one — after being
 * asked, once, because a shield spent without being offered is a shield the player
 * did not choose to spend.
 */
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the newcomer shield', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  const shieldOf = async (playerId: string): Promise<Date | null> => {
    const [row] = await f.db
      .select({ until: players.newcomerShieldUntil })
      .from(players)
      .where(eq(players.id, playerId));
    return row?.until ?? null;
  };

  const shieldThem = () => giveNewcomerShield(
    f.db,
    f.playerIds[1]!,
    new Date(f.clock.now().getTime() + ABUSE.newcomerShieldHours * 3_600_000),
  );
  const shieldMe = () => giveNewcomerShield(
    f.db,
    f.playerIds[0]!,
    new Date(f.clock.now().getTime() + ABUSE.newcomerShieldHours * 3_600_000),
  );

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 6);
    await setLevel(f.db, theirs, 'CORE', 6);
    await giveUnits(f.db, mine, { DART: 40 });
    await grant(f.db, mine, 60_000, 6_000);
    await grant(f.db, theirs, 20_000, 2_000);
    await levelWorld(f.db, f.planetIds);
  });

  /* ── the half that protects ──────────────────────────────── */

  it('is stamped on every commander who joins, whoever they are', async () => {
    const fresh = await seedWorld(1);
    // `seedWorld` clears it deliberately (a seeded world is a settled one), so
    // this asserts the STAMP by joining rather than by reading the fixture.
    const account = await makeAccount(fresh.db, 'Newcomer');
    const joined = await joinSeason(fresh.db, account.id, fresh.seasonId, fresh.clock);
    const [row] = await fresh.db
      .select({ until: players.newcomerShieldUntil })
      .from(players)
      .where(eq(players.id, joined.playerId));
    expect(row?.until).not.toBeNull();
    expect(row!.until!.getTime()).toBe(
      fresh.clock.now().getTime() + ABUSE.newcomerShieldHours * 3_600_000,
    );
  });

  it('refuses a raid on a shielded commander, before anything is spent', async () => {
    await shieldThem();
    await expect(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock))
      .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    // No bay, no fuel, no ships off the stack: a refusal is not a launch.
    expect(await baysInUse(f.db, mine)).toBe(0);
  });

  it('lets the raid through the moment the day is over', async () => {
    await shieldThem();
    f.clock.advance(ABUSE.newcomerShieldHours * 60 + 1);
    const launched = await launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock);
    expect(launched.missionId).toBeTypeOf('string');
  });

  /**
   * A SHIELD STOPS RAIDS, NOT SIGHT. D127's economy is untouched: looking is what
   * this game sells, and a probe takes nothing. A newcomer who cannot be READ is a
   * newcomer nobody can decide about, which is a worse galaxy than one where they
   * cannot be hit.
   */
  it('does not stop a probe', async () => {
    await shieldThem();
    await setLevel(f.db, mine, 'SHIPYARD', 2);
    const scout = await launchProbe(f.db, mine, theirs, f.clock);
    expect(scout.missionId).toBeTypeOf('string');
  });

  /* ── the half that ends it ───────────────────────────────── */

  it('asks before it spends a shielded commander’s own shield', async () => {
    await shieldMe();
    await expect(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    // Refused, and still shielded: asking is not spending.
    expect(await shieldOf(f.playerIds[0]!)).not.toBeNull();
    expect(await baysInUse(f.db, mine)).toBe(0);
  });

  it('drops the shield once the commander accepts, and flies the raid', async () => {
    await shieldMe();
    const launched = await launchAttack(
      f.db, mine, theirs, { DART: 10 }, f.clock, undefined, true,
    );
    expect(launched.missionId).toBeTypeOf('string');
    expect(await shieldOf(f.playerIds[0]!)).toBeNull();
  });

  /**
   * AND IT IS GONE FOR GOOD. The window is not paused by the raid — it is spent.
   * A shield that came back after one shot would make the first day a free strike
   * rather than a decision.
   */
  it('does not come back for the rest of the window', async () => {
    await shieldMe();
    await launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock, undefined, true);
    f.clock.advance(60);
    expect(await shieldOf(f.playerIds[0]!)).toBeNull();
    await expect(launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock))
      .rejects.not.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
  });

  /** An unshielded commander is never asked: the confirmation is about a cost. */
  it('never asks a commander who has no shield to give up', async () => {
    const launched = await launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock);
    expect(launched.missionId).toBeTypeOf('string');
  });

  /* ── and the loudest weapon is bound by both halves ──────── */

  /**
   * A STRIKE IS THE LOUDEST THING ONE COMMANDER CAN DO TO ANOTHER. D183.
   *
   * A shield that stopped raids and not this would be a shield that stopped nothing
   * worth stopping — a Death Star halves a world's stores, drops its Core and darks
   * it for two hours (D179). `assertNewcomerShields` is the single statement both
   * lanes read precisely so this cannot be the lane somebody forgets.
   *
   * The two refusals keep the raid lane's order for the same reason: giving up your
   * own day to hit somebody who cannot be hit spends a position for nothing.
   */
  const armStrike = async () => {
    await setLevel(f.db, mine, 'CORE', 5);
    await f.db.insert(strategicAssets).values({
      planetId: mine,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
  };

  it('refuses a Death Star aimed at a shielded commander', async () => {
    await armStrike();
    await shieldThem();
    await expect(launchDeathStar(f.db, mine, theirs, f.clock))
      .rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
  });

  it('asks before a strike spends the attacker’s own shield, then spends it', async () => {
    await armStrike();
    await shieldMe();
    await expect(launchDeathStar(f.db, mine, theirs, f.clock))
      .rejects.toMatchObject({ code: 'SHIELD_WOULD_DROP' });
    // Refused and still shielded: asking is not spending, on this lane either.
    expect(await shieldOf(f.playerIds[0]!)).not.toBeNull();

    const launched = await launchDeathStar(f.db, mine, theirs, f.clock, undefined, true);
    expect(launched.arriveAt).toBeInstanceOf(Date);
    expect(await shieldOf(f.playerIds[0]!)).toBeNull();
  });

  /**
   * THE SERVER'S OWN COMMANDERS ARE BOUND BY BOTH HALVES. D159 · D183.
   *
   * A bot joins through `joinSeason` and is stamped like anybody else, so it may
   * not raid a shielded newcomer — `raidCandidates` skips them, which is what keeps
   * a newcomer's first day QUIET rather than merely un-hit. And it spends its own
   * shield when it fires (`launchAttack(..., true)` in `brain.ts`), because a bot
   * that raids has to become raidable on the same terms a person does.
   *
   * Asserted through the ordinary service rather than through the brain: what makes
   * this true is that bots act through `startAttack` with `expectedPlayerId` and get
   * no exemption of their own.
   */
  it('binds a commander who acknowledges, whoever is playing them', async () => {
    await shieldMe();
    await shieldThem();
    // Their shield still refuses, acknowledgement or not — the order is the rule.
    await expect(
      launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock, undefined, true),
    ).rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });

    await giveNewcomerShield(f.db, f.playerIds[1]!, new Date(f.clock.now().getTime() - 1));
    const launched = await launchAttack(
      f.db, mine, theirs, { DART: 10 }, f.clock, undefined, true,
    );
    expect(launched.missionId).toBeTypeOf('string');
    expect(await shieldOf(f.playerIds[0]!)).toBeNull();
  });

  /**
   * THE TWO REFUSALS ARE ORDERED, AND THE TARGET'S COMES FIRST.
   *
   * Accepting the loss of your own shield to hit somebody who cannot be hit would
   * spend a day of protection for nothing — the launch is refused either way, and
   * the honest refusal is the one about them.
   */
  it('names the target’s shield rather than the attacker’s when both are up', async () => {
    await shieldMe();
    await shieldThem();
    await expect(
      launchAttack(f.db, mine, theirs, { DART: 10 }, f.clock, undefined, true),
    ).rejects.toMatchObject({ code: 'NEWCOMER_SHIELDED' });
    expect(await shieldOf(f.playerIds[0]!)).not.toBeNull();
  });
});
