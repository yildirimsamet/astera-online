import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLAN,
  MULTI_WORLD,
  PLANET_START,
  SERVERS,
  activeAsteroids,
  distance,
  missionFuel,
  type AsteroidSpec,
} from '@astera/rules';
import { missions, neutralPlanetState, planets, seasons } from '../src/db/schema.js';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { assertFuel, fuelAvailable } from '../src/services/fuel.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining } from '../src/services/mining.js';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  createClan,
} from '../src/services/clan.js';
import { launchClanAid, quoteClanAid } from '../src/services/clanAid.js';
import { launchSettlement, launchTransfer } from '../src/services/movement.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  fuelUp,
  giveUnits,
  grant,
  levelWorld,
  makeAccount,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  truncateAll,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

const deuteriumAt = async (f: Fixture, planetId: string): Promise<number> => {
  const [world] = await f.db.select().from(planets).where(eq(planets.id, planetId));
  return Math.floor(world!.deuterium);
};

const distanceBetween = async (f: Fixture, a: string, b: string): Promise<number> => {
  const [from] = await f.db.select().from(planets).where(eq(planets.id, a));
  const [to] = await f.db.select().from(planets).where(eq(planets.id, b));
  return distance(from!, to!);
};

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * EVERY LAUNCH BURNS FUEL, AND IT IS PAID BEFORE THE SHIPS LEAVE. T6.
 *
 * FULL FUEL OR NO LAUNCH — owner instruction. A one-way budget is not a cheaper
 * raid, it is a stranded fleet, and P3 says a launched fleet cannot be recalled:
 * there is no way back out of that mistake, so the game does not let it be made.
 *
 * TWO CRAFT PAY NOTHING, and both exemptions are load-bearing. A probe is the
 * thing the measured gate metric counts — "at least half of attacks preceded by a
 * probe or telescope read" — and D121 already rationed it once; rationing the same
 * act twice would break the number being measured. A mining run is how deuterium
 * gets to a world in the first place, and charging it deuterium is a deadlock with
 * extra steps.
 */
