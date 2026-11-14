import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SETTLEMENT_PRIORITY_MINUTES } from '@astera/rules';
import { useChronicle } from '../api/queries.js';
import { EmptyState, GameButton, Glyph, artIconSrc, type GlyphId } from '../game-ui/index.js';
import { chatRelativeTime } from '../lib/chatTime.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useNow } from '../lib/time.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';

/** How a moment reads at a glance (C10): a blow, a rise, an opening, or something that ran out. */
type Tone = 'hostile' | 'gold' | 'good' | 'quiet';

/** A galaxy event's own mark: the merchant's crate, the convoy, the shower's rock. */
const EVENT_GLYPH = { TRADE_SHIP: 'crate', INTERGALACTIC_CONVOY: 'rocket', ASTEROID_SHOWER: 'asteroid' } as const satisfies Record<string, GlyphId>;

const GROUP_MS = 8 * 60_000;

export function ChronicleScreen({
  onFocusPlanet,
  focusablePlanetIds,
}: {
  onFocusPlanet: (planetId: string) => void;
  /** Omit in isolated surfaces; the live galaxy passes this to avoid dead links. */
  focusablePlanetIds?: readonly string[];
}) {
  const { t } = useTranslation();
  const chronicle = useChronicle();
  const now = useNow(30_000);
  /**
   * A RUN OF THE SAME THING IS ONE ROW WITH A COUNT. `interface.md` I4.
   *
   * The rule was written for Signals and implemented here for exactly one kind —
   * bombardment — so a galaxy in which several Death Stars landed inside a few
   * minutes printed the same headline and the same twelve-word sentence seven
   * times down a phone. Everything after the first row was the reader learning
   * nothing. Any kind folds now, against the same subject and the same window.
   */
  const events = useMemo(() => {
    const rows = (chronicle.data?.pages ?? []).flatMap((page) => page.events);
    const grouped: { event: (typeof rows)[number]; count: number }[] = [];
    for (const event of rows) {
      const previous = grouped.find((entry) =>
        entry.event.kind === event.kind
        && entry.event.subjectPlanetId === event.subjectPlanetId
        && entry.event.occurredAt.getTime() - event.occurredAt.getTime() <= GROUP_MS);
      if (previous) previous.count += 1;
      else grouped.push({ event, count: 1 });
    }
    return grouped;
  },
    [chronicle.data?.pages],
  );

  if (chronicle.isError) {
    return <Unreachable what={t('surface.whatChronicle')} onRetry={() => { void chronicle.refetch(); }} />;
  }
  if (!chronicle.data) return <Waiting>{t('surface.waitingChronicle')}</Waiting>;

  return (
    <div role="log" aria-label={t('chronicle.list')} aria-live="polite" className="gk gk-chron">
      {events.length === 0 ? (
        <EmptyState art={artIconSrc('nav-galaxy')} title={t('chronicle.emptyTitle')} body={t('chronicle.empty')} />
      ) : (
        <ol className="gk-ledger">
          {events.map(({ event, count }) => {
            let title: string;
            let detail: string;
            let tone: Tone = 'good';
            let glyph: GlyphId = 'star';
            switch (event.kind) {
              case 'bombardment':
                title = t(count > 1 ? 'chronicle.bombardmentGrouped' : 'chronicle.bombardment', {
                  planet: event.payload.planetName,
                  count,
                });
                detail = t('chronicle.bombardmentDetail', { commander: event.payload.commanderName });
                tone = 'hostile';
                glyph = 'attack';
                break;
              case 'core_tier':
                title = t('chronicle.coreTier', { planet: event.payload.planetName, tier: event.payload.tier });
                detail = t('chronicle.coreTierDetail', { commander: event.payload.commanderName });
                tone = 'gold';
                glyph = 'up';
                break;
              case 'isotope_exhausted':
                title = t('chronicle.isotopeExhausted');
                detail = t('chronicle.isotopeExhaustedDetail');
                tone = 'quiet';
                glyph = 'mine';
                break;
              case 'wreck_formed':
                title = t('chronicle.wreckFormed', { planet: event.payload.planetName });
                detail = t('chronicle.wreckFormedDetail');
                glyph = 'debris';
                break;
              case 'wreck_exhausted':
                title = t('chronicle.wreckExhausted', { planet: event.payload.planetName });
                detail = t('chronicle.wreckExhaustedDetail');
                tone = 'quiet';
                glyph = 'debris';
                break;
              case 'dominion_leader':
                title = t('chronicle.dominionLeader', { commander: event.payload.commanderName });
                detail = t('chronicle.dominionLeaderDetail', { planet: event.payload.planetName });
                tone = 'gold';
                glyph = 'ranking';
                break;
              case 'season_act':
                title = t(`chronicle.act.${event.payload.act}.title`);
                detail = t(`chronicle.act.${event.payload.act}.detail`);
                tone = 'gold';
                glyph = 'history';
                break;
              case 'neutral_claim':
                title = t('chronicle.neutralClaim', {
                  planet: event.payload.planetName,
                  tier: event.payload.tier,
                });
                detail = t('chronicle.neutralClaimDetail', { minutes: SETTLEMENT_PRIORITY_MINUTES });
                glyph = 'colony';
                break;
              case 'neutral_opened':
                title = t('chronicle.neutralOpened', { total: event.payload.total });
                detail = t('chronicle.neutralOpenedDetail', {
                  t1: event.payload.tiers[1],
                  t2: event.payload.tiers[2],
                  t3: event.payload.tiers[3],
                });
                glyph = 'colony';
                break;
              case 'death_star_impact':
                title = t('chronicle.deathStarImpact', { planet: event.payload.planetName });
                detail = t(`chronicle.deathStarOutcome.${
                  event.payload.outcome === 'FIRST_STRIKE' && !event.payload.capturable
                    ? 'CAPITAL_STRIKE'
                    : event.payload.outcome
                }`);
                tone = 'hostile';
                glyph = 'critical';
                break;
              case 'control_transfer':
                title = t('chronicle.controlTransfer', { planet: event.payload.planetName });
                detail = t('chronicle.controlTransferDetail', {
                  commander: event.payload.commanderName,
                });
                tone = 'gold';
                glyph = 'flag';
                break;
              /*
                TWO PUBLIC EVENTS SHARE ONE ROW KIND. D156.

                The payload is discriminated on `eventKind`, so the sentence is
                chosen from the payload rather than from the row — a merchant and a
                shower are the same MOMENT in the record and entirely different
                news. Reading `asteroidSpawnMultiplier` unconditionally is what the
                schema's old shower-only literal was protecting; the narrowing is
                what replaces it.
              */
              case 'galaxy_event_started':
                title = event.payload.eventKind === 'TRADE_SHIP'
                  ? t('chronicle.tradeShipStarted')
                  : event.payload.eventKind === 'INTERGALACTIC_CONVOY'
                    ? t('chronicle.intergalacticConvoyStarted')
                    : t('chronicle.asteroidShowerStarted');
                detail = event.payload.eventKind === 'TRADE_SHIP'
                  ? t('chronicle.tradeShipStartedDetail', {
                    alloy: full(event.payload.rate.deuterium / event.payload.rate.alloy),
                    crystal: full(event.payload.rate.deuterium / event.payload.rate.crystal),
                  })
                  : event.payload.eventKind === 'INTERGALACTIC_CONVOY'
                    ? t('chronicle.intergalacticConvoyStartedDetail')
                    : t('chronicle.asteroidShowerStartedDetail', {
                      multiplier: event.payload.asteroidSpawnMultiplier,
                    });
                glyph = EVENT_GLYPH[event.payload.eventKind];
                break;
              case 'galaxy_event_ended':
                title = event.payload.eventKind === 'TRADE_SHIP'
                  ? t('chronicle.tradeShipEnded')
                  : event.payload.eventKind === 'INTERGALACTIC_CONVOY'
                    ? t('chronicle.intergalacticConvoyEnded')
                    : t('chronicle.asteroidShowerEnded');
                detail = event.payload.eventKind === 'TRADE_SHIP'
                  ? t('chronicle.tradeShipEndedDetail')
                  : event.payload.eventKind === 'INTERGALACTIC_CONVOY'
                    ? t('chronicle.intergalacticConvoyEndedDetail')
                    : t('chronicle.asteroidShowerEndedDetail');
                tone = 'quiet';
                glyph = EVENT_GLYPH[event.payload.eventKind];
                break;
            }
            const focus = event.subjectPlanetId
                && (!focusablePlanetIds || focusablePlanetIds.includes(event.subjectPlanetId))
                ? () => { onFocusPlanet(event.subjectPlanetId!); }
                : null;
            return (
              <li key={event.id}>
                <Moment
                  title={title}
                  detail={detail}
                  tone={tone}
                  glyph={glyph}
                  count={count}
                  at={event.occurredAt}
                  now={now}
                  onFocus={focus}
                />
              </li>
            );
          })}
        </ol>
      )}
      {chronicle.hasNextPage && (
        <GameButton size="sm" wide pending={chronicle.isFetchingNextPage} onPress={() => { void chronicle.fetchNextPage(); }}>
          {chronicle.isFetchingNextPage ? t('chronicle.loadingOlder') : t('chronicle.older')}
        </GameButton>
      )}
    </div>
  );
}

