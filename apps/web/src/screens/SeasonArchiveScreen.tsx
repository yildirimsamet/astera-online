import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { fleetEntries, resourceValue } from '@astera/rules';
import type {
  SeasonArchiveLeaderboard,
  SeasonCommanderProfile,
  SeasonStatsSnapshot,
} from '../api/schemas.js';
import {
  useArchivedLeaderboard,
  useSeasonArchive,
  useSeasonCommanderProfile,
} from '../api/queries.js';
import { full, signed } from '../lib/format.js';
import { honorScore } from '../lib/honor.js';
import { duration } from '../lib/time.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { artIconSrc } from '../game-ui/art.js';
import { Chip, GameButton } from '../game-ui/buttons.js';
import { GameTabs } from '../game-ui/controls.js';
import { Glyph, type GlyphId } from '../game-ui/icons.js';
import { StatPlaque } from '../game-ui/readouts.js';
import { Banner, EmptyState, SectionTag } from '../game-ui/surfaces.js';
import { hullLabel } from '../i18n/names.js';
import { BUILDING_ART, HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Medal, Trophy, isPlace } from '../ui/Medal.js';
import { LeaderboardScreen } from './LeaderboardScreen.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { Flag } from '../v2/identity/Flag.js';
import { RankingScores } from '../ui/RankingScores.js';