describe('fuel', () => {
  let f: Fixture;
  let mine: string;
  let target: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, target] = f.planetIds as [string, string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await grant(f.db, mine, 200_000, 60_000);
    await grant(f.db, target, 40_000, 8_000);
    // The two purses are different sizes, so `grant` leaves the two Cores in
    // different tier bands and every launch below is refused. D168.
    await levelWorld(f.db, f.planetIds);
    f.clock.advance(250);
  });

  it('charges an attack for both legs, at launch', async () => {
    await giveUnits(f.db, mine, { DART: 60, COURIER: 4 });
    await fuelUp(f.db, mine, 5_000);
    const dist = await distanceBetween(f, mine, target);
    const expected = missionFuel({ DART: 60, COURIER: 4 }, dist, 2);
    expect(expected).toBeGreaterThan(0);

    await launchAttack(f.db, mine, target, { DART: 60, COURIER: 4 }, f.clock);

    expect(await deuteriumAt(f, mine)).toBe(5_000 - expected);
  });

  it('refuses a launch the tank cannot cover, and says by how much', async () => {
    await giveUnits(f.db, mine, { DART: 400 });
    await fuelUp(f.db, mine, 3);

    await expect(
      launchAttack(f.db, mine, target, { DART: 400 }, f.clock),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL', params: { have: 3 } });
    // Nothing left, and nothing was taken for the attempt.
    expect(await f.db.select().from(missions)).toHaveLength(0);
    expect(await deuteriumAt(f, mine)).toBe(3);
  });

  it('charges a transfer for the one leg it flies', async () => {
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, target));
    await giveUnits(f.db, mine, { DART: 40 });
    await fuelUp(f.db, mine, 5_000);
    const dist = await distanceBetween(f, mine, target);

    await launchTransfer(
      f.db, f.playerIds[0]!, mine, target, { DART: 40 },
      { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
    );

    expect(await deuteriumAt(f, mine)).toBe(5_000 - missionFuel({ DART: 40 }, dist, 1));
  });

  describe('what never pays', () => {
    it('lets a probe fly on an empty tank', async () => {
      await fuelUp(f.db, mine, 0);
      await expect(launchProbe(f.db, mine, target, f.clock)).resolves.toBeTruthy();
      expect(await deuteriumAt(f, mine)).toBe(0);
    });

    /**
     * THE EXEMPTION THAT KEEPS THE GAME FROM DEADLOCKING. Deuterium comes off
     * rocks; charging deuterium to go and fetch it would mean a world that ran dry
     * could never refill, and the one act that could save it would be the one act
     * it could no longer afford.
     */
    it('sends a mining run on an empty tank', async () => {
      await placeAt(f.db, mine, { x: 0 });
      await setLevel(f.db, mine, 'SHIPYARD', 2);
      await giveUnits(f.db, mine, { PROSPECTOR: 1 });
      await fuelUp(f.db, mine, 0);

      const seasonStart = new Date('2026-01-01T00:00:00.000Z');
      let rock: AsteroidSpec | undefined;
      for (let attempt = 0; attempt < 400 && !rock; attempt++) {
        const minutes = (f.clock.now().getTime() - seasonStart.getTime()) / 60_000;
        rock = activeAsteroids(f.asteroids, minutes).find((a) => a.expiresAt - minutes > 45);
        if (!rock) f.clock.advance(30);
      }
      if (!rock) throw new Error('no usable asteroid in the disc — fixture assumption broke');

      await expect(launchMining(f.db, mine, rock.index, 1, f.clock)).resolves.toBeTruthy();
      expect(await deuteriumAt(f, mine)).toBe(0);
    });

    /**
     * A strike carries no fleet, so `missionFuel` charges it nothing — and that is
     * the right answer rather than a gap: its three thousand deuterium were paid
     * at construction, and billing the flight would charge the same decision twice.
     */
    it('leaves the Death Star to the deuterium it was built with', () => {
      expect(missionFuel({}, 2_000, 1)).toBe(0);
    });
  });

  /**
   * NO SYSTEM PATH ASKS FOR MORE, AND NO CANCELLATION GIVES ANY BACK.
   *
   * A rerouted leg can be longer than the one that was paid for — the destination
   * changed hands, or could not take the payload. That is a system fault rather
   * than a decision, and charging for it would make the quote on the launch screen
   * a lie about a flight the player did choose.
   */
  it('flies a rerouted leg on fuel nobody is asked for', async () => {
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, target));
    await giveUnits(f.db, mine, { DART: 20 });
    await fuelUp(f.db, mine, 5_000);
    const launched = await launchTransfer(
      f.db, f.playerIds[0]!, mine, target, { DART: 20 },
      { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
    );
    const afterLaunch = await deuteriumAt(f, mine);

    // The destination stops being theirs while the squadron is in the air.
    await f.db
      .update(planets)
      .set({ controllerPlayerId: null, kind: 'NEUTRAL' })
      .where(eq(planets.id, target));
    f.clock.set(launched.arriveAt);
    await workerFor(f).tick();
    const [home] = await f.db.select().from(missions).where(eq(missions.status, 'in_flight'));
    f.clock.set(home!.arriveAt);
    await workerFor(f).tick();

    expect(await deuteriumAt(f, mine)).toBe(afterLaunch);
  });

  it('opens a world with a tank and no way to refill it', async () => {
    const fresh = await seedWorld(2, 909);
    expect(await deuteriumAt(fresh, fresh.planetIds[0]!)).toBe(PLANET_START.deuterium);
  });
});

/**
 * THE TWO THINGS A TRANSFER SPENDS DEUTERIUM ON, AND THEY SHARE ONE STORE.
 *
 * The cargo check and the fuel check each passed on their own and nothing looked
 * at the sum, so a commander shipping their whole tank as cargo wrote the store as
 * `held - cargo - fuel` — negative. Nothing downstream defends against that: the
 * lazy tick, the loot maths and the readout all take the number at face value.
 */
