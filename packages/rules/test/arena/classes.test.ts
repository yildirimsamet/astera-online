import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, CLASS_HULLS, CLASS_STATS, PILOT_WIDTH, SHIP_CLASSES, classTuning, createInput, createPilot, createSandboxWorld,
  decodeArenaSnapshot, fuelBurn, hullGap, hullReach, lowFuel, packPilot, packRemote, shipStats, stepSandboxWorld, sweptHull, unpackPilot,
  type ArenaIntent, type ArenaWorld, type Pilot, type ShipClass,
} from '../../src/arena/index.js';
import { layoutWith, sphere } from './helpers.js';

/**
 * Y4 classes (plan 14 §3.1), owner 2026-10-23: the plan's ratios scaled to the ship of today,
 * which is the Kılavuz; the Akıncı is the fastest at the KG-X25 cap of 80 / 160 m/s.
 */
const intent = (patch: Partial<ArenaIntent> = {}): ArenaIntent => ({ ...createInput(), ...patch });

function range(ship: ShipClass): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith(), ship });
  Object.assign(world.pilot.p, { x: 0, y: 0, z: 0 }); Object.assign(world.pilot.q, { x: 0, y: 0, z: 0, w: 1 });
  world.pilot.shield = 0;
  return world;
}
function target(world: ArenaWorld, ship: ShipClass = 'muhafiz', z = 150): Pilot {
  const pilot = createPilot(9, ship);
  pilot.p.z = z;
  world.drones.push(pilot);
  world.dronePrevious.push({ ...pilot, p: { ...pilot.p }, q: { ...pilot.q } });
  return pilot;
}
const run = (world: ArenaWorld, seconds: number, input: ArenaIntent): void => {
  for (let i = 0; i < Math.round(seconds * T.tickRate); i++) stepSandboxWorld(world, input);
};

