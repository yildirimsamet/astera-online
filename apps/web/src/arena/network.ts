import { z } from 'zod';
import { ARENA_LAYOUT, ARENA_PROTOCOL, ARENA_TUNING as T, copyFlight, createFlightState, createPilot,
  decodeArenaSnapshot, predictPilot, stepPredictedTracers, unpackPilot, type ArenaIntent, type ArenaSnapshot, type ArenaWorld,
  type SteeringSettings } from '@astera/rules/arena';
import { createIdempotencyKey } from '../api/client.js';

const rosterRow = z.object({ id: z.number().int().nonnegative(), name: z.string().max(32),
  role: z.enum(['hunter', 'miner', 'patrol']).optional(),
  points: z.number().int().nonnegative().optional(),
  kills: z.number().int().nonnegative().optional(), deaths: z.number().int().nonnegative().optional() });
const rosterSchema = z.array(rosterRow).max(16);
export interface Standing { id: number; name: string; points: number; kills: number; deaths: number; self: boolean }

/** Room standings: farm points delivered first, then kills, then fewer deaths, then name. Bots never rank. */
export function rankStandings(pilots: readonly z.infer<typeof rosterRow>[], selfId: number): Standing[] {
  return pilots.filter(p => !p.role)
    .map(p => ({ id: p.id, name: p.name, points: p.points ?? 0, kills: p.kills ?? 0, deaths: p.deaths ?? 0, self: p.id === selfId }))
    .sort((a, b) => b.points - a.points || b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));
}
const lowMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('welcome'), v: z.literal(ARENA_PROTOCOL), pilotId: z.number().int().positive(),
    tick: z.number().int().nonnegative(), seq: z.number().int().nonnegative(), tickRate: z.literal(30),
    snapshotRate: z.literal(15), layoutVersion: z.literal(ARENA_LAYOUT.version), pilots: rosterSchema }),
  z.object({ kind: z.literal('roster'), pilots: rosterSchema }),
  z.object({ kind: z.literal('pong'), t: z.number().finite(), serverTimeMs: z.number().finite() }),
  z.object({ kind: z.literal('kick'), reason: z.string().max(32) }),
]);
export interface NetworkStatus {
  phase: 'idle' | 'connecting' | 'online' | 'reconnecting' | 'failed'; rtt: number; pilots: number; reason: string;
  board: readonly Standing[];
}
interface Pending { seq: number; input: ArenaIntent }
interface RemoteFrame { at: number; snapshot: ArenaSnapshot }

