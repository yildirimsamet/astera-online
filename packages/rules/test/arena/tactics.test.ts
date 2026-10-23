import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, CLASS_STATS, applyFeed, createInput, createPilot, createSandboxWorld, keyFeed, packPilot, packRemote, scanTargets,
  stepSandboxWorld, strike, unpackPilot, type ArenaIntent, type ArenaObstacle, type ArenaWorld, type Pilot, type ShipClass, type Tactic,
} from '../../src/arena/index.js';
import { layoutWith, sphere } from './helpers.js';

/**
 * Y4d (plan 14 §4): the last two B-slot tactics. Illusion: a copy born inside the ship flies the
 * mirror of its pilot's stick for a few seconds, looks and fires like the ship, and breaks like a
 * hologram. Radar: every enemy in the arena is marked for a few seconds, the landed behind rock
 * too, never the cloaked or a copy; the scanned are told, and told from where.
 */
const intent = (patch: Partial<ArenaIntent> = {}): ArenaIntent => ({ ...createInput(), ...patch });
const ticks = (seconds: number): number => Math.round(seconds * T.tickRate);
const run = (world: ArenaWorld, n: number, input: ArenaIntent = intent()): void => { for (let i = 0; i < n; i++) stepSandboxWorld(world, input); };

function arena(tactic: Tactic, ship: ShipClass = 'kilavuz', obstacles: readonly ArenaObstacle[] = []): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith(obstacles), ship, tactic });
  Object.assign(world.pilot.p, { x: 0, y: 0, z: 0 }); Object.assign(world.pilot.q, { x: 0, y: 0, z: 0, w: 1 });
  world.pilot.shield = 0;
  return world;
}
function enemy(world: ArenaWorld, ship: ShipClass, x: number, z: number): Pilot {
  const foe = createPilot(world.nextId++, ship);
  foe.p.x = x; foe.p.z = z;
  world.drones.push(foe);
  world.dronePrevious.push({ ...foe, p: { ...foe.p }, q: { ...foe.q } });
  return foe;
}
const copyOf = (world: ArenaWorld, pilot: Pilot): Pilot | undefined => world.drones.find(ship => ship.decoyOf === pilot.id);
const holograms = (world: ArenaWorld): number => world.impacts.filter(hit => hit.active && hit.kind === 'hologram').length;

