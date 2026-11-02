/**
 * KOMUTAN MİRASI — the permanent profile. Your own under /profile, anyone else's one tap from
 * where you met them. The shelf is what a commander chose to be seen with; under it, the
 * seasons they lived through; one tab over, everything they hold and what is still ahead.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { legacyAwardRarity, LEGACY_CATALOGUE, LEGACY_SHOWCASE_SLOTS, type LegacyDefinition } from '@astera/rules';
import type { LegacyAward, LegacyCollectedAward, LegacyProfile as Profile, LegacySeason } from '../api/legacySchemas.js';
import { Segmented } from '../v2/kit/Segmented.js';
import { ChoiceChips } from '../v2/kit/ChoiceChips.js';
import { Button, SectionHead } from '../v2/kit/Surface.js';
import { Flag } from '../v2/identity/Flag.js';
import { Medal, isPlace } from '../ui/Medal.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
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
    <div data-legacy-profile className="flex flex-col gap-4 font-v2-ui text-v2-ink">
      <LegacyHeader profile={profile} />
      <Segmented label={t('legacy.title')} options={tabs} value={tab} onChange={setTab} tabId={id => `legacy-tab-${id}`} />
      <div role="tabpanel" aria-labelledby={`legacy-tab-${tab}`} className="flex flex-col gap-4">
        {tab === 'legacy' && <>
          <section className="flex flex-col gap-2" aria-label={t('legacy.shelf.heading')}>
            <SectionHead label={t('legacy.shelf.heading')}
              aside={profile.self ? <Button size="sm" disabled={!collection.isSuccess} onClick={() => { setEditing(true); }}>{t('legacy.shelf.edit')}</Button> : undefined} />
            <ShowcaseShelf live={live}
              slots={Array.from({ length: LEGACY_SHOWCASE_SLOTS }, (_, slot) => profile.showcase.find(row => row.slot === slot)?.award ?? null)}
              onOpen={setOpen} {...(profile.self && collection.isSuccess ? { onEmpty: () => { setEditing(true); } } : {})} />
            {profile.showcase.length === 0 && (
              <p className="text-label text-v2-ink-2">{profile.self ? t('legacy.shelf.emptySelf') : t('legacy.shelf.emptyOther')}</p>
            )}
            {collection.isError && <p role="alert" className="text-label text-v2-hostile">{t('legacy.collection.failed')}</p>}
          </section>
          <SeasonHistory publicId={profile.publicId} awards={awards} onOpen={setOpen} />
          {profile.self && <p className="text-label leading-snug text-v2-ink-3">{t('legacy.permanence')}</p>}
        </>}
        {tab === 'collection' && <CollectionPanel profile={profile} awards={awards} loading={collection.isPending} failed={collection.isError} onOpen={setOpen} live={live} />}
        {tab === 'account' && account}
      </div>
      {open && <AwardSheet profile={profile} award={open} live={live} onClose={() => { setOpen(null); }} />}
      {editing && <ShowcaseEditor collection={awards} current={profile.showcase.map(row => row.awardId)} onClose={() => { setEditing(false); }} />}
    </div>
  );
}

/** Two letters of the name on the brass ring, the name, the flag and the chosen title. */
function LegacyHeader({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation();
  const monogram = Array.from(profile.commanderName).slice(0, 2).join('').toLocaleUpperCase(i18n.resolvedLanguage);
  const best = (rank: number | null) => rank === null ? t('legacy.stats.none') : `#${String(rank)}`;
  return (
    <header className="flex flex-col gap-3">
      <div className="legacy-hero relative -mx-1 flex min-h-[132px] items-end gap-3 overflow-hidden rounded-control border border-v2-line px-3 pb-3 pt-10"
        style={{ ['--legacy-hero-art' as string]: `url(${ATMOSPHERE.commander.src})` }}>
        <span aria-hidden="true" className="legacy-monogram grid size-16 shrink-0 place-items-center rounded-full font-v2-ui text-title font-semibold text-v2-ink">{monogram}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {profile.country && <Flag code={profile.country} language={i18n.resolvedLanguage ?? 'en'} />}
            <span className="min-w-0 break-words text-body font-semibold leading-tight">{profile.commanderName}</span>
          </span>
          {profile.activeTitle ? (
            <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-chip border border-v2-premium/45 bg-v2-void/55 px-2 py-0.5 text-micro font-semibold text-v2-premium">
              <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3"><path fill="currentColor" d="M6 .8l1.5 3.3 3.6.4-2.7 2.4.8 3.5L6 8.6 2.8 10.4l.8-3.5L.9 4.5l3.6-.4z" /></svg>
              <span className="truncate">{legacyAwardTitle(profile.activeTitle)}</span>
            </span>
          ) : profile.self ? <span className="mt-1 block text-micro text-v2-ink-3">{t('legacy.noTitle')}</span> : null}
          <span className="mt-1 block text-micro text-v2-ink-2">{t('legacy.profile.member', { date: legacyDate(profile.joinedAt) })}</span>
        </span>
      </div>
      <dl className="grid grid-cols-4 divide-x divide-v2-line rounded-control border border-v2-line bg-v2-panel py-2 text-center">
        {([
          [t('legacy.stats.seasons'), full(profile.career.seasons)],
          [t('legacy.stats.bestHonor'), best(profile.career.bestHonorRank)],
          [t('legacy.stats.bestDominion'), best(profile.career.bestDominionRank)],
          [t('legacy.stats.pieces'), full(profile.collection.count)],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col-reverse items-center gap-0.5 px-1">
            <dt className="text-micro leading-tight text-v2-ink-3">{label}</dt>
            <dd className="font-v2-mono text-body font-semibold text-v2-ink">{value}</dd>
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
    <section className="flex flex-col gap-2" aria-label={t('legacy.seasons.heading')}>
      <SectionHead label={t('legacy.seasons.heading')} />
      {seasons.isPending && <p role="status" className="text-label text-v2-ink-2">{t('legacy.seasons.loading')}</p>}
      {seasons.isError && <p role="alert" className="text-label text-v2-hostile">{t('legacy.seasons.failed')}</p>}
      {seasons.isSuccess && rows.length === 0 && <p className="text-label text-v2-ink-2">{t('legacy.seasons.empty')}</p>}
      <ol className="flex flex-col gap-2">
        {rows.map(season => (
          <li key={season.resultId}><SeasonCard season={season} awards={awards.filter(award => award.sourceSeasonId === season.seasonId)} onOpen={onOpen} /></li>
        ))}
      </ol>
      {seasons.hasNextPage && (
        <Button variant="ghost" disabled={seasons.isFetchingNextPage} onClick={() => { void seasons.fetchNextPage(); }}>{t('legacy.seasons.more')}</Button>
      )}
    </section>
  );
}

export function PodiumPlace({ rank, label }: { rank: number | null; label: string }) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {rank !== null && isPlace(rank) ? <Medal place={rank} size={20} /> : null}
      <span className="flex flex-col leading-tight">
        <span className="text-micro text-v2-ink-3">{label}</span>
        <span className="font-v2-mono text-caption font-semibold">{rank === null ? t('legacy.seasons.noPlace') : `#${String(rank)}`}</span>
      </span>
    </span>
  );
}

function SeasonCard({ season, awards, onOpen }: { season: LegacySeason; awards: readonly LegacyCollectedAward[]; onOpen: (award: LegacyAward) => void }) {
  const { t } = useTranslation();
  const stats = season.stats;
  const shown = sortLegacyAwards(awards).slice(0, 5);
  const honorRank = season.honorScore !== null && season.honorScore > 0 ? season.honorRank : null;
  return (
    <article data-legacy-season className="legacy-season-card flex flex-col gap-2.5 rounded-control border border-v2-line p-3"
      style={{ ['--legacy-season-art' as string]: `url(${ATMOSPHERE.season.src})` }}>
      <header className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-body font-semibold leading-tight">{t('legacy.seasons.ordinal', { ordinal: season.ordinal })}</span>
          <span className="mt-0.5 block truncate text-micro text-v2-ink-2">
            {season.galaxy} · {legacyDate(season.startsAt)}{season.closedAt ? ` – ${legacyDate(season.closedAt)}` : ''}
          </span>
        </span>
        {season.endReason === 'FORCED_WIPE' && <span className="shrink-0 rounded-chip border border-v2-line-hi px-1.5 py-0.5 text-micro text-v2-ink-2">{t('legacy.seasons.forced')}</span>}
      </header>
      <div className="grid grid-cols-2 gap-2">
        <PodiumPlace rank={honorRank} label={t('legacy.seasons.honor')} />
        <PodiumPlace rank={season.dominion > 0 ? season.dominionRank : null} label={t('legacy.seasons.dominion')} />
      </div>
      {stats ? (
        <dl className="grid grid-cols-3 gap-1 text-center">
          {([
            [t('legacy.seasons.battles'), stats.competition.battles],
            [t('legacy.seasons.shipsBuilt'), stats.competition.shipsBuilt],
            [t('legacy.seasons.asteroidRuns'), stats.exploration.asteroidRuns],
          ] as const).map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse rounded-chip bg-v2-void/45 px-1 py-1">
              <dt className="text-micro leading-tight text-v2-ink-3">{label}</dt>
              <dd className="font-v2-mono text-caption font-semibold">{full(value)}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="text-micro text-v2-ink-3">{t('legacy.seasons.noStats')}</p>}
      {shown.length > 0 && (
        <div className="flex items-center gap-1.5" aria-label={t('legacy.seasons.pieces')} role="group">
          {shown.map(award => (
            <button key={award.id} type="button" onClick={() => { onOpen(award); }} aria-label={legacyAwardTitle(award)}
              data-rarity={award.rarity} className="legacy-tile grid size-11 place-items-center rounded-control focus-visible:outline-2 focus-visible:outline-v2-self">
              <AwardPicture award={award} className="size-10" />
            </button>
          ))}
          {awards.length > shown.length && <span className="font-v2-mono text-micro text-v2-ink-3">+{awards.length - shown.length}</span>}
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
    <section className="flex flex-col gap-3" aria-label={t('legacy.collection.heading')}>
      <SectionHead label={t('legacy.collection.heading')} aside={<span className="font-v2-mono text-micro text-v2-ink-2">{t('legacy.collection.count', { count: awards.length })}</span>} />
      {categories.length > 1 && (
        <ChoiceChips label={t('legacy.collection.heading')} value={filter} onChange={setFilter}
          options={[{ id: 'ALL', label: t('legacy.collection.all') }, ...categories.map(id => ({ id, label: t(`legacy.category.${id}`) }))]} />
      )}
      {loading && <p className="text-label text-v2-ink-2">{t('legacy.collection.loading')}</p>}
      {failed && <p role="alert" className="text-label text-v2-hostile">{t('legacy.collection.failed')}</p>}
      {!loading && !failed && awards.length === 0 && (
        <p className="text-label text-v2-ink-2">{profile.self ? t('legacy.collection.emptySelf') : t('legacy.collection.emptyOther')}</p>
      )}
      {shown.length > 0 && (
        <div className="grid grid-cols-3 gap-2 min-[520px]:grid-cols-4">
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
    <section className="mt-1 flex flex-col gap-2" aria-label={t('legacy.collection.next')}>
      <SectionHead label={t('legacy.collection.next')} />
      <p className="text-label text-v2-ink-3">{t('legacy.collection.nextHint')}</p>
      <div className="grid grid-cols-3 gap-2 min-[520px]:grid-cols-4">
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
        <Button variant="ghost" onClick={() => { setAll(!all); }}>{all ? t('legacy.collection.next') : `${t('legacy.collection.all')} · ${String(open.length)}`}</Button>
      )}
      {opened && <LockedAwardSheet {...opened} live={live} onClose={() => { setOpened(null); }} />}
    </section>
  );
}
