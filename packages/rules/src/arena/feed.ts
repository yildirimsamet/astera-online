import { advance } from './combat.js';
import type { CargoDrop, Impact, Missile, Projectile, SmokePuff } from './pilot.js';
import { ageEffects } from './pools.js';
import { ARENA_TUNING as T } from './tuning.js';

/**
 * The snapshot rows every pilot reads alike, sent as change (V6g, 2026-10-23; plan:
 * docs/komutan-gemisi/17-paket-kucultme-plani.md). A delta carries what was born, what went
 * and what moved since the room's previous snapshot; a key frame carries everything and the
 * client clears its pools first. Between snapshots the client flies its bullets and ages its
 * smoke and impacts itself (`stepFeedEffects`), with the room's own functions.
 *
 * Key frames go out on snapshot ticks only. One sent between two would hold a piece born and
 * gone before the next delta, which that delta never mentions: it would stay on the client.
 */
export interface ArenaFeed {
  key: 0 | 1;
  /** Bullets born since the last snapshot (every live one in a key frame): slot, x, y, z, vx, vy, vz, life, owner. */
  bullets: number[][];
  /** Bullet slots that ended since the last snapshot: a hit, rock, or the end of their range. */
  bulletsGone: number[];
  /** Puffs born: slot, x, y, z, age, owner. */
  smoke: number[][];
  smokeGone: number[];
  /** Impacts born: slot, x, y, z, age, kind (0 rock, 1 ship, 2 shield, 3 explosion, 4 hologram). */
  impacts: number[][];
  /** Cargo pieces that appeared or moved: slot, x, y, z, amount, kind. */
  cargo: number[][];
  cargoGone: number[];
  /** Crystals that changed by MINERAL_STEP, ran dry, filled or woke: slot, reserve, dry (0/1). */
  minerals: number[][];
  /** Every live missile, in every snapshot (they turn, and there are few): slot, x, y, z, vx, vy, vz, life, owner, target. */
  missiles: number[][];
}
export interface FeedWorld {
  projectiles: Projectile[]; smoke: SmokePuff[]; impacts: Impact[]; cargoDrops: CargoDrop[]; minerals: number[]; dry: boolean[];
  missiles: Missile[];
}
/** What the room last told every client, per slot. */
export interface FeedState {
  life: Float64Array; smokeAge: Float64Array; impactAge: Float64Array; cargo: Float64Array; minerals: Float64Array; dry: Uint8Array;
}

/** A crystal's reserve goes out once it has moved this much; its brightness cannot show less. */
export const MINERAL_STEP = 0.8;
const CARGO_WIDTH = 5;
const IMPACT_KINDS: readonly Impact['kind'][] = ['rock', 'ship', 'shield', 'explosion', 'hologram'];
const cm = (n: number): number => Math.round(n * 100) / 100;
const ms = (n: number): number => Math.round(n * 1000) / 1000;

const bulletRow = (b: Projectile, i: number): number[] => [i, cm(b.p.x), cm(b.p.y), cm(b.p.z), cm(b.v.x), cm(b.v.y), cm(b.v.z), ms(b.life), b.owner];
const smokeRow = (p: SmokePuff, i: number): number[] => [i, cm(p.p.x), cm(p.p.y), cm(p.p.z), ms(p.age), p.owner];
const impactRow = (hit: Impact, i: number): number[] => [i, cm(hit.p.x), cm(hit.p.y), cm(hit.p.z), ms(hit.age), IMPACT_KINDS.indexOf(hit.kind)];
const cargoRow = (d: CargoDrop, i: number): number[] => [i, cm(d.p.x), cm(d.p.y), cm(d.p.z), cm(d.amount), d.kind];
const mineralRow = (world: FeedWorld, i: number): number[] => [i, cm(world.minerals[i] ?? 0), world.dry[i] ? 1 : 0];
const missileRows = (world: FeedWorld): number[][] => world.missiles.flatMap((m, i) => m.life > 0
  ? [[i, cm(m.p.x), cm(m.p.y), cm(m.p.z), cm(m.v.x), cm(m.v.y), cm(m.v.z), ms(m.life), m.owner, m.target]] : []);

