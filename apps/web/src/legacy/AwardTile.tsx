import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import type { LegacyAward } from '../api/legacySchemas.js';
import { legacyAwardTitle, legacyEditionLabel } from './presentation.js';
import { useAwardSnapshot } from './snapshot.js';
import { Glyph, ProgressBar } from '../game-ui/index.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';

/** Day, month and year in the player's language. */
export const legacyDate = (date: Date): string =>
  date.toLocaleDateString(i18n.t('units.numberLocale'), { day: 'numeric', month: 'short', year: 'numeric' });

/** The piece's picture, or its metal as a soft glow while the picture is drawn. */
export function AwardPicture({ award, className = '' }: {
  award: Pick<LegacyAward, 'definitionId' | 'tier' | 'rarity' | 'edition' | 'seasonOrdinal'>; className?: string;
}) {
  const url = useAwardSnapshot(award);
  return url
    ? <img src={url} alt="" aria-hidden="true" draggable={false} className={`select-none object-contain ${className}`} />
    : <span aria-hidden="true" className={`legacy-snapshot-pending grid place-items-center ${className}`}>
        <svg viewBox="0 0 48 48" className="size-1/2 opacity-45" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="24" cy="24" r="20" /><circle cx="24" cy="24" r="16" opacity=".35" />
          <path d="m24 12 3.5 7.8 8.5 1-6.3 5.7 1.8 8.5-7.5-4.3-7.5 4.3 1.8-8.5-6.3-5.7 8.5-1z" />
        </svg>
      </span>;
}

/**
 * One piece in a grid: its picture on a glow of its rarity, its name and the season or year it
 * belongs to. A locked piece is the same tile in silhouette, with how far along you are.
 * On the kit since C27: one press with its sound and buzz, the progress in the kit's bar.
 */
export function AwardTile({ award, onOpen, selected, order, locked }: {
  award: LegacyAward;
  onOpen: () => void;
  /** In the showcase editor: chosen, and in which place. */
  selected?: boolean;
  order?: number;
  /** A goal not reached yet: shown in silhouette with the progress under it. */
  locked?: { value: number; goal: number; label: string };
}) {
  const { t } = useTranslation();
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  const title = legacyAwardTitle(award);
  const edition = legacyEditionLabel(award);
  return (
    <button type="button" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}
      data-legacy-tile data-rarity={award.rarity} {...(locked ? { 'data-locked': '' } : {})} {...(selected ? { 'data-picked': '' } : {})}
      aria-pressed={selected}
      aria-label={locked ? `${locked.label}. ${t('legacy.award.progress')}: ${String(locked.value)}/${String(locked.goal)}` : edition ? `${title} · ${edition}` : title}
      className="legacy-tile gk-legacy__tile">
      <span className="gk-legacy__tileart">
        <AwardPicture award={award} className="gk-legacy__tilepic" />
        {order !== undefined && <span className="gk-legacy__order gk-num">{order}</span>}
        {locked && <span className="gk-legacy__lock"><Glyph id="lock" /></span>}
      </span>
      <span className="gk-legacy__tilename">{locked ? locked.label : title}</span>
      {locked ? (
        <span className="gk-legacy__tileprogress">
          <ProgressBar value={locked.value} max={locked.goal} tone="warn" />
          <span className="gk-num">{locked.value}/{locked.goal}</span>
        </span>
      ) : (
        <span className="gk-legacy__rarity">
          <span className="legacy-rarity-dot" />
          <span className="legacy-rarity-text">{t(`legacy.rarity.${award.rarity}`)}</span>
          {edition && <span className="gk-num">{edition}</span>}
        </span>
      )}
    </button>
  );
}
