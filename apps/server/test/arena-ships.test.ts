import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { alloyRate, crystalRate, deuteriumRate } from '@astera/rules';
import { ARENA_ECONOMY as E, CLASS_STATS, dailyCap, shipStats } from '@astera/rules/arena';
import { arenaShips, notifications, planets, seasons } from '../src/db/schema.js';
import { chooseShip, endSortie, launchSortie, readHangar, recallOpenSorties, repairShip, setLoadout, spendAbility, upgradeShip } from '../src/services/arenaShips.js';
import { GameError } from '../src/services/planet.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * Y6a (plan 14 §7, owner 2026-10-23): the Yarık ship is real. It is chosen at Komuta Merkezi 9,
 * filled from the capital's deuterium, lands what it farmed in the capital one for one through an
 * exit, and rests after every flight. These are the rules the arena room leans on.
 */
let f: Fixture;
let account: string;
let capital: string;
const code = async (work: Promise<unknown>): Promise<string> => {
  try { await work; return 'ok'; } catch (error) { if (error instanceof GameError) return error.code; throw error; }
};
const stock = async () => {
  const [row] = await f.db.select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium }).from(planets).where(eq(planets.id, capital));
  if (!row) throw new Error('no capital');
  return row;
};
const shipRow = async () => (await f.db.select().from(arenaShips))[0];
const empty = { fuel: 0, ammo: 0, hold: [0, 0, 0], pilotKills: 0, assists: 0 };

describe('separate ability points', () => {
  it('earns through levels, spends a point on one ability only and keeps it on launch', async () => {
    await chooseShip(f.db, f.clock, account, 'kilavuz');
    expect(await code(spendAbility(f.db, f.clock, account, 'smoke'))).toBe('ABILITY_POINTS_SHORT');
    await f.db.update(arenaShips).set({ level: 3 });
    const view = await spendAbility(f.db, f.clock, account, 'smoke');
    expect(view.ship?.abilities).toEqual({ smoke: 1 });
    expect((await launchSortie(f.db, f.clock, account)).abilities).toEqual({ smoke: 1 });
    expect(await code(spendAbility(f.db, f.clock, account, 'radar'))).toBe('SHIP_FLYING');
  });

  it('spends the last point exactly once under concurrent orders', async () => {
    await chooseShip(f.db, f.clock, account, 'akinci');
    await f.db.update(arenaShips).set({ level: 2 });
    expect((await Promise.all([code(spendAbility(f.db, f.clock, account, 'smoke')), code(spendAbility(f.db, f.clock, account, 'radar'))])).sort())
      .toEqual(['ABILITY_POINTS_SHORT', 'ok']);
    const points = (await readHangar(f.db, f.clock, account)).ship?.abilities;
    expect((points?.smoke ?? 0) + (points?.radar ?? 0)).toBe(1);
    expect((await stock()).alloy).toBe(1000);
  });

  it('stops at effective rank three until Essence exists, including the free affinity, and refunds a class change', async () => {
    await chooseShip(f.db, f.clock, account, 'muhafiz');
    await f.db.update(arenaShips).set({ level: 10 });
    await spendAbility(f.db, f.clock, account, 'smoke');
    expect(await code(spendAbility(f.db, f.clock, account, 'smoke'))).toBe('ABILITY_ESSENCE_REQUIRED');
    expect((await readHangar(f.db, f.clock, account)).ship?.abilities).toEqual({ smoke: 1 });
    expect((await chooseShip(f.db, f.clock, account, 'akinci')).ship).toMatchObject({ level: 10, abilities: {} });
    expect((await spendAbility(f.db, f.clock, account, 'radar')).ship?.abilities).toEqual({ radar: 1 });
  });

  it('buys rank three once concurrently and keeps the unspent points for other abilities', async () => {
    await chooseShip(f.db, f.clock, account, 'akinci');
    await f.db.update(arenaShips).set({ level: 10, abilities: { smoke: 1 } });
    expect((await Promise.all([code(spendAbility(f.db, f.clock, account, 'smoke')), code(spendAbility(f.db, f.clock, account, 'smoke'))])).sort())
      .toEqual(['ABILITY_ESSENCE_REQUIRED', 'ok']);
    expect((await readHangar(f.db, f.clock, account)).ship?.abilities).toEqual({ smoke: 2 });
    expect((await spendAbility(f.db, f.clock, account, 'radar')).ship?.abilities).toEqual({ smoke: 2, radar: 1 });
    expect((await stock()).alloy).toBe(1000);
  });

  it('rejects another account with no ship and refuses a frozen season', async () => {
    await chooseShip(f.db, f.clock, account, 'kilavuz');
    expect(await code(spendAbility(f.db, f.clock, f.accountIds[1]!, 'radar'))).toBe('NO_SHIP');
    await f.db.update(seasons).set({ status: 'frozen' });
    expect(await code(spendAbility(f.db, f.clock, account, 'radar'))).toBe('SEASON_FROZEN');
  });
});

