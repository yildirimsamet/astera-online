import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TutorialAnswer } from '../src/starter/tutorial/script.js';
import { StarterTutorialCoach } from '../src/starter/tutorial/StarterTutorialCoach.js';
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
    const { ack } = coach({ kind: 'step', id: 'welcome', step: 'read', marks: [], chapter: 1 });
    expect(document.querySelector('img[src$="tutorial-npc.png"]')).not.toBeNull();
    expect(screen.getByText('1/8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(ack).toHaveBeenCalledWith('welcome');
  });

  it('lets only the marked control answer, and takes that press as the step', () => {
    const { ack, pressed, elsewhere } = coach({ kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1 });
    expect(screen.getByTestId('pointer')).toBeTruthy();
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('works'));
    expect(pressed).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledWith('collect');
  });

  it('holds every control while a ten-second repair runs, and says it is working', () => {
    const { elsewhere, pressed } = coach({ kind: 'step', id: 'waitFirst', step: 'wait', marks: [], chapter: 2 }, vi.fn(), { until: new Date(Date.now() + 10_000), spanMs: 10_000 });
    fireEvent.click(screen.getByText('works'));
    fireEvent.click(screen.getByText('elsewhere'));
    expect(pressed).not.toHaveBeenCalled();
    expect(elsewhere).not.toHaveBeenCalled();
    expect(document.querySelector('.school-working')).not.toBeNull();
  });

  it('says how long until the player should come back', () => {
    coach({ kind: 'step', id: 'farewell', step: 'read', marks: [], chapter: 4 });
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    expect(document.querySelector('[data-school-line]')?.getAttribute('data-school-line')).toMatch(/50/);
  });

  /** Review 2026-11-06: an NPC that waits on a control the screen never drew holds the player forever. */
  it('lets go of the controls when the marked one is nowhere for a few seconds, and records where it stuck', () => {
    vi.useFakeTimers();
    const { elsewhere } = coach({ kind: 'step', id: 'orderRefinery', step: 'press', marks: ['[data-guide="nowhere"]'], chapter: 2 });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(4_500); });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith('blocker_visible', expect.objectContaining({ surface: 'starter_tutorial', subject: 'orderRefinery', code: 'mark_missing' }));
  });

  it('lets go of the controls when a wait runs far past its time', () => {
    vi.useFakeTimers();
    const { elsewhere } = coach({ kind: 'step', id: 'waitFirst', step: 'wait', marks: [], chapter: 2 }, vi.fn(), { until: new Date(Date.now() + 10_000), spanMs: 10_000 });
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
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'orderShipyard', step: 'press', marks: ['[data-guide="unlock-dismiss"]'], nav: 'dismissUnlock', chapter: 3 }, ack: vi.fn(), backIn: 50 }} />
    </>);
    // jsdom lays nothing out: hidden as a browser would report it.
    const hidden = screen.getByText('dismiss');
    hidden.checkVisibility = () => false;
    act(() => { vi.advanceTimersByTime(4_500); });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
  });

  /** Owner playtest 2026-11-07: the report is opened from its row; the Intel tab is only the way back to it. */
  it('takes the press on the row as opening the report, not the press on the way to it', () => {
    const ack = vi.fn();
    render(<>
      <ul><li data-known="probe"><button type="button">r5ty54ry</button></li></ul>
      <button type="button" data-guide="dock-intel">Intel</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'openReport', step: 'press', marks: ['[data-known="probe"] button', '[data-guide="dock-intel"]'], chapter: 4 }, ack, backIn: 50 }} />
    </>);
    fireEvent.click(screen.getByText('Intel'));
    expect(ack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('r5ty54ry'));
    expect(ack).toHaveBeenCalledWith('openReport');
  });

  /** Owner playtest 2026-11-07: the report's rows sat below the fold and the line spoke of them unseen. */
  it('lights up what a read line talks about', () => {
    render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'report', step: 'read', marks: ['[data-dossier-loot]'], chapter: 4 }, ack: vi.fn(), backIn: 50 }} />);
    expect(screen.getByTestId('pointer')).toBeTruthy();
  });

  it('pulls a repair thumbnail on the strip into view', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.useFakeTimers();
    render(<>
      <button type="button" data-guide="repair-show" data-step="EXTRACTOR:1">thumb</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'orderExtractor', step: 'press', marks: ['[data-guide="repair-order"][data-step="EXTRACTOR:1"]', '[data-guide="repair-show"][data-step="EXTRACTOR:1"]'], chapter: 2 }, ack: vi.fn(), backIn: 0 }} />
    </>);
    act(() => { vi.advanceTimersByTime(600); });
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ inline: 'center' }));
  });

  /** Review 2026-11-06: the goodbye named a time that slid on while it was being read. */
  it('names the time to come back as it was when the goodbye began', () => {
    const answer: TutorialAnswer = { kind: 'step', id: 'farewell', step: 'read', marks: [], chapter: 4 };
    const { rerender } = render(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 50 }} />);
    rerender(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 49 }} />);
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    expect(document.querySelector('[data-school-line]')?.getAttribute('data-school-line')).toMatch(/50/);
  });

  it('records each visible tutorial step with the starter version and its scene id', () => {
    const answer: TutorialAnswer = { kind: 'step', id: 'orderRefinery3', step: 'press', marks: [], chapter: 5 };
    const { rerender } = render(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 0 }} />);
    rerender(<StarterTutorialCoach tutorial={{ answer, ack: vi.fn(), backIn: 1 }} />);
    expect(observe).toHaveBeenCalledWith('training_scene_visible', { trainingVersion: 'starter-tutorial.v1', scene: 'orderRefinery3' }, 'live');
    expect(observe.mock.calls.filter(call => call[0] === 'training_scene_visible')).toHaveLength(1);
  });

  it('is silent when the player is away or done', () => {
    coach({ kind: 'away' });
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
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'collect', step: 'press', marks: ['[data-guide="works"]'], chapter: 1 }, ack: vi.fn(), backIn: 50 }} />
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

