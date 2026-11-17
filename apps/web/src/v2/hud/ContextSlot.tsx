import { incomingCopy } from '../../starter/shipCopy.js';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveGalaxyEvent, Contact, PendingThread } from '../../api/schemas.js';
import { ContextCard, ContextStrip, GameButton, RoundButton, StatusChip, type GlyphId, type TimerTone } from '../../game-ui/index.js';
import { contextSlot, slotKey, threatKeyOf } from '../../lib/contextSlot.js';
import type { Directive, DirectiveKind } from '../../lib/directives.js';
import { compact } from '../../lib/format.js';
import { useAccordion } from '../../lib/accordion.js';
import { EVENT_GLYPH, EVENT_NAME } from '../../lib/nowLine.js';
import { contactFor, flightTitle, incomingDetail } from '../../lib/flights.js';
import { countdown } from '../../lib/time.js';
import { RESOURCE_ART } from '../../ui/assets.js';

/** A suggestion wears what it is: red only for something happening to you. */
const SUGGESTION_TONE: Record<DirectiveKind, TimerTone> = {
  threat: 'hostile',
  opportunity: 'self',
};

/** And the mark of what it is: a warning, or something to take. */
const SUGGESTION_GLYPH: Record<DirectiveKind, GlyphId> = {
  threat: 'warn',
  opportunity: 'target',
};

const SUGGESTION_LABEL = {
  threat: 'directives.kindThreat',
  opportunity: 'directives.kindOpportunity',
} as const satisfies Record<DirectiveKind, string>;

/** What an event is doing right now, in its own terms. */
function EventDetail({ event, now }: { event: ActiveGalaxyEvent; now: number }) {
  const { t } = useTranslation();
  const remaining = countdown(event.endsAt.getTime() - now);
  switch (event.kind) {
    case 'TRADE_SHIP':
      // The rate is drawn, not written: what one Deuterium buys of each good, each as its picture.
      return (
        <span className="grid gap-0.5">
          <span className="gk-cost">
            {(['alloy', 'crystal', 'deuterium'] as const).map((good, index) => (
              <span key={good} className="gk-cost__part gk-num">
                {index > 0 && <span aria-hidden="true" className="gk-cost__eq">=</span>}
                <img src={RESOURCE_ART[good]} alt={t(`trade.${good}`)} draggable={false} />
                {compact(event.rate.deuterium / event.rate[good])}
              </span>
            ))}
          </span>
          {/* The time left in the same words and type as every other event's line. */}
          <span>{t('trade.chipRemaining', { remaining })}</span>
        </span>
      );
    case 'INTERGALACTIC_CONVOY':
      return <>{t('galaxy.intergalacticConvoyStatus', { remaining })}</>;
    case 'ASTEROID_SHOWER':
      return <>{t('galaxy.asteroidShowerStatus', { multiplier: event.asteroidSpawnMultiplier, remaining })}</>;
  }
}

/**
 * THE SUGGESTION, AT THE SIZE THE PLAYER CHOSE. Owner instruction: *"kullanıcı
 * sürekli ekranda kocaman bunu görmek istemez."* It folds to one line and stays
 * folded on this device — the same stored preference the old guide kept
 * (`guide` / `directive`) — and folding it acts on nothing.
 */
