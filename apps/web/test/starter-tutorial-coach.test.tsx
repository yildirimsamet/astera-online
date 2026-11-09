import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TutorialAnswer } from '../src/starter/tutorial/script.js';
import { StarterTutorialCoach } from '../src/starter/tutorial/StarterTutorialCoach.js';
import { CARD_AFTER_REVEAL_MS } from '../src/starter/tutorial/sightLesson.js';
import { setRockReach } from '../src/starter/tutorial/rockReach.js';
import { ToastProvider, useToast } from '../src/ui/Toast.js';
import { clockTime } from '../src/lib/time.js';

vi.mock('../src/onboarding/flightSchool/SchoolPointer.js', () => ({ SchoolPointer: () => <span data-testid="pointer" /> }));
const observe = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ observe }));
const sound = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/sound.js', () => ({ playSound: sound }));

afterEach(() => { cleanup(); vi.useRealTimers(); observe.mockClear(); localStorage.clear(); });

const coach = (answer: TutorialAnswer, ack = vi.fn(), wait?: { until: Date; spanMs: number }) => {
  const pressed = vi.fn();
  const elsewhere = vi.fn();
  const ordered = vi.fn();
  const view = render(<>
    <button type="button" data-guide="works" onClick={pressed}>works</button>
    <button type="button" onClick={elsewhere}>elsewhere</button>
    <button type="button" data-guide="repair-order" onClick={ordered}>repair</button>
    <StarterTutorialCoach tutorial={{ answer, ack, backIn: 50, ...(wait ? { wait } : {}) }} />
  </>);
  return { ack, pressed, elsewhere, ordered, view };
};

