import { z } from 'zod';
import { ARENA_ECONOMY as E, ARENA_LAYOUT, ARENA_PROTOCOL, ARENA_ROSTER_MAX, ARENA_TUNING as T, FAR_EVERY, MID_EVERY, SHIP_CLASSES, applyFeed, copyFlight, createFlightState, createPilot,
  decodeArenaSnapshot, predictPilot, sameSide, stepFeedEffects, stepPredictedTracers, unpackFar, unpackPilot, unpackRemote, type ArenaIntent, type ArenaSnapshot,
  type ArenaWorld, type Pilot, type ShipClass, type SteeringSettings, type Tactic } from '@astera/rules/arena';
import { createIdempotencyKey } from '../api/client.js';
import { sortieSchema, type SortieReport } from './hangarDesk.js';
import { absorbCorrection, createCorrection } from './smoothing.js';
import { arenaSocketUrl } from './origin.js';

const rosterRow = z.object({ id: z.number().int().nonnegative(), name: z.string().max(32), ship: z.enum(SHIP_CLASSES),
  /** Y6b: the ship's level; a row without one is level one (a bot). */
  level: z.number().int().min(1).max(20).optional(),
  clanId: z.string().uuid().nullable().optional(), teamId: z.string().uuid().optional(),
  role: z.enum(['hunter', 'miner', 'patrol']).optional(),
  kills: z.number().int().nonnegative().optional(), deaths: z.number().int().nonnegative().optional(),
  /** An illusion's pilot (Y4d): it wears that pilot's name and class, never ranks, and the radar leaves it out. */
  copyOf: z.number().int().nonnegative().optional(),
  /** The line the copy mirrors its pilot about: where it was cast, then the heading. */
  mirror: z.array(z.number().finite()).length(6).optional() });
const rosterSchema = z.array(rosterRow).max(ARENA_ROSTER_MAX);
const NO_MIRROR: readonly number[] = [0, 0, 0, 0, 0, 0];
export interface Standing { id: number; name: string; kills: number; deaths: number; self: boolean }

/** Room standings, the fight's own record (no points, owner 2026-11-25): kills, then fewer deaths, then name. Bots never rank. */
export function rankStandings(pilots: readonly z.infer<typeof rosterRow>[], selfId: number): Standing[] {
  return pilots.filter(p => !p.role && p.copyOf === undefined)
    .map(p => ({ id: p.id, name: p.name, kills: p.kills ?? 0, deaths: p.deaths ?? 0, self: p.id === selfId }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));
}
/** The Yarık's window as the room tells it (protocol 20): milliseconds from the moment it was sent. */
const riftBody = { open: z.boolean(), closesIn: z.number().nonnegative().nullable(), deadlineIn: z.number().nonnegative().nullable() };
const lowMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('welcome'), v: z.literal(ARENA_PROTOCOL), pilotId: z.number().int().positive(),
    tick: z.number().int().nonnegative(), seq: z.number().int().nonnegative(), tickRate: z.literal(30),
    snapshotRate: z.literal(15), layoutVersion: z.literal(ARENA_LAYOUT.version), pilots: rosterSchema, teamId: z.string().uuid().optional(),
    /** Protocol 18 (G16): whether the Asteryum Fırtınası blows in the room. */
    storm: z.boolean(),
    /** Protocol 20 (owner 2026-11-27): the Yarık's window. */
    rift: z.object(riftBody).optional() }),
  z.object({ kind: z.literal('storm'), active: z.boolean() }),
  z.object({ kind: z.literal('rift'), ...riftBody }),
  z.object({ kind: z.literal('roster'), pilots: rosterSchema }),
  z.object({ kind: z.literal('pong'), t: z.number().finite(), serverTimeMs: z.number().finite() }),
  z.object({ kind: z.literal('kick'), reason: z.string().max(32) }),
  sortieSchema,
]);
/** The Yarık's window on this page's own clock (`Date.now()`), set from the room's milliseconds as they arrive. */
export interface RiftState { open: boolean; closesAt: number | null; deadline: number | null }
const riftOn = (body: { open: boolean; closesIn: number | null; deadlineIn: number | null }): RiftState => {
  const now = Date.now();
  return { open: body.open, closesAt: body.closesIn === null ? null : now + body.closesIn, deadline: body.deadlineIn === null ? null : now + body.deadlineIn };
};