describe('paid repair', () => {
  const wreck = async () => {
    await chooseShip(f.db, f.clock, account, 'akinci');
    const flight = await launchSortie(f.db, f.clock, account);
    await endSortie(f.db, f.clock, account, flight.sortieId, { ...empty, outcome: 'dead' });
  };

  it('charges the capital and shortens the repair, keeping the ship grounded until it ends', async () => {
    await wreck();
    const before = await stock();
    const answer = await repairShip(f.db, f.clock, account);
    expect(answer.ship).toMatchObject({ readyReason: 'repair', readyAt: new Date(f.clock.now().getTime() + 15 * 60_000).toISOString(), level: 1 });
    expect((await stock()).alloy).toBeCloseTo(before.alloy - 175, 6);
    expect((await stock()).crystal).toBeCloseTo(before.crystal - 60, 6);
    expect((await stock()).deuterium).toBeCloseTo(before.deuterium, 6);
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('SHIP_NOT_READY');
    f.clock.advance(15);
    expect((await launchSortie(f.db, f.clock, account)).ship).toBe('akinci');
  });

  it('charges once when two requests arrive together and never charges again for the same timer', async () => {
    await wreck();
    const answers = await Promise.all([code(repairShip(f.db, f.clock, account)), code(repairShip(f.db, f.clock, account))]);
    expect(answers.sort()).toEqual(['REPAIR_NOT_SHORTER', 'ok']);
    expect((await stock()).alloy).toBeCloseTo(825, 6);
    expect(await code(repairShip(f.db, f.clock, account))).toBe('REPAIR_NOT_SHORTER');
    expect((await stock()).alloy).toBeCloseTo(825, 6);
  });

  it('does not charge or extend an equal, shorter or finished free repair', async () => {
    await wreck();
    f.clock.advance(45);
    expect(await code(repairShip(f.db, f.clock, account))).toBe('REPAIR_NOT_SHORTER');
    f.clock.advance(1);
    expect(await code(repairShip(f.db, f.clock, account))).toBe('REPAIR_NOT_SHORTER');
    f.clock.advance(14);
    expect(await code(repairShip(f.db, f.clock, account))).toBe('SHIP_NOT_REPAIRING');
    expect((await shipRow())?.readyAt).toEqual(new Date(f.clock.now()));
  });

  it('refuses an unaffordable repair without changing stock or the timer', async () => {
    await wreck();
    await f.db.update(planets).set({ crystal: 59 }).where(eq(planets.id, capital));
    const before = await stock(); const readyAt = (await shipRow())?.readyAt;
    expect(await code(repairShip(f.db, f.clock, account))).toBe('INSUFFICIENT_RESOURCES');
    expect(await stock()).toEqual(before);
    expect((await shipRow())?.readyAt).toEqual(readyAt);
  });

  it('prices the ship at its current level and cannot spend another commander\'s stock', async () => {
    await wreck();
    await f.db.update(arenaShips).set({ level: 10 });
    const answer = await repairShip(f.db, f.clock, account);
    expect(answer.ship?.readyAt).toBe(new Date(f.clock.now().getTime() + 22 * 60_000).toISOString());
    expect((await stock()).alloy).toBeCloseTo(600, 6);
    expect(await code(repairShip(f.db, f.clock, f.accountIds[1]!))).toBe('NO_SHIP');
    expect((await stock()).alloy).toBeCloseTo(600, 6);
  });

  it('refuses ships that are ready, flying or servicing, and a frozen season', async () => {
    expect(await code(repairShip(f.db, f.clock, account))).toBe('NO_SHIP');
    await chooseShip(f.db, f.clock, account, 'akinci');
    expect(await code(repairShip(f.db, f.clock, account))).toBe('SHIP_NOT_REPAIRING');
    const flight = await launchSortie(f.db, f.clock, account);
    expect(await code(repairShip(f.db, f.clock, account))).toBe('SHIP_FLYING');
    await endSortie(f.db, f.clock, account, flight.sortieId, { ...empty, outcome: 'extracted' });
    expect(await code(repairShip(f.db, f.clock, account))).toBe('SHIP_NOT_REPAIRING');
    await f.db.update(seasons).set({ status: 'frozen' });
    expect(await code(repairShip(f.db, f.clock, account))).toBe('SEASON_FROZEN');
    expect((await stock()).alloy).toBeCloseTo(1000, 6);
  });
});