/** Owner 2026-11-06: the FlightSchool NPC on the real ship, strict, and no way to skip it. */
describe('the starter tutorial on screen', () => {
  it('speaks a line and moves on only when Next is pressed', () => {
    const { ack } = coach({ kind: 'step', id: 'radarRing', step: 'read', marks: [], chapter: 7, strict: false });
    expect(document.querySelector('img[src$="tutorial-npc.png"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(ack).toHaveBeenCalledWith('radarRing');
  });

  /** Plan F3 (N1): the count is the core's own; a first-time moment is not a chapter of a road. */
  it('counts the core in its two chapters, and gives a moment no count', () => {
    const { view } = coach({ kind: 'step', id: 'orderRefinery', step: 'press', marks: [], chapter: 2, strict: true });
    expect(screen.getByText('2/2')).toBeTruthy();
    view.unmount();
    coach({ kind: 'step', id: 'radarRing', step: 'read', marks: [], chapter: 7, strict: false });
    expect(document.querySelector('.school-progress')).toBeNull();
  });

  it('lets only the marked control answer, and takes that press as the step', async () => {
    const { ack, pressed, elsewhere } = coach({ kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1, strict: true });
    expect(screen.getByTestId('pointer')).toBeTruthy();
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('works'));
    expect(pressed).toHaveBeenCalledOnce();
    await vi.waitFor(() => { expect(ack).toHaveBeenCalledWith('collect'); });
  });

  // F6 walk: recording the step moves the guide on, and a mark that belongs to the step (the craft in
  // the sky) leaves with it. Recorded mid-press, it left before its own handler ran and opened nothing.
  it('records a pressed mark only once the press has done its own work', async () => {
    const { ack, pressed } = coach({ kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1, strict: true });
    fireEvent.click(screen.getByText('works'));
    expect(ack).not.toHaveBeenCalled();
    await vi.waitFor(() => { expect(ack).toHaveBeenCalledWith('collect'); });
    expect(pressed.mock.invocationCallOrder[0]).toBeLessThan(ack.mock.invocationCallOrder[0]!);
  });

  it('holds every control while a ten-second repair runs, and says it is working', () => {
    const { elsewhere, pressed } = coach({ kind: 'step', id: 'waitFirst', step: 'wait', marks: [], chapter: 2, strict: true }, vi.fn(), { until: new Date(Date.now() + 10_000), spanMs: 10_000 });
    fireEvent.click(screen.getByText('works'));
    fireEvent.click(screen.getByText('elsewhere'));
    expect(pressed).not.toHaveBeenCalled();
    expect(elsewhere).not.toHaveBeenCalled();
    expect(document.querySelector('.school-working')).not.toBeNull();
  });

  it('says how far the ship is repaired when it hands over', () => {
    render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'farewell', step: 'read', marks: [], chapter: 9, strict: false }, ack: vi.fn(), backIn: 0, repaired: 26 }} />);
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    expect(document.querySelector('[data-school-line]')?.getAttribute('data-school-line')).toMatch(/26/);
  });

  /** Review 2026-11-06: an NPC that waits on a control the screen never drew holds the player forever. */
  it('lets go of the controls when the marked one is nowhere for a few seconds, and records where it stuck', () => {
    vi.useFakeTimers();
    const { elsewhere } = coach({ kind: 'step', id: 'orderRefinery', step: 'press', marks: ['[data-guide="nowhere"]'], chapter: 2, strict: true });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4_500); });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith('blocker_visible', expect.objectContaining({ surface: 'starter_tutorial', subject: 'orderRefinery', code: 'mark_missing' }));
  });

  it('lets go of the controls when a wait runs far past its time', () => {
    vi.useFakeTimers();
    const { elsewhere } = coach({ kind: 'step', id: 'waitFirst', step: 'wait', marks: [], chapter: 2, strict: true }, vi.fn(), { until: new Date(Date.now() + 10_000), spanMs: 10_000 });
    act(() => { vi.advanceTimersByTime(20_000); });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(30_000); });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith('blocker_visible', expect.objectContaining({ subject: 'waitFirst', code: 'wait_long' }));
  });

  /**
   * Owner playtest 2026-11-07: a focus panel hid the "online" card, which stayed in the page, so the gate
   * kept waiting for a press nobody could make and held every other control.
   */
  it('counts a marked control the screen hides as missing', () => {
    vi.useFakeTimers();
    const elsewhere = vi.fn();
    render(<>
      <div className="hidden"><button type="button" data-guide="unlock-dismiss">dismiss</button></div>
      <button type="button" onClick={elsewhere}>elsewhere</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'orderRefinery', step: 'press', marks: ['[data-guide="unlock-dismiss"]'], nav: 'dismissUnlock', chapter: 2, strict: true }, ack: vi.fn(), backIn: 50 }} />
    </>);
    // jsdom lays nothing out: hidden as a browser would report it.
    const hidden = screen.getByText('dismiss');
    hidden.checkVisibility = () => false;
    act(() => { vi.advanceTimersByTime(4_500); });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
  });

  /** Owner playtest 2026-11-07: the report is opened from its row; the Intel tab is only the way back to it. */
  it('takes the press on the row as opening the report, not the press on the way to it', async () => {
    const ack = vi.fn();
    render(<>
      <ul><li data-known="probe"><button type="button">r5ty54ry</button></li></ul>
      <button type="button" data-guide="dock-intel">Intel</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'openReport', step: 'press', marks: ['[data-known="probe"] button', '[data-guide="dock-intel"]'], chapter: 4, strict: false }, ack, backIn: 50 }} />
    </>);
    fireEvent.click(screen.getByText('Intel'));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(ack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('r5ty54ry'));
    await vi.waitFor(() => { expect(ack).toHaveBeenCalledWith('openReport'); });
  });

  /** Owner playtest 2026-11-07: the report's rows sat below the fold and the line spoke of them unseen. */
  it('lights up what a read line talks about', () => {
    render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'report', step: 'read', marks: ['[data-dossier-loot]'], chapter: 4, strict: false }, ack: vi.fn(), backIn: 50 }} />);
    expect(screen.getByTestId('pointer')).toBeTruthy();
  });

  it('pulls a repair thumbnail on the strip into view', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();
    render(<>
      <button type="button" data-guide="repair-show" data-step="REFINERY:2">thumb</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'orderRefinery', step: 'press', marks: ['[data-guide="repair-order"][data-step="REFINERY:2"]', '[data-guide="repair-show"][data-step="REFINERY:2"]'], chapter: 2, strict: true }, ack: vi.fn(), backIn: 0 }} />
    </>);
    act(() => { vi.advanceTimersByTime(600); });
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ inline: 'center' }));
  });

  it('records each visible tutorial step with the starter version and its scene id', () => {
    const answer: TutorialAnswer = { kind: 'step', id: 'orderRefinery', step: 'press', marks: [], chapter: 2, strict: true };
    const { rerender } = render(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 0 }} />);
    rerender(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 1 }} />);
    expect(observe).toHaveBeenCalledWith('training_scene_visible', { trainingVersion: 'starter-tutorial.v2', scene: 'orderRefinery' }, 'live');
    expect(observe.mock.calls.filter(call => call[0] === 'training_scene_visible')).toHaveLength(1);
  });

  it('is silent once the advisor has taken over', () => {
    coach({ kind: 'advise' });
    expect(document.querySelector('[data-school-coach]')).toBeNull();
  });
});