describe('three classes', () => {
  it('holds the owner\'s table', () => {
    const table = SHIP_CLASSES.map(ship => {
      const s = CLASS_STATS[ship];
      return [ship, s.speedMax, Math.round(s.turnRateMax * 180 / Math.PI), s.hull, s.damage, s.fireRate,
        Number((s.spreadBase * 180 / Math.PI).toFixed(2)), s.fuelTank, s.cargoCapacity, s.ammoCapacity];
    });
    expect(table).toEqual([
      // Owner 2026-10-24: every cone starts 15 % wider (1.3°, 1.8°, 1.5° before); levels narrow it as before.
      // Owner 2026-10-27: "gemiler biraz çabuk ölüyor" — every hull 50 % stronger (340, 600, 400 before).
      ['akinci', 80, 82, 510, 13, 9, 1.49, 220, 300, 540],
      ['muhafiz', 60, 58, 900, 18, 5.5, 2.07, 280, 500, 330],
      ['kilavuz', 72, 72, 600, 10, 8, 1.72, 250, 400, 480],
    ]);
  });

  it('flies the Akıncı at the KG-X25 cap; the Kılavuz is the ship of today in all but speed and its wider cone', () => {
    expect(CLASS_STATS.akinci.speedMax).toBe(T.speedMax);
    const k = CLASS_STATS.kilavuz;
    expect([k.hull, k.damage, k.fireRate, k.fuelTank, k.cargoCapacity, k.ammoCapacity, k.turnRateMax])
      .toEqual([T.hull, T.damage, T.fireRate, T.fuelTank, T.cargoCapacity, T.ammoCapacity, T.turnRateMax]);
    expect(k.spreadBase).toBeCloseTo(T.spreadBase * 1.15, 12);
  });

  it('gives the owner\'s times to kill at 60 % hits', () => {
    const ttk = (from: ShipClass, to: ShipClass): number => CLASS_STATS[to].hull / (CLASS_STATS[from].damage * CLASS_STATS[from].fireRate * 0.6);
    const round = (n: number): number => Math.round(n * 10) / 10;
    expect([ttk('akinci', 'akinci'), ttk('akinci', 'kilavuz'), ttk('akinci', 'muhafiz')].map(round)).toEqual([7.3, 8.5, 12.8]);
    expect([ttk('kilavuz', 'akinci'), ttk('kilavuz', 'kilavuz'), ttk('kilavuz', 'muhafiz')].map(round)).toEqual([10.6, 12.5, 18.8]);
    expect([ttk('muhafiz', 'akinci'), ttk('muhafiz', 'kilavuz'), ttk('muhafiz', 'muhafiz')].map(round)).toEqual([8.6, 10.1, 15.2]);
  });

  it('starts a pilot of each class full: hull, tank, magazine', () => {
    for (const ship of SHIP_CLASSES) {
      const pilot = createPilot(5, ship);
      expect(pilot.ship).toBe(ship);
      expect([pilot.hull, pilot.fuel, pilot.ammo]).toEqual([CLASS_STATS[ship].hull, CLASS_STATS[ship].fuelTank, CLASS_STATS[ship].ammoCapacity]);
    }
    expect(createPilot(5).ship).toBe('kilavuz');
  });

  it('flies each class at its own top speed, turbo twice that', () => {
    for (const ship of SHIP_CLASSES) {
      const world = range(ship);
      run(world, 6, intent({ throttle: 1 }));
      expect(world.pilot.s).toBeCloseTo(CLASS_STATS[ship].speedMax, 6);
      world.pilot.turboCharge = T.turboCharge;
      run(world, 1.5, intent({ throttle: 1, turbo: true }));
      expect(world.pilot.s).toBeCloseTo(CLASS_STATS[ship].speedMax * T.turboSpeedMul, 6);
    }
  });

  it('turns the Akıncı tightest and the Muhafız widest', () => {
    const heading = (ship: ShipClass): number => {
      const world = range(ship);
      run(world, 4, intent({ throttle: 1 }));
      run(world, 1, intent({ throttle: 1, steerX: 1 }));
      return Math.abs(world.pilot.omegaYaw);
    };
    const [a, k, m] = [heading('akinci'), heading('kilavuz'), heading('muhafiz')];
    expect(a).toBeGreaterThan(k); expect(k).toBeGreaterThan(m);
    // At full speed each turns at its own rate: the ratio is the table's.
    expect(a / m).toBeCloseTo(CLASS_STATS.akinci.turnRateMax / CLASS_STATS.muhafiz.turnRateMax, 1);
  });

  it('fires each class at its own rate and spends its own magazine', () => {
    for (const ship of SHIP_CLASSES) {
      const world = range(ship);
      run(world, 2, intent({ fire: true }));
      expect(Math.abs(world.pilot.shots - 2 * CLASS_STATS[ship].fireRate)).toBeLessThanOrEqual(1);
      expect(world.pilot.ammo).toBe(CLASS_STATS[ship].ammoCapacity - world.pilot.shots);
    }
  });

  it('hits for the shooter\'s damage, also once the shooter is gone', () => {
    for (const ship of SHIP_CLASSES) {
      const world = range(ship);
      const victim = target(world);
      stepSandboxWorld(world, intent({ fire: true }));
      // The shot is in the air; the shooter's class no longer matters to it.
      world.pilot.ship = 'kilavuz';
      run(world, 0.5, intent());
      expect(victim.hull).toBe(CLASS_STATS.muhafiz.hull - CLASS_STATS[ship].damage);
    }
  });

  it('scatters each class by its own cone: the same shot, 1.3 : 1.5 : 1.8', () => {
    const offset = (ship: ShipClass): number => {
      const world = range(ship);
      run(world, 0.2, intent());
      stepSandboxWorld(world, intent({ fire: true }));
      const bullet = world.projectiles.find(b => b.life > 0 && b.owner === world.pilot.id);
      if (!bullet) throw new Error('no shot');
      // The first gun's line without scatter: converging on the nose line at convergeDist.
      return Math.hypot(bullet.v.x / bullet.v.z - 1.2 / T.convergeDist, bullet.v.y / bullet.v.z - 0.6 / T.convergeDist);
    };
    const [a, k, m] = [offset('akinci'), offset('kilavuz'), offset('muhafiz')];
    expect(k).toBeGreaterThan(0);
    expect(a / k).toBeCloseTo(1.3 / 1.5, 6);
    expect(m / k).toBeCloseTo(1.8 / 1.5, 6);
  });

  it('fills each class\'s own hold and no more', () => {
    for (const ship of SHIP_CLASSES) {
      const world = createSandboxWorld({ bots: 0, ship, layout: layoutWith([sphere(0, 0, 0, 80, 20, 'crystal')]) });
      Object.assign(world.pilot.p, { x: 0, y: 0, z: 0 }); Object.assign(world.pilot.q, { x: 0, y: 0, z: 0, w: 1 });
      for (let i = 0; i < 900 && !world.pilot.landed; i++) stepSandboxWorld(world, intent({ throttle: 0.12 }));
      expect(world.pilot.landed).toBeGreaterThan(0);
      world.minerals[0] = 10000;
      world.pilot.cargo = CLASS_STATS[ship].cargoCapacity - 1; world.pilot.hold = [world.pilot.cargo, 0, 0];
      run(world, 1, intent());
      expect(world.pilot.cargo).toBeCloseTo(CLASS_STATS[ship].cargoCapacity, 9);
      expect(world.pilot.mining).toBe(false);
    }
  });

  it('warns of low fuel at 15 % of the class\'s own tank', () => {
    const muhafiz = classTuning('muhafiz');
    expect(lowFuel(muhafiz.fuelTank * 0.16, muhafiz)).toBe(false);
    expect(lowFuel(muhafiz.fuelTank * 0.14, muhafiz)).toBe(true);
    // 40 units: low in the Muhafız's tank, not in the Akıncı's.
    expect([lowFuel(40, muhafiz), lowFuel(40, classTuning('akinci'))]).toEqual([true, false]);
  });

  it('leaves every class most of its tank to farm after rim → heart → exit at full throttle', () => {
    for (const ship of SHIP_CLASSES) {
      const s = classTuning(ship);
      expect((12500 + 10000) / s.speedMax * fuelBurn(1, false, s)).toBeLessThan(s.fuelTank * 2 / 3);
    }
  });

  it('puts the hunter in the Akıncı, the miner in the Muhafız and the patrol in the Kılavuz', () => {
    const world = createSandboxWorld({ ship: 'akinci' });
    expect(world.pilot.ship).toBe('akinci');
    const ships = world.drones.map(bot => [world.brains.get(bot.id)?.role, bot.ship]);
    expect(ships).toEqual([['hunter', 'akinci'], ['miner', 'muhafiz'], ['patrol', 'kilavuz']]);
    // Bots keep their ship and refill its own tank and magazine.
    run(world, 1, intent());
    for (const bot of world.drones) {
      expect(bot.fuel).toBeCloseTo(CLASS_STATS[bot.ship].fuelTank, 0);
      expect(bot.ammo).toBeLessThanOrEqual(CLASS_STATS[bot.ship].ammoCapacity);
    }
  });
});

