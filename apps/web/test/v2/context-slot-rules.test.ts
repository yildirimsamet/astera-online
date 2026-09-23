import { describe, expect, it } from 'vitest';
import type { Directive } from '../../src/lib/directives.js';
import { contextSlot, slotKey, suggestionOf, type SlotInput } from '../../src/lib/contextSlot.js';

/**
 * ONE CARD ON THE SCREEN, NEVER TWO. Spec B3 (docs/ui-v2/gozlemevi.md).
 *
 * A threat to you · the thing you selected · an active galaxy event · a
 * suggestion. What you selected is never torn away by a threat: the card stays,
 * and a red "1 threat" pill on it takes you there when you choose. Closing a card
 * falls to the next one down.
 */

const input = (over: Partial<SlotInput> = {}): SlotInput => ({
  threatId: null,
  threats: 0,
  selected: false,
  eventId: null,
  suggestionId: null,
  dismissed: new Set(),
  lookingAtThreat: false,
  ...over,
});

const everything = { threatId: 't1', threats: 1, eventId: 'e1', suggestionId: 'idle' };

describe('the context slot', () => {
  it('shows nothing when there is nothing to show', () => {
    expect(contextSlot(input())).toEqual({ card: null, threatPill: 0 });
  });

  it('ranks a threat, then an event, then a suggestion', () => {
    expect(contextSlot(input(everything)).card).toBe('threat');
    expect(contextSlot(input({ ...everything, threatId: null, threats: 0 })).card).toBe('event');
    expect(contextSlot(input({ suggestionId: 'idle' })).card).toBe('suggestion');
  });

  it('keeps what you selected in front of a threat, with the threat as a pill', () => {
    expect(contextSlot(input({ ...everything, threats: 2, selected: true }))).toEqual({ card: 'selected', threatPill: 2 });
  });

  it('goes to the threat when the pill is pressed, and shows no pill there', () => {
    expect(contextSlot(input({ ...everything, selected: true, lookingAtThreat: true })))
      .toEqual({ card: 'threat', threatPill: 0 });
  });

  it('falls to the next card each time one is closed', () => {
    const dismissed = new Set<string>();
    const order: (string | null)[] = [];
    for (let step = 0; step < 4; step += 1) {
      const { card } = contextSlot(input({ ...everything, dismissed }));
      order.push(card);
      if (card === 'threat') dismissed.add(slotKey('threat', 't1'));
      if (card === 'event') dismissed.add(slotKey('event', 'e1'));
      if (card === 'suggestion') dismissed.add(slotKey('suggestion', 'idle'));
    }
    expect(order).toEqual(['threat', 'event', 'suggestion', null]);
  });

  it('brings back a new threat after an old one was closed', () => {
    const dismissed = new Set([slotKey('threat', 't1')]);
    expect(contextSlot(input({ threatId: 't2', threats: 1, dismissed })).card).toBe('threat');
  });
});

describe('the suggestion', () => {
  const directive = (id: string): Directive => ({
    id,
    kind: id === 'inbound' ? 'threat' : 'growth',
    title: id,
    detail: '',
    action: { label: '', screen: 'planet' },
    weight: 1,
  });

  it('is the first directive that is not the incoming attack the threat card already carries', () => {
    expect(suggestionOf([directive('inbound'), directive('undefended'), directive('idle')])?.id).toBe('undefended');
    expect(suggestionOf([directive('inbound')])).toBeNull();
    expect(suggestionOf([])).toBeNull();
  });
});
