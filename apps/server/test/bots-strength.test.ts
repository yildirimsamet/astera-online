import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { HANGAR, HULLS, MULTI_WORLD, buildingCost, fleetValue } from '@astera/rules';
import { botProfiles, buildOrders, planets, playerResearch, players, seasons } from '../src/db/schema.js';
import { addBot, listBots, setBotStrength } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { runBotTurn, type BotSeat } from '../src/services/bots/brain.js';
import { BOTS, STRENGTH_CEILINGS, strengthNamed } from '../src/services/bots/personas.js';
import { guardPlayerIds } from '../src/services/bots/guardPolicy.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * THREE KINDS OF COMMANDER THE SERVER PLAYS. Owner plan 2026-11-26 (docs/bot-plani-2026-11-26.md
 * F2): NORMAL stops at the old middle ceiling, STRONG climbs to Core 20 with twice the fleet, and
 * ELITE has no ceiling at all and may reach the top of the ladder. Nobody gets a single free
 * resource: the difference is how far each one is allowed to grow.
 */

const silent = pino({ level: 'silent' });
let f: Fixture, seat: BotSeat;

afterAll(async () => { await (await testDb()).close(); });

const research = async (id: 'STARSHIP_ENGINEERING' | 'SHIP_POWER' | 'SHIP_ARMOR', level: number) => {
  await f.db.insert(playerResearch).values({ playerId: seat.playerId, projectId: id, level, completedAt: f.clock.now() })
    .onConflictDoUpdate({ target: [playerResearch.playerId, playerResearch.projectId], set: { level } });
};
const purse = async (alloy: number) => {
  await f.db.update(planets).set({ alloy, crystal: alloy, deuterium: alloy }).where(eq(planets.id, seat.planetId));
};
/** What the yard has been asked for: hulls only, never buildings. */
const ordered = async (): Promise<string[]> =>
  (await f.db.select({ subject: buildOrders.subject }).from(buildOrders)
    .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.queue, 'YARD'))))
    .map((row) => row.subject);

describe('the stored strength', () => {
  beforeEach(async () => { f = await seedWorld(4); });

  it('starts every new commander NORMAL and keeps what the operator sets', async () => {
    await addBot(f.db, 'Kademe', f.clock);
    expect((await listBots(f.db))[0]?.strength).toBe('NORMAL');
    expect(await setBotStrength(f.db, 'kademe', 'STRONG')).toBe(true);
    expect((await listBots(f.db))[0]?.strength).toBe('STRONG');
    expect(await setBotStrength(f.db, 'Nobody', 'ELITE')).toBe(false);
  });

  it('reads anything it does not recognise as NORMAL', () => {
    expect(strengthNamed('ELITE')).toBe('ELITE');
    expect(strengthNamed('STRONG')).toBe('STRONG');
    expect(strengthNamed('GODLIKE')).toBe('NORMAL');
  });

  it('sets the ceilings the owner chose', () => {
    expect(STRENGTH_CEILINGS.NORMAL).toEqual({ core: BOTS.coreCeiling, fleetValue: BOTS.fleetValueCeiling });
    expect(STRENGTH_CEILINGS.STRONG).toEqual({ core: 20, fleetValue: 2 * BOTS.fleetValueCeiling });
    expect(STRENGTH_CEILINGS.ELITE).toEqual({ core: Number.POSITIVE_INFINITY, fleetValue: Number.POSITIVE_INFINITY });
  });

  it('makes every ELITE a guard, whatever its habit, and no RAIDER a guard by habit alone', async () => {
    const builder = await addBot(f.db, 'Kale', f.clock); // ordinal 0, BALANCED
    const raider = await addBot(f.db, 'Akinci', f.clock); // ordinal 1, RAIDER
    await setBotStrength(f.db, 'Kale', 'ELITE');
    await ensureBotSeats(f.db, f.clock, silent);
    const ids = await f.db.select({ id: players.id, accountId: players.accountId }).from(players);
    const guards = await guardPlayerIds(f.db, f.seasonId);
    expect(guards.has(ids.find((row) => row.accountId === builder.accountId)!.id)).toBe(true);
    expect(guards.has(ids.find((row) => row.accountId === raider.accountId)!.id)).toBe(false);
  });
});

