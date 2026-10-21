import { performance } from 'node:perf_hooks';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';
import { mulberry32 } from '@astera/rules';
import { ARENA_LAYOUT, ARENA_PROTOCOL, ARENA_TUNING as T, clampAssist, holdPoints, copyFlight, createFlightState, createInput,
  createPilot, createSandboxWorld, packPilot, recoverPilot, spawnFlight, stepArenaWorld, pilotVisible,
  type ArenaIntent, type ArenaSnapshot, type ArenaWorld, type Pilot, type SteeringSettings } from '@astera/rules/arena';
import { InvalidSessionError } from '../auth/tokens.js';
import { accounts, arenaPilots } from '../db/schema.js';
import type { Env } from '../env.js';
import { registerArenaReferences } from './references.js';
import { createPlayout, playInput, queueInput, resetPlayout, type Playout } from './playout.js';

const inputSchema = z.object({ kind: z.literal('in'), values: z.tuple([
  z.number().int().nonnegative().max(100000000), z.number().int().min(-1000).max(1000),
  z.number().int().min(-1000).max(1000), z.number().int().min(0).max(100), z.number().int().min(0).max(63),
  z.number().int().min(-1000).max(1000), z.number().int().min(-1000).max(1000),
]) });
const pointSchema = z.object({ x: z.number().finite().min(-3000).max(3000), y: z.number().finite().min(-3000).max(3000), z: z.number().finite().min(-3000).max(3000) });
const NEUTRAL = { ...createInput(), fire: false, smoke: false, cloak: false, turboBurst: false, land: false };
const messageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hello'), v: z.literal(ARENA_PROTOCOL), guestId: z.string().regex(/^[a-zA-Z0-9-]{8,96}$/).optional(),
    token: z.string().min(1).max(4096).optional(), mode: z.enum(['enter', 'resume']) }),
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
}
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
 * One shared room. ARENA_DEV admits guests and keeps bots and debug actions; the live
 * playtest admits accounts seated from the admin desk (or named in ARENA_PILOTS), with no bots and no debug actions.
 * No account, resource, sortie or repair writes either way.
 */