/** Owner playtest 2026-11-06: the galaxy could not be dragged, and a ready crate ignored the hold. */
describe('what the NPC never holds', () => {
  const scene = () => {
    const drag = vi.fn();
    const hold = vi.fn();
    render(<>
      <canvas data-testid="galaxy" onPointerDown={drag} />
      <button type="button" data-guide="crate" onPointerDown={hold}>crate</button>
      <button type="button" data-guide="works">works</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1, strict: true }, ack: vi.fn(), backIn: 50 }} />
    </>);
    return { drag, hold };
  };

  it('lets the scene be dragged and looked around', () => {
    const { drag } = scene();
    fireEvent.pointerDown(screen.getByTestId('galaxy'));
    expect(drag).toHaveBeenCalledOnce();
  });

  it('lets a ready crate be held open', () => {
    const { hold } = scene();
    fireEvent.pointerDown(screen.getByText('crate'));
    expect(hold).toHaveBeenCalledOnce();
  });
});

/**
 * THE WAY IN (owner 2026-11-08, N1): the welcome is spoken over the power card. The drag hint shows
 * first, as it did on the old first look (owner playtest 2026-11-06); it never takes a touch and never
 * holds the step. Once the view is turned, or after a while, the hand goes to the power card.
 */
describe('the welcome over the power card', () => {
  // jsdom has no PointerEvent, so a pointer's position would be lost on the way; browsers carry it.
  beforeAll(() => {
    if (!('PointerEvent' in window)) Object.defineProperty(window, 'PointerEvent', { value: class extends MouseEvent {}, configurable: true });
  });
  const online: Extract<TutorialAnswer, { kind: 'step' }> = { kind: 'step', id: 'online', step: 'press', marks: ['[data-guide="unlock-try"]'], chapter: 1, strict: true };
  const mount = (answer = online) => render(<><canvas data-testid="scene" /><button type="button" data-guide="unlock-try">try</button><StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 50 }} /></>);

  it('shows the drag first, then points at the power card once the view has been turned', () => {
    mount();
    expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
    expect(screen.queryByTestId('pointer')).toBeNull();
    const scene = screen.getByTestId('scene');
    fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
    fireEvent.pointerMove(scene, { clientX: 190, clientY: 310 });
    fireEvent.pointerUp(scene, { clientX: 190, clientY: 310 });
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
    expect(screen.getByTestId('pointer')).toBeTruthy();
  });

  // Owner playtest 2026-11-09: come closer by hand, then the rock can be touched.
  describe('the zoom before the rock', () => {
    const zoom: Extract<TutorialAnswer, { kind: 'step' }> = { kind: 'step', id: 'zoomRock', step: 'gesture', marks: [], chapter: 6, strict: false };
    afterEach(() => { act(() => { setRockReach(null); }); sound.mockClear(); });
    it('shows the pinch, with no hand and no Next to walk past it', () => {
      coach(zoom);
      expect(document.querySelector('[data-pinch-hint]')).not.toBeNull();
      expect(screen.queryByTestId('pointer')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
      expect(screen.queryByRole('button', { name: /^next$/i })).toBeNull();
    });
    it('moves on with a chime when a rock has come within reach', () => {
      const { ack } = coach(zoom);
      expect(ack).not.toHaveBeenCalled();
      act(() => { setRockReach('rock-1'); });
      expect(ack).toHaveBeenCalledWith('zoomRock');
      expect(sound).toHaveBeenCalledWith('confirm');
    });
    it('passes quietly when the view was already close', () => {
      setRockReach('rock-1');
      const { ack } = coach(zoom);
      expect(ack).toHaveBeenCalledWith('zoomRock');
      expect(sound).not.toHaveBeenCalled();
    });
    it('is not reported as a missing mark', () => {
      vi.useFakeTimers();
      coach(zoom);
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(observe.mock.calls.some(([name]) => name === 'blocker_visible')).toBe(false);
      vi.useRealTimers();
    });
    it('hides the pinch while a note is in the way', () => {
      coach({ ...zoom, step: 'press', marks: ['[data-guide="unlock-dismiss"]'], nav: 'dismissUnlock' });
      expect(document.querySelector('[data-pinch-hint]')).toBeNull();
    });
  });

  // Owner 2026-11-08: the telescope's field is turned by hand before the flight is pointed out.
  describe('the telescope\'s field of view', () => {
    const look: Extract<TutorialAnswer, { kind: 'step' }> = { kind: 'step', id: 'telescopeLook', step: 'read', marks: [], chapter: 7, strict: false };
    const lookAt = () => {
      vi.useFakeTimers();
      const ack = vi.fn();
      render(<><canvas data-testid="scene" /><StarterTutorialCoach tutorial={{ answer: look, ack, backIn: 50 }} /></>);
      act(() => { vi.advanceTimersByTime(CARD_AFTER_REVEAL_MS); });
      vi.useRealTimers();
      return ack;
    };
    it('says nothing until the sky has filled, so the first look is at the sky', () => {
      vi.useFakeTimers();
      const ack = vi.fn();
      render(<><canvas data-testid="scene" /><StarterTutorialCoach tutorial={{ answer: look, ack, backIn: 50 }} /></>);
      expect(document.querySelector('[data-school-coach]')).toBeNull();
      expect(document.querySelector('[data-drag-hint]')).toBeNull();
      const scene = screen.getByTestId('scene');
      fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
      fireEvent.pointerMove(scene, { clientX: 190, clientY: 310 });
      fireEvent.pointerUp(scene, { clientX: 190, clientY: 310 });
      expect(ack).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(CARD_AFTER_REVEAL_MS); });
      expect(document.querySelector('[data-school-coach]')).not.toBeNull();
      expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
      vi.useRealTimers();
    });
    it('shows the drag and moves on when the view has been turned and let go', () => {
      const ack = lookAt();
      expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
      const scene = screen.getByTestId('scene');
      fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
      fireEvent.pointerMove(scene, { clientX: 190, clientY: 310 });
      expect(ack).not.toHaveBeenCalled();
      fireEvent.pointerUp(scene, { clientX: 190, clientY: 310 });
      expect(ack).toHaveBeenCalledWith('telescopeLook');
      expect(ack).toHaveBeenCalledTimes(1);
    });
    it('keeps the drag up until the view has been turned', () => {
      lookAt();
      vi.useFakeTimers();
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
      vi.useRealTimers();
    });
    it('does not take a tap for a look', () => {
      const ack = lookAt();
      const scene = screen.getByTestId('scene');
      fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
      fireEvent.pointerUp(scene, { clientX: 102, clientY: 300 });
      expect(ack).not.toHaveBeenCalled();
    });
    it('keeps Next for whoever does not turn it', () => {
      const ack = lookAt();
      fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(ack).toHaveBeenCalledWith('telescopeLook');
    });
    it('has a first look that does not count for the telescope', () => {
      const ack = vi.fn();
      const view = mount();
      const scene = screen.getByTestId('scene');
      fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
      fireEvent.pointerMove(scene, { clientX: 190, clientY: 310 });
      fireEvent.pointerUp(scene, { clientX: 190, clientY: 310 });
      vi.useFakeTimers();
      view.rerender(<><canvas data-testid="scene" /><StarterTutorialCoach tutorial={{ answer: look, ack, backIn: 50 }} /></>);
      act(() => { vi.advanceTimersByTime(CARD_AFTER_REVEAL_MS); });
      vi.useRealTimers();
      expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
      expect(ack).not.toHaveBeenCalled();
    });
  });

  it('lets the power card be pressed before any look', () => {
    const tried = vi.fn();
    render(<><button type="button" data-guide="unlock-try" onClick={tried}>try</button><StarterTutorialCoach tutorial={{ answer: online, ack: vi.fn(), backIn: 50 }} /></>);
    fireEvent.click(screen.getByText('try'));
    expect(tried).toHaveBeenCalledOnce();
  });

  /** Owner playtest 2026-11-07: the hand was drawn under the card it pointed into. */
  it('draws the hand after the card', () => {
    vi.useFakeTimers();
    mount();
    act(() => { vi.advanceTimersByTime(13_000); });
    const card = document.querySelector('[data-school-coach]');
    const pointer = screen.getByTestId('pointer');
    expect(card && (card.compareDocumentPosition(pointer) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  });

  it('does not take a tap for a look', () => {
    mount();
    const scene = screen.getByTestId('scene');
    fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
    fireEvent.pointerUp(scene, { clientX: 102, clientY: 301 });
    expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
  });

  it('never leaves a commander without a way on: the hand comes anyway after a while', () => {
    vi.useFakeTimers();
    mount();
    act(() => { vi.advanceTimersByTime(13_000); });
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
    expect(screen.getByTestId('pointer')).toBeTruthy();
  });

  it('shows no drag while it sends the commander back to the galaxy', () => {
    mount({ ...online, marks: ['[data-sheet-close]'], nav: 'closePage' });
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
  });

  it('shows no drag hint on other lines', () => {
    mount({ kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1, strict: true });
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
  });

  it('greets the commander and names the power card in one line', () => {
    mount();
    const line = document.querySelector('[data-school-line]')?.getAttribute('data-school-line') ?? '';
    expect(line).toMatch(/this ship is yours/i);
    expect(line).toContain('Try it');
  });
});

