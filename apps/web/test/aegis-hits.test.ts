import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AEGIS_HIT_SECONDS,
  AEGIS_HIT_SLOTS,
  aegisHitUniforms,
  clearAegisHits,
  domeHits,
  strikeAegis,
  type AegisHit,
} from '../src/galaxy/aegisHits.js';
import { impactAt, impactPoint, volleyFor } from '../src/galaxy/volley.js';
import { createShieldMaterial } from '../src/galaxy/Satellites.js';

const slots = () => ({
  centres: Array.from({ length: AEGIS_HIT_SLOTS }, () => new THREE.Vector3()),
  directions: Array.from({ length: AEGIS_HIT_SLOTS }, () => new THREE.Vector3()),
  ages: Array.from({ length: AEGIS_HIT_SLOTS }, () => -1),
});
const hit = (at: number, x = 1): AegisHit => ({ centre: [5, 0, 0], direction: [x, 0, 0], at });

afterEach(() => { clearAegisHits('a'); clearAegisHits('b'); });

/**
 * A RAID'S FIRE ON AN AEGIS DOME (owner approved the Weave look and its raid hits, 2026-11-12):
 * each round that reaches a shielded world opens a hex ripple on the dome where it strikes.
 */
describe('the hits rippling over the Aegis domes', () => {
  it('holds each round of a volley from the moment it strikes until its ripple has run', () => {
    strikeAegis('a', [hit(1_000), hit(2_000), hit(9_000)]);
    const into = slots();
    expect(aegisHitUniforms(999, into)).toBe(0);
    expect(aegisHitUniforms(1_000, into)).toBe(1);
    expect(into.ages[0]).toBe(0);
    expect(aegisHitUniforms(1_000 + AEGIS_HIT_SECONDS * 500, into)).toBe(1);
    expect(into.ages[0]).toBeCloseTo(0.5, 6);
    // The first ripple has run and the second round has not struck yet.
    expect(aegisHitUniforms(1_000 + AEGIS_HIT_SECONDS * 1000 + 1, into)).toBe(0);
    expect(aegisHitUniforms(2_000 + 1, into)).toBe(1);
    expect(aegisHitUniforms(2_000 + AEGIS_HIT_SECONDS * 1000 + 1, into)).toBe(0);
  });

  it('keeps the newest hits when more strike at once than the dome can hold, across raids', () => {
    strikeAegis('a', Array.from({ length: AEGIS_HIT_SLOTS }, (_, i) => hit(1_000 + i * 10, i)));
    strikeAegis('b', [hit(1_100, 99)]);
    const into = slots();
    expect(aegisHitUniforms(1_150, into)).toBe(AEGIS_HIT_SLOTS);
    expect(into.directions[0]!.x).toBe(99);
    expect(into.directions.map((d) => d.x)).not.toContain(0);
    expect(into.centres[0]!.toArray()).toEqual([5, 0, 0]);
    for (let i = 1; i < AEGIS_HIT_SLOTS; i++) expect(into.ages[i]!).toBeGreaterThanOrEqual(into.ages[i - 1]!);
  });

  it('forgets a raid once it is over', () => {
    strikeAegis('a', [hit(1_000)]);
    clearAegisHits('a');
    expect(aegisHitUniforms(1_100, slots())).toBe(0);
  });

  it('is quiet on a clock it cannot read', () => {
    strikeAegis('a', [hit(1_000)]);
    expect(aegisHitUniforms(Number.NaN, slots())).toBe(0);
  });

  it('strikes where each round of the volley meets the world, as the round lands', () => {
    const formation: [number, number, number][] = [[0.4, 0, 0], [-0.4, 0.1, 0], [0, 0.3, -0.2]];
    const distance = 6, radius = 1.3, arriveAt = 50_000;
    const shots = volleyFor('raid', formation.length, radius);
    const hits = domeHits(shots, formation, distance, radius, arriveAt);
    expect(hits).toHaveLength(shots.length);
    shots.forEach((shot, i) => {
      const [x, y, z] = impactPoint(formation[shot.slot]!, shot.aim, distance, radius);
      const towards = new THREE.Vector3(x, y, z - distance).normalize();
      const direction = new THREE.Vector3(...hits[i]!.direction);
      expect(direction.length()).toBeCloseTo(1, 6);
      expect(direction.dot(towards)).toBeCloseTo(1, 6);
      // On the face the squadron sees: the hits face back along -Z, towards the formation.
      expect(direction.z).toBeLessThan(0);
      expect(hits[i]!.at).toBe(arriveAt + impactAt(shot) * 1000);
    });
  });

  it('is struck only by a raid on a world, never by fire at a fleet', () => {
    const source = readFileSync('src/galaxy/Bombardment.tsx', 'utf8');
    expect(source).toMatch(/if \(!strikesWorld\) return;[\s\S]{0,900}strikeAegis\(/);
    expect(source).toContain('clearAegisHits(');
  });
});

/** The dome's one material: the Weave look, every dome in one draw (owner, 2026-09-19 and 2026-11-12). */
describe('the Aegis dome material', () => {
  const material = createShieldMaterial();

  it('draws only the dome\'s near face: half the fragments of the old two-sided shell', () => {
    expect(material.side).toBe(THREE.FrontSide);
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.depthWrite).toBe(false);
  });

  it('has room for the newest hits of every raid in view, and starts with none', () => {
    expect(material.uniforms.uHitCount?.value).toBe(0);
    expect(material.uniforms.uHitAge?.value).toHaveLength(AEGIS_HIT_SLOTS);
    expect(material.fragmentShader).toContain(`uHitAge[${String(AEGIS_HIT_SLOTS)}]`);
  });

  it('keeps a remembered dome a still snapshot: no drift, no blinking cells, no ripples', () => {
    expect(material.fragmentShader).toMatch(/float t = uTime \* vAlive;/);
    expect(material.fragmentShader).toMatch(/hit \*= vAlive;/);
  });
});
