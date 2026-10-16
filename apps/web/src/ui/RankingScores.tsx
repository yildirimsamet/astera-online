import { useTranslation } from 'react-i18next';
import { full, signed } from '../lib/format.js';
import { honorScore } from '../lib/honor.js';
import { HonorIcon } from './icons/index.js';

/** Primary merit and secondary dominance, with identical hierarchy on every surface. */
export function RankingScores({ honor, dominion, change = false }: {
  honor?: number | null;
  dominion?: number | null;
  change?: boolean;
}) {
  const { t } = useTranslation();
  return <span data-ranking-scores className="inline-flex min-w-0 flex-col items-end gap-1 text-right font-v2-ui">
    {honor != null ? <span data-honor-score className="flex max-w-full flex-wrap items-baseline justify-end gap-x-1.5 text-body font-bold text-v2-ink">
      <span className="inline-flex items-center gap-1"><HonorIcon className="size-3.5 shrink-0 self-center text-v2-self" />{t('leaderboard.honorTitle')}</span>
      <span className="num break-all">{change && honor > 0 ? '+' : ''}{honorScore(honor)}</span>
    </span> : null}
    {dominion != null ? <span data-dominion-score className="flex max-w-full flex-wrap justify-end gap-x-1.5 text-caption font-normal text-v2-ink-2">
      <span>{t('leaderboard.score')}</span><span className="num break-all">{dominion === 0 ? full(0) : signed(dominion)}</span>
    </span> : null}
  </span>;
}
