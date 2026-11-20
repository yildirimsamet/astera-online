import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { resetAttentionForTests, useAttention, useAttentionBusy } from '../src/shell/attention/store.js';

const telemetry = vi.hoisted(() => ({ observe: vi.fn(), analyticsRecording: vi.fn(() => true), ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => telemetry);

function Surface({ id, priority, want = true, blocking = true }: { id: string; priority: number; want?: boolean; blocking?: boolean }) {
  const { shown, release } = useAttention(id, want, { priority, blocking });
  if (!shown) return null;
  return <button type="button" onClick={() => { release('act:go'); }}>{id}</button>;
}

function Busy({ busy }: { busy: boolean }) { useAttentionBusy('shell', busy); return null; }

const events = () => telemetry.observe.mock.calls.map(([name, properties]) => [name, properties] as const);

beforeEach(() => { resetAttentionForTests(); telemetry.observe.mockClear(); telemetry.analyticsRecording.mockReturnValue(true); });

it('shows the most important surface, records it once, and records how the player closed it', () => {
  render(<><Surface id="brand_quiz" priority={50} /><Surface id="arrival_card" priority={100} /></>);
  expect(screen.getByText('arrival_card')).toBeTruthy();
  expect(screen.queryByText('brand_quiz')).toBeNull();
  fireEvent.click(screen.getByText('arrival_card'));
  expect(screen.queryByText('arrival_card')).toBeNull();
  expect(events()).toEqual([
    ['surface_visible', { surface: 'arrival_card' }],
    ['surface_closed', { surface: 'arrival_card', code: 'act:go' }],
  ]);
});

it('brings the next surface only after the player touches the game again', () => {
  render(<><Surface id="brand_quiz" priority={50} /><Surface id="arrival_card" priority={100} /></>);
  fireEvent.click(screen.getByText('arrival_card'));
  expect(screen.queryByText('brand_quiz')).toBeNull();
  act(() => { fireEvent.pointerDown(window); });
  expect(screen.getByText('brand_quiz')).toBeTruthy();
  expect(events().at(-1)).toEqual(['surface_visible', { surface: 'brand_quiz' }]);
});

it('records a shown surface that went away by itself as gone, and lets the next one in at once', () => {
  const view = render(<><Surface id="brand_quiz" priority={50} /><Surface id="arrival_card" priority={100} /></>);
  view.rerender(<><Surface id="brand_quiz" priority={50} /><Surface id="arrival_card" priority={100} want={false} /></>);
  expect(screen.getByText('brand_quiz')).toBeTruthy();
  expect(events()).toContainEqual(['surface_closed', { surface: 'arrival_card', code: 'gone' }]);
});

it('opens nothing over a page the player opened, and continues when it closes', () => {
  const view = render(<><Busy busy /><Surface id="brand_quiz" priority={50} /></>);
  expect(screen.queryByText('brand_quiz')).toBeNull();
  view.rerender(<><Busy busy={false} /><Surface id="brand_quiz" priority={50} /></>);
  expect(screen.getByText('brand_quiz')).toBeTruthy();
});

it('writes nothing while the player has not allowed measurement, and still runs the queue', () => {
  telemetry.analyticsRecording.mockReturnValue(false);
  render(<Surface id="arrival_card" priority={100} />);
  fireEvent.click(screen.getByText('arrival_card'));
  expect(telemetry.observe).not.toHaveBeenCalled();
});
