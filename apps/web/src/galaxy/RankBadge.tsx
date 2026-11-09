import { useTranslation } from 'react-i18next';
import { DominionIcon, HonorIcon } from '../ui/icons/index.js';

export type DominionPodiumRank = 1 | 2 | 3;

const METAL: Record<DominionPodiumRank, string> = {
  1: 'gold',
  2: 'silver',
  3: 'copper',
};

/** A compact public trophy that sits immediately before a commander's identity. */
export function RankBadge({ rank, honor = false }: { rank: DominionPodiumRank; honor?: boolean }) {
  const { t } = useTranslation();
  const label = `${t(honor ? 'leaderboard.honorTitle' : 'leaderboard.score')} · ${t('leaderboard.rank', { rank })}`;
  return <span aria-label={label} title={label} className={`inline-flex shrink-0 items-center gap-0.5 ${honor ? 'text-v2-ink' : 'text-v2-ink-2'}`}>
    {honor ? <HonorIcon className="size-3" /> : <DominionIcon className="size-3" />}
    <span
      className={`rank-badge rank-badge-${METAL[rank]}${honor ? '' : ' rank-badge-dominion'}`}
      aria-hidden="true"
    >
      <span className="rank-badge-face" aria-hidden="true">{rank}</span>
    </span>
  </span>;
}
