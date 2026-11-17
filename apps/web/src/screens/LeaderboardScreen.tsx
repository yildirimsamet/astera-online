import { ClanTag } from '../ui/ClanTag.js';
import { honorRankRewards, type Resources } from '@astera/rules';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard, useSeason } from '../api/queries.js';
import { full } from '../lib/format.js';
import { honorScore } from '../lib/honor.js';
import { HonorSoloPolicy } from '../ui/HonorSoloNotice.js';
import { HonorBenefitsSection } from '../ui/HonorBenefits.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { commanderLabel } from '../lib/identity.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Medal, isPlace } from '../ui/Medal.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { SeasonRewardReceipt } from '../ui/SeasonRewardReceipt.js';
import { RankingScores } from '../ui/RankingScores.js';
import { SeasonRewardBoard } from '../ui/SeasonRewardBoard.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Flag } from '../v2/identity/Flag.js';
import { artIconSrc } from '../game-ui/art.js';
import { Choices, GameTabs } from '../game-ui/controls.js';
import { EmptyState, Fold, SectionTag } from '../game-ui/surfaces.js';

/** The current season's Honor race, with the independent Dominion ladder alongside. */
export function LeaderboardScreen({ onFocusPlanet }: {
  onFocusPlanet: (planetId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [ranking, setRanking] = useState<'HONOR' | 'DOMINION'>('HONOR');
  const board = useLeaderboard(true, ranking);
  const season = useSeason();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<LeaderboardPage>('standings');

  if (board.isError) {
    return (
      <Unreachable
        what={t('surface.whatLeaderboard')}
        onRetry={() => { void board.refetch(); }}
      />
    );
  }
  if (!board.data) return <Waiting>{t('surface.waitingLeaderboard')}</Waiting>;
  const mine = board.data.you?.playerId;
  const honor = board.data.ranking === 'HONOR';
  const prize = board.data.honorReward;
  const yours = board.data.you;
  const program = season.data?.seasonRewards;
  // Calculate against the complete ladder: searching must not change tied prizes.
  const prizes = new Map<string, Resources>(honor
    ? honorRankRewards(board.data.ladder.map(row => ({ actor: row.playerId, honor: row.score })))
      .map(row => [row.actor, row.reward])
    : board.data.ladder.flatMap(row => {
      const tier = program && row.score >= program.minimumDominion
        ? program.tiers.find(tier => tier.place === row.rank) : undefined;
      return tier ? [[row.playerId, { alloy: tier.alloy, crystal: tier.crystal, deuterium: tier.deuterium }]] : [];
    }));
  const showPrizes = honor || program != null;
  const next = honor && yours ? board.data.ladder.findLast(row => row.score > yours.score) : undefined;
  /**
   * The widest score in the galaxy, so every bar on the ladder shares one scale.
   *
   * Off the WHOLE ladder rather than the filtered rows: a search that narrows the
   * list must not rescale the bars, or the same commander looks twice as strong
   * for having been typed into a box.
   *
   * Absolute, because Dominion is zero-sum and a raided commander sits below the
   * line — the bar for one of those grows left from the centre, so "behind" reads
   * as a direction rather than as a minus sign to notice.
   */
  const widest = Math.max(1, ...board.data.ladder.map((row) => Math.abs(row.score)));
  const locale = i18n.resolvedLanguage === 'tr' ? 'tr-TR' : 'en-US';
  const needle = query.trim().toLocaleLowerCase(locale);
  const rows = needle.length === 0
    ? board.data.ladder
    : board.data.ladder.filter((row) => [
        row.username,
        row.planetName ?? '',
        row.clan?.tag ?? '',
        row.clan?.name ?? '',
      ].join(' ').toLocaleLowerCase(locale).includes(needle));
  const mineIndex = board.data.ladder.findIndex((row) => row.playerId === mine);
  // The first screenful is already visible. Below it, pin the local race so the
  // reader never has to drag through hundreds of commanders just to find themself.
  const nearby = needle.length === 0 && mineIndex >= 10
    ? board.data.ladder.slice(Math.max(0, mineIndex - 1), mineIndex + 2)
    : [];

  // The board opens on the standings (owner, 2026-11-17, item 4); what the places pay and how
  // Honor is scored each have their own page, so nothing stands between the tabs and the ladder.
  const pages: { id: LeaderboardPage; label: string }[] = [
    { id: 'standings', label: t('leaderboard.view.standings') },
    ...(showPrizes || board.data.honorEnabled ? [{ id: 'rewards' as const, label: t('leaderboard.view.rewards') }] : []),
    ...(honor ? [{ id: 'rules' as const, label: t('leaderboard.view.rules') }] : []),
  ];
  const shown: LeaderboardPage = pages.some((option) => option.id === page) ? page : 'standings';

  const standings = <>
    {honor && board.data.you ? <div data-honor-mine="" className="gk-well gk-lb__mine">
      <span className="gk-label">{t('leaderboard.honorYourRank')}</span>
      <span className="gk-num gk-lb__placefig">#{board.data.you.rank}</span>
      <span className="gk-num gk-lb__honorfig">{honorScore(board.data.you.score)} <span className="gk-lb__unit">{t('leaderboard.honorTitle')}</span></span>
      {next ? <p className="gk-lb__next">{t('leaderboard.honorNext', {
        amount: honorScore(BigInt(next.score) - BigInt(board.data.you.score)), commander: next.username,
      })}</p> : null}
    </div> : null}
    <div className="gk-lb__search">
      <input
        type="search"
        name="leaderboard-search"
        autoComplete="off"
        value={query}
        onChange={(event) => { setQuery(event.currentTarget.value); }}
        aria-label={t('leaderboard.searchLabel')}
        placeholder={t('leaderboard.searchPlaceholder')}
        className="gk-field__input"
      />
    </div>
    {nearby.length === 0 ? null : (
      <section role="region" aria-label={t('leaderboard.nearby')} className="gk-lb__nearby">
        <SectionTag>{t('leaderboard.nearby')}</SectionTag>
        <div className="gk-ledger">
          {nearby.map((row) => (
            <LadderRow key={row.playerId} row={row} honor={honor} self={row.playerId === mine} widest={widest} onFocusPlanet={onFocusPlanet} />
          ))}
        </div>
      </section>
    )}
    {rows.length === 0 ? (
      <EmptyState art={artIconSrc('menu-ranking')} title={t(board.data.ladder.length === 0 ? 'leaderboard.empty' : 'leaderboard.noMatch')} body="" />
    ) : (
      <ol className="gk-ledger gk-lb__list" aria-label={t('leaderboard.title')}>
        {rows.map((row) => (
          <li key={row.playerId} aria-current={row.playerId === mine ? 'true' : undefined} className="gk-lb__item">
            <LadderRow row={row} honor={honor} self={row.playerId === mine} widest={widest} onFocusPlanet={onFocusPlanet}
              prize={showPrizes ? <RowPrize reward={prizes.get(row.playerId)} /> : null} />
          </li>
        ))}
      </ol>
    )}
  </>;

  const rewards = <>
    {honor && prize ? <div data-honor-prize="" className="gk-well gk-lb__prize">
      <p className="gk-lb__prizehead">
        <span className="gk-report__subhead">{t('leaderboard.honorPrize')}</span>
        <span className="gk-lb__chip">{t('leaderboard.honorPrizeMultiplier', { ranking: t('leaderboard.score') })}</span>
      </p>
      <p className="gk-report__label">{t('leaderboard.honorPayment')}</p>
      <p className="gk-lb__purse gk-num">
        {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <span key={resource} className="gk-lb__coin" data-res={resource}>
          <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} />
          {full(prize.reward[resource])}
          <span className="gk-lb__of">/ {full(prize.nominal[resource])}</span>
        </span>)}
      </p>
      <p className="gk-report__copy">{t('leaderboard.honorThreshold', { amount: honorScore(prize.fullThreshold) })}</p>
    </div> : null}
    <SeasonRewardBoard season={season.data} board={board.data} />
    {honor && board.data.honorBenefits ? <HonorBenefitsSection value={board.data.honorBenefits} /> : null}
    {board.data.honorEnabled ? <p className="gk-report__copy">{t('leaderboard.honorPackageOnce')}</p> : null}
    {showPrizes ? <p className="gk-report__label">{t('leaderboard.rewards.rowExplain')}</p> : null}
  </>;

  const rules = <>
    <div className="gk-lb__lead">
      <p className="gk-report__subhead">{t('leaderboard.honorPrimary')}</p>
      <p className="gk-report__copy">{t('leaderboard.honorLead')}</p>
    </div>
    {board.data.honorSoloCredit && <HonorSoloPolicy look="kit" />}
    {board.data.honorStartsAt ? <div data-testid="honor-opening" className="gk-report__note" data-tone="good">
      <p>
        {t('leaderboard.honorOpened')} <time className="gk-num" dateTime={board.data.honorStartsAt.toISOString()}>
          {new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' }).format(board.data.honorStartsAt)}
        </time>
      </p>
      <p>{t('leaderboard.honorOpeningRule')}</p>
    </div> : null}
    <div className="gk-lb__rules">
      {HONOR_RULES.map(({ id, glyph, text }) => (
        <Fold key={id} data-honor-rule={id} glyph={glyph} title={t(`leaderboard.ruleTitle.${id}`)}>
          <p className="gk-report__copy">{t(`leaderboard.${text}`)}</p>
        </Fold>
      ))}
    </div>
  </>;

  return (
    <div data-v2-leaderboard className="gk gk-lb">
      <SeasonRewardReceipt receipt={season.data?.seasonReward} />
      {board.data.honorEnabled ? <GameTabs<'HONOR' | 'DOMINION'>
        label={t('leaderboard.rankingChoice')}
        value={board.data.ranking}
        onChange={setRanking}
        tabs={[
          { id: 'HONOR', label: t('leaderboard.honorTitle'), glyph: { id: 'star', tone: 'self' } },
          { id: 'DOMINION', label: t('leaderboard.score'), glyph: { id: 'colony' } },
        ]}
      /> : null}
      {pages.length > 1 ? <Choices<LeaderboardPage> label={t('leaderboard.view.label')} options={pages} value={shown} onChange={setPage} /> : null}
      {shown === 'standings' ? standings : shown === 'rewards' ? rewards : rules}
    </div>
  );
}

type LeaderboardPage = 'standings' | 'rewards' | 'rules';

/** Each Honor rule under its own short title, shut until asked (owner 2026-11-17: no wall of text). */
const HONOR_RULES = [
  { id: 'combat', glyph: 'attack', text: 'honorRuleCombat' },
  { id: 'bands', glyph: 'target', text: 'honorRuleBands' },
  { id: 'defense', glyph: 'shield', text: 'honorRuleDefense' },
  { id: 'repeat', glyph: 'refresh', text: 'honorRuleRepeat' },
  { id: 'prize', glyph: 'crate', text: 'honorPrizeHint' },
  { id: 'package', glyph: 'star', text: 'honorPackageOnce' },
] as const;

type LeaderboardRow = NonNullable<ReturnType<typeof useLeaderboard>['data']>['ladder'][number];

/**
 * ONE COMMANDER ON THE LADDER (C19): place, world, who, score — one 56 px line, not a card.
 * The podium is an object, everybody else a numeral; another commander's name is a door to
 * their world in the galaxy; the reader's own line is lit and says so.
 */
function LadderRow({ row, self, honor, widest, onFocusPlanet, prize = null }: {
  row: LeaderboardRow;
  self: boolean;
  honor: boolean;
  widest: number;
  onFocusPlanet: (planetId: string) => void;
  prize?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const planetId = row.planetId;
  const go = useOwnPress(() => {
    if (planetId === undefined) return;
    playSound('tap');
    haptic('tap');
    onFocusPlanet(planetId);
  });
  const identity = <>
    {row.clan ? <span title={row.clan.name}><ClanTag tag={row.clan.tag} tier={row.clan.tier} className="gk-lb__tag" /></span> : null}
    {row.clan ? ' ' : null}{row.username}
  </>;
  const who = (
    <span className="gk-lb__words">
      <span className="gk-lb__flagline">
        <Flag code={row.country} language={i18n.resolvedLanguage ?? 'en'} />
        {row.planetName !== undefined ? <span data-leaderboard-meta="" className="gk-lb__world">{row.planetName}</span> : null}
      </span>
      <span className="gk-lb__name">{identity}</span>
    </span>
  );
  return (
    <div className="gk-lb__row" {...(self ? { 'data-self': '' } : {})}>
      {/* The podium is an object; everybody else is a numeral. */}
      {isPlace(row.rank) && (!honor || row.score > 0)
        ? <Medal place={row.rank} size={23} className="gk-lb__medal" />
        : <span className="gk-lb__rank gk-num">{row.rank}</span>}
      <PlanetSigil seed={row.planetId ?? row.playerId} skinId={row.skinId} size={32} />
      {self || planetId === undefined ? (
        <span className="gk-lb__who" aria-label={commanderLabel(row.username, row.clan?.tag)}>
          {who}
          {self ? <span className="gk-lb__you">{t('leaderboard.you')}</span> : null}
        </span>
      ) : (
        <button type="button" {...OWN_SOUND} className="gk-lb__who gk-lb__door" aria-label={commanderLabel(row.username, row.clan?.tag)}
          onPointerDown={go.onPointerDown} onClick={go.onClick}>
          {who}
        </button>
      )}
      <span data-leaderboard-score="" className="gk-lb__score">
        <span aria-hidden className="gk-lb__bar">
          <span data-score-bar="" data-dir={row.score < 0 ? 'back' : 'ahead'} data-ranking={honor ? 'honor' : 'dominion'}
            style={{ width: `${String((Math.abs(row.score) / widest) * 50)}%` }} />
        </span>
        <RankingScores honor={honor ? row.score : undefined} dominion={row.dominion ?? (honor ? undefined : row.score)} />
      </span>
      {prize === null ? null : <span className="gk-lb__prizeline">{prize}</span>}
    </div>
  );
}

/** Current resources for this ladder, before the season's single-package selection. */
function RowPrize({ reward }: { reward: Resources | undefined }) {
  const { t } = useTranslation();
  if (!reward || (reward.alloy === 0 && reward.crystal === 0 && reward.deuterium === 0)) {
    return <span className="gk-lb__noprize">{t('leaderboard.rewards.noPrize')}</span>;
  }
  return <span role="group" aria-label={t('leaderboard.rewards.currentPrize')} className="gk-lb__purse gk-num gk-lb__rowprize">
    {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <span key={resource} className="gk-lb__coin" data-res={resource}>
      <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} />
      {full(reward[resource])}
    </span>)}
  </span>;
}