export function registerArena(app: FastifyInstance, env: Env, identify: ArenaIdentify = accountIdentity(app)): { world: ArenaWorld } {
  const admits = (account: { username: string; pilot: boolean }): boolean =>
    account.pilot || env.ARENA_PILOTS.includes('*') || env.ARENA_PILOTS.includes(account.username);
  const origins = new Set(env.ARENA_ALLOWED_ORIGINS.split(',').map(value => value.trim()).filter(Boolean));
  const sockets = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4096 });
  const world = createSandboxWorld({ seed: Date.now() >>> 0, ...(env.ARENA_DEV ? {} : { bots: 0 }) });
  const spawnRandom = mulberry32((Date.now() ^ 0x5eed) >>> 0);
  // Pilot zero is the offline sandbox slot; shared guests live in the remote pool.
  world.pilot.phase = 'towed';
  const participants = new Map<string, Participant>();
  /** Room standings by participant key; they outlive a ship that leaves and returns. */
  const scores = new Map<string, Score>();
  const inputs = new Map<number, ArenaIntent>();
  const settings = new Map<number, SteeringSettings>();
  const timings: number[] = [];
  let nextId = 4; let timer: ReturnType<typeof setTimeout> | null = null;
  let previous = performance.now(); let accumulator = 0; let droppedTicks = 0;
  const send = (socket: WebSocket, payload: unknown): void => {
    if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 256000) socket.send(JSON.stringify(payload));
  };
  const kick = (socket: WebSocket, reason: string): void => { send(socket, { kind: 'kick', reason }); socket.close(1000, reason); };
  const roster = (): { id: number; name: string; role?: 'hunter' | 'miner' | 'patrol'; points?: number; kills?: number; deaths?: number }[] => [
    ...Array.from(world.brains, ([id, brain]) => ({ id, name: brain.role, role: brain.role })),
    ...Array.from(participants.values(), entry => ({ id: entry.pilot.id, name: entry.name,
      points: scores.get(entry.key)?.points ?? 0, kills: scores.get(entry.key)?.kills ?? 0, deaths: scores.get(entry.key)?.deaths ?? 0 })),
  ];
  const broadcastRoster = (): void => { for (const entry of participants.values()) if (entry.socket) send(entry.socket, { kind: 'roster', pilots: roster() }); };
  const restart = (entry: Participant): void => {
    const fresh = createPilot(entry.pilot.id);
    spawnFlight(fresh, spawnRandom);
    fresh.shield = T.spawnShield * T.tickRate;
    Object.assign(entry.pilot, fresh); resetPlayout(entry.playout); entry.endedAt = 0; entry.seenKills = 0; entry.deathCounted = false; entry.extractionCounted = false;
    Object.assign(entry.input, NEUTRAL); entry.lastInput = world.tick;
    const index = world.drones.indexOf(entry.pilot); const prior = world.dronePrevious[index]; if (prior) copyFlight(prior, entry.pilot);
  };
  // Shared rows only draw: centimetres are plenty, and full doubles were most of the
  // stream. The own pilot stays exact; reconciliation replays from it.
  const cm = (n: number): number => Math.round(n * 100) / 100;
  const fine = (n: number): number => Math.round(n * 1e4) / 1e4;
  const snapshot = (entry: Participant): ArenaSnapshot => {
    const self = entry.pilot;
    const others = world.drones.filter(other => {
      if (other.id === self.id || other.phase === 'dead' || other.phase === 'towed' || other.phase === 'extracted' || !pilotVisible(world, self, other)) return false;
      const x = self.p.x - other.p.x; const y = self.p.y - other.p.y; const z = self.p.z - other.p.z;
      return x * x + y * y + z * z <= T.aoiRadius * T.aoiRadius;
    }).map(other => packPilot(other).map(fine));
    return { kind: 'snap', tick: world.tick, ack: entry.ack, self: packPilot(self), others,
      bullets: world.projectiles.flatMap((b, i) => b.life > 0 ? [[i, b.p.x, b.p.y, b.p.z, b.previous.x, b.previous.y, b.previous.z, b.v.x, b.v.y, b.v.z, b.life, b.owner].map(cm)] : []),
      smoke: world.smoke.flatMap((p, i) => p.active ? [[i, p.p.x, p.p.y, p.p.z, p.age, p.owner].map(cm)] : []),
      cargo: world.cargoDrops.flatMap((d, i) => d.active ? [[i, d.p.x, d.p.y, d.p.z, d.amount, d.age, d.kind].map(cm)] : []),
      impacts: world.impacts.flatMap((hit, i) => hit.active ? [[i, hit.p.x, hit.p.y, hit.p.z, hit.age, hit.kind === 'ship' ? 1 : hit.kind === 'shield' ? 2 : hit.kind === 'explosion' ? 3 : 0].map(cm)] : []),
      minerals: world.minerals.map(value => Math.round(value * 100) / 100),
      dry: world.dry.map(value => value ? 1 : 0),
    };
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
    for (const entry of participants.values()) {
      if (['dead', 'extracted', 'towed'].includes(entry.pilot.phase)) {
        if (entry.endedAt === 0) entry.endedAt = world.tick;
        if (!entry.socket && world.tick - entry.endedAt > T.dropLife * T.tickRate) { remove(entry); continue; }
      }
      if (world.tick % (T.tickRate / T.snapshotRate) === 0 && entry.socket) send(entry.socket, snapshot(entry));
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
      if (!parsed.success) { if (++invalid >= 10) kick(socket, 'protocol'); return; }
      const msg = parsed.data;
      if (msg.kind === 'hello') {
        if (greeted) { kick(socket, 'protocol'); return; }
        greeted = true; clearTimeout(helloTimer);
        const seat = (key: string, name: string): void => {
          if (socket.readyState !== WebSocket.OPEN) return;
          let entry = participants.get(key);
          if (!entry && msg.mode === 'resume') { kick(socket, 'ended'); return; }
          if (!entry) {
            if (participants.size >= 8) {
              // A finished pilot who left only keeps the seat to read the result; a newcomer flies.
              const idle = [...participants.values()].filter(other => !other.socket && other.endedAt > 0)
                .sort((x, y) => x.endedAt - y.endedAt)[0];
              if (!idle) { kick(socket, 'full'); return; }
              remove(idle);
            }
            const pilot = createPilot(nextId++);
            entry = { key, pilot, socket: null, playout: createPlayout(), input: createInput(), settings: { sensitivity: 1, invertPitch: false },
              ack: 0, lastSeq: 0, lastInput: world.tick, endedAt: 0, name, seenKills: 0, deathCounted: false, extractionCounted: false };
            world.drones.push(pilot); const prior = createFlightState(); world.dronePrevious.push(prior);
            participants.set(entry.key, entry); inputs.set(pilot.id, entry.input); settings.set(pilot.id, entry.settings); restart(entry);
            if (!scores.has(key)) scores.set(key, { points: 0, kills: 0, deaths: 0 });
          }
          if (entry.socket && entry.socket !== socket) kick(entry.socket, 'replaced');
          participant = entry; entry.socket = socket; entry.pilot.linkLost = 0; entry.lastInput = world.tick; resetPlayout(entry.playout);
          send(socket, { kind: 'welcome', v: ARENA_PROTOCOL, pilotId: entry.pilot.id, tick: world.tick, seq: entry.lastSeq,
            tickRate: T.tickRate, snapshotRate: T.snapshotRate, layoutVersion: ARENA_LAYOUT.version, pilots: roster() });
          send(socket, snapshot(entry)); broadcastRoster();
        };
        if (env.ARENA_DEV && msg.guestId) { seat(msg.guestId, `Pilot ${String(nextId - 3)}`); return; }
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
          if (msg.action === 'restart' && ['dead', 'extracted', 'towed'].includes(entry.pilot.phase)) { restart(entry); send(socket, snapshot(entry)); }
          return;
        }
        if (msg.action === 'restart') restart(entry);
        else if (msg.action === 'exit') {
          const exit = ARENA_LAYOUT.exits[1]; if (exit) Object.assign(entry.pilot.p, { x: exit.x, y: exit.y + 1, z: exit.z });
          entry.pilot.s = 0; entry.pilot.throttle = 0; entry.pilot.landed = 0; resetPlayout(entry.playout); Object.assign(entry.input, NEUTRAL);
        }
        else if (msg.action === 'fuel') entry.pilot.fuel = Math.min(T.fuelTank, msg.value ?? 0);
        else if (msg.action === 'cargo') {
          entry.pilot.cargo = Math.min(T.cargoCapacity, msg.value ?? T.testCargo);
          entry.pilot.hold = entry.pilot.hold.map((_, kind) => kind === 0 ? entry.pilot.cargo : 0);
        }
        else if (msg.p) {
          Object.assign(entry.pilot.p, msg.p); Object.assign(entry.pilot.q, { x: 0, y: 0, z: 0, w: 1 }); entry.pilot.landed = 0;
          entry.pilot.s = 0; entry.pilot.throttle = 0; entry.pilot.omegaYaw = 0; entry.pilot.omegaPitch = 0;
          resetPlayout(entry.playout); Object.assign(entry.input, NEUTRAL);
        }
        send(socket, snapshot(entry)); return;
      }
      const [seq, x, y, throttle, buttons, ax, ay] = msg.values;
      if (seq <= entry.lastSeq) return; entry.lastSeq = seq;
      const input: ArenaIntent = { steerX: x / 1000, steerY: y / 1000, throttle: throttle / 100,
        assistX: clampAssist(ax / 1000), assistY: clampAssist(ay / 1000),
        fire: (buttons & 1) !== 0, turbo: (buttons & 2) !== 0, smoke: (buttons & 4) !== 0,
        cloak: (buttons & 8) !== 0, turboBurst: (buttons & 16) !== 0, land: (buttons & 32) !== 0 };
      if (entry.playout.queue.length >= T.inputQueueMax) {
        const lost = entry.playout.queue.shift(); if (lost) {
          input.fire = input.fire === true || lost.input.fire === true;
          input.smoke = input.smoke === true || lost.input.smoke === true;
          input.cloak = input.cloak === true || lost.input.cloak === true;
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
