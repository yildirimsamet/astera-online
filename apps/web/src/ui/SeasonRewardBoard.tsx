import { useTranslation } from 'react-i18next';
import type { SeasonInfo, Leaderboard } from '../api/schemas.js';
import { useAccordion } from '../lib/accordion.js';
import { full } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { serverNow } from '../lib/clock.js';
import { RESOURCE_ART } from './assets.js';
import { ChevronIcon, RewardIcon } from './icons/index.js';
import { Medal, isPlace } from './Medal.js';

/**
 * WHY A COMMANDER IS STILL HERE IN WEEK TWO.
 *
 * The archive answers "what did I do". Nothing answered "what am I playing FOR",
 * and that was the hole at the centre of the season: everything a player builds
 * is wiped at the boundary, the first ten commanders are paid a real opening
 * advantage in the next galaxy, and there was NOWHERE to learn that. The
 * entitlement was sealed at freeze and deposited silently on the next join, so
 * the only way to discover the program was to have already won it.
 *
 * SO THE PRIZE SITS ON TOP OF THE LADDER IT IS PAID FOR. Not in a menu, not in a
 * help sheet — directly above the standings, where a commander is already looking
 * at the one number that decides it.
 *
 * THREE THINGS, IN THE ORDER A PLAYER ASKS THEM.
 *   1. How long have I got — the season clock, because a prize with no deadline
 *      is not urgent and this one is the whole re-engagement mechanism.
 *   2. Where do *I* stand — their own line, first, and phrased as a position
 *      rather than as a table to search for themselves in.
 *
 * THE TEN PRIZES ARE ONE QUIET DISCLOSURE ABOVE THE LADDER. They are public rules,
 * not private standing data, and every commander must be able to inspect the whole
 * bargain without searching ten live rows. Keeping the list folded preserves the
 * comparison density of the leaderboard; remembering the fold means a commander
 * who is actively comparing prizes does not pay the same tap on every visit.
 */
