import { useTranslation } from 'react-i18next';
import { useSeason } from '../api/queries.js';
import { Banner } from '../game-ui/index.js';
import { HonorIcon } from './icons/index.js';

/** Where the notice sits: a kit surface draws it as a kit banner (G2-h3); the rest keep the v2 line. */
type Look = 'kit' | 'v2';

/** The active season's policy, at the decision point; never advertises shadow rules. */
export function HonorSoloNotice({ look = 'v2' }: { look?: Look }) {
  const season = useSeason();
  return season.data?.honorSoloCredit ? <HonorSoloPolicy look={look} /> : null;
}

export function HonorSoloPolicy({ look = 'v2' }: { look?: Look }) {
  const { t } = useTranslation();
  if (look === 'kit') {
    return <div data-honor-shared-policy="">
      <Banner tone="info" glyph="ranking" role={null} title={t('leaderboard.honorSolo.title')} body={t('leaderboard.honorSolo.rule')} />
    </div>;
  }
  return <div data-honor-shared-policy className="border-l-2 border-v2-self/50 pl-2.5 font-v2-ui">
    <p className="flex items-start gap-1.5 text-caption font-semibold leading-relaxed text-v2-ink">
      <HonorIcon className="mt-0.5 size-3.5 shrink-0 text-v2-self" />
      <span>{t('leaderboard.honorSolo.title')}</span>
    </p>
    <p className="mt-0.5 text-micro leading-relaxed text-v2-ink-2">{t('leaderboard.honorSolo.rule')}</p>
  </div>;
}
