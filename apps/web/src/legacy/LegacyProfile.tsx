/**
 * KOMUTAN MİRASI — the permanent profile. Your own under /profile, anyone else's one tap from
 * where you met them. The shelf is what a commander chose to be seen with; under it, the
 * seasons they lived through; one tab over, everything they hold and what is still ahead.
 * On the kit since C27 (2026-11-15): the commander's plate, kit tabs, seasons on cut plates.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { legacyAwardRarity, LEGACY_CATALOGUE, LEGACY_SHOWCASE_SLOTS, type LegacyDefinition } from '@astera/rules';
import type { LegacyAward, LegacyCollectedAward, LegacyProfile as Profile, LegacySeason } from '../api/legacySchemas.js';
import { Banner, Chip, GameButton, GameTabs, Glyph, SectionTag, artIconSrc, type GlyphId } from '../game-ui/index.js';
import { Flag } from '../v2/identity/Flag.js';
import { Medal, isPlace } from '../ui/Medal.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { full } from '../lib/format.js';
import { ShowcaseShelf } from './ShowcaseShelf.js';
import { AwardPicture, AwardTile, legacyDate } from './AwardTile.js';
import { AwardSheet, LockedAwardSheet } from './AwardSheet.js';
import { ShowcaseEditor } from './ShowcaseEditor.js';
import {
  legacyAwardTitle, legacyDefinitionName, legacyNextGoal, legacyProgressValue, sortLegacyAwards,
} from './presentation.js';
import { useLegacyCollection, useLegacyProgress, useLegacySeasons } from './queries.js';

type Tab = 'legacy' | 'collection' | 'account';

export function LegacyProfileView({ profile, account, live = true }: {
  profile: Profile;
  /** The owner's account settings, as a third tab. */
  account?: ReactNode;
  /** False skips WebGL (tests). */
  live?: boolean;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('legacy');
  const [open, setOpen] = useState<LegacyAward | null>(null);
  const [editing, setEditing] = useState(false);
  const collection = useLegacyCollection(profile.publicId);
  const awards = collection.data ?? [];
  const tabs = [
    { id: 'legacy' as const, label: t('legacy.tabs.legacy') },
    { id: 'collection' as const, label: t('legacy.tabs.collection') },
    ...(account ? [{ id: 'account' as const, label: t('legacy.tabs.account') }] : []),
  ];
  return (
    <div data-legacy-profile className="gk-legacy">
      <LegacyHeader profile={profile} />
      <GameTabs label={t('legacy.title')} tabs={tabs} value={tab} onChange={setTab} ids={{ tab: id => `legacy-tab-${id}`, panel: id => `legacy-panel-${id}` }} />
      <div role="tabpanel" id={`legacy-panel-${tab}`} aria-labelledby={`legacy-tab-${tab}`} className="gk-legacy__panel">
        {tab === 'legacy' && <>
          <section className="gk-legacy__part" aria-label={t('legacy.shelf.heading')}>
            {/* A dead edit says why: the shelf can only be chosen from a collection that has arrived. */}
            <SectionTag as="h3" aside={profile.self ? (
              <GameButton size="sm" glyph="settings" onPress={() => { setEditing(true); }}
                disabledReason={collection.isSuccess ? null : t(collection.isError ? 'legacy.collection.failed' : 'legacy.collection.loading')}>
                {t('legacy.shelf.edit')}
              </GameButton>
            ) : undefined}>{t('legacy.shelf.heading')}</SectionTag>
            <ShowcaseShelf live={live}
              slots={Array.from({ length: LEGACY_SHOWCASE_SLOTS }, (_, slot) => profile.showcase.find(row => row.slot === slot)?.award ?? null)}
              onOpen={setOpen} {...(profile.self && collection.isSuccess ? { onEmpty: () => { setEditing(true); } } : {})} />
            {profile.showcase.length === 0 && (
              <p className="gk-legacy__note">{profile.self ? t('legacy.shelf.emptySelf') : t('legacy.shelf.emptyOther')}</p>
            )}
            {collection.isError && <Banner tone="hostile" role="alert" title={t('legacy.collection.failed')} />}
          </section>
          <SeasonHistory publicId={profile.publicId} awards={awards} onOpen={setOpen} />
          {profile.self && <p className="gk-legacy__fine">{t('legacy.permanence')}</p>}
        </>}
        {tab === 'collection' && <CollectionPanel profile={profile} awards={awards} loading={collection.isPending} failed={collection.isError} onOpen={setOpen} live={live} />}
        {tab === 'account' && account}
      </div>
      {open && <AwardSheet profile={profile} award={open} live={live} onClose={() => { setOpen(null); }} />}
      {editing && <ShowcaseEditor collection={awards} current={profile.showcase.map(row => row.awardId)} onClose={() => { setEditing(false); }} />}
    </div>
  );
}

