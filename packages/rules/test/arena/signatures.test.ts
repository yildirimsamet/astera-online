import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, CLASS_STATS, SIGNATURE_COOLDOWN, applyFeed, createFeedState, createInput, deltaFeed, keyFeed, stepFeedEffects, createPilot, createSandboxWorld, locked, lockShare, packPilot, packRemote,
  stepSandboxWorld, strike, unpackPilot, unpackRemote, type ArenaIntent, type ArenaWorld, type Pilot, type ShipClass,
} from '../../src/arena/index.js';
import { layoutWith, sphere } from './helpers.js';
import type { ArenaObstacle } from '../../src/arena/index.js';

/**
 * Y4c (plan 14 §4), owner 2026-10-23. The A slot is the class's signature: the Akıncı's homing
 * missile (the lock builds by itself while a ship sits in the aim circle), the Muhafız's
 * absorbing shield and the Kılavuz's repair (both aimed: at a friend, or twice-tapped at
 * oneself). The B slot is one tactic chosen before the sortie.
 */
const intent = (patch: Partial<ArenaIntent> = {}): ArenaIntent => ({ ...createInput(), ...patch });
const ticks = (seconds: number): number => Math.round(seconds * T.tickRate);

function duel(ship: ShipClass, enemy: ShipClass = 'muhafiz', z = 300, obstacles: readonly ArenaObstacle[] = []): { world: ArenaWorld; foe: Pilot } {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith(obstacles), ship });
  Object.assign(world.pilot.p, { x: 0, y: 0, z: 0 }); Object.assign(world.pilot.q, { x: 0, y: 0, z: 0, w: 1 });
  world.pilot.shield = 0;
  const foe = createPilot(9, enemy);
  foe.p.z = z;
  world.drones.push(foe);
  world.dronePrevious.push({ ...foe, p: { ...foe.p }, q: { ...foe.q } });
  return { world, foe };
}
const run = (world: ArenaWorld, n: number, input: ArenaIntent = intent()): void => { for (let i = 0; i < n; i++) stepSandboxWorld(world, input); };
const live = (world: ArenaWorld) => world.missiles.filter(m => m.life > 0);

describe('the Akıncı\'s missile lock', () => {
  it('locks a ship held in the aim circle for one second, and only then; the target is warned all along', () => {
    const { world, foe } = duel('akinci');
    run(world, ticks(T.lockTime) - 1);
    expect(world.pilot.lockTarget).toBe(foe.id);
    expect(locked(world.pilot)).toBe(false);
    expect(foe.threat).toBe(1);
    run(world, 1);
    expect(locked(world.pilot)).toBe(true);
    expect(foe.threat).toBe(2);
    // The warning points at the locker.
    expect([foe.threatX, foe.threatY, foe.threatZ]).toEqual([world.pilot.p.x, world.pilot.p.y, world.pilot.p.z]);
  });

  it('reads the lock as a share of its time, nothing while there is no target', () => {
    const { world } = duel('akinci');
    expect(lockShare(world.pilot)).toBe(0);
    run(world, ticks(T.lockTime / 2));
    expect(lockShare(world.pilot)).toBeCloseTo(ticks(T.lockTime / 2) / ticks(T.lockTime), 9);
    run(world, ticks(T.lockTime) * 2);
    expect(lockShare(world.pilot)).toBe(1);
  });

  it('loses the lock when the ship leaves the circle, cloaks or hides in smoke', () => {
    for (const hide of ['leave', 'cloak', 'smoke'] as const) {
      const { world, foe } = duel('akinci');
      run(world, ticks(T.lockTime));
      expect(locked(world.pilot)).toBe(true);
      if (hide === 'leave') foe.p.x = 250;
      if (hide === 'cloak') foe.cloak = ticks(4);
      if (hide === 'smoke') {
        const puff = world.smoke[0]; if (!puff) throw new Error('no smoke');
        Object.assign(puff.p, { x: 0, y: 0, z: 150 }); puff.active = true; puff.age = T.smokeGrow; puff.owner = foe.id;
      }
      run(world, 1);
      expect(world.pilot.lockTarget).toBe(-1);
      expect(world.pilot.lockTicks).toBe(0);
      expect(foe.threat).toBe(0);
    }
  });

  it('does not lock beyond the aim range, nor for any other class', () => {
    const far = duel('akinci', 'muhafiz', T.aimRange + 50);
    run(far.world, ticks(2));
    expect(far.world.pilot.lockTarget).toBe(-1);
    for (const ship of ['muhafiz', 'kilavuz'] as const) {
      const { world } = duel(ship);
      run(world, ticks(2));
      expect(world.pilot.lockTarget).toBe(-1);
    }
  });
});

