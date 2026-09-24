import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NeedBar } from '../../src/v2/kit/NeedBar.js';

/**
 * HOW CLOSE A PRICE IS, drawn against what you hold. D1 (owner, 2026-09-24): no white
 * or grey bars — the part you have wears the resource's own colour, the part you are
 * missing is a gap you can close (warn), never a threat (red).
 */
describe('the need bar', () => {
  it('reads what you have, what it takes, and what is missing', () => {
    render(<NeedBar resource="alloy" have={477} need={1000} />);
    const bar = screen.getByRole('img', { name: /alloy/i });
    expect(bar).toHaveAccessibleName(/477.*1,000.*523/);
    expect(screen.getByText(/523/)).toHaveClass('text-v2-warn');
  });

  it('fills the held share in the resource colour and the gap in warn', () => {
    render(<NeedBar resource="crystal" have={175} need={500} />);
    const have = document.querySelector<HTMLElement>('[data-have]')!;
    const gap = document.querySelector<HTMLElement>('[data-gap]')!;
    expect(have.style.width).toBe('35%');
    expect(have).toHaveClass('bg-v2-crystal');
    expect(gap.style.width).toBe('65%');
    expect(gap.className).not.toMatch(/hostile|ink|line/);
  });

  it('draws a met price as a full bar with nothing missing', () => {
    render(<NeedBar resource="alloy" have={2000} need={1000} />);
    expect(document.querySelector<HTMLElement>('[data-have]')!.style.width).toBe('100%');
    expect(document.querySelector('[data-gap]')).toBeNull();
  });

  it('never divides by a zero price', () => {
    render(<NeedBar resource="deuterium" have={0} need={0} />);
    expect(document.querySelector<HTMLElement>('[data-have]')!.style.width).toBe('100%');
  });
});