/** The room's record starts at the world as it stands: its first delta holds what changes next. */
export function createFeedState(world: FeedWorld): FeedState {
  const state: FeedState = {
    life: new Float64Array(world.projectiles.length), smokeAge: new Float64Array(world.smoke.length),
    impactAge: new Float64Array(world.impacts.length), cargo: new Float64Array(world.cargoDrops.length * CARGO_WIDTH),
    minerals: Float64Array.from(world.minerals), dry: Uint8Array.from(world.dry, d => d ? 1 : 0),
  };
  deltaFeed(state, world);
  return state;
}

/** Everything live, for a pilot who has nothing yet (or may have missed a delta). */
export function keyFeed(world: FeedWorld): ArenaFeed {
  return {
    key: 1,
    bullets: world.projectiles.flatMap((b, i) => b.life > 0 ? [bulletRow(b, i)] : []), bulletsGone: [],
    smoke: world.smoke.flatMap((p, i) => p.active ? [smokeRow(p, i)] : []), smokeGone: [],
    impacts: world.impacts.flatMap((hit, i) => hit.active ? [impactRow(hit, i)] : []),
    cargo: world.cargoDrops.flatMap((d, i) => d.active ? [cargoRow(d, i)] : []), cargoGone: [],
    minerals: world.minerals.map((_, i) => mineralRow(world, i)), missiles: missileRows(world),
  };
}

/**
 * What changed since the last call, and the record moved on to now. Called once per snapshot
 * tick for the whole room. A bullet is new when its life went up: a slot is only reused after
 * the other 511 have fired (0.64 s even at 100 pilots on the trigger), far longer than the two
 * ticks between snapshots. A puff or an impact is new when its age went down.
 */
export function deltaFeed(state: FeedState, world: FeedWorld): ArenaFeed {
  const feed: ArenaFeed = { key: 0, bullets: [], bulletsGone: [], smoke: [], smokeGone: [], impacts: [], cargo: [], cargoGone: [], minerals: [],
    missiles: missileRows(world) };
  world.projectiles.forEach((b, i) => {
    const before = state.life[i] ?? 0;
    if (b.life > 0 && b.life > before + 1e-9) feed.bullets.push(bulletRow(b, i));
    else if (before > 0 && b.life <= 0) feed.bulletsGone.push(i);
    state.life[i] = b.life;
  });
  world.smoke.forEach((p, i) => {
    const before = state.smokeAge[i] ?? -1;
    if (p.active && (before < 0 || p.age < before - 1e-9)) feed.smoke.push(smokeRow(p, i));
    else if (!p.active && before >= 0) feed.smokeGone.push(i);
    state.smokeAge[i] = p.active ? p.age : -1;
  });
  world.impacts.forEach((hit, i) => {
    const before = state.impactAge[i] ?? -1;
    if (hit.active && (before < 0 || hit.age < before - 1e-9)) feed.impacts.push(impactRow(hit, i));
    state.impactAge[i] = hit.active ? hit.age : -1;
  });
  world.cargoDrops.forEach((d, i) => {
    const at = i * CARGO_WIDTH; const was = !Number.isNaN(state.cargo[at] ?? Number.NaN);
    if (!d.active) {
      if (was) feed.cargoGone.push(i);
      state.cargo[at] = Number.NaN; return;
    }
    const row = cargoRow(d, i);
    let moved = !was;
    for (let k = 0; k < CARGO_WIDTH; k++) if (state.cargo[at + k] !== row[k + 1]) { moved = true; state.cargo[at + k] = row[k + 1] ?? 0; }
    if (moved) feed.cargo.push(row);
  });
  world.minerals.forEach((value, i) => {
    const before = state.minerals[i] ?? 0; const dry = world.dry[i] ? 1 : 0;
    const crossed = (value <= 0) !== (before <= 0) || (value >= T.crystalReserve) !== (before >= T.crystalReserve);
    if (Math.abs(value - before) < MINERAL_STEP && dry === state.dry[i] && !crossed) return;
    feed.minerals.push(mineralRow(world, i));
    state.minerals[i] = value; state.dry[i] = dry;
  });
  return feed;
}

