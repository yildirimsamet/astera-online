import { describe, expect, it } from 'vitest';
import {
  ARENA_POOLS, ARENA_TUNING as T, applyFeed, copyFlight, createBrain, createFeedState, createFlightState, createPilot, createSandboxWorld,
  deltaFeed, keyFeed, MINERAL_STEP, scatter, spawnFlight, stepArenaWorld, stepFeedEffects, type ArenaFeed, type ArenaWorld, type BotRole,
} from '../../src/arena/index.js';

/**
 * V6g, 2026-10-23 (docs/komutan-gemisi/17-paket-kucultme-plani.md): bullets, smoke, impacts,
 * cargo and minerals went out whole in every snapshot, 11 of a 50-pilot fight's 13 KB. The
 * room now sends what was born, what went and what changed; a client that applies those and
 * ages its effects between snapshots must hold the server's pools at every snapshot.
 */
const EVERY = T.tickRate / T.snapshotRate;
const roles: BotRole[] = ['hunter', 'hunter', 'patrol', 'miner'];

/** Eighteen bots through two neighbouring entrances: they meet, shoot, smoke, die and mine. */
function battle(seed: number): ArenaWorld {
  const world = createSandboxWorld({ seed, bots: 3 });
  world.pilot.phase = 'towed';
  for (let i = 0; i < 18; i++) {
    const bot = createPilot(10 + i);
    spawnFlight(bot, world.random, world.layout, i % 2);
    world.brains.set(bot.id, createBrain(roles[i % roles.length] ?? 'hunter'));
    world.drones.push(bot);
    const prior = createFlightState(); copyFlight(prior, bot); world.dronePrevious.push(prior);
  }
  return world;
}

const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, d: number): boolean =>
  Math.abs(a.x - b.x) <= d && Math.abs(a.y - b.y) <= d && Math.abs(a.z - b.z) <= d;

/** Where a client may not differ from the room: the plan's "kabul edilmeyecek durumlar". */
function expectMirrors(client: ArenaWorld, server: ArenaWorld): void {
  const wrong: string[] = []; const at = `tick ${String(server.tick)}`;
  server.projectiles.forEach((s, i) => {
    const c = client.projectiles[i];
    if (!c || c.life > 0 !== s.life > 0) { wrong.push(`bullet ${String(i)} alive ${String(s.life > 0)} at ${at}`); return; }
    if (s.life > 0 && !(near(c.p, s.p, 0.05) && near(c.previous, s.previous, 0.05) && Math.abs(c.life - s.life) < 0.002 && c.owner === s.owner)) wrong.push(`bullet ${String(i)} at ${at}`);
  });
  server.smoke.forEach((s, i) => {
    // A puff's last tick is a float tie (12.5 s is a whole number of ticks): one tick either way.
    const c = client.smoke[i]; if (Math.abs(s.age - T.smokeLife) < 2 / T.tickRate) return;
    if (c?.active !== s.active) { wrong.push(`smoke ${String(i)} active ${String(s.active)} at ${at}`); return; }
    if (s.active && !(near(c.p, s.p, 0.01) && Math.abs(c.age - s.age) < 0.002 && c.owner === s.owner)) wrong.push(`smoke ${String(i)} at ${at}`);
  });
  server.impacts.forEach((s, i) => {
    const c = client.impacts[i];
    if (c?.active !== s.active) { wrong.push(`impact ${String(i)} active ${String(s.active)} at ${at}`); return; }
    if (s.active && !(near(c.p, s.p, 0.01) && c.kind === s.kind && Math.abs(c.age - s.age) < 0.002)) wrong.push(`impact ${String(i)} at ${at}`);
  });
  server.cargoDrops.forEach((s, i) => {
    const c = client.cargoDrops[i];
    if (c?.active !== s.active) { wrong.push(`cargo ${String(i)} active ${String(s.active)} at ${at}`); return; }
    if (s.active && !(near(c.p, s.p, 0.01) && c.kind === s.kind && Math.abs(c.amount - s.amount) <= 0.01)) wrong.push(`cargo ${String(i)} at ${at}`);
  });
  server.minerals.forEach((value, i) => {
    // Under a step behind the room's shared record, which may itself be under a step behind a key
    // frame's exact value: under two steps in all (1 % of a crystal). Dry, empty and full are exact.
    if (Math.abs((client.minerals[i] ?? -1) - value) >= 2 * MINERAL_STEP || client.dry[i] !== server.dry[i]) wrong.push(`crystal ${String(i)} at ${at}`);
  });
  expect(wrong).toEqual([]);
}

interface Seen { born: number; ended: number; smoke: number; impacts: number; cargo: number; gone: number; minerals: number }
const tally = (seen: Seen, feed: ArenaFeed): void => {
  seen.born += feed.bullets.length; seen.ended += feed.bulletsGone.length; seen.smoke += feed.smoke.length;
  seen.impacts += feed.impacts.length; seen.cargo += feed.cargo.length; seen.gone += feed.cargoGone.length; seen.minerals += feed.minerals.length;
};

/**
 * Runs the room for `ticks`, a client applying every delta. A pilot who arrives at `joinAt`
 * gets a key frame at the next snapshot tick, never in between: a key frame between two
 * snapshots would hold a piece born and gone before the next delta, which that delta never
 * mentions (it stayed on the client for good; found by this test).
 */