beforeEach(async () => {
  f = await seedWorld(2, 9310);
  account = f.accountIds[0]!; capital = f.planetIds[0]!;
  await setLevel(f.db, capital, 'CORE', 9);
  await setLevel(f.db, capital, 'REFINERY', 10); await setLevel(f.db, capital, 'EXTRACTOR', 10); await setLevel(f.db, capital, 'DEUTERIUM_PLANT', 3);
  await f.db.update(planets).set({ alloy: 1000, crystal: 1000, deuterium: 500 }).where(eq(planets.id, capital));
});
afterAll(async () => { const { close } = await testDb(); await close(); });

describe('choosing a ship', () => {
  it('waits for Komuta Merkezi 9', async () => {
    await setLevel(f.db, capital, 'CORE', 8);
    expect(await code(chooseShip(f.db, f.clock, account, 'kilavuz'))).toBe('CORE_TOO_LOW');
    expect((await readHangar(f.db, f.clock, account)).ship).toBeNull();
    expect((await readHangar(f.db, f.clock, account)).core).toBe(8);
  });

  it('is for a commander in a galaxy', async () => {
    expect(await code(chooseShip(f.db, f.clock, '00000000-0000-4000-8000-000000000000', 'kilavuz'))).toBe('NO_PLANET');
  });

  it('gives a full ship and one free change for 24 hours', async () => {
    const view = await chooseShip(f.db, f.clock, account, 'kilavuz');
    expect(view.ship).toMatchObject({ class: 'kilavuz', fuel: CLASS_STATS.kilavuz.fuelTank, ammo: CLASS_STATS.kilavuz.ammoCapacity,
      hold: [0, 0, 0], readyAt: null, flying: false, changeUntil: new Date(f.clock.now().getTime() + 24 * 3_600_000).toISOString() });
    expect(view.refill).toEqual({ fuel: 0, ammo: 0, total: 0 });
    // The same class again changes nothing and spends nothing.
    expect((await chooseShip(f.db, f.clock, account, 'kilavuz')).ship?.changeUntil).not.toBeNull();
    f.clock.advance(23 * 60);
    expect((await chooseShip(f.db, f.clock, account, 'muhafiz')).ship).toMatchObject({ class: 'muhafiz', changeUntil: null,
      fuel: CLASS_STATS.muhafiz.fuelTank, ammo: CLASS_STATS.muhafiz.ammoCapacity });
    expect(await code(chooseShip(f.db, f.clock, account, 'akinci'))).toBe('CLASS_LOCKED');
  });

  it('locks the class after 24 hours even if it was never changed', async () => {
    await chooseShip(f.db, f.clock, account, 'akinci');
    f.clock.advance(24 * 60);
    expect(await code(chooseShip(f.db, f.clock, account, 'kilavuz'))).toBe('CLASS_LOCKED');
  });

  it('cannot change a ship in the air or one with cargo aboard', async () => {
    await chooseShip(f.db, f.clock, account, 'akinci');
    const flight = await launchSortie(f.db, f.clock, account);
    expect(await code(chooseShip(f.db, f.clock, account, 'kilavuz'))).toBe('SHIP_FLYING');
    await endSortie(f.db, f.clock, account, flight.sortieId, { ...empty, outcome: 'recalled', fuel: 10, ammo: 10, hold: [5, 0, 0] });
    expect(await code(chooseShip(f.db, f.clock, account, 'kilavuz'))).toBe('CARGO_ABOARD');
  });
});