/** The client side: a key frame replaces the pools, a delta ends what went, then places what came. */
export function applyFeed(world: FeedWorld, feed: ArenaFeed): void {
  if (feed.key === 1) {
    for (const b of world.projectiles) b.life = 0;
    for (const p of world.smoke) p.active = false;
    for (const hit of world.impacts) hit.active = false;
    for (const d of world.cargoDrops) d.active = false;
  }
  for (const i of feed.bulletsGone) { const b = world.projectiles[i]; if (b) b.life = 0; }
  for (const [i = -1, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0, life = 0, owner = -1] of feed.bullets) {
    const b = world.projectiles[i]; if (!b) continue;
    b.p.x = x; b.p.y = y; b.p.z = z; b.v.x = vx; b.v.y = vy; b.v.z = vz; b.life = life; b.owner = owner;
    // Every live bullet has flown at least the tick it was fired in.
    b.previous.x = x - vx / T.tickRate; b.previous.y = y - vy / T.tickRate; b.previous.z = z - vz / T.tickRate;
  }
  for (const i of feed.smokeGone) { const p = world.smoke[i]; if (p) p.active = false; }
  for (const [i = -1, x = 0, y = 0, z = 0, age = 0, owner = -1] of feed.smoke) {
    const p = world.smoke[i]; if (!p) continue;
    p.p.x = x; p.p.y = y; p.p.z = z; p.age = age; p.owner = owner; p.active = true;
  }
  for (const [i = -1, x = 0, y = 0, z = 0, age = 0, kind = 0] of feed.impacts) {
    const hit = world.impacts[i]; if (!hit) continue;
    hit.p.x = x; hit.p.y = y; hit.p.z = z; hit.age = age; hit.kind = IMPACT_KINDS[kind] ?? 'rock'; hit.active = true;
  }
  for (const i of feed.cargoGone) { const d = world.cargoDrops[i]; if (d) d.active = false; }
  for (const [i = -1, x = 0, y = 0, z = 0, amount = 0, kind = 0] of feed.cargo) {
    const d = world.cargoDrops[i]; if (!d) continue;
    d.p.x = x; d.p.y = y; d.p.z = z; d.amount = amount; d.kind = kind; d.active = true;
  }
  for (const [i = -1, reserve = 0, dry = 0] of feed.minerals) {
    if (i < 0 || i >= world.minerals.length) continue;
    world.minerals[i] = reserve; world.dry[i] = dry === 1;
  }
  for (const m of world.missiles) m.life = 0;
  for (const [i = -1, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0, life = 0, owner = -1, target = -1] of feed.missiles) {
    const m = world.missiles[i]; if (!m) continue;
    m.p.x = x; m.p.y = y; m.p.z = z; m.v.x = vx; m.v.y = vy; m.v.z = vz; m.life = life; m.owner = owner; m.target = target;
    m.previous.x = x - vx / T.tickRate; m.previous.y = y - vy / T.tickRate; m.previous.z = z - vz / T.tickRate;
  }
}

/** A client tick between snapshots: bullets and missiles fly straight, smoke and impacts age, as in the room. */
export function stepFeedEffects(world: FeedWorld): void {
  for (const b of world.projectiles) if (b.life > 0) advance(b);
  for (const m of world.missiles) {
    if (m.life <= 0) continue;
    m.previous.x = m.p.x; m.previous.y = m.p.y; m.previous.z = m.p.z;
    m.p.x += m.v.x / T.tickRate; m.p.y += m.v.y / T.tickRate; m.p.z += m.v.z / T.tickRate;
    m.life = Math.max(0, m.life - 1 / T.tickRate);
  }
  ageEffects(world);
}