/** Owner playtest 2026-11-06: no toast over the NPC's card. A refusal still says the act failed. */
describe('the NPC speaks alone', () => {
  let say: ((text: string, tone?: 'info' | 'error') => void) | null = null;
  function Speaker() { say = useToast(); return null; }
  const withCoach = (answer: TutorialAnswer | null) => render(<ToastProvider>
    <Speaker />
    {answer && <StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 50 }} />}
  </ToastProvider>);

  it('drops news while the card is up, and lets a refusal through', () => {
    withCoach({ kind: 'step', id: 'radarRing', step: 'read', marks: [], chapter: 7, strict: false });
    act(() => { say?.('Repair started'); });
    expect(screen.queryByText('Repair started')).toBeNull();
    act(() => { say?.('Not enough alloy', 'error'); });
    expect(screen.getByText('Not enough alloy')).toBeTruthy();
  });

  it('lets news through once the tutorial is over', () => {
    withCoach({ kind: 'advise' });
    act(() => { say?.('Repair started'); });
    expect(screen.getByText('Repair started')).toBeTruthy();
  });
});

/** Owner playtest 2026-11-07: a system's "online" card shows only when the NPC turns to it. */
describe('the online card waits its turn', () => {
  it('is held while the line is about something else, and let go when the line points at it', async () => {
    const { unlockHeld } = await import('../src/starter/tutorial/unlockHold.js');
    const view = render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1, strict: true }, ack: vi.fn(), backIn: 50 }} />);
    expect(unlockHeld()).toBe(true);
    view.rerender(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'online', step: 'press', marks: ['[data-guide="unlock-try"]'], chapter: 1, strict: true }, ack: vi.fn(), backIn: 50 }} />);
    expect(unlockHeld()).toBe(false);
    view.rerender(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'radarRing', step: 'read', marks: [], chapter: 7, strict: false }, ack: vi.fn(), backIn: 50 }} />);
    expect(unlockHeld()).toBe(true);
    view.unmount();
    expect(unlockHeld()).toBe(false);
  });
});