describe('illusion', () => {
  it('casts a copy inside the ship: same place, heading, speed, class and hull bar; its cooldown runs', () => {
    const world = arena('illusion', 'akinci');
    world.pilot.hull = 300; world.pilot.s = 40;
    run(world, 1, intent({ illusion: true, throttle: 0.5 }));
    const copy = copyOf(world, world.pilot);
    if (!copy) throw new Error('no copy');
    expect(world.pilot.decoy).toBe(copy.id);
    expect(copy.id).not.toBe(world.pilot.id);
    expect([copy.ship, copy.hull, copy.s, copy.p.z, copy.q.w]).toEqual([world.pilot.ship, 300, world.pilot.s, world.pilot.p.z, world.pilot.q.w]);
    expect(world.pilot.tacticCooldown).toBe(ticks(T.illusionCooldown));
    run(world, 1, intent({ illusion: true }));
    expect(world.drones.filter(ship => ship.decoyOf === world.pilot.id)).toHaveLength(1);
  });

  it('is cast only as the B slot chosen', () => {
    const world = arena('smoke');
    run(world, 1, intent({ illusion: true }));
    expect(copyOf(world, world.pilot)).toBeUndefined();
    expect(world.pilot.tacticCooldown).toBe(0);
  });

  it('flies the mirror of its pilot: right is left, up is down; throttle and turbo alike', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    const copy = copyOf(world, world.pilot); if (!copy) throw new Error('no copy');
    run(world, 20, intent({ steerX: 0.6, steerY: 0.4, throttle: 1, turbo: true }));
    expect(Math.abs(world.pilot.omegaYaw)).toBeGreaterThan(0.1);
    expect(Math.sign(copy.omegaYaw)).toBe(-Math.sign(world.pilot.omegaYaw));
    expect(Math.sign(copy.omegaPitch)).toBe(-Math.sign(world.pilot.omegaPitch));
    expect(copy.s).toBeCloseTo(world.pilot.s, 6);
    expect(copy.turboActive).toBe(world.pilot.turboActive);
    expect(Math.sign(copy.p.x)).toBe(-Math.sign(world.pilot.p.x));
  });

  it('breaks like a hologram once its time is up; the pilot is told it is gone', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    run(world, ticks(T.illusionDuration) - 2);
    expect(copyOf(world, world.pilot)).toBeDefined();
    run(world, 1);
    expect(copyOf(world, world.pilot)).toBeUndefined();
    expect(world.pilot.decoy).toBe(-1);
    expect(world.drones).toHaveLength(world.dronePrevious.length);
    expect(holograms(world)).toBe(1);
  });

  it('takes hits like a ship and breaks at a quarter of its class hull: no kill, no wreck', () => {
    const world = arena('illusion', 'muhafiz');
    const foe = enemy(world, 'akinci', 0, 2000);
    run(world, 1, intent({ illusion: true }));
    const copy = copyOf(world, world.pilot); if (!copy) throw new Error('no copy');
    const quarter = CLASS_STATS.muhafiz.hull * T.decoyHullShare;
    strike(world, copy, quarter - 1, foe.id);
    expect(copy.hull).toBe(CLASS_STATS.muhafiz.hull - (quarter - 1));
    run(world, 1);
    expect(copyOf(world, world.pilot)).toBeDefined();
    strike(world, copy, 1, foe.id);
    run(world, 1);
    expect(copyOf(world, world.pilot)).toBeUndefined();
    expect([foe.kills, foe.hits]).toEqual([0, 2]);
    expect(world.impacts.filter(hit => hit.active && hit.kind === 'explosion')).toHaveLength(0);
    expect(holograms(world)).toBe(1);
    expect(world.cargoDrops.filter(drop => drop.active && !drop.field)).toHaveLength(0);
  });

  it('lets its own pilot\'s fire through, and its own fire is light only: it hurts no one', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    const copy = copyOf(world, world.pilot); if (!copy) throw new Error('no copy');
    Object.assign(copy.p, { x: 0, y: 0, z: 150 });
    const own = world.projectiles[0]; if (!own) throw new Error('no bullet');
    Object.assign(own, { p: { x: 0, y: 0, z: 120 }, previous: { x: 0, y: 0, z: 120 }, v: { x: 0, y: 0, z: T.muzzleSpeed }, life: 1, owner: world.pilot.id, damage: 20 });
    const foe = enemy(world, 'muhafiz', 400, 0);
    const fake = world.projectiles[1]; if (!fake) throw new Error('no bullet');
    Object.assign(fake, { p: { x: 400, y: 0, z: -40 }, previous: { x: 400, y: 0, z: -40 }, v: { x: 0, y: 0, z: T.muzzleSpeed }, life: 1, owner: world.pilot.id, damage: 0 });
    run(world, 3);
    expect(copy.hull).toBe(CLASS_STATS.kilavuz.hull);
    expect(foe.hull).toBe(CLASS_STATS.muhafiz.hull);
    expect(world.impacts.some(hit => hit.active && hit.kind === 'ship')).toBe(true);
  });

  it('fires blanks in its pilot\'s name as its pilot fires', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    run(world, 6, intent({ fire: true }));
    const blanks = world.projectiles.filter(bullet => bullet.life > 0 && bullet.owner === world.pilot.id && bullet.damage === 0);
    expect(blanks.length).toBeGreaterThan(0);
    expect(world.pilot.ammo).toBe(CLASS_STATS.kilavuz.ammoCapacity - world.pilot.shots);
  });

  it('goes with its pilot: one who dies or leaves takes the copy away', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    world.pilot.phase = 'dead';
    run(world, 1);
    expect(copyOf(world, world.pilot)).toBeUndefined();
    expect(holograms(world)).toBe(1);
  });

  it('never pulls cargo in', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    const copy = copyOf(world, world.pilot); if (!copy) throw new Error('no copy');
    Object.assign(copy.p, { x: 600, y: 0, z: 0 });
    const drop = world.cargoDrops.find(piece => !piece.field); if (!drop) throw new Error('no drop');
    Object.assign(drop, { p: { x: 605, y: 0, z: 0 }, amount: 5, active: true, kind: 0, claim: -1, age: 0 });
    run(world, 2);
    expect(drop.claim).toBe(-1);
    expect(copy.cargo).toBe(0);
  });

  it('draws an enemy Akıncı\'s lock, never its own pilot\'s', () => {
    const world = arena('illusion', 'akinci');
    run(world, 1, intent({ illusion: true }));
    const copy = copyOf(world, world.pilot); if (!copy) throw new Error('no copy');
    run(world, ticks(T.lockTime) + 1);
    Object.assign(copy.p, { x: 0, y: 0, z: 200 });
    run(world, ticks(T.lockTime) + 1);
    expect(world.pilot.lockTarget).toBe(-1);
    const foe = enemy(world, 'akinci', 0, 450);
    Object.assign(foe.q, { x: 0, y: 1, z: 0, w: 0 });
    world.pilot.p.x = 80;
    for (let i = 0; i < ticks(T.lockTime) + 1; i++) { Object.assign(copy.p, { x: 0, y: 0, z: 200 }); run(world, 1); }
    expect(foe.lockTarget).toBe(copy.id);
  });
});