describe('a transfer cannot spend the same deuterium twice', () => {
  let f: Fixture;
  let mine: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, colony] = f.planetIds as [string, string];
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await setLevel(f.db, mine, 'CORE', 8);
    await giveUnits(f.db, mine, { COURIER: 6 });
  });

  const send = (cargoDeuterium: number) => launchTransfer(
    f.db, f.playerIds[0]!, mine, colony, { COURIER: 6 },
    { alloy: 0, crystal: 0, deuterium: cargoDeuterium }, f.clock,
  );

  it('refuses to ship the whole tank and fly on it as well', async () => {
    await fuelUp(f.db, mine, 100);
    const dist = await distanceBetween(f, mine, colony);
    const fuel = missionFuel({ COURIER: 6 }, dist, 1);
    expect(fuel).toBeGreaterThan(0);

    await expect(send(100)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });
    // And the store is exactly where it was: a refusal costs nothing.
    expect(await deuteriumAt(f, mine)).toBe(100);
  });

  it('never writes a negative store, whatever the split', async () => {
    await fuelUp(f.db, mine, 100);
    const dist = await distanceBetween(f, mine, colony);
    const fuel = missionFuel({ COURIER: 6 }, dist, 1);

    // The largest cargo that still leaves the fuel behind.
    await expect(send(100 - fuel)).resolves.toBeTruthy();
    expect(await deuteriumAt(f, mine)).toBe(0);
  });
});

/**
 * ONE STATEMENT OF "FULL FUEL OR NO LAUNCH". T6 — owner instruction.
 *
 * The rule was written out four times, once per launch path, and one of the four
 * got it wrong: `launchTransfer` compared the tank against the flight and, one
 * line above, the tank against the cargo — never against the SUM — so a commander
 * shipping their whole tank as cargo wrote a NEGATIVE store. That is what a
 * duplicated guard costs, and the fix is not a fifth copy.
 *
 * THE HOLD IS SPENT BEFORE THE ENGINES ARE. Deuterium in a cargo bay has already
 * left the world as far as the flight is concerned, so it comes off the top and
 * the refusal quotes what is genuinely left.
 */
describe('the fuel guard', () => {
  it('leaves what the hold has not already taken', () => {
    expect(fuelAvailable(100)).toBe(100);
    expect(fuelAvailable(100, 40)).toBe(60);
  });

  it('never reports a negative tank, whatever the hold does to it', () => {
    expect(fuelAvailable(100, 400)).toBe(0);
    try {
      assertFuel(1, 100, 400);
      throw new Error('a tank the cargo has emptied must not fly');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INSUFFICIENT_FUEL', params: { needed: 1, have: 0 } });
    }
  });

  it('refuses the launch whose cargo eats the flight, and says by how much', () => {
    expect(() => { assertFuel(10, 100, 95); }).toThrow();
    try {
      assertFuel(10, 100, 95);
    } catch (error) {
      expect(error).toMatchObject({ code: 'INSUFFICIENT_FUEL', params: { needed: 10, have: 5 } });
    }
  });

  /** A fraction of a drop is not a drop: the store is a float, the quote is not. */
  it('floors what it says the commander is holding', () => {
    try {
      assertFuel(10, 9.87);
    } catch (error) {
      expect(error).toMatchObject({ params: { needed: 10, have: 9 } });
    }
  });

  it('lets exactly enough fly', () => {
    expect(() => { assertFuel(10, 10); }).not.toThrow();
    expect(() => { assertFuel(10, 30, 20); }).not.toThrow();
  });
});

/**
 * THE OTHER THREE LAUNCH PATHS, AND WHAT EACH OF THEM BURNS. T6.
 *
 * The raid and the transfer had tests from the day fuel landed. The settlement and
 * clan aid did not, and both charge — so the only thing standing between either of
 * them and a silent free launch was that nobody had edited them yet. A mining run
 * pays nothing, and that exemption is load-bearing enough to be asserted rather
 * than remembered: deuterium comes off rocks, and charging deuterium to go and get
 * it is a deadlock with extra steps.
 */
