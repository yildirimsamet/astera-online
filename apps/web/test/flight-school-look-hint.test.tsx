import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SchoolLookHint } from '../src/onboarding/flightSchool/SchoolLookHint.js';
afterEach(() => { vi.useRealTimers(); });
it('briefly teaches turning the view and then removes the arrows', () => {
  vi.useFakeTimers();
  render(<SchoolLookHint label="Drag to turn the view" />);
  expect(screen.queryByText('Drag to turn the view')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1500); });
  expect(screen.getByText('Drag to turn the view')).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(5500); });
  expect(screen.queryByText('Drag to turn the view')).not.toBeInTheDocument();
});
it('removes the hint after the player drags the actual galaxy', () => {
  vi.useFakeTimers();
  render(<><canvas data-testid="galaxy" /><SchoolLookHint label="Drag to turn the view" /></>);
  act(() => { vi.advanceTimersByTime(1500); });
  const canvas = screen.getByTestId('galaxy');
  fireEvent(canvas, new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
  fireEvent(canvas, new MouseEvent('pointermove', { bubbles: true, clientX: 140, clientY: 100 }));
  expect(screen.queryByText('Drag to turn the view')).not.toBeInTheDocument();
});
