import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { compact } from '../../src/lib/format.js';
import { rulerTop } from '../../src/lib/ruler.js';
import { ForceRuler } from '../../src/v2/kit/ForceRuler.js';

/**
 * THE FORCE RULER. Spec B5 (docs/ui-v2/gozlemevi.md), the visual evolution of
 * `ui/ForceCompare.tsx`: the same inputs (`forecastLines`, `escapeLine`,
 * `escapeVerdict` are computed by the launch sheet), drawn as two strips on one
 * axis — the wing, solid in the player's teal, and the probe's defence band,
 * hatched — with three marks on the defence strip: where their ships run, where
 * this wing surely clears, where it at least breaks. It never names a winner.
 */

const reading = { low: 4_000, high: 9_000, source: 'Probe', ageMinutes: 12 };
const lines = { clears: { low: 20_000, high: 30_000 }, breaks: { low: 35_000, high: 45_000 } };

const part = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-part="${name}"]`);
  if (!el) throw new Error(`no ${name}`);
  return el;
};
const pct = (value: string): number => Number.parseFloat(value);

describe('the axis', () => {
  it('ends past the largest thing on it, rounded to two figures', () => {
    expect(rulerTop(8_240, 13_900, 12_000)).toBe(16_000);
    expect(rulerTop(40_000, 13_900, 45_000)).toBe(52_000);
    expect(rulerTop(8_240)).toBe(9_500);
  });

  it('is zero when there is nothing to draw', () => {
    expect(rulerTop(0, 0, 0)).toBe(0);
  });
});

describe('the two strips', () => {
  // max(30k, 9k, 45k) × 1.15 = 51,750 → 52,000
  const TOP = 52_000;

  it('puts the wing and the defence band on the same axis', () => {
    const { container } = render(<ForceRuler yours={30_000} theirs={reading} lines={lines} />);
    expect(pct(part(container, 'yours').style.width)).toBeCloseTo((30_000 / TOP) * 100, 4);
    expect(pct(part(container, 'band').style.left)).toBeCloseTo((4_000 / TOP) * 100, 4);
    expect(pct(part(container, 'band').style.width)).toBeCloseTo((5_000 / TOP) * 100, 4);
  });

  it('marks where the wing clears and where it breaks, as the ranges the forecast gave', () => {
    const { container } = render(<ForceRuler yours={30_000} theirs={reading} lines={lines} />);
    expect(pct(part(container, 'clears').style.left)).toBeCloseTo((20_000 / TOP) * 100, 4);
    expect(pct(part(container, 'clears').style.width)).toBeCloseTo((10_000 / TOP) * 100, 4);
    expect(pct(part(container, 'breaks').style.left)).toBeCloseTo((35_000 / TOP) * 100, 4);
    expect(screen.getByText(`Full-success limit: ${compact(20_000)}–${compact(30_000)}`)).toBeInTheDocument();
    expect(screen.getByText(`partial-success limit: ${compact(35_000)}–${compact(45_000)}`)).toBeInTheDocument();
  });

  it('marks where their ships run and says what the reading implies', () => {
    const { container } = render(
      <ForceRuler yours={30_000} theirs={reading} lines={lines} escape={{ at: 10_000, verdict: 'RUN' }} />,
    );
    expect(pct(part(container, 'escape-line').style.left)).toBeCloseTo((10_000 / TOP) * 100, 4);
    expect(screen.getByText(`Their ships run under ${compact(10_000)}`)).toBeInTheDocument();
    expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(/lift off/i);
  });

  it('says they stand, or that it is open, in the same place', () => {
    const { rerender } = render(
      <ForceRuler yours={30_000} theirs={reading} lines={lines} escape={{ at: 10_000, verdict: 'STAND' }} />,
    );
    expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(/stand and fight/i);
    rerender(<ForceRuler yours={30_000} theirs={reading} lines={lines} escape={{ at: 10_000, verdict: 'UNSURE' }} />);
    expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(/may lift off/i);
  });

  it('draws no escape line and no verdict where the rule does not apply', () => {
    const { container } = render(<ForceRuler yours={30_000} theirs={reading} lines={lines} />);
    expect(container.querySelector('[data-part="escape-line"]')).toBeNull();
    expect(screen.queryByTestId('ruler-verdict')).toBeNull();
    expect(screen.queryByText(/Their ships run under/)).toBeNull();
  });

  it('draws no marks for a wing with nothing selected', () => {
    const { container } = render(<ForceRuler yours={0} theirs={reading} />);
    expect(container.querySelector('[data-part="clears"]')).toBeNull();
    expect(pct(part(container, 'yours').style.width)).toBe(0);
  });

  it('survives an empty picture without dividing by zero', () => {
    const { container } = render(<ForceRuler yours={0} theirs={{ ...reading, low: 0, high: 0 }} />);
    expect(part(container, 'yours').style.width).toBe('0%');
    expect(part(container, 'band').style.width).toBe('0%');
  });
});

describe('a defence nobody measured', () => {
  it('draws no defence strip and says so, with a probe to close the gap', async () => {
    const onProbe = vi.fn();
    const { container } = render(<ForceRuler yours={30_000} theirs={null} lines={lines} onProbe={onProbe} />);
    expect(container.querySelector('[data-part="band"]')).toBeNull();
    expect(container.querySelector('[data-part="clears"]')).toBeNull();
    expect(screen.getByText('No probe: their defence is unknown')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send a probe' }));
    expect(onProbe).toHaveBeenCalledTimes(1);
  });

  it('still says what this wing can take', () => {
    render(<ForceRuler yours={30_000} theirs={null} lines={lines} />);
    expect(screen.getByText(`Full-success limit: ${compact(20_000)}–${compact(30_000)}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a probe' })).toBeNull();
  });
});

describe('what it says about the reading', () => {
  it('stamps the defence with where it came from and how old it is', () => {
    const { rerender } = render(<ForceRuler yours={30_000} theirs={reading} />);
    expect(screen.getByText('Probe, 12m ago')).toBeInTheDocument();
    rerender(<ForceRuler yours={30_000} theirs={{ ...reading, ageMinutes: null }} />);
    expect(screen.getByText('Probe, read now')).toBeInTheDocument();
  });

  it('never names a winner', () => {
    const { container } = render(
      <ForceRuler
        yours={30_000}
        theirs={reading}
        lines={lines}
        loss={{ low: 0.35, high: 0.6 }}
        escape={{ at: 10_000, verdict: 'RUN' }}
      />,
    );
    expect(container.textContent).not.toMatch(/you will win|you will lose|likely victory|\d+% chance/i);
    expect(screen.getByTestId('ruler-loss')).toHaveTextContent(/35–60%/);
    expect(container.textContent).toMatch(/not a chance of winning/i);
  });

  it('keeps the rule one tap deep', () => {
    render(<ForceRuler yours={30_000} theirs={reading} lines={lines} escape={{ at: 10_000, verdict: null }} />);
    expect(screen.getByText(/Resource cost, not attack damage/)).toBeVisible();
    const toggle = screen.getByRole('button', { name: /what is this/i });
    expect(screen.queryByTestId('ruler-rule')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('ruler-rule')).toHaveTextContent(/firing ships and ground guns/i);
    expect(screen.getByTestId('ruler-rule')).toHaveTextContent(/three times/i);
  });

  it('says what the lines could not see', () => {
    render(<ForceRuler yours={30_000} theirs={reading} lines={lines} notes={['Shield unknown', 'Probe was seen']} />);
    expect(screen.getByText('Shield unknown · Probe was seen')).toBeInTheDocument();
  });
});