/** `credential` signs the hello with the player's session; without it the hello is a dev guest. */
export function createArenaNetwork(world: ArenaWorld, settings: SteeringSettings, onLost: () => void,
  credential?: () => Promise<string | null>) {
  const listeners = new Set<() => void>();
  let status: Readonly<NetworkStatus> = { phase: 'idle', rtt: 0, pilots: 0, reason: '', board: [] };
  let socket: WebSocket | null = null; let retry: ReturnType<typeof setTimeout> | null = null;
  let stopped = true; let welcomed = false; let connected = false; let attempts = 0; let seq = 0; let lastPing = 0;
  let settingSignature = ''; let lastSnapshot = -1;
  const history: Pending[] = []; const remotes: RemoteFrame[] = [];
  /**
   * Remote pilots by id, not by row: a ship that cloaks or leaves the AOI shifts every
   * row after it, and reusing objects by row drew each of those ships from another
   * ship's previous pose for a frame.
   */
  const remote = new Map<number, { pilot: ReturnType<typeof createPilot>; previous: ReturnType<typeof createFlightState>; step: number }>();
  let interpolations = 0;
  const before = createFlightState();
  const names = new Map<number, string>();
  const roles = new Map<number, 'hunter' | 'miner' | 'patrol'>();
  const guestKey = 'astera-arena-prototype-guest';
  let guest = sessionStorage.getItem(guestKey);
  if (!guest) { guest = createIdempotencyKey(); sessionStorage.setItem(guestKey, guest); }
  const notify = (patch: Partial<NetworkStatus>): void => { status = { ...status, ...patch }; for (const listener of listeners) listener(); };
  const send = (value: unknown): void => { if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 64000) socket.send(JSON.stringify(value)); };
  const roster = (pilots: z.infer<typeof rosterSchema>): void => {
    names.clear(); roles.clear();
    for (const p of pilots) { names.set(p.id, p.name); if (p.role) roles.set(p.id, p.role); }
    notify({ pilots: pilots.filter(p => !p.role).length, board: rankStandings(pilots, world.pilot.id) });
  };
  const effects = (snap: ArenaSnapshot): void => {
    for (const b of world.projectiles) b.life = 0;
    for (const values of snap.bullets) {
      const b = world.projectiles[values[0] ?? -1]; if (!b) continue;
      b.p.x = values[1] ?? 0; b.p.y = values[2] ?? 0; b.p.z = values[3] ?? 0;
      b.previous.x = values[4] ?? 0; b.previous.y = values[5] ?? 0; b.previous.z = values[6] ?? 0;
      b.v.x = values[7] ?? 0; b.v.y = values[8] ?? 0; b.v.z = values[9] ?? 0;
      b.life = values[10] ?? 0; b.owner = values[11] ?? -1;
    }
    for (const p of world.smoke) p.active = false;
    for (const values of snap.smoke) {
      const p = world.smoke[values[0] ?? -1]; if (!p) continue;
      p.p.x = values[1] ?? 0; p.p.y = values[2] ?? 0; p.p.z = values[3] ?? 0;
      p.age = values[4] ?? 0; p.owner = values[5] ?? -1; p.active = true;
    }
    for (const d of world.cargoDrops) d.active = false;
    for (const values of snap.cargo) {
      const d = world.cargoDrops[values[0] ?? -1]; if (!d) continue;
      d.p.x = values[1] ?? 0; d.p.y = values[2] ?? 0; d.p.z = values[3] ?? 0;
      d.amount = values[4] ?? 0; d.age = values[5] ?? 0; d.kind = values[6] ?? 0; d.active = true;
    }
    snap.minerals.forEach((value, slot) => { world.minerals[slot] = value; world.dry[slot] = snap.dry[slot] === 1; });
    for (const hit of world.impacts) hit.active = false;
    for (const values of snap.impacts) {
      const hit = world.impacts[values[0] ?? -1]; if (!hit) continue;
      hit.p.x = values[1] ?? 0; hit.p.y = values[2] ?? 0; hit.p.z = values[3] ?? 0;
      hit.age = values[4] ?? 0; hit.kind = values[5] === 1 ? 'ship' : values[5] === 2 ? 'shield' : values[5] === 3 ? 'explosion' : 'rock'; hit.active = true;
    }
  };
  const receive = (snap: ArenaSnapshot): void => {
    if (snap.tick < lastSnapshot) return;
    lastSnapshot = snap.tick;
    copyFlight(before, world.pilot);
    unpackPilot(snap.self, world.pilot); world.tick = snap.tick; world.shots = world.pilot.shots;
    while (history[0] && history[0].seq <= snap.ack) history.shift();
    for (const pending of history) predictPilot(world, pending.input, settings);
    copyFlight(world.previous, world.pilot);
    // Small corrections interpolate from the view already on screen. Teleports snap.
    const x = before.p.x - world.pilot.p.x; const y = before.p.y - world.pilot.p.y; const zz = before.p.z - world.pilot.p.z;
    if (x * x + y * y + zz * zz < 25) copyFlight(world.previous, before);
    effects(snap);
    remotes.push({ at: performance.now(), snapshot: snap }); if (remotes.length > 12) remotes.shift();
  };
  const open = (): void => {
    if (stopped) return;
    notify({ phase: welcomed ? 'reconnecting' : 'connecting', reason: '' });
    const connection = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/arena/ws`);
    socket = connection;
    const timeout = setTimeout(() => { if (!connected) connection.close(); }, 5000);
    connection.onopen = () => {
      const hello = { kind: 'hello', v: ARENA_PROTOCOL, guestId: guest, mode: welcomed ? 'resume' : 'enter' };
      if (!credential) { send(hello); return; }
      void credential().then(token => { if (socket === connection) send({ ...hello, ...(token ? { token } : {}) }); });
    };
    connection.onmessage = event => {
      let value: unknown;
      if (typeof event.data !== 'string') { connection.close(1002, 'protocol'); return; }
      try { value = JSON.parse(event.data); } catch { connection.close(1002, 'protocol'); return; }
      const snap = decodeArenaSnapshot(value);
      if (snap) { receive(snap); return; }
      const parsed = lowMessage.safeParse(value); if (!parsed.success) { connection.close(1002, 'protocol'); return; }
      const msg = parsed.data;
      if (msg.kind === 'welcome') {
        clearTimeout(timeout); welcomed = true; connected = true; attempts = 0; seq = Math.max(seq, msg.seq);
        settingSignature = ''; history.length = 0; remotes.length = 0; remote.clear(); lastSnapshot = -1;
        world.pilot.id = msg.pilotId; notify({ phase: 'online', reason: '' }); roster(msg.pilots);
      } else if (msg.kind === 'roster') roster(msg.pilots);
      else if (msg.kind === 'pong') notify({ rtt: Math.round(performance.now() - msg.t) });
      else { stopped = true; connected = false; notify({ phase: 'failed', reason: msg.reason }); connection.close(); }
    };
    connection.onclose = () => {
      clearTimeout(timeout); if (socket !== connection) return;
      connected = false; onLost();
      if (stopped) return;
      if (++attempts > 15) { notify({ phase: 'failed', reason: 'connection' }); return; }
      notify({ phase: 'reconnecting' }); retry = setTimeout(open, 1000);
    };
    connection.onerror = () => { /* Close owns recovery, avoiding duplicate connections. */ };
  };
  const interpolate = (at: number): void => {
    const latest = remotes[remotes.length - 1]; if (!latest) return;
    const targetTick = latest.snapshot.tick + (at - latest.at) / 1000 * T.tickRate - T.interpDelay * T.tickRate;
    let first = remotes[0] ?? latest; let second = latest;
    for (let i = 1; i < remotes.length; i++) {
      const candidate = remotes[i]; if (!candidate) continue;
      if (candidate.snapshot.tick >= targetTick) { second = candidate; first = remotes[i - 1] ?? first; break; }
    }
    const span = second.snapshot.tick - first.snapshot.tick;
    const alpha = span > 0 ? Math.max(0, Math.min(1, (targetTick - first.snapshot.tick) / span)) : 1;
    const step = ++interpolations;
    world.drones.length = 0; world.dronePrevious.length = 0;
    for (const current of second.snapshot.others) {
      const id = current[0] ?? 0;
      const prior = first.snapshot.others.find(p => p[0] === id) ?? current;
      let entry = remote.get(id);
      if (!entry) { entry = { pilot: createPilot(id), previous: createFlightState(), step: -1 }; remote.set(id, entry); }
      const { pilot, previous } = entry;
      // Seen last step: its last pose is the start of this one. New or back in view: no motion from a stale pose.
      const continuous = entry.step === step - 1;
      copyFlight(previous, pilot); unpackPilot(current, pilot); entry.step = step;
      world.drones.push(pilot); world.dronePrevious.push(previous);
      pilot.p.x = (prior[1] ?? 0) + ((current[1] ?? 0) - (prior[1] ?? 0)) * alpha;
      pilot.p.y = (prior[2] ?? 0) + ((current[2] ?? 0) - (prior[2] ?? 0)) * alpha;
      pilot.p.z = (prior[3] ?? 0) + ((current[3] ?? 0) - (prior[3] ?? 0)) * alpha;
      const dot = (prior[4] ?? 0) * pilot.q.x + (prior[5] ?? 0) * pilot.q.y + (prior[6] ?? 0) * pilot.q.z + (prior[7] ?? 1) * pilot.q.w;
      const sign = dot < 0 ? -1 : 1;
      pilot.q.x = (prior[4] ?? 0) * (1 - alpha) + pilot.q.x * alpha * sign;
      pilot.q.y = (prior[5] ?? 0) * (1 - alpha) + pilot.q.y * alpha * sign;
      pilot.q.z = (prior[6] ?? 0) * (1 - alpha) + pilot.q.z * alpha * sign;
      pilot.q.w = (prior[7] ?? 1) * (1 - alpha) + pilot.q.w * alpha * sign;
      const norm = Math.sqrt(pilot.q.x * pilot.q.x + pilot.q.y * pilot.q.y + pilot.q.z * pilot.q.z + pilot.q.w * pilot.q.w) || 1;
      pilot.q.x /= norm; pilot.q.y /= norm; pilot.q.z /= norm; pilot.q.w /= norm;
      if (!continuous) copyFlight(previous, pilot);
    }
    for (const [id, entry] of remote) if (entry.step !== step) remote.delete(id);
  };
  return {
    names, roles,
    getSnapshot: (): Readonly<NetworkStatus> => status,
    subscribe: (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    connect(): void { stopped = false; attempts = 0; if (retry) clearTimeout(retry); if (socket) socket.close(); connected = false; open(); },
    get connected(): boolean { return connected; },
    step(source: ArenaIntent): void {
      if (!connected) return;
      const signature = `${String(settings.sensitivity)}:${String(settings.invertPitch)}`;
      if (signature !== settingSignature) { send({ kind: 'settings', ...settings }); settingSignature = signature; }
      const input: ArenaIntent = { ...source };
      const buttons = Number(input.fire) | Number(input.turbo) << 1 | Number(input.smoke) << 2 | Number(input.cloak) << 3 | Number(input.turboBurst) << 4;
      send({ kind: 'in', values: [++seq, Math.round(input.steerX * 1000), Math.round(input.steerY * 1000), Math.round(input.throttle * 100), buttons,
        Math.round(input.assistX * 1000), Math.round(input.assistY * 1000)] });
      history.push({ seq, input }); if (history.length > 128) history.shift();
      predictPilot(world, input, settings);
      stepPredictedTracers(world);
      interpolate(performance.now());
      for (const b of world.projectiles) if (b.life > 0) {
        b.previous.x = b.p.x; b.previous.y = b.p.y; b.previous.z = b.p.z;
        b.p.x += b.v.x / T.tickRate; b.p.y += b.v.y / T.tickRate; b.p.z += b.v.z / T.tickRate; b.life -= 1 / T.tickRate;
      }
      for (const p of world.smoke) if (p.active) p.age += 1 / T.tickRate;
      for (const hit of world.impacts) if (hit.active) hit.age += 1 / T.tickRate;
      if (performance.now() - lastPing > 1000) { lastPing = performance.now(); send({ kind: 'ping', t: lastPing }); }
    },
    dev(action: 'restart' | 'exit' | 'fuel' | 'cargo' | 'position', value?: number, p?: { x: number; y: number; z: number }): void { send({ kind: 'dev', action, value, p }); },
    leave(): void { send({ kind: 'leave' }); },
    dispose(): void { stopped = true; connected = false; if (retry) clearTimeout(retry); socket?.close(); socket = null; },
  };
}
export type ArenaNetwork = ReturnType<typeof createArenaNetwork>;