describe('launch', () => {
  beforeEach(async () => { await chooseShip(f.db, f.clock, account, 'kilavuz'); });

  it('fills only the missing part from the capital and opens one flight', async () => {
    await f.db.update(arenaShips).set({ fuel: CLASS_STATS.kilavuz.fuelTank / 2, ammo: 0 });
    const before = await stock();
    const flight = await launchSortie(f.db, f.clock, account);
    expect(flight).toMatchObject({ ship: 'kilavuz', fuel: CLASS_STATS.kilavuz.fuelTank, ammo: CLASS_STATS.kilavuz.ammoCapacity, hold: [0, 0, 0], refilled: 42 });
    expect((await stock()).deuterium).toBeCloseTo(before.deuterium - 42, 6);
    expect((await shipRow())?.sortieId).toBe(flight.sortieId);
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('SHIP_FLYING');
    expect((await stock()).deuterium).toBeCloseTo(before.deuterium - 42, 6);
  });

  it('launches once when asked twice at the same moment', async () => {
    await f.db.update(arenaShips).set({ fuel: 0, ammo: 0 });
    const results = await Promise.all([code(launchSortie(f.db, f.clock, account)), code(launchSortie(f.db, f.clock, account))]);
    expect(results.sort()).toEqual(['SHIP_FLYING', 'ok']);
    expect((await stock()).deuterium).toBeCloseTo(500 - 62, 6);
  });

  it('needs a ship', async () => {
    expect(await code(launchSortie(f.db, f.clock, f.accountIds[1]!))).toBe('NO_SHIP');
  });

  it('refuses a refill the capital cannot pay, and spends nothing', async () => {
    await f.db.update(arenaShips).set({ fuel: 0, ammo: 0 });
    await f.db.update(planets).set({ deuterium: 61.5 }).where(eq(planets.id, capital));
    const refused = await launchSortie(f.db, f.clock, account).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(GameError);
    if (refused instanceof GameError) expect([refused.code, refused.params]).toEqual(['NOT_ENOUGH_DEUTERIUM', { need: 62, have: 61 }]);
    expect((await stock()).deuterium).toBeCloseTo(61.5, 6);
    expect((await shipRow())?.sortieId).toBeNull();
  });

  it('waits out repair and maintenance to the second', async () => {
    const flight = await launchSortie(f.db, f.clock, account);
    await endSortie(f.db, f.clock, account, flight.sortieId, { outcome: 'dead', ...empty });
    const refused = await launchSortie(f.db, f.clock, account).catch((error: unknown) => error);
    expect(refused instanceof GameError ? [refused.code, refused.params] : refused).toEqual(['SHIP_NOT_READY',
      { until: new Date(f.clock.now().getTime() + E.repairMinutes * 60_000).toISOString(), reason: 'repair' }]);
    f.clock.advance(E.repairMinutes - 1);
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('SHIP_NOT_READY');
    f.clock.advance(1);
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('ok');
  });

  it('closes ten minutes before the season ends, and with the season', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(new Date(season!.endsAt.getTime() - E.entryClosesMinutes * 60_000));
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('SEASON_CLOSING');
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('SEASON_FROZEN');
  });

  it('does not fly from a capital on vacation', async () => {
    await f.db.update(planets).set({ vacationStartedAt: f.clock.now(), vacationUntil: new Date(f.clock.now().getTime() + 3_600_000) }).where(eq(planets.id, capital));
    expect(await code(launchSortie(f.db, f.clock, account))).toBe('VACATION_ACTIVE');
  });
});

/**
 * Owner 2026-10-27: a pilot may fly with half a tank or a light magazine. The plan is kept on the
 * ship (full until changed); the launch tops up to it and charges that part only.
 */
