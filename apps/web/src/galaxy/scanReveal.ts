import { z } from 'zod';
import { CLANMATE_COLOUR, pinColour } from './PlanetField.js';
import type { PlanetNode, Vec3Tuple } from './scene.js';

/*
  THE TELESCOPE FINDS OUT WHO HOLDS A HIDDEN WORLD (owner approved the lab scan, 2026-11-12). Owned
  worlds are hidden until found, so this is the payoff of curiosity, and it plays once per world: the
  first time the galaxy knows it. A world coming into a Telescope's reach is reached by a wave from
  those eyes, nearest first; a world a probe reached is swept where the probe stands. The client
  compares the galaxy with the worlds it has already shown (`readSeen`), so what became known while
  the player was away plays on the next open. Nothing on the server changes.
*/

/** Second of a world's own timeline at which the wave reaches it and its sweep starts. */
export const SCAN_ARRIVES = 0.9;
/** Second the sweep has crossed it and the reticle locks. */
export const SCAN_LOCKS = 2.1;
/** Second the world is left to its own look again. */
export const SCAN_ENDS = SCAN_LOCKS + 2.4;
/** A probe's worlds are swept one after another, this far apart. */
const IN_PLACE_FIRST = 0.35;
const IN_PLACE_STEP = 0.45;

export interface ScanFrame {
  /** The sweep band's height on the world, +1 top to −1 bottom. */
  sweep: number;
  band: number;
  /** The grid left behind the band. */
  grid: number;
  reticle: number;
  /** Reticle radius in world radii. */
  reticleSize: number;
  /** The holder's colour on the world, once known; it gives way to the world's own look. */
  reveal: number;
  /** The instant of the lock. */
  flash: number;
}

const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));
const QUIET: ScanFrame = { sweep: 1, band: 0, grid: 0, reticle: 0, reticleSize: 1.6, reveal: 0, flash: 0 };

/** One world's scan, by the second of its own timeline: the band sweeps, the reticle locks, the holder shows. */
export function scanFrame(seconds: number): ScanFrame {
  if (!Number.isFinite(seconds) || seconds < 0) return { ...QUIET };
  const t = seconds;
  const sweeping = t > SCAN_ARRIVES && t < SCAN_LOCKS;
  const close = ramp(t, SCAN_ARRIVES, SCAN_LOCKS - SCAN_ARRIVES);
  return {
    sweep: 1 - 2 * close,
    band: sweeping ? Math.sin(Math.PI * Math.min(1, close * 1.1 + 0.05)) ** 0.3 : 0,
    grid: ramp(t, SCAN_ARRIVES, 0.2) * (1 - ramp(t, SCAN_LOCKS, 0.9)),
    reticle: ramp(t, SCAN_ARRIVES, 0.25) * (1 - ramp(t, SCAN_LOCKS + 1.4, 0.6)),
    reticleSize: 1.6 - 0.3 * close ** 2 - (t >= SCAN_LOCKS ? 0.06 * Math.exp(-(t - SCAN_LOCKS) * 9) : 0),
    reveal: ramp(t, SCAN_LOCKS, 0.35) * (1 - ramp(t, SCAN_LOCKS + 1.6, 0.7)),
    flash: t >= SCAN_LOCKS ? Math.max(0, 1 - (t - SCAN_LOCKS) / 0.35) ** 2 : 0,
  };
}

/** The wave by its progress, 1 at its farthest world: its radius in reaches, and how bright. */
export function waveFrame(progress: number): { radius: number; alpha: number } {
  if (!Number.isFinite(progress) || progress < 0) return { radius: 0, alpha: 0 };
  return { radius: progress, alpha: Math.min(1, progress * 4) * Math.max(0, 1 - Math.max(0, progress - 1) / 0.5) };
}

/** Worlds known now that were never shown. A first look (`seen` null) shows nothing: no device replays the map. */
export function freshlyKnown(nodes: readonly PlanetNode[], seen: ReadonlySet<string> | null): PlanetNode[] {
  if (!seen) return [];
  return nodes.filter((node) => node.intel !== 'UNKNOWN' && !node.isOwned && node.body === undefined && !seen.has(node.id));
}

/** Every world ever known here, including one that has gone dark again, so none is shown twice. */
export function knownIds(nodes: readonly PlanetNode[], seen: ReadonlySet<string> | null): Set<string> {
  const ids = new Set(seen);
  for (const node of nodes) if (node.intel !== 'UNKNOWN') ids.add(node.id);
  return ids;
}