/**
 * Y4b (plan 14 §8): each class collides and is hit as its own model, measured on its LOD0 surface by
 * tools/arena-hulls.mjs (at most 0,5 m of the model outside its capsules). Half spans of the
 * models: Akıncı 4.18 m, Muhafız 4.77 m, Kılavuz 8.88 m (forward-swept wings).
 */
describe('each class has its own hull', () => {
  it('flies the capsules fitted to its model, mirrored left to right', () => {
    for (const ship of SHIP_CLASSES) {
      const capsules = classTuning(ship).capsules;
      expect(capsules).toBe(CLASS_HULLS[ship]);
      expect(capsules.length).toBeLessThanOrEqual(5);
      for (const c of capsules) {
        const mirror = capsules.find(m => m.ax === -c.ax && m.bx === -c.bx && m.ay === c.ay && m.az === c.az && m.by === c.by && m.bz === c.bz && m.r === c.r);
        expect(mirror).toBeDefined();
      }
    }
    // Every model is 15 m long; the Kılavuz's wings make it the widest.
    const reach = SHIP_CLASSES.map(ship => hullReach(classTuning(ship)));
    for (const r of reach) { expect(r).toBeGreaterThanOrEqual(7.5); expect(r).toBeLessThan(10); }
    expect(hullReach(classTuning('kilavuz'))).toBeGreaterThan(hullReach(classTuning('akinci')));
  });

  it('meets rock where its model is: a rock beside the Kılavuz\'s wing tip touches it, not the Akıncı', () => {
    // The rock's surface 8.3 m out to the side, level with the Kılavuz's wing tip.
    const layout = layoutWith([sphere(0, 8.3 + 50, -1.9, 3.4, 50)]);
    const at = { x: 0, y: 0, z: 0 }; const level = { x: 0, y: 0, z: 0, w: 1 };
    expect(hullGap(layout, 0, at, level, classTuning('kilavuz'))).toBeLessThan(0);
    expect(hullGap(layout, 0, at, level, classTuning('akinci'))).toBeGreaterThan(2);
  });

  it('is hit where its model is: a burst past an Akıncı strikes a Kılavuz\'s wing in the same place', () => {
    for (const [ship, struck] of [['kilavuz', true], ['akinci', false]] as const) {
      const world = range('akinci');
      const victim = target(world, ship, 40);
      victim.p.x = -8.5; victim.shield = 0;
      const previous = world.dronePrevious[0]; if (!previous) throw new Error('no previous');
      previous.p.x = -8.5;
      run(world, 1, intent({ fire: true }));
      expect(victim.hull < CLASS_STATS[ship].hull).toBe(struck);
    }
  });

  it('takes a shot by the target\'s capsules, not the generic hull', () => {
    const victim = createPilot(1, 'kilavuz');
    const shot = { previous: { x: 8, y: 50, z: 3.4 }, p: { x: 8, y: -50, z: 3.4 } };
    expect(sweptHull(shot, victim, victim.p, classTuning('kilavuz'))).toBeLessThan(1);
    expect(sweptHull(shot, victim, victim.p, classTuning('akinci'))).toBeGreaterThan(1);
    expect(sweptHull(shot, victim, victim.p, T)).toBeGreaterThan(1);
  });
});