describe('the launch plan', () => {
  beforeEach(async () => { await chooseShip(f.db, f.clock, account, 'kilavuz'); });

  it('is full until changed, and the hangar prices the plan', async () => {
    await f.db.update(arenaShips).set({ fuel: 0, ammo: 0 });
    expect((await readHangar(f.db, f.clock, account)).ship?.plan).toEqual({ fuel: 100, ammo: 100 });
    const view = await setLoadout(f.db, f.clock, account, { fuel: 50, ammo: 0 });
    expect([view.ship?.plan, view.refill]).toEqual([{ fuel: 50, ammo: 0 }, { fuel: 20, ammo: 0, total: 20 }]);
  });

  it('flies a half tank and an empty magazine, charging only for that', async () => {
    await f.db.update(arenaShips).set({ fuel: 0, ammo: 0 });
    await setLoadout(f.db, f.clock, account, { fuel: 50, ammo: 0 });
    const before = await stock();
    const flight = await launchSortie(f.db, f.clock, account);
    expect([flight.fuel, flight.ammo, flight.refilled]).toEqual([CLASS_STATS.kilavuz.fuelTank / 2, 0, 20]);
    expect((await stock()).deuterium).toBeCloseTo(before.deuterium - 20, 6);
    expect([(await shipRow())?.fuel, (await shipRow())?.ammo]).toEqual([CLASS_STATS.kilavuz.fuelTank / 2, 0]);
  });

  it('keeps what is aboard above the plan, for free', async () => {
    await f.db.update(arenaShips).set({ fuel: CLASS_STATS.kilavuz.fuelTank * 0.8, ammo: CLASS_STATS.kilavuz.ammoCapacity });
    await setLoadout(f.db, f.clock, account, { fuel: 25, ammo: 50 });
    const flight = await launchSortie(f.db, f.clock, account);
    expect([flight.fuel, flight.ammo, flight.refilled]).toEqual([CLASS_STATS.kilavuz.fuelTank * 0.8, CLASS_STATS.kilavuz.ammoCapacity, 0]);
  });

  it('refuses a step it does not offer, and a commander with no ship', async () => {
    for (const bad of [{ fuel: 0, ammo: 100 }, { fuel: 60, ammo: 100 }, { fuel: 100, ammo: 110 }]) {
      expect(await code(setLoadout(f.db, f.clock, account, bad))).toBe('INVALID_PLAN');
    }
    expect((await shipRow())?.fuelPlan).toBe(100);
    expect(await code(setLoadout(f.db, f.clock, f.accountIds[1]!, { fuel: 50, ammo: 50 }))).toBe('NO_SHIP');
  });
});

