import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchoolCoach } from '../src/onboarding/flightSchool/SchoolCoach.js';

afterEach(() => { vi.useRealTimers(); });
describe('commander dialogue', () => {
  it('reveals text at a readable pace; a tap completes text without advancing', () => {
    vi.useFakeTimers();
    const next = vi.fn();
    render(<SchoolCoach title="Resources" text="Alloy builds your ships. Collect it from the production pool." actionLabel="Continue" onAction={next} onExit={vi.fn()} exitLabel="Leave" progress={1} />);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
    const dialogue = screen.getByRole('button', { name: 'Show full message' });
    fireEvent.click(dialogue);
    expect(next).not.toHaveBeenCalled();
    expect(screen.getByText('Alloy builds your ships. Collect it from the production pool.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(next).toHaveBeenCalledOnce();
    expect(document.querySelector('img[src$="tutorial-npc.png"]')).toBeInTheDocument();
  });
  it('a new message restarts its own reveal and cancels old timers on unmount', () => {
    vi.useFakeTimers();
    const props = { title: 'Sight', actionLabel: 'Continue', onAction: vi.fn(), onExit: vi.fn(), exitLabel: 'Leave', progress: 2 };
    const view = render(<SchoolCoach {...props} text="First message" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    view.rerender(<SchoolCoach {...props} text="Second message" />);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  /** Owner 2026-11-06: the starter tutorial cannot be left; it counts its own chapters. */
  it('offers no way out when none is given, and counts the chapters it is given', () => {
    render(<SchoolCoach title="Repairs" text="Hi" progress={2} total={5} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(document.querySelector('.school-exit')).toBeNull();
  });
});