describe('how far each strength grows', () => {
  beforeEach(async () => {
    f = await seedWorld(8);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    const bot = await addBot(f.db, 'Olcek', f.clock); // ordinal 0: BALANCED
    await ensureBotSeats(f.db, f.clock, silent);
    const [p] = await f.db.select().from(players).where(eq(players.accountId, bot.accountId));
    const [world] = await f.db.select().from(planets).where(eq(planets.controllerPlayerId, p!.id));
    seat = { accountId: bot.accountId, playerId: p!.id, planetId: world!.id,
      seasonId: f.seasonId, seasonSeed: f.seed, ordinal: bot.ordinal, persona: 'BALANCED' };
    await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
  });

  const atCore = async (core: number) => {
    for (const id of ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT']) await setLevel(f.db, seat.planetId, id, core);
    await purse(buildingCost('CORE', core).alloy * 6);
  };

  it('keeps a NORMAL commander at Core 16', async () => {
    await atCore(16);
    expect((await runBotTurn(f.db, f.clock, seat, silent)).did).not.toContain('build:CORE');
  });

  it('lets a STRONG commander past 16 and stops it at 20', async () => {
    await setBotStrength(f.db, 'Olcek', 'STRONG');
    await atCore(16);
    expect((await runBotTurn(f.db, f.clock, seat, silent)).did).toContain('build:CORE');
    await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
    await atCore(20);
    expect((await runBotTurn(f.db, f.clock, seat, silent)).did).not.toContain('build:CORE');
  });

  const fleetOf = async (value: number) => {
    await setLevel(f.db, seat.planetId, 'HANGAR', HANGAR.maxLevel);
    await setLevel(f.db, seat.planetId, 'SHIPYARD', 2);
    const paladins = Math.ceil(value / fleetValue({ PALADIN: 1 }));
    // Away on a flight: still this commander's, and nothing on the pad to raid with.
    await giveUnits(f.db, seat.planetId, { PALADIN: paladins }, 'away');
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 1, COURIER: 2 });
    await purse(400_000);
  };
  const warships = async () => (await ordered()).filter((id) =>
    !HULLS[id as keyof typeof HULLS].ground && !['PROSPECTOR', 'COURIER'].includes(id));

  it('buys no warships past a NORMAL fleet ceiling', async () => {
    await fleetOf(BOTS.fleetValueCeiling * 1.2);
    await runBotTurn(f.db, f.clock, seat, silent);
    expect(await warships()).toEqual([]);
  });

  it('keeps a STRONG commander buying past the NORMAL fleet ceiling', async () => {
    await setBotStrength(f.db, 'Olcek', 'STRONG');
    await fleetOf(BOTS.fleetValueCeiling * 1.2);
    await runBotTurn(f.db, f.clock, seat, silent);
    expect((await warships()).length).toBeGreaterThan(0);
  });
});

describe('what a strong commander flies', () => {
  beforeEach(async () => {
    f = await seedWorld(8);
    const bot = await addBot(f.db, 'Filo', f.clock); // ordinal 0: BALANCED — Dart, Warden, Pike
    await ensureBotSeats(f.db, f.clock, silent);
    const [p] = await f.db.select().from(players).where(eq(players.accountId, bot.accountId));
    const [world] = await f.db.select().from(planets).where(eq(planets.controllerPlayerId, p!.id));
    seat = { accountId: bot.accountId, playerId: p!.id, planetId: world!.id,
      seasonId: f.seasonId, seasonSeed: f.seed, ordinal: bot.ordinal, persona: 'BALANCED' };
    await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
    for (const id of ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT']) await setLevel(f.db, seat.planetId, id, 16);
    await setLevel(f.db, seat.planetId, 'SHIPYARD', 6);
    await setLevel(f.db, seat.planetId, 'HANGAR', HANGAR.maxLevel);
    await research('STARSHIP_ENGINEERING', 2); await research('SHIP_POWER', 2); await research('SHIP_ARMOR', 2);
    // Every Courier it keeps already stands: the haul's hold, and the settlers' pair a colony slot asks for.
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 1, COURIER: BOTS.courierTarget + MULTI_WORLD.settlement.transports });
    // Enough ground already that the turn's yard goes to the fleet.
    await giveUnits(f.db, seat.planetId, { BASTION: 40 });
    await purse(600_000);
  });

  const yard = async () => (await ordered()).filter((id) => {
    const hull = HULLS[id as keyof typeof HULLS];
    return !hull.ground && !['PROSPECTOR', 'COURIER'].includes(id);
  });

  it('flies the habit as written when NORMAL', async () => {
    await runBotTurn(f.db, f.clock, seat, silent);
    const bought = await yard();
    expect(bought.length).toBeGreaterThan(0);
    for (const id of bought) expect(['DART', 'WARDEN', 'PIKE']).toContain(id);
  });

  it('flies the same lines at the best tier it can build when STRONG', async () => {
    await setBotStrength(f.db, 'Filo', 'STRONG');
    await runBotTurn(f.db, f.clock, seat, silent);
    const bought = await yard();
    expect(bought.length).toBeGreaterThan(0);
    for (const id of bought) expect(['CORSAIR', 'PALADIN', 'CATACLYSM']).toContain(id);
  });
});

describe('the migration that adds strength', () => {
  beforeEach(async () => { f = await seedWorld(2); });

  it('keeps the two guards the live roster already has, and only them', async () => {
    for (const name of ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']) await addBot(f.db, name, f.clock);
    // Personas deal BALANCED, RAIDER, PROSPECTOR, BUILDER: Raiders sit at ordinals 1, 5 and 9.
    await f.db.update(botProfiles).set({ strength: 'NORMAL' });
    const dir = fileURLToPath(new URL('../drizzle/', import.meta.url));
    const file = readdirSync(dir).find((name) => name.endsWith('_bot_strength.sql'));
    expect(file).toBeDefined();
    const backfill = readFileSync(`${dir}${file!}`, 'utf8').split('--> statement-breakpoint')
      .map((statement) => statement.split('\n').filter((line) => !line.startsWith('--')).join('\n').trim())
      .filter((statement) => statement.startsWith('UPDATE'));
    expect(backfill).toHaveLength(1);
    await f.db.execute(sql.raw(backfill[0]!));
    const elite = await f.db.select({ ordinal: botProfiles.ordinal }).from(botProfiles)
      .where(and(eq(botProfiles.strength, 'ELITE')));
    expect(elite.map((row) => row.ordinal).toSorted((a, b) => a - b)).toEqual([1, 5]);
  });
});
