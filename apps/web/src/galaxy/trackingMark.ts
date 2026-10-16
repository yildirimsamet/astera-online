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
