import { seasonRankRewardProgram } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { SeasonInfo, Leaderboard } from '../api/schemas.js';
import { useAccordion } from '../lib/accordion.js';
import { full } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { serverNow } from '../lib/clock.js';
import { RESOURCE_ART } from './assets.js';
import { Medal, isPlace } from './Medal.js';
import { Glyph } from '../game-ui/icons.js';
import { SectionTag } from '../game-ui/surfaces.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from './kit/useOwnPress.js';

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
  const toggle = useOwnPress(() => { playSound('tap'); haptic('tap'); tiers.toggle('tiers'); });
  const honor = board?.ranking === 'HONOR';
  // Honor is frozen to the v1 basis, independently of the current Dominion program.
  const basis = honor ? seasonRankRewardProgram(1) : null;
  const program = honor && basis ? { minimumDominion: 0, tiers: basis.tiers.map(({ place, reward }) => ({
    place, alloy: reward.alloy * 2, crystal: reward.crystal * 2, deuterium: reward.deuterium * 2,
  })) } : season?.seasonRewards ?? null;
  if (!program || program.tiers.length === 0) return null;

  const places = program.tiers.length;
  const tableOpen = tiers.isOpen('tiers');
  const yours = board?.you?.rank ?? null;
  const minimumNeeded = board?.you
    ? Math.max(0, program.minimumDominion - board.you.score)
    : 0;
  const winning = yours !== null && yours <= places && minimumNeeded === 0
    && board?.you?.isBot !== true;
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
    ? Math.max(0, cutoff.score - board.you.score + 1)
    : null;

  const left = season?.status === 'live'
    ? Math.max(0, (season.endsAt.getTime() - serverNow()) / 60_000)
    : null;

  return (
    <section className="gk-lb__board" aria-label={t('leaderboard.rewards.title')}>
      <SectionTag as="h2" aside={left === null ? undefined : <span className="gk-num">{t('leaderboard.rewards.left', { duration: duration(left) })}</span>}>
        {t('leaderboard.rewards.title')}
      </SectionTag>

      <p className="gk-report__copy">
        {honor ? t('leaderboard.rewards.honorExplain', { places }) : t('leaderboard.rewards.explain', { places, minimum: full(program.minimumDominion) })}
      </p>

      <div className="gk-ledger">
        <button
          type="button"
          {...OWN_SOUND}
          aria-expanded={tableOpen}
          aria-controls="season-reward-tier-list"
          onPointerDown={toggle.onPointerDown}
          onClick={toggle.onClick}
          className="gk-ledger__row gk-lb__tiers"
        >
          <span className="gk-ledger__mark" data-tone="alloy" aria-hidden="true"><Glyph id="crate" /></span>
          <span className="gk-ledger__words">
            <span className="gk-ledger__title">{t('leaderboard.rewards.table')}</span>
            <span className="gk-ledger__sub">{t('leaderboard.rewards.tableCount', { places })}</span>
          </span>
          <span className="gk-rules__chev" {...(tableOpen ? { 'data-open': '' } : {})} aria-hidden="true"><Glyph id="down" /></span>
        </button>

        {tableOpen ? (
          <ol id="season-reward-tier-list" aria-label={t('leaderboard.rewards.table')} className="gk-lb__tierlist">
            {program.tiers.map((tier) => (
              <li key={tier.place} className="gk-lb__tier">
                {isPlace(tier.place)
                  ? <Medal place={tier.place} size={16} className="gk-lb__medal" />
                  : <span className="gk-lb__rank gk-num">#{tier.place}</span>}
                <span className="gk-report__label">{t('leaderboard.rewards.place', { place: tier.place })}</span>
                <Prize alloy={tier.alloy} crystal={tier.crystal} deuterium={tier.deuterium} />
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {/* THE READER'S OWN LINE, STILL ABOVE THE LIVE LADDER. */}
      {!honor || yours === null ? <div
        className="gk-well gk-lb__standing"
        data-reward-standing={winning ? 'paid' : 'unpaid'}
      >
        {yours === null ? (
          <p className="gk-report__copy">{t('leaderboard.rewards.unranked')}</p>
        ) : winning && mine ? (
          <>
            <p className="gk-lb__holding">
              {isPlace(yours) ? <Medal place={yours} size={22} className="gk-lb__medal" /> : null}
              <span>{t('leaderboard.rewards.holding', { place: yours })}</span>
            </p>
            <Prize alloy={mine.alloy} crystal={mine.crystal} deuterium={mine.deuterium} />
            <p className="gk-report__copy">{t('leaderboard.rewards.paidWhen')}</p>
          </>
        ) : (
          <>
            <p className="gk-label">{t('leaderboard.rewards.standing', { place: yours })}</p>
            <p className="gk-report__copy" data-strong="">
              {board?.you?.isBot === true
                ? t('leaderboard.rewards.botIneligible')
                : minimumNeeded > 0
                ? t('leaderboard.rewards.minimum', { score: full(minimumNeeded) })
                : behind === null
                ? t('leaderboard.rewards.climb', { places })
                : t('leaderboard.rewards.behind', { score: full(behind), places })}
            </p>
          </>
        )}
      </div> : null}
    </section>
  );
}

/** The three piles, always in the same order and always with their own art. */
function Prize({ alloy, crystal, deuterium }: { alloy: number; crystal: number; deuterium: number }) {
  const { t } = useTranslation();
  return (
    <span className="gk-haul__row gk-num gk-lb__piles">
      {([['alloy', alloy], ['crystal', crystal], ['deuterium', deuterium]] as const).map(([resource, amount]) => (
        <span key={resource} className="gk-haul__res" data-res={resource}>
          <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} />
          {full(amount)}
        </span>
      ))}
    </span>
  );
}
