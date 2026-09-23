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

  it('coaches one who did, with the section that fixes the gap', () => {
    const next = slotSuggestion(situation(), Date.now());
    expect(next?.id).toBe('no-telescope');
    expect(next?.action).toMatchObject({ screen: 'planet', group: 'orbit' });
  });

  /** Spec H1: the host's clock reaches the engine, so a shielded world is not told it is in danger. */
  it('reads the attack shield against the host clock', () => {
    const now = Date.parse('2026-09-23T12:00:00Z');
    const s: Situation = { ...situation(), held: { alloy: 4000, crystal: 400, deuterium: 0 }, shieldUntil: new Date(now + 90 * 60_000) };
    expect(slotSuggestion(s, now)?.title).toContain('Your shield ends in 1h 30m');
    expect(slotSuggestion(s, now)?.kind).not.toBe('threat');
    expect(slotSuggestion(s, now + 90 * 60_000)?.kind).toBe('threat');
  });

  it('leaves the incoming attack to the threat card', () => {
    const now = Date.now();
    const s: Situation = { ...situation(), pending: [{
      kind: 'incoming', targetName: 'Home', minutesRemaining: 2, arriveAt: new Date(now + 120_000),
    }] };
    expect(slotSuggestion(s, now)?.id).not.toBe('inbound');
  });
});