/** Owner playtest 2026-11-07: never more than ten seconds with nothing to do; past a minute the NPC leaves and comes back. */
describe('a long wait lets the player go', () => {
  it('lets the player roam a half-minute wait in the core, but not spend', () => {
    const { elsewhere, pressed, ordered } = coach({ kind: 'step', id: 'waitFirst', step: 'wait', marks: [], chapter: 2, strict: true }, vi.fn(), { until: new Date(Date.now() + 30_000), spanMs: 30_000 });
    fireEvent.click(screen.getByText('elsewhere'));
    fireEvent.click(screen.getByText('works'));
    fireEvent.click(screen.getByText('repair'));
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(pressed).toHaveBeenCalledOnce();
    expect(ordered).not.toHaveBeenCalled();
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
  });

  it('past a minute, says when it will be back, then steps aside with a countdown', () => {
    const until = new Date(Date.now() + 90_000);
    const { elsewhere, ordered } = coach({ kind: 'step', id: 'waitFirst', step: 'wait', marks: [], chapter: 2, strict: true }, vi.fn(), { until, spanMs: 90_000 });
    const line = document.querySelector('[data-school-line]')?.getAttribute('data-school-line') ?? '';
    expect(line).toContain(clockTime(until));
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ok/i }));
    expect(document.querySelector('[data-school-coach]')).toBeNull();
    expect(document.querySelector('[data-school-away]')).not.toBeNull();
    fireEvent.click(screen.getByText('elsewhere'));
    fireEvent.click(screen.getByText('repair'));
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(ordered).not.toHaveBeenCalled();
  });

  it('comes back with a sound when the work is done', () => {
    const until = new Date(Date.now() + 90_000);
    const { view } = coach({ kind: 'step', id: 'waitTelescope', step: 'wait', marks: [], chapter: 3, strict: false }, vi.fn(), { until, spanMs: 90_000 });
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ok/i }));
    sound.mockClear();
    view.rerender(<>
      <button type="button" data-guide="works">works</button>
      <button type="button">elsewhere</button>
      <button type="button" data-guide="repair-order">repair</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'collectMine', step: 'press', marks: [], chapter: 6, strict: false }, ack: vi.fn(), backIn: 50 }} />
    </>);
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
    expect(sound).toHaveBeenCalled();
  });
});

