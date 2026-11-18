import type { VesselSystem } from '@astera/rules';
import { useSyncExternalStore } from 'react';
import type { Focus } from '../../galaxy/FocusPanel.js';
import type { SoundCue } from '../../lib/sound.js';

/**
 * THE DIRECTOR (plan 2026-11-18 §4 İ3, Faz 5.1). A first-time moment is shown before it is asked
 * for: a few short shots, letterboxed, each holding the screen for three seconds at most and ended
 * by a tap (owner 2026-11-07: never more than ten seconds without the player's hand). A scene plays
 * once for a ship, on any visit; while one plays, the next waits its turn.
 */
export const SHOT_MAX_MS = 8000;
/** A shot held on work under way never outstays this, whatever the work (owner 2026-11-18: the yard's 30 s). */
export const HOLD_MAX_MS = 45_000;
/**
 * How long a scene keeps while the sky is out of sight (a page open over it). Owner 2026-11-18: moments
 * long past played in a burst on the way back; a short look away still comes back to its moment.
 */
export const SCENE_WAIT_MS = 20_000;

/** What a shot looks at. The galaxy turns it into a place (`shotPose`). */
export type ShotTarget =
  /** The whole ship, swung round by `turn` radians on the way. */
  | { kind: 'ship'; turn?: number }
  /** One system on the hull, close. */
  | { kind: 'bay'; system: VesselSystem }
  /** Pulled far back: the ship alone in the dark. */
  | { kind: 'wide'; range?: number }
  /** Something out in the galaxy, without opening it. */
  | { kind: 'subject'; focus: Focus; range?: number };

type RepairLine = `starter.director.repair.${'work' | 'REFINERY' | 'EXTRACTOR' | 'TELESCOPE' | 'RADAR' | 'SURVEY' | 'SHIPYARD'}`;
/** What a shot may say: the director's own lines (`starter.director`). */
export type DirectorLine = 'starter.director.shipReport.orbit' | 'starter.director.shipReport.goal' | RepairLine
  | 'starter.director.hull.PATCHED' | 'starter.director.hull.RENEWED' | 'starter.director.dark' | 'starter.director.field' | 'starter.director.rock' | 'starter.director.contact'
  | 'starter.director.probe' | 'starter.director.yardNeed' | 'starter.director.firstShips'
  | 'starter.director.report2.round' | 'starter.director.report2.drive' | 'starter.director.report2.ready';

export interface Beat {
  id: string;
  shot: ShotTarget;
  ms: number;
  /** An i18n key, spoken on the letterbox, and what it names. */
  line?: DirectorLine;
  vars?: Readonly<Record<string, string | number>>;
  sound?: SoundCue;
  /** Systems named on the hull during the shot. */
  tags?: readonly VesselSystem[];
  /** What the moment took from the stores, shown under the line: the stores' own art and a minus. */
  spend?: Readonly<Record<SpentResource, number>>;
  /** Work under way: the shot holds until this moment (ms since the epoch), the time left said on the band. */
  until?: number;
  /** Gives way at once to a scene asked while it plays (the work shown done takes over from the work). */
  yields?: boolean;
}

export type SpentResource = 'alloy' | 'crystal' | 'deuterium';

export interface Scene {
  id: string;
  once: boolean;
  beats: readonly Beat[];
  /** Seen however long it waited out of sight (the ship's reports). */
  keep?: boolean;
  /** Its moment has gone (the repair is done, the yard ordered): it is let go unplayed. */
  stale?: () => boolean;
}

export interface Playing { scene: Scene; beat: Beat; index: number; vesselId: string; key: number }

const MEMORY = (vesselId: string): string => `astera.director.${vesselId}`;

