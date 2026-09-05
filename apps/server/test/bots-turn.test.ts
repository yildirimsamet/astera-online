import { beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import { botProfiles, buildOrders, buildings, missions, planets, players } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import {
  drawLane, openLanes, raidCandidates, raidingWing, runBotTurn, type BotSeat,
} from '../src/services/bots/brain.js';
import { BOTS, BOT_PERSONAS, type BotPersona } from '../src/services/bots/personas.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { addMinutes } from '../src/clock.js';
import { fuelUp, giveUnits, grant, seedWorld, setLevel, type Fixture } from './helpers.js';

/**
 * WHAT ONE OF THEM IS ALLOWED TO DO.
 *
 * Two halves, and the second is the one that matters. The first is that a turn
 * actually plays: an idle world is the bug this feature exists to fix, so a
 * commander with money in the bank has to spend it. The second is the restraint —
 * a raid needs a record it earned, and a person who just joined is not a target.
 */

const silent = pino({ level: 'silent' });

let f: Fixture;
let seat: BotSeat;

/** The bot's own world, and its two human neighbours from the fixture. */
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
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .limit(1);
  return { ...row!, seasonSeed: f.seed, ordinal: 0 };
};

const viewOf = async () => f.db.transaction((tx) => planetView(tx, seat.planetId, f.clock));

const remember = async (targetPlanetId: string, seenAt: Date): Promise<void> => {
  await f.db.transaction(async (tx) => {
    await rememberWorld(tx, {
      observerPlayerId: seat.playerId,
      targetPlanetId,
      seasonId: seat.seasonId,
      seenAt,
      source: 'PROBE',
    });
  });
};

/** Nobody in this fixture joined recently enough to be a protected newcomer. */
const settleNeighbours = async (): Promise<void> => {
  await f.db
    .update(players)
    .set({ joinedAt: addMinutes(f.clock.now(), -(BOTS.newPlayerGraceHours + 24) * 60) })
    .where(sql`true`);
};

beforeEach(async () => {
  f = await seedWorld(2);
  await addBot(f.db, 'Kara Şahin', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
  seat = await seatOf();
  await settleNeighbours();
});

describe('a bot turn', () => {
  it('spends what it has rather than sitting on it', async () => {
    await grant(f.db, seat.planetId, 200_000, 80_000);
    const result = await runBotTurn(f.db, f.clock, seat, silent);
    expect(result.did.length).toBeGreaterThan(0);

    const orders = await f.db
      .select({ id: buildOrders.id })
      .from(buildOrders)
      .where(eq(buildOrders.planetId, seat.planetId));
    expect(orders.length).toBeGreaterThan(0);
  });

  it('never lifts its Core past the ceiling the owner set', async () => {
    // `grant` raises the Core to whatever will hold the purse, so the ceiling is
    // set AFTER the money — otherwise the fixture is what breaks the rule.
    await grant(f.db, seat.planetId, 400_000, 150_000);
    await setLevel(f.db, seat.planetId, 'CORE', BOTS.coreCeiling);
    for (let turn = 0; turn < 6; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      f.clock.advance(1);
    }
    const queuedCore = await f.db
      .select({ subject: buildOrders.subject })
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.subject, 'CORE')));
    expect(queuedCore).toHaveLength(0);

    const [core] = await f.db
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, seat.planetId), eq(buildings.type, 'CORE')));
    expect(core?.level).toBe(BOTS.coreCeiling);
  });

  it('does not offer a raid to a world that owns no warship', async () => {
    // A young world owns a Prospector and no warships. Counting "does it own
    // anything that flies" opens the raid and pirate lanes, `raidingWing` then
    // returns an empty manifest, and the turn's ONE flight is spent on nothing —
    // on exactly the commanders whose worlds most need to look busy.
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 1 });
    const lanes = openLanes(await viewOf());
    expect(lanes).toContain('mine');
    expect(lanes).toContain('harvest');
    expect(lanes).not.toContain('attack');
    expect(lanes).not.toContain('pirate');
  });

  it('offers a raid the moment there is something to raid with', async () => {
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 1, DART: 3 });
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);
    expect(openLanes(await viewOf())).toEqual(
      expect.arrayContaining(['probe', 'mine', 'harvest', 'pirate', 'attack']),
    );
  });

  it('always leaves scouting open, even with nothing on the pad', async () => {
    // A world with no craft at all still has something to do with its turn, and it
    // is the lane that earns the record every raid needs.
    expect(openLanes(await viewOf())).toEqual(['probe']);
  });

  it('survives a world that can afford nothing at all', async () => {
    await f.db.update(planets)
      .set({ alloy: 0, crystal: 0, deuterium: 0 })
      .where(eq(planets.id, seat.planetId));
    await expect(runBotTurn(f.db, f.clock, seat, silent)).resolves.toBeDefined();
  });
});

