import type { Directive } from './directives.js';

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
 * The suggestion card: the first directive that is not the incoming attack,
 * which the threat card already carries in full.
 */
export const suggestionOf = (list: readonly Directive[]): Directive | null =>
  list.find((directive) => directive.id !== 'inbound') ?? null;
