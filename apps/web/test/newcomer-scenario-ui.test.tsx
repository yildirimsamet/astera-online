import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewcomerScenario } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { NewcomerScenarioCard, NewcomerScenarioLock } from '../src/starter/NewcomerScenarioHost.js';
import { ContextSlot } from '../src/v2/hud/ContextSlot.js';
import { attentionIsQuiet, resetAttentionForTests } from '../src/shell/attention/store.js';

let currentScenario: NewcomerScenario | null = null;
const startMutate = vi.fn();
const completeMutate = vi.fn();
const dismissMutate = vi.fn();

vi.mock('../src/api/queries.js', () => ({
  useNewcomerScenario: () => ({ data: { scenario: currentScenario } }),
  useNewcomerScenarioActions: () => ({
    start: { mutate: startMutate, isPending: false },
    complete: { mutate: completeMutate, isPending: false },
    dismiss: { mutate: dismissMutate, isPending: false },
  }),
}));
vi.mock('../src/ui/Toast.js', () => ({ useToast: () => vi.fn(), describe: () => 'err' }));
vi.mock('../src/lib/sound.js', () => ({ playSound: vi.fn(), OWN_SOUND: {} }));
vi.mock('../src/lib/haptics.js', () => ({ haptic: vi.fn() }));

const baseScenario = (step: NewcomerScenario['step'], extra: Partial<NewcomerScenario> = {}): NewcomerScenario => ({
  step,
  pirateDefeated: false,
  holdsScreenUntil: new Date(Date.now() + 30 * 60_000),
  ...extra,
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  window.localStorage.clear();
  currentScenario = null;
  startMutate.mockClear();
  completeMutate.mockClear();
  dismissMutate.mockClear();
  resetAttentionForTests();
});
afterEach(cleanup);

describe('NewcomerScenarioCard & NewcomerScenarioLock (playtest 2026-11-23)', () => {
  it('holds the attention lock while active and lifts it on DONE', () => {
    currentScenario = baseScenario('MINE');
    const view = render(<NewcomerScenarioLock />);
    expect(attentionIsQuiet()).toBe(true);

    currentScenario = baseScenario('DONE', { pirateDefeated: true });
    view.rerender(<NewcomerScenarioLock />);
    expect(attentionIsQuiet()).toBe(false);
  });

  // Review 2026-11-23: a task left for days must not keep the quiz, the install card and the news waiting.
  it('lifts the lock when the founding hour is over, even with the tasks unfinished', () => {
    vi.useFakeTimers();
    try {
      currentScenario = baseScenario('PIRATE', { holdsScreenUntil: new Date(Date.now() + 5_000) });
      render(<NewcomerScenarioLock />);
      expect(attentionIsQuiet()).toBe(true);
      act(() => { vi.advanceTimersByTime(5_100); });
      expect(attentionIsQuiet()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never locks a screen whose hour was over before it opened', () => {
    currentScenario = baseScenario('MINE', { holdsScreenUntil: new Date(Date.now() - 1_000) });
    render(<NewcomerScenarioLock />);
    expect(attentionIsQuiet()).toBe(false);
  });

  it('shows pure player-driven guidance without auto-launch buttons for MINE, PIRATE, and PROBE', () => {
    currentScenario = baseScenario('MINE');
    const view = render(<NewcomerScenarioCard />);
    const mine = screen.getByTestId('newcomer-scenario');
    expect(mine.getAttribute('data-step')).toBe('MINE');
    expect(mine).toHaveTextContent(/Find a nearby asteroid/i);
    // Only fold + close icon buttons in the header — no auto-action button
    expect(within(mine).getAllByRole('button')).toHaveLength(2);

    currentScenario = baseScenario('PIRATE');
    view.rerender(<NewcomerScenarioCard />);
    const pirate = screen.getByTestId('newcomer-scenario');
    expect(pirate).toHaveTextContent(/pirate fleet is cruising nearby/i);
    expect(pirate).not.toHaveTextContent(/4×|nest/i);
    expect(within(pirate).getAllByRole('button')).toHaveLength(2);

    currentScenario = baseScenario('PROBE', { pirateDefeated: true });
    view.rerender(<NewcomerScenarioCard />);
    const probe = screen.getByTestId('newcomer-scenario');
    expect(probe).toHaveTextContent(/pick another planet on the map and send a Probe/i);
    expect(within(probe).getAllByRole('button')).toHaveLength(2);
  });

  it('folds to ContextStrip, completes on WRAP_UP, and requires 2-tap confirm to dismiss', () => {
    currentScenario = baseScenario('WRAP_UP', { pirateDefeated: true });
    render(<NewcomerScenarioCard />);

    // Fold to ContextStrip and re-open
    fireEvent.click(screen.getByRole('button', { name: i18n.t('directives.hide') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('directives.show') }));

    // Complete button works
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(completeMutate).toHaveBeenCalledTimes(1);

    // 2-tap confirm on dismiss
    fireEvent.click(screen.getByRole('button', { name: 'Hide guide' }));
    expect(dismissMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('scenario-dismiss-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(dismissMutate).toHaveBeenCalledTimes(1);
  });

  it('renders below the corner chat button in ContextSlot and hides whenever a FocusPanel is selected', () => {
    currentScenario = baseScenario('MINE');
    const slotProps = {
      now: Date.now(),
      threats: [],
      contacts: [],
      events: [],
      suggestion: null,
      onPrepare: vi.fn(),
      onLook: vi.fn(),
      onShowEvent: vi.fn(),
      onAct: vi.fn(),
      onClearSelection: vi.fn(),
      dismissed: new Set<string>(),
      onDismiss: vi.fn(),
      corner: <button type="button" data-testid="chat-corner">Chat</button>,
      onboarding: <NewcomerScenarioCard />,
    };

    const view = render(<ContextSlot {...slotProps} selected={false} />);
    expect(screen.getByTestId('chat-corner')).toBeInTheDocument();
    expect(screen.getByTestId('newcomer-scenario')).toBeInTheDocument();
    // Chat corner precedes the onboarding card in the bottom column
    const foot = screen.getByTestId('newcomer-scenario').closest('[data-slot-foot]')!;
    const chatPos = foot.compareDocumentPosition(screen.getByTestId('chat-corner'));
    expect(chatPos & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();

    // Opening any FocusPanel (selected={true}) hides the onboarding card completely — zero overlap
    view.rerender(<ContextSlot {...slotProps} selected />);
    expect(screen.queryByTestId('newcomer-scenario')).toBeNull();
  });
});
