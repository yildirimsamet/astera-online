import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, CLASS_STATS, applyFeed, createInput, createPilot, createSandboxWorld, keyFeed, mirrorPose, packPilot, packRemote, scanTargets,
  stepSandboxWorld, strike, unpackPilot, type ArenaIntent, type ArenaObstacle, type ArenaWorld, type Pilot, type Quaternion, type ShipClass, type Tactic, type Vec3,
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
const forwardOf = (q: Quaternion): Vec3 => ({ x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) });
const upOf = (q: Quaternion): Vec3 => ({ x: 2 * (q.x * q.y - q.w * q.z), y: 1 - 2 * (q.x * q.x + q.z * q.z), z: 2 * (q.y * q.z + q.w * q.x) });
/** A half turn about the unit line `f`: along it stays, across it flips (right is left, up is down). */
const halfTurn = (v: Vec3, f: Vec3): Vec3 => {
  const d = v.x * f.x + v.y * f.y + v.z * f.z;
  return { x: 2 * d * f.x - v.x, y: 2 * d * f.y - v.y, z: 2 * d * f.z - v.z };
};
const near = (a: Vec3, b: Vec3, digits = 6): void => { expect([a.x, a.y, a.z].map(n => n.toFixed(digits))).toEqual([b.x, b.y, b.z].map(n => n.toFixed(digits))); };
/** Moves a copy's line so it flies at (x, y, z) from where its pilot is now: the line half-way, across the gap. */
function put(world: ArenaWorld, copy: Pilot, x: number, y: number, z: number): void {
  const p = world.pilot.p; const dx = x - p.x; const dz = z - p.z; const length = Math.sqrt(dx * dx + dz * dz);
  Object.assign(copy.decoyFrom, { x: (p.x + x) / 2, y: (p.y + y) / 2, z: (p.z + z) / 2 });
  Object.assign(copy.decoyAlong, { x: -dz / length, y: 0, z: dx / length });
}

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
    // Akıncı's free illusion rank (Y6c): 5% shorter cooldown.
    expect(world.pilot.tacticCooldown).toBe(ticks(T.illusionCooldown * 0.95));
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

  it('is its pilot\'s exact mirror about the line it was cast along, cast climbing, through every turn and the turbo (owner 2026-10-24)', () => {
    const world = arena('illusion');
    // Cast climbing, nose 30° up and heading +x: the line it is cast along is not level.
    const from = { x: 120, y: 40, z: -60 }; const n = Math.sqrt(2 * (0.183 * 0.183 + 0.683 * 0.683)); const q = { x: -0.183 / n, y: 0.683 / n, z: 0.183 / n, w: 0.683 / n };
    Object.assign(world.pilot.p, from); Object.assign(world.pilot.q, q);
    const along = forwardOf(q);
    expect(along.y).toBeGreaterThan(0.4);
    run(world, 1, intent({ illusion: true, throttle: 1 }));
    const copy = copyOf(world, world.pilot); if (!copy) throw new Error('no copy');
    let boosted = false;
    const legs = [{ steerX: 0.7 }, { steerY: 0.6, turbo: true }, { steerX: -0.7 }, { steerY: -0.6 }, { steerX: 0.6, steerY: 0.5 }, { steerX: -0.5, steerY: -0.6, turbo: true }];
    for (const leg of legs) {
      for (let i = 0; i < 28; i++) {
        run(world, 1, intent({ throttle: 1, ...leg }));
        const pilot = world.pilot; boosted ||= pilot.turboActive;
        const d = halfTurn({ x: pilot.p.x - from.x, y: pilot.p.y - from.y, z: pilot.p.z - from.z }, along);
        near(copy.p, { x: from.x + d.x, y: from.y + d.y, z: from.z + d.z });
        near(forwardOf(copy.q), halfTurn(forwardOf(pilot.q), along));
        const up = halfTurn(upOf(pilot.q), along);
        near(upOf(copy.q), { x: -up.x, y: -up.y, z: -up.z });
        expect([copy.s, copy.turboActive]).toEqual([pilot.s, pilot.turboActive]);
      }
    }
    expect(boosted).toBe(true);
    expect(Math.abs(world.pilot.p.z - from.z)).toBeGreaterThan(20);
    expect(copyOf(world, world.pilot)).toBeDefined();
  });

  it('breaks at the arena\'s floor, as at rock, where its pilot climbs away from it', () => {
    const climb = (steerY: number): boolean => { const dry = arena('illusion'); run(dry, 30, intent({ throttle: 1, steerY })); return dry.pilot.p.y > 5; };
    const up = climb(0.8) ? 0.8 : -0.8;
    expect(climb(up)).toBe(true);
    const world = arena('illusion');
    world.pilot.p.y = -world.layout.halfHeight + 30;
    run(world, 1, intent({ illusion: true, throttle: 1 }));
    for (let i = 0; i < 60 && copyOf(world, world.pilot); i++) run(world, 1, intent({ throttle: 1, steerY: up }));
    expect(copyOf(world, world.pilot)).toBeUndefined();
    expect(holograms(world)).toBe(1);
    run(world, 30, intent({ throttle: 1, steerY: up }));
    expect(world.pilot.p.y).toBeGreaterThan(-world.layout.halfHeight + 60);
  });

  it('mirrors a pose the client can hand in as its own out: the cast pose is itself', () => {
    const q = { x: 0.1, y: 0.7, z: -0.1, w: 0.7 }; const n = Math.sqrt(0.01 + 0.49 + 0.01 + 0.49);
    q.x /= n; q.y /= n; q.z /= n; q.w /= n;
    const p = { x: 5, y: -7, z: 9 }; const along = forwardOf(q);
    const outP = { ...p }; const outQ = { ...q };
    mirrorPose(p, along, outP, outQ, outP, outQ);
    near(outP, p); expect([outQ.x, outQ.y, outQ.z, outQ.w].map(v => v.toFixed(9))).toEqual([q.x, q.y, q.z, q.w].map(v => v.toFixed(9)));
  });

  it('breaks like a hologram when it flies into rock its pilot flies clear of (owner 2026-10-24)', () => {
    const fly = (world: ArenaWorld): void => { run(world, 1, intent({ illusion: true, throttle: 1 })); run(world, 60, intent({ throttle: 1, steerX: 0.7 })); };
    const dry = arena('illusion'); fly(dry);
    const at = dry.pilot.p;
    expect(Math.sqrt(at.x * at.x + at.y * at.y)).toBeGreaterThan(30);
    // Cast from the origin heading +z: the copy is at (-x, -y, z) of its pilot.
    const world = arena('illusion', 'kilavuz', [sphere(0, -at.x, -at.y, at.z, 12)]); fly(world);
    expect(copyOf(world, world.pilot)).toBeUndefined();
    expect(world.pilot.decoy).toBe(-1);
    expect(holograms(world)).toBe(1);
    expect([world.pilot.phase, world.pilot.hull]).toEqual(['flying', CLASS_STATS.kilavuz.hull]);
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
    put(world, copy, 0, 0, 150);
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

  it('fires blanks in its pilot\'s name as its pilot fires, round for round', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    run(world, 6, intent({ fire: true }));
    const blanks = world.projectiles.filter(bullet => bullet.life > 0 && bullet.owner === world.pilot.id && bullet.damage === 0);
    expect(blanks.length).toBeGreaterThan(0);
    expect(blanks.length).toBe(world.projectiles.filter(bullet => bullet.life > 0 && bullet.owner === world.pilot.id && bullet.damage > 0).length);
    expect(world.pilot.ammo).toBe(CLASS_STATS.kilavuz.ammoCapacity - world.pilot.shots);
  });

  it('stays silent when its pilot\'s magazine is empty: a copy that fires alone gives itself away', () => {
    const world = arena('illusion');
    run(world, 1, intent({ illusion: true }));
    world.pilot.ammo = 0;
    run(world, 6, intent({ fire: true }));
    expect(world.projectiles.filter(bullet => bullet.life > 0)).toHaveLength(0);
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
    put(world, copy, 600, 0, 0);
    run(world, 1);
    expect(copy.p.x).toBeCloseTo(600, 3);
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
    put(world, copy, 0, 0, 200);
    run(world, ticks(T.lockTime) + 1);
    expect(copy.p.z).toBeCloseTo(200, 3);
    expect(world.pilot.lockTarget).toBe(-1);
    const foe = enemy(world, 'akinci', 0, 450);
    Object.assign(foe.q, { x: 0, y: 1, z: 0, w: 0 });
    world.pilot.p.x = 80;
    for (let i = 0; i < ticks(T.lockTime) + 1; i++) { put(world, copy, 0, 0, 200); run(world, 1); }
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
    // Kılavuz's free radar rank (Y6c): 10% longer sweep, 5% shorter cooldown.
    expect(world.pilot.scan).toBe(ticks(T.radarDuration * 1.1));
    expect(world.pilot.tacticCooldown).toBe(ticks(T.radarCooldown * 0.95));
    expect(scanTargets(world, open.id)).toEqual([]);
    run(world, ticks(T.radarDuration * 1.1));
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
    run(world, ticks(T.radarDuration * 1.1) - 1);
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
