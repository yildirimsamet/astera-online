/**
 * ONE PIECE, ONE TAP DEEPER: the piece on its plinth, what it is, when and where it was won,
 * how many commanders share it, and the rule that earns it — and, on your own profile, the
 * two things you can do with it.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGACY_CATALOGUE } from '@astera/rules';
import type { LegacyAward, LegacyProfile } from '../api/legacySchemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { Button, Note } from '../v2/kit/Surface.js';
import { AwardStage } from './AwardStage.js';
import { legacyDate } from './AwardTile.js';
import { legacyAwardTitle, legacyEditionLabel, legacyGoalText, legacyNextGoal, legacyProgressValue } from './presentation.js';
import { useLegacyAward, useLegacyProgress, useSetLegacyShowcase, useSetLegacyTitle } from './queries.js';
import { useLegacyDialogFocus } from './useLegacyDialogFocus.js';

export function AwardSheet({ profile, award, live = true, onClose }: {
  profile: LegacyProfile;
  award: LegacyAward;
  live?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const focus = useLegacyDialogFocus();
  const detailQuery = useLegacyAward(profile.publicId, award.id);
  const detail = detailQuery.data;
  const progress = useLegacyProgress(profile.self).data;
  const showcase = useSetLegacyShowcase();
  const title = useSetLegacyTitle();
  const [failed, setFailed] = useState(false);
  const definition = LEGACY_CATALOGUE.find(row => row.id === award.definitionId);
  const name = legacyAwardTitle(award);
  const edition = legacyEditionLabel(award);
  const shelfIds = profile.showcase.map(row => row.awardId);
  const onShelf = shelfIds.includes(award.id);
  const isTitle = profile.activeTitle?.id === award.id;
  const goal = definition?.goals[award.tier - 1];
  const ladder = definition?.scope === 'CAREER' && definition.goals.length > 1 ? definition : null;
  const own = ladder ? progress?.achievements.find(row => row.id === ladder.id)?.progress : undefined;
  const next = ladder && own !== undefined ? legacyNextGoal(ladder, own) : null;
  const busy = showcase.isPending || title.isPending;

  const run = (action: () => Promise<unknown>) => {
    setFailed(false);
    action().catch(() => { setFailed(true); });
  };
  const toggleShelf = () => {
    run(() => showcase.mutateAsync(onShelf ? shelfIds.filter(id => id !== award.id) : [...shelfIds, award.id]));
  };
  const facts: [string, string][] = [
    [t('legacy.award.earned'), award.earnedAt ? legacyDate(award.earnedAt) : t('legacy.award.earnedUnknown')],
  ];
  if (detail?.season) facts.push([t('legacy.award.season'), `${t('legacy.seasons.ordinal', { ordinal: detail.season.ordinal })} · ${detail.season.galaxy}`]);
  if (award.rank !== null) facts.push([t('legacy.award.place'), `#${String(award.rank)}`]);

  return (
    <Sheet placement="dialog" detents={['full']} headerArt={ATMOSPHERE.legacy} eyebrow={t(`legacy.category.${award.category}`)} title={name} onClose={onClose}>
      <div ref={focus} tabIndex={-1} data-legacy-award className="flex flex-col gap-3 pb-4 font-v2-ui text-v2-ink outline-none">
        <AwardStage award={award} live={live} />
        <div className="flex flex-wrap items-center gap-1.5 text-micro" data-rarity={award.rarity}>
          <span className="legacy-tile legacy-rarity-text inline-flex items-center gap-1 rounded-chip px-2 py-0.5 font-semibold" data-rarity={award.rarity}>
            <span className="legacy-rarity-dot size-1.5 rounded-full" />{t(`legacy.rarity.${award.rarity}`)}
          </span>
          {edition && <span className="rounded-chip border border-v2-line-hi px-2 py-0.5 font-v2-mono text-v2-ink-2">{edition}</span>}
          {definition && definition.goals.length > 1 && (
            <span className="rounded-chip border border-v2-line-hi px-2 py-0.5 text-v2-ink-2">{t('legacy.award.tier', { tier: award.tier, count: definition.goals.length })}</span>
          )}
          {isTitle && <span className="rounded-chip border border-v2-premium/50 px-2 py-0.5 font-semibold text-v2-premium">{t(profile.self ? 'legacy.award.activeTitle' : 'legacy.award.activeTitleOther')}</span>}
        </div>

        <dl className="divide-y divide-v2-line overflow-hidden rounded-control border border-v2-line bg-v2-panel text-caption">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <dt className="text-v2-ink-2">{label}</dt><dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
          {detail && (
            <div className="flex items-baseline justify-between gap-3 px-3 py-2">
              <dt className="text-v2-ink-2">{t('legacy.award.owners', { count: detail.owners })}</dt>
              <dd aria-hidden="true" className="font-v2-mono font-semibold text-v2-premium">{detail.owners}</dd>
            </div>
          )}
        </dl>
        {detailQuery.isPending && <p role="status" className="text-label text-v2-ink-2">{t('legacy.award.loading')}</p>}
        {detailQuery.isError && <div className="flex items-center justify-between gap-2">
          <p role="alert" className="text-label text-v2-hostile">{t('legacy.award.detailFailed')}</p>
          <Button size="sm" disabled={detailQuery.isFetching} onClick={() => { void detailQuery.refetch(); }}>{t('surface.retry')}</Button>
        </div>}

        {definition && goal !== undefined && (
          <section aria-label={t('legacy.award.howTo')} className="flex flex-col gap-1.5 rounded-control border border-v2-line bg-v2-panel p-3">
            <h3 className="v2-legend">{t('legacy.award.howTo')}</h3>
            <p className="text-caption leading-snug">{legacyGoalText(definition, goal)}</p>
            {ladder && own !== undefined && (
              next ? (
                <div className="mt-1 flex flex-col gap-1">
                  <p className="text-label text-v2-ink-2">{t('legacy.award.next')} · {legacyGoalText(ladder, next.goal)}</p>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-v2-line">
                    <span className="block h-full rounded-full bg-v2-premium" style={{ width: `${String(Math.min(100, (own / next.goal) * 100))}%` }} />
                  </span>
                  <span className="font-v2-mono text-micro text-v2-ink-3">{t('legacy.award.progress')} {legacyProgressValue(ladder, own)}/{legacyProgressValue(ladder, next.goal)}</span>
                </div>
              ) : <p className="text-label font-semibold text-v2-premium">{t('legacy.collection.complete')}</p>
            )}
          </section>
        )}

        {profile.self && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant={onShelf ? 'default' : 'primary'} disabled={busy || (!onShelf && shelfIds.length >= 6)} onClick={toggleShelf}>
              {onShelf ? t('legacy.award.removeFromShelf') : t('legacy.award.showOnShelf')}
            </Button>
            <Button disabled={busy} onClick={() => { run(() => title.mutateAsync(isTitle ? null : award.id)); }}>
              {isTitle ? t('legacy.award.clearTitle') : t('legacy.award.setTitle')}
            </Button>
          </div>
        )}
        {profile.self && !onShelf && shelfIds.length >= 6 && <p className="text-label text-v2-ink-3">{t('legacy.award.shelfFull')}</p>}
        {failed && <p role="alert" className="text-label text-v2-hostile">{t('legacy.award.failed')}</p>}
        <Note>{t('legacy.award.cosmetic')}</Note>
      </div>
    </Sheet>
  );
}