describe('the first look', () => {
  // jsdom has no PointerEvent, so a pointer's position would be lost on the way; browsers carry it.
  beforeAll(() => {
    if (!('PointerEvent' in window)) Object.defineProperty(window, 'PointerEvent', { value: class extends MouseEvent {}, configurable: true });
  });
  const look: Extract<TutorialAnswer, { kind: 'step' }> = { kind: 'step', id: 'lookAround', step: 'read', marks: [], chapter: 1 };
  const reveal = () => { const button = screen.queryByRole('button', { name: /show full message/i }); if (button) fireEvent.click(button); };

  /** Owner playtest 2026-11-07: the hand goes once the view is turned, and only then is Next offered and pointed at. */
  it('offers Next only after the view has been dragged, then points at it', () => {
    render(<><canvas data-testid="scene" /><StarterTutorialCoach tutorial={{ answer: look, ack: vi.fn(), backIn: 50 }} /></>);
    reveal();
    expect(document.querySelector('[data-school-next]')).toBeNull();
    expect(screen.queryByTestId('pointer')).toBeNull();
    const scene = screen.getByTestId('scene');
    fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
    fireEvent.pointerMove(scene, { clientX: 190, clientY: 310 });
    fireEvent.pointerUp(scene, { clientX: 190, clientY: 310 });
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
    reveal();
    expect(document.querySelector('[data-school-next]')).not.toBeNull();
    expect(screen.getByTestId('pointer')).toBeTruthy();
  });

  /** Owner playtest 2026-11-07: the hand pointing at Next was drawn under the card. */
  it('draws the hand over the card it points into', () => {
    vi.useFakeTimers();
    render(<StarterTutorialCoach tutorial={{ answer: look, ack: vi.fn(), backIn: 50 }} />);
    act(() => { vi.advanceTimersByTime(13_000); });
    const card = document.querySelector('[data-school-coach]');
    const pointer = screen.getByTestId('pointer');
    expect(card && (card.compareDocumentPosition(pointer) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  });

  it('does not take a tap for a look', () => {
    render(<><canvas data-testid="scene" /><StarterTutorialCoach tutorial={{ answer: look, ack: vi.fn(), backIn: 50 }} /></>);
    const scene = screen.getByTestId('scene');
    fireEvent.pointerDown(scene, { clientX: 100, clientY: 300 });
    fireEvent.pointerUp(scene, { clientX: 102, clientY: 301 });
    expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
  });

  it('never leaves a commander without a way on: Next comes anyway after a while', () => {
    vi.useFakeTimers();
    render(<StarterTutorialCoach tutorial={{ answer: look, ack: vi.fn(), backIn: 50 }} />);
    act(() => { vi.advanceTimersByTime(13_000); });
    reveal();
    expect(document.querySelector('[data-school-next]')).not.toBeNull();
  });

  it('shows no hand while it sends the commander back to the galaxy', () => {
    render(<StarterTutorialCoach tutorial={{ answer: { ...look, step: 'press', marks: ['[data-sheet-close]'], nav: 'closePage' }, ack: vi.fn(), backIn: 50 }} />);
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
  });

  it('shows that the view can be dragged', () => {
    render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'lookAround', step: 'read', marks: [], chapter: 1 }, ack: vi.fn(), backIn: 50 }} />);
    expect(document.querySelector('[data-drag-hint]')).not.toBeNull();
  });

  it('shows no drag hint on other lines', () => {
    render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'welcome', step: 'read', marks: [], chapter: 1 }, ack: vi.fn(), backIn: 50 }} />);
    expect(document.querySelector('[data-drag-hint]')).toBeNull();
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
    withCoach({ kind: 'step', id: 'welcome', step: 'read', marks: [], chapter: 1 });
    act(() => { say?.('Repair started'); });
    expect(screen.queryByText('Repair started')).toBeNull();
    act(() => { say?.('Not enough alloy', 'error'); });
    expect(screen.getByText('Not enough alloy')).toBeTruthy();
  });

  it('lets news through once the tutorial is over', () => {
    withCoach({ kind: 'done' });
    act(() => { say?.('Repair started'); });
    expect(screen.getByText('Repair started')).toBeTruthy();
  });
});