describe('the homing missile', () => {
  it('fires nothing without a lock and spends no cooldown', () => {
    const { world } = duel('akinci', 'muhafiz', 300);
    world.pilot.p.x = -250;
    run(world, 1, intent({ signature: true }));
    expect(live(world)).toHaveLength(0);
    expect(world.pilot.signatureCooldown).toBe(0);
  });

  it('leaves at the locked ship, ends the lock and waits out the Akıncı\'s cooldown', () => {
    const { world, foe } = duel('akinci');
    run(world, ticks(T.lockTime));
    run(world, 1, intent({ signature: true }));
    expect(live(world)).toHaveLength(1);
    expect(live(world)[0]?.target).toBe(foe.id);
    expect(live(world)[0]?.owner).toBe(world.pilot.id);
    expect(world.pilot.signatureCooldown).toBe(ticks(SIGNATURE_COOLDOWN.akinci));
    expect(world.pilot.lockTarget).toBe(-1);
    expect(foe.threat).toBe(3);
    // The missile lands; held in the circle again, the lock rebuilds, but nothing leaves before the cooldown ends.
    run(world, ticks(3));
    expect(locked(world.pilot)).toBe(true);
    run(world, 1, intent({ signature: true }));
    expect(live(world)).toHaveLength(0);
    expect(foe.hull).toBe(CLASS_STATS.muhafiz.hull - T.missileDamage);
  });

  it('keeps its one-tick turn in step with its turn rate', () => {
    expect(T.missileTurnCos).toBeCloseTo(Math.cos(T.missileTurn / T.tickRate), 12);
  });

  it('flies at its own speed, turns no faster than its limit and hits for its damage through the hull', () => {
    const { world, foe } = duel('akinci');
    run(world, ticks(T.lockTime));
    run(world, 1, intent({ signature: true }));
    const missile = live(world)[0]; if (!missile) throw new Error('no missile');
    expect(Math.hypot(missile.v.x, missile.v.y, missile.v.z)).toBeCloseTo(T.missileSpeed, 6);
    // The target slides away sideways: the missile bends after it, a limited angle a tick.
    foe.p.x = 120;
    let before = { ...missile.v };
    for (let i = 0; i < ticks(3) && missile.life > 0; i++) {
      run(world, 1);
      if (missile.life <= 0) break;
      const cos = (before.x * missile.v.x + before.y * missile.v.y + before.z * missile.v.z) / (T.missileSpeed * T.missileSpeed);
      expect(Math.acos(Math.min(1, cos))).toBeLessThanOrEqual(T.missileTurn / T.tickRate + 1e-9);
      before = { ...missile.v };
    }
    expect(foe.hull).toBe(CLASS_STATS.muhafiz.hull - T.missileDamage);
    expect(world.pilot.hits).toBe(1);
  });

  it('is stopped by rock', () => {
    const { world, foe } = duel('akinci', 'muhafiz', 300);
    run(world, ticks(T.lockTime));
    run(world, 1, intent({ signature: true }));
    world.layout = layoutWith([sphere(0, 0, 0, 150, 20)]);
    run(world, ticks(2));
    expect(live(world)).toHaveLength(0);
    expect(foe.hull).toBe(CLASS_STATS.muhafiz.hull);
  });

  it('flies straight on once its target cloaks or vanishes into smoke, and burns out', () => {
    const { world, foe } = duel('akinci', 'muhafiz', 600);
    run(world, ticks(T.lockTime));
    run(world, 1, intent({ signature: true }));
    const missile = live(world)[0]; if (!missile) throw new Error('no missile');
    foe.cloak = ticks(10); foe.p.x = 200;
    run(world, 1);
    const heading = { ...missile.v };
    run(world, 10);
    expect(missile.v).toEqual(heading);
    run(world, ticks(T.missileLife));
    expect(live(world)).toHaveLength(0);
    expect(foe.hull).toBe(CLASS_STATS.muhafiz.hull);
    expect(foe.threat).toBe(0);
  });
});

