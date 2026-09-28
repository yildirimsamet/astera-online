import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard } from '../api/queries.js';
import { full, signed } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { commanderLabel } from '../lib/identity.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Medal, isPlace } from '../ui/Medal.js';
import { EmptyState, Unreachable, Waiting } from '../ui/kit/index.js';
import { Flag } from '../v2/identity/Flag.js';

/** The whole local galaxy, ordered by the server's authoritative Dominion score. */
export function LeaderboardScreen({ onFocusPlanet }: {
  onFocusPlanet: (planetId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const board = useLeaderboard();
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
            {isPlace(row.rank) ? (
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
                  {row.planetName !== undefined && row.coreTier !== undefined ? (
                    <span className="truncate">{row.planetName} · {t('leaderboard.tier', { tier: row.coreTier })}</span>
                  ) : null}
                </span>
                <span data-leaderboard-score className="flex min-w-24 shrink-0 flex-col items-end text-right">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="relative block h-1.5 w-10 overflow-hidden rounded-full bg-line/50">
                      <span
                        data-score-bar
                        className={`absolute inset-y-0 ${row.score < 0 ? 'right-1/2 bg-threat/70' : 'left-1/2 bg-opportunity/70'}`}
                        style={{ width: `${String((Math.abs(row.score) / widest) * 50)}%` }}
                      />
                      <span className="absolute inset-y-0 left-1/2 w-px bg-bone/40" />
                    </span>
                    <span className={`num text-caption ${row.score > 0 ? 'text-opportunity' : row.score < 0 ? 'text-threat' : 'text-dim'}`}>
                      {row.score === 0 ? full(0) : signed(row.score)}
                    </span>
                  </span>
                  <span className="legend block">{t('leaderboard.score')}</span>
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
  onFocusPlanet,
}: {
  row: LeaderboardRow;
  self: boolean;
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
      <span className={`num text-label ${row.score > 0 ? 'text-opportunity' : row.score < 0 ? 'text-threat' : 'text-dim'}`}>
        {row.score === 0 ? full(0) : signed(row.score)}
      </span>
    </div>
  );
}
