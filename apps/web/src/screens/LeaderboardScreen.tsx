import { useTranslation } from 'react-i18next';
import { useLeaderboard } from '../api/queries.js';
import { full, signed } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Empty } from '../ui/primitives.js';
import { Unreachable, Waiting } from '../ui/kit/Surface.js';

/** The whole local galaxy, ordered by the server's authoritative Dominion score. */
export function LeaderboardScreen({ onFocusPlanet }: { onFocusPlanet: (planetId: string) => void }) {
  const { t } = useTranslation();
  const board = useLeaderboard();

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
    return <div className="px-4 py-5"><Empty>{t('leaderboard.empty')}</Empty></div>;
  }

  const mine = board.data.you?.playerId;
  return (
    <ol className="divide-y divide-line-soft" aria-label={t('leaderboard.title')}>
      {board.data.ladder.map((row) => {
        const self = row.playerId === mine;
        return (
          <li
            key={row.playerId}
            aria-current={self ? 'true' : undefined}
            className={`grid grid-cols-[2.25rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 ${self ? 'bg-crystal/8' : ''}`}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '64px' }}
          >
            <span className={`num text-center text-[15px] ${self ? 'text-crystal' : 'text-faint'}`}>
              {row.rank}
            </span>
            <PlanetSigil seed={row.planetId} size={40} />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                {self ? (
                  <strong className="truncate font-display text-[13px] font-bold uppercase tracking-wide text-bone">
                    {row.username}
                  </strong>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      haptic('tap');
                      onFocusPlanet(row.planetId);
                    }}
                    className="truncate font-display text-[13px] font-bold uppercase tracking-wide text-bone underline decoration-bone/35 underline-offset-2"
                  >
                    {row.username}
                  </button>
                )}
                {self ? <span className="text-micro uppercase text-crystal">{t('leaderboard.you')}</span> : null}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-faint">
                {row.planetName} · {t('leaderboard.tier', { tier: row.coreTier })}
              </span>
            </span>
            <span className="text-right">
              <span className={`num block text-[14px] ${row.score > 0 ? 'text-opportunity' : row.score < 0 ? 'text-threat' : 'text-dim'}`}>
                {row.score === 0 ? full(0) : signed(row.score)}
              </span>
              <span className="legend block">{t('leaderboard.score')}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
