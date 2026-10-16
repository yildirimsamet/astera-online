import { useTranslation } from 'react-i18next';
import type { SeasonRewardReceipt as Receipt } from '../api/schemas.js';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';
import { HonorIcon, RewardIcon } from './icons/index.js';

/** Already deposited resources, never the nominal offer or a pending entitlement. */
export function SeasonRewardReceipt({ receipt }: { receipt?: Receipt | null }) {
  const { t } = useTranslation();
  if (!receipt) return null;
  const Icon = receipt.ranking === 'HONOR' ? HonorIcon : RewardIcon;
  return <section data-season-prize-receipt className="grid gap-2 border-b border-v2-line bg-v2-self/5 px-3 py-2.5 font-v2-ui">
    <p className="text-caption font-semibold text-v2-ink">{t('leaderboard.honorDelivered')}</p>
    <p className="flex items-center gap-1.5 text-caption font-medium text-v2-ink">
      <Icon className="size-3.5 shrink-0 text-v2-self" />
      {t('leaderboard.honorDeliveredPlace', { ranking: receipt.ranking === 'HONOR' ? t('leaderboard.honorTitle') : t('leaderboard.score'), rank: receipt.displayRank })}
    </p>
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <div key={resource} className="flex items-center gap-1.5">
        <dt><span className="sr-only">{t(`leaderboard.archive.resources.${resource}`)}</span>
          <img src={RESOURCE_ART[resource]} alt="" aria-hidden className="size-4 object-contain" /></dt>
        <dd className="font-v2-mono text-caption font-semibold text-v2-ink">{full(receipt[resource])}</dd>
      </div>)}
    </dl>
  </section>;
}
