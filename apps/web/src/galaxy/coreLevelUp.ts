import { z } from 'zod';
import { coreTier, worldRadius } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';

/*
  THE COMMAND CORE LEVELS UP ON THE MAP (owner approved the lab look and its trigger, 2026-11-13).

  Since D153 a world's drawn size follows its exact Core level, which makes the Core the one building
  the galaxy can see finish. Gold light gathers onto the world, it flashes against a shock ring, rings
  run out across its plane and the world takes its step with a little spring. A level that crosses a
  tier (4, 7, 10 … 22 — the move that changes who you meet) is the bigger version with "Kademe N".

  WHEN: the queue's time runs out and the level is real — never on the button press, which only starts
  the build. On the map the light starts gathering early so the world steps exactly as the queue ends;
  a level that finished while the player was elsewhere plays on the next galaxy open. The player's own
  worlds only (owner: a rival's world just grows). Client only: the queue's absolute finish times, and
  a per-device record of the levels already shown.
*/

/** Seconds from the light starting to gather to the detonation. */
export const LEVEL_LANDS = 0.9;
/** A tier jump gathers for longer: it is the bigger moment. */
export const TIER_LANDS = 1.4;
/** Seconds after the detonation the world's spring takes to come to rest. */
export const GROW_SETTLE_S = 1.2;

/** An ordinary Core level, or one that crosses a tier. */
export type LevelKind = 'level' | 'tier';

export interface LevelFrame {
  /** 0..1 how far the light has gathered onto the world. */
  gather: number;
  /** The detonation's flash. */
  flash: number;
  /** 0..1 how far the rings have run out. */
  ring: number;
  /** 0..1 through the first shock ring. */
  disc: number;
  /** 0..1 through the second, later shock ring — a tier jump only. */
  disc2: number;
  /** 0 before the detonation, then over 1 and back: the world's way from its old size to its new. */
  step: number;
  /** The rim's glow. */
  glow: number;
  /** 0..1 the "Kademe N" word — a tier jump only. */
  label: number;
}

interface Profile {
  lands: number;
  flashDecay: number;
  ringSpan: number;
  discSpan: number;
  glowDecay: number;
  /** When the second shock leaves after the first, and how long it runs; null = none. */
  second: { after: number; span: number } | null;
  /** The word: in from, in over, out from, out over (seconds after the detonation); null = none. */
  word: { in: number; inSpan: number; out: number; outSpan: number } | null;
}

const PROFILE: Record<LevelKind, Profile> = {
  level: { lands: LEVEL_LANDS, flashDecay: 7, ringSpan: 1.6, discSpan: 0.8, glowDecay: 1.6, second: null, word: null },
  tier: {
    lands: TIER_LANDS, flashDecay: 4, ringSpan: 2.2, discSpan: 1, glowDecay: 1,
    second: { after: 0.25, span: 1.3 },
    word: { in: 0.15, inSpan: 0.35, out: 2.6, outSpan: 0.6 },
  },
};

const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));
const smooth = (x: number): number => x * x * (3 - 2 * x);
const QUIET: LevelFrame = { gather: 0, flash: 0, ring: 0, disc: 0, disc2: 0, step: 0, glow: 0, label: 0 };

/** Seconds from the gather to the light gathering for this kind of step. */
export const landsAfter = (kind: LevelKind): number => PROFILE[kind].lands;

/** Seconds until every part has run out and the world rests on its new size. */
export function levelLength(kind: LevelKind): number {
  const p = PROFILE[kind];
  const tail = Math.max(p.ringSpan, p.discSpan, GROW_SETTLE_S, p.second ? p.second.after + p.second.span : 0, p.word ? p.word.out + p.word.outSpan : 0);
  return p.lands + tail;
}

/** The world's spring from its old size (0) to its new (1), seconds after the detonation. */
const springStep = (s: number): number => (s < 0 ? 0 : 1 - Math.exp(-6 * s) * Math.cos(9 * s));

