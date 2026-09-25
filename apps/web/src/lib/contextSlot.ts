import type { ActiveGalaxyEvent, PendingThread } from '../api/schemas.js';
import { directives, type Directive, type Situation } from './directives.js';
import { minutesLeft } from './time.js';

/**
 * An incoming attack, named by where and when it lands. An inbound thread carries
 * no mission id (the attacker's is not the defender's to know), and its place in
 * a list moves as others land — so a dismissed card is remembered by its target
 * and its instant, and a new attack is a new key.
 */
export const threatKeyOf = (thread: PendingThread): string =>
  `${thread.targetPlanetId ?? thread.targetName}@${String(thread.arriveAt.getTime())}`;

export type SlotCard = 'threat' | 'selected' | 'event' | 'suggestion';

/** The key a closed card is remembered by: the card and the thing it was about. */
export const slotKey = (card: Exclude<SlotCard, 'selected'>, id: string): string => `${card}:${id}`;

export interface SlotInput {
  /** The nearest incoming attack, by its thread key; null when nothing is coming. */
  threatId: string | null;
  /** How many attacks are coming, for the pill. */
  threats: number;
  /** Something on the disc is selected. */
  selected: boolean;
  /** The active galaxy event, by id. */
  eventId: string | null;
  /** The suggestion to show (`suggestionOf`), by directive id. */
  suggestionId: string | null;
  /** Cards the player closed, by `slotKey`. */
  dismissed: ReadonlySet<string>;
  /** The player pressed the threat pill on a selection. */
  lookingAtThreat: boolean;
}

export interface Slot {
  card: SlotCard | null;
  /** Attacks waiting behind the card, shown as a red pill on it; 0 for none. */
  threatPill: number;
}

/**
 * ONE CARD ON THE SCREEN, NEVER TWO. Spec B3.
 *
 * A threat · what you selected · the galaxy event · a suggestion. A threat never
 * takes the slot from a selection — the player's context is not torn away — it
 * rides the selection as a pill until they choose to look. A closed card is
 * remembered by what it was about, so the same card does not come straight back
 * while a new threat, event or suggestion still does.
 */
export function contextSlot(input: SlotInput): Slot {
  const open = (card: Exclude<SlotCard, 'selected'>, id: string | null): id is string =>
    id !== null && !input.dismissed.has(slotKey(card, id));

  if (input.selected) {
    if (input.lookingAtThreat && input.threatId !== null) return { card: 'threat', threatPill: 0 };
    return { card: 'selected', threatPill: input.threatId === null ? 0 : input.threats };
  }
  if (open('threat', input.threatId)) return { card: 'threat', threatPill: 0 };
  if (open('event', input.eventId)) return { card: 'event', threatPill: 0 };
  if (open('suggestion', input.suggestionId)) return { card: 'suggestion', threatPill: 0 };
  return { card: null, threatPill: 0 };
}

/**
 * The suggestion card: the first directive that is not the incoming attack, which the
 * threat card already carries in full, and not one the player closed — closing a
 * suggestion is "never that one again", so the next gap the world has takes its place.
 */
export const suggestionOf = (list: readonly Directive[], dismissed: ReadonlySet<string> = new Set()): Directive | null =>
  list.find((directive) => directive.id !== 'inbound' && !dismissed.has(slotKey('suggestion', directive.id))) ?? null;

/**
 * THE ADVICE THE SLOT MAY OFFER, AND TO WHOM — the rules `SituationGuide` kept.
 *
 * Only a commander who came through the Academy is coached (owner instruction:
 * the guide is the written half of onboarding; `academyStep` is the server's word
 * for it). The host's clock reaches the engine twice: the shield is read against
 * it (H1), and every flight's minutes are recomputed from its absolute landing,
 * so a cached `minutesRemaining` never freezes a warning.
 */
export function slotSuggestion(
  situation: Situation,
  now: number,
  /** The cards the player closed, by `slotKey`. */
  dismissed: ReadonlySet<string> = new Set(),
): Directive | null {
  if (situation.planet.academyStep == null) return null;
  return suggestionOf(directives({
    ...situation,
    now,
    pending: situation.pending.map((thread) => ({ ...thread, minutesRemaining: minutesLeft(thread.arriveAt, now) })),
  }), dismissed);
}

/**
 * The galaxy events running at `now`: from their start up to, not including, their
 * end — the half-open window the old event chip kept, so a card never outlives its
 * event by the second the server already considers it over.
 */
export const activeEvents = (events: readonly ActiveGalaxyEvent[], now: number): ActiveGalaxyEvent[] =>
  events.filter((event) => event.startsAt.getTime() <= now && now < event.endsAt.getTime());