/**
 * The commander's plate, as the account page draws it (C23): the medallion with two letters,
 * the name and flag, the title they wear in gold, and four lifetime readings in glass.
 */
function LegacyHeader({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation();
  const monogram = Array.from(profile.commanderName).slice(0, 2).join('').toLocaleUpperCase(i18n.resolvedLanguage);
  const best = (rank: number | null) => rank === null ? t('legacy.stats.none') : `#${String(rank)}`;
  const cells: readonly { glyph: GlyphId; label: string; value: string }[] = [
    { glyph: 'history', label: t('legacy.stats.seasons'), value: full(profile.career.seasons) },
    { glyph: 'ranking', label: t('legacy.stats.bestHonor'), value: best(profile.career.bestHonorRank) },
    { glyph: 'colony', label: t('legacy.stats.bestDominion'), value: best(profile.career.bestDominionRank) },
    { glyph: 'star', label: t('legacy.stats.pieces'), value: full(profile.collection.count) },
  ];
  return (
    <header className="gk-cut gk-cmdr gk-legacy__hero">
      <AtmosphereImage art={ATMOSPHERE.commander} />
      <div className="gk-cmdr__id">
        <span className="gk-medal gk-cmdr__medal" aria-hidden="true">
          <span className="gk-medal__face gk-display">{monogram}</span>
          <img className="gk-medal__ring" src={artIconSrc('hud-medallion')} alt="" draggable={false} />
        </span>
        <div className="gk-cmdr__who">
          <span className="gk-cmdr__name">
            {profile.country && <Flag code={profile.country} language={i18n.resolvedLanguage ?? 'en'} className="gk-cmdr__flag" />}
            <span className="gk-display gk-outlined">{profile.commanderName}</span>
          </span>
          {profile.activeTitle ? (
            <span className="gk-legacy__title"><Glyph id="star" /><span>{legacyAwardTitle(profile.activeTitle)}</span></span>
          ) : profile.self ? <span className="gk-cmdr__where">{t('legacy.noTitle')}</span> : null}
          <span className="gk-cmdr__where">{t('legacy.profile.member', { date: legacyDate(profile.joinedAt) })}</span>
        </div>
      </div>
      <dl className="gk-cmdr__cells gk-legacy__cells gk-well">
        {cells.map(({ glyph, label, value }) => (
          <div key={label} className="gk-cmdr__cell">
            <dt className="gk-label gk-cmdr__label"><Glyph id={glyph} />{label}</dt>
            <dd className="gk-cmdr__value gk-display gk-num">{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** Every closed season as a card: where, how high, what happened, and what it left behind. */
function SeasonHistory({ publicId, awards, onOpen }: { publicId: string; awards: readonly LegacyCollectedAward[]; onOpen: (award: LegacyAward) => void }) {
  const { t } = useTranslation();
  const seasons = useLegacySeasons(publicId);
  const rows = seasons.data?.pages.flatMap(page => page.seasons) ?? [];
  return (
    <section className="gk-legacy__part" aria-label={t('legacy.seasons.heading')}>
      <SectionTag as="h3">{t('legacy.seasons.heading')}</SectionTag>
      {seasons.isPending && <p role="status" className="gk-legacy__note">{t('legacy.seasons.loading')}</p>}
      {seasons.isError && <Banner tone="hostile" role="alert" title={t('legacy.seasons.failed')} />}
      {seasons.isSuccess && rows.length === 0 && <p className="gk-legacy__note">{t('legacy.seasons.empty')}</p>}
      <ol className="gk-legacy__seasons">
        {rows.map(season => (
          <li key={season.resultId}><SeasonCard season={season} awards={awards.filter(award => award.sourceSeasonId === season.seasonId)} onOpen={onOpen} /></li>
        ))}
      </ol>
      {seasons.hasNextPage && (
        <GameButton tone="ghost" wide pending={seasons.isFetchingNextPage} onPress={() => { void seasons.fetchNextPage(); }}>{t('legacy.seasons.more')}</GameButton>
      )}
    </section>
  );
}

/** A place on one ladder: its medal when it is a podium, the number in the display face. */
export function PodiumPlace({ rank, label }: { rank: number | null; label: string }) {
  const { t } = useTranslation();
  return (
    <span className="gk-legacy__place">
      {rank !== null && isPlace(rank) ? <Medal place={rank} size={24} /> : null}
      <span className="gk-legacy__placewords">
        <span className="gk-label">{label}</span>
        <span className="gk-display gk-num gk-legacy__rank">{rank === null ? t('legacy.seasons.noPlace') : `#${String(rank)}`}</span>
      </span>
    </span>
  );
}

/** A piece a season left behind: one press opens it on its stage. */
function SeasonPiece({ award, onOpen }: { award: LegacyCollectedAward; onOpen: () => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  return (
    <button type="button" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick} aria-label={legacyAwardTitle(award)}
      data-rarity={award.rarity} className="legacy-tile gk-legacy__piece">
      <AwardPicture award={award} className="gk-legacy__pieceart" />
    </button>
  );
}

function SeasonCard({ season, awards, onOpen }: { season: LegacySeason; awards: readonly LegacyCollectedAward[]; onOpen: (award: LegacyAward) => void }) {
  const { t } = useTranslation();
  const stats = season.stats;
  const shown = sortLegacyAwards(awards).slice(0, 5);
  const honorRank = season.honorScore !== null && season.honorScore > 0 ? season.honorRank : null;
  return (
    <article data-legacy-season className="gk-cut gk-legacy__season">
      <AtmosphereImage art={ATMOSPHERE.season} />
      <header className="gk-legacy__seasonhead">
        <span className="min-w-0">
          <h4 className="gk-legacy__seasonname gk-display gk-outlined">{t('legacy.seasons.ordinal', { ordinal: season.ordinal })}</h4>
          <span className="gk-legacy__when">
            {season.galaxy} · {legacyDate(season.startsAt)}{season.closedAt ? ` – ${legacyDate(season.closedAt)}` : ''}
          </span>
        </span>
        {season.endReason === 'FORCED_WIPE' && <span className="gk-legacy__flag">{t('legacy.seasons.forced')}</span>}
      </header>
      <div className="gk-legacy__places">
        <PodiumPlace rank={honorRank} label={t('legacy.seasons.honor')} />
        <PodiumPlace rank={season.dominion > 0 ? season.dominionRank : null} label={t('legacy.seasons.dominion')} />
      </div>
      {stats ? (
        <dl className="gk-cmdr__cells gk-well">
          {([
            [t('legacy.seasons.battles'), stats.competition.battles],
            [t('legacy.seasons.shipsBuilt'), stats.competition.shipsBuilt],
            [t('legacy.seasons.asteroidRuns'), stats.exploration.asteroidRuns],
          ] as const).map(([label, value]) => (
            <div key={label} className="gk-cmdr__cell">
              <dt className="gk-label gk-cmdr__label">{label}</dt>
              <dd className="gk-cmdr__value gk-display gk-num">{full(value)}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="gk-legacy__fine">{t('legacy.seasons.noStats')}</p>}
      {shown.length > 0 && (
        <div className="gk-legacy__pieces" aria-label={t('legacy.seasons.pieces')} role="group">
          {shown.map(award => <SeasonPiece key={award.id} award={award} onOpen={() => { onOpen(award); }} />)}
          {awards.length > shown.length && <span className="gk-legacy__more gk-num">+{awards.length - shown.length}</span>}
        </div>
      )}
    </article>
  );
}

type Filter = 'ALL' | LegacyAward['category'];

/** Everything a commander holds, rarest first; on your own profile, the goals still ahead. */
function CollectionPanel({ profile, awards, loading, failed, onOpen, live }: {
  profile: Profile; awards: readonly LegacyCollectedAward[]; loading: boolean; failed: boolean; onOpen: (award: LegacyAward) => void; live: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('ALL');
  const categories = useMemo(() => [...new Set(awards.map(award => award.category))], [awards]);
  const shown = sortLegacyAwards(filter === 'ALL' ? awards : awards.filter(award => award.category === filter));
  return (
    <section className="gk-legacy__part" aria-label={t('legacy.collection.heading')}>
      <SectionTag as="h3" aside={<span className="gk-legacy__count gk-num">{t('legacy.collection.count', { count: awards.length })}</span>}>{t('legacy.collection.heading')}</SectionTag>
      {categories.length > 1 && (
        <div role="group" aria-label={t('legacy.collection.heading')} className="gk-legacy__chips">
          {[{ id: 'ALL' as const, label: t('legacy.collection.all') }, ...categories.map(id => ({ id, label: t(`legacy.category.${id}`) }))].map(option => (
            <Chip key={option.id} on={filter === option.id} onPress={() => { setFilter(option.id); }}>{option.label}</Chip>
          ))}
        </div>
      )}
      {loading && <p className="gk-legacy__note">{t('legacy.collection.loading')}</p>}
      {failed && <Banner tone="hostile" role="alert" title={t('legacy.collection.failed')} />}
      {!loading && !failed && awards.length === 0 && (
        <p className="gk-legacy__note">{profile.self ? t('legacy.collection.emptySelf') : t('legacy.collection.emptyOther')}</p>
      )}
      {shown.length > 0 && (
        <div className="gk-legacy__grid">
          {shown.map(award => <AwardTile key={award.id} award={award} onOpen={() => { onOpen(award); }} />)}
        </div>
      )}
      {profile.self && <NextGoals live={live} />}
    </section>
  );
}

const PREVIEW_GOALS = 6;

/** The open ladders, closest first: the next piece on each and how far along it is. */
function NextGoals({ live }: { live: boolean }) {
  const { t } = useTranslation();
  const progress = useLegacyProgress(true).data;
  const [all, setAll] = useState(false);
  const [opened, setOpened] = useState<{ award: LegacyAward; definition: LegacyDefinition; goal: number; value: number } | null>(null);
  if (!progress) return null;
  const open = progress.achievements.flatMap(row => {
    const definition = LEGACY_CATALOGUE.find(entry => entry.id === row.id);
    const next = definition ? legacyNextGoal(definition, row.progress) : null;
    return definition && next ? [{ definition, next, value: row.progress }] : [];
  }).sort((a, b) => b.value / b.next.goal - a.value / a.next.goal);
  if (open.length === 0) return null;
  const rows = all ? open : open.slice(0, PREVIEW_GOALS);
  return (
    <section className="gk-legacy__part" aria-label={t('legacy.collection.next')}>
      <SectionTag as="h3">{t('legacy.collection.next')}</SectionTag>
      <p className="gk-legacy__note">{t('legacy.collection.nextHint')}</p>
      <div className="gk-legacy__grid">
        {rows.map(({ definition, next, value }) => {
          const placeholder: LegacyAward = {
            id: `next:${definition.id}`, definitionId: definition.id, tier: next.tier, edition: 'career', category: definition.category,
            form: definition.form, rarity: legacyAwardRarity(definition.id, next.tier),
            sourceSeasonId: null, earnedAt: null, grantedAt: new Date(0), seasonOrdinal: null, rank: null,
          };
          return <AwardTile key={definition.id} award={placeholder} onOpen={() => { setOpened({ award: placeholder, definition, goal: next.goal, value }); }}
            locked={{ value: legacyProgressValue(definition, value), goal: legacyProgressValue(definition, next.goal), label: legacyDefinitionName(definition.id) }} />;
        })}
      </div>
      {open.length > PREVIEW_GOALS && (
        <GameButton tone="ghost" wide glyph={all ? 'up' : 'down'} onPress={() => { setAll(!all); }}>{all ? t('legacy.collection.next') : `${t('legacy.collection.all')} · ${String(open.length)}`}</GameButton>
      )}
      {opened && <LockedAwardSheet {...opened} live={live} onClose={() => { setOpened(null); }} />}
    </section>
  );
}