/**
 * While the Yarık is closing, when every ship still inside is lost; otherwise null. Past the close the grace is the
 * rule's, not the room's word: the room reads the calendar only every 5 s.
 */
export function riftDeadline(rift: RiftState | null, now: number): number | null {
  if (!rift) return null;
  const deadline = rift.open ? rift.closesAt !== null && now >= rift.closesAt ? rift.closesAt + E.riftGraceMinutes * 60_000 : null : rift.deadline;
  return deadline !== null && now < deadline ? deadline : null;
}
export interface NetworkStatus {
  phase: 'idle' | 'connecting' | 'online' | 'reconnecting' | 'failed'; rtt: number; pilots: number; reason: string;
  board: readonly Standing[];
  /** How the last real flight ended (Y6a): what reached the capital and when the ship is ready. */
  sortie: SortieReport | null;
  teamId: string | null; watching: number | null; received: boolean;
  /** The Asteryum Fırtınası blows in the room (G16): from the welcome, then from each `storm` turn. */
  storm: boolean;
  /** The Yarık's window (owner 2026-11-27): from the welcome, then from each `rift` turn; null until told. */
  rift: RiftState | null;
}
interface Pending { seq: number; input: ArenaIntent }
const AIM_HORIZON_MAX = 0.6;
/** A spare socket is replaced before the room's 5 s wait for a hello runs out; the launch screen keeps one this long. */
const WARM_RENEW_MS = 3_500;
const WARM_FOR_MS = 2 * 60_000;
/** One received pose of another ship: both row kinds start id, x, y, z, qx, qy, qz, qw, speed. */
interface Sample { tick: number; row: readonly number[] }
interface Remote {
  pilot: Pilot; previous: ReturnType<typeof createFlightState>; step: number;
  /** Its newest row and tier; its last few poses, oldest first; the snapshot tick it was last in. */
  row: readonly number[]; tier: Tier; samples: Sample[]; seen: number;
}
type Tier = 'near' | 'mid' | 'far';
/** Ticks between the rows of a tier: a ship missing for that long, or from a snapshot due to carry it, is gone. */
const TIER_EVERY: Record<Tier, number> = { near: T.tickRate / T.snapshotRate, mid: MID_EVERY, far: FAR_EVERY };

/**
 * Where a ship is drawn at `tick` (interpDelay behind the newest snapshot): between the two of its
 * own samples around it, so a far ship sampled at 5 Hz moves as smoothly as a near one; past its
 * newest sample, flown on along its heading for at most `cap` ticks.
 */
function poseAt(samples: readonly Sample[], tick: number, cap: number, out: Pilot): void {
  const b = samples.findIndex(sample => sample.tick >= tick);
  const newest = samples[samples.length - 1];
  if (!newest) return;
  const at = (row: readonly number[], i: number, fallback = 0): number => row[i] ?? fallback;
  if (b < 0) {
    const r = newest.row; const ahead = Math.min(cap, tick - newest.tick) / T.tickRate * at(r, 8);
    const qx = at(r, 4); const qy = at(r, 5); const qz = at(r, 6); const qw = at(r, 7, 1);
    out.p.x = at(r, 1) + 2 * (qx * qz + qw * qy) * ahead; out.p.y = at(r, 2) + 2 * (qy * qz - qw * qx) * ahead;
    out.p.z = at(r, 3) + (1 - 2 * (qx * qx + qy * qy)) * ahead;
    out.q.x = qx; out.q.y = qy; out.q.z = qz; out.q.w = qw;
    return;
  }
  const second = samples[b] ?? newest; const first = b > 0 ? samples[b - 1] ?? second : second;
  const span = second.tick - first.tick;
  const alpha = span > 0 ? Math.max(0, Math.min(1, (tick - first.tick) / span)) : 1;
  const p = first.row; const c = second.row;
  out.p.x = at(p, 1) + (at(c, 1) - at(p, 1)) * alpha; out.p.y = at(p, 2) + (at(c, 2) - at(p, 2)) * alpha;
  out.p.z = at(p, 3) + (at(c, 3) - at(p, 3)) * alpha;
  const sign = at(p, 4) * at(c, 4) + at(p, 5) * at(c, 5) + at(p, 6) * at(c, 6) + at(p, 7, 1) * at(c, 7, 1) < 0 ? -1 : 1;
  out.q.x = at(p, 4) * (1 - alpha) + at(c, 4) * alpha * sign; out.q.y = at(p, 5) * (1 - alpha) + at(c, 5) * alpha * sign;
  out.q.z = at(p, 6) * (1 - alpha) + at(c, 6) * alpha * sign; out.q.w = at(p, 7, 1) * (1 - alpha) + at(c, 7, 1) * alpha * sign;
  const norm = Math.hypot(out.q.x, out.q.y, out.q.z, out.q.w) || 1;
  out.q.x /= norm; out.q.y /= norm; out.q.z /= norm; out.q.w /= norm;
}

