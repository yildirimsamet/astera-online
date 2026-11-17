import { COMBAT } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { percent } from '../lib/format.js';
import { Glyph } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';

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
  return <details data-distributed-fire-rules className="gk-rules">
    <summary className="gk-rules__head" {...OWN_SOUND} onClick={() => { playSound('tap'); haptic('tap'); }}>
      <Glyph id="attack" />
      <span className="flex-1">{t('reports.distributedRulesTitle')}</span>
      <span className="gk-rules__chev"><Glyph id="down" /></span>
    </summary>
    <div className="gk-rules__body">
      <p>{fireRule(t, targetLimit)}</p>
      <p>{t('reports.distributedRetreatRule', { lastRound: COMBAT.rounds - 1 })}</p>
      <p>{t('reports.distributedDamageNote')}</p>
    </div>
  </details>;
}
