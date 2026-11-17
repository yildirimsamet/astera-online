import { useTranslation } from 'react-i18next';
import type { HonorReceipt } from '../api/schemas.js';
import { Glyph } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { RankingScores } from './RankingScores.js';
import { honorScore } from '../lib/honor.js';
import { full } from '../lib/format.js';
import { HonorSoloPolicy } from './HonorSoloNotice.js';

/**
 * Explain the actual accounting result beside the battle verdict, including zero. On the
 * kit since C16a: a well, the reason in a sentence, the arithmetic one rules row away.
 */
export function HonorBattleSummary({ receipt, dominion }: {
  receipt?: HonorReceipt | null; dominion?: number | null;
}) {
  const { t } = useTranslation();
  if (!receipt) return null;
  const band = receipt.breakdown?.militaryReturn;
  return <section data-honor-result aria-label={t('leaderboard.honorBattleResult')} className="gk-well gk-honor">
    <div className="gk-honor__head">
      <p className="gk-report__subhead">{t('leaderboard.honorBattleResult')}</p>
      <RankingScores honor={receipt.delta} dominion={dominion} change />
    </div>
    <p className="gk-report__copy">{t(receipt.reason === 'NO_GAIN' && band === 'NONE'
      ? 'leaderboard.honorBand.NONE' : receipt.reason === 'WEAK_TARGET' && receipt.breakdown?.repeatRaid
        ? 'leaderboard.honorBand.REPEAT' : `leaderboard.honorReason.${receipt.reason}`)}</p>
    {receipt.breakdown?.sharedPositiveBlocked && <HonorSoloPolicy />}
    {receipt.breakdown && <details className="gk-rules">
      <summary className="gk-rules__head" {...OWN_SOUND} onClick={() => { playSound('tap'); haptic('tap'); }}>
        <Glyph id="ranking" />
        <span className="flex-1">{t('leaderboard.honorBreakdown.title')}</span>
        <span className="gk-rules__chev"><Glyph id="down" /></span>
      </summary>
      <div className="gk-rules__body">
        <dl className="gk-report__sum gk-honor__sum">
          <dt>{t('leaderboard.honorBreakdown.team')}</dt><dd className="gk-num" data-tone="plain">{honorScore(receipt.breakdown.teamDelta)}</dd>
          <dt>{t('leaderboard.honorBreakdown.raw')}</dt><dd className="gk-num">{honorScore(receipt.breakdown.rawTeamDelta)}</dd>
          <dt>{t('leaderboard.honorBreakdown.contribution')}</dt><dd className="gk-num">{t('units.percent', { value: honorScore(BigInt(receipt.breakdown.contributionPpm) * 100n) })}</dd>
          <dt>{t('leaderboard.honorBreakdown.participants')}</dt><dd className="gk-num">{full(receipt.breakdown.participants)}</dd>
          {!receipt.breakdown.tactical && <><dt>{t('leaderboard.honorBreakdown.damage')}</dt><dd className="gk-num">{full(receipt.breakdown.militaryDamage)}</dd>
          <dt>{t('leaderboard.honorBreakdown.loss')}</dt><dd className="gk-num">{full(receipt.breakdown.permanentLoss)}</dd></>}
        </dl>
        {band === 'HALF' && <p>{t('leaderboard.honorBand.HALF')}</p>}
        {receipt.breakdown.weakTargetDebit && <p>{t('leaderboard.honorBreakdown.weakTargetDebit')}</p>}
        {receipt.breakdown.participants > 1 && <p className="gk-report__label">{t('leaderboard.honorBreakdown.shared')}</p>}
        {!receipt.breakdown.tactical && <p className="gk-report__label">{t('leaderboard.honorBreakdown.value')}</p>}
      </div>
    </details>}
  </section>;
}