/** `credential` signs the hello with the player's session; without it the hello is a dev guest. */
export function createArenaNetwork(world: ArenaWorld, settings: SteeringSettings, onLost: () => void,
  credential?: () => Promise<string | null>) {
  const listeners = new Set<() => void>();
  let status: Readonly<NetworkStatus> = { phase: 'idle', rtt: 0, pilots: 0, reason: '', board: [], sortie: null, teamId: null, watching: null, received: false, storm: false, rift: null };
  let socket: WebSocket | null = null; let retry: ReturnType<typeof setTimeout> | null = null;
  let stopped = true; let welcomed = false; let connected = false; let attempts = 0; let seq = 0; let lastPing = 0;
  let settingSignature = ''; let lastSnapshot = -1; let lastSnapshotAt = 0;
  /** Server tick the other ships were last drawn at (interpolated); −1 before the first frame. */
  let viewTick = -1;
  const history: Pending[] = [];
  /**
   * Remote pilots by id, not by row: a ship that cloaks or leaves the AOI shifts every
   * row after it, and reusing objects by row drew each of those ships from another
   * ship's previous pose for a frame.
   */
  const remote = new Map<number, Remote>();
  /** A near ship missing from a snapshot is gone at once; a middle or far one once a snapshot of its tier passes without it. */
  const track = (snap: ArenaSnapshot): void => {
    const add = (row: readonly number[], tier: Tier): void => {
      const id = row[0] ?? 0;
      let entry = remote.get(id);
      if (!entry) { entry = { pilot: createPilot(id), previous: createFlightState(), step: -1, row, tier, samples: [], seen: snap.tick }; remote.set(id, entry); }
      entry.row = row; entry.tier = tier; entry.seen = snap.tick;
      entry.samples.push({ tick: snap.tick, row }); if (entry.samples.length > 4) entry.samples.shift();
    };
    for (const row of snap.others) add(row, 'near');
    for (const row of snap.mid) add(row, 'mid');
    for (const row of snap.far) add(row, 'far');
    for (const [id, entry] of remote) {
      if (entry.seen === snap.tick) continue;
      const every = TIER_EVERY[entry.tier];
      if (snap.key === 1 || snap.tick % every === 0 || snap.tick - entry.seen >= every) remote.delete(id);
    }
  };
  let interpolations = 0;
  const before = createFlightState(); const prior = createFlightState();
  /** What is left of the last reconcile on screen; the renderer adds it to our ship and lets it melt. */
  const correction = createCorrection();
  const names = new Map<number, string>();
  const roles = new Map<number, 'hunter' | 'miner' | 'patrol'>();
  /** Every ship's class and level by id, from the roster; our own come in our row. */
  const ships = new Map<number, ShipClass>(); const levels = new Map<number, number>();
  const clans = new Map<number, string>(); const teamIds = new Map<number, string>();
  /** Each illusion's pilot by the illusion's id, and the line it mirrors that pilot about. */
  const copies = new Map<number, number>(); const mirrors = new Map<number, readonly number[]>();
  /** The class this pilot's hello names: its next flight's. */
  let ship: ShipClass = 'kilavuz';
  let tactic: Tactic = 'smoke'; let tactic2: Tactic | null = null;
  let spectating = false;
  const guestKey = 'astera-arena-prototype-guest';
  let guest = sessionStorage.getItem(guestKey);
  if (!guest) { guest = createIdempotencyKey(); sessionStorage.setItem(guestKey, guest); }
  const notify = (patch: Partial<NetworkStatus>): void => { status = { ...status, ...patch }; for (const listener of listeners) listener(); };
  const send = (value: unknown): void => { if (socket?.readyState === WebSocket.OPEN && socket.bufferedAmount < 64000) socket.send(JSON.stringify(value)); };
  const roster = (pilots: z.infer<typeof rosterSchema>): void => {
    names.clear(); roles.clear(); ships.clear(); levels.clear(); copies.clear(); mirrors.clear(); clans.clear(); teamIds.clear();
    for (const p of pilots) {
      names.set(p.id, p.name); ships.set(p.id, p.ship); levels.set(p.id, p.level ?? 1); if (p.role) roles.set(p.id, p.role); if (p.copyOf !== undefined) copies.set(p.id, p.copyOf);
      if (p.mirror) mirrors.set(p.id, p.mirror);
      if (p.clanId) clans.set(p.id, p.clanId); if (p.teamId) teamIds.set(p.id, p.teamId);
    }
    world.pilot.clanId = clans.get(world.pilot.id) ?? null;
    notify({ pilots: pilots.filter(p => !p.role && p.copyOf === undefined).length, board: rankStandings(pilots, world.pilot.id) });
  };
  const receive = (snap: ArenaSnapshot): void => {
    if (snap.tick < lastSnapshot) return;
    lastSnapshot = snap.tick;
    copyFlight(before, world.pilot); copyFlight(prior, world.previous);
    unpackPilot(snap.self, world.pilot); world.tick = snap.tick; world.shots = world.pilot.shots;
    const watching = snap.watching === undefined || snap.watching < 0 ? null : snap.watching;
    if (!status.received || status.watching !== watching) notify({ received: true, watching });
    while (history[0] && history[0].seq <= snap.ack) history.shift();
    for (const pending of history) predictPilot(world, pending.input, settings);
    // The replay overwrote the interpolation start; restore it, then fold the difference
    // into the on-screen correction so nothing jumps. Teleports snap.
    copyFlight(world.previous, prior);
    absorbCorrection(correction, world.previous, before, world.pilot);
    // Bullets, smoke, impacts, cargo and crystals: what changed since the last snapshot, or a key frame.
    applyFeed(world, snap);
    // The ships our own sweep marks (Y4d): the room sends them wherever they are; the HUD reads them as the sandbox's.
    world.scans = snap.scan.length > 0 ? [{ owner: world.pilot.id, ticks: 1, targets: snap.scan }] : [];
    track(snap); lastSnapshotAt = performance.now();
  };
  /**
   * A SOCKET OPENED AHEAD (owner 2026-11-26: entering Yarık waited a moment on "Connecting…").
   * Opening one costs 200–300 ms through Cloudflare (TCP, TLS, upgrade) and began with the launch
   * press; on the launch screen one is kept open, so the press only sends the hello. The room
   * closes a socket that names nobody after 5 s: the spare is replaced every WARM_RENEW_MS, and
   * the launch screen keeps one for WARM_FOR_MS at most.
   */
  let spare: WebSocket | null = null; let warming: ReturnType<typeof setTimeout> | null = null; let warmUntil = 0;
  const dropSpare = (): void => { const idle = spare; spare = null; if (idle) { idle.onclose = null; idle.close(); } };
  const renewSpare = (): void => {
    dropSpare(); warming = null;
    if (socket || Date.now() >= warmUntil) return;
    const next = new WebSocket(arenaSocketUrl());
    next.onclose = () => { if (spare === next) spare = null; };
    spare = next; warming = setTimeout(renewSpare, WARM_RENEW_MS);
  };
  const cool = (): void => { if (warming) clearTimeout(warming); warming = null; dropSpare(); };
  /** The spare if it is opening or open; it becomes the flight's socket. */
  const takeSpare = (): WebSocket | null => {
    const ready = spare && spare.readyState <= WebSocket.OPEN ? spare : null;
    if (warming) clearTimeout(warming);
    warming = null; spare = null;
    return ready;
  };
  const open = (): void => {
    if (stopped) return;
    notify({ phase: welcomed ? 'reconnecting' : 'connecting', reason: '' });
    const ahead = takeSpare(); if (!ahead) dropSpare();
    const connection = ahead ?? new WebSocket(arenaSocketUrl());
    socket = connection;
    // A socket the page's CSP refuses is closed at once and fires no close event; close() then does
    // nothing, so the timeout runs the close path itself, once (2026-11-26, Yarık in the app).
    let ended = false;
    const timeout = setTimeout(() => {
      if (connected) return;
      if (connection.readyState === WebSocket.CLOSED) lost(); else connection.close();
    }, 5000);
    const greet = (): void => {
      const hello = { kind: 'hello', v: ARENA_PROTOCOL, guestId: guest, mode: welcomed ? 'resume' : spectating ? 'spectate' : 'enter', ship, tactic, tactic2 };
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
        settingSignature = ''; history.length = 0; remote.clear(); lastSnapshot = -1; viewTick = -1;
        world.pilot.id = msg.pilotId; notify({ phase: 'online', reason: '', teamId: msg.teamId ?? null, storm: msg.storm, rift: msg.rift ? riftOn(msg.rift) : null }); roster(msg.pilots);
      } else if (msg.kind === 'roster') roster(msg.pilots);
      else if (msg.kind === 'storm') notify({ storm: msg.active });
      else if (msg.kind === 'rift') notify({ rift: riftOn(msg) });
      else if (msg.kind === 'pong') notify({ rtt: Math.round(performance.now() - msg.t) });
      else if (msg.kind === 'sortie') notify({ sortie: { outcome: msg.outcome, deposit: msg.deposit, overflow: msg.overflow, readyAt: msg.readyAt,
        readyReason: msg.readyReason, xp: msg.xp, ...(msg.asterium ? { asterium: msg.asterium } : {}), ...(msg.teamId ? { teamId: msg.teamId } : {}) } });
      else { stopped = true; connected = false; notify({ phase: 'failed', reason: msg.reason }); connection.close(); }
    };
    const lost = (): void => {
      if (ended) return; ended = true;
      clearTimeout(timeout); if (socket !== connection) return;
      connected = false; onLost();
      if (stopped) return;
      if (++attempts > 15) { notify({ phase: 'failed', reason: 'connection' }); return; }
      notify({ phase: 'reconnecting' }); retry = setTimeout(open, 1000);
    };
    connection.onclose = lost;
    connection.onerror = () => { /* Close owns recovery, avoiding duplicate connections. */ };
    if (connection.readyState === WebSocket.OPEN) greet(); else connection.onopen = greet;
  };
  const drawn: Remote[] = [];
  const interpolate = (at: number): void => {
    if (lastSnapshot < 0) return;
    const targetTick = lastSnapshot + (at - lastSnapshotAt) / 1000 * T.tickRate - T.interpDelay * T.tickRate;
    viewTick = targetTick;
    const step = ++interpolations;
    const me = world.pilot.p;
    drawn.length = 0;
    for (const entry of remote.values()) {
      const { pilot, previous } = entry;
      // Seen last step: its last pose is the start of this one. New or back in view: no motion from a stale pose.
      const continuous = entry.step === step - 1;
      copyFlight(previous, pilot);
      if (entry.tier === 'far') unpackFar(entry.row, pilot); else unpackRemote(entry.row, pilot);
      // A ship in before the roster that names it is drawn as the Kılavuz until the roster comes.
      pilot.ship = ships.get(pilot.id) ?? 'kilavuz'; pilot.level = levels.get(pilot.id) ?? 1; pilot.decoyOf = copies.get(pilot.id) ?? -1;
      pilot.clanId = clans.get(pilot.id) ?? null;
      const line = mirrors.get(pilot.id) ?? NO_MIRROR;
      pilot.decoyFrom.x = line[0] ?? 0; pilot.decoyFrom.y = line[1] ?? 0; pilot.decoyFrom.z = line[2] ?? 0;
      pilot.decoyAlong.x = line[3] ?? 0; pilot.decoyAlong.y = line[4] ?? 0; pilot.decoyAlong.z = line[5] ?? 0;
      poseAt(entry.samples, targetTick, entry.tier === 'far' ? FAR_EVERY : T.extrapolationCap * T.tickRate, pilot);
      entry.step = step;
      if (!continuous) copyFlight(previous, pilot);
      drawn.push(entry);
    }
    // Nearest first, as the room sent them: the HUD marks the first few.
    const d2 = (p: Pilot): number => (p.p.x - me.x) ** 2 + (p.p.y - me.y) ** 2 + (p.p.z - me.z) ** 2;
    // Friends retain their HUD slots even when a dozen closer rivals fill the room.
    drawn.sort((a, b) => Number(sameSide(world.pilot, b.pilot)) - Number(sameSide(world.pilot, a.pilot)) || d2(a.pilot) - d2(b.pilot));
    world.drones.length = 0; world.dronePrevious.length = 0;
    for (const entry of drawn) { world.drones.push(entry.pilot); world.dronePrevious.push(entry.previous); }
  };
  return {
    names, roles, correction, teamIds,
    getSnapshot: (): Readonly<NetworkStatus> => status,
    subscribe: (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Into the room in `next` with the B slot `nextTactic`: what the hello names. */
    // A flight from the hangar always enters afresh: the room reattaches a ship still in the air.
    connect(next: ShipClass, nextTactic: Tactic, observer = false, second: Tactic | null = null): void {
      ship = next; tactic = nextTactic; tactic2 = second; spectating = observer; stopped = false; attempts = 0; welcomed = false; notify({ sortie: null, teamId: null, watching: null, received: false });
      if (retry) clearTimeout(retry); if (socket) socket.close(); connected = false; open();
    },
    /** On the launch screen: keep a socket open ahead, so the launch only sends the hello. Not while a flight is up. */
    warm(): void { if (warming || socket) return; warmUntil = Date.now() + WARM_FOR_MS; renewSpare(); },
    /** Off the launch screen: the spare closes. */
    cool,
    /** Back to the hangar after a flight: the link closes without asking the room for anything. */
    stop(): void { stopped = true; connected = false; if (retry) clearTimeout(retry); const closing = socket; socket = null; closing?.close(); notify({ phase: 'idle', reason: '', teamId: null, watching: null }); },
    get connected(): boolean { return connected; },
    /**
     * Seconds between the other ships as drawn and our own ship as predicted: interpolation
     * delay + RTT + input buffer, measured as ticks rather than estimated (KG-T16). A shot
     * fired now is simulated against where they are that far ahead. Capped so a stalled
     * link does not fling the lead mark across the screen.
     */
    aimHorizon(): number {
      if (viewTick < 0 || lastSnapshot < 0) return 0;
      return Math.max(0, Math.min(AIM_HORIZON_MAX, (lastSnapshot + history.length - viewTick) / T.tickRate));
    },
    step(source: ArenaIntent): void {
      if (!connected) return;
      const signature = `${String(settings.sensitivity)}:${String(settings.invertPitch)}`;
      if (signature !== settingSignature) { send({ kind: 'settings', ...settings }); settingSignature = signature; }
      const input: ArenaIntent = { ...source };
      const buttons = Number(input.fire) | Number(input.turbo) << 1 | Number(input.smoke) << 2 | Number(input.cloak) << 3 | Number(input.turboBurst) << 4
        | Number(input.land === true) << 5 | Number(input.signature === true) << 6 | Number(input.illusion === true) << 7 | Number(input.radar === true) << 8;
      send({ kind: 'in', values: [++seq, Math.round(input.steerX * 1000), Math.round(input.steerY * 1000), Math.round(input.throttle * 100), buttons,
        Math.round(input.assistX * 1000), Math.round(input.assistY * 1000), input.signature === true ? input.signatureTarget ?? -1 : -1] });
      history.push({ seq, input }); if (history.length > 128) history.shift();
      // Our tracers aim like the server's shot will: at the others moved forward by the horizon.
      world.aimHorizon = this.aimHorizon();
      predictPilot(world, input, settings);
      stepPredictedTracers(world);
      interpolate(performance.now());
      // Between snapshots the bullets fly and the smoke and impacts age as the room's do.
      stepFeedEffects(world);
      if (performance.now() - lastPing > 1000) { lastPing = performance.now(); send({ kind: 'ping', t: lastPing }); }
    },
    dev(action: 'restart' | 'exit' | 'fuel' | 'cargo' | 'position', value?: number, p?: { x: number; y: number; z: number }): void { send({ kind: 'dev', action, value, p }); },
    leave(): void { send({ kind: 'leave' }); },
    watch(pilotId: number): void { send({ kind: 'watch', pilotId }); },
    dispose(): void { cool(); stopped = true; connected = false; if (retry) clearTimeout(retry); socket?.close(); socket = null; },
  };
}
export type ArenaNetwork = ReturnType<typeof createArenaNetwork>;
