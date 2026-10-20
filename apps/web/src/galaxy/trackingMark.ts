import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Contact } from '../api/schemas.js';

export type TrackingKind = Contact['kind'] | 'fleet' | 'probe' | 'death_star';

/**
 * A RADIATION BOMB'S RETICLE, IN THE GREEN ITS CLOUD WEARS. Owner, 2026-10-16: *"ölüm yıldızı
 * giderken etrafında kırmızı bir çember oluşuyor ama radyasyon füzelerinde bu yok. Radyasyon
 * füzeleri için de uygun yeşilimsi bir çember ekle."* One green for every level: the levels'
 * own glows run from lime to amber, and the reticle names the weapon, not its rung.
 */
export const RADIATION_MARK = '#9be36a';

/**
 * Which parts of the tracking reticle a craft wears, and in what colour. The two strategic
 * weapons share one shape — a closed ring with four ticks — and differ only in colour.
 */
export function trackingMarkStyle(kind: TrackingKind, colour: string): { ring: boolean; ticks: boolean; colour: string } {
  const strategic = kind === 'death_star' || kind === 'radiation_bomb';
  return {
    ring: strategic || kind === 'probe' || kind === 'mining' || kind === 'harvest',
    ticks: strategic || kind === 'fleet',
    colour: kind === 'radiation_bomb' ? RADIATION_MARK : colour,
  };
}

/**
 * THE FOUR TICKS AS ONE GEOMETRY, SO A RETICLE IS ONE DRAW. 2026-10-20 performance recording:
 * a wide view with 34 contacts drew ~500 calls, and every fleet's reticle was four tick meshes.
 * Each tick stands on the ring at a quarter turn, its length along the radius.
 */
export function trackingTicksGeometry(radius: number, width: number, length: number): THREE.BufferGeometry {
  const quarters = [0, 1, 2, 3].map((quarter) => {
    const tick = new THREE.PlaneGeometry(width, length);
    tick.rotateZ(quarter * Math.PI / 2);
    tick.translate(Math.sin(quarter * Math.PI / 2) * radius, Math.cos(quarter * Math.PI / 2) * radius, 0);
    return tick;
  });
  const merged = mergeGeometries(quarters);
  quarters.forEach((tick) => { tick.dispose(); });
  return merged;
}
