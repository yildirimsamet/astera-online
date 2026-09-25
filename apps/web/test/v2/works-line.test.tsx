import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { collectState } from '../../src/lib/collect.js';
import { WorksLine, type WorksLineProps } from '../../src/v2/hud/WorksLine.js';

/**
 * THE WORKS, ON THE TOP BAR (owner, 2026-09-25: "Works/Havuz section -> top status bar'a
 * taşınmalı. Kullanıcı tek bakışta görebilmeli ... en minimum şekilde büyütmeliyiz").
 *
 * One line under the three stores, each resource's waiting amount under its own store —
 * turquoise once it is worth a tap, yellow where a vessel is full and that resource has
 * stopped — and the whole line is the one press that collects. A store that can take none
 * of it is said before the press, and the press opens the base where the Vault is raised.
 */

const caps = { alloy: 1_000, crystal: 1_000, deuterium: 500 };
const bigStore = { alloy: 50_000, crystal: 50_000, deuterium: 50_000 };

const props = (
  works: { alloy: number; crystal: number; deuterium: number },
  over: Partial<WorksLineProps> = {},
  store = { alloy: 0, crystal: 0, deuterium: 0 },
  storeCaps = bigStore,
): WorksLineProps => ({
  state: collectState({ caps, works, store, storeCaps }),
  fullInMinutes: 120,
  pending: false,
  onCollect: vi.fn(),
  onOpenBase: vi.fn(),
  ...over,
});

const cell = (resource: string) => document.querySelector<HTMLElement>(`[data-works-resource="${resource}"]`);

describe('the works line', () => {
  it('shows what waits in each vessel under its own store, and nothing for an empty one', () => {
    render(<WorksLine {...props({ alloy: 400, crystal: 30, deuterium: 0 })} />);
    expect(cell('alloy')).toHaveTextContent('400');
    expect(cell('crystal')).toHaveTextContent('30');
    expect(cell('deuterium')).toHaveTextContent('');
  });

  it('is one press that collects all of it, and names what it holds', async () => {
    const all = props({ alloy: 400, crystal: 30, deuterium: 0 });
    render(<WorksLine {...all} />);
    const line = screen.getByRole('button', { name: /^Works · 400 alloy, 30 crystal · full in 2h 00m · Collect$/ });
    await userEvent.click(line);
    expect(all.onCollect).toHaveBeenCalledTimes(1);
  });

  it('wears turquoise once the works are worth a tap, and stays quiet before', () => {
    const { rerender } = render(<WorksLine {...props({ alloy: 20, crystal: 0, deuterium: 0 })} />);
    expect(cell('alloy')?.className).not.toMatch(/text-v2-self/);
    rerender(<WorksLine {...props({ alloy: 400, crystal: 0, deuterium: 0 })} />);
    expect(cell('alloy')?.className).toMatch(/text-v2-self/);
  });

  it('marks a full vessel in yellow, says production stopped, and beats', () => {
    render(<WorksLine {...props({ alloy: 1_000, crystal: 30, deuterium: 0 })} />);
    expect(cell('alloy')?.className).toMatch(/text-v2-warn/);
    expect(cell('crystal')?.className).not.toMatch(/text-v2-warn/);
    const line = screen.getByRole('button', { name: /Full — production stopped/ });
    expect(line.className).toMatch(/animate-pulse/);
    expect(document.body.innerHTML).not.toMatch(/hostile|threat/);
  });

  it('holds while a collect is in flight', () => {
    render(<WorksLine {...props({ alloy: 400, crystal: 0, deuterium: 0 }, { pending: true })} />);
    expect(screen.getByRole('button', { name: /^Works/ })).toBeDisabled();
  });

  it('offers nothing to collect while the works are empty, and keeps its height', () => {
    const { container } = render(<WorksLine {...props({ alloy: 0, crystal: 0, deuterium: 0 }, { fullInMinutes: null })} />);
    const line = screen.getByRole('button', { name: /^Works · Production gathers here until you collect it$/ });
    expect(line).toBeDisabled();
    expect(container.querySelectorAll('[data-works-resource]')).toHaveLength(3);
  });

  it('says a full store before the press, and opens the base to raise it', async () => {
    const all = props(
      { alloy: 400, crystal: 0, deuterium: 0 },
      {},
      { alloy: 2_000, crystal: 600, deuterium: 300 },
      { alloy: 2_000, crystal: 600, deuterium: 300 },
    );
    render(<WorksLine {...all} />);
    expect(cell('alloy')?.className).toMatch(/text-v2-warn/);
    await userEvent.click(screen.getByRole('button', { name: /Store full$/ }));
    expect(all.onOpenBase).toHaveBeenCalledTimes(1);
    expect(all.onCollect).not.toHaveBeenCalled();
  });
});
