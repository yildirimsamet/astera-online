import { z } from 'zod';
import { PROBE_DEFENCE, type Vec3 } from '@astera/rules';
import type { IntelView, TrafficView } from '../api/schemas.js';

/*
  A PROBE SHOT DOWN, IN THE GALAXY (2026-11-24, `docs/sonda-bataryasi-plani-2026-11-24.md` §4).
  The battery opens fire while the probe is still coming in (`fireLeadSeconds` before the hit,
  owner playtest 2026-11-25); the craft flies on toward the point as the rounds climb to it, the
  last round meets it there, it breaks into fragments and its engine goes out. It plays once per shot, for the sender (a probe
  lost), for the holder (their battery firing) and for a Telescope that identifies the world (a
  witness, from the traffic read). A shot from while they were away plays on the next open, inside
  a window. The two sides read it from `/api/intel`, a witness from `/api/galaxy/traffic`.
*/

/** Rounds in one burst; the last reaches the craft at the impact. */
export const SHOT_ROUNDS = 4;
/** Second the rounds reach the craft and it breaks, counted from the battery opening fire. */
export const SHOT_IMPACT = PROBE_DEFENCE.fireLeadSeconds;
/** Second the moment is over. */
export const SHOT_ENDS = SHOT_IMPACT + 2.55;
/** A shot older than this is news for the intel centre, not the map. */
export const SHOT_WINDOW_MINUTES = 30;
/** The battery turning onto the craft before its first round. */
const FIRST_ROUND = 0.25;
/** One round's climb from the surface to the craft: long enough to be followed by eye. */
const ROUND_FLIGHT = 0.45;
const ROUND_GAP = (SHOT_IMPACT - FIRST_ROUND - ROUND_FLIGHT) / (SHOT_ROUNDS - 1);
/** A screen that hears late still sees at least this much of the burst. */
const CATCH_UP = 1.1;

/**
 * THE SECOND OF ITS OWN TIMELINE A SHOT OPENS ON when this screen first hears of it. In step with
 * the server's clock, so the craft the moment draws is where the flight was drawn; a late screen
 * still gets the last rounds reaching the craft. A witness has no fire clock and plays it whole.
 */
export function shotStartSecond(shot: { firedAt: number | null }, now: number): number {
  if (shot.firedAt === null) return 0;
  return Math.min(Math.max(0, (now - shot.firedAt) / 1000), SHOT_IMPACT - CATCH_UP);
}

/** How far the craft has come from where it was when the battery opened fire to the point: 0..1. */
export const craftProgress = (seconds: number): number => Math.min(1, Math.max(0, seconds / SHOT_IMPACT));

export interface ProbeShot {
  id: string;
  planetId: string;
  at: number;
  /** Where on the probe's approach it was hit, in game units; null from an older server. */
  point: Vec3 | null;
  /** When the battery opened fire (ms) and where the craft was then; null for a witness or an older server. */
  firedAt: number | null;
  from: Vec3 | null;
  /** Over one of the player's own worlds: their battery fired. Otherwise their probe was lost. */
  own: boolean;
  /** Someone else's shot, seen through the player's Telescope: no buzz in the hand. */
  witness: boolean;
}

/** Every shot the player's intel and traffic name, oldest first. */
export function shotsOf(intel: IntelView | undefined, traffic?: TrafficView): ProbeShot[] {
  const lost = (intel?.probeLosses ?? []).map((row) => ({
    id: `lost:${row.missionId}`, planetId: row.targetPlanetId, at: row.at.getTime(), point: row.point ?? null,
    firedAt: row.firedAt?.getTime() ?? null, from: row.from ?? null, own: false, witness: false,
  }));
  const fired = (intel?.probeShotsFired ?? []).map((row) => ({
    id: `fired:${row.id}`, planetId: row.planetId, at: row.at.getTime(), point: row.point,
    firedAt: row.firedAt?.getTime() ?? null, from: row.from ?? null, own: true, witness: false,
  }));
  const seen = (traffic?.probeShots ?? []).map((row) => ({
    id: `seen:${row.id}`, planetId: row.planetId, at: row.at.getTime(), point: null, firedAt: null, from: null, own: false, witness: true,
  }));
  return [...lost, ...fired, ...seen].sort((a, b) => a.at - b.at);
}

/** Shots never shown on this device, inside the window. A first look (`seen` null) shows nothing. */
export function freshShots(shots: readonly ProbeShot[], seen: ReadonlySet<string> | null, now: number): ProbeShot[] {
  if (!seen) return [];
  const since = now - SHOT_WINDOW_MINUTES * 60_000;
  return shots.filter((shot) => shot.at > since && !seen.has(shot.id));
}

export interface ShotFrame {
  /** The craft in orbit, its engine lit. */
  craft: number;
  /** The breakup's sparks, 0 before the impact and by their end. */
  burst: number;
  /** Fragments flying apart. */
  debris: number;
  /** The smoke the craft leaves. */
  smoke: number;
}

const QUIET: ShotFrame = { craft: 0, burst: 0, debris: 0, smoke: 0 };
const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));

/** One shot by the second of its own timeline. */
export function shotFrame(seconds: number): ShotFrame {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > SHOT_ENDS) return { ...QUIET };
  const t = seconds;
  const after = t - SHOT_IMPACT;
  if (after < 0) return { craft: 1, burst: 0, debris: 0, smoke: 0 };
  return {
    craft: 0,
    burst: Math.max(0, 1 - after / 0.9),
    debris: 1 - ramp(t, SHOT_ENDS - 0.8, 0.8),
    smoke: Math.sin(Math.PI * ramp(t, SHOT_IMPACT, SHOT_ENDS - SHOT_IMPACT)),
  };
}

/** Where round `index` is on its climb, 0 at the muzzle and 1 at the craft; null before it fires or after it lands. */
/** The second round `index` reaches the line the craft flies on. */
export const roundLandsAt = (index: number): number => FIRST_ROUND + index * ROUND_GAP + ROUND_FLIGHT;

export function roundProgress(index: number, seconds: number): number | null {
  const k = (seconds - FIRST_ROUND - index * ROUND_GAP) / ROUND_FLIGHT;
  return k < 0 || k > 1 + 1e-9 ? null : Math.min(1, k);
}

export const SHOT_SEEN_KEY = 'astera.probeShots.seen';
const stored = z.array(z.string());

/**
 * The shots this device has already shown this commander, or null for a first look. One
 * record per commander: two commanders on one browser must not reset each other's memory
 * (owner playtest, 2026-11-24).
 */
export function readShotSeen(self: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(`${SHOT_SEEN_KEY}:${self}`);
    if (raw === null) return null;
    const parsed = stored.safeParse(JSON.parse(raw));
    return parsed.success ? new Set(parsed.data) : null;
  } catch {
    return null;
  }
}

export function rememberShotSeen(self: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(`${SHOT_SEEN_KEY}:${self}`, JSON.stringify([...ids]));
  } catch {
    // Storage blocked or full: the shot has played for this visit.
  }
}