describe('a flight ends', () => {
  let sortie: string;
  const cap = dailyCap({ alloy: alloyRate(10), crystal: crystalRate(10), deuterium: deuteriumRate(3) });
  beforeEach(async () => { await chooseShip(f.db, f.clock, account, 'kilavuz'); sortie = (await launchSortie(f.db, f.clock, account)).sortieId; });

  it('lands the hold in the capital one for one, then rests ten minutes', async () => {
    const before = await stock();
    const result = await endSortie(f.db, f.clock, account, sortie, { ...empty, outcome: 'extracted', fuel: 120, ammo: 300, hold: [240.6, 112, 3] });
    expect(result).toMatchObject({ outcome: 'extracted', deposit: { alloy: 240, crystal: 112, deuterium: 3 }, overflow: { alloy: 0, crystal: 0, deuterium: 0 },
      readyAt: new Date(f.clock.now().getTime() + E.serviceMinutes * 60_000).toISOString(), readyReason: 'service' });
    const after = await stock();
    expect([after.alloy - before.alloy, after.crystal - before.crystal, after.deuterium - before.deuterium].map(n => Math.round(n * 1e6) / 1e6)).toEqual([240, 112, 3]);
    expect(await shipRow()).toMatchObject({ sortieId: null, fuel: 120, ammo: 300, holdAlloy: 0, holdCrystal: 0, holdDeuterium: 0 });
  });

  // F22: a pilot whose page closed mid-flight never saw the result; the end waits for them as news.
  it('leaves news of a flight lost while nobody watched, and none of one the pilot saw or that came home', async () => {
    const news = () => f.db.select().from(notifications).where(eq(notifications.kind, 'arena_sortie_end'));
    await endSortie(f.db, f.clock, account, sortie, { ...empty, outcome: 'towed', hold: [50, 4, 0], unseen: true });
    const [row] = await news();
    expect(row?.payload).toMatchObject({ outcome: 'towed', lost: { alloy: 50, crystal: 4, deuterium: 0 }, reason: 'service',
      readyAt: new Date(f.clock.now().getTime() + E.serviceMinutes * 60_000).toISOString() });
    for (const [outcome, unseen] of [['dead', false], ['recalled', true]] as const) {
      await f.db.update(arenaShips).set({ readyAt: null, readyReason: null });
      const next = (await launchSortie(f.db, f.clock, account)).sortieId;
      await endSortie(f.db, f.clock, account, next, { ...empty, outcome, hold: [9, 0, 0], unseen });
    }
    expect(await news()).toHaveLength(1);
  });

  it('lands once, however often the end is reported', async () => {
    const before = await stock();
    const end = { ...empty, outcome: 'extracted' as const, fuel: 1, ammo: 1, hold: [50, 0, 0] };
    const [a, b] = await Promise.all([endSortie(f.db, f.clock, account, sortie, end), endSortie(f.db, f.clock, account, sortie, end)]);
    expect([a, b].filter(r => r !== null)).toHaveLength(1);
    expect(await endSortie(f.db, f.clock, account, sortie, end)).toBeNull();
    expect((await stock()).alloy - before.alloy).toBeCloseTo(50, 6);
  });

  it('carries at most four hours of each resource a day; the next UTC day starts again', async () => {
    expect(cap.deuterium).toBeGreaterThan(0);
    const first = await endSortie(f.db, f.clock, account, sortie, { outcome: 'extracted', ...empty, hold: [0, 0, cap.deuterium - 10] });
    expect(first?.deposit.deuterium).toBe(cap.deuterium - 10);
    f.clock.advance(E.serviceMinutes);
    const next = (await launchSortie(f.db, f.clock, account)).sortieId;
    const second = await endSortie(f.db, f.clock, account, next, { outcome: 'extracted', ...empty, hold: [cap.alloy + 5, 0, 25] });
    expect(second).toMatchObject({ deposit: { alloy: cap.alloy, crystal: 0, deuterium: 10 }, overflow: { alloy: 5, crystal: 0, deuterium: 15 } });
    expect((await readHangar(f.db, f.clock, account)).sent).toEqual({ alloy: cap.alloy, crystal: 0, deuterium: cap.deuterium });
    const midnight = new Date(f.clock.now()); midnight.setUTCHours(24, 0, 0, 0);
    expect((await readHangar(f.db, f.clock, account)).resetsAt).toBe(midnight.toISOString());
    f.clock.set(midnight);
    const third = (await launchSortie(f.db, f.clock, account)).sortieId;
    expect((await endSortie(f.db, f.clock, account, third, { outcome: 'extracted', ...empty, hold: [0, 0, 7] }))?.deposit.deuterium).toBe(7);
    expect((await readHangar(f.db, f.clock, account)).sent).toEqual({ alloy: 0, crystal: 0, deuterium: 7 });
  });

  it('loses the hold on death and repairs for an hour; the fuel left is kept', async () => {
    const before = await stock();
    expect(await endSortie(f.db, f.clock, account, sortie, { ...empty, outcome: 'dead', fuel: 90, ammo: 40, hold: [0, 0, 0] }))
      .toMatchObject({ deposit: { alloy: 0, crystal: 0, deuterium: 0 }, readyReason: 'repair',
        readyAt: new Date(f.clock.now().getTime() + E.repairMinutes * 60_000).toISOString() });
    expect(await stock()).toEqual(before);
    expect(await shipRow()).toMatchObject({ fuel: 90, ammo: 40, readyReason: 'repair' });
  });

  it('tows a ship home with nothing landed and ten minutes of maintenance', async () => {
    expect(await endSortie(f.db, f.clock, account, sortie, { ...empty, outcome: 'towed', fuel: 0, ammo: 10, hold: [80, 0, 0] }))
      .toMatchObject({ deposit: { alloy: 0, crystal: 0, deuterium: 0 }, readyReason: 'service' });
    expect(await shipRow()).toMatchObject({ holdAlloy: 0, fuel: 0 });
  });

  it('never lands test cargo', async () => {
    const before = await stock();
    expect((await endSortie(f.db, f.clock, account, sortie, { outcome: 'test', ...empty, hold: [240, 0, 0] }))?.deposit.alloy).toBe(0);
    expect(await stock()).toEqual(before);
  });

  it('keeps a recalled hold aboard, with no rest, for the next flight to risk again', async () => {
    const before = await stock();
    expect(await endSortie(f.db, f.clock, account, sortie, { ...empty, outcome: 'recalled', fuel: 33, ammo: 44, hold: [60, 20, 5] }))
      .toMatchObject({ deposit: { alloy: 0, crystal: 0, deuterium: 0 }, readyAt: null, readyReason: null });
    expect(await stock()).toEqual(before);
    const flight = await launchSortie(f.db, f.clock, account);
    expect(flight.hold).toEqual([60, 20, 5]);
    expect(flight.refilled).toBeGreaterThan(0);
  });

  it('closes a flight that ends after the season froze, landing nothing', async () => {
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    const before = await stock();
    expect(await endSortie(f.db, f.clock, account, sortie, { outcome: 'extracted', ...empty, hold: [100, 0, 0] }))
      .toMatchObject({ deposit: { alloy: 0, crystal: 0, deuterium: 0 }, overflow: { alloy: 100, crystal: 0, deuterium: 0 } });
    expect(await stock()).toEqual(before);
    expect((await shipRow())?.sortieId).toBeNull();
  });

  it('recalls every flight a crash left open, keeping what they carried in', async () => {
    await f.db.update(arenaShips).set({ holdCrystal: 12 });
    expect(await recallOpenSorties(f.db)).toBe(1);
    expect(await shipRow()).toMatchObject({ sortieId: null, holdCrystal: 12, readyAt: null });
    expect(await endSortie(f.db, f.clock, account, sortie, { outcome: 'extracted', ...empty, hold: [100, 0, 0] })).toBeNull();
  });
});

