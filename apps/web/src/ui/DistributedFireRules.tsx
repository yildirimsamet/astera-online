import { COMBAT } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { percent } from '../lib/format.js';

/**
 * The fire rule the report was fought under: every living target (no limit recorded), up to ten
 * (the six-round engine) or one per shot with the kill's excess carried on (combat v3).
 */
export function fireRule(t: TFunction, targetLimit: number | undefined): string {
  if (targetLimit === undefined) return t('monument.battleResult.fireRule');
  if (targetLimit === 1) return t('monument.battleResult.singleTargetFireRule', { critical: percent(COMBAT.criticalBelow) });
  return t('monument.battleResult.targetedFireRule', { targets: targetLimit });
}

/** Only shown for reports explicitly recorded by the distributed-fire engine. */
export function DistributedFireRules({ targetLimit }: { targetLimit?: number }) {
  const { t } = useTranslation();
  return <details data-distributed-fire-rules className="mt-2 rounded-control border border-v2-line/60 px-3 py-2 text-caption text-v2-ink-2">
    <summary className="cursor-pointer min-h-8 font-semibold text-v2-crystal">{t('reports.distributedRulesTitle')}</summary>
    <div className="mt-2 grid gap-2 leading-relaxed">
      <p>{fireRule(t, targetLimit)}</p>
      <p>{t('reports.distributedRetreatRule', { lastRound: COMBAT.rounds - 1 })}</p>
      <p>{t('reports.distributedDamageNote')}</p>
    </div>
  </details>;
}