export function SeasonRewardBoard({
  season,
  board,
}: {
  season: SeasonInfo | undefined;
  board: Leaderboard | undefined;
}) {
  const { t } = useTranslation();
  // Hooks stay above the early return: pre-program cycles still render this
  // component and must not change the hook order when a refetch resolves.
  const tiers = useAccordion('season-reward-tiers', []);
  const program = season?.seasonRewards ?? null;
  if (!program || program.tiers.length === 0) return null;

  const places = program.tiers.length;
  const tableOpen = tiers.isOpen('tiers');
  const yours = board?.you?.rank ?? null;
  const winning = yours !== null && yours <= places;
  const mine = winning ? program.tiers.find((tier) => tier.place === yours) ?? null : null;

  /**
   * THE GAP TO THE LAST PAID PLACE, for a commander who is not in one.
   *
   * "You are 42nd" is a fact. "You are 4,200 behind the last paid place" is a
   * decision — it is the only figure that says whether tonight's raid is worth
   * flying. Read off the ladder the server already sent, so it costs nothing and
   * cannot disagree with the row it is measured against.
   */
  const cutoff = board?.ladder.find((row) => row.rank === places) ?? null;
  const behind = !winning && cutoff && board?.you
    ? Math.max(0, cutoff.score - board.you.score)
    : null;

  const left = season?.status === 'live'
    ? Math.max(0, (season.endsAt.getTime() - serverNow()) / 60_000)
    : null;

  return (
    <section
      className="border-b border-line-soft px-2 py-3"
      aria-label={t('leaderboard.rewards.title')}
    >
      <header className="flex items-baseline gap-2">
        <RewardIcon className="size-4 shrink-0 text-opportunity" />
        <h2 className="legend text-opportunity">{t('leaderboard.rewards.title')}</h2>
        <span className="rail-soft flex-1" />
        {left === null ? null : (
          <span className="num shrink-0 text-micro text-faint">
            {t('leaderboard.rewards.left', { duration: duration(left) })}
          </span>
        )}
      </header>

      <p className="mt-2 text-label leading-snug text-dim">
        {t('leaderboard.rewards.explain', { places })}
      </p>

      <div className="plate plate-cut mt-3 overflow-hidden">
        <button
          type="button"
          aria-expanded={tableOpen}
          aria-controls="season-reward-tier-list"
          onClick={() => { tiers.toggle('tiers'); }}
          className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-crystal"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-opportunity/30 bg-opportunity/8 text-opportunity">
            <RewardIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="legend block text-bone">{t('leaderboard.rewards.table')}</span>
            <span className="mt-0.5 block text-micro text-faint">
              {t('leaderboard.rewards.tableCount', { places })}
            </span>
          </span>
          <ChevronIcon
            className={`size-4 shrink-0 text-faint transition-transform ${tableOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {tableOpen ? (
          <ol
            id="season-reward-tier-list"
            aria-label={t('leaderboard.rewards.table')}
            className="grid border-t border-line-soft bg-void/35 md:grid-cols-2"
          >
            {program.tiers.map((tier) => (
              <li
                key={tier.place}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 border-b border-line-soft px-3 py-2 md:odd:border-r"
              >
                {isPlace(tier.place) ? (
                  <Medal place={tier.place} size={16} className="mx-auto" />
                ) : (
                  <span className="num text-center text-label text-faint">#{tier.place}</span>
                )}
                <span className="flex min-w-0 items-center gap-3">
                  <span className="legend w-16 shrink-0 text-dim">
                    {t('leaderboard.rewards.place', { place: tier.place })}
                  </span>
                  <Prize
                    alloy={tier.alloy}
                    crystal={tier.crystal}
                    deuterium={tier.deuterium}
                    size="sm"
                  />
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {/* THE READER'S OWN LINE, STILL ABOVE THE LIVE LADDER. */}
      <div
        className={`plate mt-3 px-3 py-3 ${winning ? 'plate-cut' : 'plate-sunk'}`}
        data-reward-standing={winning ? 'paid' : 'unpaid'}
      >
        {yours === null ? (
          <p className="text-label text-faint">{t('leaderboard.rewards.unranked')}</p>
        ) : winning && mine ? (
          <>
            <p className="legend flex items-center gap-2 text-opportunity">
              {isPlace(yours) ? <Medal place={yours} size={22} className="text-crystal/70" /> : null}
              <span className="truncate">{t('leaderboard.rewards.holding', { place: yours })}</span>
            </p>
            <Prize alloy={mine.alloy} crystal={mine.crystal} deuterium={mine.deuterium} size="lg" />
            <p className="mt-2 text-label leading-snug text-dim">
              {t('leaderboard.rewards.paidWhen')}
            </p>
          </>
        ) : (
          <>
            <p className="legend text-crystal">
              {t('leaderboard.rewards.standing', { place: yours })}
            </p>
            <p className="mt-1 text-body leading-snug text-bone">
              {behind === null
                ? t('leaderboard.rewards.climb', { places })
                : t('leaderboard.rewards.behind', { score: full(behind), places })}
            </p>
          </>
        )}
      </div>

    </section>
  );
}

/** The three piles, always in the same order and always with their own art. */
function Prize({
  alloy,
  crystal,
  deuterium,
  size,
}: {
  alloy: number;
  crystal: number;
  deuterium: number;
  size: 'sm' | 'lg';
}) {
  const { t } = useTranslation();
  const art = size === 'lg' ? 'size-5' : 'size-3.5';
  const text = size === 'lg' ? 'text-body text-bone' : 'text-label text-dim';
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-3 ${size === 'lg' ? 'mt-2' : ''}`}>
      {([
        ['alloy', alloy],
        ['crystal', crystal],
        ['deuterium', deuterium],
      ] as const).map(([resource, amount]) => (
        <span key={resource} className="flex min-w-0 items-center gap-1">
          <img
            src={RESOURCE_ART[resource]}
            alt={t(`vocabulary.resource.${resource}`)}
            className={`${art} shrink-0 object-contain`}
          />
          <span className={`num truncate ${text}`}>{full(amount)}</span>
        </span>
      ))}
    </span>
  );
}