describe('the settlement pays for the leg its settlers fly', () => {
  const HOME = 0;
  const CLAIM = 1_200;
  const FLEET = { COURIER: MULTI_WORLD.settlement.transports };

  async function claimOpen() {
    const { db } = await testDb();
    await truncateAll(db);
    const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-FUEL',
      seed: 91273,
      startsAt: clock.now(),
      playerCap: SERVERS.capacity,
      rulesetVersion: MULTI_WORLD.rulesetVersion,
    });
    const account = await makeAccount(db, 'Founder');
    const joined = await joinSeason(db, account.id, season.id, clock);
    const [neutral] = await db
      .select({ world: planets, state: neutralPlanetState })
      .from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
      .limit(1);
    if (!neutral) throw new Error('a v3 season must seed neutral worlds');

    await setLevel(db, joined.planetId, 'CORE', 8);
    await placeAt(db, joined.planetId, { x: HOME });
    await placeAt(db, neutral.world.id, { x: CLAIM });
    await db.update(planets).set({ alloy: 40_000, crystal: 20_000 })
      .where(eq(planets.id, joined.planetId));
    await giveUnits(db, joined.planetId, FLEET);
    await db.update(neutralPlanetState)
      .set({ claimUntil: new Date(clock.now().getTime() + 40 * 60_000) })
      .where(eq(neutralPlanetState.planetId, neutral.world.id));

    return { db, clock, joined, neutralId: neutral.world.id };
  }

  /** One leg: the settlers land and become the colony. There is no coming back. */
  const cost = missionFuel(FLEET, CLAIM - HOME, 1);

  it('takes the flight and the founding stock out of one store', async () => {
    const f = await claimOpen();
    await f.db.update(planets).set({ deuterium: 500 }).where(eq(planets.id, f.joined.planetId));
    expect(cost).toBeGreaterThan(0);

    await launchSettlement(f.db, f.joined.playerId, f.joined.planetId, f.neutralId, f.clock);

    const [home] = await f.db.select().from(planets).where(eq(planets.id, f.joined.planetId));
    /*
      BOTH, AND THE SECOND ONE IS ZERO TODAY. `settlement.cost.deuterium` is the
      stock the settlers carry to the new world; the day it stops being zero this
      assertion is what stops the world flying on deuterium it has given away.
    */
    expect(Math.floor(home!.deuterium))
      .toBe(500 - cost - MULTI_WORLD.settlement.cost.deuterium);
  });

  it('refuses a founding the tank cannot fly, and takes nothing for the attempt', async () => {
    const f = await claimOpen();
    await f.db.update(planets).set({ deuterium: cost - 1 })
      .where(eq(planets.id, f.joined.planetId));

    await expect(
      launchSettlement(f.db, f.joined.playerId, f.joined.planetId, f.neutralId, f.clock),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUEL',
      params: { needed: cost, have: cost - 1 },
    });

    const [home] = await f.db.select().from(planets).where(eq(planets.id, f.joined.planetId));
    const [target] = await f.db.select().from(planets).where(eq(planets.id, f.neutralId));
    expect(Math.floor(home!.deuterium)).toBe(cost - 1);
    expect(home!.alloy).toBe(40_000);
    expect(target!.kind).toBe('NEUTRAL');
    expect(await f.db.select().from(missions)).toHaveLength(0);
  });
});

/**
 * A GIFT IS PAID FOR BY THE COMMANDER WHO SENDS IT. T6.
 *
 * One leg — the craft become the recipient's and never come home — and the sender
 * burns it, because the sender is the one making the decision and because a gift
 * that cost the receiver something is not a gift.
 *
 * AND THE QUOTE HAS TO KNOW, or it answers "send this" to a payload the launch
 * then refuses. That was the failure mode the fuel pass was warned about by name:
 * a screen causing a refusal it cannot explain.
 */