type ProfileView = 'season' | 'overall';

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
  initialSeasonId = null,
}: {
  onFocusPlanet: (planetId: string) => void;
  initialSeasonId?: string | null;
}) {
  const { t } = useTranslation();
  const archive = useSeasonArchive();
  const [seasonId, setSeasonId] = useState<string | null>(initialSeasonId);
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

  /* The chip answers the press itself (sound + haptic); this only moves the page. */
  const selectSeason = (next: string | null): void => {
    setResultId(null);
    setSeasonId(next);
  };

  return (
    <div data-v2-season-archive className="gk gk-arch">
      <nav aria-label={t('leaderboard.archive.selectorLabel')} className="gk-arch__strip">
        {/*
          THE STRIP FETCHES ITSELF. Owner instruction: no "load older seasons"
          button — the seasons simply keep arriving as the reader scrolls right.
          A button is a second decision in front of a gesture people already make,
          and on a horizontal rail the gesture IS the request.
        */}
        <div
          className="gk-arch__seasons"
          onScroll={(event) => {
            const strip = event.currentTarget;
            const remaining = strip.scrollWidth - strip.scrollLeft - strip.clientWidth;
            if (remaining < 240 && archive.hasNextPage && !archive.isFetchingNextPage) {
              void archive.fetchNextPage();
            }
          }}
        >
          <Chip on={seasonId === null} onPress={() => { selectSeason(null); }}>
            {t('leaderboard.archive.live')}
          </Chip>
          {completed.map((season) => (
            <Chip key={season.seasonId} on={seasonId === season.seasonId} onPress={() => { selectSeason(season.seasonId); }}>
              {t('leaderboard.archive.seasonChoice', { ordinal: season.ordinal, galaxy: season.shard })}
            </Chip>
          ))}
        </div>
        {archive.isFetchingNextPage ? (
          <p className="gk-report__label gk-arch__status" role="status">{t('leaderboard.archive.loadingOlder')}</p>
        ) : null}
        {archive.isPending ? (
          <p className="gk-report__label gk-arch__status" role="status">{t('leaderboard.archive.waitingArchive')}</p>
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
    const honor = board.data?.ladder.some(row => row.honorRank != null) ?? false;
    return board.data?.ladder.filter((row) => (!honor || row.honorRank != null) &&
      row.commanderName.toLocaleLowerCase(locale).includes(needle))
      .map(row => ({ ...row, rank: row.honorRank ?? row.rank }))
      .toSorted((a, b) => a.rank - b.rank) ?? [];
  }, [board.data, i18n.resolvedLanguage, query]);

  if (board.isError) {
    return <Unreachable what={t('leaderboard.archive.completedBoard')} onRetry={() => { void board.refetch(); }} />;
  }
  if (!board.data) return <Waiting>{t('leaderboard.archive.waitingBoard')}</Waiting>;
  if (board.data.ladder.length === 0) {
    return <div className="gk-lb"><EmptyState art={artIconSrc('menu-ranking')} title={t('leaderboard.archive.emptyBoard')} body="" /></div>;
  }

  return (
    <div className="gk-lb">
      <SectionTag as="h2" aside={<span className="gk-num">{t('leaderboard.archive.fieldSize', { count: board.data.ladder.length })}</span>}>
        {t('leaderboard.archive.seasonHeading', { ordinal: board.data.season.ordinal, galaxy: board.data.season.shard })}
      </SectionTag>
      {board.data.record === null ? null : <GalaxyRecordPanel record={board.data.record} honorPrimary={board.data.ladder.some(row => row.honorRank != null)} />}
      <div className="gk-lb__search">
        <input
          type="search"
          name="season-archive-search"
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); }}
          aria-label={t('leaderboard.archive.searchLabel')}
          placeholder={t('leaderboard.archive.searchPlaceholder')}
          className="gk-field__input"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState art={artIconSrc('menu-ranking')} title={t('leaderboard.archive.noMatch')} body="" />
      ) : (
        <ol className="gk-ledger gk-lb__list" aria-label={t('leaderboard.archive.completedBoard')}>
          {rows.map((row) => (
            <li key={row.resultId} aria-current={row.self ? 'true' : undefined} className="gk-lb__item">
              <ArchivedRow row={row} onOpen={onOpen} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * ONE COMMANDER IN A FINISHED SEASON (C20): the live ladder's line, and the whole line is the
 * door to their season record. The podium is an object, everybody else a numeral; the
 * reader's own line is lit.
 */
function ArchivedRow({ row, onOpen }: {
  row: SeasonArchiveLeaderboard['ladder'][number];
  onOpen: (resultId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const open = useOwnPress(() => {
    playSound('tap');
    haptic('tap');
    onOpen(row.resultId);
  });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={t('leaderboard.archive.openCommander', { commander: row.commanderName })}
      onPointerDown={open.onPointerDown}
      onClick={open.onClick}
      className="gk-lb__row gk-lb__door gk-arch__row"
      {...(row.self ? { 'data-self': '' } : {})}
    >
      {isPlace(row.rank) && (row.honorScore == null || row.honorScore > 0)
        ? <Medal place={row.rank} size={23} className="gk-lb__medal" />
        : <span className="gk-lb__rank gk-num">{row.rank}</span>}
      {/*
        A FACE FOR A NAME, seeded from the result id — stable for that commander in that
        season for ever.
      */}
      <PlanetSigil seed={row.resultId} size={32} />
      <span className="gk-lb__words">
        <span className="gk-lb__flagline">
          <Flag code={row.country} language={i18n.resolvedLanguage ?? 'en'} />
          <span className="gk-lb__name">{row.commanderName}</span>
        </span>
        <span className="gk-arch__title">{row.title}</span>
      </span>
      <RankingScores honor={row.honorScore} dominion={row.dominion} />
    </button>
  );
}

function GalaxyRecordPanel({
  record,
  honorPrimary = false,
}: {
  record: NonNullable<SeasonArchiveLeaderboard['record']>;
  honorPrimary?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section role="region" aria-label={t('leaderboard.archive.galaxyRecord.title')} className="gk-well gk-arch__record">
      <header className="gk-arch__recordhead">
        <Trophy won size={25} />
        <span>
          <h3 className="gk-report__subhead">{t('leaderboard.archive.galaxyRecord.title')}</h3>
          <p className="gk-report__label">{t('leaderboard.archive.galaxyRecord.subtitle')}</p>
        </span>
      </header>
      <dl className="gk-arch__facts">
        {record.champion === null ? null : (
          <RecordFact label={`${honorPrimary ? t('leaderboard.score') + ' · ' : ''}${t('leaderboard.archive.galaxyRecord.champion')}`}>
            <span className="gk-arch__champion">
              <strong>{record.champion.commanderName}</strong>
              <span className="gk-num gk-arch__fig">{signed(record.champion.dominion)}</span>
            </span>
          </RecordFact>
        )}
        {record.clanPodium.length === 0 ? null : (
          <RecordFact label={t('leaderboard.archive.galaxyRecord.clans')}>
            {record.clanPodium.map((clan) => (
              <span key={clan.rank}>
                <span className="gk-num gk-arch__clanrank">{clan.rank}.</span>
                [{clan.tag}] {clan.name}
              </span>
            ))}
          </RecordFact>
        )}
        {record.biggestBattle === null ? null : (
          <RecordFact wide label={t('leaderboard.archive.galaxyRecord.biggestBattle')}>
            {t('leaderboard.archive.galaxyRecord.battleLine', {
              attacker: record.biggestBattle.attackerName,
              defender: record.biggestBattle.defenderName,
              planet: record.biggestBattle.planetName,
              value: full(record.biggestBattle.totalLossValue),
            })}
          </RecordFact>
        )}
        {record.sharpestDominionSwing === null ? null : (
          <RecordFact wide label={t('leaderboard.archive.galaxyRecord.dominionSwing')}>
            {t('leaderboard.archive.galaxyRecord.swingLine', {
              attacker: record.sharpestDominionSwing.attackerName,
              defender: record.sharpestDominionSwing.defenderName,
              amount: signed(record.sharpestDominionSwing.amount),
            })}
          </RecordFact>
        )}
        {record.mostContestedWorld === null ? null : (
          <RecordFact wide label={t('leaderboard.archive.galaxyRecord.contestedWorld')}>
            {t('leaderboard.archive.galaxyRecord.worldLine', {
              planet: record.mostContestedWorld.planetName,
              count: record.mostContestedWorld.events,
            })}
          </RecordFact>
        )}
      </dl>
    </section>
  );
}

function RecordFact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="gk-arch__fact" {...(wide ? { 'data-wide': '' } : {})}>
      <dt className="gk-report__label">{label}</dt>
      <dd>{children}</dd>
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
  const stored = profile.data.selected;
  const selected = { ...stored, rank: stored.honorRank ?? stored.rank,
    commanders: stored.honorRank != null ? stored.honorCommanders : stored.commanders };
  const meritsMedal = selected.honorScore == null || selected.honorScore > 0;
  const podium = meritsMedal && isPlace(selected.rank);
  const standing = meritsMedal ? percentile(selected.rank, selected.commanders ?? 0) : null;
  const dominion = selected.dominion === 0 ? full(0) : signed(selected.dominion);
  const openResult = (nextResultId: string): void => {
    if (nextResultId === selected.resultId) {
      setView('season');
      return;
    }
    onOpenResult(nextResultId);
  };

  return (
    <div className="gk-prof">
      <div className="gk-prof__back">
        <GameButton glyph="back" size="sm" onPress={onBack}>{t('leaderboard.archive.back')}</GameButton>
      </div>
      {/*
        A RECORD SOMEBODY WOULD SHOW SOMEBODY ELSE (C21): the season's last screen and a
        commander's permanent record are the same moment, so they share its pieces — the
        lit ground, the world with the medal hung on it, the two numbers on plaques.
      */}
      <header className="gk-well gk-prof__head">
        <span className="gk-prof__sky" aria-hidden="true" />
        <span className="gk-prof__crest">
          {podium ? <span className="gk-rays" aria-hidden="true" /> : null}
          <PlanetSigil seed={selected.seasonId + selected.commanderName} size={58} />
          {podium && isPlace(selected.rank) ? <Medal place={selected.rank} size={27} className="gk-prof__medal" /> : null}
        </span>
        <p className="gk-label gk-prof__eyebrow">
          {t('leaderboard.archive.seasonHeading', { ordinal: selected.ordinal, galaxy: selected.shard })}
        </p>
        <div className="gk-prof__name">
          <Flag code={selected.country} language={i18n.resolvedLanguage ?? 'en'} />
          <h2 className="gk-display gk-prof__title">{selected.commanderName}</h2>
        </div>
        <p className="gk-prof__who">{selected.title} · {selected.planetName}</p>
        {/*
          THE LINE A PLAYER QUOTES. A rank without its field is not a boast — first of four
          and first of three hundred read identically — so the share comes first.
        */}
        {standing === null ? null : (
          <p className="gk-prof__standing" {...(podium ? { 'data-place': String(selected.rank) } : {})}>
            {t('leaderboard.archive.percentile', {
              share: standing,
              rank: full(selected.rank),
              commanders: full(selected.commanders ?? 0),
            })}
          </p>
        )}
        <div className="gk-prof__heroes">
          <StatPlaque
            {...(selected.honorRank != null ? { glyph: 'ranking' as const } : { art: artIconSrc('trophy') })}
            label={t(selected.honorRank != null ? 'leaderboard.honorRank' : 'leaderboard.archive.metrics.finalRank')}
            value={`#${full(selected.rank)}`}
            tone={podium ? 'good' : 'neutral'}
          />
          {selected.honorScore != null ? (
            <StatPlaque
              glyph="star"
              label={t('leaderboard.honorTitle')}
              value={honorScore(selected.honorScore)}
              sub={<>{t('leaderboard.score')} <span className="gk-num">{dominion}</span></>}
            />
          ) : (
            <StatPlaque glyph="colony" label={t('leaderboard.score')} value={dominion} tone={selected.dominion > 0 ? 'good' : 'neutral'} />
          )}
        </div>
      </header>
      <GameTabs
        label={t('leaderboard.archive.profileViews')}
        value={view}
        onChange={setView}
        tabs={[
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
  glyph: GlyphId;
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
    glyph: GlyphId,
    mine: number | null,
    theirs: number | null,
    format: (value: number) => string,
    praise = true,
  ): void => {
    if (mine === null || theirs === null) return;
    out.push({ id, glyph, value: format(mine), mine, theirs, praise });
  };
  const times = (value: number): string => `×${value.toFixed(1)}`;
  const percent = (value: number): string =>
    i18n.t('leaderboard.archive.share', { value: Math.round(value * 100) });

  // What you did to them against what they did to you.
  add(
    'trade',
    'target',
    ratio(stats.competition.damageDealt, stats.competition.damageTaken),
    ratio(averages.competition.damageDealt, averages.competition.damageTaken),
    times,
  );
  // What one raid was worth, which is the difference between raiding and flailing.
  add(
    'haul',
    'crate',
    ratio(resourceValue(stats.competition.playerLoot), stats.competition.attacks),
    ratio(resourceValue(averages.competition.playerLoot), averages.competition.attacks),
    (value) => full(value),
  );
  // How much of the fleet you built came home.
  const kept = (lost: number, built: number): number | null =>
    built > 0 ? Math.max(0, 1 - lost / built) : null;
  add(
    'kept',
    'hull',
    kept(stats.competition.shipsLost, stats.competition.shipsBuilt),
    kept(averages.competition.shipsLost, averages.competition.shipsBuilt),
    percent,
  );
  // Whether the merchant was a plan or a gamble.
  add(
    'convoy',
    'rocket',
    ratio(stats.exploration.convoySuccesses, stats.exploration.convoyAttempts),
    ratio(averages.exploration.convoySuccesses, averages.exploration.convoyAttempts),
    percent,
  );
  // What an hour of your works was actually worth.
  add(
    'hourly',
    'clock',
    ratio(resourceValue(stats.economy.produced), stats.economy.productiveSeconds / 3_600),
    ratio(resourceValue(averages.economy.produced), averages.economy.productiveSeconds / 3_600),
    (value) => full(value),
  );
  // What one asteroid run brought back.
  add(
    'perRun',
    'asteroid',
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
      AN HONEST GAP, DRESSED AS ONE. Seasons played before the galaxy kept telemetry
      have a rank, a title and a story and no figures: "this is how far the record
      goes", not "something is broken".
    */
    return (
      <div className="gk-prof__body">
        <Banner glyph="history" title={t('leaderboard.archive.statsUnavailable')} body={t('leaderboard.archive.statsUnavailableHint')} />
      </div>
    );
  }
  const stats = selected.stats;
  const averages = selected.averages;
  const signature = signatureHull(stats.competition.shipsBuiltByHull);
  const best = ratios(stats, averages);
  const produced = stats.economy.produced;
  const mined = stats.exploration.asteroidMined;
  return (
    <div className="gk-prof__body">
      <RecordNotices selected={selected} />
      <p className="gk-report__label">{t('leaderboard.archive.cohort', { count: averages.cohortSize })}</p>
      {best.length === 0 ? null : (
        <section className="gk-prof__part">
          <SectionTag as="h3">{t('leaderboard.archive.sections.form')}</SectionTag>
          <div className="gk-cmp-grid">
            {best.map((item) => (
              <CompareCard
                key={item.id}
                glyph={item.glyph}
                label={t(RATIO_LABEL[item.id])}
                value={item.value}
                mine={item.mine}
                theirs={item.theirs}
                multiple={item.theirs > 0 ? item.mine / item.theirs : null}
                ahead={item.praise && item.mine >= item.theirs}
                others={item.id === 'kept' || item.id === 'convoy'
                  ? t('leaderboard.archive.share', { value: Math.round(item.theirs * 100) })
                  : item.id === 'trade' ? `×${item.theirs.toFixed(1)}` : full(item.theirs)}
              />
            ))}
          </div>
        </section>
      )}
      <RecapStories recap={selected.recap} />
      <section className="gk-prof__part">
        <SectionTag as="h3">{t('leaderboard.archive.sections.competition')}</SectionTag>
        {signature === null ? null : (
          <LeadCard
            art={HULL_ART[signature.hull]}
            label={t('leaderboard.archive.signature')}
            value={hullLabel(signature.hull)}
            note={t('leaderboard.archive.signatureCount', { count: signature.count })}
          />
        )}
        <div className="gk-cmp-grid">
          <ComparedStat glyph="banner" label={t('leaderboard.archive.metrics.battles')} value={stats.competition.battles} average={averages.competition.battles} />
          <ComparedStat glyph="attack" label={t('seasonRecap.attacks')} value={stats.competition.attacks} average={averages.competition.attacks} />
          <ComparedStat glyph="shield" label={t('seasonRecap.defences')} value={stats.competition.defences} average={averages.competition.defences} />
          <ComparedStat glyph="target" label={t('seasonRecap.damageDealt')} value={stats.competition.damageDealt} average={averages.competition.damageDealt} />
          <ComparedStat glyph="damaged" label={t('seasonRecap.damageTaken')} value={stats.competition.damageTaken} average={averages.competition.damageTaken} praise={false} />
          <ComparedStat glyph="bay" label={t('leaderboard.archive.metrics.shipsBuilt')} value={stats.competition.shipsBuilt} average={averages.competition.shipsBuilt} />
          <ComparedStat glyph="critical" label={t('leaderboard.archive.metrics.shipsLost')} value={stats.competition.shipsLost} average={averages.competition.shipsLost} praise={false} />
        </div>
        <ResourceStats glyph="crate" label={t('leaderboard.archive.metrics.playerLoot')} value={stats.competition.playerLoot} average={averages.competition.playerLoot} />
        <div className="gk-cmp-grid">
          <HullBreakdown label={t('leaderboard.archive.metrics.shipsBuiltByHull')} fleet={stats.competition.shipsBuiltByHull} />
          <HullBreakdown label={t('leaderboard.archive.metrics.shipsLostByHull')} fleet={stats.competition.shipsLostByHull} />
        </div>
      </section>
      <section className="gk-prof__part">
        <SectionTag as="h3">{t('leaderboard.archive.sections.economy')}</SectionTag>
        {/* Each section opens the same way — a render, a name, a headline figure — so the card has a rhythm. */}
        <LeadCard
          art={BUILDING_ART.CORE}
          label={t('leaderboard.archive.leadWorks')}
          value={full(produced.alloy + produced.crystal + produced.deuterium)}
          note={t('leaderboard.archive.leadProduced')}
        />
        <ComparedStat
          glyph="clock"
          label={t('leaderboard.archive.metrics.productiveTime')}
          value={duration(stats.economy.productiveSeconds / 60)}
          average={duration(averages.economy.productiveSeconds / 60)}
        />
        <ResourceStats glyph="colony" label={t('leaderboard.archive.metrics.produced')} value={produced} average={averages.economy.produced} />
      </section>
      <section className="gk-prof__part">
        <SectionTag as="h3">{t('leaderboard.archive.sections.exploration')}</SectionTag>
        <LeadCard
          art={HULL_ART.PROSPECTOR}
          label={t('leaderboard.archive.metrics.asteroidMined')}
          value={full(mined.alloy + mined.crystal + mined.deuterium)}
          note={t('leaderboard.archive.leadRuns', { count: stats.exploration.asteroidRuns })}
        />
        <div className="gk-cmp-grid">
          <ComparedStat glyph="asteroid" label={t('leaderboard.archive.metrics.asteroidRuns')} value={stats.exploration.asteroidRuns} average={averages.exploration.asteroidRuns} />
          <ComparedStat glyph="rocket" label={t('leaderboard.archive.metrics.convoyAttempts')} value={stats.exploration.convoyAttempts} average={averages.exploration.convoyAttempts} />
          <ComparedStat glyph="check" label={t('leaderboard.archive.metrics.convoySuccesses')} value={stats.exploration.convoySuccesses} average={averages.exploration.convoySuccesses} />
        </div>
        <ResourceStats glyph="asteroid" label={t('leaderboard.archive.metrics.asteroidMined')} value={mined} average={averages.exploration.asteroidMined} />
        <ResourceStats glyph="rocket" label={t('leaderboard.archive.metrics.convoyDelivered')} value={stats.exploration.convoyDelivered} average={averages.exploration.convoyDelivered} />
      </section>
    </div>
  );
}

function RecordNotices({ selected }: { selected: SelectedRecord }) {
  const { t } = useTranslation();
  return (
    <>
      {selected.endReason === 'FORCED_WIPE' ? (
        <Banner tone="warn" title={t('leaderboard.archive.forcedEnd.title')} body={t('leaderboard.archive.forcedEnd.hint')} />
      ) : null}
      {selected.stats?.coverage?.reason === 'TELEMETRY_CUTOVER' ? (
        <Banner glyph="history" title={t('leaderboard.archive.partialStats.title')} body={t('leaderboard.archive.partialStats.hint')} />
      ) : null}
    </>
  );
}

function LegacySeasonStats({ selected }: { selected: SelectedRecord }) {
  const { t } = useTranslation();
  const legacy = selected.legacyStats;
  const averages = selected.legacyAverages;
  if (!legacy || !averages) return null;
  return (
    <div className="gk-prof__body">
      <Banner glyph="history" title={t('leaderboard.archive.legacyStats.title')} body={t('leaderboard.archive.legacyStats.hint')} />
      <RecordNotices selected={selected} />
      <p className="gk-report__label">{t('leaderboard.archive.cohort', { count: averages.cohortSize })}</p>
      <RecapStories recap={selected.recap} />
      <section className="gk-prof__part">
        <SectionTag as="h3">{t('leaderboard.archive.sections.competition')}</SectionTag>
        <div className="gk-cmp-grid">
          <ComparedStat glyph="banner" label={t('leaderboard.archive.metrics.battles')} value={legacy.competition.battles} average={averages.competition.battles} />
          <ComparedStat glyph="attack" label={t('seasonRecap.attacks')} value={legacy.competition.attacks} average={averages.competition.attacks} />
          <ComparedStat glyph="shield" label={t('seasonRecap.defences')} value={legacy.competition.defences} average={averages.competition.defences} />
          <ComparedStat glyph="target" label={t('seasonRecap.damageDealt')} value={legacy.competition.damageDealt} average={averages.competition.damageDealt} />
          <ComparedStat glyph="damaged" label={t('seasonRecap.damageTaken')} value={legacy.competition.damageTaken} average={averages.competition.damageTaken} praise={false} />
        </div>
      </section>
    </div>
  );
}

function RecapStories({ recap }: { recap: SelectedRecord['recap'] }) {
  const { t } = useTranslation();
  if (recap.biggestRaid === null && recap.rival === null) return null;
  return (
    <div className="gk-prof__stories">
      {recap.biggestRaid === null ? null : (
        <div className="gk-well gk-report__why">
          <p className="gk-label gk-prof__storyhead" data-tone="gold">{t('seasonRecap.biggestHeading')}</p>
          <p className="gk-report__copy" data-strong="">
            {t('seasonRecap.biggestRaid', { name: recap.biggestRaid.opponentName, value: full(recap.biggestRaid.value) })}
          </p>
        </div>
      )}
      {recap.rival === null ? null : (
        <div className="gk-well gk-report__why">
          <p className="gk-label gk-prof__storyhead">{t('seasonRecap.rivalHeading')}</p>
          <p className="gk-report__copy" data-strong="">
            {t('seasonRecap.rival', { name: recap.rival.commanderName, count: recap.rival.battles })}
          </p>
        </div>
      )}
    </div>
  );
}

function HullBreakdown({ label, fleet }: { label: string; fleet: Stats['competition']['shipsBuiltByHull'] }) {
  const { t } = useTranslation();
  const entries = fleetEntries(fleet);
  return (
    <div className="gk-well gk-cmp">
      <p className="gk-cmp__label">{label}</p>
      {entries.length === 0 ? (
        <p className="gk-report__label">{t('leaderboard.archive.none')}</p>
      ) : (
        <ul className="gk-prof__hulls">
          {entries.map(([hull, count]) => (
            <li key={hull}>
              {/* The hull's own render: the card the player bought it from showed them the same picture. */}
              {HULL_ART[hull] === null ? <span /> : <img src={HULL_ART[hull]} alt="" />}
              <span className="gk-prof__hullname">{hullLabel(hull)}</span>
              <span className="gk-num">{full(count)}</span>
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
    <div className="gk-prof__body">
      {/*
        A CAREER IS A SHELF, NOT A TABLE. Championships and podiums carry the medal colours
        the rest of the game uses for the same places, and an empty shelf still shows its
        places, because those are what the next season is for.
      */}
      <div className="gk-well gk-prof__shelf">
        <ShelfFigure label={t('leaderboard.archive.career.completed')} value={full(career.completedSeasons)} />
        <ShelfFigure
          label={t('leaderboard.archive.career.bestRank')}
          value={career.bestRank === null ? '—' : `#${full(career.bestRank)}`}
          tone={career.bestRank === null ? 'quiet' : career.bestRank <= 3 ? 'gold' : undefined}
        />
        <ShelfFigure label={t('leaderboard.archive.career.topTen')} value={full(career.topTen)} />
        <ShelfFigure
          mark={<Trophy won={career.championships > 0} size={16} />}
          label={t('leaderboard.archive.career.championships')}
          value={full(career.championships)}
          tone={career.championships > 0 ? 'gold' : 'quiet'}
        />
        <ShelfFigure
          mark={<span className="gk-prof__podium"><Medal place={1} size={12} plain /><Medal place={2} size={12} plain /><Medal place={3} size={12} plain /></span>}
          label={t('leaderboard.archive.career.podiums')}
          value={full(career.podiums)}
          tone={career.podiums > 0 ? 'crystal' : 'quiet'}
        />
      </div>
      <section className="gk-prof__part">
        <SectionTag as="h3">{t('leaderboard.archive.career.recordedCombatTotals')}</SectionTag>
        <p className="gk-report__label">{t('leaderboard.archive.career.covered', { count: career.competitionTotals.seasonsCovered })}</p>
        <dl className="gk-well gk-report__sum gk-prof__totals">
          <dt>{t('leaderboard.archive.metrics.battles')}</dt><dd className="gk-num">{full(career.competitionTotals.battles)}</dd>
          <dt>{t('seasonRecap.attacks')}</dt><dd className="gk-num">{full(career.competitionTotals.attacks)}</dd>
          <dt>{t('seasonRecap.damageDealt')}</dt><dd className="gk-num">{full(career.competitionTotals.damageDealt)}</dd>
          <dt>{t('seasonRecap.damageTaken')}</dt><dd className="gk-num">{full(career.competitionTotals.damageTaken)}</dd>
        </dl>
      </section>
      {career.totals === null ? (
        <Banner glyph="history" title={t('leaderboard.archive.career.noTelemetry')} />
      ) : (
        <section className="gk-prof__part">
          <SectionTag as="h3">{t('leaderboard.archive.career.recordedTotals')}</SectionTag>
          <p className="gk-report__label">
            {career.totals.partialSeasons > 0
              ? t('leaderboard.archive.career.coveredWithPartial', { count: career.totals.seasonsCovered, partial: career.totals.partialSeasons })
              : t('leaderboard.archive.career.covered', { count: career.totals.seasonsCovered })}
          </p>
          <dl className="gk-well gk-report__sum gk-prof__totals">
            <dt>{t('leaderboard.archive.metrics.battles')}</dt><dd className="gk-num">{full(career.totals.stats.competition.battles)}</dd>
            <dt>{t('leaderboard.archive.metrics.shipsBuilt')}</dt><dd className="gk-num">{full(career.totals.stats.competition.shipsBuilt)}</dd>
            <dt>{t('leaderboard.archive.metrics.asteroidRuns')}</dt><dd className="gk-num">{full(career.totals.stats.exploration.asteroidRuns)}</dd>
            <dt>{t('leaderboard.archive.metrics.convoySuccesses')}</dt><dd className="gk-num">{full(career.totals.stats.exploration.convoySuccesses)}</dd>
          </dl>
        </section>
      )}
      <section className="gk-prof__part">
        <SectionTag as="h3">{t('leaderboard.archive.career.seasons')}</SectionTag>
        <ol className="gk-ledger gk-lb__list" aria-label={t('leaderboard.archive.career.seasons')}>
          {career.seasons.map(season => ({ ...season, rank: season.honorRank ?? season.rank })).map((season) => (
            <li key={season.resultId} className="gk-lb__item">
              <CareerSeasonRow season={season} onOpen={onOpenResult} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** One figure on the career shelf: the number over its name, a medal's colour when it earned one. */
function ShelfFigure({ label, value, mark, tone }: {
  label: string;
  value: string;
  mark?: ReactNode;
  tone?: 'gold' | 'crystal' | 'quiet' | undefined;
}) {
  return (
    <div className="gk-prof__fig">
      <span className="gk-display gk-num gk-prof__figval" {...(tone === undefined ? {} : { 'data-tone': tone })}>{value}</span>
      <span className="gk-report__label gk-prof__figlabel">{mark}{label}</span>
    </div>
  );
}

/**
 * ONE SEASON ON THE SHELF, read at a glance: a podium finish carries its object and
 * everything else a quiet numeral — the ladder's own vocabulary — and the line is a door.
 */
function CareerSeasonRow({ season, onOpen }: {
  season: SeasonCommanderProfile['career']['seasons'][number];
  onOpen: (resultId: string) => void;
}) {
  const { t } = useTranslation();
  const open = useOwnPress(() => {
    playSound('tap');
    haptic('tap');
    onOpen(season.resultId);
  });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={t('leaderboard.archive.openSeasonRecord', { ordinal: season.ordinal, galaxy: season.shard })}
      onPointerDown={open.onPointerDown}
      onClick={open.onClick}
      className="gk-lb__row gk-lb__door gk-arch__row gk-prof__season"
    >
      {isPlace(season.rank) && (season.honorScore == null || season.honorScore > 0)
        ? <Medal place={season.rank} size={23} className="gk-lb__medal" />
        : <span className="gk-lb__rank gk-num">#{full(season.rank)}</span>}
      <span className="gk-lb__words">
        <span className="gk-lb__name">{t('leaderboard.archive.seasonNumber', { ordinal: season.ordinal })}</span>
        <span className="gk-arch__title">{season.shard} · {season.title}</span>
      </span>
      <RankingScores honor={season.honorScore} dominion={season.dominion} />
    </button>
  );
}

/**
 * ONE BAR. Two of these stacked ARE the comparison (owner: "dikey çizgiler neyi ifade
 * ediyor anlaşılmıyor"): the reader's own, bright, then the field's, thinner and dimmer.
 * Which is longer is the whole answer.
 */
function Bar({ share, tone }: { share: number; tone: 'ahead' | 'plain' | 'field' }) {
  return (
    <span aria-hidden="true" className="gk-cmp__bar" data-tone={tone}>
      <span data-bar={tone} style={{ width: `${String(Math.max(0, Math.min(100, share)))}%` }} />
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
 * A SECTION'S OPENING LINE: the render, the headline, and what it was made of. One shape
 * for all three sections; the art is the subject and the number is the boast.
 */
function LeadCard({ art, label, value, note }: { art: string | null; label: string; value: string; note: string }) {
  return (
    <div className="gk-well gk-prof__lead">
      {art === null ? <span /> : <img className="gk-prof__leadart" src={art} alt="" />}
      <span className="gk-prof__leadwords">
        <span className="gk-label">{label}</span>
        <span className="gk-report__figure gk-num">{value}</span>
        <span className="gk-report__label">{note}</span>
      </span>
    </div>
  );
}

/**
 * ABOVE OR BELOW, ANSWERED WITHOUT ARITHMETIC (owner: "istatistik karşılaştırmaları hiç bir
 * halt yok"). The figure, the multiple a player says out loud ("×2.3"), and the two bars —
 * the figures stay printed, because the record has to be quotable.
 */
function CompareCard({ glyph, label, value, mine, theirs, multiple, ahead, others }: {
  glyph: GlyphId;
  label: string;
  value: string;
  /** Null for a figure that is not a count (a duration): no bars then. */
  mine: number | null;
  theirs: number | null;
  multiple: number | null;
  ahead: boolean;
  others: string;
}) {
  const { t } = useTranslation();
  const bars = mine !== null && theirs !== null ? shares(mine, theirs) : null;
  return (
    <div className="gk-well gk-cmp" data-compare="">
      <p className="gk-cmp__label"><Glyph id={glyph} />{label}</p>
      <p className="gk-cmp__line">
        <span className="gk-cmp__value gk-num">{value}</span>
        {multiple === null ? null : (
          <span className="gk-cmp__times gk-num" {...(ahead && multiple >= 1 ? { 'data-ahead': '' } : {})}>
            {t('leaderboard.archive.multiple', { value: multiple.toFixed(1) })}
          </span>
        )}
      </p>
      {bars === null ? null : <Bar share={bars.mine} tone={ahead ? 'ahead' : 'plain'} />}
      <p className="gk-cmp__others gk-num">{t('leaderboard.archive.averageShort', { value: others })}</p>
      {bars === null ? null : <Bar share={bars.theirs} tone="field" />}
    </div>
  );
}

function ComparedStat({ glyph, label, value, average, praise = true }: {
  glyph: GlyphId;
  label: string;
  value: number | string;
  average: number | string;
  praise?: boolean;
}) {
  const numeric = typeof value === 'number' && typeof average === 'number';
  // Nothing to say about a commander who did none of this: "×0.0" reads as a fault.
  const multiple = numeric && average > 0 && value > 0 ? value / average : null;
  return (
    <CompareCard
      glyph={glyph}
      label={label}
      value={typeof value === 'number' ? full(value) : value}
      mine={numeric ? value : null}
      theirs={numeric ? average : null}
      multiple={multiple}
      ahead={praise && numeric && value >= average}
      others={typeof average === 'number' ? full(average) : average}
    />
  );
}

/**
 * ONE RESOURCE PER LINE, NOT THREE TO A LINE: three columns on a 350px screen cut the
 * field's figure ("Diğerleri: 1.2…"), the one number the comparison exists to show.
 */
function ResourceStats({ glyph, label, value, average }: {
  glyph: GlyphId;
  label: string;
  value: Stats['economy']['produced'];
  average: Averages['economy']['produced'];
}) {
  const { t } = useTranslation();
  return (
    <div className="gk-well gk-cmp" data-compare="">
      <p className="gk-cmp__label"><Glyph id={glyph} />{label}</p>
      {(['alloy', 'crystal', 'deuterium'] as const).map((resource) => {
        const share = shares(value[resource], average[resource]);
        return (
          <div key={resource} className="gk-cmp__res">
            <p className="gk-cmp__line">
              <span className="gk-cmp__resname">
                <img src={RESOURCE_ART[resource]} alt="" />
                {t(`leaderboard.archive.resources.${resource}`)}
              </span>
              <span className="gk-cmp__value gk-num">{full(value[resource])}</span>
            </p>
            <Bar share={share.mine} tone={value[resource] >= average[resource] ? 'ahead' : 'plain'} />
            <p className="gk-cmp__others gk-num">{t('leaderboard.archive.averageShort', { value: full(average[resource]) })}</p>
            <Bar share={share.theirs} tone="field" />
          </div>
        );
      })}
    </div>
  );
}
