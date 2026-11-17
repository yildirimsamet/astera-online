import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SeasonInfo } from '../api/schemas.js';
import { full, signed } from '../lib/format.js';
import { coverGalaxy } from '../lib/galaxyCover.js';
import { honorScore } from '../lib/honor.js';
import { playSound } from '../lib/sound.js';
import { NextSeason } from '../ui/NextSeason.js';
import { useNativeBack } from '../platform/nativeBack.js';
import { artIconSrc } from '../game-ui/art.js';
import { GameButton, RoundButton } from '../game-ui/buttons.js';
import { ClanEmblem } from '../game-ui/ranks.js';
import { StatPlaque } from '../game-ui/readouts.js';

export type SeasonResult = Exclude<SeasonInfo['result'], null | undefined>;

/** The final disc exists only while this result belongs to the frozen season. */
export function seasonRecapShowsPrimaryAction(
  season: Pick<SeasonInfo, 'status' | 'result'> | undefined,
): boolean {
  return season?.status === 'frozen' && season.result != null;
}

/** One acknowledgement per person and world, never one global "seen" bit. */
export const seasonRecapKey = (result: SeasonResult): string =>
  `astera:season-recap:${result.accountId}:${result.seasonId}`;

export function seasonRecapSeen(result: SeasonResult): boolean {
  try {
    return window.localStorage.getItem(seasonRecapKey(result)) === 'seen';
  } catch {
    return false;
  }
}

export function rememberSeasonRecap(result: SeasonResult): void {
  try {
    window.localStorage.setItem(seasonRecapKey(result), 'seen');
  } catch {
    // Storage may be unavailable in a private or embedded browser. The record is
    // still reachable; at worst this one ceremonial surface opens again.
  }
}

export function useSeasonRecapOpening(
  status: string | undefined,
  result: SeasonResult | null | undefined,
  onOpen: () => void,
): void {
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'frozen' || !result) return;
    const identity = `${result.accountId}:${result.seasonId}`;
    if (shown.current === identity) return;
    shown.current = identity;
    if (!seasonRecapSeen(result)) onOpen();
  }, [onOpen, result, status]);
}