/** Light gathers, a ring detonates, the world takes its step with a little spring. */
export function levelFrame(seconds: number, kind: LevelKind = 'level'): LevelFrame {
  if (!Number.isFinite(seconds) || seconds < 0) return { ...QUIET };
  const p = PROFILE[kind];
  const t = seconds;
  const g = ramp(t, 0, p.lands);
  if (t < p.lands) return { ...QUIET, gather: g * g * g, glow: (kind === 'tier' ? 0.6 : 0.45) * g * g };
  const s = t - p.lands;
  return {
    gather: 1,
    flash: Math.exp(-p.flashDecay * s),
    ring: 1 - (1 - ramp(s, 0, p.ringSpan)) ** 2.4,
    disc: ramp(s, 0, p.discSpan),
    disc2: p.second ? ramp(s, p.second.after, p.second.span) : 0,
    step: springStep(s),
    glow: Math.exp(-p.glowDecay * s),
    label: p.word ? smooth(ramp(s, p.word.in, p.word.inSpan)) * (1 - smooth(ramp(s, p.word.out, p.word.outSpan))) : 0,
  };
}

/** One own world's Core: its level as last read, and when its queued Core upgrades finish (server ms). */
export interface CoreClock {
  id: string;
  level: number;
  finishes: readonly number[];
}

/**
 * Every own world's Core clock. Only an upgrade the server has timed and that is running counts: a
 * staged or just-tapped order has no finish yet, and a paused one's finish is not a promise.
 */
export function coreClocks(worlds: readonly PlanetView[]): CoreClock[] {
  return worlds.map((world) => ({
    id: world.planet.id,
    level: world.buildings.CORE ?? 0,
    finishes: (world.queues?.CONSTRUCTION ?? [])
      .flatMap((order) => order.kind === 'BUILDING' && order.subject === 'CORE' && order.finishesAt && !order.pausedAt
        ? [order.finishesAt.getTime()]
        : [])
      .sort((a, b) => a - b),
  }));
}

/** The Core's level at a server instant: every queued upgrade whose time has run out is built. */
export const coreLevelAt = (core: CoreClock, now: number): number =>
  core.level + core.finishes.filter((at) => at <= now).length;

/** A step that crosses a tier — the bigger moment. */
export const levelKind = (from: number, to: number): LevelKind => (coreTier(to) > coreTier(from) ? 'tier' : 'level');

/** One step to play: on which world, from and to which level, and when (server ms) the light starts. */
export interface LevelUp {
  id: string;
  from: number;
  to: number;
  kind: LevelKind;
  /** The tier reached, for the word. */
  tier: number;
  start: number;
}

const step = (id: string, from: number, to: number, start: number): LevelUp => ({
  id, from, to, kind: levelKind(from, to), tier: coreTier(to), start,
});

/**
 * The steps owed since this device last showed these worlds, played from now. A first look (null) owes
 * nothing — there is nothing to compare with — and neither does a world this device has never seen.
 */
export function owedLevelUps(cores: readonly CoreClock[], seen: ReadonlyMap<string, number> | null, now: number): LevelUp[] {
  if (seen === null) return [];
  return cores.flatMap((core) => {
    const shown = seen.get(core.id);
    const level = coreLevelAt(core, now);
    return shown !== undefined && level > shown ? [step(core.id, shown, level, now)] : [];
  });
}

/** The soonest queued upgrade still to finish, timed so its world steps exactly as its queue ends. */
export function nextLevelUp(cores: readonly CoreClock[], now: number): LevelUp | null {
  let next: LevelUp | null = null;
  for (const core of cores) {
    const finish = core.finishes.find((at) => at > now);
    if (finish === undefined) continue;
    const from = coreLevelAt(core, now);
    const kind = levelKind(from, from + 1);
    const candidate = step(core.id, from, from + 1, finish - landsAfter(kind) * 1000);
    if (next === null || candidate.start < next.start) next = candidate;
  }
  return next;
}

