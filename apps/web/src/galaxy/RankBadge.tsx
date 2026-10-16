import { useTranslation } from 'react-i18next';
import { HonorIcon } from '../ui/icons/index.js';

export type DominionPodiumRank = 1 | 2 | 3;

const METAL: Record<DominionPodiumRank, string> = {
  1: 'gold',
  2: 'silver',
  3: 'copper',
};

/** A compact public trophy that sits immediately before a commander's identity. */
export function RankBadge({ rank, honor = false }: { rank: DominionPodiumRank; honor?: boolean }) {
  const { t } = useTranslation();
  const label = `${honor ? t('leaderboard.honorTitle') + ' · ' : ''}${t('leaderboard.rank', { rank })}`;
  const badge = (
    <span
      className={`rank-badge rank-badge-${METAL[rank]}`}
      aria-label={honor ? undefined : label}
      title={label}
    >
      <span className="rank-badge-face" aria-hidden="true">{rank}</span>
    </span>
  );
  return honor ? <span aria-label={label} title={label} className="inline-flex shrink-0 items-center gap-0.5 text-v2-ink"><HonorIcon className="size-3 text-v2-ink" />{badge}</span> : badge;
}
