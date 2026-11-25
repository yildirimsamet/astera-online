import { useTranslation } from 'react-i18next';
import type { HonorTarget } from '../api/schemas.js';
import { Glyph } from '../game-ui/index.js';
import { HonorSoloPolicy } from './HonorSoloNotice.js';

/** Coarse current guidance; the committed battle keeps its own authoritative references. */
export function HonorTargetCard({ value }: { value: HonorTarget }) {
  const { t } = useTranslation();
  if (!value.enabled || !value.eligible) return null;
  return <section data-honor-target aria-label={t('leaderboard.honorTarget.title')} className="gk-well gk-honor"
    data-kind={value.kind}>
    <p className="gk-honor__head">
      <Glyph id="ranking" />
      <span>Honor</span><span aria-hidden className="gk-honor__dot">·</span>
      <span className="gk-honor__kind">{t(value.kind === 'PEER' && value.militaryReturn === 'NONE' ? 'leaderboard.honorTarget.noReturn' : `leaderboard.honorTarget.${value.kind}`)}</span>
    </p>
    {value.topTierPeer && <p className="gk-honor__line" data-tone="self">
      {t('leaderboard.honorTarget.topTierPeer')}
    </p>}
    {(value.kind === 'WEAK' || (!value.related && value.militaryReturn !== 'NONE')) && <p className="gk-honor__line"
      {...(value.kind === 'WEAK' ? { 'data-tone': 'warn' } : {})}>
      {t(`leaderboard.honorTarget.${value.kind === 'WEAK' ? value.repeatRaid ? 'repeatRaid' : 'weakWarning' : 'eligible'}`)}
    </p>}
    {value.kind === 'WEAK' && (value.weakMultiplier ?? 1) >= 2 && (
      <p data-honor-escalated-warning className="gk-honor__line" data-tone="hostile">
        {t(
          (value.priorWeakCount ?? 0) >= 1
            ? 'leaderboard.honorTarget.escalatedWeak'
            : 'leaderboard.honorTarget.escalatedInFlight',
          { multiplier: value.weakMultiplier },
        )}
      </p>
    )}
    {value.related ? <p className="gk-honor__line" data-tone="ink">{t('leaderboard.honorReason.RELATED')}</p>
      : value.kind !== 'WEAK' && <p className="gk-honor__line">
        {t(`leaderboard.honorTarget.${value.militaryReturn}`)}
      </p>}
    {value.repeated && <p className="gk-honor__line">{t('leaderboard.honorTarget.repeated')}</p>}
    {value.retaliation && <p className="gk-honor__line">{t('leaderboard.honorTarget.retaliation', {
      percent: value.retaliationLootPercent ?? 20,
    })}</p>}
    {value.soloCredit && <HonorSoloPolicy look="kit" />}
    <p className="gk-sub">{t('leaderboard.honorTarget.estimate')}</p>
  </section>;
}