export function SeasonRecap({
  result,
  galaxy,
  players,
  endsAt,
  canExplore = true,
  showPrimaryAction = true,
  onClose,
}: {
  result: SeasonResult;
  galaxy: string;
  players?: number;
  /** When the season froze. The wait before the next galaxy is derived from it. */
  endsAt?: Date | null;
  /**
   * Whether there is still a galaxy behind this screen to go back to.
   *
   * From the game it is the way out: closing lands on the final disc. From the
   * server list there is nothing behind it — the season is gone and the commander
   * is picking a new one — so the same button would promise something that does
   * not exist, and the screen would read as having no way out at all.
   */
  canExplore?: boolean;
  /**
   * Past records may open over a new live galaxy. There is nothing final behind
   * them to explore, so the permanent close control is the only exit in that
   * context. The frozen season's five-minute afterglow keeps this action.
   */
  showPrimaryAction?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // The kit's presses answer with their own tap and buzz; Escape and native Back need none.
  const close = useCallback((): void => {
    rememberSeasonRecap(result);
    onClose();
  }, [onClose, result]);
  const panel = useRef<HTMLDivElement>(null);
  useNativeBack(panel, close);
  // A full screen over the disc: nothing behind it needs drawing.
  useEffect(() => coverGalaxy('whole'), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  // The recap covers the screen the moment a season result lands, so its close is
  // another control that can appear under a finger already mid-gesture (D109a): the
  // kit's RoundButton and GameButton take only a press they own (`useOwnPress`).

  const primaryRank = result.honorRank ?? result.finalRank;
  const meritsTitle = result.honorScore == null || result.honorScore > 0;
  const title =
    meritsTitle && primaryRank === 1
      ? t('seasonRecap.titles.sovereign', { galaxy })
      : meritsTitle && primaryRank <= 3
        ? t('seasonRecap.titles.vanguard')
        : (result.honorScore ?? result.dominion) > 0
          ? t('seasonRecap.titles.conqueror')
          : t('seasonRecap.titles.commander');
  const quiet = result.recap.battles === 0;
  // A podium place is the moment of the season: rays behind the crest and the rank-up cue.
  const podium = meritsTitle && primaryRank <= 3;
  const rang = useRef(false);
  useEffect(() => {
    if (rang.current) return;
    rang.current = true;
    playSound(podium ? 'rankup' : 'confirm');
  }, [podium]);

  /*
    THE SEASON'S LAST SCREEN, ON THE KIT (C18, G9 #5). The moment: the galaxy froze and this
    is the commander's record — the place first (in a crest that lights for a podium), the
    two scores, what they fought, the clan, the one story worth retelling, then when the next
    galaxy opens and the one way back to the final disc.
  */
  return (
    <div className="gk gk-recap" ref={panel} role="dialog" aria-modal="true" aria-labelledby="season-recap-title">
      <span className="gk-recap__sky" aria-hidden="true" />
      <main className="gk-recap__main">
        <div className="gk-recap__close">
          <RoundButton glyph="close" label={t('seasonRecap.close')} onPress={close} />
        </div>

        <header className="gk-recap__head">
          <span className="gk-recap__crest">
            {podium && <span className="gk-rays" aria-hidden="true" />}
            <img src={artIconSrc(podium && primaryRank === 1 ? 'crown' : podium ? 'crown-silver' : 'trophy')} alt="" draggable={false} />
          </span>
          <p className="gk-label gk-recap__eyebrow">{t('seasonRecap.eyebrow')}</p>
          <p className="gk-recap__galaxy">{t('seasonRecap.finalRecord', { galaxy })}</p>
          <h1 id="season-recap-title" className="gk-recap__title gk-display gk-outlined">{title}</h1>
          <p className="gk-recap__who">
            {t('seasonRecap.planet', { commander: result.recap.commanderName, planet: result.recap.planetName })}
          </p>
        </header>

        <section className="gk-recap__heroes" aria-label={t('seasonRecap.finalRecord', { galaxy })}>
          <StatPlaque
            {...(result.honorRank != null ? { glyph: 'ranking' as const } : { art: artIconSrc('trophy') })}
            label={result.honorRank != null ? t('leaderboard.honorRank') : t('seasonRecap.place')}
            value={`#${full(primaryRank)}`}
            {...(result.honorRank == null && players !== undefined ? { sub: t('seasonRecap.rank', { rank: result.finalRank, players }) } : {})}
            tone={podium ? 'good' : 'neutral'}
          />
          {result.honorScore != null ? (
            <StatPlaque
              glyph="star"
              label={t('leaderboard.honorTitle')}
              value={honorScore(result.honorScore)}
              sub={<>{t('leaderboard.score')} <span className="gk-num">{result.dominion === 0 ? full(0) : signed(result.dominion)}</span></>}
            />
          ) : (
            <StatPlaque glyph="colony" label={t('seasonRecap.dominion')} value={signed(result.dominion)} />
          )}
        </section>

        <section data-recap-figures="" className="gk-well gk-recap__figures">
          <Figure label={t('seasonRecap.battles')} value={full(result.recap.battles)} />
          <Figure label={t('seasonRecap.attacks')} value={full(result.recap.attacks)} />
          <Figure label={t('seasonRecap.defences')} value={full(result.recap.defences)} />
        </section>
        {result.recap.support && result.recap.support.stood > 0 && (
          <p data-recap-support="" className="gk-report__note" data-tone="good">
            {t('seasonRecap.support', { count: result.recap.support.stood, held: result.recap.support.held })}
          </p>
        )}

        <dl className="gk-well gk-report__sum gk-recap__damage">
          <dt>{t('seasonRecap.damageDealt')}</dt><dd className="gk-num" data-tone="good">{full(result.damageDealt)}</dd>
          <dt>{t('seasonRecap.damageTaken')}</dt><dd className="gk-num" data-tone="threat">{full(result.damageTaken)}</dd>
        </dl>

        {result.recap.clan ? (
          <section className="gk-well gk-recap__clan" aria-label={t('seasonRecap.clan.heading')}>
            <div className="gk-recap__clanhead">
              <ClanEmblem flag={null} tag={result.recap.clan.tag} label={`[${result.recap.clan.tag}]`} size={44} />
              <span className="min-w-0 flex-1">
                <span className="gk-label">{t('seasonRecap.clan.heading')}</span>
                <span className="gk-recap__clanname">[{result.recap.clan.tag}] {result.recap.clan.name}</span>
              </span>
              {result.recap.clan.topThree ? <span className="gk-recap__seal">{t('seasonRecap.clan.seal')}</span> : null}
            </div>
            <div className="gk-recap__figures" data-cols="2">
              <Figure label={t('seasonRecap.clan.rank')} value={`#${full(result.recap.clan.finalRank)}`} />
              <Figure label={t('seasonRecap.clan.dominion')} value={result.recap.clan.dominion === 0 ? full(0) : signed(result.recap.clan.dominion)} />
            </div>
            <p className="gk-report__copy">{t('seasonRecap.clan.recordOnly')}</p>
          </section>
        ) : null}

        {quiet ? (
          <Story heading={t('seasonRecap.quietHeading')} body={t('seasonRecap.quietBody')} />
        ) : (
          <div className="gk-recap__stories">
            {result.recap.rival && (
              <Story
                heading={t('seasonRecap.rivalHeading')}
                body={t('seasonRecap.rival', { name: result.recap.rival.commanderName, count: result.recap.rival.battles })}
              />
            )}
            {result.recap.biggestRaid && (
              <Story
                heading={t('seasonRecap.biggestHeading')}
                body={t('seasonRecap.biggestRaid', { value: full(result.recap.biggestRaid.value), name: result.recap.biggestRaid.opponentName })}
              />
            )}
          </div>
        )}

        {showPrimaryAction && <NextSeason endsAt={endsAt} />}

        {showPrimaryAction ? (
          <div className="gk-recap__go">
            <GameButton tone="action" size="lg" wide glyph="next" onPress={close}>
              {t(canExplore ? 'seasonRecap.explore' : 'seasonRecap.close')}
            </GameButton>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="gk-recap__figure">
      <p className="gk-recap__value gk-display gk-num">{value}</p>
      <p className="gk-report__label">{label}</p>
    </div>
  );
}

function Story({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="gk-well gk-report__why">
      <p className="gk-label gk-recap__storyhead">{heading}</p>
      <p className="gk-recap__story">{body}</p>
    </div>
  );
}