/**
 * ONE REMEMBERED MOMENT, ONE KIT ROW (C10). Its mark says at a glance what kind of news
 * it is; WHEN sits beside the headline, the second thing read on every row of a log. A
 * moment on a world you can reach is a door as a whole, named by its headline and told
 * by its story, so a reader hears both.
 */
function Moment({ title, detail, tone, glyph, count, at, now, onFocus }: {
  title: string;
  detail: string;
  tone: Tone;
  glyph: GlyphId;
  count: number;
  at: Date;
  now: number;
  onFocus: (() => void) | null;
}) {
  const { t } = useTranslation();
  const id = useId();
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onFocus?.(); });
  const face = (
    <>
      <span className="gk-chron__mark" data-tone={tone} aria-hidden="true"><Glyph id={glyph} /></span>
      <span className="gk-ledger__words">
        <span id={`${id}-title`} className="gk-ledger__title">{title}</span>
        <span id={`${id}-story`} className="gk-ledger__sub">{detail}</span>
      </span>
      <span className="gk-chron__side">
        {count > 1 && (
          <span className="gk-chron__count gk-num">
            <span aria-hidden="true">×{count}</span>
            <span className="sr-only">{t('chronicle.repeatCount', { count })}</span>
          </span>
        )}
        <time id={`${id}-when`} className="gk-chron__time gk-num" dateTime={at.toISOString()}>
          {chatRelativeTime(at, now, t)}
        </time>
      </span>
    </>
  );
  return onFocus
    ? (
      <button
        type="button"
        className="gk-ledger__row"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-story ${id}-when`}
        {...OWN_SOUND}
        onPointerDown={own.onPointerDown}
        onClick={own.onClick}
      >
        {face}
      </button>
    )
    : <div className="gk-ledger__row">{face}</div>;
}
