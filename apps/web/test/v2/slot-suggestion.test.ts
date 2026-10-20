import { describe, expect, it } from 'vitest';
import type { Situation } from '../../src/lib/directives.js';
import { slotSuggestion } from '../../src/lib/contextSlot.js';
import { planetView } from '../fixtures.js';

/**
 * THE SUGGESTION CARD'S ADVICE — the rules `SituationGuide` kept, carried into
 * the v2 context slot (B3).
 *
 * WHO: *"bunlar sadece yeni oyuncularda bir kez gösterilmeli. Şuanda aktif oynayan
 * userlarda gözükmemeli."* The server's `academyStep` says who came through the
 * Academy; an established world carries null and is not coached.
 */

const situation = (academyStep: number | null = 3): Situation => ({
  planet: { ...planetView({ instruments: {}, ground: {}, fleet: {} }, { alloy: 0, crystal: 0 }), academyStep },
  galaxy: undefined,
  intel: undefined,
  pending: [],
  held: { alloy: 0, crystal: 0, deuterium: 0 },
});

describe('the suggestion', () => {
  it('says nothing to a commander who never came through the Academy', () => {
    expect(slotSuggestion(situation(null), Date.now())).toBeNull();
  });

  /* Owner, 2026-10-20: a new commander's quiet world gets no weakness or idle card. */
  it('has nothing to say to a new commander with no threat or opportunity', () => {
    expect(slotSuggestion(situation(), Date.now())).toBeNull();
  });

  /** Spec H1: the host's clock reaches the engine, so a shielded world is not told it is in danger. */
  it('reads the attack shield against the host clock', () => {
    const now = Date.parse('2026-09-23T12:00:00Z');
    const s: Situation = { ...situation(), held: { alloy: 4000, crystal: 400, deuterium: 0 }, shieldUntil: new Date(now + 90 * 60_000) };
    expect(slotSuggestion(s, now)).toBeNull();
    expect(slotSuggestion(s, now + 90 * 60_000)?.kind).toBe('threat');
  });

  /**
   * A CLOSED SUGGESTION MAKES WAY FOR THE NEXT (owner, 2026-09-25): closing one is "never
   * that one again", not "no advice at all" — the next gap the world has is offered instead.
   */
  it('passes over a suggestion the player closed and offers the next', () => {
    const now = Date.now();
    // Undefended and over-stocked, with no shield: two threats to offer in turn.
    const exposed: Situation = { ...situation(), held: { alloy: 4000, crystal: 400, deuterium: 0 } };
    const first = slotSuggestion(exposed, now);
    expect(first).not.toBeNull();
    const next = slotSuggestion(exposed, now, new Set([`suggestion:${first!.id}`]));
    expect(next).not.toBeNull();
    expect(next?.id).not.toBe(first?.id);
  });

  it('leaves the incoming attack to the threat card', () => {
    const now = Date.now();
    const s: Situation = { ...situation(), pending: [{
      kind: 'incoming', targetName: 'Home', minutesRemaining: 2, arriveAt: new Date(now + 120_000),
    }] };
    expect(slotSuggestion(s, now)?.id).not.toBe('inbound');
  });
});