/**
 * AFTER THE CORE THE NPC LEADS, IT DOES NOT HOLD (owner 2026-11-08, N1). Power, the first collect and
 * the first repair hold every other control; a first-time moment only points, and holds no spend.
 */
describe('after the core the NPC leads, it does not hold', () => {
  it('keeps the core strict', () => {
    const { elsewhere } = coach({ kind: 'step', id: 'orderRefinery', step: 'press', marks: ['[data-guide="works"]'], chapter: 2, strict: true });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
  });

  it('lets any control answer while a moment points the way', () => {
    const { elsewhere, pressed } = coach({ kind: 'step', id: 'mine', step: 'press', marks: ['[data-guide="works"]'], chapter: 6, strict: false });
    expect(screen.getByTestId('pointer')).toBeTruthy();
    fireEvent.click(screen.getByText('elsewhere'));
    fireEvent.click(screen.getByText('works'));
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(pressed).toHaveBeenCalledOnce();
  });

  it('lets a page be closed while it asks for something else', () => {
    const closed = vi.fn();
    render(<>
      <button type="button" data-focus-close onClick={closed}>close</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'mine', step: 'press', marks: ['[data-guide="unlock-dismiss"]'], nav: 'dismissUnlock', chapter: 6, strict: false }, ack: vi.fn(), backIn: 50 }} />
    </>);
    fireEvent.click(screen.getByText('close'));
    expect(closed).toHaveBeenCalledOnce();
  });

  it('never holds a spend once the core is behind the player', () => {
    const { ordered } = coach({ kind: 'step', id: 'mine', step: 'press', marks: ['[data-guide="mine"]'], chapter: 6, strict: false });
    fireEvent.click(screen.getByText('repair'));
    expect(ordered).toHaveBeenCalledOnce();
  });

  it('lets through the spend the core points at', () => {
    const { ordered } = coach({ kind: 'step', id: 'orderRefinery', step: 'press', marks: ['[data-guide="repair-order"]'], chapter: 2, strict: true });
    fireEvent.click(screen.getByText('repair'));
    expect(ordered).toHaveBeenCalledOnce();
  });

  it('never holds a short wait once it has let go', () => {
    const { elsewhere } = coach({ kind: 'step', id: 'waitTelescope', step: 'wait', marks: [], chapter: 3, strict: false }, vi.fn(), { until: new Date(Date.now() + 8_000), spanMs: 8_000 });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
  });

  it('holds no spend through a long wait of a moment', () => {
    const { ordered } = coach({ kind: 'step', id: 'waitTelescope', step: 'wait', marks: [], chapter: 3, strict: false }, vi.fn(), { until: new Date(Date.now() + 90_000), spanMs: 90_000 });
    fireEvent.click(screen.getByText('repair'));
    expect(ordered).toHaveBeenCalledOnce();
  });
});

