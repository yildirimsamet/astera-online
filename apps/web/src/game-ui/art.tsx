import type { ReactElement } from 'react';
import type { DockTab } from '../lib/dock.js';

/**
 * PAINTED ICONS: the game's own house style (dark gunmetal, amber lights, cyan seams),
 * drawn with Codex and approved by the owner on 2026-11-12. They are for 40 px and up;
 * a painting turns to mud under that, so smaller marks are glyphs (`icons.tsx`).
 * Each file is a 160 px WebP, trimmed and padded alike, in `public/assets/ui/icons/`.
 * Sources and audit: docs/ui-kit-varlik-secimi-2026-11-12.md.
 */
export const ART_ICONS = [
  // the dock and the places
  'nav-galaxy', 'nav-base', 'nav-fleet', 'nav-intel', 'nav-research',
  // the menu
  'menu-clan', 'menu-friends', 'menu-missions', 'menu-news', 'menu-ranking', 'menu-reports', 'menu-shop',
  // cosmetic collections
  'cos-planet', 'cos-ring', 'cos-ship', 'cos-probe', 'cos-miner', 'cos-engine', 'cos-flag',
  // fleet, rewards and the super weapon
  'cargo', 'slot', 'lock', 'gift', 'ad-reward', 'deathstar',
] as const;

export type ArtIconId = (typeof ART_ICONS)[number];

/** The sizes a painting may be drawn at, in CSS px. */
export const ART_SIZES = [40, 48, 56, 64, 80] as const;
export type ArtSize = (typeof ART_SIZES)[number];

/** The painting for each place in the dock (`lib/dock.ts`). */
export const DOCK_ART: Record<DockTab, ArtIconId> = {
  galaxy: 'nav-galaxy',
  base: 'nav-base',
  fleet: 'nav-fleet',
  intel: 'nav-intel',
  clan: 'menu-clan',
};

export const artIconSrc = (id: ArtIconId): string => `/assets/ui/icons/${id}.webp`;

/** Decorative: the label beside it names the thing, so the picture stays silent. */
export function ArtIcon({ id, size = 48, className = '' }: { id: ArtIconId; size?: ArtSize; className?: string }): ReactElement {
  return (
    <img
      src={artIconSrc(id)}
      width={size}
      height={size}
      alt=""
      decoding="async"
      draggable={false}
      className={`gk-art ${className}`.trim()}
    />
  );
}
