import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectState } from '../../src/lib/collect.js';
import { TopBar, type TopBarProps } from '../../src/v2/hud/TopBar.js';

/**
 * THE TOP BAR, ON THE GAME KIT (G1-b, 2026-11-14). Spec B1 (docs/ui-v2/gozlemevi.md).
 *
 * Three resource pills and the commander's medallion. Each pill is the store's figure, its bar with the
 * share a raid cannot take, and what waits for it in the works (owner, 2026-09-25: the
 * works on the top bar, at a glance) — and the pill is the one press that deals with it:
 * it collects while something waits that the store can take, and otherwise opens the
 * economy, where the store is raised.
 */

const caps = { alloy: 1_000, crystal: 1_000, deuterium: 500 };
const bigStore = { alloy: 50_000, crystal: 50_000, deuterium: 50_000 };
const empty = { alloy: 0, crystal: 0, deuterium: 0 };

const works = (
  vessels: { alloy: number; crystal: number; deuterium: number },
  over: Partial<NonNullable<TopBarProps['works']>> = {},
  store = empty,
  storeCaps = bigStore,
): NonNullable<TopBarProps['works']> => ({
  state: collectState({ caps, works: vessels, store, storeCaps }),
  pending: false,
  onCollect: vi.fn(),
  ...over,
});

const props = (over: Partial<TopBarProps> = {}): TopBarProps => ({
  stock: {
    alloy: { value: 12_400, cap: 20_000 },
    crystal: { value: 3_105, cap: 8_000 },
    deuterium: { value: 860, cap: 4_000 },
  },
  commander: { initials: 'YI', name: 'Yildirim' },
  onResource: vi.fn(),
  onCommander: vi.fn(),
  ...over,
});

const pool = (resource: string) => document.querySelector(`[data-pill="${resource}"] [data-pool]`);

beforeEach(() => { window.localStorage.removeItem('astera:works-tip-v1'); });