describe('what a bot may raid', () => {
  it('refuses every world it has never had eyes on', async () => {
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  it('accepts a world once it holds a fresh record of it', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates.map((c) => c.planetId)).toEqual([f.planetIds[0]]);
  });

  it('lets a record go stale, exactly as the record age says', async () => {
    await remember(f.planetIds[0]!, addMinutes(f.clock.now(), -(BOTS.recordFreshMinutes + 1)));
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  it('leaves a commander who joined this week alone', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await f.db
      .update(players)
      .set({ joinedAt: addMinutes(f.clock.now(), -60) })
      .where(eq(players.id, f.playerIds[0]!));
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  it('does not punch down past the band', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await setLevel(f.db, seat.planetId, 'CORE', 8);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 8 - BOTS.playerCoreFloorGap - 1);
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  /**
   * A BOT NEVER OFFERS ITSELF A TARGET THE GATE WOULD REFUSE. D168.
   *
   * The band is enforced at launch for everybody, bots included, so a candidate
   * list that ignores it does not produce a rule-breaking raid — it produces a
   * wasted turn and a logged refusal, once per sweep, on the commanders whose
   * whole job is to make the disc look busy. `withinTierBand` is read here rather
   * than re-derived, so the list and the gate cannot drift apart.
   */
  it('drops a world whose commander is outside the band, in both directions', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await setLevel(f.db, seat.planetId, 'CORE', 8); // tier 3

    await setLevel(f.db, f.planetIds[0]!, 'CORE', 14); // tier 5, two up
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(0);

    await setLevel(f.db, f.planetIds[0]!, 'CORE', 11); // tier 4, inside the band
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(1);
  });

  it('measures the target commander, not the world it is looking at', async () => {
    // The remembered world is tier 1; its owner also holds a tier 5 capital, and
    // the band reads the commander.
    await remember(f.planetIds[1]!, f.clock.now());
    await setLevel(f.db, seat.planetId, 'CORE', 2); // tier 1
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 1);
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 14); // tier 5 capital

    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(0);
  });

  it('weighs another bot above a person', async () => {
    await addBot(f.db, 'Yıldız', f.clock);
    await ensureBotSeats(f.db, f.clock, silent);
    const [other] = await f.db
      .select({ planetId: planets.id })
      .from(players)
      .innerJoin(planets, and(
        eq(planets.controllerPlayerId, players.id),
        eq(planets.kind, 'CAPITAL'),
      ))
      .where(and(
        sql`${players.accountId} IN (SELECT account_id FROM bot_profiles)`,
        sql`${planets.id} <> ${seat.planetId}`,
      ))
      .limit(1);
    await remember(other!.planetId, f.clock.now());
    await remember(f.planetIds[0]!, f.clock.now());

    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    const bot = candidates.find((c) => c.planetId === other!.planetId);
    const human = candidates.find((c) => c.planetId === f.planetIds[0]);
    expect(bot?.weight).toBe(BOTS.botTargetBias);
    expect(human?.weight).toBe(1);
    expect(bot!.weight).toBeGreaterThan(human!.weight);
  });

  it('keeps a garrison at home rather than flying the whole fleet', () => {
    const send = raidingWing({ DART: 10, RAMPART: 4, PROSPECTOR: 2, BASTION: 3 }, 0.7);
    expect(send.DART).toBe(7);
    expect(send.RAMPART).toBe(2);
    // A miner does not raid and a gun does not fly.
    expect(send.PROSPECTOR).toBeUndefined();
    expect(send.BASTION).toBeUndefined();
  });

  it('actually launches at a world it is allowed to hit', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await giveUnits(f.db, seat.planetId, { DART: 30 });
    await fuelUp(f.db, seat.planetId);
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);

    // The lane is drawn from the habit's weights, so give the turn several chances
    // rather than reaching inside the draw.
    for (let turn = 0; turn < 25; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      const flying = await f.db
        .select({ id: missions.id })
        .from(missions)
        .where(and(eq(missions.originPlanetId, seat.planetId), eq(missions.kind, 'attack')));
      if (flying.length > 0) return;
      f.clock.advance(1);
    }
    throw new Error('a bot with a fresh record, ships and fuel never raided');
  });
});

/**
 * A WEIGHT OF ZERO MEANS NEVER. D166.
 *
 * Both weighted draws in this file walked their table as `roll -= weight; if
 * (roll <= 0) return`. `mulberry32` can return exactly 0, which makes `roll` 0 —
 * and the FIRST entry then satisfies `0 <= 0` however small its weight is. So a
 * persona configured never to raid could still launch one, and a candidate list
 * whose first world was worth nothing could still be picked.
 *
 * It is rare by construction and that is precisely why it needed a test: a bug that
 * fires on one draw in four billion is one nobody will ever reproduce by playing.
 */
describe('drawing from a weighted table', () => {
  const zeroRng = () => 0;
  /** A persona with exactly the weights this test cares about and nothing else. */
  const weighted = (over: Partial<BotPersona['flight']>): BotPersona => ({
    ...BOT_PERSONAS.BUILDER,
    flight: { probe: 0, mine: 0, harvest: 0, pirate: 0, attack: 0, idle: 0, ...over },
  });

  it('never draws a lane the persona has weighted at zero', () => {
    const persona = weighted({ attack: 0, probe: 0, mine: 0, idle: 1 });
    expect(drawLane(persona, ['attack', 'probe', 'mine'], zeroRng)).toBeNull();
  });

  it('still draws the only lane that has any weight', () => {
    const persona = weighted({ attack: 0, probe: 1, mine: 0, idle: 0 });
    expect(drawLane(persona, ['attack', 'probe', 'mine'], zeroRng)).toBe('probe');
  });

  it('returns nothing when every lane is weighted at zero', () => {
    const persona = weighted({ attack: 0, probe: 0, mine: 0, idle: 0 });
    expect(drawLane(persona, ['attack'], zeroRng)).toBeNull();
  });

  /** The ordinary case is untouched: a full-weight table still answers. */
  it('draws normally from a table that has weight in it', () => {
    // `idle` is the table's last entry and is weighted at zero here, so a high roll
    // has to land on a real lane rather than on doing nothing.
    const persona = weighted({ attack: 1, probe: 1, mine: 1, idle: 0 });
    expect(drawLane(persona, ['attack', 'probe'], () => 0.99)).toBe('probe');
  });
});