describe('the Muhafız\'s absorbing shield', () => {
  it('raises on oneself for its time, then drops; the cooldown runs from the cast', () => {
    const { world } = duel('muhafiz', 'akinci', 2000);
    run(world, 1, intent({ signature: true, signatureTarget: world.pilot.id }));
    expect(world.pilot.shieldHp).toBe(T.wardHp);
    expect(world.pilot.shieldMax).toBe(T.wardHp);
    expect(world.pilot.signatureCooldown).toBe(ticks(SIGNATURE_COOLDOWN.muhafiz));
    run(world, ticks(T.wardDuration) - 1);
    expect(world.pilot.shieldHp).toBe(T.wardHp);
    run(world, 1);
    expect(world.pilot.shieldHp).toBe(0);
    expect(world.pilot.shieldMax).toBe(0);
  });

  it('takes every hit until it breaks; the breaking hit never reaches the hull', () => {
    const { world, foe } = duel('muhafiz', 'akinci', 2000);
    run(world, 1, intent({ signature: true, signatureTarget: world.pilot.id }));
    const pilot = world.pilot; const full = CLASS_STATS.muhafiz.hull;
    strike(world, pilot, 50, foe.id);
    expect([pilot.shieldHp, pilot.hull]).toEqual([T.wardHp - 50, full]);
    strike(world, pilot, 50, foe.id);
    expect([pilot.shieldHp, pilot.shieldMax, pilot.hull]).toEqual([0, 0, full]);
    strike(world, pilot, 50, foe.id);
    expect(pilot.hull).toBe(full - 50);
    // A full shield swallows a whole missile.
    pilot.signatureCooldown = 0;
    run(world, 1, intent({ signature: true, signatureTarget: pilot.id }));
    strike(world, pilot, T.missileDamage, foe.id);
    expect(pilot.hull).toBe(full - 50);
  });

  it('shows a bolt it swallows as a hit on the shield, not on the hull', () => {
    const { world, foe } = duel('akinci', 'muhafiz', 200);
    foe.shieldHp = T.wardHp; foe.shieldMax = T.wardHp; foe.ward = ticks(T.wardDuration);
    // A bolt crosses the 200 m in a sixth of a second; an impact shows for a third.
    run(world, 2, intent({ fire: true })); run(world, Math.round(T.tickRate / 4));
    const kinds = world.impacts.filter(hit => hit.active).map(hit => hit.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every(kind => kind === 'shield')).toBe(true);
    expect(foe.hull).toBe(CLASS_STATS.muhafiz.hull);
  });

  it('is refused on another ship until the arena has friends: nothing spent', () => {
    const { world, foe } = duel('muhafiz', 'akinci', 60);
    run(world, 1, intent({ signature: true, signatureTarget: foe.id }));
    expect([foe.shieldHp, world.pilot.shieldHp, world.pilot.signatureCooldown]).toEqual([0, 0, 0]);
  });
});

describe('the Kılavuz\'s repair', () => {
  it('mends its amount over its time, never past the class hull', () => {
    const { world } = duel('kilavuz', 'akinci', 2000);
    const full = CLASS_STATS.kilavuz.hull;
    world.pilot.hull = full - 200;
    run(world, 1, intent({ signature: true, signatureTarget: world.pilot.id }));
    expect(world.pilot.signatureCooldown).toBe(ticks(SIGNATURE_COOLDOWN.kilavuz));
    run(world, ticks(T.mendDuration));
    expect(world.pilot.hull).toBeCloseTo(full - 200 + T.mendHp, 6);
    world.pilot.hull = full - 10; world.pilot.signatureCooldown = 0;
    run(world, 1, intent({ signature: true, signatureTarget: world.pilot.id }));
    run(world, ticks(T.mendDuration));
    expect(world.pilot.hull).toBe(full);
  });

  it('mends at half while the ship is under fire', () => {
    const { world } = duel('kilavuz', 'akinci', 2000);
    world.pilot.hull = 100;
    run(world, 1, intent({ signature: true, signatureTarget: world.pilot.id }));
    for (let i = 0; i < ticks(T.mendDuration); i++) { world.pilot.lastDamage = world.tick; run(world, 1); }
    expect(world.pilot.hull).toBeCloseTo(100 + T.mendHp * T.mendHurtFactor, 6);
  });

  it('is refused on another ship until the arena has friends', () => {
    const { world, foe } = duel('kilavuz', 'akinci', 60);
    foe.hull = 100;
    run(world, ticks(1), intent({ signature: true, signatureTarget: foe.id }));
    expect([foe.hull, world.pilot.signatureCooldown]).toEqual([100, 0]);
  });
});

