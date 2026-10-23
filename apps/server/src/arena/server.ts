import { performance } from 'node:perf_hooks';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { mulberry32 } from '@astera/rules';
import { ARENA_LAYOUT, ARENA_PROTOCOL, ARENA_TUNING as T, CLASS_STATS, clampAssist, holdPoints, copyFlight, createFeedState, createFlightState, createInput,
  createPilot, createSandboxWorld, deltaFeed, FAR_EVERY, keyFeed, MAX_REMOTE_PILOTS, MID_EVERY, nextEntry, packFar, packPilot, packRemote, recoverPilot,
  REMOTE_BAND, REMOTE_FAR_RANGE, REMOTE_FULL_RANGE, REMOTE_NEAR_RANGE, ROLE_SHIPS, SHIP_CLASSES, TACTICS, scanTargets, spawnFlight, stepArenaWorld, pilotVisible,
  type ArenaFeed, type ArenaIntent, type ArenaWorld, type Pilot, type ShipClass, type SteeringSettings, type Tactic } from '@astera/rules/arena';
import { InvalidSessionError } from '../auth/tokens.js';
import { accounts, arenaPilots } from '../db/schema.js';
import type { Env } from '../env.js';
import { registerArenaReferences } from './references.js';
import { createPlayout, playInput, queueInput, resetPlayout, type Playout } from './playout.js';

const inputSchema = z.object({ kind: z.literal('in'), values: z.tuple([
  z.number().int().nonnegative().max(100000000), z.number().int().min(-1000).max(1000),
  z.number().int().min(-1000).max(1000), z.number().int().min(0).max(100), z.number().int().min(0).max(511),
  z.number().int().min(-1000).max(1000), z.number().int().min(-1000).max(1000),
  // The A slot's target (Y4c): a pilot id, -1 for none.
  z.number().int().min(-1).max(100000000),
]) });
const pointSchema = z.object({ x: z.number().finite().min(-3000).max(3000), y: z.number().finite().min(-3000).max(3000), z: z.number().finite().min(-3000).max(3000) });
const NEUTRAL = { ...createInput(), fire: false, smoke: false, cloak: false, turboBurst: false, land: false, signature: false, signatureTarget: -1, illusion: false, radar: false };
const messageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hello'), v: z.literal(ARENA_PROTOCOL), guestId: z.string().regex(/^[a-zA-Z0-9-]{8,96}$/).optional(),
    token: z.string().min(1).max(4096).optional(), mode: z.enum(['enter', 'resume']), ship: z.enum(SHIP_CLASSES), tactic: z.enum(TACTICS) }),
  inputSchema,
  z.object({ kind: z.literal('ping'), t: z.number().finite().nonnegative() }),
  z.object({ kind: z.literal('settings'), sensitivity: z.number().min(0.5).max(1.5), invertPitch: z.boolean() }),
  z.object({ kind: z.literal('leave') }),
  z.object({ kind: z.literal('dev'), action: z.enum(['restart', 'exit', 'fuel', 'cargo', 'position']),
    p: pointSchema.optional(), value: z.number().finite().min(0).max(400).optional() }),
]);
interface Participant {
  key: string; pilot: Pilot; socket: WebSocket | null; playout: Playout<ArenaIntent>; input: ArenaIntent;
  settings: SteeringSettings; ack: number; lastSeq: number; lastInput: number; endedAt: number;
  name: string; seenKills: number; deathCounted: boolean; extractionCounted: boolean;
  /** The class and B slot its last hello named: its next flight's (Y4). A flight keeps the ones it started with. */
  ship: ShipClass; tactic: Tactic;
  /** The first snapshot tick whose snapshot is a key frame: 0 after a join or a dropped send, then every KEY_EVERY. */
  keyAt: number;
  /** The tier each ship was last sent to this pilot in: the REMOTE_BAND hold, and its row at once when it changes. */
  tiers: Map<number, Tier>;
}
type Tier = 'near' | 'mid' | 'far';
const TIER_EDGES: readonly (readonly [Tier, number])[] = [['near', REMOTE_NEAR_RANGE], ['mid', REMOTE_FULL_RANGE], ['far', REMOTE_FAR_RANGE]];
/** A ship's tier at `distance`: each edge sits REMOTE_BAND out for a ship last sent in that tier or a nearer one, in otherwise. */
function tierAt(distance: number, was: Tier | undefined): Tier | undefined {
  const from = was === undefined ? TIER_EDGES.length : TIER_EDGES.findIndex(([tier]) => tier === was);
  return TIER_EDGES.find(([, edge], i) => distance <= edge + (from <= i ? REMOTE_BAND : -REMOTE_BAND))?.[0];
}
/** A key frame per pilot this often (ticks) even when nothing was dropped: a slip in a delta cannot outlive it. */
const KEY_EVERY = 10 * T.tickRate;
/** Points are farm delivered through an exit; kills and deaths are the fight's own record. */
interface Score { points: number; kills: number; deaths: number }
/** Who an access token belongs to, and whether the admin desk seated them; null when it is not a live session. */
export type ArenaIdentify = (token: string) => Promise<{ accountId: string; username: string; name: string; pilot: boolean } | null>;