it('brings a read target into view once, including when it arrives after the coach', () => {
  vi.useFakeTimers();
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  const answer: TutorialAnswer = { kind: 'step', id: 'report', step: 'read', marks: ['[data-dossier-loot]'], chapter: 4, strict: false };
  const view = render(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 0 }} />);
  act(() => { vi.advanceTimersByTime(500); });
  const loot = document.createElement('div');
  loot.setAttribute('data-dossier-loot', '');
  document.body.append(loot);
  act(() => { vi.advanceTimersByTime(500); });
  expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
  view.rerender(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 1 }} />);
  act(() => { vi.advanceTimersByTime(2000); });
  expect(scroll).toHaveBeenCalledOnce();
  loot.remove();
});

it('keeps the away chip when the same wait moves between screens', async () => {
  const { tutorialStep } = await import('../src/starter/tutorial/script.js');
  const input = {
    modules: { REFINERY: 1, EXTRACTOR: 1 }, facts: [],
    queue: [{ subject: 'REFINERY', stage: 2 }],
    unlockToAnnounce: null, works: 0, canPayNext: false, canBuildShip: true, probing: false, mining: false, crates: [], acked: [],
  };
  const wait = { until: new Date(Date.now() + 90_000), spanMs: 90_000 };
  const view = render(<StarterTutorialCoach tutorial={{ answer: tutorialStep({ ...input, view: 'ship' }), ack: vi.fn(), backIn: 0, wait }} />);
  fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
  fireEvent.click(screen.getByRole('button', { name: /^ok/i }));
  for (const screen of ['galaxy', 'other', 'ship'] as const) {
    view.rerender(<StarterTutorialCoach tutorial={{ answer: tutorialStep({ ...input, view: screen }), ack: vi.fn(), backIn: 0, wait }} />);
    expect(document.querySelector('[data-school-away]')).not.toBeNull();
    expect(document.querySelector('[data-school-coach]')).toBeNull();
  }
});

