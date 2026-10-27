import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T, createInput, createPilot, createSandboxWorld, packPilot, sameSide, stepSandboxWorld, unpackPilot, type ArenaWorld, type Pilot, type ShipClass } from '../../src/arena/index.js';
import { castSignature, stepLock, stepMissiles, stepSignatureTimers } from '../../src/arena/signatures.js';
import { castTactic } from '../../src/arena/tactics.js';
import { layoutWith } from './helpers.js';

function field(ship: ShipClass = 'akinci') {
  const world = createSandboxWorld({ bots: 0, ship, layout: layoutWith() });
  Object.assign(world.pilot, { clanId: 'a', shield: 0 });
  Object.assign(world.pilot.p, { x: 0, y: 0, z: 0 }); Object.assign(world.pilot.q, { x: 0, y: 0, z: 0, w: 1 });
  return world;
}
function add(world: ArenaWorld, id: number, clanId: string | null, z: number, ship: ShipClass = 'muhafiz'): Pilot {
  const pilot = Object.assign(createPilot(id, ship), { clanId }); pilot.p.z = z;
  world.drones.push(pilot); world.dronePrevious.push({ ...pilot, p: { ...pilot.p }, q: { ...pilot.q } }); return pilot;
}

describe('Y7 server-owned clan friendship', () => {
  it('recognises a clanmate in another party, while two unaffiliated pilots remain rivals', () => {
    const a = Object.assign(createPilot(1), { clanId: 'a' }); const b = Object.assign(createPilot(2), { clanId: 'a' });
    expect(sameSide(a, b)).toBe(true);
    expect(sameSide(createPilot(3), createPilot(4))).toBe(false);
    expect(sameSide(a, Object.assign(createPilot(5), { clanId: 'b' }))).toBe(false);
  });

  it('lets bullets pass through clanmates and still strike the rival behind them', () => {
    const world = field(); const ally = add(world, 1, 'a', 40); const foe = add(world, 2, 'b', 90);
    for (let i = 0; i < 20; i++) stepSandboxWorld(world, { ...createInput(), fire: true });
    expect(ally.hull).toBe(600); expect(foe.hull).toBeLessThan(600);
  });

  it('keeps a launched missile friendly even after its owner left the room', () => {
    const world = field(); const ally = add(world, 1, 'a', 30); const foe = add(world, 2, 'b', 90);
    const missile = world.missiles[0]; if (!missile) throw new Error('no missile');
    Object.assign(missile, { owner: 999, target: -1, life: 2, damage: 96, clanId: 'a' });
    Object.assign(missile.p, { x: 0, y: 0, z: 0 }); Object.assign(missile.v, { x: 0, y: 0, z: T.missileSpeed });
    for (let i = 0; i < 40; i++) { world.tick++; stepMissiles(world); }
    expect(world.pilot.hull).toBe(340); expect(ally.hull).toBe(600); expect(foe.hull).toBe(504);
  });

  it('never locks a clanmate or names them in an enemy radar sweep', () => {
    const world = field(); add(world, 1, 'a', 150);
    for (let i = 0; i < 40; i++) { world.tick++; stepLock(world, world.pilot); }
    expect(world.pilot.lockTarget).toBe(-1);
    add(world, 2, 'b', 300); world.pilot.tactic = 'radar';
    castTactic(world, world.pilot, { ...createInput(), radar: true });
    expect(world.scans[0]?.targets).toEqual([2]);
  });

  it('shields a living clanmate but spends nothing on a rival, an illusion or a finished ship', () => {
    const world = field('muhafiz'); world.pilot.ranks.signature = 3;
    const ally = add(world, 1, 'a', 100); const foe = add(world, 2, 'b', 200);
    castSignature(world, world.pilot, { ...createInput(), signature: true, signatureTarget: foe.id });
    expect(world.pilot.signatureCooldown).toBe(0);
    ally.decoyOf = 9;
    castSignature(world, world.pilot, { ...createInput(), signature: true, signatureTarget: ally.id });
    expect(world.pilot.signatureCooldown).toBe(0);
    ally.decoyOf = -1; ally.phase = 'extracted';
    castSignature(world, world.pilot, { ...createInput(), signature: true, signatureTarget: ally.id });
    expect(world.pilot.signatureCooldown).toBe(0);
    ally.phase = 'flying'; castSignature(world, world.pilot, { ...createInput(), signature: true, signatureTarget: ally.id });
    expect(ally.shieldHp).toBe(96); expect(world.pilot.signatureCooldown).toBeGreaterThan(0);
  });

  it('repairs using the caster power frozen on the recipient, including its own prediction snapshot', () => {
    const world = field('kilavuz'); world.pilot.ranks.signature = 3;
    const ally = add(world, 1, 'a', 100, 'muhafiz'); ally.hull = 100;
    castSignature(world, world.pilot, { ...createInput(), signature: true, signatureTarget: ally.id });
    const client = field('muhafiz'); unpackPilot(packPilot(ally), client.pilot);
    world.pilot.ranks.signature = 1;
    for (let i = 0; i < T.mendDuration * T.tickRate; i++) { stepSignatureTimers(world, ally); stepSignatureTimers(client, client.pilot); }
    expect(ally.hull).toBeCloseTo(244, 6); expect(client.pilot.hull).toBeCloseTo(244, 6);
  });
});
