import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import type { LegacyAward } from '../api/legacySchemas.js';
import { legacyAwardTitle, legacyEditionLabel } from './presentation.js';
import { useAwardSnapshot } from './snapshot.js';

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
  const title = legacyAwardTitle(award);
  const edition = legacyEditionLabel(award);
  return (
    <button type="button" onClick={onOpen} data-legacy-tile data-rarity={award.rarity} {...(locked ? { 'data-locked': '' } : {})}
      aria-pressed={selected}
      aria-label={locked ? `${locked.label}. ${t('legacy.award.progress')}: ${String(locked.value)}/${String(locked.goal)}` : edition ? `${title} · ${edition}` : title}
      className={`legacy-tile relative flex min-w-0 flex-col items-center gap-1 rounded-control px-1.5 pb-2 pt-1.5 text-center focus-visible:outline-2 focus-visible:outline-v2-self ${selected ? 'outline-2 outline-v2-self' : ''}`}>
      <span className="relative grid aspect-square w-full place-items-center">
        <AwardPicture award={award} className="size-[92%]" />
        {order !== undefined && (
          <span className="absolute left-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-v2-self font-v2-mono text-micro font-semibold text-v2-self-ink">{order}</span>
        )}
        {locked && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute size-5 text-v2-ink-3"><path fill="currentColor" d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" /></svg>
        )}
      </span>
      <span className={`line-clamp-2 min-h-[2.3em] break-words text-label font-semibold leading-tight ${locked ? 'text-v2-ink-2' : 'text-v2-ink'}`}>{locked ? locked.label : title}</span>
      {locked ? (
        <span className="w-full">
          <span className="block h-1 overflow-hidden rounded-full bg-v2-line">
            <span className="block h-full rounded-full bg-v2-premium" style={{ width: `${String(Math.min(100, (locked.value / locked.goal) * 100))}%` }} />
          </span>
          <span className="mt-0.5 block font-v2-mono text-micro text-v2-ink-3">{locked.value}/{locked.goal}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1 text-micro">
          <span className="legacy-rarity-dot size-1.5 rounded-full" />
          <span className="legacy-rarity-text font-semibold">{t(`legacy.rarity.${award.rarity}`)}</span>
          {edition && <span className="font-v2-mono text-v2-ink-3">· {edition}</span>}
        </span>
      )}
    </button>
  );
}
