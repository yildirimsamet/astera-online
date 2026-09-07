import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SituationGuide } from '../src/ui/SituationGuide.js';
import { planetView } from './fixtures.js';
import type { Directive, Situation } from '../src/lib/directives.js';

const situation = (): Situation => ({
  planet: planetView({ instruments: {}, ground: {}, fleet: {} }, { alloy: 0, crystal: 0 }),
  galaxy: undefined,
  intel: undefined,
  pending: [],
  held: { alloy: 0, crystal: 0, deuterium: 0 },
});

describe('the visible next action', () => {
  it('counts an inbound arrival down without waiting for a new server payload', () => {
    const now = Date.now();
    const s = { ...situation(), pending: [{
      kind: 'incoming' as const, targetName: 'Home', minutesRemaining: 8,
      arriveAt: new Date(now + 120_000),
    }] };
    const view = render(<SituationGuide situation={s} now={now} onAct={vi.fn()} />);
    const act = () => view.container.querySelector('[data-directive-act]')!;
    expect(act().textContent).toContain('2m');
    view.rerender(<SituationGuide situation={s} now={now + 60_000} onAct={vi.fn()} />);
    expect(act().textContent).toContain('1m');
  });
  it('does not compete with a focused world rail in the galaxy host', () => {
    // As in trade-wiring.test: this regression is a missing host condition,
    // not behavior inside the standalone card.
    const source = readFileSync('src/screens/GalaxyView.tsx', 'utf8');
    expect(source.includes('showGuidance && !showPlanetFocus')).toBe(true);
  });

  it('offers exactly one action and opens the section that fixes the gap', async () => {
    const onAct = vi.fn<(directive: Directive) => void>();
    const view = render(<SituationGuide situation={situation()} onAct={onAct} />);
    // ONE ACTION, not one button: the card also carries its fold, which acts on
    // nothing. The claim this test makes is about the advice, not the chrome.
    expect(view.container.querySelectorAll('[data-directive-act]')).toHaveLength(1);
    await userEvent.click(view.container.querySelector('[data-directive-act]')!);
    expect(onAct.mock.calls[0]?.[0].id).toBe('no-telescope');
    expect(onAct.mock.calls[0]?.[0].action).toMatchObject({ screen: 'planet', group: 'orbit' });
  });

  it('replaces growth advice with the inbound warning when state changes', async () => {
    const onAct = vi.fn();
    const initial = situation();
    const view = render(<SituationGuide situation={initial} onAct={onAct} />);
    view.rerender(<SituationGuide situation={{ ...initial, pending: [{
      kind: 'incoming', targetName: 'Home', minutesRemaining: 2,
      arriveAt: new Date(Date.now() + 120_000),
    }] }} onAct={onAct} />);
    expect(view.container.querySelectorAll('[data-directive-act]')).toHaveLength(1);
    await userEvent.click(view.container.querySelector('[data-directive-act]')!);
    expect(onAct).toHaveBeenCalledWith(expect.objectContaining({ id: 'inbound' }));
  });

  it('leaves a defended, seeing world with all bays busy quiet', () => {
    const s = situation();
    const { container } = render(<SituationGuide situation={{ ...s, planet: {
      ...s.planet, instruments: { TELESCOPE: 1, RADAR: 3 },
      buildings: { CORE: 3, REFINERY: 1, EXTRACTOR: 1 },
      ground: { THORN: 1 }, flight: { used: 3, total: 3 },
    } }} onAct={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * WHO THE COACHING IS FOR, AND HOW BIG IT IS ALLOWED TO BE.
 *
 * Two owner instructions against the same card, and they are separate rules.
 *
 * WHO. *"bunlar sadece yeni oyuncularda bir kez gösterilmeli. Şuanda aktif
 * oynayan userlarda gözükmemeli."* The guide is the written half of onboarding,
 * so it belongs to the same population onboarding does — and a commander who has
 * been playing for a week does not need to be told what a Telescope is. The
 * signal is the server's, not the device's: `academyStep` is stamped on a world
 * that was claimed through the Academy and is null on every world that existed
 * before it. A device-local flag was the cheaper answer and it is the wrong one —
 * it would put the card back in front of an established commander the first time
 * they opened the game on a new phone.
 *
 * HOW BIG. *"kullanıcı sürekli ekranda kocaman bunu görmek istemez."* Even a new
 * commander is looking at the galaxy, not at the advice, so the card folds to one
 * line and stays folded — per device, like every other fold in the client.
 */
describe('who sees the coaching, and at what size', () => {
  const newcomer = (): Situation => ({ ...situation(), planet: {
    ...situation().planet, academyStep: 3,
  } });
  const veteran = (): Situation => ({ ...situation(), planet: {
    ...situation().planet, academyStep: null,
  } });

  it('says nothing at all to a commander who never came through the Academy', () => {
    const view = render(<SituationGuide situation={veteran()} onAct={vi.fn()} />);
    expect(view.container.firstChild).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('still coaches a commander who did', () => {
    render(<SituationGuide situation={newcomer()} onAct={vi.fn()} />);
    expect(screen.getByRole('button', { name: /telescope/i })).toBeTruthy();
  });

  it('folds to a single line and remembers it, without acting on the press', async () => {
    localStorage.clear();
    const onAct = vi.fn<(directive: Directive) => void>();
    const first = render(<SituationGuide situation={newcomer()} onAct={onAct} />);

    const fold = screen.getByRole('button', { name: /hide|gizle|küçült|collapse/i });
    await userEvent.click(fold);
    // Folding is not acting: the card must not navigate on its way to being small.
    expect(onAct).not.toHaveBeenCalled();
    expect(first.container.querySelector('[data-directive-detail]')).toBeNull();

    // And a fresh mount comes back folded, because a fold is a preference.
    first.unmount();
    const again = render(<SituationGuide situation={newcomer()} onAct={vi.fn()} />);
    expect(again.container.querySelector('[data-directive-detail]')).toBeNull();
  });
});
