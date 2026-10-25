import { COMBAT } from '@astera/rules';
import { useTranslation } from 'react-i18next';

/** Only shown for reports explicitly recorded by the distributed-fire engine. */
export function DistributedFireRules({ targetLimit }: { targetLimit?: number }) {
  const { t } = useTranslation();
  return <details data-distributed-fire-rules className="mt-2 rounded-control border border-v2-line/60 px-3 py-2 text-caption text-v2-ink-2">
    <summary className="cursor-pointer min-h-8 font-semibold text-v2-crystal">{t('reports.distributedRulesTitle')}</summary>
    <div className="mt-2 grid gap-2 leading-relaxed">
      <p>{targetLimit === undefined ? t('monument.battleResult.fireRule') : t('monument.battleResult.targetedFireRule', { targets: targetLimit })}</p>
      <p>{t('reports.distributedRetreatRule', { lastRound: COMBAT.rounds - 1 })}</p>
      <p>{t('reports.distributedDamageNote')}</p>
    </div>
  </details>;
}
