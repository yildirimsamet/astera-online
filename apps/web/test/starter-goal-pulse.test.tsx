import { REPAIR_LADDER, openingProgress } from '@astera/rules';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShipHero } from '../src/starter/ShipHero.js';
import { StarterGoal, StarterGoalPulse, type StarterGoalValue } from '../src/starter/tutorial/visualGoal.js';
vi.mock('../src/lib/sound.js', () => ({ playSound: vi.fn() }));
vi.mock('../src/onboarding/flightSchool/SchoolPointer.js', () => ({ SchoolPointer: () => <span data-testid="pointer" /> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const collect = { kind: 'step', id: 'collect', step: 'press', chapter: 1, strict: true, marks: ['[data-guide="works"]'] } as const;
const goal = (over: Partial<StarterGoalValue> = {}): StarterGoalValue =>
  ({ step: null, choice: { kind: 'collect' }, picked: false, guided: true, view: 'galaxy', ...over });

it('pulses only the first visible enabled goal and remembers an unrecorded press without gating anything', async () => {
  const ack = vi.fn(), other = vi.fn();
  const view = render(<><button data-guide="works" disabled>hidden</button><button data-guide="works">works</button><button onClick={other}>free</button><StarterGoalPulse goal={goal({ step: collect })} ack={ack} /></>);
  expect(document.querySelectorAll('[data-starter-next]')).toHaveLength(1);
  fireEvent.click(document.querySelector('[data-starter-next]')!);
  // Recorded after the press, so a mark the next step takes away still does its own work first.
  expect(ack).not.toHaveBeenCalled();
  await vi.waitFor(() => { expect(ack).toHaveBeenCalledWith('collect'); });
  fireEvent.click(view.getByText('free')); expect(other).toHaveBeenCalledOnce();
  view.unmount(); expect(document.querySelector('[data-starter-next]')).toBeNull();
});

it('leaves the officer as the only pointing source while its card is visible', () => {
  render(<><div data-school-coach /><button data-guide="works" /><StarterGoalPulse goal={goal({ step: collect })} ack={vi.fn()} /></>);
  expect(document.querySelector('[data-starter-next]')).toBeNull();
});

/** Plan F3 (N1): the player picks, and the hand shows only the pick. */
it('draws the hand only for what the player picked, with the guide on', () => {
  const view = render(<><button data-guide="works" /><StarterGoalPulse goal={goal()} ack={vi.fn()} /></>);
  expect(document.querySelector('[data-starter-next]')).not.toBeNull();
  expect(view.queryByTestId('pointer')).toBeNull();
  view.rerender(<><button data-guide="works" /><StarterGoalPulse goal={goal({ picked: true })} ack={vi.fn()} /></>);
  expect(view.getByTestId('pointer')).toBeTruthy();
  view.rerender(<><button data-guide="works" /><StarterGoalPulse goal={goal({ picked: true, guided: false })} ack={vi.fn()} /></>);
  expect(view.queryByTestId('pointer')).toBeNull();
});

it('takes a press on a pick as nothing for the guide to record', () => {
  const ack = vi.fn();
  render(<><button data-guide="works">works</button><StarterGoalPulse goal={goal({ picked: true })} ack={ack} /></>);
  fireEvent.click(document.querySelector('[data-starter-next]')!);
  expect(ack).not.toHaveBeenCalled();
});

/** Review F0: the pulse polled the page four times a second even with nothing to mark. */
it('does not watch the page when there is nothing to mark', () => {
  const interval = vi.spyOn(window, 'setInterval');
  const shield = REPAIR_LADDER.find(s => s.module === 'AEGIS' && s.stage === 1)!;
  render(<StarterGoalPulse goal={goal({ choice: { kind: 'save', step: shield, minutes: 30 } })} ack={vi.fn()} />);
  render(<StarterGoalPulse goal={null} ack={vi.fn()} />);
  expect(interval).not.toHaveBeenCalled();
});

it('lights the next damaged machine on the ship itself', () => {
  const survey = REPAIR_LADDER.find(s => s.module === 'SURVEY' && s.stage === 1)!;
  const view = render(<StarterGoal.Provider value={goal({ choice: { kind: 'repair', step: survey } })}><ShipHero id="ship-1" progress={openingProgress()} selected="REFINERY" onSelect={vi.fn()} /></StarterGoal.Provider>);
  const nodes = view.container.querySelectorAll('[data-testid="ship-hero"] svg line');
  expect(nodes[1]?.getAttribute('stroke')).toBe('var(--color-v2-self)');
  const mark = view.getByRole('button', { name: 'Survey antenna' });
  expect(mark.querySelector('[style]')?.getAttribute('style')).toContain('var(--color-v2-self)');
  expect(nodes[2]?.getAttribute('stroke')).toBe('var(--color-v2-hostile)');
});
