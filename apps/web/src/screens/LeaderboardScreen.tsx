import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard, useSeason } from '../api/queries.js';
import { full } from '../lib/format.js';
import { honorScore } from '../lib/honor.js';
import { HonorSoloPolicy } from '../ui/HonorSoloNotice.js';
import { HonorBenefitsSection } from '../ui/HonorBenefits.js';
import { haptic } from '../lib/haptics.js';
import { commanderLabel } from '../lib/identity.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Medal, isPlace } from '../ui/Medal.js';
import { EmptyState, Segmented, Unreachable, Waiting } from '../ui/kit/index.js';
import { HonorIcon, RewardIcon } from '../ui/icons/index.js';
import { SeasonRewardReceipt } from '../ui/SeasonRewardReceipt.js';
import { RankingScores } from '../ui/RankingScores.js';
import { SeasonRewardBoard } from '../ui/SeasonRewardBoard.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Flag } from '../v2/identity/Flag.js';

/** The current season's Honor race, with the independent Dominion ladder alongside. */
export function LeaderboardScreen({ onFocusPlanet }: {
  onFocusPlanet: (planetId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [ranking, setRanking] = useState<'HONOR' | 'DOMINION'>('HONOR');
  const board = useLeaderboard(true, ranking);
  const season = useSeason();
  const [query, setQuery] = useState('');

  if (board.isError) {
    return (
      <Unreachable
        what={t('surface.whatLeaderboard')}
        onRetry={() => { void board.refetch(); }}
      />
    );
  }
  if (!board.data) return <Waiting>{t('surface.waitingLeaderboard')}</Waiting>;
  if (board.data.ladder.length === 0) {
    return <div className="px-2 py-2"><EmptyState title={t('leaderboard.empty')} /></div>;
  }

  const mine = board.data.you?.playerId;
  const honor = board.data.ranking === 'HONOR';
  const prize = board.data.honorReward;
  const yours = board.data.you;
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

  return (
    <div data-v2-leaderboard className="font-v2-ui text-v2-ink">
      <SeasonRewardReceipt receipt={season.data?.seasonReward} />
      {board.data.honorEnabled ? <section className="border-b border-v2-line bg-linear-to-br from-v2-self/8 via-v2-panel to-v2-deep px-3 py-3">
        <Segmented<'HONOR' | 'DOMINION'> segments={[
          { id: 'HONOR', label: <span className="inline-flex items-center justify-center gap-1.5 text-body font-bold text-v2-ink"><HonorIcon className="size-4 text-v2-self" />{t('leaderboard.honorTitle')}</span> },
          { id: 'DOMINION', label: <span className="text-caption font-normal text-v2-ink-2">{t('leaderboard.score')}</span> },
        ]}
          value={board.data.ranking} onSelect={setRanking} label={t('leaderboard.rankingChoice')} />
        {honor ? <>
          <p className="mt-3 text-label font-semibold text-v2-ink">{t('leaderboard.honorPrimary')}</p>
          <p className="mt-1 text-caption text-v2-ink-2">{t('leaderboard.honorLead')}</p>
          {board.data.honorSoloCredit && <div className="mt-2"><HonorSoloPolicy /></div>}
          {board.data.honorStartsAt ? <div data-testid="honor-opening" className="mt-2 border-l-2 border-v2-self/60 pl-2.5">
            <p className="text-micro font-semibold text-v2-ink">
              {t('leaderboard.honorOpened')} <time className="num text-v2-self" dateTime={board.data.honorStartsAt.toISOString()}>
                {new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' }).format(board.data.honorStartsAt)}
              </time>
            </p>
            <p className="mt-0.5 text-micro leading-relaxed text-v2-ink-2">{t('leaderboard.honorOpeningRule')}</p>
          </div> : null}
          {board.data.you ? <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-micro text-v2-ink-2">{t('leaderboard.honorYourRank')} <strong className="num text-v2-ink">#{board.data.you.rank}</strong></span>
            <strong className="num flex max-w-[75%] flex-wrap items-baseline justify-end gap-x-1.5 text-figure font-bold text-v2-ink"><HonorIcon className="size-5 shrink-0 self-center text-v2-self" /><span className="break-all">{honorScore(board.data.you.score)}</span><span className="text-body">{t('leaderboard.honorTitle')}</span></strong>
          </div> : null}
          {next && board.data.you ? <p className="mt-1 text-micro text-v2-ink-2">{t('leaderboard.honorNext', {
            amount: honorScore(BigInt(next.score) - BigInt(board.data.you.score)), commander: next.username,
          })}</p> : null}
          {board.data.honorBenefits ? <div className="mt-3"><HonorBenefitsSection value={board.data.honorBenefits} /></div> : null}
          {prize ? <div className="mt-3 border-t border-v2-line pt-2">
            <p className="flex items-center justify-between gap-2 text-caption font-semibold text-v2-ink"><span className="inline-flex items-center gap-1.5"><RewardIcon className="size-4 text-v2-self" />{t('leaderboard.honorPrize')}</span><span className="shrink-0 rounded-chip border border-v2-self/30 bg-v2-self/8 px-1.5 py-0.5 text-micro text-v2-self">{t('leaderboard.honorPrizeMultiplier', { ranking: t('leaderboard.score') })}</span></p>
            <p className="mt-1 text-micro text-v2-ink-2">{t('leaderboard.honorPayment')}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <span key={resource} className="flex items-center gap-1 text-caption">
                <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-5 object-contain" />
                <strong className="num text-v2-ink">{full(prize.reward[resource])}</strong>
                <span className="num text-micro text-v2-ink-2">/ {full(prize.nominal[resource])}</span>
              </span>)}
            </div>
            <p className="mt-2 text-micro text-v2-ink-2">{t('leaderboard.honorThreshold', { amount: honorScore(prize.fullThreshold) })}</p>
          </div> : null}
          <details className="mt-2 text-micro text-v2-ink-2">
            <summary className="cursor-pointer py-1 text-v2-ink underline decoration-v2-line-hi underline-offset-4">{t('leaderboard.honorRules')}</summary>
            <div className="mt-1 space-y-2 leading-relaxed">
              <p>{t('leaderboard.honorRuleCombat')}</p><p>{t('leaderboard.honorRuleDefense')}</p>
              <p>{t('leaderboard.honorRuleRepeat')}</p><p>{t('leaderboard.honorPrizeHint')}</p><p>{t('leaderboard.honorPackageOnce')}</p>
            </div>
          </details>
        </> : null}
      </section> : null}
      {!honor ? <>
        <SeasonRewardBoard season={season.data} board={board.data} />
        {board.data.honorEnabled ? <p className="border-b border-v2-line px-3 py-2 text-caption leading-relaxed text-v2-ink-2">{t('leaderboard.honorPackageOnce')}</p> : null}
      </> : null}
      <div className="sticky top-0 z-10 border-b border-v2-line bg-v2-void px-2 py-3">
        <input
          type="search"
          name="leaderboard-search"
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); }}
          aria-label={t('leaderboard.searchLabel')}
          placeholder={t('leaderboard.searchPlaceholder')}
          className="h-10 w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink outline-none focus:border-v2-self"
        />
      </div>
      {nearby.length === 0 ? null : (
        <section
          role="region"
          aria-label={t('leaderboard.nearby')}
          className="border-b border-v2-line bg-v2-raise/45 px-2 py-2"
        >
          <p className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-v2-self">{t('leaderboard.nearby')}</p>
          <div className="grid gap-1">
            {nearby.map((row) => (
              <NearbyRival
                key={row.playerId}
                row={row}
                honor={honor}
                self={row.playerId === mine}
                onFocusPlanet={onFocusPlanet}
              />
            ))}
          </div>
        </section>
      )}
      {rows.length === 0 ? (
        <div className="px-2 py-6"><EmptyState title={t('leaderboard.noMatch')} /></div>
      ) : (
    <ol className="divide-y divide-v2-line" aria-label={t('leaderboard.title')}>
      {rows.map((row) => {
        const self = row.playerId === mine;
        const identity = <>{row.clan ? <span className="text-crystal" title={row.clan.name}>[{row.clan.tag}]</span> : null}{row.clan ? ' ' : null}{row.username}</>;
        return (
          <li
            key={row.playerId}
            aria-current={self ? 'true' : undefined}
            className={`grid grid-cols-[2rem_2.5rem_minmax(0,1fr)] items-center gap-2 px-2 py-2 ${self ? 'bg-v2-self/8' : ''}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '88px' }}
          >
            {/* The podium is an object; everybody else is a numeral. */}
            {isPlace(row.rank) && (!honor || row.score > 0) ? (
              <Medal place={row.rank} size={26} className="mx-auto" />
            ) : (
              <span className={`num text-center text-body ${self ? 'text-crystal' : 'text-faint'}`}>
                {row.rank}
              </span>
            )}
            <PlanetSigil seed={row.planetId ?? row.playerId} skinId={row.skinId} size={40} />
            <span className="block min-w-0">
              <span className="mb-1 block leading-none">
                <Flag code={row.country} language={i18n.resolvedLanguage ?? 'en'} />
              </span>
              <span className="flex min-w-0 items-baseline gap-1.5">
                {self ? (
                  <strong
                    className="name min-w-0 flex-1 line-clamp-2 break-words text-bone"
                    aria-label={commanderLabel(row.username, row.clan?.tag)}
                  >
                    {identity}
                  </strong>
                ) : row.planetId !== undefined ? (
                  <button
                    type="button"
                    aria-label={commanderLabel(row.username, row.clan?.tag)}
                    onClick={() => {
                      const planetId = row.planetId;
                      if (planetId === undefined) return;
                      haptic('tap');
                      onFocusPlanet(planetId);
                    }}
                    className="name w-full min-w-0 flex-1 line-clamp-2 break-words text-left text-bone underline decoration-bone/35 underline-offset-2"
                  >
                    {identity}
                  </button>
                ) : (
                  <span
                    className="name min-w-0 flex-1 line-clamp-2 break-words text-bone"
                    aria-label={commanderLabel(row.username, row.clan?.tag)}
                  >
                    {identity}
                  </span>
                )}
                {self ? <span className="legend shrink-0 text-crystal">{t('leaderboard.you')}</span> : null}
              </span>
              <span className="mt-1 flex min-w-0 items-center gap-1.5">
                <span data-leaderboard-meta className="flex min-w-0 flex-1 items-center gap-1.5 text-micro text-faint">
                  {/* The world, never its tier: the raid band reads a commander's MOST
                      developed world, and a capital's tier here invited the wrong comparison. */}
                  {row.planetName !== undefined ? <span className="truncate">{row.planetName}</span> : null}
                </span>
                <span data-leaderboard-score className="flex min-w-24 max-w-[75%] shrink-0 flex-col items-end gap-1 text-right">
                    <span aria-hidden className="relative block h-1 w-10 overflow-hidden rounded-full bg-line/50">
                      <span
                        data-score-bar
                        className={`absolute inset-y-0 ${row.score < 0 ? `right-1/2 ${honor ? 'bg-v2-line-hi' : 'bg-threat/70'}` : `left-1/2 ${honor ? 'bg-v2-self/70' : 'bg-opportunity/70'}`}`}
                        style={{ width: `${String((Math.abs(row.score) / widest) * 50)}%` }}
                      />
                      <span className="absolute inset-y-0 left-1/2 w-px bg-bone/40" />
                    </span>
                  <RankingScores honor={honor ? row.score : undefined} dominion={row.dominion ?? (honor ? undefined : row.score)} />
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
      )}
    </div>
  );
}

type LeaderboardRow = NonNullable<ReturnType<typeof useLeaderboard>['data']>['ladder'][number];

/** Three dense lines: enough to compare the immediate race without duplicating the full table. */
function NearbyRival({
  row,
  self,
  honor,
  onFocusPlanet,
}: {
  row: LeaderboardRow;
  self: boolean;
  honor: boolean;
  onFocusPlanet: (planetId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const identity = (
    <span className="flex min-w-0 flex-col">
      <span className="block leading-none"><Flag code={row.country} language={i18n.resolvedLanguage ?? 'en'} /></span>
      <span className="mt-1 line-clamp-2 break-words">
        {row.clan ? <span className="text-crystal">[{row.clan.tag}]</span> : null}
        {row.clan ? ' ' : null}{row.username}
        {self ? <span className="ml-1.5 text-crystal">{t('leaderboard.you')}</span> : null}
      </span>
    </span>
  );

  return (
    <div
      aria-current={self ? 'true' : undefined}
      className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-chip px-2 py-1.5 ${
        self ? 'border border-crystal/30 bg-crystal/10' : 'border border-line-soft bg-void/35'
      }`}
    >
      <span className={`num text-center text-label ${self ? 'text-crystal' : 'text-faint'}`}>
        {row.rank}
      </span>
      {self || row.planetId === undefined ? (
        <span className="name min-w-0 text-label text-bone">
          {identity}
        </span>
      ) : (
        <button
          type="button"
          aria-label={commanderLabel(row.username, row.clan?.tag)}
          className="name min-w-0 text-left text-label text-bone underline decoration-bone/35 underline-offset-2"
          onClick={() => {
            haptic('tap');
            onFocusPlanet(row.planetId!);
          }}
        >
          {identity}
        </button>
      )}
      <span data-leaderboard-score><RankingScores honor={honor ? row.score : undefined} dominion={row.dominion ?? (honor ? undefined : row.score)} /></span>
    </div>
  );
}
