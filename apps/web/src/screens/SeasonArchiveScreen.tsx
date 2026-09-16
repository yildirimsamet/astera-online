import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { fleetEntries, resourceValue } from '@astera/rules';
import type {
  SeasonCommanderProfile,
  SeasonStatsSnapshot,
} from '../api/schemas.js';
import {
  useArchivedLeaderboard,
  useLeaderboard,
  useSeason,
  useSeasonArchive,
  useSeasonCommanderProfile,
} from '../api/queries.js';
import { full, signed } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { haptic } from '../lib/haptics.js';
import { hullLabel } from '../i18n/names.js';
import { BUILDING_ART, HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Medal, Trophy, isPlace } from '../ui/Medal.js';
import {
  AttackIcon, CargoIcon, ClockIcon, DrillIcon, GalaxyIcon, HangarIcon,
  LeaderboardIcon, RaidedIcon, RefineryIcon, RewardIcon, SalvageIcon, ShieldIcon,
  SkullIcon, WarBannerIcon, WorldLostIcon,
} from '../ui/icons/index.js';
import { LeaderboardScreen } from './LeaderboardScreen.js';
import { SeasonRewardBoard } from '../ui/SeasonRewardBoard.js';
import { ArtWell, EmptyState, Section, Segmented, Stat, Unreachable, Waiting } from '../ui/kit/index.js';

type ProfileView = 'season' | 'overall';

/**
 * A PLACE IS A MEDAL BEFORE IT IS A NUMBER.
 *
 * Every competitive surface in this game now colours the first three the same
 * way — the archive ladder, the reward table, the career row and the record's own
 * hero figure. One vocabulary, so a player learns it once and reads it everywhere:
 * gold is first, and the two behind it are the podium. Everything else is quiet
 * on purpose, because a podium that has fifty colours has none.
 */
const MEDAL: Record<1 | 2 | 3, { text: string; ring: string; glow: string }> = {
  1: { text: 'text-opportunity', ring: 'ring-opportunity/60', glow: 'shadow-[0_0_18px_-4px_var(--color-opportunity)]' },
  2: { text: 'text-crystal', ring: 'ring-crystal/50', glow: 'shadow-[0_0_14px_-5px_var(--color-crystal)]' },
  3: { text: 'text-alloy', ring: 'ring-alloy/50', glow: '' },
};
const medalOf = (place: number): { text: string; ring: string; glow: string } | null =>
  place === 1 || place === 2 || place === 3 ? MEDAL[place] : null;

/**
 * WHERE A RANK SITS IN ITS FIELD, as the share a player would say out loud.
 *
 * Rounded UP and floored at one, so the winner of a three-hundred-seat galaxy
 * reads "top 1%" rather than "top 0%" — and nobody is ever told they are the top
 * nought of anything. Null when the field is unknown, because an invented
 * denominator is worse than no boast at all.
 */
const percentile = (rank: number, field: number): number | null =>
  field > 0 && rank > 0 ? Math.max(1, Math.ceil((rank / field) * 100)) : null;
type Stats = SeasonStatsSnapshot;
type Averages = NonNullable<SeasonCommanderProfile['selected']['averages']>;
type SelectedRecord = SeasonCommanderProfile['selected'];

export function SeasonArchiveScreen({
  onFocusPlanet,
}: {
  onFocusPlanet: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const archive = useSeasonArchive();
  const season = useSeason();
  const board = useLeaderboard();
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  /*
    A GALAXY IS NAMED BY ITS CODE HERE, NOT BY ITS DISPLAY NAME. Owner instruction.

    "Season 10 · Vantage" asks the reader to remember which galaxy Vantage was;
    "Season 10 · EU-1" is the address they actually played at and the one they say
    out loud. The pretty name still belongs to the live galaxy's own surfaces —
    this is the archive, where the season number and the seat are the identity.
  */
  const cycles = archive.data?.pages.flatMap((page) => page.cycles) ?? [];
  const completed = cycles.flatMap((cycle) => cycle.galaxies
    .filter((galaxy) => galaxy.status === 'frozen' || galaxy.status === 'wiped')
    .map((galaxy) => ({ ...galaxy, ordinal: cycle.ordinal })));

  const selectSeason = (next: string | null): void => {
    haptic('tap');
    setResultId(null);
    setSeasonId(next);
  };

  return (
    <div>
      <nav
        aria-label={t('leaderboard.archive.selectorLabel')}
        className="border-b border-line-soft bg-void px-2 py-2"
      >
        {/*
          THE STRIP FETCHES ITSELF. Owner instruction: no "load older seasons"
          button — the seasons simply keep arriving as the reader scrolls right.
          A button is a second decision in front of a gesture people already make,
          and on a horizontal rail the gesture IS the request.
        */}
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          onScroll={(event) => {
            const strip = event.currentTarget;
            const remaining = strip.scrollWidth - strip.scrollLeft - strip.clientWidth;
            if (remaining < 240 && archive.hasNextPage && !archive.isFetchingNextPage) {
              void archive.fetchNextPage();
            }
          }}
        >
          <ArchiveChoice
            active={seasonId === null}
            label={t('leaderboard.archive.live')}
            onClick={() => { selectSeason(null); }}
          />
          {completed.map((season) => (
            <ArchiveChoice
              key={season.seasonId}
              active={seasonId === season.seasonId}
              label={t('leaderboard.archive.seasonChoice', {
                ordinal: season.ordinal,
                galaxy: season.shard,
              })}
              onClick={() => { selectSeason(season.seasonId); }}
            />
          ))}
        </div>
        {archive.isFetchingNextPage ? (
          <p className="legend mt-1 text-faint" role="status">
            {t('leaderboard.archive.loadingOlder')}
          </p>
        ) : null}
        {archive.isPending ? (
          <p className="legend mt-1 text-faint" role="status">
            {t('leaderboard.archive.waitingArchive')}
          </p>
        ) : null}
      </nav>

      {archive.isError ? (
        <Unreachable
          what={t('leaderboard.archive.archiveIndex')}
          onRetry={() => { void archive.refetch(); }}
        />
      ) : null}

      {seasonId === null ? (
        <>
          {/*
            THE PRIZE ABOVE THE LADDER IT IS PAID FOR. A commander opening the
            standings is already asking "where am I"; this is the half of that
            question the product never answered — what being there is worth.
          */}
          <SeasonRewardBoard season={season.data} board={board.data} />
          <LeaderboardScreen onFocusPlanet={onFocusPlanet} />
        </>
      ) : resultId === null ? (
        <ArchivedLeaderboard seasonId={seasonId} onOpen={setResultId} />
      ) : (
        <CommanderProfile
          key={resultId}
          resultId={resultId}
          onBack={() => { setResultId(null); }}
          onOpenResult={setResultId}
        />
      )}
    </div>
  );
}

function ArchiveChoice({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`legend min-h-11 shrink-0 rounded-chip border px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crystal ${
        active
          ? 'border-crystal/50 bg-crystal/10 text-crystal'
          : 'border-line bg-raised text-dim hover:text-bone'
      }`}
    >
      {label}
    </button>
  );
}

