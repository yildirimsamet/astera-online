import { useTranslation } from 'react-i18next';
import type { HonorReceipt } from '../api/schemas.js';
import { RankingScores } from './RankingScores.js';
import { honorScore } from '../lib/honor.js';
import { full } from '../lib/format.js';
import { HonorSoloPolicy } from './HonorSoloNotice.js';

/** Explain the actual accounting result beside the battle verdict, including zero. */
export function HonorBattleSummary({ receipt, dominion }: {
  receipt?: HonorReceipt | null; dominion?: number | null;
}) {
  const { t } = useTranslation();
  if (!receipt) return null;
  const band = receipt.breakdown?.militaryReturn;
  return <section data-honor-result aria-label={t('leaderboard.honorBattleResult')}
    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-control border border-v2-self/25 bg-linear-to-br from-v2-self/8 to-v2-panel px-3 py-2.5">
    <p className="text-caption font-semibold text-v2-ink">{t('leaderboard.honorBattleResult')}</p>
    <RankingScores honor={receipt.delta} dominion={dominion} change />
    <p className="col-span-2 text-caption leading-relaxed text-v2-ink-2">{t(receipt.reason === 'NO_GAIN' && band === 'NONE'
      ? 'leaderboard.honorBand.NONE' : `leaderboard.honorReason.${receipt.reason}`)}</p>
    {receipt.breakdown?.sharedPositiveBlocked && <div className="col-span-2"><HonorSoloPolicy /></div>}
    {receipt.breakdown && <details className="col-span-2 border-t border-v2-line pt-1">
      <summary className="min-h-9 cursor-pointer content-center text-caption font-medium text-v2-ink">{t('leaderboard.honorBreakdown.title')}</summary>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 pb-2 text-caption text-v2-ink-2">
        <dt>{t('leaderboard.honorBreakdown.team')}</dt><dd className="break-all text-right font-v2-mono font-semibold text-v2-ink">{honorScore(receipt.breakdown.teamDelta)}</dd>
        <dt>{t('leaderboard.honorBreakdown.raw')}</dt><dd className="break-all text-right font-v2-mono">{honorScore(receipt.breakdown.rawTeamDelta)}</dd>
        <dt>{t('leaderboard.honorBreakdown.contribution')}</dt><dd className="font-v2-mono text-v2-ink">{t('units.percent', { value: honorScore(BigInt(receipt.breakdown.contributionPpm) * 100n) })}</dd>
        <dt>{t('leaderboard.honorBreakdown.participants')}</dt><dd className="font-v2-mono">{full(receipt.breakdown.participants)}</dd>
        {!receipt.breakdown.tactical && <><dt>{t('leaderboard.honorBreakdown.damage')}</dt><dd className="font-v2-mono">{full(receipt.breakdown.militaryDamage)}</dd>
        <dt>{t('leaderboard.honorBreakdown.loss')}</dt><dd className="font-v2-mono">{full(receipt.breakdown.permanentLoss)}</dd></>}
      </dl>
      {band === 'HALF' && <p className="mb-2 text-caption leading-relaxed text-v2-ink-2">{t('leaderboard.honorBand.HALF')}</p>}
      {receipt.breakdown.weakTargetDebit && <p className="mb-2 text-caption leading-relaxed text-v2-ink-2">{t('leaderboard.honorBreakdown.weakTargetDebit')}</p>}
      {receipt.breakdown.participants > 1 && <p className="text-micro leading-relaxed text-v2-ink-3">{t('leaderboard.honorBreakdown.shared')}</p>}
      {!receipt.breakdown.tactical && <p className="mt-1 text-micro leading-relaxed text-v2-ink-3">{t('leaderboard.honorBreakdown.value')}</p>}
    </details>}
  </section>;
}