describe('the top bar', () => {
  it('reads three resources against their stores, each one press', () => {
    render(<TopBar {...props()} />);
    expect(screen.getByRole('button', { name: 'Alloy: 12,400 of 20,000' })).toHaveTextContent('12,400');
    expect(screen.getByRole('button', { name: 'Crystal: 3,105 of 8,000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deuterium: 860 of 4,000' })).toBeInTheDocument();
  });

  it('never paints a full store in the colour of harm', () => {
    const { container } = render(<TopBar {...props({ stock: { ...props().stock, alloy: { value: 20_000, cap: 20_000 } } })} />);
    expect(screen.getByRole('button', { name: /^Alloy: 20,000 of 20,000, store full/ })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/hostile|threat/);
  });

  it('opens the economy from a pill while nothing waits to be collected', async () => {
    const all = props({ works: works(empty) });
    render(<TopBar {...all} />);
    await userEvent.click(screen.getByRole('button', { name: /^Crystal/ }));
    expect(all.onResource).toHaveBeenCalledWith('crystal');
  });

  it('says under each store what waits for it in the works, green once it is worth a press', () => {
    const { rerender } = render(<TopBar {...props({ works: works({ alloy: 400, crystal: 30, deuterium: 0 }) })} />);
    expect(pool('alloy')).toHaveTextContent('+400');
    expect(pool('alloy')).toHaveAttribute('data-tone', 'good');
    expect(pool('deuterium')).toHaveTextContent('+0');
    expect(pool('deuterium')).toHaveAttribute('data-tone', 'quiet');
    rerender(<TopBar {...props({ works: works({ alloy: 20, crystal: 0, deuterium: 0 }) })} />);
    expect(pool('alloy')).toHaveAttribute('data-tone', 'quiet');
  });

  it('collects all of it in one press from any store, and says so in the name', async () => {
    const all = props({ works: works({ alloy: 400, crystal: 30, deuterium: 0 }) });
    render(<TopBar {...all} />);
    await userEvent.click(screen.getByRole('button', { name: 'Crystal: 3,105 of 8,000 · 30 in the Works · Collect' }));
    expect(all.works?.onCollect).toHaveBeenCalledTimes(1);
    expect(all.onResource).not.toHaveBeenCalled();
  });

  it('breathes while a collection is worth it, on the stores that have something waiting', () => {
    const { container } = render(<TopBar {...props({ works: works({ alloy: 400, crystal: 0, deuterium: 0 }) })} />);
    expect(container.querySelector('[data-pill="alloy"]')).toHaveAttribute('data-ripe');
    expect(container.querySelector('[data-pill="crystal"]')).not.toHaveAttribute('data-ripe');
  });

  it('marks a full vessel in yellow and says its production stopped', () => {
    render(<TopBar {...props({ works: works({ alloy: 1_000, crystal: 30, deuterium: 0 }) })} />);
    expect(pool('alloy')).toHaveAttribute('data-tone', 'warn');
    expect(pool('crystal')).not.toHaveAttribute('data-tone', 'warn');
    expect(screen.getByRole('button', { name: /^Alloy: .* · Full — production stopped · Collect$/ })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/hostile|threat/);
  });

  it('holds while a collect is in flight', async () => {
    const all = props({ works: works({ alloy: 400, crystal: 0, deuterium: 0 }, { pending: true }) });
    render(<TopBar {...all} />);
    await userEvent.click(screen.getByRole('button', { name: /^Alloy/ }));
    expect(all.works?.onCollect).not.toHaveBeenCalled();
    expect(all.onResource).not.toHaveBeenCalled();
  });

  it('says a store with no room before the press, and opens the economy to raise it', async () => {
    const full = { alloy: 2_000, crystal: 600, deuterium: 300 };
    const all = props({ works: works({ alloy: 400, crystal: 0, deuterium: 0 }, {}, full, full) });
    render(<TopBar {...all} />);
    expect(pool('alloy')).toHaveAttribute('data-tone', 'warn');
    await userEvent.click(screen.getByRole('button', { name: /^Alloy: .* · 400 in the Works · Store full$/ }));
    expect(all.onResource).toHaveBeenCalledWith('alloy');
    expect(all.works?.onCollect).not.toHaveBeenCalled();
  });

  it('marks on each bar the share a raid cannot take', () => {
    const { container } = render(<TopBar {...props({ stock: { ...props().stock, alloy: { value: 12_400, cap: 20_000, safe: 5_000 } } })} />);
    expect(container.querySelector<HTMLElement>('[data-pill="alloy"] [data-safe]')?.style.left).toBe('25%');
  });

  it('keeps the place of a store not in use yet, so the others never move', () => {
    const { container } = render(<TopBar {...props()} hidden={['deuterium']} />);
    expect(screen.queryByRole('button', { name: /^Deuterium/ })).toBeNull();
    expect(container.querySelectorAll('.gk-res')).toHaveLength(3);
  });

  it('flies a collection into the stores it filled', () => {
    const { container } = render(<TopBar {...props({ transfer: { id: 1, each: { alloy: { from: 100, to: 500 }, crystal: { from: 50, to: 50 }, deuterium: { from: 0, to: 0 } } } })} />);
    expect(container.querySelectorAll('[data-pill="alloy"] [data-collect-particle]')).toHaveLength(3);
    expect(container.querySelector('[data-pill="crystal"] [data-collect-particle]')).toBeNull();
  });

  /** Owner 2026-11-14: the menu takes the bell's old place at the end of the bar; the bell went to the galaxy, beside the chat. */
  it('ends with the commander’s medallion, which opens the menu', async () => {
    const all = props();
    render(<TopBar {...all} />);
    const medal = screen.getByRole('button', { name: /^Commander Yildirim/ });
    expect(medal).toHaveTextContent('YI');
    expect(medal.closest('header')?.lastElementChild).toBe(medal);
    await userEvent.click(medal);
    expect(all.onCommander).toHaveBeenCalledTimes(1);
  });

  it('carries no bell: the bell sits on the galaxy, beside the chat', () => {
    render(<TopBar {...props()} />);
    expect(screen.queryByRole('button', { name: /^Signals/ })).toBeNull();
  });

  it('teaches the press once, the first time production appears, without covering what is under it', async () => {
    const first = render(<TopBar {...props({ works: works(empty) })} />);
    expect(screen.queryByRole('note')).toBeNull();
    first.rerender(<TopBar {...props({ works: works({ alloy: 4, crystal: 0, deuterium: 0 }) })} />);
    expect(screen.getByRole('note')).toHaveTextContent(/tap a resource/i);
    expect(window.localStorage.getItem('astera:works-tip-v1')).toBe('seen');
    await userEvent.click(screen.getByRole('button', { name: /^Crystal/ }));
    expect(screen.queryByRole('note')).toBeNull();
    first.unmount();
    render(<TopBar {...props({ works: works({ alloy: 4, crystal: 0, deuterium: 0 }) })} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('leaves the lesson to the ship while the ship is still opening resources', () => {
    render(<TopBar {...props({ works: works({ alloy: 400, crystal: 0, deuterium: 0 }) })} hidden={['deuterium']} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('keeps the works mark inside the header, where the flight school points', () => {
    const { container } = render(<TopBar {...props({ works: works(empty) })} />);
    const mark = container.querySelector('[data-works-line]');
    expect(mark?.closest('header')).not.toBeNull();
    expect(mark).toHaveAttribute('data-guide', 'works');
  });

  it('seats the desk tabs between the stores and the medallion', () => {
    render(<TopBar {...props()} tabs={<nav aria-label="Tabs" />} />);
    const tabs = screen.getByRole('navigation', { name: 'Tabs' });
    expect(tabs.compareDocumentPosition(screen.getByRole('button', { name: /^Commander Yildirim/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
