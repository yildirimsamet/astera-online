import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { beforeEach, expect, it } from 'vitest';
import { NOTIFICATION_CENTER, alertPrice } from '@astera/rules';
import { botProfiles, buildOrders, notificationCenters, planets, players, satellites, units } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { BOT_CENTER_ALERTS, runBotTurn, tendNotificationCenter, type BotSeat } from '../src/services/bots/brain.js';
import { personaNamed } from '../src/services/bots/personas.js';
import { commanderDeuteriumPerHour } from '../src/services/notificationCenter.js';
import { planetView } from '../src/services/planetView.js';
import { giveInstrument, grant, seedWorld, type Fixture } from './helpers.js';

/**
 * BOTS KEEP A BİLDİRİM MERKEZİ LIKE PEOPLE DO. Owner 2026-10-30, decision 10 (LOCKED):
 * "botlar da Merkez kurar ve kasa doldurur; sonda onları insan gibi okur. Botlara push
 * gitmez." A probe over a bot must read the same ladder a person's world gives.
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
});

const view = () => f.db.transaction(tx => planetView(tx, seat.planetId, f.clock));
const center = async () => (await f.db.select().from(notificationCenters).where(eq(notificationCenters.playerId, seat.playerId)))[0];
const tend = async () => {
  const did: string[] = [];
  const after = await tendNotificationCenter(f.db, f.clock, seat, personaNamed(seat.persona), await view(), did, silent);
  return { did, after };
};
const setDeuterium = (amount: number) => f.db.update(planets).set({ deuterium: amount }).where(eq(planets.id, seat.planetId));

it('builds no centre before it has a Radar to warn from', async () => {
  await grant(f.db, seat.planetId, 200_000, 200_000);
  await f.db.delete(satellites).where(and(eq(satellites.planetId, seat.planetId), eq(satellites.type, 'RADAR')));
  const { did } = await tend();
  expect(did).not.toContain('notification-center:build');
  expect(await center()).toBeUndefined();
});

it('builds the centre once, from its own store, once it has a Radar', async () => {
  await giveInstrument(f.db, seat.planetId, 'RADAR', 1);
  await grant(f.db, seat.planetId, 200_000, 200_000);
  const before = (await view()).planet;
  const { did, after } = await tend();
  expect(did).toContain('notification-center:build');
  expect(await center()).toBeDefined();
  expect(before.alloy - after.planet.alloy).toBeCloseTo(NOTIFICATION_CENTER.buildCost.alloy, 0);
  expect(before.crystal - after.planet.crystal).toBeCloseTo(NOTIFICATION_CENTER.buildCost.crystal, 0);
  const again = await tend();
  expect(again.did).not.toContain('notification-center:build');
});

it('fills the wallet to a few alerts, never past its own mark, and keeps half its deuterium', async () => {
  await giveInstrument(f.db, seat.planetId, 'RADAR', 1);
  await grant(f.db, seat.planetId, 200_000, 200_000);
  await tend();
  await setDeuterium(100_000);
  const held = (await view()).planet.deuterium;
  const { did, after } = await tend();
  expect(did).toContain('notification-center:fund');
  const price = alertPrice('incoming_attack', 'T5', await f.db.transaction(tx => commanderDeuteriumPerHour(tx, seat.playerId)));
  const wallet = (await center())!.wallet;
  expect(wallet).toBeGreaterThanOrEqual(BOT_CENTER_ALERTS.min * price);
  expect(wallet).toBeLessThanOrEqual(BOT_CENTER_ALERTS.max * price);
  expect(after.planet.deuterium).toBeGreaterThanOrEqual(held / 2 - 1);

  const full = await tend();
  expect(full.did).not.toContain('notification-center:fund');
  expect((await center())!.wallet).toBe(wallet);
});

it('does not trickle in less than one alert at a time', async () => {
  await giveInstrument(f.db, seat.planetId, 'RADAR', 1);
  await grant(f.db, seat.planetId, 200_000, 200_000);
  await tend();
  await setDeuterium(30);
  const { did } = await tend();
  expect(did).not.toContain('notification-center:fund');
  expect((await center())!.wallet).toBe(0);
});

it('looks after the centre during an ordinary turn', async () => {
  await giveInstrument(f.db, seat.planetId, 'RADAR', 1);
  await grant(f.db, seat.planetId, 400_000, 400_000);
  await setDeuterium(100_000);
  await runBotTurn(f.db, f.clock, seat, silent);
  expect(await center()).toBeDefined();
});
