import { COMBAT } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { percent } from '../lib/format.js';

/** Public rules only: never derive an opponent roster or HP from a report. */
export function MonumentBattleRules() {
  const { t } = useTranslation();
  return <div className="grid gap-1.5 text-micro leading-snug text-v2-ink-2">
    <p>{t('monument.battleResult.roundRule', { rounds: COMBAT.rounds })}</p>
    <details className="rounded-control border border-v2-line/60 px-2.5 py-2">
      <summary className="cursor-pointer font-semibold text-v2-ink">{t('monument.battleResult.rulesTitle')}</summary>
      <div className="mt-2 grid gap-2">
        <p>{t('monument.battleResult.fireRule')}</p>
        <p>{t('monument.battleResult.captureRule')}</p>
        <p>{t('monument.battleResult.retreatRule', { lastRound: COMBAT.rounds - 1 })}</p>
        <p>{t('monument.battleResult.partialRule', { threshold: percent(COMBAT.partialThreshold) })}</p>
      </div>
    </details>
  </div>;
}