describe('declining the guide', () => {
  const ordered = vi.fn();
  const mount = () => {
    const onSkip = vi.fn();
    render(<>
      <button type="button" data-guide="repair-order" onClick={ordered}>unguided repair</button>
      <StarterTutorialCoach onSkip={onSkip} tutorial={{ answer: { kind: 'step', id: 'online', step: 'press', marks: ['[data-guide="unlock-try"]'], chapter: 1, strict: true }, ack: vi.fn(), backIn: 0 }} />
    </>);
    return onSkip;
  };
  /** The choice is the account's (plan F3): the card goes at once, and `onSkip` saves it there. */
  it('offers a confirmation with a way to continue, then releases all controls and hands the choice to the account', async () => {
    const { unlockHeld } = await import('../src/starter/tutorial/unlockHold.js');
    const onSkip = mount();
    fireEvent.click(screen.getByRole('button', { name: "I don't need the guide" }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with guide' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
    expect(onSkip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: "I don't need the guide" }));
    fireEvent.click(screen.getByRole('button', { name: 'Close guide' }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-school-coach], [data-school-away], [data-drag-hint]')).toBeNull();
    expect(screen.queryByTestId('pointer')).toBeNull();
    expect(unlockHeld()).toBe(false);
    fireEvent.click(screen.getByText('unguided repair'));
    expect(ordered).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith('training_exit_requested', expect.objectContaining({ trainingVersion: 'starter-tutorial.v2', code: 'skipped' }), 'live');
  });
});

it('the late sight chapters point without locking the other repairs', () => {
 const free = vi.fn();
 render(<><div data-guide="sight-radar"/><button data-guide="repair-order" onClick={free}>another repair</button><StarterTutorialCoach tutorial={{answer:{kind:'step',id:'radarRing',step:'read',chapter:7,strict:false,marks:['[data-guide="sight-radar"]']},ack:vi.fn(),backIn:0}}/></>);
 fireEvent.click(screen.getByText('another repair'));
 expect(free).toHaveBeenCalledOnce();
});

it('does not scroll the galaxy away when a read target rides a projected scene marker', async()=>{
 vi.useFakeTimers();const scroll=vi.fn();Element.prototype.scrollIntoView=scroll;
 render(<><span data-scene-mark data-guide="sight-radar"/><StarterTutorialCoach tutorial={{answer:{kind:'step',id:'radarRing',step:'read',chapter:7,strict:false,marks:['[data-guide="sight-radar"]']},ack:vi.fn(),backIn:0}}/></>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
 expect(scroll).not.toHaveBeenCalled();
});

/**
 * THE WAY OUT IS NOT UNDER THE CARD (F2 walk, 2026-11-08). The "close the guide?" sheet opened beneath
 * a coach docked at the bottom, and the card covered its buttons: a player who asked to leave the guide
 * could not confirm it. While the question is open the card steps aside, and comes back if kept.
 */
describe('closing the guide', () => {
  it('takes the card away while it asks, and brings it back when the guide is kept', () => {
    coach({ kind: 'step', id: 'farewell', step: 'read', marks: [], chapter: 9, strict: false });
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /I don't need the guide/ }));
    expect(screen.getByRole('button', { name: 'Close guide' })).toBeTruthy();
    expect(document.querySelector('[data-school-coach]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with guide' }));
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
  });
});
