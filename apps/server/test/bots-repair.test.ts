import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { MULTI_WORLD } from '@astera/rules';
import { botProfiles, buildOrders, planets, players, seasons, units } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { runBotTurn, type BotSeat } from '../src/services/bots/brain.js';
import { planetView } from '../src/services/planetView.js';
import { landShips } from '../src/services/shipDamage.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * A BOT REPAIRS BEFORE IT BUYS. Kalıcı gemi hasarı, `plan.md` F7.
 *
 * A repair costs the damaged share of a new ship, so a hull in the dock is always the
 * cheapest hull a commander can put back on the pad. A bot that bought new ships while
 * its own sat damaged would be the one commander in the galaxy doing the arithmetic
 * backwards — and its dock would fill season-long, which no person's does.
 *
 * It uses the phone's door (`startRepair`), so every rule the station has holds for it.
 */

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

let f: Fixture;
let seat: BotSeat;

const seatOf = async (): Promise<BotSeat> => {
  const [row] = await f.db
    .select({
      accountId: players.accountId,
      playerId: players.id,
      planetId: planets.id,
      seasonId: players.seasonId,
      persona: botProfiles.persona,
    })
    .from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .limit(1);
  return { ...row!, seasonSeed: f.seed, ordinal: 0 };
};

const viewOf = () => f.db.transaction((tx) => planetView(tx, seat.planetId, f.clock));

const dockShips = (fleet: Record<string, number>, damage: { hull: 'BALLISTA' | 'PROSPECTOR' | 'DART'; count: number; damageBp: number }[]) =>
  f.db.transaction((tx) => landShips(tx, {
    planetId: seat.planetId,
    ownerPlayerId: seat.playerId,
    fleet,
    damage,
    at: f.clock.now(),
  }));

/** Only what a store holds: the bot's own planet row, set outright. */
const store = (alloy: number, crystal: number, deuterium: number) =>
  f.db.update(planets).set({ alloy, crystal, deuterium }).where(eq(planets.id, seat.planetId));

beforeEach(async () => {
  f = await seedWorld(2);
  await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion })
    .where(eq(seasons.id, f.seasonId));
  await addBot(f.db, 'Kara Şahin', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
  seat = await seatOf();
  // A graduate's opening ships and queued Core are noise here (see bots-turn.test).
  await f.db.delete(units).where(eq(units.planetId, seat.planetId));
  await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
  await setLevel(f.db, seat.planetId, 'SHIPYARD', 4);
});

describe('a bot and its Repair Station', () => {
  it('repairs what waits in the dock, and does it before it buys a ship', async () => {
    await dockShips({ BALLISTA: 2 }, [{ hull: 'BALLISTA', count: 2, damageBp: 6400 }]);
    await grant(f.db, seat.planetId, 200_000, 80_000);

    const { did } = await runBotTurn(f.db, f.clock, seat, silent);

    expect(did).toContain('repair');
    const ships = did.findIndex((step) => step.startsWith('ship:'));
    if (ships >= 0) expect(did.indexOf('repair')).toBeLessThan(ships);
    const view = await viewOf();
    expect(view.dock.lots.every((lot) => lot.repairing)).toBe(true);
    expect(view.queues.REPAIR).toHaveLength(1);
  });

  it('repairs the lots it can pay for when it cannot pay for them all', async () => {
    await dockShips({ BALLISTA: 1 }, [{ hull: 'BALLISTA', count: 1, damageBp: 9000 }]);
    await dockShips({ DART: 1 }, [{ hull: 'DART', count: 1, damageBp: 3000 }]);
    const before = await viewOf();
    const dart = before.dock.lots.find((lot) => lot.hull === 'DART')!;
    const ballista = before.dock.lots.find((lot) => lot.hull === 'BALLISTA')!;
    // Enough for the Dart's repair, never for the Ballista's.
    expect(ballista.cost.alloy).toBeGreaterThan(dart.cost.alloy);
    await store(dart.cost.alloy, dart.cost.crystal, dart.cost.deuterium);

    const { did } = await runBotTurn(f.db, f.clock, seat, silent);

    expect(did).toContain('repair');
    const after = await viewOf();
    expect(after.dock.lots.find((lot) => lot.hull === 'DART')?.repairing).toBe(true);
    expect(after.dock.lots.find((lot) => lot.hull === 'BALLISTA')?.repairing).toBe(false);
  });

  it('does nothing and loses nothing when it can pay for none', async () => {
    await dockShips({ BALLISTA: 1 }, [{ hull: 'BALLISTA', count: 1, damageBp: 9000 }]);
    await store(0, 0, 0);

    const { did } = await runBotTurn(f.db, f.clock, seat, silent);

    expect(did).not.toContain('repair');
    expect((await viewOf()).dock.lots[0]?.repairing).toBe(false);
  });

  it('counts a docked craft as its own, so it does not buy a second', async () => {
    await dockShips({ PROSPECTOR: 1 }, [{ hull: 'PROSPECTOR', count: 1, damageBp: 5000 }]);
    await grant(f.db, seat.planetId, 200_000, 80_000);

    const { did } = await runBotTurn(f.db, f.clock, seat, silent);

    expect(did).not.toContain('ship:PROSPECTOR');
  });
});