describe('radar sweep', () => {
  it('marks every enemy for its time, those behind rock too, never the cloaked or a copy', () => {
    const world = arena('radar', 'kilavuz', [sphere(0, 0, 0, 900, 120)]);
    const open = enemy(world, 'akinci', 300, 0);
    const hidden = enemy(world, 'muhafiz', 0, 1200);
    const cloaked = enemy(world, 'kilavuz', -300, 0); cloaked.cloak = ticks(10);
    const copy = enemy(world, 'akinci', 0, -400); copy.decoyOf = open.id;
    run(world, 1, intent({ radar: true }));
    expect(scanTargets(world, world.pilot.id).sort((a, b) => a - b)).toEqual([open.id, hidden.id].sort((a, b) => a - b));
    expect(world.pilot.scan).toBe(ticks(T.radarDuration));
    expect(world.pilot.tacticCooldown).toBe(ticks(T.radarCooldown));
    expect(scanTargets(world, open.id)).toEqual([]);
    run(world, ticks(T.radarDuration));
    expect(scanTargets(world, world.pilot.id)).toEqual([]);
    expect(world.pilot.scan).toBe(0);
  });

  it('tells the scanned it was scanned, and from where, for as long as it lasts', () => {
    const world = arena('radar');
    const foe = enemy(world, 'muhafiz', 300, 0);
    world.pilot.p.z = 10;
    run(world, 1, intent({ radar: true }));
    expect([foe.threat, foe.threatX, foe.threatZ]).toEqual([4, 0, 10]);
    expect(world.pilot.threat).toBe(0);
    run(world, ticks(T.radarDuration) - 1);
    expect(foe.threat).toBe(4);
    run(world, 1);
    expect(foe.threat).toBe(0);
  });

  it('loses a ship that cloaks while it is marked', () => {
    const world = arena('radar');
    const foe = enemy(world, 'muhafiz', 300, 0);
    run(world, 1, intent({ radar: true }));
    foe.cloak = ticks(4);
    expect(scanTargets(world, world.pilot.id)).toEqual([]);
  });

  it('is outranked by a lock: being locked is the nearer danger', () => {
    const world = arena('radar', 'akinci');
    const foe = enemy(world, 'muhafiz', 0, 300);
    run(world, 1, intent({ radar: true }));
    expect(foe.threat).toBe(1);
    run(world, ticks(T.lockTime));
    expect(foe.threat).toBe(2);
  });
});

describe('the last tactics on the wire', () => {
  it('carries the tactic, its cooldown, the copy and the sweep in the own row', () => {
    const pilot = createPilot(5, 'muhafiz', 'radar');
    pilot.tacticCooldown = 40; pilot.decoy = 12; pilot.scan = 30; pilot.threat = 4;
    const back = unpackPilot(packPilot(pilot));
    expect([back.tactic, back.tacticCooldown, back.decoy, back.scan, back.threat]).toEqual(['radar', 40, 12, 30, 4]);
    expect(unpackPilot(packPilot(createPilot(6, 'kilavuz', 'illusion'))).tactic).toBe('illusion');
  });

  it('sends a copy as any ship: its row says nothing a real ship\'s would not', () => {
    const copy = createPilot(7, 'akinci');
    copy.decoyOf = 3; copy.decoyLife = 50; copy.decoyHp = 20;
    const plain = createPilot(7, 'akinci');
    expect(packRemote(copy)).toEqual(packRemote(plain));
  });

  it('shows every client the hologram break', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    world.pilot.phase = 'dead';
    run(world, 1);
    const client = createSandboxWorld({ bots: 0, layout: layoutWith() });
    applyFeed(client, keyFeed(world));
    expect(client.impacts.filter(hit => hit.active && hit.kind === 'hologram')).toHaveLength(1);
  });
});
