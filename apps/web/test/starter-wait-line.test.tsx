import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StarterGoal, type StarterGoalValue } from '../src/starter/tutorial/visualGoal.js';
import { StarterWaitLine } from '../src/starter/tutorial/StarterWaitLine.js';
afterEach(() => { cleanup(); vi.useRealTimers(); });

const at = (iso: string) => new Date(`2026-11-07T${iso}Z`);
const goal = (over: Partial<StarterGoalValue>): StarterGoalValue => ({ step: null, choice: null, picked: false, guided: true, view: 'ship', ...over });
const waitFirst = { kind: 'step', id: 'waitFirst', step: 'wait', chapter: 2, strict: true, marks: [] } as const;
const line = (value: StarterGoalValue, queue: { queue: string; subject: string; stage: number; startedAt: Date; readyAt: Date }[]) =>
  render(<StarterGoal.Provider value={value}><StarterWaitLine queue={queue} /></StarterGoal.Provider>);

it('shows the first repair clock and the crate it opens while the guide waits on it', () => {
  vi.useFakeTimers(); vi.setSystemTime(at('07:00:00'));
  const view = line(goal({ step: waitFirst }), [{ queue: 'CONSTRUCTION', subject: 'REFINERY', stage: 2, startedAt: at('06:59:55'), readyAt: at('07:00:05') }]);
  expect(view.getByTestId('starter-wait-line').textContent).toContain('5s');
  expect(view.getByLabelText('Salvage')).toBeTruthy();
});

/** Owner item Z2: without the officer the wait still says when it ends and what comes then. */
it('shows the soonest repair, and its crate, when the next step is a wait with the guide quiet', () => {
  vi.useFakeTimers(); vi.setSystemTime(at('07:00:00'));
  const view = line(goal({ choice: { kind: 'wait', readyAt: at('07:01:30') }, guided: false }), [
    { queue: 'CONSTRUCTION', subject: 'VAULT', stage: 1, startedAt: at('06:58:00'), readyAt: at('07:04:00') },
    { queue: 'CONSTRUCTION', subject: 'SHIPYARD', stage: 1, startedAt: at('06:58:30'), readyAt: at('07:01:30') },
  ]);
  expect(view.getByTestId('starter-wait-line').textContent).toContain('1m 30s');
  expect(view.getByLabelText('Salvage')).toBeTruthy();
});

it('names no crate for a repair that holds none', () => {
  vi.useFakeTimers(); vi.setSystemTime(at('07:00:00'));
  const view = line(goal({ choice: { kind: 'wait', readyAt: at('07:04:00') } }), [{ queue: 'CONSTRUCTION', subject: 'VAULT', stage: 1, startedAt: at('06:58:00'), readyAt: at('07:04:00') }]);
  expect(view.getByTestId('starter-wait-line').textContent).toContain('4m');
  expect(view.queryByLabelText('Salvage')).toBeNull();
});

it('is quiet when nothing is being waited on', () => {
  const view = line(goal({ choice: { kind: 'collect' } }), [{ queue: 'CONSTRUCTION', subject: 'VAULT', stage: 1, startedAt: at('06:58:00'), readyAt: at('07:04:00') }]);
  expect(view.queryByTestId('starter-wait-line')).toBeNull();
});
