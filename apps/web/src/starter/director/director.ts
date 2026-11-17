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
export const SHOT_MAX_MS = 3000;

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
  | 'starter.director.hull.PATCHED' | 'starter.director.hull.RENEWED' | 'starter.director.dark' | 'starter.director.field' | 'starter.director.rock' | 'starter.director.contact';

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
}

export interface Scene { id: string; once: boolean; beats: readonly Beat[] }

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

let now: Playing | null = null;
let queue: { scene: Scene; vesselId: string }[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const notify = (): void => { listeners.forEach(listener => { listener(); }); };
const watch = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function start(scene: Scene, vesselId: string, index: number): void {
  const beat = scene.beats[index];
  if (!beat) { now = null; return; }
  counter += 1;
  now = { scene, beat: { ...beat, ms: Math.min(beat.ms, SHOT_MAX_MS) }, index, vesselId, key: counter };
}

function next(): void {
  const waiting = queue.shift();
  if (waiting) start(waiting.scene, waiting.vesselId, 0);
  else now = null;
}

/** Ask for a scene. A scene already played for this ship, playing or waiting, asks for nothing. */
/** Plays the scene, or queues it behind the one playing; false when it has been or is being shown already. */
export function playScene(scene: Scene, vesselId: string): boolean {
  if (scene.beats.length === 0) return false;
  if (scene.once && played(vesselId).includes(scene.id)) return false;
  if (now?.scene.id === scene.id || queue.some(waiting => waiting.scene.id === scene.id)) return false;
  // Remembered as it is asked for: a scene cut short by a closed app is not owed again.
  if (scene.once) remember(vesselId, scene.id);
  if (now) queue.push({ scene, vesselId });
  else start(scene, vesselId, 0);
  notify();
  return true;
}

/** The shot has run, or a tap ended it. */
export function skipBeat(): void {
  if (!now) return;
  if (now.index + 1 < now.scene.beats.length) start(now.scene, now.vesselId, now.index + 1);
  else next();
  notify();
}

/** Whether a scene has played for this ship (a beat that depends on it can wait). */
export const scenePlayedFor = (vesselId: string, sceneId: string): boolean => played(vesselId).includes(sceneId);

/** Tests and a closed session: nothing plays, nothing waits. */
export function resetDirector({ keepMemory = false }: { keepMemory?: boolean } = {}): void {
  now = null;
  queue = [];
  if (!keepMemory) {
    try {
      Object.keys(window.localStorage).filter(key => key.startsWith('astera.director.')).forEach(key => { window.localStorage.removeItem(key); });
    } catch { /* Nothing to forget. */ }
  }
  notify();
}

export const directorNow = (): Playing | null => now;

export const useDirector = (): Playing | null => useSyncExternalStore(watch, directorNow);
