import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActiveGalaxyEvent, Contact, PendingThread } from '../../api/schemas.js';
import { contextSlot, slotKey, threatKeyOf } from '../../lib/contextSlot.js';
import type { Directive, DirectiveKind } from '../../lib/directives.js';
import { compact } from '../../lib/format.js';
import { useAccordion } from '../../lib/accordion.js';
import { contactFor, flightTitle, incomingDetail } from '../../lib/flights.js';
import { countdown } from '../../lib/time.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { Icon } from '../icons.js';

type Tone = 'hostile' | 'self' | 'warn' | 'neutral';

const ACCENT: Record<Tone, { bar: string; eyebrow: string; action: string }> = {
  hostile: { bar: 'bg-v2-hostile', eyebrow: 'text-v2-hostile', action: 'border-v2-hostile/60 bg-v2-hostile/15' },
  self: { bar: 'bg-v2-self', eyebrow: 'text-v2-self', action: 'border-v2-self/60 bg-v2-self/15' },
  warn: { bar: 'bg-v2-warn', eyebrow: 'text-v2-warn', action: 'border-v2-warn/60 bg-v2-warn/10' },
  neutral: { bar: 'bg-v2-line-hi', eyebrow: 'text-v2-ink-3', action: 'border-v2-line-hi bg-v2-raise' },
};

/** A suggestion wears what it is: red only for something happening to you, warn for a gap. */
const SUGGESTION_TONE: Record<DirectiveKind, Tone> = {
  threat: 'hostile',
  opportunity: 'self',
  growth: 'warn',
  idle: 'neutral',
};

const SUGGESTION_LABEL = {
  threat: 'directives.kindThreat',
  opportunity: 'directives.kindOpportunity',
  growth: 'directives.kindGrowth',
  idle: 'directives.kindIdle',
} as const satisfies Record<DirectiveKind, string>;

const EVENT_NAME = {
  TRADE_SHIP: 'trade.chip',
  INTERGALACTIC_CONVOY: 'galaxy.intergalacticConvoy',
  ASTEROID_SHOWER: 'galaxy.asteroidShower',
} as const satisfies Record<ActiveGalaxyEvent['kind'], string>;

interface Action {
  label: string;
  onPress: () => void;
}

