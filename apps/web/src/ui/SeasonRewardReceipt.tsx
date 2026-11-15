import { useTranslation } from 'react-i18next';
import type { SeasonRewardReceipt as Receipt } from '../api/schemas.js';
import { full } from '../lib/format.js';
import { RESOURCE_ART } from './assets.js';

/** Already deposited resources, never the nominal offer or a pending entitlement. On the kit since C19. */
export function SeasonRewardReceipt({ receipt }: { receipt?: Receipt | null }) {
  const { t } = useTranslation();
  if (!receipt) return null;
  return <section data-season-prize-receipt className="gk-well gk-report__why gk-lb__receipt">
    <p className="gk-report__subhead">{t('leaderboard.honorDelivered')}</p>
    <p className="gk-report__copy">
      {t('leaderboard.honorDeliveredPlace', { ranking: receipt.ranking === 'HONOR' ? t('leaderboard.honorTitle') : t('leaderboard.score'), rank: receipt.displayRank })}
    </p>
    <dl className="gk-haul__row gk-num">
      {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <div key={resource} className="gk-haul__res" data-res={resource}>
        <dt><span className="sr-only">{t(`leaderboard.archive.resources.${resource}`)}</span>
          <img src={RESOURCE_ART[resource]} alt="" aria-hidden /></dt>
        <dd>{full(receipt[resource])}</dd>
      </div>)}
    </dl>
  </section>;
}
