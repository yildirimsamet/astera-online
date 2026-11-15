/**
 * ONE PIECE, ONE TAP DEEPER: the piece on its plinth, what it is, when and where it was won,
 * how many commanders share it, and the rule that earns it — and, on your own profile, the
 * two things you can do with it.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGACY_CATALOGUE, type LegacyDefinition } from '@astera/rules';
import type { LegacyAward, LegacyProfile } from '../api/legacySchemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { durationPrecise } from '../lib/time.js';
import { Banner, GameButton, Glyph, ProgressBar, artIconSrc } from '../game-ui/index.js';
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

  const shelfFull = !onShelf && shelfIds.length >= 6;

  return (
    <Sheet placement="dialog" detents={['full']} kit={{ art: artIconSrc('trophy') }} eyebrow={t(`legacy.category.${award.category}`)} title={name} onClose={onClose}>
      <div ref={focus} tabIndex={-1} data-legacy-award className="gk-legacy gk-award">
        <AwardStage award={award} live={live} />
        <div className="gk-award__chips" data-rarity={award.rarity}>
          <span className="legacy-tile legacy-rarity-text gk-award__chip" data-rarity={award.rarity}>
            <span className="legacy-rarity-dot" />{t(`legacy.rarity.${award.rarity}`)}
          </span>
          {edition && <span className="gk-award__chip gk-num">{edition}</span>}
          {definition && definition.goals.length > 1 && (
            <span className="gk-award__chip">{t('legacy.award.tier', { tier: award.tier, count: definition.goals.length })}</span>
          )}
          {isTitle && <span className="gk-legacy__title"><Glyph id="star" /><span>{t(profile.self ? 'legacy.award.activeTitle' : 'legacy.award.activeTitleOther')}</span></span>}
        </div>

        <dl className="gk-well gk-award__facts">
          {facts.map(([label, value]) => (
            <div key={label} className="gk-award__fact">
              <dt>{label}</dt><dd>{value}</dd>
            </div>
          ))}
          {detail && (
            <div className="gk-award__fact">
              <dt>{t('legacy.award.owners', { count: detail.owners })}</dt>
              <dd aria-hidden="true" className="gk-award__owners gk-num">{detail.owners}</dd>
            </div>
          )}
        </dl>
        {detailQuery.isPending && <p role="status" className="gk-legacy__note">{t('legacy.award.loading')}</p>}
        {detailQuery.isError && <Banner tone="hostile" role="alert" title={t('legacy.award.detailFailed')}
          action={<GameButton size="sm" glyph="refresh" pending={detailQuery.isFetching} onPress={() => { void detailQuery.refetch(); }}>{t('surface.retry')}</GameButton>} />}

        {definition && goal !== undefined && (
          <section aria-label={t('legacy.award.howTo')} className="gk-well gk-award__how">
            <h3 className="gk-label">{t('legacy.award.howTo')}</h3>
            <p className="gk-award__rule">{legacyGoalText(definition, goal)}</p>
            {ladder && own !== undefined && (
              next ? (
                <div className="gk-award__next">
                  <p className="gk-legacy__note">{t('legacy.award.next')} · {legacyGoalText(ladder, next.goal)}</p>
                  <ProgressBar value={own} max={next.goal} tone="warn" />
                  <span className="gk-award__count gk-num">{t('legacy.award.progress')} {legacyProgressValue(ladder, own)}/{legacyProgressValue(ladder, next.goal)}</span>
                </div>
              ) : <p className="gk-award__done">{t('legacy.collection.complete')}</p>
            )}
          </section>
        )}

        {profile.self && (
          <div className="gk-award__moves">
            <GameButton tone={onShelf ? 'steel' : 'action'} glyph={shelfFull ? 'lock' : onShelf ? 'down' : 'up'} pending={busy}
              disabledReason={shelfFull ? t('legacy.award.shelfFullShort') : null} onPress={toggleShelf}>
              {onShelf ? t('legacy.award.removeFromShelf') : t('legacy.award.showOnShelf')}
            </GameButton>
            <GameButton glyph="star" pending={busy} onPress={() => { run(() => title.mutateAsync(isTitle ? null : award.id)); }}>
              {isTitle ? t('legacy.award.clearTitle') : t('legacy.award.setTitle')}
            </GameButton>
          </div>
        )}
        {profile.self && shelfFull && <p className="gk-legacy__note">{t('legacy.award.shelfFull')}</p>}
        {failed && <Banner tone="hostile" role="alert" title={t('legacy.award.failed')} />}
        <p className="gk-legacy__fine">{t('legacy.award.cosmetic')}</p>
      </div>
    </Sheet>
  );
}

/** Unowned pieces have a catalogue rule, never an owned-award API request or equip action. */
export function LockedAwardSheet({ award, definition, goal, value, live = true, onClose }: {
  award: LegacyAward; definition: LegacyDefinition; goal: number; value: number; live?: boolean; onClose: () => void;
}) {
  const { t } = useTranslation();
  const focus = useLegacyDialogFocus();
  const current = legacyProgressValue(definition, value);
  const target = legacyProgressValue(definition, goal);
  const remaining = Math.max(0, goal - value);
  const remainingLabel = definition.metric === 'MONUMENT_SECONDS'
    ? t('legacy.award.remainingTime', { duration: durationPrecise(remaining / 60) })
    : t('legacy.award.remaining', { count: remaining });
  return (
    <Sheet placement="dialog" detents={['full']} kit={{ art: artIconSrc('lock') }}
      eyebrow={t('legacy.award.locked')} title={legacyAwardTitle(award)} onClose={onClose}>
      <div ref={focus} tabIndex={-1} data-legacy-locked className="gk-legacy gk-award">
        <AwardStage award={award} live={live} />
        <section className="gk-well gk-award__how">
          <h3 className="gk-label">{t('legacy.award.howTo')}</h3>
          <p className="gk-award__rule">{legacyGoalText(definition, goal)}</p>
          <div className="gk-award__fact">
            <span>{t('legacy.award.progress')}</span>
            <span className="gk-award__owners gk-num">{current}/{target}</span>
          </div>
          <ProgressBar value={value} max={goal} tone="warn" label={t('legacy.award.progress')} />
          <p className="gk-legacy__note">{remainingLabel}</p>
          <p className="gk-legacy__note">{t('legacy.award.unlock')}</p>
        </section>
        <p className="gk-legacy__fine">{t('legacy.award.cosmetic')}</p>
      </div>
    </Sheet>
  );
}
