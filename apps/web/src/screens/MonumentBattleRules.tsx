import { COMBAT } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { percent } from '../lib/format.js';
import { fireRule } from '../ui/DistributedFireRules.js';
import { RulesRow } from '../ui/RulesRow.js';

/** Public rules only: never derive an opponent roster or HP from a report. On the kit since C17: the round rule stated, the rest one rules row away. */
export function MonumentBattleRules({ targetLimit = COMBAT.targetsPerShot }: { targetLimit?: number | null }) {
  const { t } = useTranslation();
  return <div className="grid gap-2">
    <p className="gk-report__note" data-tone="plain">{t('monument.battleResult.roundRule', { rounds: COMBAT.rounds })}</p>
    <RulesRow glyph="help" title={t('monument.battleResult.rulesTitle')}>
      <p>{fireRule(t, targetLimit ?? undefined)}</p>
      <p>{t('monument.battleResult.captureRule')}</p>
      <p>{t('monument.battleResult.retreatRule', { lastRound: COMBAT.rounds - 1 })}</p>
      <p>{t('monument.battleResult.partialRule', { threshold: percent(COMBAT.partialThreshold) })}</p>
    </RulesRow>
  </div>;
}
