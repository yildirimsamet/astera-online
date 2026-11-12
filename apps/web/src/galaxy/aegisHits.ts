import type * as THREE from 'three';
import { impactAt, impactPoint, type Shot } from './volley.js';
import type { Vec3Tuple } from './scene.js';

/*
  A RAID'S FIRE ON AN AEGIS DOME (owner approved the Weave look and its raid hits, 2026-11-12). The
  rules spend a raid's opening fire on the Aegis first (`aegisStrikes`), so each round that reaches a
  shielded world opens a hex ripple on its dome where it strikes. The fire on the surface plays as
  before: the ripple shows the shield taking the round, never how the fight ends.

  A raid (`Bombardment`) writes its rounds here; the one draw of every dome (`Shields`) reads the
  newest of them each frame and keeps them only on the dome they belong to.
*/

/** How long a round's ripple runs over the dome. */
export const AEGIS_HIT_SECONDS = 0.9;
/** How many ripples the domes in view carry at once: the newest win. */
export const AEGIS_HIT_SLOTS = 6;

export interface AegisHit {
  /** The struck world's centre, in world space. */
  centre: Vec3Tuple;
  /** From that centre to where the round strikes, a unit vector in world space. */
  direction: Vec3Tuple;
  /** Server milliseconds at which it strikes. */
  at: number;
}

const raids = new Map<string, readonly AegisHit[]>();
const live: { hit: AegisHit; age: number }[] = [];

/** A raid's rounds, kept current by the raid while it plays. */
export function strikeAegis(raid: string, hits: readonly AegisHit[]): void {
  raids.set(raid, hits);
}

export function clearAegisHits(raid: string): void {
  raids.delete(raid);
}

/**
 * Writes the newest hits still rippling at `now` into the dome program's arrays, ages 0..1, and
 * returns how many there are. Allocates nothing per frame beyond the shared scratch list.
 */
export function aegisHitUniforms(now: number, into: { centres: THREE.Vector3[]; directions: THREE.Vector3[]; ages: number[] }): number {
  live.length = 0;
  if (!Number.isFinite(now)) return 0;
  for (const hits of raids.values()) {
    for (const hit of hits) {
      const age = (now - hit.at) / (AEGIS_HIT_SECONDS * 1000);
      if (age >= 0 && age <= 1) live.push({ hit, age });
    }
  }
  live.sort((a, b) => a.age - b.age);
  const count = Math.min(live.length, AEGIS_HIT_SLOTS, into.ages.length);
  for (let i = 0; i < count; i++) {
    const { hit, age } = live[i]!;
    into.centres[i]?.set(...hit.centre);
    into.directions[i]?.set(...hit.direction);
    into.ages[i] = age;
  }
  return count;
}

/**
 * Where and when each round of a volley strikes its world, in the squadron's own frame (`Bombardment`):
 * the world's centre is `distance` down +Z, and each direction runs from it to the round's impact.
 */
export function domeHits(shots: readonly Shot[], slots: readonly (readonly [number, number, number])[],
  distance: number, radius: number, arriveAt: number): { direction: Vec3Tuple; at: number }[] {
  return shots.map((shot) => {
    const [x, y, z] = impactPoint(slots[shot.slot] ?? [0, 0, 0], shot.aim, distance, radius);
    const dz = z - distance;
    const length = Math.hypot(x, y, dz) || 1;
    return { direction: [x / length, y / length, dz / length], at: arriveAt + impactAt(shot) * 1000 };
  });
}