describe('levels (Y6b)', () => {
  let sortie: string;
  const land = (hold: number[], extra: Partial<{ pilotKills: number; assists: number }> = {}, outcome: 'extracted' | 'dead' | 'test' | 'recalled' = 'extracted') =>
    endSortie(f.db, f.clock, account, sortie, { ...empty, ...extra, outcome, hold });
  const again = async () => { f.clock.advance(E.repairMinutes); sortie = (await launchSortie(f.db, f.clock, account)).sortieId; };
  beforeEach(async () => {
    await setLevel(f.db, capital, 'CORE', 12);
    await chooseShip(f.db, f.clock, account, 'kilavuz'); sortie = (await launchSortie(f.db, f.clock, account)).sortieId;
  });

  it('starts at level one; the hangar shows the bar, the Çekirdeği\'s cap and the price of the next level', async () => {
    expect((await readHangar(f.db, f.clock, account)).ship).toMatchObject({ level: 1, xp: 0, xpNext: 50, levelCap: 12,
      upgrade: { alloy: 150, crystal: 75, deuterium: 0 } });
    // The price stands next to what the capital holds.
    expect(await readHangar(f.db, f.clock, account)).toMatchObject({ alloy: 1000, crystal: 1000 });
  });

  it('banks a flight\'s XP into the bar and stops at a full one', async () => {
    // 123 resources → 12, two pilots, one assist, the flight: 117, of which the bar takes 50.
    expect((await land([100, 20, 3], { pilotKills: 2, assists: 1 }))?.xp).toEqual({ earned: 117, kept: 117, banked: 50 });
    expect(await shipRow()).toMatchObject({ level: 1, xp: 50 });
    await again();
    expect((await land([100, 0, 0]))?.xp).toEqual({ earned: 20, kept: 20, banked: 0 });
  });

  it('keeps 40 % of a lost flight, and nothing of a test flight', async () => {
    expect((await land([100, 0, 0], { pilotKills: 1 }, 'dead'))?.xp).toEqual({ earned: 60, kept: 24, banked: 24 });
    await again();
    expect((await land([400, 0, 0], {}, 'test'))?.xp).toEqual({ earned: 50, kept: 0, banked: 0 });
    expect((await shipRow())?.xp).toBe(24);
  });

  it('takes no XP at the Çekirdeği\'s cap', async () => {
    await f.db.update(arenaShips).set({ level: 12 });
    expect((await land([300, 0, 0]))?.xp.banked).toBe(0);
    expect((await readHangar(f.db, f.clock, account)).ship).toMatchObject({ level: 12, levelCap: 12, xp: 0 });
  });

  it('buys a level with a full bar, alloy and crystal; the bar starts again', async () => {
    await land([0, 0, 0]);
    expect(await code(upgradeShip(f.db, f.clock, account))).toBe('XP_SHORT');
    await f.db.update(arenaShips).set({ xp: 50 });
    const before = await stock();
    const view = await upgradeShip(f.db, f.clock, account);
    expect(view.ship).toMatchObject({ level: 2, xp: 0, xpNext: 100, upgrade: { alloy: 300, crystal: 150 } });
    const after = await stock();
    expect([before.alloy - after.alloy, before.crystal - after.crystal]).toEqual([150, 75]);
  });

  it('refuses a level the capital cannot pay, the Çekirdeği does not allow, or a ship in the air; spends nothing', async () => {
    await f.db.update(arenaShips).set({ xp: 50 });
    expect(await code(upgradeShip(f.db, f.clock, account))).toBe('SHIP_FLYING');
    await land([0, 0, 0]);
    await f.db.update(planets).set({ crystal: 74 }).where(eq(planets.id, capital));
    const before = await stock();
    expect(await code(upgradeShip(f.db, f.clock, account))).toBe('INSUFFICIENT_RESOURCES');
    expect(await stock()).toEqual(before);
    await f.db.update(arenaShips).set({ level: 12, xp: 600 });
    await f.db.update(planets).set({ alloy: 99999, crystal: 99999 }).where(eq(planets.id, capital));
    const refused = await upgradeShip(f.db, f.clock, account).catch((error: unknown) => error);
    expect(refused instanceof GameError ? [refused.code, refused.params] : refused).toEqual(['LEVEL_CAP', { cap: 12, core: 12 }]);
    expect(await code(upgradeShip(f.db, f.clock, f.accountIds[1]!))).toBe('NO_SHIP');
  });

  it('buys one level when asked twice at once', async () => {
    await land([0, 0, 0]);
    await f.db.update(arenaShips).set({ xp: 50 });
    expect((await Promise.all([code(upgradeShip(f.db, f.clock, account)), code(upgradeShip(f.db, f.clock, account))])).sort()).toEqual(['XP_SHORT', 'ok']);
    expect((await stock()).alloy).toBeCloseTo(1000 - 150, 6);
    expect(await shipRow()).toMatchObject({ level: 2, xp: 0 });
  });

  it('flies its level: a grown tank and hold, filled for the same price', async () => {
    await land([0, 0, 0], {}, 'dead');
    await f.db.update(arenaShips).set({ level: 10, fuel: 0, ammo: 0 });
    f.clock.advance(E.repairMinutes);
    const flight = await launchSortie(f.db, f.clock, account);
    expect(flight).toMatchObject({ level: 10, fuel: shipStats('kilavuz', 10).fuelTank, refilled: 62 });
  });

  it('keeps level and XP through the free class change', async () => {
    await land([0, 0, 0]);
    await f.db.update(arenaShips).set({ level: 4, xp: 30 });
    expect((await chooseShip(f.db, f.clock, account, 'muhafiz')).ship).toMatchObject({ class: 'muhafiz', level: 4, xp: 30,
      fuel: shipStats('muhafiz', 4).fuelTank });
  });
});