/**
 * What a look leaves remembered: every own world at its level now — lower too, so a rebuilt Core plays.
 * A step already played this visit counts at its new level even before its queue has run out (a live
 * step starts early), so closing the game before the map reads the new level does not owe it again.
 */
export const seenLevels = (cores: readonly CoreClock[], now: number, played: ReadonlyMap<string, number> = new Map()): Map<string, number> =>
  new Map(cores.map((core) => [core.id, Math.max(coreLevelAt(core, now), played.get(core.id) ?? -Infinity)]));

export const CORE_SEEN_KEY = 'astera.core.seen';
const stored = z.object({ self: z.string(), levels: z.record(z.string(), z.number().int()) });

/**
 * The Core levels this device has already shown this commander, or null for a first look. One record, for
 * the last commander seen here. Per device, in `localStorage`: a viewer's convenience, so a private window
 * or blocked storage simply never replays a level.
 */
export function readCoreSeen(self: string): Map<string, number> | null {
  try {
    const raw = localStorage.getItem(CORE_SEEN_KEY);
    if (raw === null) return null;
    const parsed = stored.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.self === self ? new Map(Object.entries(parsed.data.levels)) : null;
  } catch {
    return null;
  }
}

export function rememberCoreSeen(self: string, levels: ReadonlyMap<string, number>): void {
  try {
    localStorage.setItem(CORE_SEEN_KEY, JSON.stringify({ self, levels: Object.fromEntries(levels) }));
  } catch {
    // Storage blocked or full: the step has played for this visit.
  }
}

/**
 * THE WORLD'S DRAWN SIZE THROUGH ITS STEP.
 *
 * The map learns a Core level late: the server announces a world's new shape only when a tier is
 * crossed, and its public galaxy is cached for half a minute. So the step is drawn from the queue's own
 * clock: until the detonation the world keeps its old size (a level learned on open would otherwise
 * already be big while the light gathers), then springs to the new one and stays there until the map
 * catches up. Read by every drawn body of a world; one lookup in an empty map otherwise.
 */
interface Growth {
  from: number;
  to: number;
  /** The detonation, server ms. */
  at: number;
  /** The map's level when the step began: a change to it hands the world back to the map. */
  base: number;
}

const growing = new Map<string, Growth>();

export function beginGrowth(id: string, growth: Growth): void {
  growing.set(id, growth);
}

/** Tests and teardown only. */
export function resetGrowth(): void {
  growing.clear();
}

/** A drawn world. One without a Core level (a shop preview) is never mid-step. */
interface Sized { id: string; radius: number; coreLevel?: number }

/** How big a world is drawn now: the map's size, unless it is part-way through its step. */
export function drawnRadius(node: Sized, now: number): number {
  if (growing.size === 0) return node.radius;
  const growth = growing.get(node.id);
  if (!growth || node.coreLevel === undefined) return node.radius;
  // The map's own scale (a starter galaxy draws worlds smaller) carried through the step.
  const scale = node.radius / worldRadius(node.coreLevel);
  const from = worldRadius(growth.from);
  return (from + (worldRadius(growth.to) - from) * springStep((now - growth.at) / 1000)) * scale;
}

/** Is any world mid-step (from its start through the settle)? The field re-draws only then. */
export function growthMoving(now: number): boolean {
  if (growing.size === 0) return false;
  for (const growth of growing.values()) if (now < growth.at + GROW_SETTLE_S * 1000) return true;
  return false;
}

/** Hand worlds back to the map once settled and the map has caught up, or says otherwise, or is gone. */
export function pruneGrowth(nodes: readonly { id: string; coreLevel: number }[], now: number): void {
  if (growing.size === 0) return;
  for (const [id, growth] of growing) {
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node) { growing.delete(id); continue; }
    if (now < growth.at + GROW_SETTLE_S * 1000) continue;
    if (node.coreLevel >= growth.to || node.coreLevel !== growth.base) growing.delete(id);
  }
}
