import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ESCAPE, combatOutcomeTable } from '@astera/rules';
import i18n from '../../src/i18n/index.js';
import { compact } from '../../src/lib/format.js';
import { ratioAt } from '../../src/lib/ruler.js';
import { ForceRuler } from '../../src/v2/kit/ForceRuler.js';

/**
 * THE FORCE RULER, COMBAT v3 (owner 2026-10-25). Spec B5 (docs/ui-v2/gozlemevi.md).
 *
 * Each side's matchup power against the other as the probe allows it — a range, never one
 * guessed figure — and their ratio on one strip, with even and the 3× fleet escape marked.
 * It gives the inputs and the rule (the owner's outcome table, one tap deep) and never the
 * answer: no winner, no chance, no expected loss.
 */

const stamp = { source: 'Probe', ageMinutes: 12 };
const power = (mine: [number, number], theirs: [number, number], ratio: [number, number]) => ({
  mine: { low: mine[0], high: mine[1] },
  theirs: { low: theirs[0], high: theirs[1] },
  ratio: { low: ratio[0], high: ratio[1] },
});
const ahead = power([30_000, 32_000], [18_000, 27_000], [1.12, 1.74]);

const part = (container: HTMLElement, name: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-part="${name}"]`);
  if (!el) throw new Error(`no ${name}`);
  return el;
};
const pct = (value: string): number => Number.parseFloat(value);

describe('the ratio axis', () => {
  it('is logarithmic from a quarter to four times, with even in the middle', () => {
    expect(ratioAt(1)).toBeCloseTo(50, 9);
    expect(ratioAt(4)).toBeCloseTo(100, 9);
    expect(ratioAt(0.25)).toBeCloseTo(0, 9);
    expect(ratioAt(2)).toBeCloseTo(75, 9);
    expect(ratioAt(0.5)).toBeCloseTo(25, 9);
  });

  it('pins what runs off either end to that end', () => {
    expect(ratioAt(40)).toBe(100);
    expect(ratioAt(Infinity)).toBe(100);
    expect(ratioAt(0.01)).toBe(0);
    expect(ratioAt(0)).toBe(0);
  });
});

describe('the two powers and their ratio', () => {
  it('states both powers as the ranges the reading allows', () => {
    render(<ForceRuler power={ahead} theirs={stamp} />);
    expect(screen.getByTestId('ruler-mine')).toHaveTextContent(`${compact(30_000)}–${compact(32_000)}`);
    expect(screen.getByTestId('ruler-theirs')).toHaveTextContent(`${compact(18_000)}–${compact(27_000)}`);
  });

  it('draws the ratio as a band on the strip, with even marked', () => {
    const { container } = render(<ForceRuler power={ahead} theirs={stamp} />);
    expect(pct(part(container, 'ratio-band').style.left)).toBeCloseTo(ratioAt(1.12), 4);
    expect(pct(part(container, 'ratio-band').style.width)).toBeCloseTo(ratioAt(1.74) - ratioAt(1.12), 4);
    expect(pct(part(container, 'even').style.left)).toBeCloseTo(50, 9);
  });

  it('says who is stronger and by how much, in one sentence', () => {
    const { rerender } = render(<ForceRuler power={ahead} theirs={stamp} />);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent('You are 1.1–1.7× as strong');
    rerender(<ForceRuler power={power([10_000, 11_000], [20_000, 26_000], [0.4, 0.5])} theirs={stamp} />);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent('They are 2.0–2.5× as strong');
    rerender(<ForceRuler power={power([10_000, 11_000], [9_000, 13_000], [0.8, 1.2])} theirs={stamp} />);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent(/not settle who is stronger/i);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent('1.3×');
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent('1.2×');
  });

  it('calls a band that rounds to one about even', () => {
    render(<ForceRuler power={power([10_000, 10_000], [10_000, 10_100], [0.99, 1.01])} theirs={stamp} />);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent('About even');
  });

  it('says plainly when nothing there fires back, and when the wing has nothing that fires', () => {
    const { rerender } = render(<ForceRuler power={power([5_000, 5_000], [0, 0], [Infinity, Infinity])} theirs={stamp} />);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent(/nothing there fires back/i);
    rerender(<ForceRuler power={power([0, 0], [4_000, 6_000], [0, 0])} theirs={stamp} />);
    expect(screen.getByTestId('ruler-ratio')).toHaveTextContent(/your wing has nothing that fires/i);
  });

  it('asks for ships before it weighs anything', () => {
    const { container } = render(<ForceRuler power={null} theirs={stamp} />);
    expect(screen.getByTestId('ruler-pick')).toBeInTheDocument();
    expect(container.querySelector('[data-part="ratio-band"]')).toBeNull();
    expect(screen.queryByTestId('ruler-ratio')).toBeNull();
  });
});

describe('the fleet escape on the strip', () => {
  it('marks the escape ratio and says what the reading implies', () => {
    const { container } = render(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict: 'STAND' }} />);
    expect(pct(part(container, 'escape').style.left)).toBeCloseTo(ratioAt(ESCAPE.ratio), 4);
    expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(/stand and fight/i);
  });

  it('says they lift off, or that it is open, in the same place', () => {
    const { rerender } = render(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict: 'RUN' }} />);
    expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(/lift off/i);
    rerender(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict: 'UNSURE' }} />);
    expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(/may lift off/i);
  });

  it('draws no escape mark and no verdict where the rule does not apply', () => {
    const { container } = render(<ForceRuler power={ahead} theirs={stamp} />);
    expect(container.querySelector('[data-part="escape"]')).toBeNull();
    expect(screen.queryByTestId('ruler-verdict')).toBeNull();
  });
});

describe('a defence nobody measured', () => {
  it('states the wing alone and offers the probe that closes the gap', async () => {
    const onProbe = vi.fn();
    const { container } = render(
      <ForceRuler power={power([30_000, 30_000], [0, 0], [Infinity, Infinity])} theirs={null} onProbe={onProbe} />,
    );
    expect(screen.getByTestId('ruler-mine')).toHaveTextContent(compact(30_000));
    expect(container.querySelector('[data-part="ratio-band"]')).toBeNull();
    expect(screen.queryByTestId('ruler-ratio')).toBeNull();
    expect(screen.getByText('No probe: their defence is unknown')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send a probe' }));
    expect(onProbe).toHaveBeenCalledTimes(1);
  });
});

describe('what it says about the reading', () => {
  it('stamps their power with where it came from and how old it is', () => {
    const { rerender } = render(<ForceRuler power={ahead} theirs={stamp} />);
    expect(screen.getByText('Probe, 12m ago')).toBeInTheDocument();
    rerender(<ForceRuler power={ahead} theirs={{ ...stamp, ageMinutes: null }} />);
    expect(screen.getByText('Probe, read now')).toBeInTheDocument();
  });

  it('never names a winner, a chance or an expected loss', () => {
    const { container } = render(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict: 'RUN' }} />);
    expect(container.textContent).not.toMatch(/you will win|you will lose|victory|\d+% chance|estimated loss/i);
  });

  it('names the wing as the surface weighing it does', () => {
    const { rerender } = render(<ForceRuler power={ahead} theirs={stamp} />);
    expect(screen.getByText('Sending')).toBeInTheDocument();
    rerender(<ForceRuler power={ahead} theirs={stamp} yoursLabel="Your wing at home" />);
    expect(screen.getByText('Your wing at home')).toBeInTheDocument();
    expect(screen.queryByText('Sending')).toBeNull();
  });

  it('says what the reading could not see', () => {
    render(<ForceRuler power={ahead} theirs={stamp} notes={['Shield unknown', 'Probe was seen']} />);
    expect(screen.getByText('Shield unknown · Probe was seen')).toBeInTheDocument();
  });
});

describe('the rule, one tap deep', () => {
  it('says what power counts and lays out the owner’s outcome table', () => {
    render(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict: null, minimumCombatShips: 5 }} />);
    expect(screen.queryByTestId('ruler-rule')).toBeNull();
    const toggle = screen.getByRole('button', { name: /what is this/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const rule = screen.getByTestId('ruler-rule');
    expect(rule).toHaveTextContent(/counter/i);
    expect(rule).toHaveTextContent(/research/i);
    expect(rule).toHaveTextContent(/worst case/i);
    const rows = rule.querySelectorAll('[data-outcome-row]');
    expect(rows).toHaveLength(combatOutcomeTable().length);
    expect(rows[0]).toHaveTextContent('1:1');
    expect(rows[0]).toHaveTextContent('10–25%');
    expect(rows[5]).toHaveTextContent('1:2');
    expect(rows[5]).toHaveTextContent('50%');
    expect(rows[5]).toHaveTextContent('13%');
    expect(rule).toHaveTextContent(/5 fighting ships/i);
    expect(rule).not.toHaveTextContent('{{');
  });

  it('takes the heading of the page it sits in, and folds its meaning under the rule', () => {
    render(<ForceRuler power={ahead} theirs={stamp} heading="Power" />);
    expect(screen.getByText('Power')).toBeInTheDocument();
    expect(screen.queryByTestId('ruler-meaning')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /what is this/i }));
    expect(screen.getByTestId('ruler-rule')).toHaveTextContent(/firepower and durability/i);
  });

  it.each([
    ['en', '3.0'], ['tr', '3,0'], ['de', '3,0'], ['fr', '3,0'], ['es', '3,0'], ['ja', '3.0'],
  ] as const)('resolves every phrase and the escape ratio in %s', async (language, ratio) => {
    await i18n.changeLanguage(language);
    try {
      const { rerender } = render(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict: 'RUN' }} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByTestId('ruler-rule')).toHaveTextContent(ratio);
      expect(screen.getByTestId('ruler-verdict')).toHaveTextContent(ratio);
      for (const verdict of ['STAND', 'UNSURE'] as const) {
        rerender(<ForceRuler power={ahead} theirs={stamp} escape={{ verdict }} />);
        expect(screen.getByTestId('ruler-verdict')).not.toHaveTextContent('{{');
      }
      for (const p of [ahead, power([1, 1], [2, 3], [0.4, 0.5]), power([1, 1], [1, 1], [0.8, 1.2]), power([1, 1], [0, 0], [Infinity, Infinity])]) {
        rerender(<ForceRuler power={p} theirs={stamp} escape={{ verdict: 'RUN' }} />);
        expect(screen.getByTestId('ruler-ratio').textContent).not.toMatch(/\{\{|counter\./);
      }
      expect(document.body.textContent).not.toMatch(/\{\{|counter\.|ruler\./);
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});