function ArchivedLeaderboard({
  seasonId,
  onOpen,
}: {
  seasonId: string;
  onOpen: (resultId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const board = useArchivedLeaderboard(seasonId);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const locale = i18n.resolvedLanguage === 'tr' ? 'tr-TR' : 'en-US';
    const needle = query.trim().toLocaleLowerCase(locale);
    return board.data?.ladder.filter((row) =>
      row.commanderName.toLocaleLowerCase(locale).includes(needle)) ?? [];
  }, [board.data, i18n.resolvedLanguage, query]);

  if (board.isError) {
    return <Unreachable what={t('leaderboard.archive.completedBoard')} onRetry={() => { void board.refetch(); }} />;
  }
  if (!board.data) return <Waiting>{t('leaderboard.archive.waitingBoard')}</Waiting>;
  if (board.data.ladder.length === 0) {
    return <div className="px-2 py-6"><EmptyState title={t('leaderboard.archive.emptyBoard')} /></div>;
  }

  return (
    <div>
      <header className="border-b border-line-soft px-2 py-3">
        <p className="legend flex items-center gap-1.5 text-crystal">
          <LeaderboardIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {t('leaderboard.archive.seasonHeading', {
              ordinal: board.data.season.ordinal,
              galaxy: board.data.season.shard,
            })}
          </span>
          <span className="rail-soft flex-1" />
          <span className="num shrink-0 text-micro text-faint">
            {t('leaderboard.archive.fieldSize', { count: board.data.ladder.length })}
          </span>
        </p>
        <input
          type="search"
          name="season-archive-search"
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); }}
          aria-label={t('leaderboard.archive.searchLabel')}
          placeholder={t('leaderboard.archive.searchPlaceholder')}
          className="field mt-2 min-h-11 w-full"
        />
      </header>
      {rows.length === 0 ? (
        <div className="px-2 py-6"><EmptyState title={t('leaderboard.archive.noMatch')} /></div>
      ) : (
        <ol className="divide-y divide-line-soft" aria-label={t('leaderboard.archive.completedBoard')}>
          {rows.map((row) => (
            <li key={row.resultId} aria-current={row.self ? 'true' : undefined}>
              <button
                type="button"
                aria-label={t('leaderboard.archive.openCommander', { commander: row.commanderName })}
                onClick={() => {
                  haptic('tap');
                  onOpen(row.resultId);
                }}
                className={`grid min-h-16 w-full grid-cols-[2rem_2.25rem_minmax(0,1fr)_auto] items-center gap-2 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-crystal ${row.self ? 'bg-crystal/8' : 'hover:bg-raised/60'}`}
              >
                {/* An object for the podium, a numeral for everybody else. */}
                {isPlace(row.rank) ? (
                  <Medal place={row.rank} size={26} className="mx-auto text-crystal/70" />
                ) : (
                  <span className={`num text-center text-body ${row.self ? 'text-crystal' : 'text-faint'}`}>
                    {row.rank}
                  </span>
                )}
                {/*
                  A FACE FOR A NAME. The live ladder gives every commander their
                  world's emblem and the archive gave them a line of text — so the
                  permanent record, the one people scroll through looking for
                  somebody, was the surface with the least identity on it. Seeded
                  from the result id, which is stable for that commander in that
                  season for ever.
                */}
                <span
                  className={`inline-block rounded-full ${
                    medalOf(row.rank) ? `ring-1 ${medalOf(row.rank)?.ring ?? ''}` : ''
                  }`}
                >
                  <PlanetSigil seed={row.resultId} size={36} />
                </span>
                <span className="min-w-0">
                  <strong className="name block truncate text-bone">{row.commanderName}</strong>
                  <span className="mt-1 block truncate text-label text-faint">{row.title}</span>
                </span>
                <span className="text-right">
                  <span className="num block text-body text-opportunity">
                    {row.dominion === 0 ? full(0) : signed(row.dominion)}
                  </span>
                  <span className="legend block">{t('leaderboard.score')}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CommanderProfile({
  resultId,
  onBack,
  onOpenResult,
}: {
  resultId: string;
  onBack: () => void;
  onOpenResult: (resultId: string) => void;
}) {
  const { t } = useTranslation();
  const profile = useSeasonCommanderProfile(resultId);
  const [view, setView] = useState<ProfileView>('season');
  if (profile.isError) {
    return <Unreachable what={t('leaderboard.archive.commanderCard')} onRetry={() => { void profile.refetch(); }} />;
  }
  if (!profile.data) return <Waiting>{t('leaderboard.archive.waitingProfile')}</Waiting>;
  const { selected } = profile.data;
  const standing = percentile(selected.rank, selected.commanders ?? 0);
  const openResult = (nextResultId: string): void => {
    if (nextResultId === selected.resultId) {
      setView('season');
      return;
    }
    onOpenResult(nextResultId);
  };

  return (
    <div className="px-2 pb-5 pt-3">
      <button type="button" onClick={onBack} className="legend min-h-11 text-crystal">
        ← {t('leaderboard.archive.back')}
      </button>
      {/*
        A RECORD SOMEBODY WOULD SHOW SOMEBODY ELSE.

        This was a bare plate with three lines of text on it, and a season a player
        spent a month on read like a receipt. The recap screen already knows what
        the ceremony looks like — a lit ground, the world itself, the title before
        the numbers — and a commander's permanent record deserves the same. The
        glow is two radial washes behind the plate, the same pair `SeasonRecap`
        uses, so the two surfaces are recognisably the same moment.
      */}
      <header className="plate plate-cut relative overflow-hidden px-3 py-5 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(89,200,255,0.18),transparent_55%),radial-gradient(circle_at_18%_100%,rgba(90,211,155,0.10),transparent_45%)]"
        />
        <div className="relative">
          {/*
            THE WORLD, AND THE MEDAL HUNG ON IT.

            The sigil is who; the medal is what they took. Overlapped rather than
            placed side by side, because a medal beside a picture is a legend and
            a medal ON it is an award.
          */}
          <span className="relative inline-block">
            <span
              className={`inline-block rounded-full ${
                medalOf(selected.rank)
                  ? `ring-2 ${medalOf(selected.rank)?.ring ?? ''} ${medalOf(selected.rank)?.glow ?? ''}`
                  : ''
              }`}
            >
              <PlanetSigil seed={selected.seasonId + selected.commanderName} size={64} />
            </span>
            {isPlace(selected.rank) ? (
              <Medal
                place={selected.rank}
                size={34}
                className="absolute -bottom-2 -right-2 text-crystal/70 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
              />
            ) : null}
          </span>
          <p className="legend mt-3 text-crystal">
            {t('leaderboard.archive.seasonHeading', { ordinal: selected.ordinal, galaxy: selected.shard })}
          </p>
          <h2 className="headline mt-2 text-title text-bone">{selected.commanderName}</h2>
          <p className="mt-1 text-label text-faint">{selected.title} · {selected.planetName}</p>
          {/*
            THE LINE A PLAYER QUOTES. A rank without its field is not a boast —
            first of four and first of three hundred read identically — so the
            share comes first and the raw position follows it.
          */}
          {standing === null ? null : (
            <p className={`legend mt-3 ${medalOf(selected.rank)?.text ?? 'text-crystal'}`}>
              {t('leaderboard.archive.percentile', {
                share: standing,
                rank: full(selected.rank),
                commanders: full(selected.commanders ?? 0),
              })}
            </p>
          )}
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <HeroFigure
            icon={<LeaderboardIcon className="size-4" />}
            label={t('leaderboard.archive.metrics.finalRank')}
            value={`#${full(selected.rank)}`}
            tone={selected.rank === 1 ? 'opportunity' : selected.rank <= 3 ? 'crystal' : 'bone'}
          />
          <HeroFigure
            icon={<GalaxyIcon className="size-4" />}
            label={t('leaderboard.score')}
            value={selected.dominion === 0 ? full(0) : signed(selected.dominion)}
            tone={selected.dominion > 0 ? 'opportunity' : 'bone'}
          />
        </div>
      </header>
      <Segmented
        role="tablist"
        className="mt-3"
        label={t('leaderboard.archive.profileViews')}
        value={view}
        onSelect={setView}
        segments={[
          { id: 'season', label: t('leaderboard.archive.seasonTab', { ordinal: selected.ordinal }) },
          { id: 'overall', label: t('leaderboard.archive.overall') },
        ]}
      />
      {view === 'season' ? (
        <SeasonStats profile={profile.data} />
      ) : (
        <CareerStats profile={profile.data} onOpenResult={openResult} />
      )}
    </div>
  );
}

/**
 * THE SHIP THIS COMMANDER ACTUALLY IS.
 *
 * A season produces one fact nobody else's record has: the hull you reached for
 * over and over. It is already in the snapshot — `shipsBuiltByHull` — and it was
 * being rendered as a line in a list. Lifted out and put in an art well at the top
 * of the war section, it becomes the thing a player points at: *that* is my ship.
 *
 * Ties break on the hull's own order rather than on whichever key the JSON
 * happened to serialise first, so the same season always names the same ship.
 */
function signatureHull(fleet: Stats['competition']['shipsBuiltByHull']): {
  hull: Parameters<typeof hullLabel>[0];
  count: number;
} | null {
  let best: { hull: Parameters<typeof hullLabel>[0]; count: number } | null = null;
  for (const [hull, count] of fleetEntries(fleet)) {
    if (count <= 0) continue;
    if (!best || count > best.count) best = { hull, count };
  }
  return best;
}

/**
 * THE FIGURES A COMMANDER REPEATS TO SOMEBODY ELSE.
 *
 * Everything above this is a COUNT — how many battles, how much ore. Counts say
 * how much you played. They do not say how WELL, and "how well" is the half a
 * player is actually proud of, argues about, and comes back to improve.
 *
 * Every one of these is a ratio of two figures the snapshot already sealed, so
 * they cost no new telemetry, no migration and no second season of waiting: they
 * are the same data asked a better question. And each is compared against the
 * field's own ratio — the cohort's average dealt over the cohort's average taken
 * — so "3.0x" always means "three times, where most commanders manage one".
 *
 * A ratio with nothing underneath it is not humility, it is a division by zero,
 * so a commander who never fought simply does not get the card.
 */
/** The typed keys, so a dynamic label never reaches the typed translator. */
const RATIO_LABEL = {
  trade: 'leaderboard.archive.ratios.trade',
  haul: 'leaderboard.archive.ratios.haul',
  kept: 'leaderboard.archive.ratios.kept',
  convoy: 'leaderboard.archive.ratios.convoy',
  hourly: 'leaderboard.archive.ratios.hourly',
  perRun: 'leaderboard.archive.ratios.perRun',
} as const;
type RatioId = keyof typeof RATIO_LABEL;

interface Ratio {
  id: RatioId;
  icon: ReactNode;
  /** Already formatted: these are multiples, shares and rates, not totals. */
  value: string;
  mine: number;
  theirs: number;
  praise: boolean;
}

function ratios(stats: Stats, averages: Averages): Ratio[] {
  const out: Ratio[] = [];
  const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
  const add = (
    id: RatioId,
    icon: ReactNode,
    mine: number | null,
    theirs: number | null,
    format: (value: number) => string,
    praise = true,
  ): void => {
    if (mine === null || theirs === null) return;
    out.push({ id, icon, value: format(mine), mine, theirs, praise });
  };
  const times = (value: number): string => `×${value.toFixed(1)}`;
  const percent = (value: number): string =>
    i18n.t('leaderboard.archive.share', { value: Math.round(value * 100) });

  // What you did to them against what they did to you.
  add(
    'trade',
    <SkullIcon className="size-3.5" />,
    ratio(stats.competition.damageDealt, stats.competition.damageTaken),
    ratio(averages.competition.damageDealt, averages.competition.damageTaken),
    times,
  );
  // What one raid was worth, which is the difference between raiding and flailing.
  add(
    'haul',
    <SalvageIcon className="size-3.5" />,
    ratio(resourceValue(stats.competition.playerLoot), stats.competition.attacks),
    ratio(resourceValue(averages.competition.playerLoot), averages.competition.attacks),
    (value) => full(value),
  );
  // How much of the fleet you built came home.
  const kept = (lost: number, built: number): number | null =>
    built > 0 ? Math.max(0, 1 - lost / built) : null;
  add(
    'kept',
    <HangarIcon className="size-3.5" />,
    kept(stats.competition.shipsLost, stats.competition.shipsBuilt),
    kept(averages.competition.shipsLost, averages.competition.shipsBuilt),
    percent,
  );
  // Whether the merchant was a plan or a gamble.
  add(
    'convoy',
    <CargoIcon className="size-3.5" />,
    ratio(stats.exploration.convoySuccesses, stats.exploration.convoyAttempts),
    ratio(averages.exploration.convoySuccesses, averages.exploration.convoyAttempts),
    percent,
  );
  // What an hour of your works was actually worth.
  add(
    'hourly',
    <RefineryIcon className="size-3.5" />,
    ratio(resourceValue(stats.economy.produced), stats.economy.productiveSeconds / 3_600),
    ratio(resourceValue(averages.economy.produced), averages.economy.productiveSeconds / 3_600),
    (value) => full(value),
  );
  // What one asteroid run brought back.
  add(
    'perRun',
    <DrillIcon className="size-3.5" />,
    ratio(resourceValue(stats.exploration.asteroidMined), stats.exploration.asteroidRuns),
    ratio(resourceValue(averages.exploration.asteroidMined), averages.exploration.asteroidRuns),
    (value) => full(value),
  );
  return out;
}

function SeasonStats({ profile }: { profile: SeasonCommanderProfile }) {
  const { t } = useTranslation();
  const { selected } = profile;
  if (!selected.stats || !selected.averages) {
    if (selected.legacyStats && selected.legacyAverages) {
      return <LegacySeasonStats selected={selected} />;
    }
    /*
      AN HONEST GAP, DRESSED AS ONE.

      Seasons played before the galaxy kept telemetry have a rank, a title and a
      story and no figures — and the first draft answered that with a bare error
      box, which reads as "something is broken" rather than "this is how far the
      record goes". The world and the title stay; only the numbers are missing,
      and the card says exactly that.
    */
    return (
      <div className="plate plate-sunk mt-3 flex items-center gap-3 px-3 py-4">
        <ArtWell src={BUILDING_ART.VAULT} alt="" size="sm" />
        <div className="min-w-0">
          <p className="name text-bone">{t('leaderboard.archive.statsUnavailable')}</p>
          <p className="mt-1 text-label leading-snug text-faint">
            {t('leaderboard.archive.statsUnavailableHint')}
          </p>
        </div>
      </div>
    );
  }
  const stats = selected.stats;
  const averages = selected.averages;
  const signature = signatureHull(stats.competition.shipsBuiltByHull);
  const best = ratios(stats, averages);
  return (
    <div className="mt-4 space-y-5">
      <RecordNotices selected={selected} />
      <p className="text-label text-faint">
        {t('leaderboard.archive.cohort', { count: averages.cohortSize })}
      </p>
      {best.length === 0 ? null : (
        <Section icon={<RewardIcon className="size-3.5" />} label={t('leaderboard.archive.sections.form')}>
          <div className="grid grid-cols-2 gap-2">
            {best.map((item) => (
              <div key={item.id} className="plate plate-sunk px-3 py-3">
                <p className="legend flex items-center gap-1.5 text-crystal">
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{t(RATIO_LABEL[item.id])}</span>
                </p>
                <p className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="num truncate text-body text-bone">{item.value}</span>
                  {item.theirs > 0 ? (
                    <span
                      className={`num shrink-0 text-label ${
                        item.praise && item.mine >= item.theirs ? 'text-opportunity' : 'text-faint'
                      }`}
                    >
                      {t('leaderboard.archive.multiple', {
                        value: (item.mine / item.theirs).toFixed(1),
                      })}
                    </span>
                  ) : null}
                </p>
                <Bar
                  share={shares(item.mine, item.theirs).mine}
                  tone={item.praise && item.mine >= item.theirs ? 'ahead' : 'plain'}
                />
                <p className="mt-2 truncate text-micro text-faint">
                  {t('leaderboard.archive.averageShort', {
                    value: item.id === 'kept' || item.id === 'convoy'
                      ? t('leaderboard.archive.share', { value: Math.round(item.theirs * 100) })
                      : item.id === 'trade'
                        ? `×${item.theirs.toFixed(1)}`
                        : full(item.theirs),
                  })}
                </p>
                <Bar share={shares(item.mine, item.theirs).theirs} tone="field" />
              </div>
            ))}
          </div>
        </Section>
      )}
      <RecapStories recap={selected.recap} />
      <Section icon={<WarBannerIcon className="size-3.5" />} label={t('leaderboard.archive.sections.competition')}>
        {signature === null ? null : (
          <div className="plate plate-cut flex items-center gap-3 px-3 py-3">
            {/*
              THE GAME'S OWN RENDER, AT THE SIZE IT WAS PAINTED FOR. `ArtWell` is
              the lit socket the rest of the game shows a hull in; a season record
              that drew ships at 24px in a list was the one surface treating this
              project's most expensive art as a favicon.
            */}
            <ArtWell src={HULL_ART[signature.hull]} alt="" size="sm" />
            <div className="min-w-0">
              <p className="legend text-crystal">{t('leaderboard.archive.signature')}</p>
              <p className="name mt-1 truncate text-bone">{hullLabel(signature.hull)}</p>
              <p className="num mt-0.5 text-label text-faint">
                {t('leaderboard.archive.signatureCount', { count: signature.count })}
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <ComparedStat icon={<WarBannerIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.battles')} value={stats.competition.battles} average={averages.competition.battles} />
          <ComparedStat icon={<AttackIcon className="size-3.5" />} label={t('seasonRecap.attacks')} value={stats.competition.attacks} average={averages.competition.attacks} />
          <ComparedStat icon={<ShieldIcon className="size-3.5" />} label={t('seasonRecap.defences')} value={stats.competition.defences} average={averages.competition.defences} />
          <ComparedStat icon={<SkullIcon className="size-3.5" />} label={t('seasonRecap.damageDealt')} value={stats.competition.damageDealt} average={averages.competition.damageDealt} />
          <ComparedStat icon={<RaidedIcon className="size-3.5" />} label={t('seasonRecap.damageTaken')} value={stats.competition.damageTaken} average={averages.competition.damageTaken} praise={false} />
          <ComparedStat icon={<HangarIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.shipsBuilt')} value={stats.competition.shipsBuilt} average={averages.competition.shipsBuilt} />
          <ComparedStat icon={<WorldLostIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.shipsLost')} value={stats.competition.shipsLost} average={averages.competition.shipsLost} praise={false} />
        </div>
        <ResourceStats icon={<SalvageIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.playerLoot')} value={stats.competition.playerLoot} average={averages.competition.playerLoot} />
        <div className="grid grid-cols-2 gap-2">
          <HullBreakdown
            label={t('leaderboard.archive.metrics.shipsBuiltByHull')}
            fleet={stats.competition.shipsBuiltByHull}
          />
          <HullBreakdown
            label={t('leaderboard.archive.metrics.shipsLostByHull')}
            fleet={stats.competition.shipsLostByHull}
          />
        </div>
      </Section>
      <Section icon={<RefineryIcon className="size-3.5" />} label={t('leaderboard.archive.sections.economy')}>
        {/*
          THE WORKS THAT MADE IT, at the size they were painted for. The three
          sections now open the same way — a render, a name, a headline figure —
          so the card has a rhythm a reader can ride instead of a wall to climb.
        */}
        <LeadCard
          art={BUILDING_ART.CORE}
          label={t('leaderboard.archive.leadWorks')}
          value={full(
            stats.economy.produced.alloy
            + stats.economy.produced.crystal
            + stats.economy.produced.deuterium,
          )}
          note={t('leaderboard.archive.leadProduced')}
        />
        <ComparedStat
          icon={<ClockIcon className="size-3.5" />}
          label={t('leaderboard.archive.metrics.productiveTime')}
          value={duration(stats.economy.productiveSeconds / 60)}
          average={duration(averages.economy.productiveSeconds / 60)}
        />
        <ResourceStats icon={<RefineryIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.produced')} value={stats.economy.produced} average={averages.economy.produced} />
      </Section>
      <Section icon={<DrillIcon className="size-3.5" />} label={t('leaderboard.archive.sections.exploration')}>
        <LeadCard
          art={HULL_ART.PROSPECTOR}
          label={t('leaderboard.archive.metrics.asteroidMined')}
          value={full(
            stats.exploration.asteroidMined.alloy
            + stats.exploration.asteroidMined.crystal
            + stats.exploration.asteroidMined.deuterium,
          )}
          note={t('leaderboard.archive.leadRuns', { count: stats.exploration.asteroidRuns })}
        />
        <div className="grid grid-cols-2 gap-2">
          <ComparedStat icon={<DrillIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.asteroidRuns')} value={stats.exploration.asteroidRuns} average={averages.exploration.asteroidRuns} />
          <ComparedStat icon={<CargoIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.convoyAttempts')} value={stats.exploration.convoyAttempts} average={averages.exploration.convoyAttempts} />
          <ComparedStat icon={<CargoIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.convoySuccesses')} value={stats.exploration.convoySuccesses} average={averages.exploration.convoySuccesses} />
        </div>
        <ResourceStats icon={<DrillIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.asteroidMined')} value={stats.exploration.asteroidMined} average={averages.exploration.asteroidMined} />
        <ResourceStats icon={<CargoIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.convoyDelivered')} value={stats.exploration.convoyDelivered} average={averages.exploration.convoyDelivered} />
      </Section>
    </div>
  );
}

function RecordNotices({ selected }: { selected: SelectedRecord }) {
  const { t } = useTranslation();
  return (
    <>
      {selected.endReason === 'FORCED_WIPE' ? (
        <ArchiveNotice
          title={t('leaderboard.archive.forcedEnd.title')}
          hint={t('leaderboard.archive.forcedEnd.hint')}
        />
      ) : null}
      {selected.stats?.coverage?.reason === 'TELEMETRY_CUTOVER' ? (
        <ArchiveNotice
          title={t('leaderboard.archive.partialStats.title')}
          hint={t('leaderboard.archive.partialStats.hint')}
        />
      ) : null}
    </>
  );
}

function ArchiveNotice({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="plate plate-sunk flex items-center gap-3 px-3 py-4">
      <ArtWell src={BUILDING_ART.VAULT} alt="" size="sm" />
      <div className="min-w-0">
        <p className="name text-bone">{title}</p>
        <p className="mt-1 text-label leading-snug text-faint">{hint}</p>
      </div>
    </div>
  );
}

function LegacySeasonStats({ selected }: { selected: SelectedRecord }) {
  const { t } = useTranslation();
  const legacy = selected.legacyStats;
  const averages = selected.legacyAverages;
  if (!legacy || !averages) return null;
  return (
    <div className="mt-4 space-y-5">
      <ArchiveNotice
        title={t('leaderboard.archive.legacyStats.title')}
        hint={t('leaderboard.archive.legacyStats.hint')}
      />
      <RecordNotices selected={selected} />
      <p className="text-label text-faint">
        {t('leaderboard.archive.cohort', { count: averages.cohortSize })}
      </p>
      <RecapStories recap={selected.recap} />
      <Section
        icon={<WarBannerIcon className="size-3.5" />}
        label={t('leaderboard.archive.sections.competition')}
      >
        <div className="grid grid-cols-2 gap-2">
          <ComparedStat icon={<WarBannerIcon className="size-3.5" />} label={t('leaderboard.archive.metrics.battles')} value={legacy.competition.battles} average={averages.competition.battles} />
          <ComparedStat icon={<AttackIcon className="size-3.5" />} label={t('seasonRecap.attacks')} value={legacy.competition.attacks} average={averages.competition.attacks} />
          <ComparedStat icon={<ShieldIcon className="size-3.5" />} label={t('seasonRecap.defences')} value={legacy.competition.defences} average={averages.competition.defences} />
          <ComparedStat icon={<SkullIcon className="size-3.5" />} label={t('seasonRecap.damageDealt')} value={legacy.competition.damageDealt} average={averages.competition.damageDealt} />
          <ComparedStat icon={<RaidedIcon className="size-3.5" />} label={t('seasonRecap.damageTaken')} value={legacy.competition.damageTaken} average={averages.competition.damageTaken} praise={false} />
        </div>
      </Section>
    </div>
  );
}

function RecapStories({ recap }: { recap: SelectedRecord['recap'] }) {
  const { t } = useTranslation();
  if (recap.biggestRaid === null && recap.rival === null) return null;
  return (
    <div className="grid grid-cols-1 gap-2">
      {recap.biggestRaid === null ? null : (
        <div className="plate plate-cut px-3 py-3">
          <p className="legend text-opportunity">{t('seasonRecap.biggestHeading')}</p>
          <p className="mt-1 text-body text-bone">
            {t('seasonRecap.biggestRaid', {
              name: recap.biggestRaid.opponentName,
              value: full(recap.biggestRaid.value),
            })}
          </p>
        </div>
      )}
      {recap.rival === null ? null : (
        <div className="plate plate-cut px-3 py-3">
          <p className="legend text-crystal">{t('seasonRecap.rivalHeading')}</p>
          <p className="mt-1 text-body text-bone">
            {t('seasonRecap.rival', {
              name: recap.rival.commanderName,
              count: recap.rival.battles,
            })}
          </p>
        </div>
      )}
    </div>
  );
}

function HullBreakdown({
  label,
  fleet,
}: {
  label: string;
  fleet: Stats['competition']['shipsBuiltByHull'];
}) {
  const { t } = useTranslation();
  const entries = fleetEntries(fleet);
  return (
    <div className="plate plate-sunk min-w-0 px-3 py-3">
      <p className="legend text-crystal">{label}</p>
      {entries.length === 0 ? (
        <p className="mt-2 text-label text-faint">{t('leaderboard.archive.none')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {entries.map(([hull, count]) => (
            <li key={hull} className="flex min-w-0 items-center gap-2 text-label">
              {/*
                THE HULL'S OWN RENDER. A list of ship NAMES asks the reader to
                remember what a Dart looks like; the card the player bought it
                from showed them, and this is the same picture.
              */}
              {HULL_ART[hull] === null ? null : (
                <img
                  src={HULL_ART[hull]}
                  alt=""
                  className="size-6 shrink-0 object-contain"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-dim">{hullLabel(hull)}</span>
              <span className="num shrink-0 text-bone">{full(count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CareerStats({
  profile,
  onOpenResult,
}: {
  profile: SeasonCommanderProfile;
  onOpenResult: (resultId: string) => void;
}) {
  const { t } = useTranslation();
  const { career } = profile;
  return (
    <div className="mt-4 space-y-5">
      <div className="plate plate-cut grid grid-cols-2 gap-4 px-3 py-4">
        {/*
          A CAREER IS A SHELF, NOT A TABLE. Championships and podiums are the two
          figures a commander would point at, so they carry the medal colours the
          rest of the game uses for the same places — and a shelf with nothing on
          it still shows its empty places, because those are what the next season
          is for.
        */}
        <Stat label={t('leaderboard.archive.career.completed')} value={full(career.completedSeasons)} />
        <Stat
          label={t('leaderboard.archive.career.bestRank')}
          value={career.bestRank === null ? '—' : `#${full(career.bestRank)}`}
          tone={career.bestRank === null ? 'dim' : career.bestRank === 1 ? 'opportunity' : career.bestRank <= 3 ? 'crystal' : 'bone'}
        />
        <div className="min-w-0">
          <p className="legend flex items-center gap-1.5 truncate">
            <Trophy won={career.championships > 0} size={16} />
            <span className="truncate">{t('leaderboard.archive.career.championships')}</span>
          </p>
          <p className={`num mt-2 text-figure ${career.championships > 0 ? 'text-opportunity' : 'text-dim'}`}>
            {full(career.championships)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="legend flex items-center gap-1 truncate">
            {/* The podium, stated as the three metals it is made of. */}
            <span className="flex shrink-0 -space-x-1">
              <Medal place={1} size={13} plain />
              <Medal place={2} size={13} plain />
              <Medal place={3} size={13} plain />
            </span>
            <span className="truncate">{t('leaderboard.archive.career.podiums')}</span>
          </p>
          <p className={`num mt-2 text-figure ${career.podiums > 0 ? 'text-crystal' : 'text-dim'}`}>
            {full(career.podiums)}
          </p>
        </div>
        <Stat label={t('leaderboard.archive.career.topTen')} value={full(career.topTen)} />
      </div>
      <Section
        label={t('leaderboard.archive.career.recordedCombatTotals')}
        aside={t('leaderboard.archive.career.covered', {
          count: career.competitionTotals.seasonsCovered,
        })}
      >
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('leaderboard.archive.metrics.battles')} value={full(career.competitionTotals.battles)} />
          <Stat label={t('seasonRecap.attacks')} value={full(career.competitionTotals.attacks)} />
          <Stat label={t('seasonRecap.damageDealt')} value={full(career.competitionTotals.damageDealt)} />
          <Stat label={t('seasonRecap.damageTaken')} value={full(career.competitionTotals.damageTaken)} />
        </div>
      </Section>
      {career.totals === null ? (
        <EmptyState title={t('leaderboard.archive.career.noTelemetry')} />
      ) : (
        <Section
          label={t('leaderboard.archive.career.recordedTotals')}
          aside={career.totals.partialSeasons > 0
            ? t('leaderboard.archive.career.coveredWithPartial', {
              count: career.totals.seasonsCovered,
              partial: career.totals.partialSeasons,
            })
            : t('leaderboard.archive.career.covered', { count: career.totals.seasonsCovered })}
        >
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('leaderboard.archive.metrics.battles')} value={full(career.totals.stats.competition.battles)} />
            <Stat label={t('leaderboard.archive.metrics.shipsBuilt')} value={full(career.totals.stats.competition.shipsBuilt)} />
            <Stat label={t('leaderboard.archive.metrics.asteroidRuns')} value={full(career.totals.stats.exploration.asteroidRuns)} />
            <Stat label={t('leaderboard.archive.metrics.convoySuccesses')} value={full(career.totals.stats.exploration.convoySuccesses)} />
          </div>
        </Section>
      )}
      <Section label={t('leaderboard.archive.career.seasons')}>
        <ol className="divide-y divide-line-soft rounded-plate border border-line-soft">
          {career.seasons.map((season) => (
            <li key={season.resultId}>
              <button
                type="button"
                aria-label={t('leaderboard.archive.openSeasonRecord', {
                  ordinal: season.ordinal,
                  galaxy: season.shard,
                })}
                onClick={() => {
                  haptic('tap');
                  onOpenResult(season.resultId);
                }}
                className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left hover:bg-raised/60 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-crystal"
              >
                {/*
                  THE SHELF, READ AT A GLANCE. A career is scanned for its medals,
                  not for its rows, so a podium finish carries its object and
                  everything else carries a quiet numeral — the same vocabulary as
                  the ladder it came from.
                */}
                {isPlace(season.rank) ? (
                  <Medal place={season.rank} size={26} className="text-crystal/70" />
                ) : (
                  <span className="num w-7 shrink-0 text-center text-body text-faint">
                    #{full(season.rank)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <strong className="name block truncate text-bone">
                    {t('leaderboard.archive.seasonNumber', { ordinal: season.ordinal })}
                  </strong>
                  <span className="block truncate text-label text-faint">
                    {season.shard} · {season.title}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`num block text-body ${
                      season.dominion > 0 ? 'text-opportunity' : season.dominion < 0 ? 'text-threat' : 'text-dim'
                    }`}
                  >
                    {season.dominion === 0 ? full(0) : signed(season.dominion)}
                  </span>
                  <span className="legend block">{t('leaderboard.score')}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/**
 * THE HERO FIGURE OF A RECORD — the two numbers the whole season comes down to.
 */
function HeroFigure({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'opportunity' | 'crystal' | 'bone';
}) {
  return (
    <div className="plate plate-sunk px-3 py-3 text-left">
      <p className="legend flex items-center gap-1.5 text-crystal">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className={`num mt-2 text-figure text-${tone}`}>{value}</p>
    </div>
  );
}

/**
 * ABOVE OR BELOW, ANSWERED WITHOUT ARITHMETIC. Owner instruction: *"istatistik
 * karşılaştırmaları hiç bir halt yok"*.
 *
 * Two numbers side by side is not a comparison — it is two numbers, and the
 * reader has to do the division themselves on every row of a long card. The bar
 * does it: the fill is this commander, the notch is the cohort, and whether the
 * fill has passed the notch is the entire question. Scaled off the LARGER of the
 * two so both are always on the bar and neither can run off the end.
 *
 * The figures stay printed above it. A bar alone is a feeling; the record has to
 * be quotable, and "50.000 karşı 27.000" is what gets said out loud.
 */
/**
 * ONE BAR. Two of these stacked ARE the comparison.
 *
 * The first draft drew the cohort as a notch standing inside the reader's own bar,
 * and the owner's verdict was the only one that matters: *"dikey çizgiler neyi
 * ifade ediyor anlaşılmıyor"*. A mark that needs a legend has already failed, and
 * there is no room for a legend on twenty-six cards.
 *
 * So each figure gets its own bar directly beneath the number that names it: the
 * reader's own, bright, then the field's, thinner and dimmer. Which is longer is
 * the whole answer, and nothing has to be decoded to see it.
 */
function Bar({ share, tone }: { share: number; tone: 'ahead' | 'plain' | 'field' }) {
  const height = tone === 'field' ? 'h-1' : 'h-2';
  const fill = tone === 'ahead'
    ? 'bg-gradient-to-r from-crystal/70 to-opportunity shadow-[0_0_10px_-1px_var(--color-opportunity)]'
    : tone === 'plain'
      ? 'bg-gradient-to-r from-line to-crystal/70'
      : 'bg-bone/35';
  return (
    <span aria-hidden className={`relative mt-1 block w-full ${height}`}>
      <span
        className={`absolute inset-0 rounded-full bg-void/70 ring-1 ring-inset ${
          tone === 'field' ? 'ring-line/25' : 'ring-line/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)]'
        }`}
      />
      <span
        data-bar={tone}
        className={`absolute inset-y-0 left-0 rounded-full ${fill}`}
        style={{ width: `${String(Math.max(0, Math.min(100, share)))}%` }}
      />
    </span>
  );
}

/** The two shares one comparison is drawn from, on one shared scale. */
const shares = (value: number, average: number): { mine: number; theirs: number } => {
  const span = Math.max(value, average, 1) * 1.15;
  return {
    mine: Math.max(value > 0 ? 1.5 : 0, (value / span) * 100),
    theirs: Math.max(average > 0 ? 1.5 : 0, (average / span) * 100),
  };
};

/**
 * A SECTION'S OPENING LINE: the render, the headline, and what it was made of.
 *
 * One shape for all three sections, so the card reads as a designed object rather
 * than as three tables stacked. The art is the subject and the number is the
 * boast; the note underneath is the only place a qualifier is allowed.
 */
function LeadCard({
  art,
  label,
  value,
  note,
}: {
  art: string | null;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="plate plate-cut flex items-center gap-3 px-3 py-3">
      <ArtWell src={art} alt="" size="sm" />
      <div className="min-w-0">
        <p className="legend truncate text-crystal">{label}</p>
        <p className="num mt-1 truncate text-figure text-bone">{value}</p>
        <p className="mt-0.5 truncate text-label text-faint">{note}</p>
      </div>
    </div>
  );
}

function ComparedStat({
  icon,
  label,
  value,
  average,
  praise = true,
}: {
  icon?: ReactNode;
  label: string;
  value: number | string;
  average: number | string;
  praise?: boolean;
}) {
  const { t } = useTranslation();
  const numeric = typeof value === 'number' && typeof average === 'number';
  // Nothing to say about a commander who did none of this: "x0.0" reads as a fault.
  const multiple = numeric && average > 0 && value > 0 ? value / average : null;
  const ahead = praise && numeric && value >= average;
  return (
    <div className="plate plate-sunk px-3 py-3">
      <p className="legend flex items-center gap-1.5 text-crystal">
        {icon === undefined ? null : <span className="shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-2 flex items-baseline justify-between gap-2">
        <span className="num truncate text-body text-bone">
          {typeof value === 'number' ? full(value) : value}
        </span>
        {/*
          "×2,3" IS THE PART THAT GETS SAID OUT LOUD. Two raw figures make the
          reader do the division on every row; the multiple is the comparison
          already made, and it is the shape of a boast rather than of a report.
          Hidden when the cohort did nothing at all, because dividing by zero is
          not an achievement.
        */}
        {multiple === null ? null : (
          <span
            className={`num shrink-0 text-label ${
              praise && multiple >= 1 ? 'text-opportunity' : 'text-faint'
            }`}
          >
            {t('leaderboard.archive.multiple', { value: multiple.toFixed(1) })}
          </span>
        )}
      </p>
      {numeric ? <Bar share={shares(value, average).mine} tone={ahead ? 'ahead' : 'plain'} /> : null}
      <p className="mt-2 truncate text-micro text-faint">
        {t('leaderboard.archive.averageShort', {
          value: typeof average === 'number' ? full(average) : average,
        })}
      </p>
      {numeric ? <Bar share={shares(value, average).theirs} tone="field" /> : null}
    </div>
  );
}

function ResourceStats({
  icon,
  label,
  value,
  average,
}: {
  icon?: ReactNode;
  label: string;
  value: Stats['economy']['produced'];
  average: Averages['economy']['produced'];
}) {
  const { t } = useTranslation();
  return (
    <div className="plate plate-sunk px-3 py-3">
      <p className="legend mb-3 flex items-center gap-1.5 text-crystal">
        {icon === undefined ? null : <span className="shrink-0">{icon}</span>}
        <span className="truncate">{label}</span>
      </p>
      {/*
        ONE RESOURCE PER ROW, NOT THREE TO A ROW.

        Three columns on a 350px screen leaves about ninety pixels each, and the
        line that names the field — "Diğerleri: 1.250.000" — does not fit in ninety
        pixels. It was being truncated to "Diğerleri: 1.2…", which cut off the one
        figure the comparison exists to show. A row per pile gives the full width
        to both numbers and stacks the two bars where they can actually be compared.
      */}
      <div className="space-y-3">
        {(['alloy', 'crystal', 'deuterium'] as const).map((resource) => {
          const share = shares(value[resource], average[resource]);
          return (
            <div key={resource} className="min-w-0">
              <p className="flex min-w-0 items-baseline gap-2">
                <img
                  src={RESOURCE_ART[resource]}
                  alt=""
                  className="size-4 shrink-0 self-center object-contain"
                />
                <span className="legend min-w-0 flex-1 truncate">
                  {t(`leaderboard.archive.resources.${resource}`)}
                </span>
                <span className="num shrink-0 text-body text-bone">{full(value[resource])}</span>
              </p>
              <Bar
                share={share.mine}
                tone={value[resource] >= average[resource] ? 'ahead' : 'plain'}
              />
              <p className="mt-2 truncate text-micro text-faint">
                {t('leaderboard.archive.averageShort', { value: full(average[resource]) })}
              </p>
              <Bar share={share.theirs} tone="field" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
