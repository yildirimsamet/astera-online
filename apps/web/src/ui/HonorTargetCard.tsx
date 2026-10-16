import { useTranslation } from 'react-i18next';
import type { HonorTarget } from '../api/schemas.js';
import { HonorIcon } from './icons/index.js';
import { HonorSoloPolicy } from './HonorSoloNotice.js';

/** Coarse current guidance; the committed battle keeps its own authoritative references. */
export function HonorTargetCard({ value }: { value: HonorTarget }) {
  const { t } = useTranslation();
  if (!value.enabled || !value.eligible) return null;
  return <section data-honor-target aria-label={t('leaderboard.honorTarget.title')}
    className="grid gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2.5 font-v2-ui">
    <div className="flex items-center gap-2 text-body font-semibold text-v2-ink">
      <HonorIcon className="size-4 shrink-0 text-v2-self" />
      <span>Honor</span><span aria-hidden className="text-v2-ink-3">·</span>
      <span>{t(`leaderboard.honorTarget.${value.kind}`)}</span>
    </div>
    {(!value.related || value.kind === 'WEAK') && <p className="text-caption leading-relaxed text-v2-ink-2">
      {t(`leaderboard.honorTarget.${value.kind === 'WEAK' ? 'weakWarning' : 'eligible'}`)}
    </p>}
    {value.related ? <p className="text-caption leading-relaxed text-v2-ink">{t('leaderboard.honorReason.RELATED')}</p>
      : value.kind !== 'WEAK' && <p className="text-caption leading-relaxed text-v2-ink-2">
        {t(`leaderboard.honorTarget.${value.militaryReturn}`)}
      </p>}
    {value.repeated && <p className="text-caption leading-relaxed text-v2-ink-2">{t('leaderboard.honorTarget.repeated')}</p>}
    {value.retaliation && <p className="text-caption leading-relaxed text-v2-ink-2">{t('leaderboard.honorTarget.retaliation')}</p>}
    {value.soloCredit && <HonorSoloPolicy />}
    <p className="text-micro leading-relaxed text-v2-ink-3">{t('leaderboard.honorTarget.estimate')}</p>
  </section>;
}
