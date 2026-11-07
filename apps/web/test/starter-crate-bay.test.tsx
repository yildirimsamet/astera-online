import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrateBay, type CrateBayCrate } from '../src/starter/CrateBay.js';

const heard = vi.hoisted((): string[] => []);
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<object>(), playSound: (cue: string) => { heard.push(cue); } }));

afterEach(() => { cleanup(); vi.useRealTimers(); heard.length = 0; });

const crate = (id: string, state: CrateBayCrate['state'], alloy = 300, crystal = 150): CrateBayCrate =>
  ({ id, module: 'SURVEY', stage: 1, alloy, crystal, state });

/** KURTARMA KASALARI (retention plan §6.2): lift the lid of a crate a repair freed, and its purse pours out. */
describe('the crate bay', () => {
  it('stays out of the way until a crate is ready', () => {
    render(<CrateBay crates={[crate('A', 'sealed'), crate('B', 'opened')]} onOpen={vi.fn()} />);
    expect(document.querySelector('[data-guide="crate"]')).toBeNull();
  });

  it('shows the ready crates and what they hold together', () => {
    render(<CrateBay crates={[crate('A', 'ready', 150, 40), crate('B', 'ready', 300, 150), crate('C', 'sealed')]} onOpen={vi.fn()} />);
    const bay = document.querySelector('[data-guide="crate"]');
    expect(bay).not.toBeNull();
    expect(bay?.textContent).toMatch(/450/);
    expect(bay?.textContent).toMatch(/190/);
  });

  it('opens on a held press, not on a tap', () => {
    vi.useFakeTimers();
    const onOpen = vi.fn();
    render(<CrateBay crates={[crate('A', 'ready')]} onOpen={onOpen} />);
    const lid = document.querySelector('[data-guide="crate"]')!;
    fireEvent.pointerDown(lid);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(lid);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.pointerDown(lid);
    act(() => { vi.advanceTimersByTime(700); });
    expect(onOpen).toHaveBeenCalledOnce();
    expect(heard).toContain('crate');
  });

  it('opens from the keyboard at once', () => {
    const onOpen = vi.fn();
    render(<CrateBay crates={[crate('A', 'ready')]} onOpen={onOpen} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('pours out what it held once it is open', () => {
    vi.useFakeTimers();
    const { rerender } = render(<CrateBay crates={[crate('A', 'ready', 300, 150)]} onOpen={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    rerender(<CrateBay crates={[crate('A', 'opened', 300, 150)]} onOpen={vi.fn()} />);
    const purse = document.querySelector('[data-crate-purse]');
    expect(purse?.textContent).toMatch(/\+300/);
    expect(purse?.textContent).toMatch(/\+150/);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(document.querySelector('[data-crate-purse]')).toBeNull();
  });
});