function Suggestion({
  directive,
  onAct,
  onDismiss,
}: {
  directive: Directive;
  onAct: (directive: Directive) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const guide = useAccordion('guide', ['directive']);
  const tone = SUGGESTION_TONE[directive.kind];
  const glyph = SUGGESTION_GLYPH[directive.kind];
  const eyebrow = t(SUGGESTION_LABEL[directive.kind]);

  if (!guide.isOpen('directive')) {
    return (
      <div className="pointer-events-auto">
        <ContextStrip
          tone={tone}
          glyph={glyph}
          eyebrow={eyebrow}
          title={directive.title}
          label={t('directives.show')}
          onPress={() => { guide.toggle('directive'); }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto">
      <ContextCard
        tone={tone}
        glyph={glyph}
        eyebrow={eyebrow}
        title={directive.title}
        actions={(
          <GameButton tone={tone === 'hostile' ? 'danger' : 'self'} size="sm" onPress={() => { onAct(directive); }}>
            {directive.action.label}
          </GameButton>
        )}
        dismissLabel={t('slot.dismiss')}
        onDismiss={onDismiss}
        foldLabel={t('directives.hide')}
        onFold={() => { guide.toggle('directive'); }}
      >
        {directive.detail}
      </ContextCard>
    </div>
  );
}

export interface ContextSlotProps {
  /** Server time, ticking. */
  now: number;
  /** Something on the disc is selected: its own panel has the screen. */
  selected: boolean;
  /** Attacks coming for the player's worlds. */
  threats: readonly PendingThread[];
  /** The disc's contacts: an attack in sight can be looked at. */
  contacts: readonly Contact[];
  /** The galaxy events running now (`activeEvents`); several can overlap. */
  events: readonly ActiveGalaxyEvent[];
  /** `suggestionOf(directives(...))`. */
  suggestion: Directive | null;
  /** Open the base where the defence is built. */
  onPrepare: (thread: PendingThread) => void;
  /** Frame the attacking fleet. */
  onLook: (contactId: string) => void;
  /** Frame the event's ship (trade, convoy). */
  onShowEvent: (event: ActiveGalaxyEvent) => void;
  onAct: (directive: Directive) => void;
  onClearSelection: () => void;
  /**
   * The cards the player closed, by `slotKey`, and how to add to them. Held by the
   * host: the slot is unmounted under every page, and a memory it kept itself was
   * wiped by each visit to the base.
   */
  dismissed: ReadonlySet<string>;
  onDismiss: (keys: readonly string[]) => void;
  /**
   * THE FOOT-RIGHT CORNER: chat's button (owner, 2026-09-24), low on the right where a
   * thumb reaches it. It stands right above the card in the same column — never under
   * it — and alone above the dock when there is no card; while a selection keeps the
   * screen, its panel has the foot and the corner gives way (H5).
   */
  corner?: ReactNode;
}

/**
 * THE CONTEXT SLOT. Spec B3 (docs/ui-v2/gozlemevi.md); on the game kit since G1-d
 * (2026-11-14).
 *
 * One card at the foot of the galaxy, never two: the nearest attack coming for
 * you, else the galaxy event, else one suggestion (`contextSlot` decides). Each
 * card wears the mark of what it is in a ring that drains as its time runs out —
 * an attack its beating siren over the flight the galaxy saw leave, an event its
 * own mark over its window, a suggestion its kind. A card closed is remembered by
 * what it was about, so it stays closed while a new attack, event or suggestion
 * still arrives. Each event is closed on its own, so one leaving the card never
 * brings back another the player already closed.
 *
 * A SELECTION KEEPS ITS SCREEN. When the player has picked something the disc's
 * own panel draws it, and an attack does not tear it away: it waits as a red chip
 * with its count at the top, and pressing the chip is the player choosing to look.
 *
 * It replaced `SituationGuide` (the suggestion) and the `ActiveGalaxyEvent` chip
 * (the event) in F2.
 */
export function ContextSlot({
  now,
  selected,
  threats,
  contacts,
  events,
  suggestion,
  onPrepare,
  onLook,
  onShowEvent,
  onAct,
  onClearSelection,
  dismissed,
  onDismiss,
  corner,
}: ContextSlotProps) {
  const { t } = useTranslation();
  const [lookingAtThreat, setLookingAtThreat] = useState(false);

  // A new selection is the player's context again: the chip goes back to being a chip.
  useEffect(() => {
    if (selected) setLookingAtThreat(false);
  }, [selected]);

  const nearest = [...threats].sort((a, b) => a.arriveAt.getTime() - b.arriveAt.getTime())[0] ?? null;
  const open = events.filter((event) => !dismissed.has(slotKey('event', event.id)));
  const slot = contextSlot({
    threatId: nearest ? threatKeyOf(nearest) : null,
    threats: threats.length,
    selected,
    eventId: open.length > 0 ? open.map((event) => event.id).join('+') : null,
    suggestionId: suggestion?.id ?? null,
    dismissed,
    lookingAtThreat,
  });

  /** The foot of the galaxy: the corner over the card, one column, above the dock. */
  const foot = (content: ReactNode) => (
    <div
      data-slot-foot
      className="pointer-events-none absolute inset-x-[var(--gk-gutter)] bottom-[calc(var(--v2-dock-h,0px)+0.5rem)] z-20 flex flex-col gap-2 v2-split:left-auto v2-split:w-80"
    >
      {corner !== undefined && <div className="flex justify-end">{corner}</div>}
      {content}
    </div>
  );

  if (slot.card === 'selected' || slot.card === null) {
    const lone = slot.card === null && corner !== undefined ? foot(null) : null;
    if (slot.threatPill === 0) return lone;
    return (
      <>
        {lone}
        {/* The top-left corner, under the status and Now lines that float over the galaxy, as the corners start. */}
        <div className="pointer-events-none absolute left-[var(--gk-gutter)] top-[calc(var(--v2-float-h,0px)+0.25rem)] z-20 [&_button]:pointer-events-auto">
          <StatusChip
            // The siren is an attack coming for you everywhere it is drawn (the Now line, the card).
            glyph="siren"
            tone="hostile"
            label={t('slot.pill', { count: slot.threatPill })}
            value={String(slot.threatPill)}
            onPress={() => {
              setLookingAtThreat(true);
              onClearSelection();
            }}
          />
        </div>
      </>
    );
  }

  let card: ReactNode = null;
  if (slot.card === 'threat' && nearest) {
    const contact = contactFor(nearest, contacts);
    const read = incomingCopy(nearest);
    const prepare = read?.prepare !== false;
    card = (
      <ContextCard
        // Each card is keyed by what it is about: a new attack rises in, it does not repaint the old card.
        key={slotKey('threat', threatKeyOf(nearest))}
        tone="hostile"
        glyph="siren"
        eyebrow={read?.eyebrow ?? t('slot.incoming')}
        title={flightTitle(nearest)}
        timer={{
          remaining: nearest.arriveAt.getTime() - now,
          // The whole is the flight the galaxy saw leave; an attack not seen leaving has none.
          total: contact ? contact.endAt.getTime() - contact.startAt.getTime() : 0,
          text: t('slot.lands', { time: countdown(nearest.arriveAt.getTime() - now) }),
        }}
        {...(prepare ? {
          actions: <GameButton tone="danger" size="sm" glyph="shield" onPress={() => { onPrepare(nearest); }}>{t('slot.prepare')}</GameButton>,
        } : {})}
        /*
          An attack in sight can be looked at: a round eye beside the close. Two buttons side by
          side fitted one row only in Japanese and made the card a third of the galaxy (G1-d).
        */
        {...(contact === undefined ? {} : {
          tools: <RoundButton small glyph="eye" label={t('slot.look')} onPress={() => { onLook(contact.id); }} />,
        })}
        dismissLabel={t('slot.dismiss')}
        onDismiss={() => {
          onDismiss([slotKey('threat', threatKeyOf(nearest))]);
          setLookingAtThreat(false);
        }}
      >
        {read?.detail ?? incomingDetail(nearest, contact)}
      </ContextCard>
    );
  } else if (slot.card === 'event' && open.length > 0) {
    const several = open.length > 1;
    const [first] = open;
    card = (
      <ContextCard
        key={slotKey('event', open.map((event) => event.id).join('+'))}
        tone="self"
        // One event wears its own mark and drains over its window; several share the star.
        glyph={several || !first ? 'star' : EVENT_GLYPH[first.kind]}
        eyebrow={t('slot.event')}
        // One event is named by the title; several are named on their own rows (seen in the game: both, twice).
        {...(several || !first ? {} : {
          title: t(EVENT_NAME[first.kind]),
          // Its body already says the time left: the ring alone, no words twice.
          timer: { remaining: first.endsAt.getTime() - now, total: first.endsAt.getTime() - first.startsAt.getTime() },
        })}
        dismissLabel={t('slot.dismiss')}
        onDismiss={() => { onDismiss(open.map((event) => slotKey('event', event.id))); }}
      >
        <ul>
          {open.map((event) => (
            <li key={event.id} className="gk-crow">
              <span className="grid min-w-0 gap-0.5">
                {several && <span className="gk-crow__name">{t(EVENT_NAME[event.kind])}</span>}
                <span><EventDetail event={event} now={now} /></span>
              </span>
              {event.kind !== 'ASTEROID_SHOWER' && (
                <GameButton tone="self" size="sm" glyph="eye" onPress={() => { onShowEvent(event); }}>{t('slot.show')}</GameButton>
              )}
            </li>
          ))}
        </ul>
      </ContextCard>
    );
  } else if (slot.card === 'suggestion' && suggestion) {
    return foot(
      <Suggestion
        key={slotKey('suggestion', suggestion.id)}
        directive={suggestion}
        onAct={onAct}
        onDismiss={() => { onDismiss([slotKey('suggestion', suggestion.id)]); }}
      />,
    );
  }

  if (card === null) return corner === undefined ? null : foot(null);
  return foot(<div className="pointer-events-auto">{card}</div>);
}
