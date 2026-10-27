import { describe, expect, it } from 'vitest';
import {
  ARENA_PROGRESSION as P, ARENA_TUNING as T, CLASS_STATS, SHIP_CLASSES, classTuning, createPilot, createSandboxWorld, gainXp, levelCap,
  createInput, decodeArenaSnapshot, levelCost, packRemote, packPilot, refillCost, shipStats, shipTuning, sortieXp, statsOf, stepSandboxWorld, strike, unpackPilot, xpToNext, type ShipClass,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/**
 * Y6b (plan 14 §3.2, §5, §7.4; owner 2026-10-23). A ship climbs levels 1–20 within a season, never
 * past its Komuta Çekirdeği. XP comes from what it flies out (10 resources = 1 XP, any kind) and from
 * the pilots it brings down; a lost flight keeps 40 %. A full bar takes nothing until it is paid for
 * in alloy and crystal. Each level grows the class's own strengths; speed grows slowly, the fastest
 * ship reaching 120 m/s at level 20.
 */
describe('levels', () => {
  it('stops at the Komuta Çekirdeği and at 20', () => {
    expect([levelCap(9), levelCap(13), levelCap(20), levelCap(27)]).toEqual([9, 13, 20, 20]);
  });

  it('asks 50 XP a level, and alloy and crystal to climb', () => {
    expect([xpToNext(1), xpToNext(12), xpToNext(19), xpToNext(20)]).toEqual([50, 600, 950, 0]);
    expect(levelCost(1)).toEqual({ alloy: 150, crystal: 75, deuterium: 0 });
    expect(levelCost(10)).toEqual({ alloy: 1500, crystal: 750, deuterium: 0 });
  });
});

describe('sortie XP', () => {
  const flight = { hold: [100, 20, 3], pilotKills: 2, assists: 1 };
  it('pays ten resources a point, 40 a pilot brought down, 15 an assist and 10 a flight', () => {
    expect([P.kill, P.assist, P.sortie, P.cargoPerXp, P.lostShare]).toEqual([40, 15, 10, 10, 0.4]);
    // 123 resources → 12, two kills, one assist, the flight.
    expect(sortieXp({ ...flight, outcome: 'extracted' })).toEqual({ earned: 117, kept: 117 });
  });

  it('keeps 40 % of a lost or abandoned flight, rounded down', () => {
    expect(sortieXp({ ...flight, outcome: 'dead' })).toEqual({ earned: 117, kept: 46 });
    expect(sortieXp({ ...flight, outcome: 'towed' })).toEqual({ earned: 117, kept: 46 });
  });

  it('keeps a recalled flight\'s fights whole; its cargo still aboard earns when it is flown out', () => {
    expect(sortieXp({ ...flight, outcome: 'recalled' })).toEqual({ earned: 105, kept: 105 });
  });

  it('never pays a test flight', () => {
    expect(sortieXp({ ...flight, outcome: 'test' })).toEqual({ earned: 117, kept: 0 });
  });
});

describe('banking XP', () => {
  it('fills the bar and stops there until the level is bought', () => {
    expect(gainXp({ level: 3, xp: 100, core: 12 }, 30)).toEqual({ xp: 130, banked: 30 });
    expect(gainXp({ level: 3, xp: 130, core: 12 }, 30)).toEqual({ xp: 150, banked: 20 });
    expect(gainXp({ level: 3, xp: 150, core: 12 }, 30)).toEqual({ xp: 150, banked: 0 });
  });

  it('takes nothing at the Komuta Çekirdeği\'s cap nor at 20', () => {
    expect(gainXp({ level: 12, xp: 0, core: 12 }, 80)).toEqual({ xp: 0, banked: 0 });
    expect(gainXp({ level: 20, xp: 0, core: 25 }, 80)).toEqual({ xp: 0, banked: 0 });
    // The Çekirdeği grows and the ship grows with it again.
    expect(gainXp({ level: 12, xp: 0, core: 13 }, 80)).toEqual({ xp: 80, banked: 80 });
  });

  it('never banks a negative or broken gain', () => {
    expect(gainXp({ level: 3, xp: 10, core: 12 }, -5)).toEqual({ xp: 10, banked: 0 });
    expect(gainXp({ level: 3, xp: 10, core: 12 }, Number.NaN)).toEqual({ xp: 10, banked: 0 });
  });
});

describe('growth by level', () => {
  it('is the class at level one', () => {
    for (const ship of SHIP_CLASSES) expect(shipStats(ship, 1)).toEqual(CLASS_STATS[ship]);
    for (const ship of SHIP_CLASSES) expect(shipTuning(ship, 1)).toBe(classTuning(ship));
  });

  it('grows each class\'s own strengths to level 20 (plan §3.2)', () => {
    const top = (ship: ShipClass) => shipStats(ship, 20);
    expect(top('akinci').damage / CLASS_STATS.akinci.damage).toBeCloseTo(1.475, 6);
    expect(top('muhafiz').hull).toBe(Math.round(600 * 1.57));
    expect(top('kilavuz').fuelTank).toBe(Math.round(250 * 1.475));
    expect(top('muhafiz').cargoCapacity).toBe(Math.round(500 * 1.57));
    expect(top('akinci').spreadBase / CLASS_STATS.akinci.spreadBase).toBeCloseTo(1 - 0.285, 6);
  });

  it('grows speed slowly: the fastest ship reaches 120 m/s at 20, and each class keeps its order', () => {
    expect(top20('akinci').speedMax).toBeCloseTo(120, 6);
    expect(top20('kilavuz').speedMax).toBeLessThan(top20('akinci').speedMax);
    expect(top20('muhafiz').speedMax).toBeLessThan(top20('kilavuz').speedMax);
    expect(Math.max(...SHIP_CLASSES.map(ship => top20(ship).speedMax))).toBeLessThanOrEqual(120 + 1e-9);
    // Half way it is half way.
    expect(shipStats('akinci', 10).speedMax).toBeCloseTo(80 + 40 * 9 / 19, 6);
  });

  it('keeps turn, fire rate and magazine the class\'s own', () => {
    for (const ship of SHIP_CLASSES) {
      const top = top20(ship); const base = CLASS_STATS[ship];
      expect([top.turnRateMax, top.fireRate, top.ammoCapacity]).toEqual([base.turnRateMax, base.fireRate, base.ammoCapacity]);
    }
  });

  it('keeps the power gap: a level-20 Akıncı needs over 3.5 s for a new Muhafız at 60 % hits', () => {
    const gun = top20('akinci');
    expect(CLASS_STATS.muhafiz.hull / (gun.damage * gun.fireRate * 0.6)).toBeGreaterThan(3.5);
  });

  it('reads levels out of range as the nearest real one', () => {
    expect(shipStats('kilavuz', 0)).toEqual(shipStats('kilavuz', 1));
    expect(shipStats('kilavuz', 99)).toEqual(shipStats('kilavuz', 20));
    expect(shipStats('kilavuz', 4.6)).toEqual(shipStats('kilavuz', 4));
  });

  it('prices a full tank the same at every level', () => {
    const top = top20('kilavuz');
    expect(refillCost('kilavuz', 0, 0, 20)).toEqual(refillCost('kilavuz', 0, 0));
    expect(refillCost('kilavuz', top.fuelTank, top.ammoCapacity, 20).total).toBe(0);
  });
});
const top20 = (ship: ShipClass) => shipStats(ship, 20);

describe('a levelled ship in flight', () => {
  it('flies its level\'s numbers and carries its level in its own row', () => {
    const pilot = createPilot(3, 'muhafiz', 'smoke', 12);
    expect(pilot.level).toBe(12);
    expect(statsOf(pilot)).toEqual(shipStats('muhafiz', 12));
    expect([pilot.hull, pilot.fuel]).toEqual([shipStats('muhafiz', 12).hull, shipStats('muhafiz', 12).fuelTank]);
    expect(unpackPilot(packPilot(pilot)).level).toBe(12);
  });

  it('takes a row up to its own level\'s bounds, and no further', () => {
    const snap = (self: number[], others: number[][] = []): unknown => ({ kind: 'snap', tick: 30, ack: 0, self, others, mid: [], far: [], key: 1,
      bullets: [], bulletsGone: [], smoke: [], smokeGone: [], impacts: [], cargo: [], cargoGone: [], minerals: [], missiles: [], scan: [] });
    const top = createPilot(4, 'muhafiz', 'smoke', 20);
    top.hold[0] = shipStats('muhafiz', 20).cargoCapacity;
    expect(decodeArenaSnapshot(snap(packPilot(top), [packRemote(top)]))).not.toBeNull();
    const low = createPilot(4, 'muhafiz', 'smoke', 5); low.hull = shipStats('muhafiz', 5).hull + 1;
    expect(decodeArenaSnapshot(snap(packPilot(low)))).toBeNull();
    for (const level of [0, 21, 2.5]) {
      const row = packPilot(createPilot(4, 'kilavuz')); row[38] = level;
      expect(decodeArenaSnapshot(snap(row))).toBeNull();
    }
  });
});

describe('who brought a ship down', () => {
  function room() {
    const world = createSandboxWorld({ bots: 0, layout: layoutWith([]) });
    const a = world.pilot; a.shield = 0;
    const b = createPilot(5, 'akinci'); const victim = createPilot(6, 'kilavuz');
    for (const ship of [b, victim]) { world.drones.push(ship); world.dronePrevious.push({ ...ship, p: { ...ship.p }, q: { ...ship.q } }); }
    return { world, a, b, victim };
  }

  it('credits the killer and every other pilot who hurt the ship in the last 10 s', () => {
    const { world, a, b, victim } = room();
    strike(world, victim, 50, b.id);
    world.tick += T.tickRate * 9;
    strike(world, victim, victim.hull, a.id);
    expect([a.kills, a.pilotKills, a.assists]).toEqual([1, 1, 0]);
    expect([b.kills, b.pilotKills, b.assists]).toEqual([0, 0, 1]);
  });

  it('forgets a hit older than 10 s', () => {
    const { world, a, b, victim } = room();
    strike(world, victim, 50, b.id);
    world.tick += T.tickRate * P.assistSeconds + 1;
    strike(world, victim, victim.hull, a.id);
    expect(b.assists).toBe(0);
  });

  it('counts a bot as a kill on the board, never as a pilot or an assist', () => {
    const { world, a, b, victim } = room();
    victim.bot = true;
    strike(world, victim, 50, b.id);
    strike(world, victim, victim.hull, a.id);
    expect([a.kills, a.pilotKills, b.assists]).toEqual([1, 0, 0]);
  });

  it('marks the sandbox bots as bots, and keeps the mark through a respawn', () => {
    const world = createSandboxWorld({ bots: 2 });
    expect(world.drones.map(drone => drone.bot)).toEqual([true, true]);
    expect(world.pilot.bot).toBe(false);
    const bot = world.drones[0]; if (!bot) throw new Error('no bot');
    strike(world, bot, bot.hull, world.pilot.id);
    for (let i = 0; i < T.tickRate * T.botRespawn + 2; i++) stepSandboxWorld(world, createInput());
    expect([bot.phase, bot.bot]).toEqual(['flying', true]);
  });
});