function played(vesselId: string): string[] {
  try {
    const raw = window.localStorage.getItem(MEMORY(vesselId));
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function remember(vesselId: string, sceneId: string): void {
  try {
    window.localStorage.setItem(MEMORY(vesselId), JSON.stringify([...new Set([...played(vesselId), sceneId])]));
  } catch { /* This visit still remembers it: the scene is no longer queued. */ }
}

interface Waiting { scene: Scene; vesselId: string; askedAt: number }

let now: Playing | null = null;
let nowAskedAt = 0;
let queue: Waiting[] = [];
let counter = 0;
let stages = 0;
/** When the sky was last lost with something still to show: the wait of what began in sight counts from here. */
let lostAt: number | null = null;
const listeners = new Set<() => void>();
const notify = (): void => { listeners.forEach(listener => { listener(); }); };
const watch = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const shotMs = (beat: Beat): number => (beat.until === undefined
  ? Math.min(beat.ms, SHOT_MAX_MS)
  : Math.min(Math.max(beat.ms, beat.until - Date.now()), HOLD_MAX_MS));

function start(scene: Scene, vesselId: string, index: number, askedAt: number): void {
  const beat = scene.beats[index];
  if (!beat) { now = null; return; }
  counter += 1;
  nowAskedAt = askedAt;
  now = { scene, beat: { ...beat, ms: shotMs(beat) }, index, vesselId, key: counter };
}

/** The next scene still worth showing; one whose moment has gone is let go. */
function next(): void {
  let waiting = queue.shift();
  while (waiting?.scene.stale?.() === true) waiting = queue.shift();
  if (waiting) start(waiting.scene, waiting.vesselId, 0, waiting.askedAt);
  else now = null;
}

/** Out of sight past its keep, or past its moment: not shown now, nor ever (it is remembered as asked). */
function outlived(scene: Scene, askedAt: number, at: number): boolean {
  if (scene.stale?.() === true) return true;
  if (scene.keep === true) return false;
  return at - Math.max(askedAt, lostAt ?? askedAt) > SCENE_WAIT_MS;
}

/** Ask for a scene. A scene already played for this ship, playing or waiting, asks for nothing. */
/** Plays the scene, or queues it behind the one playing; false when it has been or is being shown already. */
export function playScene(scene: Scene, vesselId: string): boolean {
  if (scene.beats.length === 0) return false;
  if (scene.once && played(vesselId).includes(scene.id)) return false;
  if (now?.scene.id === scene.id || queue.some(waiting => waiting.scene.id === scene.id)) return false;
  // Remembered as it is asked for: a scene cut short by a closed app is not owed again.
  if (scene.once) remember(vesselId, scene.id);
  const askedAt = Date.now();
  if (!now) start(scene, vesselId, 0, askedAt);
  else {
    queue.push({ scene, vesselId, askedAt });
    // Work under way gives way to what it was waiting for (owner 2026-11-18: no cut away between them).
    if (now.beat.yields === true && now.index + 1 >= now.scene.beats.length) next();
  }
  notify();
  return true;
}

/** The shot has run, or a tap ended it. */
export function skipBeat(): void {
  if (!now) return;
  if (now.index + 1 < now.scene.beats.length) start(now.scene, now.vesselId, now.index + 1, nowAskedAt);
  else next();
  notify();
}

/** Whether a scene has played for this ship (a beat that depends on it can wait). */
export const scenePlayedFor = (vesselId: string, sceneId: string): boolean => played(vesselId).includes(sceneId);

/** Tests and a closed session: nothing plays, nothing waits. */
export function resetDirector({ keepMemory = false }: { keepMemory?: boolean } = {}): void {
  now = null;
  queue = [];
  lostAt = null;
  if (!keepMemory) {
    try {
      Object.keys(window.localStorage).filter(key => key.startsWith('astera.director.')).forEach(key => { window.localStorage.removeItem(key); });
    } catch { /* Nothing to forget. */ }
  }
  notify();
}

export const directorNow = (): Playing | null => now;

export const useDirector = (): Playing | null => useSyncExternalStore(watch, directorNow);

/**
 * The letterbox is mounted over the sky; the returned function takes it down. Coming back, whatever
 * waited out of sight too long, or past its moment, is let go first.
 */
export function raiseStage(): () => void {
  stages += 1;
  if (stages === 1) {
    const at = Date.now();
    queue = queue.filter(waiting => !outlived(waiting.scene, waiting.askedAt, at));
    if (now && outlived(now.scene, nowAskedAt, at)) next();
    lostAt = null;
  }
  notify();
  return () => {
    stages -= 1;
    if (stages === 0 && (now !== null || queue.length > 0)) lostAt = Date.now();
    notify();
  };
}
const onScreen = (): boolean => now !== null && stages > 0;
/**
 * A scene is on the screen, and what would speak over it waits. One waiting for the sky (a page is
 * open over it) holds nothing back (isolated player test 2026-11-18: the guide waited for a scene that
 * waited for the ship's page to close, and left the player there with no hand on the next repair).
 */
export const useDirecting = (): boolean => useSyncExternalStore(watch, onScreen);
