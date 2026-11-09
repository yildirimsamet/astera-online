import { useSyncExternalStore } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { asteroidHitRadius } from '../../galaxy/scene.js';

/** A rock's touch target is worth asking for at a fingertip's width, in CSS pixels. */
export const FINGER_PX = 44;
/** Clear of the officer's card above and the line and the dock below, in the screen's -1 to 1. */
const TOP = 0.4, BOTTOM = -0.6, SIDE = 0.9;

export interface ReachRock { id: string; at: readonly [number, number, number]; level: number }

const point = new Vector3();

/** The rock that looks biggest among those a finger can take from here, or none (owner playtest 2026-11-09). */
export function rockInReach(rocks: readonly ReachRock[], camera: PerspectiveCamera, viewportHeight: number): string | null {
  const pixelsAtOne = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
  let best: string | null = null, biggest = FINGER_PX / 2;
  for (const rock of rocks) {
    point.set(rock.at[0], rock.at[1], rock.at[2]);
    const radius = (asteroidHitRadius(rock.level) * pixelsAtOne) / camera.position.distanceTo(point);
    point.project(camera);
    const inView = point.z < 1 && Math.abs(point.x) <= SIDE && point.y <= TOP && point.y >= BOTTOM;
    if (inView && radius >= biggest) { biggest = radius; best = rock.id; }
  }
  return best;
}

/** The scene knows the camera and the guide lives above it: the same bridge as the rock's sheet. */
let reach: string | null = null;
const listeners = new Set<() => void>();
const watch = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};

export function setRockReach(next: string | null): void {
  if (reach === next) return;
  reach = next;
  listeners.forEach((notify) => { notify(); });
}

export const useRockReach = (): string | null => useSyncExternalStore(watch, () => reach);