function fly(seed: number, ticks: number, joinAt = 0, drop?: number): { seen: Seen; bytes: number; full: number } {
  const server = battle(seed); const state = createFeedState(server);
  const client = createSandboxWorld({ bots: 0 });
  const seen: Seen = { born: 0, ended: 0, smoke: 0, impacts: 0, cargo: 0, gone: 0, minerals: 0 };
  let joined = false; let keyNext = false; let bytes = 0; let full = 0;
  for (let t = 0; t < ticks; t++) {
    // Bots smoke only when badly hurt; one lays a screen every ten seconds so puffs are always about.
    if (server.tick % (10 * T.tickRate) === 0) {
      const smoker = server.drones.find(p => p.phase === 'flying' && p.smokeEmit === 0);
      if (smoker) smoker.smokeEmit = Math.round(T.smokeEmitDuration * T.tickRate);
      // And a loaded hold spills as wreck cargo, which the magnets then pull and the ships sweep.
      const wreck = server.drones.find(p => p.phase === 'flying');
      if (wreck) { wreck.hold = [6, 4, 2]; scatter(server, wreck); }
    }
    stepArenaWorld(server, new Map());
    if (joined) stepFeedEffects(client);
    if (server.tick % EVERY !== 0) continue;
    const feed = deltaFeed(state, server);
    if (!joined) { if (server.tick < joinAt) continue; joined = true; keyNext = true; }
    full += JSON.stringify(keyFeed(server)).length;
    // A skipped send: that pilot's next snapshot is a key frame.
    if (server.tick === drop) { keyNext = true; continue; }
    const sent = keyNext ? keyFeed(server) : feed; keyNext = false;
    bytes += JSON.stringify(sent).length; tally(seen, feed);
    applyFeed(client, sent);
    expectMirrors(client, server);
  }
  return { seen, bytes, full };
}

describe('the snapshot feed', () => {
  it('keeps a client on the room\'s bullets, smoke, impacts, cargo and crystals through a fight', () => {
    const { seen, bytes, full } = fly(4100, 60 * T.tickRate);
    // The fight exercised every row kind, early bullet ends (hits) included.
    expect(seen.born).toBeGreaterThan(200);
    expect(seen.ended).toBeGreaterThan(20);
    expect(seen.impacts).toBeGreaterThan(20);
    expect(seen.smoke).toBeGreaterThan(0);
    expect(seen.cargo).toBeGreaterThan(0);
    expect(seen.minerals).toBeGreaterThan(0);
    // And it is the point of the change: a fraction of sending the whole state each time.
    expect(bytes).toBeLessThan(full / 4);
  }, 60_000);

  it('brings a pilot who arrives mid-fight, between two snapshots, onto the same pools', () => {
    fly(5200, 60 * T.tickRate, 30 * T.tickRate + 1);
  }, 60_000);

  it('recovers a pilot whose snapshot was skipped with a key frame', () => {
    fly(6300, 45 * T.tickRate, 0, 20 * T.tickRate);
  }, 60_000);

  it('ends a bullet before a new one takes its slot in the same window', () => {
    const server = createSandboxWorld({ bots: 0 }); const state = createFeedState(server);
    const client = createSandboxWorld({ bots: 0 });
    const slot = server.projectiles[5]; if (!slot) throw new Error('no slot');
    Object.assign(slot, { life: 0.5, owner: 2 }); slot.p.x = 10; slot.v.x = 300;
    applyFeed(client, deltaFeed(state, server));
    // Hit, then reused by a new shot before the next snapshot.
    Object.assign(slot, { life: 0.7, owner: 3 }); slot.p.x = -40; slot.previous.x = -50; slot.v.x = -300;
    const feed = deltaFeed(state, server);
    expect(feed.bullets.map(row => row[0])).toEqual([5]);
    applyFeed(client, feed);
    expect(client.projectiles[5]).toMatchObject({ life: 0.7, owner: 3 });
    expect(client.projectiles[5]?.p.x).toBe(-40);
  });

  it('clears what a key frame does not hold', () => {
    const client = createSandboxWorld({ bots: 0 });
    const stale = client.projectiles[3]; if (!stale) throw new Error('no slot');
    stale.life = 0.4;
    const puff = client.smoke[2]; if (puff) puff.active = true;
    applyFeed(client, keyFeed(createSandboxWorld({ bots: 0 })));
    expect(client.projectiles[3]?.life).toBeLessThanOrEqual(0);
    expect(client.smoke[2]?.active).toBe(false);
  });

  it('sends a crystal that runs dry at once and exactly, not after the change threshold', () => {
    const server = createSandboxWorld({ bots: 0 }); const state = createFeedState(server);
    const client = createSandboxWorld({ bots: 0 });
    applyFeed(client, keyFeed(server));
    server.minerals[4] = 0.05; applyFeed(client, deltaFeed(state, server));
    server.minerals[4] = 0; server.dry[4] = true;
    applyFeed(client, deltaFeed(state, server));
    expect(client.minerals[4]).toBe(0);
    expect(client.dry[4]).toBe(true);
  });

  it('sizes the pools the protocol bounds its rows by', () => {
    const world = createSandboxWorld({ bots: 0 });
    expect(world.projectiles).toHaveLength(ARENA_POOLS.bullets);
    expect(world.smoke).toHaveLength(ARENA_POOLS.smoke);
    expect(world.impacts).toHaveLength(ARENA_POOLS.impacts);
    expect(world.cargoDrops).toHaveLength(ARENA_POOLS.cargo);
  });
});