describe('the B slot', () => {
  it('flies the tactic the sandbox names, smoke when it names none', () => {
    expect(createSandboxWorld({ bots: 0, tactic: 'cloak' }).pilot.tactic).toBe('cloak');
    expect(createSandboxWorld({ bots: 0 }).pilot.tactic).toBe('smoke');
  });

  it('works only the tactic chosen for the sortie', () => {
    const smoker = duel('kilavuz').world;
    smoker.pilot.tactic = 'smoke';
    run(smoker, 1, intent({ cloak: true }));
    expect(smoker.pilot.cloak).toBe(0);
    run(smoker, 1, intent({ smoke: true }));
    expect(smoker.pilot.smokeEmit).toBeGreaterThan(0);
    const ghost = duel('kilavuz').world;
    ghost.pilot.tactic = 'cloak';
    run(ghost, 1, intent({ smoke: true }));
    expect(ghost.pilot.smokeEmit).toBe(0);
    run(ghost, 1, intent({ cloak: true }));
    expect(ghost.pilot.cloak).toBeGreaterThan(0);
  });
});

describe('signatures on the wire', () => {
  it('carries the tactic, cooldown, lock, warning, shield and repair in the own row', () => {
    const { world, foe } = duel('akinci');
    world.pilot.tactic = 'cloak';
    run(world, ticks(T.lockTime));
    const back = unpackPilot(packPilot(world.pilot));
    expect([back.tactic, back.lockTarget, back.lockTicks, back.signatureCooldown]).toEqual(['cloak', foe.id, ticks(T.lockTime), 0]);
    const victim = unpackPilot(packPilot(foe));
    expect([victim.threat, victim.threatX, victim.threatZ]).toEqual([2, 0, 0]);
    foe.ward = 5; foe.mend = 7;
    const again = unpackPilot(packPilot(foe));
    expect([again.ward, again.mend]).toEqual([5, 7]);
  });

  it('sends every live missile in every snapshot; the client flies them on between and drops the gone', () => {
    const { world } = duel('akinci', 'muhafiz', 900);
    const state = createFeedState(world);
    run(world, ticks(T.lockTime));
    run(world, 1, intent({ signature: true }));
    const client = createSandboxWorld({ bots: 0, layout: layoutWith() });
    applyFeed(client, keyFeed(world));
    const sent = live(world)[0]; const seen = client.missiles.find(m => m.life > 0);
    if (!sent || !seen) throw new Error('no missile');
    expect([seen.p.x, seen.p.z, seen.target, seen.owner]).toEqual([sent.p.x, Math.round(sent.p.z * 100) / 100, sent.target, sent.owner]);
    const z = seen.p.z;
    stepFeedEffects(client);
    expect(seen.p.z).toBeCloseTo(z + T.missileSpeed / T.tickRate, 6);
    // A delta carries it too, and once it has burst the client lets it go.
    expect(deltaFeed(state, world).missiles).toHaveLength(1);
    run(world, ticks(T.missileLife));
    applyFeed(client, deltaFeed(state, world));
    expect(client.missiles.filter(m => m.life > 0)).toHaveLength(0);
  });

  it('shows others a raised shield and a running repair', () => {
    const pilot = createPilot(3, 'muhafiz');
    pilot.ward = 10; pilot.shieldHp = 40; pilot.mend = 0;
    const row = packRemote(pilot);
    const flags = row[17] ?? 0;
    expect(flags & 8).toBe(8);
    expect(flags & 16).toBe(0);
    const seen = unpackRemote(row, createPilot(3));
    expect([seen.ward > 0, seen.mend > 0]).toEqual([true, false]);
    pilot.ward = 0; pilot.mend = 3;
    expect((packRemote(pilot)[17] ?? 0) & 24).toBe(16);
  });
});