/** One card: an accent in the colour of what it is, a line of what, a clause of why, and what to do. */
function Card({
  tone,
  eyebrow,
  title,
  detail,
  timer,
  actions,
  onDismiss,
  onFold,
}: {
  tone: Tone;
  eyebrow: string;
  title: string;
  detail: ReactNode;
  timer?: string;
  actions: readonly Action[];
  onDismiss: () => void;
  /** Fold the card to one line (the suggestion's size preference). */
  onFold?: () => void;
}) {
  const { t } = useTranslation();
  const accent = ACCENT[tone];
  return (
    <section
      aria-label={eyebrow}
      data-tone={tone}
      className="pointer-events-auto relative mx-auto w-full max-w-xl overflow-hidden rounded-control border border-v2-line bg-v2-panel/95 font-v2-ui"
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-0.5 ${accent.bar}`} />
      <div className="flex flex-col gap-1 py-2.5 pl-3.5 pr-2">
        <div className="flex items-center gap-2">
          <p className={`min-w-0 flex-1 truncate text-micro font-semibold uppercase tracking-wide ${accent.eyebrow}`}>{eyebrow}</p>
          {timer && <span className="shrink-0 font-v2-mono text-caption text-v2-ink">{timer}</span>}
          {onFold && (
            <button
              type="button"
              aria-label={t('directives.hide')}
              onClick={onFold}
              className="grid size-7 shrink-0 place-items-center rounded-control text-v2-ink-3"
            >
              <Icon id="i-chev" className="size-3.5 rotate-90" />
            </button>
          )}
          <button
            type="button"
            aria-label={t('slot.dismiss')}
            onClick={onDismiss}
            className="grid size-7 shrink-0 place-items-center rounded-control text-v2-ink-3"
          >
            <Icon id="i-close" className="size-3.5" />
          </button>
        </div>
        {title && <p className="pr-2 text-body font-semibold leading-snug text-v2-ink">{title}</p>}
        <div className="pr-2 text-caption leading-snug text-v2-ink-2">{detail}</div>
        {actions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onPress}
                className={`rounded-control border px-3 py-1.5 text-caption font-semibold text-v2-ink ${
                  index === 0 ? accent.action : 'border-v2-line bg-transparent'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** What an event is doing right now, in its own terms. */
function EventDetail({ event, now }: { event: ActiveGalaxyEvent; now: number }) {
  const { t } = useTranslation();
  const remaining = countdown(event.endsAt.getTime() - now);
  switch (event.kind) {
    case 'TRADE_SHIP':
      return (
        <span className="flex flex-wrap items-center gap-1 font-v2-mono">
          {(['alloy', 'crystal', 'deuterium'] as const).map((good, index) => (
            <span key={good} className="flex items-center gap-0.5">
              {index > 0 && <span aria-hidden="true" className="text-v2-ink-3">=</span>}
              <img src={RESOURCE_ART[good]} alt={t(`trade.${good}`)} className="size-3.5 object-contain" />
              {compact(event.rate.deuterium / event.rate[good])}
            </span>
          ))}
          <span className="ml-1 text-v2-ink-3">{t('trade.chipRemaining', { remaining })}</span>
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
  const eyebrow = t(SUGGESTION_LABEL[directive.kind]);

  if (!guide.isOpen('directive')) {
    return (
      <button
        type="button"
        aria-label={t('directives.show')}
        onClick={() => { guide.toggle('directive'); }}
        className="pointer-events-auto mx-auto flex h-9 w-full max-w-xl items-center gap-2 rounded-control border border-v2-line bg-v2-panel/95 px-3 text-left font-v2-ui"
      >
        <span className={`shrink-0 text-micro font-semibold uppercase tracking-wide ${ACCENT[tone].eyebrow}`}>{eyebrow}</span>
        <span className="min-w-0 flex-1 truncate text-caption text-v2-ink-2">{directive.title}</span>
        <Icon id="i-chev" className="size-3.5 shrink-0 -rotate-90 text-v2-ink-3" />
      </button>
    );
  }

  return (
    <Card
      tone={tone}
      eyebrow={eyebrow}
      title={directive.title}
      detail={directive.detail}
      actions={[{ label: directive.action.label, onPress: () => { onAct(directive); } }]}
      onDismiss={onDismiss}
      onFold={() => { guide.toggle('directive'); }}
    />
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
}

/**
 * THE CONTEXT SLOT. Spec B3 (docs/ui-v2/gozlemevi.md).
 *
 * One card at the foot of the galaxy, never two: the nearest attack coming for
 * you, else the galaxy event, else one suggestion (`contextSlot` decides). A card
 * closed is remembered by what it was about, so it stays closed while a new
 * attack, event or suggestion still arrives.
 *
 * A SELECTION KEEPS ITS SCREEN. When the player has picked something the disc's
 * own panel draws it, and an attack does not tear it away: it waits as a red pill
 * at the top, and pressing the pill is the player choosing to look.
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
}: ContextSlotProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [lookingAtThreat, setLookingAtThreat] = useState(false);

  // A new selection is the player's context again: the pill goes back to being a pill.
  useEffect(() => {
    if (selected) setLookingAtThreat(false);
  }, [selected]);

  const nearest = [...threats].sort((a, b) => a.arriveAt.getTime() - b.arriveAt.getTime())[0] ?? null;
  const slot = contextSlot({
    threatId: nearest ? threatKeyOf(nearest) : null,
    threats: threats.length,
    selected,
    // The set is the key: a card closed over one set of events comes back for a new one.
    eventId: events.length > 0 ? events.map((event) => event.id).join('+') : null,
    suggestionId: suggestion?.id ?? null,
    dismissed,
    lookingAtThreat,
  });
  const dismiss = (key: string): void => {
    setDismissed((current) => new Set([...current, key]));
  };

  if (slot.card === 'selected' || slot.card === null) {
    if (slot.threatPill === 0) return null;
    return (
      <div className="pointer-events-none absolute left-2 top-2 z-20">
        <button
          type="button"
          aria-label={t('slot.pill', { count: slot.threatPill })}
          onClick={() => {
            setLookingAtThreat(true);
            onClearSelection();
          }}
          className="pointer-events-auto flex h-7 items-center gap-1 rounded-full border border-v2-hostile/60 bg-v2-hostile/20 px-2.5 font-v2-mono text-caption font-semibold text-v2-ink"
        >
          <Icon id="i-attack" className="size-3.5 text-v2-hostile" />
          {slot.threatPill}
        </button>
      </div>
    );
  }

  let card: ReactNode = null;
  if (slot.card === 'threat' && nearest) {
    const contact = contactFor(nearest, contacts);
    card = (
      <Card
        tone="hostile"
        eyebrow={t('slot.incoming')}
        title={flightTitle(nearest)}
        detail={incomingDetail(nearest, contact)}
        timer={t('slot.lands', { time: countdown(nearest.arriveAt.getTime() - now) })}
        actions={[
          { label: t('slot.prepare'), onPress: () => { onPrepare(nearest); } },
          ...(contact ? [{ label: t('slot.look'), onPress: () => { onLook(contact.id); } }] : []),
        ]}
        onDismiss={() => {
          dismiss(slotKey('threat', threatKeyOf(nearest)));
          setLookingAtThreat(false);
        }}
      />
    );
  } else if (slot.card === 'event' && events.length > 0) {
    const eventKey = events.map((event) => event.id).join('+');
    const several = events.length > 1;
    const [first] = events;
    card = (
      <Card
        tone="self"
        eyebrow={t('slot.event')}
        // One event is named by the title; several are named on their own rows (seen in the game: both, twice).
        title={several || !first ? '' : t(EVENT_NAME[first.kind])}
        detail={(
          <ul className="flex flex-col gap-1.5">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  {several && <span className="mr-1 font-semibold text-v2-ink">{t(EVENT_NAME[event.kind])}</span>}
                  <EventDetail event={event} now={now} />
                </span>
                {event.kind !== 'ASTEROID_SHOWER' && (
                  <button
                    type="button"
                    onClick={() => { onShowEvent(event); }}
                    className="shrink-0 rounded-control border border-v2-self/60 bg-v2-self/15 px-2.5 py-1 text-caption font-semibold text-v2-ink"
                  >
                    {t('slot.show')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        actions={[]}
        onDismiss={() => { dismiss(slotKey('event', eventKey)); }}
      />
    );
  } else if (slot.card === 'suggestion' && suggestion) {
    card = (
      <Suggestion
        directive={suggestion}
        onAct={onAct}
        onDismiss={() => { dismiss(slotKey('suggestion', suggestion.id)); }}
      />
    );
  }

  return card === null ? null : <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20">{card}</div>;
}