describe('clan aid burns the sender fuel, and the quote says so first', () => {
  const AWAY = 2_000;
  const FLEET = { COURIER: 3 };

  async function clanOfTwo() {
    const f = await seedWorld(3, 114114);
    await f.db.update(seasons).set({ rulesetVersion: 3 }).where(eq(seasons.id, f.seasonId));
    for (const planetId of f.planetIds) {
      await grant(f.db, planetId, 120_000, 60_000);
      await setLevel(f.db, planetId, 'SHIPYARD', 4);
    }
    await levelWorld(f.db, f.planetIds);
    // Far enough apart that the flight costs more than a rounding artefact.
    await placeAt(f.db, f.planetIds[0]!, { x: 0 });
    await placeAt(f.db, f.planetIds[1]!, { x: AWAY });

    const leader = await clanActor(f.db, f.accountIds[0]!);
    const { clanId } = await f.db.transaction((tx) => createClan(tx, {
      actor: leader,
      name: 'Orion Guard',
      tag: 'OG',
      description: 'Five commanders, one horizon.',
      recruiting: true,
      clock: f.clock,
    }));
    const candidate = await clanActor(f.db, f.accountIds[1]!);
    const application = await f.db.transaction((tx) => applyToClan(tx, {
      actor: candidate,
      clanId,
      now: f.clock.now(),
    }));
    const accepting = await clanActor(f.db, f.accountIds[0]!);
    await f.db.transaction((tx) => acceptClanRequest(tx, {
      actor: accepting,
      requestId: application.requestId,
      acknowledgeHostile: false,
      now: f.clock.now(),
    }));
    f.clock.advance(CLAN.adaptationMinutes);
    await giveUnits(f.db, f.planetIds[0]!, FLEET);
    return f;
  }

  const payload = (f: Fixture, cargoDeuterium = 0) => ({
    senderPlayerId: f.playerIds[0]!,
    originPlanetId: f.planetIds[0]!,
    recipientPlayerId: f.playerIds[1]!,
    targetPlanetId: f.planetIds[1]!,
    fleet: FLEET,
    cargo: { alloy: 0, crystal: 0, deuterium: cargoDeuterium },
  });

  it('charges the sender one leg and quotes the same figure before the send', async () => {
    const f = await clanOfTwo();
    const dist = await distanceBetween(f, f.planetIds[0]!, f.planetIds[1]!);
    const expected = missionFuel(FLEET, dist, 1);
    expect(expected).toBeGreaterThan(0);
    await fuelUp(f.db, f.planetIds[0]!, 4_000);

    const quote = await quoteClanAid(f.db, { ...payload(f), now: f.clock.now() });
    expect(quote.fuel).toBe(expected);
    expect(quote.hasFuel).toBe(true);

    await f.db.transaction((tx) => launchClanAid(tx, { ...payload(f), clock: f.clock }));

    expect(await deuteriumAt(f, f.planetIds[0]!)).toBe(4_000 - expected);
  });

  it('refuses aid the tank cannot fly, and the quote refuses it first', async () => {
    const f = await clanOfTwo();
    const dist = await distanceBetween(f, f.planetIds[0]!, f.planetIds[1]!);
    const expected = missionFuel(FLEET, dist, 1);
    await fuelUp(f.db, f.planetIds[0]!, expected - 1);

    const quote = await quoteClanAid(f.db, { ...payload(f), now: f.clock.now() });
    expect(quote.fuel).toBe(expected);
    expect(quote.hasFuel).toBe(false);

    await expect(
      f.db.transaction((tx) => launchClanAid(tx, { ...payload(f), clock: f.clock })),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUEL',
      params: { needed: expected, have: expected - 1 },
    });
    expect(await deuteriumAt(f, f.planetIds[0]!)).toBe(expected - 1);
  });

  /**
   * THE HOLD IS SPENT BEFORE THE ENGINES ARE, AND THE QUOTE COUNTS IT THE SAME WAY.
   * A Hauler loaded with the last of the tank is a Hauler that cannot take off.
   */
  it('counts deuterium in the hold against the flight, on both surfaces', async () => {
    const f = await clanOfTwo();
    const dist = await distanceBetween(f, f.planetIds[0]!, f.planetIds[1]!);
    // A loaded aid convoy reserves both the delivery and return legs up front.
    const expected = missionFuel(FLEET, dist, 2);
    await fuelUp(f.db, f.planetIds[0]!, expected + 100);

    const quote = await quoteClanAid(f.db, { ...payload(f, 101), now: f.clock.now() });
    expect(quote.hasFuel).toBe(false);

    await expect(
      f.db.transaction((tx) => launchClanAid(tx, { ...payload(f, 101), clock: f.clock })),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });

    // One deuterium less in the hold and the same flight is affordable.
    await expect(
      f.db.transaction((tx) => launchClanAid(tx, { ...payload(f, 100), clock: f.clock })),
    ).resolves.toBeTruthy();
    expect(await deuteriumAt(f, f.planetIds[0]!)).toBe(0);
  });
});