function accountIdentity(app: FastifyInstance): ArenaIdentify {
  return async token => {
    let accountId: string;
    try { ({ accountId } = await app.tokens.identity(token, 'access')); } catch (error) {
      if (error instanceof InvalidSessionError) return null;
      throw error;
    }
    const [row] = await app.db.select({ username: accounts.username, name: accounts.displayName, seat: arenaPilots.accountId }).from(accounts)
      .leftJoin(arenaPilots, eq(arenaPilots.accountId, accounts.id)).where(eq(accounts.id, accountId));
    return row ? { accountId, username: row.username, name: row.name, pilot: row.seat !== null } : null;
  };
}

/**
 * One shared room of ARENA_SEATS pilots and three bots. ARENA_DEV admits guests and keeps debug actions; the live
 * playtest admits accounts seated from the admin desk (or named in ARENA_PILOTS), with no debug actions.
 * No account, resource, sortie or repair writes either way.
 */
export function registerArena(app: FastifyInstance, env: Env, identify: ArenaIdentify = accountIdentity(app)): { world: ArenaWorld } {
  const admits = (account: { username: string; pilot: boolean }): boolean =>
    account.pilot || env.ARENA_PILOTS.includes('*') || env.ARENA_PILOTS.includes(account.username);
  const origins = new Set(env.ARENA_ALLOWED_ORIGINS.split(',').map(value => value.trim()).filter(Boolean));
  const sockets = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4096 });
  // Owner 2026-10-21: the live room flies its three bots (hunter, patrol, miner) too.
  const world = createSandboxWorld({ seed: Date.now() >>> 0 });
  const spawnRandom = mulberry32((Date.now() ^ 0x5eed) >>> 0);
  // Pilot zero is the offline sandbox slot; shared guests live in the remote pool.
  world.pilot.phase = 'towed';
  const participants = new Map<string, Participant>();
  /** Room standings by participant key; they outlive a ship that leaves and returns. */
  const scores = new Map<string, Score>();
  const inputs = new Map<number, ArenaIntent>();
  const settings = new Map<number, SteeringSettings>();
  const timings: number[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previous = performance.now(); let accumulator = 0; let droppedTicks = 0;
  /** False when the message was dropped: the socket is gone or too far behind. */
  const sendText = (socket: WebSocket, text: string): boolean => {
    if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount >= 256000) return false;
    socket.send(text); return true;
  };
  const send = (socket: WebSocket, payload: unknown): void => { sendText(socket, JSON.stringify(payload)); };
  const kick = (socket: WebSocket, reason: string): void => { send(socket, { kind: 'kick', reason }); socket.close(1000, reason); };
  interface RosterRow { id: number; name: string; ship: ShipClass; role?: 'hunter' | 'miner' | 'patrol'; points?: number; kills?: number; deaths?: number; copyOf?: number }
  const roster = (): RosterRow[] => {
    const rows: RosterRow[] = [
      ...Array.from(world.brains, ([id, brain]) => ({ id, name: brain.role, ship: ROLE_SHIPS[brain.role], role: brain.role })),
      ...Array.from(participants.values(), entry => ({ id: entry.pilot.id, name: entry.name, ship: entry.pilot.ship,
        points: scores.get(entry.key)?.points ?? 0, kills: scores.get(entry.key)?.kills ?? 0, deaths: scores.get(entry.key)?.deaths ?? 0 })),
    ];
    // An illusion wears its pilot's name and class (Y4d); it never ranks, and the radar shows the truth (plan 14 §4).
    for (const drone of world.drones) {
      const owner = rows.find(row => row.id === drone.decoyOf);
      if (owner) rows.push({ id: drone.id, name: owner.name, ship: owner.ship, copyOf: owner.id });
    }
    return rows;
  };
  /** Roster changes wait for the next half-second mark and go out folded into one message (owner 2026-10-23, 100 seats). */
  let rosterDirty = false; let rosterSent = -Infinity;
  const broadcastRoster = (): void => { rosterDirty = true; };
  /** The copies the room last named: a new one is named at once, before any snapshot draws it nameless. */
  let copies = new Set<number>();
  const flushRoster = (): void => {
    const now = new Set(world.drones.filter(drone => drone.decoyOf >= 0).map(drone => drone.id));
    const born = [...now].some(id => !copies.has(id));
    if (born || now.size !== copies.size) rosterDirty = true;
    copies = now;
    if (!rosterDirty || (!born && world.tick - rosterSent < T.tickRate / 2)) return;
    rosterDirty = false; rosterSent = world.tick;
    const text = JSON.stringify({ kind: 'roster', pilots: roster() });
    for (const entry of participants.values()) if (entry.socket) sendText(entry.socket, text);
  };
  const restart = (entry: Participant): void => {
    const fresh = createPilot(entry.pilot.id, entry.ship, entry.tactic);
    spawnFlight(fresh, spawnRandom, world.layout, nextEntry(world));
    fresh.shield = T.spawnShield * T.tickRate;
    Object.assign(entry.pilot, fresh); resetPlayout(entry.playout); entry.endedAt = 0; entry.seenKills = 0; entry.deathCounted = false; entry.extractionCounted = false;
    Object.assign(entry.input, NEUTRAL); entry.lastInput = world.tick;
    const index = world.drones.indexOf(entry.pilot); const prior = world.dronePrevious[index]; if (prior) copyFlight(prior, entry.pilot);
    broadcastRoster();
  };
  /** Each ship's full (near and middle) and far row text, built once per snapshot tick and shared by every viewer. */
  const fullRows = new Map<number, string>(); const farRows = new Map<number, string>();
  const rowText = (rows: Map<number, string>, pilot: Pilot, pack: (p: Pilot) => number[]): string => {
    let text = rows.get(pilot.id);
    if (text === undefined) { text = JSON.stringify(pack(pilot)); rows.set(pilot.id, text); }
    return text;
  };
  /** What the room last told every client about bullets, smoke, impacts, cargo and crystals (`feed.ts`). */
  const feedState = createFeedState(world);
  /** JSON body text of a feed, to splice into each pilot's snapshot: built once a tick for the whole room. */
  const feedText = (feed: ArenaFeed): string => JSON.stringify(feed).slice(1, -1);
  /**
   * One pilot's snapshot: its own ship exact, the nearest MAX_REMOTE_PILOTS others in sight within
   * REMOTE_FAR_RANGE — near rows every snapshot, middle rows every MID_EVERY ticks, far rows every
   * FAR_EVERY ticks; all on a key frame, and a ship's row at once when its tier changes (no gap at the client).
   * A ship its own radar sweep marks is sent wherever it is: past the far edge, in dust or smoke (Y4d).
   */
  const snapshot = (entry: Participant, shared: string, keyed: boolean): string => {
    const self = entry.pilot; const tiers = entry.tiers;
    const distance = new Map<number, number>(); const next = new Map<number, Tier>();
    const scanned = world.scans.length > 0 ? scanTargets(world, self.id) : [];
    const inReach = (other: Pilot): boolean => {
      if (other.id === self.id || other.phase === 'dead' || other.phase === 'towed' || other.phase === 'extracted') return false;
      const d = Math.hypot(self.p.x - other.p.x, self.p.y - other.p.y, self.p.z - other.p.z);
      let tier = tierAt(d, tiers.get(other.id));
      if (scanned.includes(other.id)) tier ??= 'far';
      else if (tier === undefined || !pilotVisible(world, self, other)) return false;
      distance.set(other.id, d); next.set(other.id, tier); return true;
    };
    const seen = world.drones.filter(inReach).sort((a, b) => (distance.get(a.id) ?? 0) - (distance.get(b.id) ?? 0)).slice(0, MAX_REMOTE_PILOTS);
    const marks = seen.filter(other => scanned.includes(other.id)).map(other => other.id);
    const midTick = keyed || world.tick % MID_EVERY === 0; const farTick = keyed || world.tick % FAR_EVERY === 0;
    const near: string[] = []; const mid: string[] = []; const far: string[] = [];
    entry.tiers = new Map();
    for (const other of seen) {
      const was = tiers.get(other.id); const tier = next.get(other.id) ?? 'far';
      entry.tiers.set(other.id, tier);
      if (tier === 'near') near.push(rowText(fullRows, other, packRemote));
      else if (tier === 'mid') { if (midTick || was !== 'mid') mid.push(rowText(fullRows, other, packRemote)); }
      else if (farTick || was !== 'far') far.push(rowText(farRows, other, packFar));
    }
    return `{"kind":"snap","tick":${String(world.tick)},"ack":${String(entry.ack)},"self":${JSON.stringify(packPilot(self))},`
      + `"others":[${near.join(',')}],"mid":[${mid.join(',')}],"far":[${far.join(',')}],"scan":${JSON.stringify(marks)},${shared}}`;
  };
  const remove = (entry: Participant): void => {
    const index = world.drones.indexOf(entry.pilot);
    if (index >= 0) { world.drones.splice(index, 1); world.dronePrevious.splice(index, 1); }
    participants.delete(entry.key); inputs.delete(entry.pilot.id); settings.delete(entry.pilot.id);
    broadcastRoster();
  };
  const step = (): void => {
    const started = performance.now();
    for (const entry of participants.values()) {
      const next = playInput(entry.playout, world.tick, T.inputRepeatMax);
      if (next === 'neutral') Object.assign(entry.input, NEUTRAL);
      else if (next !== 'repeat') {
        Object.assign(entry.input, next.input); entry.ack = next.seq; entry.lastInput = world.tick;
        entry.pilot.linkLost = 0;
      }
      if (world.tick - entry.lastInput >= T.linkLostAfter * T.tickRate && entry.pilot.linkLost === 0
        && (entry.pilot.phase === 'flying' || entry.pilot.phase === 'fuelOut')) entry.pilot.linkLost = T.linkLostGrace * T.tickRate;
    }
    stepArenaWorld(world, inputs, settings);
    let scored = false;
    for (const entry of participants.values()) {
      const score = scores.get(entry.key); if (!score) continue;
      if (entry.pilot.kills > entry.seenKills) { score.kills += entry.pilot.kills - entry.seenKills; entry.seenKills = entry.pilot.kills; scored = true; }
      if (entry.pilot.phase === 'dead' && !entry.deathCounted) { score.deaths++; entry.deathCounted = true; scored = true; }
      if (entry.pilot.phase === 'extracted' && !entry.extractionCounted) {
        score.points += holdPoints(entry.pilot.hold); entry.extractionCounted = true; scored = true;
      }
    }
    if (scored) broadcastRoster();
    flushRoster();
    const snapshotTick = world.tick % (T.tickRate / T.snapshotRate) === 0;
    // The delta moves the room's record on, so it is taken every snapshot tick, read or not.
    const delta = snapshotTick ? feedText(deltaFeed(feedState, world)) : '';
    let key: string | null = null;
    fullRows.clear(); farRows.clear();
    for (const entry of participants.values()) {
      if (['dead', 'extracted', 'towed'].includes(entry.pilot.phase)) {
        if (entry.endedAt === 0) entry.endedAt = world.tick;
        if (!entry.socket && world.tick - entry.endedAt > T.dropLife * T.tickRate) { remove(entry); continue; }
      }
      if (!snapshotTick || !entry.socket) continue;
      const keyed = world.tick >= entry.keyAt;
      // A snapshot the socket could not take leaves this pilot a delta short: the next is a key frame.
      if (!sendText(entry.socket, snapshot(entry, keyed ? key ??= feedText(keyFeed(world)) : delta, keyed))) entry.keyAt = 0;
      else if (keyed) entry.keyAt = world.tick + KEY_EVERY;
    }
    timings.push(performance.now() - started); if (timings.length > 300) timings.shift();
  };
  const loop = (): void => {
    const now = performance.now(); const elapsed = now - previous; previous = now;
    if (elapsed > 1000 / T.tickRate * 5) droppedTicks++;
    accumulator += Math.min(elapsed, 1000 / T.tickRate * 5);
    let count = 0;
    while (accumulator >= 1000 / T.tickRate && count++ < 5) { accumulator -= 1000 / T.tickRate; step(); }
    timer = setTimeout(loop, Math.max(1, 1000 / T.tickRate - accumulator));
  };
  app.get('/arena/health', { config: { rateLimit: false } }, () => {
    const ordered = [...timings].sort((a, b) => a - b);
    return { enabled: env.ARENA_ENABLED, prototype: true, tick: world.tick, rooms: 1,
      pilots: participants.size, connected: Array.from(participants.values()).filter(p => p.socket !== null).length,
      tickP95: ordered[Math.floor(ordered.length * 0.95)] ?? 0, droppedTicks };
  });
  registerArenaReferences(app, env, async token => {
    const account = await identify(token);
    return !account ? 'auth' : admits(account) ? account : 'denied';
  });
  /** The client asks once per session whether to show the door at all. */
  app.get('/arena/access', async request => {
    const header = request.headers.authorization;
    if (!env.ARENA_ENABLED || !header?.startsWith('Bearer ')) return { allowed: false };
    const account = await identify(header.slice(7));
    return { allowed: account !== null && admits(account) };
  });
  app.server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/arena/ws') { socket.destroy(); return; }
    if (!env.ARENA_ENABLED || !request.headers.origin || !origins.has(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    sockets.handleUpgrade(request, socket, head, ws => { sockets.emit('connection', ws); });
  });
  sockets.on('connection', socket => {
    let participant: Participant | null = null; let greeted = false; let invalid = 0; let windowAt = performance.now(); let messages = 0;
    const helloTimer = setTimeout(() => { kick(socket, 'auth'); }, 5000);
    socket.on('error', error => { app.log.debug({ code: error.name }, 'arena socket error'); });
    socket.on('message', raw => {
      const now = performance.now(); if (now - windowAt > 1000) { windowAt = now; messages = 0; }
      if (++messages > 60) return;
      let value: unknown;
      try {
        const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : Array.isArray(raw) ? Buffer.concat(raw).toString('utf8') : Buffer.from(raw).toString('utf8');
        value = JSON.parse(text);
      } catch { if (++invalid >= 10) kick(socket, 'flood'); return; }
      const parsed = messageSchema.safeParse(value);
      if (!parsed.success) {
        // A client of another protocol (a tab from before a deploy) is told so, not left to retry in silence.
        // A hello of this version that does not parse (no class, say) can never be fixed by waiting.
        if (!greeted && typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'hello') {
          kick(socket, 'v' in value && value.v !== ARENA_PROTOCOL ? 'version' : 'protocol'); return;
        }
        if (++invalid >= 10) kick(socket, 'protocol'); return;
      }
      const msg = parsed.data;
      if (msg.kind === 'hello') {
        if (greeted) { kick(socket, 'protocol'); return; }
        greeted = true; clearTimeout(helloTimer);
        const seat = (key: string, name: string): void => {
          if (socket.readyState !== WebSocket.OPEN) return;
          let entry = participants.get(key);
          if (!entry && msg.mode === 'resume') { kick(socket, 'ended'); return; }
          if (!entry) {
            if (participants.size >= env.ARENA_SEATS) {
              // A finished pilot who left only keeps the seat to read the result; a newcomer flies.
              const idle = [...participants.values()].filter(other => !other.socket && other.endedAt > 0)
                .sort((x, y) => x.endedAt - y.endedAt)[0];
              if (!idle) { kick(socket, 'full'); return; }
              remove(idle);
            }
            const pilot = createPilot(world.nextId++, msg.ship, msg.tactic);
            entry = { key, pilot, socket: null, playout: createPlayout(), input: createInput(), settings: { sensitivity: 1, invertPitch: false },
              ack: 0, lastSeq: 0, lastInput: world.tick, endedAt: 0, name, seenKills: 0, deathCounted: false, extractionCounted: false, keyAt: 0, tiers: new Map(),
              ship: msg.ship, tactic: msg.tactic };
            world.drones.push(pilot); const prior = createFlightState(); world.dronePrevious.push(prior);
            participants.set(entry.key, entry); inputs.set(pilot.id, entry.input); settings.set(pilot.id, entry.settings); restart(entry);
            if (!scores.has(key)) scores.set(key, { points: 0, kills: 0, deaths: 0 });
          }
          entry.ship = msg.ship; entry.tactic = msg.tactic;
          if (entry.socket && entry.socket !== socket) kick(entry.socket, 'replaced');
          participant = entry; entry.socket = socket; entry.pilot.linkLost = 0; entry.lastInput = world.tick; resetPlayout(entry.playout);
          // Its first snapshot is the next snapshot tick's, a key frame: never one in between (`feed.ts`).
          entry.keyAt = 0;
          send(socket, { kind: 'welcome', v: ARENA_PROTOCOL, pilotId: entry.pilot.id, tick: world.tick, seq: entry.lastSeq,
            tickRate: T.tickRate, snapshotRate: T.snapshotRate, layoutVersion: ARENA_LAYOUT.version, pilots: roster() });
          broadcastRoster();
        };
        if (env.ARENA_DEV && msg.guestId) { seat(msg.guestId, `Pilot ${String(world.nextId - 3)}`); return; }
        const token = msg.token;
        if (!token) { kick(socket, 'auth'); return; }
        identify(token).then(account => {
          if (!account) { kick(socket, 'auth'); return; }
          if (!admits(account)) { kick(socket, 'denied'); return; }
          seat(account.accountId, account.name.slice(0, 32));
        }, (error: unknown) => { app.log.error({ err: error }, 'arena identity lookup failed'); kick(socket, 'auth'); });
        return;
      }
      const entry = participant; if (!entry) { kick(socket, 'auth'); return; }
      if (msg.kind === 'ping') { send(socket, { kind: 'pong', t: msg.t, serverTimeMs: app.clock.now().getTime() }); return; }
      if (msg.kind === 'settings') { entry.settings.sensitivity = msg.sensitivity; entry.settings.invertPitch = msg.invertPitch; return; }
      if (msg.kind === 'leave') { recoverPilot(world, entry.pilot); kick(socket, 'ended'); return; }
      if (msg.kind === 'dev') {
        // Live rooms keep one action: flying again once this flight has ended.
        if (!env.ARENA_DEV) {
          if (msg.action === 'restart' && ['dead', 'extracted', 'towed'].includes(entry.pilot.phase)) restart(entry);
          return;
        }
        if (msg.action === 'restart') restart(entry);
        else if (msg.action === 'exit') {
          const exit = ARENA_LAYOUT.exits[1]; if (exit) Object.assign(entry.pilot.p, { x: exit.x, y: exit.y + 1, z: exit.z });
          entry.pilot.s = 0; entry.pilot.throttle = 0; entry.pilot.landed = 0; resetPlayout(entry.playout); Object.assign(entry.input, NEUTRAL);
        }
        else if (msg.action === 'fuel') entry.pilot.fuel = Math.min(CLASS_STATS[entry.pilot.ship].fuelTank, msg.value ?? 0);
        else if (msg.action === 'cargo') {
          entry.pilot.cargo = Math.min(CLASS_STATS[entry.pilot.ship].cargoCapacity, msg.value ?? T.testCargo);
          entry.pilot.hold = entry.pilot.hold.map((_, kind) => kind === 0 ? entry.pilot.cargo : 0);
        }
        else if (msg.p) {
          Object.assign(entry.pilot.p, msg.p); Object.assign(entry.pilot.q, { x: 0, y: 0, z: 0, w: 1 }); entry.pilot.landed = 0;
          entry.pilot.s = 0; entry.pilot.throttle = 0; entry.pilot.omegaYaw = 0; entry.pilot.omegaPitch = 0;
          resetPlayout(entry.playout); Object.assign(entry.input, NEUTRAL);
        }
        return;
      }
      const [seq, x, y, throttle, buttons, ax, ay, target] = msg.values;
      if (seq <= entry.lastSeq) return; entry.lastSeq = seq;
      const input: ArenaIntent = { steerX: x / 1000, steerY: y / 1000, throttle: throttle / 100,
        assistX: clampAssist(ax / 1000), assistY: clampAssist(ay / 1000),
        fire: (buttons & 1) !== 0, turbo: (buttons & 2) !== 0, smoke: (buttons & 4) !== 0,
        cloak: (buttons & 8) !== 0, turboBurst: (buttons & 16) !== 0, land: (buttons & 32) !== 0,
        signature: (buttons & 64) !== 0, signatureTarget: target, illusion: (buttons & 128) !== 0, radar: (buttons & 256) !== 0 };
      if (entry.playout.queue.length >= T.inputQueueMax) {
        const lost = entry.playout.queue.shift(); if (lost) {
          input.fire = input.fire === true || lost.input.fire === true;
          input.smoke = input.smoke === true || lost.input.smoke === true;
          input.cloak = input.cloak === true || lost.input.cloak === true;
          input.illusion = input.illusion === true || lost.input.illusion === true;
          input.radar = input.radar === true || lost.input.radar === true;
          if (lost.input.signature === true && input.signature !== true) { input.signature = true; input.signatureTarget = lost.input.signatureTarget ?? -1; }
          input.turbo ||= lost.input.turbo;
          input.turboBurst = input.turboBurst === true || lost.input.turboBurst === true;
        }
      }
      queueInput(entry.playout, seq, input, world.tick, T.inputBuffer);
    });
    socket.on('close', () => {
      clearTimeout(helloTimer);
      if (participant?.socket === socket) {
        participant.socket = null; resetPlayout(participant.playout); Object.assign(participant.input, NEUTRAL);
        if (participant.pilot.phase === 'flying' || participant.pilot.phase === 'fuelOut') participant.pilot.linkLost = T.linkLostGrace * T.tickRate;
      }
    });
  });
  if (env.ARENA_ENABLED) timer = setTimeout(loop, 1000 / T.tickRate);
  app.addHook('onClose', () => {
    if (timer) clearTimeout(timer);
    for (const socket of sockets.clients) { send(socket, { kind: 'kick', reason: 'shutdown' }); socket.terminate(); }
    sockets.close();
  });
  return { world };
}
