import { useTranslation } from 'react-i18next';
import { useSeason } from '../api/queries.js';
import { HonorIcon } from './icons/index.js';

/** The active season's policy, at the decision point; never advertises shadow rules. */
export function HonorSoloNotice() {
  const season = useSeason();
  return season.data?.honorSoloCredit ? <HonorSoloPolicy /> : null;
}

export function HonorSoloPolicy() {
  const { t } = useTranslation();
  return <div data-honor-shared-policy className="border-l-2 border-v2-self/50 pl-2.5 font-v2-ui">
    <p className="flex items-start gap-1.5 text-caption font-semibold leading-relaxed text-v2-ink">
      <HonorIcon className="mt-0.5 size-3.5 shrink-0 text-v2-self" />
      <span>{t('leaderboard.honorSolo.title')}</span>
    </p>
    <p className="mt-0.5 text-micro leading-relaxed text-v2-ink-2">{t('leaderboard.honorSolo.rule')}</p>
  </div>;
}
