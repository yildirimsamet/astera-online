import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard } from '../api/queries.js';
import i18n from '../i18n/index.js';
import { full, signed } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { commanderLabel } from '../lib/identity.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { EmptyState, Unreachable, Waiting } from '../ui/kit/index.js';
import { useToast } from '../ui/Toast.js';

/** The whole local galaxy, ordered by the server's authoritative Dominion score. */
export function LeaderboardScreen({ onFocusPlanet }: { onFocusPlanet: (planetId: string) => void }) {
  const { t } = useTranslation();
  const board = useLeaderboard();
  const say = useToast();
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
    return <div className="px-4 py-4"><EmptyState title={t('leaderboard.empty')} /></div>;
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

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line-soft bg-void px-4 py-3">
        <input
          type="search"
          name="leaderboard-search"
          autoComplete="off"
          value={query}
          onChange={(event) => { setQuery(event.currentTarget.value); }}
          aria-label={t('leaderboard.searchLabel')}
          placeholder={t('leaderboard.searchPlaceholder')}
          className="field min-h-11 w-full"
        />
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6"><EmptyState title={t('leaderboard.noMatch')} /></div>
      ) : (
    <ol className="divide-y divide-line-soft" aria-label={t('leaderboard.title')}>
      {rows.map((row) => {
        const self = row.playerId === mine;
        return (
          <li
            key={row.playerId}
            aria-current={self ? 'true' : undefined}
            className={`grid grid-cols-[2.25rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 ${self ? 'bg-crystal/8' : ''}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
          >
            <span className={`num text-center text-body ${self ? 'text-crystal' : 'text-faint'}`}>
              {row.rank}
            </span>
            <PlanetSigil seed={row.planetId ?? row.playerId} size={40} />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                {self ? (
                  <strong
                    className="name flex min-w-0 items-baseline gap-2 text-bone"
                    aria-label={commanderLabel(row.username, row.clan?.tag)}
                  >
                    {row.clan ? (
                      <span className="legend shrink-0 text-crystal" title={row.clan.name}>
                        [{row.clan.tag}]
                      </span>
                    ) : null}
                    <span className="truncate">{row.username}</span>
                  </strong>
                ) : (
                  <button
                    type="button"
                    aria-label={commanderLabel(row.username, row.clan?.tag)}
                    onClick={() => {
                      haptic('tap');
                      if (row.planetId === undefined) {
                        say(t('leaderboard.locationUnknown'), 'error');
                        return;
                      }
                      onFocusPlanet(row.planetId);
                    }}
                    className="name flex min-w-0 items-baseline gap-2 text-bone underline decoration-bone/35 underline-offset-2"
                  >
                    {row.clan ? (
                      <span className="legend shrink-0 text-crystal" title={row.clan.name}>
                        [{row.clan.tag}]
                      </span>
                    ) : null}
                    <span className="truncate">{row.username}</span>
                  </button>
                )}
                {self ? <span className="legend text-crystal">{t('leaderboard.you')}</span> : null}
              </span>
              {row.planetName !== undefined && row.coreTier !== undefined ? (
                <span className="mt-1 block truncate text-label text-faint">
                  {row.planetName} · {t('leaderboard.tier', { tier: row.coreTier })}
                </span>
              ) : null}
            </span>
            {/*
              A LADDER IS A COMPARISON, SO IT IS DRAWN AS ONE. Owner instruction.

              Three hundred signed figures in a column is a table a reader has to
              sort in their head to answer the question they opened it holding:
              how far ahead is the leader, and how far behind am I. A bar off a
              centre line answers it without being read — length is the gap and
              the SIDE is whether the season has gone your way — and it makes the
              shape of the whole galaxy legible by scrolling.

              World detail is present only when current sight or frozen probe
              memory earned it. UNKNOWN rows remain identities and scores only.
            */}
            <span className="flex shrink-0 items-center gap-2 text-right">
              <span
                aria-hidden
                className="relative block h-2 w-12 shrink-0 overflow-hidden rounded-full bg-line/50"
              >
                <span
                  data-score-bar
                  className={`absolute inset-y-0 ${
                    row.score < 0 ? 'right-1/2 bg-threat/70' : 'left-1/2 bg-opportunity/70'
                  }`}
                  style={{ width: `${String((Math.abs(row.score) / widest) * 50)}%` }}
                />
                <span className="absolute inset-y-0 left-1/2 w-px bg-bone/40" />
              </span>
              <span>
                <span className={`num block text-body ${row.score > 0 ? 'text-opportunity' : row.score < 0 ? 'text-threat' : 'text-dim'}`}>
                  {row.score === 0 ? full(0) : signed(row.score)}
                </span>
                <span className="legend block">{t('leaderboard.score')}</span>
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