/** One world's eyes in the scene's units. */
export interface ScanEye { at: Vec3Tuple; reach: number }
/** A wave leaving `at`: it reaches its farthest world, `reach` away, after `travel` seconds. */
export interface ScanWave { at: Vec3Tuple; reach: number; travel: number }
/** A world to sweep, and the second (from the plan's start) its sweep begins. */
export interface ScanTarget { id: string; at: Vec3Tuple; radius: number; tone: string; start: number }
export interface ScanPlan { waves: ScanWave[]; targets: ScanTarget[] }

const gap = (p: Vec3Tuple, q: Vec3Tuple): number => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const nearest = (to: Vec3Tuple, from: readonly Vec3Tuple[]): Vec3Tuple | null =>
  from.reduce<Vec3Tuple | null>((best, at) => (best === null || gap(at, to) < gap(best, to) ? at : best), null);
/** The colour of the world's own pin, so the lock says who holds it in the map's own words. */
const toneOf = (node: PlanetNode): string => (node.isClanmate ? CLANMATE_COLOUR : pinColour(node.kind));

/**
 * Where each newly known world is reached from, and when. A live reading came from the nearest eyes
 * whose reach holds it, or the nearest own world when the client knows of none; a probe's record is
 * swept where it stands. A wave takes the lab's 0.9 s to its farthest world, up to twice that for many.
 */
export function planScan(fresh: readonly PlanetNode[], nodes: readonly PlanetNode[], eyes: readonly ScanEye[]): ScanPlan {
  const owned = nodes.filter((node) => node.isOwned).map((node) => node.position);
  const groups = new Map<string, { at: Vec3Tuple; worlds: { node: PlanetNode; distance: number }[] }>();
  const inPlace: PlanetNode[] = [];
  for (const node of fresh) {
    const from = node.intel !== 'RESOLVED' ? null
      : nearest(node.position, eyes.filter((eye) => gap(eye.at, node.position) <= eye.reach).map((eye) => eye.at)) ?? nearest(node.position, owned);
    if (!from) { inPlace.push(node); continue; }
    const key = from.join(',');
    const group = groups.get(key) ?? { at: from, worlds: [] };
    group.worlds.push({ node, distance: gap(from, node.position) });
    groups.set(key, group);
  }
  const target = (node: PlanetNode, start: number): ScanTarget => ({ id: node.id, at: node.position, radius: node.radius, tone: toneOf(node), start });
  const waves: ScanWave[] = [];
  const targets: ScanTarget[] = [];
  for (const { at, worlds } of groups.values()) {
    const reach = Math.max(...worlds.map((world) => world.distance));
    const travel = SCAN_ARRIVES * (1 + Math.min(1, (worlds.length - 1) / 6));
    waves.push({ at, reach, travel });
    for (const { node, distance } of worlds) targets.push(target(node, reach > 0 ? (travel * distance) / reach : travel));
  }
  const fromHome = (node: PlanetNode): number => { const home = nearest(node.position, owned); return home ? gap(home, node.position) : 0; };
  [...inPlace].sort((a, b) => fromHome(a) - fromHome(b)).forEach((node, i) => { targets.push(target(node, IN_PLACE_FIRST + IN_PLACE_STEP * i)); });
  return { waves, targets };
}

/** How long the whole moment runs, from its first frame. */
export function scanLength(plan: ScanPlan): number {
  return Math.max(0, ...plan.targets.map((item) => item.start + SCAN_ENDS - SCAN_ARRIVES), ...plan.waves.map((wave) => wave.travel * 1.5));
}

export const SCAN_SEEN_KEY = 'astera.scan.seen';
const stored = z.object({ self: z.string(), ids: z.array(z.string()) });

/**
 * The worlds this device has already shown this commander, or null for a first look. One record, for
 * the last commander seen here, so it never grows past one galaxy. Per device, in `localStorage`: a
 * viewer's convenience, and a private window or blocked storage simply never replays anything.
 */
export function readSeen(self: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(SCAN_SEEN_KEY);
    if (raw === null) return null;
    const parsed = stored.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.self === self ? new Set(parsed.data.ids) : null;
  } catch {
    return null;
  }
}

export function rememberSeen(self: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(SCAN_SEEN_KEY, JSON.stringify({ self, ids: [...ids] }));
  } catch {
    // Storage blocked or full: the scan has played for this visit.
  }
}