describe('a class on the wire', () => {
  const snap = (self: number[], others: number[][] = []): unknown => ({ kind: 'snap', tick: 30, ack: 0, self, others, mid: [], far: [], key: 1,
    bullets: [], bulletsGone: [], smoke: [], smokeGone: [], impacts: [], cargo: [], cargoGone: [], minerals: [], missiles: [], scan: [] });

  it('carries the pilot\'s own class in its row', () => {
    for (const ship of SHIP_CLASSES) {
      const row = packPilot(createPilot(4, ship));
      expect(row).toHaveLength(PILOT_WIDTH);
      expect(unpackPilot(row, createPilot(4)).ship).toBe(ship);
      expect(decodeArenaSnapshot(snap(row))).not.toBeNull();
    }
  });

  it('takes a full Muhafız hull and magazine, and refuses more than the class holds', () => {
    const muhafiz = createPilot(4, 'muhafiz');
    expect(decodeArenaSnapshot(snap(packPilot(muhafiz), [packRemote(muhafiz)]))).not.toBeNull();
    const over = createPilot(4, 'akinci'); over.hull = CLASS_STATS.akinci.hull + 1;
    expect(decodeArenaSnapshot(snap(packPilot(over)))).toBeNull();
    const tank = createPilot(4, 'akinci'); tank.fuel = CLASS_STATS.akinci.fuelTank + 1;
    expect(decodeArenaSnapshot(snap(packPilot(tank)))).toBeNull();
    const hold = createPilot(4, 'akinci'); hold.hold[0] = CLASS_STATS.akinci.cargoCapacity + 1;
    expect(decodeArenaSnapshot(snap(packPilot(hold)))).toBeNull();
    // Another ship's row says nothing of its level: the bound is the sturdiest level-20 hull (Y6b).
    const remote = createPilot(5, 'muhafiz'); remote.hull = shipStats('muhafiz', 20).hull + 1;
    expect(decodeArenaSnapshot(snap(packPilot(createPilot(4)), [packRemote(remote)]))).toBeNull();
  });

  it('refuses a class it does not know', () => {
    const row = packPilot(createPilot(4));
    row[PILOT_WIDTH - 2] = SHIP_CLASSES.length;
    expect(decodeArenaSnapshot(snap(row))).toBeNull();
    row[PILOT_WIDTH - 2] = 0.5;
    expect(decodeArenaSnapshot(snap(row))).toBeNull();
  });
});
