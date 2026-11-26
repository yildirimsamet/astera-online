import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { beforeEach, expect, it } from 'vitest';
import { PROBE_DEFENCE } from '@astera/rules';
import { botProfiles, buildOrders, planets, players, probeBatteries, probeShots, satellites, units } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { BOT_PROBE_RETREAT_MINUTES, probeRetreatTargets, tendProbeBattery, type BotSeat } from '../src/services/bots/brain.js';
import { BOT_PERSONAS, personaNamed } from '../src/services/bots/personas.js';
import { planetView } from '../src/services/planetView.js';
import { giveInstrument, grant, seedWorld, setLevel, type Fixture } from './helpers.js';

/**
 * BOTS KEEP A PROBE BATTERY THE WAY PEOPLE DO (owner K5, 2026-11-24; the indistinguishability
 * lock of 2026-10-28). By habit, not all of them: a galaxy where every bot world shoots and no
 * person's does — or the reverse — is a tell. And a bot that loses probes to a battery backs
 * off like a person instead of feeding it one probe a turn for ever.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let seat: BotSeat;

beforeEach(async () => {
  f = await seedWorld(2);
  await addBot(f.db, 'Kara Şahin', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
  const [row] = await f.db.select({
    accountId: players.accountId, playerId: players.id, planetId: planets.id, seasonId: players.seasonId, persona: botProfiles.persona,
  }).from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .limit(1);
  seat = { ...row!, seasonSeed: f.seed, ordinal: 0 };
  await f.db.delete(units).where(eq(units.planetId, seat.planetId));
  await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
  await grant(f.db, seat.planetId, 200_000, 200_000);
  await f.db.update(planets).set({ deuterium: 50_000 }).where(eq(planets.id, seat.planetId));
});

const view = () => f.db.transaction(tx => planetView(tx, seat.planetId, f.clock));
const battery = async () => (await f.db.select().from(probeBatteries).where(eq(probeBatteries.planetId, seat.planetId)))[0];
const tend = async (habit: keyof typeof BOT_PERSONAS) => {
  const did: string[] = [];
  await tendProbeBattery(f.db, f.clock, seat, personaNamed(habit), await view(), did, silent);
  return did;
};
const radar = async (level: number) => {
  // Effective Radar is capped by the Core and needs an Uplink. A seat may start with a
  // Radar in another slot; one Radar row, so the level under test is the one read.
  await setLevel(f.db, seat.planetId, 'CORE', 8);
  await f.db.delete(satellites).where(and(eq(satellites.planetId, seat.planetId), eq(satellites.type, 'RADAR')));
  await giveInstrument(f.db, seat.planetId, 'RADAR', level);
  await f.db.insert(satellites).values({ planetId: seat.planetId, slot: 15, type: 'UPLINK', level: 1 }).onConflictDoNothing();
};

it('keeps one only by habit: some habits do, some never do', () => {
  const habits = Object.values(BOT_PERSONAS);
  expect(habits.some((persona) => persona.keepsProbeBattery)).toBe(true);
  expect(habits.some((persona) => !persona.keepsProbeBattery)).toBe(true);
});

it('builds none below the effective Radar rung', async () => {
  await radar(PROBE_DEFENCE.requiredRadar - 1);
  expect(await tend('BUILDER')).not.toContain('probe-battery:build');
  expect(await battery()).toBeUndefined();
});

it('a habit that keeps one builds it once, from its own store', async () => {
  await radar(PROBE_DEFENCE.requiredRadar);
  expect(await tend('BUILDER')).toContain('probe-battery:build');
  expect(await battery()).toBeDefined();
  // Still building, and the Radar holds no higher rung: nothing more to order.
  expect(await tend('BUILDER')).not.toContain('probe-battery:build');
});

it('raises it a level once it stands and the Radar reaches the next rung, as a person would', async () => {
  await radar(PROBE_DEFENCE.requiredRadar);
  await tend('BUILDER');
  f.clock.advance(PROBE_DEFENCE.levels[0].buildMinutes);
  expect(await tend('BUILDER')).not.toContain('probe-battery:build');
  await radar(PROBE_DEFENCE.levels[1].requiredRadar);
  expect(await tend('BUILDER')).toContain('probe-battery:build');
  expect(await battery()).toMatchObject({ level: 1, upgradeLevel: 2 });
});

it('a habit that does not keep one never builds it', async () => {
  await radar(PROBE_DEFENCE.requiredRadar);
  expect(await tend('RAIDER')).not.toContain('probe-battery:build');
  expect(await battery()).toBeUndefined();
});

it('backs off a world after losing a battery\'s worth of probes there', async () => {
  const target = f.planetIds.find((id) => id !== seat.planetId)!;
  const [defender] = await f.db.select({ id: planets.controllerPlayerId }).from(planets).where(eq(planets.id, target));
  const { missions } = await import('../src/db/schema.js');
  const lose = async () => {
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId, kind: 'probe', ownerPlayerId: seat.playerId, originPlanetId: seat.planetId,
      targetPlanetId: target, fleet: {}, distance: 1, fuelPaid: 0, departAt: f.clock.now(), arriveAt: f.clock.now(), status: 'resolved',
    }).returning();
    await f.db.insert(probeShots).values({ seasonId: f.seasonId, missionId: mission!.id, attackerPlayerId: seat.playerId,
      defenderPlayerId: defender!.id!, targetPlanetId: target, shotAt: f.clock.now(), x: 0, y: 0, z: 0,
      firedAt: f.clock.now(), fromX: 0, fromY: 0, fromZ: 0 });
  };
  for (let i = 1; i < PROBE_DEFENCE.levels[0].capacity; i++) await lose();
  expect(await probeRetreatTargets(f.db, seat.playerId, f.clock.now())).not.toContain(target);
  await lose();
  expect(await probeRetreatTargets(f.db, seat.playerId, f.clock.now())).toContain(target);
  f.clock.advance(BOT_PROBE_RETREAT_MINUTES + 1);
  expect(await probeRetreatTargets(f.db, seat.playerId, f.clock.now())).not.toContain(target);
});