/** Owner playtest 2026-11-07: a system's "online" card shows only when the NPC turns to it. */
describe('the online card waits its turn', () => {
  it('is held while the line is about something else, and let go when the line points at it', async () => {
    const { unlockHeld } = await import('../src/starter/tutorial/unlockHold.js');
    const view = render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'lookAround', step: 'read', marks: [], chapter: 1 }, ack: vi.fn(), backIn: 50 }} />);
    expect(unlockHeld()).toBe(true);
    view.rerender(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'online', step: 'press', marks: ['[data-guide="unlock-try"]'], chapter: 1 }, ack: vi.fn(), backIn: 50 }} />);
    expect(unlockHeld()).toBe(false);
    view.rerender(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'welcome', step: 'read', marks: [], chapter: 1 }, ack: vi.fn(), backIn: 50 }} />);
    expect(unlockHeld()).toBe(true);
    view.unmount();
    expect(unlockHeld()).toBe(false);
  });
});

/** Owner 2026-11-07: the refinery's repair got shorter; the NPC names the time the ladder holds, not "three minutes". */
it('names the third refinery repair by the time the ladder gives it', async () => {
  const { REPAIR_LADDER } = await import('@astera/rules');
  const { durationPrecise } = await import('../src/lib/time.js');
  const minutes = REPAIR_LADDER.find(s => s.module === 'REFINERY' && s.stage === 3)!.minutes;
  render(<StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'orderRefinery3', step: 'press', marks: [], chapter: 5 }, ack: vi.fn(), backIn: 50 }} />);
  const line = document.querySelector('[data-school-line]')?.getAttribute('data-school-line') ?? '';
  expect(line).toContain(durationPrecise(minutes));
  expect(line).not.toMatch(/three minutes/);
});

/** Owner playtest 2026-11-07: never more than ten seconds with nothing to do; past a minute the NPC leaves and comes back. */
describe('a long wait lets the player go', () => {
  it('lets the player roam a half-minute wait, but not spend', () => {
    const { elsewhere, pressed, ordered } = coach({ kind: 'step', id: 'waitAntenna', step: 'wait', marks: [], chapter: 3 }, vi.fn(), { until: new Date(Date.now() + 30_000), spanMs: 30_000 });
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
    const { elsewhere, ordered } = coach({ kind: 'step', id: 'waitRefinery', step: 'wait', marks: [], chapter: 5 }, vi.fn(), { until, spanMs: 90_000 });
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
    const { view } = coach({ kind: 'step', id: 'waitRefinery', step: 'wait', marks: [], chapter: 5 }, vi.fn(), { until, spanMs: 90_000 });
    fireEvent.click(screen.getByRole('button', { name: /show full message/i }));
    fireEvent.click(screen.getByRole('button', { name: /^ok/i }));
    sound.mockClear();
    view.rerender(<>
      <button type="button" data-guide="works">works</button>
      <button type="button">elsewhere</button>
      <button type="button" data-guide="repair-order">repair</button>
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'openRefineryCrate', step: 'press', marks: [], chapter: 5 }, ack: vi.fn(), backIn: 50 }} />
    </>);
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
    expect(sound).toHaveBeenCalled();
  });
});

/**
 * Owner playtest 2026-11-07 (third batch): "Oyuncuyu oyunda geçen 3-5 dk'dan sonra serbest bırakmaya
 * başlamalıyız." From the first probe on the NPC leads and no longer holds; it keeps the store for the road.
 */
