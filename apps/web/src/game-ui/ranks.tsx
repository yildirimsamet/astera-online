import { EFFECT_SKIN_IDS, type EffectSkinId, type HonorBenefitTier } from '@astera/rules';
import type { ReactElement } from 'react';
import { Glyph } from './icons.js';

/**
 * WHO SOMEONE IS, AT A GLANCE. One shape, one meaning:
 *   shield — a commander's Honor tier (Synty layers, red skull at −2 up to gold wings at +2)
 *   stripe — the clan's level (bronze 1–3, silver 4–6, gold 7–8, wreath 9, wings 10)
 *   tile   — the clan itself: its flag's emblem, or its tag on a plain banner
 * The badges were composed once from their layers (one height per family, so the shield
 * never changes size); the tiles are cut from the flag skins around each emblem.
 */

interface Art { src: string; width: number; height: number }

export const HONOR_ART: Record<HonorBenefitTier, Art> = {
  [-2]: { src: '/assets/ui/honor/honor-m2.webp', width: 119, height: 128 },
  [-1]: { src: '/assets/ui/honor/honor-m1.webp', width: 119, height: 128 },
  0: { src: '/assets/ui/honor/honor-0.webp', width: 119, height: 128 },
  1: { src: '/assets/ui/honor/honor-p1.webp', width: 238, height: 128 },
  2: { src: '/assets/ui/honor/honor-p2.webp', width: 235, height: 128 },
};

/** Index 0 is clan level 1. */
export const CLAN_LEVEL_ART: readonly Art[] = [97, 93, 93, 93, 93, 90, 90, 90, 156, 248]
  .map((width, i) => ({ src: `/assets/ui/clan-level/level-${String(i + 1)}.webp`, width, height: 128 }));

export type FlagId = Extract<EffectSkinId, `flag-${string}`>;
export const FLAG_IDS: readonly FlagId[] = EFFECT_SKIN_IDS.filter((id): id is FlagId => id.startsWith('flag-'));
export const flagTileSrc = (flag: FlagId): string => `/assets/ui/flag-tiles/${flag}.webp`;

function Badge({ art, label, height }: { art: Art; label: string; height: number }) {
  return (
    <img
      className="gk-insignia"
      src={art.src}
      alt={label}
      height={height}
      width={Math.round((art.width * height) / art.height)}
      decoding="async"
      draggable={false}
    />
  );
}

export function HonorBadge({ tier, label, height = 32 }: { tier: HonorBenefitTier; label: string; height?: number }): ReactElement {
  return <Badge art={HONOR_ART[tier]} label={label} height={height} />;
}

/** Nothing for a level the ladder does not have (a clan still founding). */
export function ClanLevelBadge({ level, label, height = 28 }: { level: number; label: string; height?: number }): ReactElement | null {
  const art = CLAN_LEVEL_ART[level - 1];
  return art ? <Badge art={art} label={label} height={height} /> : null;
}

/** The clan's face in a row: its flag's emblem, or its tag on a plain banner if it flies none. */
export function ClanEmblem({ flag, tag, label, size = 40 }: { flag: FlagId | null; tag: string; label: string; size?: number }): ReactElement {
  return (
    <span role="img" aria-label={label} className="gk-emblem-tile" style={{ width: size, height: size, fontSize: size }} {...(flag ? {} : { 'data-plain': '' })}>
      {flag ? (
        <img src={flagTileSrc(flag)} alt="" decoding="async" draggable={false} />
      ) : (
        <>
          <Glyph id="banner" className="gk-glyph gk-emblem-tile__banner" />
          <span className="gk-emblem-tile__tag">{tag.slice(0, 3)}</span>
        </>
      )}
    </span>
  );
}
