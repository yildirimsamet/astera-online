import { useTranslation } from 'react-i18next';

export type DominionPodiumRank = 1 | 2 | 3;

const METAL: Record<DominionPodiumRank, string> = {
  1: 'gold',
  2: 'silver',
  3: 'copper',
};

/** A compact public trophy that sits immediately before a commander's identity. */
export function RankBadge({ rank }: { rank: DominionPodiumRank }) {
  const { t } = useTranslation();
  const label = t('leaderboard.rank', { rank });
  return (
    <span
      className={`rank-badge rank-badge-${METAL[rank]}`}
      aria-label={label}
      title={label}
    >
      <span className="rank-badge-face" aria-hidden="true">{rank}</span>
    </span>
  );
}
