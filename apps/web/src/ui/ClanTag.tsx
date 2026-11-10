import { useTranslation } from 'react-i18next';
import type { ClanTagTier } from '../api/schemas.js';
import { commanderLabel } from '../lib/identity.js';

/**
 * THE CLAN TAG IN ITS METAL (owner 2026-11-10): bronze from clan level 3, silver from 6, gold at
 * 10 — the Golden Banner. The server sends the tier, never the level; below 3 the tag keeps the
 * colour its surface gives it. Gold carries a faint glow so the summit reads at a glance.
 */
const METAL: Record<ClanTagTier, string> = {
  BRONZE: 'text-rank-copper',
  SILVER: 'text-rank-silver',
  GOLD: 'text-rank-gold [text-shadow:0_0_6px_color-mix(in_srgb,var(--color-rank-gold)_55%,transparent)]',
};

export function ClanTag({ tag, tier, className = '', bracket = true }: {
  tag: string;
  tier?: ClanTagTier | null | undefined;
  /** The surface's own colour, used when the clan has no metal yet. */
  className?: string;
  bracket?: boolean;
}) {
  const { t } = useTranslation();
  const text = bracket ? `[${tag}]` : tag;
  if (!tier) return <span className={className}>{text}</span>;
  return (
    <span data-tier={tier} aria-label={`${text} · ${t(`clan.tagTier.${tier}`)}`}
      className={`${className.split(' ').filter((name) => !name.startsWith('text-')).join(' ')} ${METAL[tier]} font-semibold`}>
      {text}
    </span>
  );
}

/** A commander as a room or the galaxy reads them: plain "[TAG] name" until the tag has a metal. */
export function TaggedName({ name, clanTag, clanTier }: {
  name: string; clanTag?: string | null | undefined; clanTier?: ClanTagTier | null | undefined;
}) {
  if (!clanTag || !clanTier) return <>{commanderLabel(name, clanTag)}</>;
  return <><ClanTag tag={clanTag} tier={clanTier} /> {name}</>;
}
