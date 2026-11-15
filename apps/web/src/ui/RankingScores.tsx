import { useTranslation } from 'react-i18next';
import { full, signed } from '../lib/format.js';
import { honorScore } from '../lib/honor.js';
import { DominionIcon, HonorIcon } from './icons/index.js';

/**
 * Primary merit and secondary dominance, with identical hierarchy on every surface. On the kit
 * since C19: Honor at body size in ink, Dominion at the kit floor below it, each with its mark.
 */
export function RankingScores({ honor, dominion, change = false }: {
  honor?: number | null;
  dominion?: number | null;
  change?: boolean;
}) {
  const { t } = useTranslation();
  return <span data-ranking-scores className="gk-scores">
    {honor != null ? <span data-honor-score className="gk-scores__line" data-rank="honor">
      <span className="gk-scores__name"><HonorIcon className="gk-scores__icon" />{t('leaderboard.honorTitle')}</span>
      <span className="gk-num gk-scores__fig">{change && honor > 0 ? '+' : ''}{honorScore(honor)}</span>
    </span> : null}
    {dominion != null ? <span data-dominion-score className="gk-scores__line" data-rank="dominion">
      <span className="gk-scores__name"><DominionIcon className="gk-scores__icon" />{t('leaderboard.score')}</span>
      <span className="gk-num gk-scores__fig">{dominion === 0 ? full(0) : signed(dominion)}</span>
    </span> : null}
  </span>;
}