describe('after the first minutes the NPC leads, it does not hold', () => {
  it('keeps the first chapters strict', () => {
    const { elsewhere } = coach({ kind: 'step', id: 'orderAntenna', step: 'press', marks: ['[data-guide="works"]'], chapter: 3 });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).not.toHaveBeenCalled();
  });

  it('from the first probe on, lets any control answer while it points the way', () => {
    const { elsewhere, pressed } = coach({ kind: 'step', id: 'probe', step: 'press', marks: ['[data-guide="works"]'], chapter: 4 });
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
      <StarterTutorialCoach tutorial={{ answer: { kind: 'step', id: 'mine', step: 'press', marks: ['[data-guide="unlock-dismiss"]'], nav: 'dismissUnlock', chapter: 6 }, ack: vi.fn(), backIn: 50 }} />
    </>);
    fireEvent.click(screen.getByText('close'));
    expect(closed).toHaveBeenCalledOnce();
  });

  it('refuses a spend it does not point at, so the next step can still be paid', () => {
    const { ordered } = coach({ kind: 'step', id: 'mine', step: 'press', marks: ['[data-guide="mine"]'], chapter: 6 });
    fireEvent.click(screen.getByText('repair'));
    expect(ordered).not.toHaveBeenCalled();
  });

  it('lets through the spend it points at', () => {
    const { ordered } = coach({ kind: 'step', id: 'orderRefinery3', step: 'press', marks: ['[data-guide="repair-order"]'], chapter: 5 });
    fireEvent.click(screen.getByText('repair'));
    expect(ordered).toHaveBeenCalledOnce();
  });

  it('never holds a short wait once it has let go', () => {
    const { elsewhere } = coach({ kind: 'step', id: 'probeFlying', step: 'wait', marks: [], chapter: 4 }, vi.fn(), { until: new Date(Date.now() + 8_000), spanMs: 8_000 });
    fireEvent.click(screen.getByText('elsewhere'));
    expect(elsewhere).toHaveBeenCalledOnce();
  });
});

it('brings a read target into view once, including when it arrives after the coach', () => {
  vi.useFakeTimers();
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  const answer: TutorialAnswer = { kind: 'step', id: 'report', step: 'read', marks: ['[data-dossier-loot]'], chapter: 4 };
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
    modules: { REFINERY: 2, EXTRACTOR: 2, SURVEY: 1 }, facts: ['FIRST_PROBE_REPORT'] as const,
    queue: [{ subject: 'REFINERY', stage: 3 }, { subject: 'VAULT', stage: 1 }],
    unlockToAnnounce: null, works: 0, canPayNext: false, probing: false, mining: false, crates: [], acked: [],
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
  const mount = (id = 'skip-account') => render(<>
    <button type="button" data-guide="repair-order" onClick={ordered}>unguided repair</button>
    <StarterTutorialCoach accountId={id} tutorial={{ answer: { kind: 'step', id: 'welcome', step: 'read', marks: [], chapter: 1 }, ack: vi.fn(), backIn: 0 }} />
  </>);
  const ordered = vi.fn();
  it('offers a confirmation with a way to continue, then releases all controls on confirmation and remembers the account', async () => {
    const { unlockHeld } = await import('../src/starter/tutorial/unlockHold.js');
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: "I don't need the guide" }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with guide' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "I don't need the guide" }));
    fireEvent.click(screen.getByRole('button', { name: 'Close guide' }));
    expect(document.querySelector('[data-school-coach], [data-school-away], [data-drag-hint]')).toBeNull();
    expect(screen.queryByTestId('pointer')).toBeNull();
    expect(unlockHeld()).toBe(false);
    fireEvent.click(screen.getByText('unguided repair'));
    expect(ordered).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith('training_exit_requested', expect.objectContaining({ trainingVersion: 'starter-tutorial.v1', code: 'skipped' }), 'live');
    view.unmount();
    const remounted = mount();
    expect(document.querySelector('[data-school-coach]')).toBeNull();
    remounted.unmount();
    mount('another-account');
    expect(document.querySelector('[data-school-coach]')).not.toBeNull();
  });
});

it('the late sight chapters point without locking the other repairs', () => {
 const free = vi.fn();
 render(<><div data-guide="sight-telescope"/><button data-guide="repair-order" onClick={free}>another repair</button><StarterTutorialCoach tutorial={{answer:{kind:'step',id:'telescopeRing',step:'read',chapter:7,marks:['[data-guide="sight-telescope"]']},ack:vi.fn(),backIn:0}}/></>);
 fireEvent.click(screen.getByText('another repair'));
 expect(free).toHaveBeenCalledOnce();expect(screen.getByText('7/8')).toBeTruthy();
});

it('does not scroll the galaxy away when a read target rides a projected scene marker', async()=>{
 vi.useFakeTimers();const scroll=vi.fn();Element.prototype.scrollIntoView=scroll;
 render(<><span data-scene-mark data-guide="sight-telescope"/><StarterTutorialCoach tutorial={{answer:{kind:'step',id:'telescopeRing',step:'read',chapter:7,marks:['[data-guide="sight-telescope"]']},ack:vi.fn(),backIn:0}}/></>);
 await act(async()=>{await vi.advanceTimersByTimeAsync(300);});
 expect(scroll).not.toHaveBeenCalled();
});
