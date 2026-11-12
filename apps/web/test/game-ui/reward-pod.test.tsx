import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POD_ART, POD_OPEN_MS, RewardPod } from '../../src/game-ui/RewardPod.js';

/**
 * THE SUPPLY POD. A reward is a thing you open, not a line you read: a tap winds the pod
 * up (it shakes and squashes), then the lid blows open in a burst of light and what was
 * inside appears. The reward is granted once, however many times the finger lands.
 */

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const tap = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

/** Width and height of an extended (VP8X) WebP, the form a WebP with alpha takes. */
function webpSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.toString('ascii', 12, 16)).toBe('VP8X');
  return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
}

describe('the supply pod', () => {
  it('waits closed, its contents hidden, and says what a tap does', () => {
    render(<RewardPod label="Kapsülü aç" onOpen={() => undefined}><span>+500 Alaşım</span></RewardPod>);
    const pod = screen.getByRole('button', { name: 'Kapsülü aç' });
    expect(pod.closest('[data-state]')).toHaveAttribute('data-state', 'closed');
    expect(screen.queryByText('+500 Alaşım')).toBeNull();
  });

  it('winds up on a tap, then opens and shows what was inside', () => {
    const onOpen = vi.fn();
    render(<RewardPod label="Kapsülü aç" onOpen={onOpen}><span>+500 Alaşım</span></RewardPod>);
    const pod = screen.getByRole('button', { name: 'Kapsülü aç' });
    tap(pod);
    expect(pod.closest('[data-state]')).toHaveAttribute('data-state', 'opening');
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByText('+500 Alaşım')).toBeNull();
    act(() => { vi.advanceTimersByTime(POD_OPEN_MS); });
    expect(pod.closest('[data-state]')).toHaveAttribute('data-state', 'open');
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('+500 Alaşım')).toBeInTheDocument();
  });

  it('grants the reward once, however many times the finger lands', () => {
    const onOpen = vi.fn();
    render(<RewardPod label="Kapsülü aç" onOpen={onOpen} />);
    const pod = screen.getByRole('button', { name: 'Kapsülü aç' });
    tap(pod);
    tap(pod);
    act(() => { vi.advanceTimersByTime(POD_OPEN_MS); });
    tap(pod);
    act(() => { vi.advanceTimersByTime(POD_OPEN_MS); });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('comes back already open without granting again', () => {
    const onOpen = vi.fn();
    render(<RewardPod label="Kapsülü aç" onOpen={onOpen} opened><span>+500 Alaşım</span></RewardPod>);
    expect(screen.getByText('+500 Alaşım')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kapsülü aç' }).closest('[data-state]')).toHaveAttribute('data-state', 'open');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows open, and grants nothing, when word that it was opened arrives after it was drawn', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<RewardPod label="Kapsülü aç" onOpen={onOpen}><span>+500 Alaşım</span></RewardPod>);
    rerender(<RewardPod label="Kapsülü aç" onOpen={onOpen} opened><span>+500 Alaşım</span></RewardPod>);
    const body = screen.getByRole('button', { name: 'Kapsülü aç' });
    expect(body.closest('[data-state]')).toHaveAttribute('data-state', 'open');
    tap(body);
    act(() => { vi.advanceTimersByTime(POD_OPEN_MS * 2); });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('paints the closed and the open pod in one frame, so the lid opens in place', () => {
    const closed = webpSize(join('public', POD_ART.closed));
    const open = webpSize(join('public', POD_ART.open));
    expect(closed).toEqual(open);
    expect(closed[0]).toBe(closed[1]);
  });
});
