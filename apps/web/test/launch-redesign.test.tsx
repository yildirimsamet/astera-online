import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MISSION_PACES } from '@astera/rules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { UnitCard } from '../src/game-ui/index.js';
import i18n from '../src/i18n/index.js';
import { durationPrecise } from '../src/lib/time.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { PaceRow } from '../src/ui/PaceRow.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * THE ATTACK SHEET, REBUILT (owner, 2026-11-16): "Bizde bu gemilerin üzerine basılı tutmalı
 * kartları vardı? … hız göstergesini progress bar gibi tasarla … sağa doğru roket, sola doğru
 * solucan". The ships are the kit's cards — tap the ship for one, hold it for many, type the
 * count, Max for all; the speed is one throttle bar from a worm to a rocket, cold to flame;
 * the price is one line with its rules behind an ⓘ.
 */

const target: GalaxyPlanet = {
  id: 'p2', name: 'Tharsis', owner: 'Sable', position: { x: 120, y: 0, z: 80 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
};

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
};

const open = (fleet: Record<string, number> = { DART: 6, COURIER: 2 }) => render(
  <LaunchSheet target={{ kind: 'world', world: target }} planet={planetView({ fleet }, { deuterium: 50_000 })}
    onClose={vi.fn()} onLaunched={vi.fn()} />, { wrapper },
);

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { vi.useRealTimers(); });

describe('the ships are hold-press cards', () => {
  it('lays every ship at home out as a kit card in a two-up grid', () => {
    open();
    const grid = document.querySelector<HTMLElement>('[data-launch-fleet] .gk-unitgrid')!;
    expect(grid).not.toBeNull();
    const dart = within(grid).getByText('Dart').closest<HTMLElement>('[data-hull-row]')!;
    expect(dart).toHaveAttribute('data-hull-row', 'DART');
    expect(dart).toHaveClass('gk-unit');
    expect(dart).toHaveTextContent('6 home');
  });

  it('adds one on a tap of the ship, takes one back on the minus, and types an exact count', async () => {
    open();
    const user = userEvent.setup();
    const field = screen.getByRole('textbox', { name: /dart quantity/i });
    expect(screen.queryByRole('button', { name: /fewer dart/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    expect(field).toHaveValue('1');
    await user.click(screen.getByRole('button', { name: /fewer dart/i }));
    expect(field).toHaveValue('0');
    await user.type(field, '4');
    expect(field).toHaveValue('4');
    await user.click(screen.getByRole('button', { name: /max dart/i }));
    expect(field).toHaveValue('6');
  });

  it('adds many while the ship is held', () => {
    vi.useFakeTimers();
    open({ DART: 40 });
    const ship = screen.getByRole('button', { name: /more dart/i });
    fireEvent.pointerDown(ship, { button: 0 });
    act(() => { vi.advanceTimersByTime(2_000); });
    fireEvent.pointerUp(ship);
    const count = Number(screen.getByRole<HTMLInputElement>('textbox', { name: /dart quantity/i }).value);
    expect(count).toBeGreaterThan(3);
    expect(count).toBeLessThanOrEqual(40);
  });
});

describe('the card on its own', () => {
  it('stops at its ceiling, which may sit under what stands home', async () => {
    const onChange = vi.fn();
    render(<UnitCard name="Dart" art={null} cls="SKIRMISHER" home={10} max={3} chosen={0} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /max dart/i }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('keeps a ship it may not send on the card, every control dead', () => {
    render(<UnitCard name="Warden" art={null} cls="BULWARK" home={1} max={0} chosen={0} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /more warden/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /max warden/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /warden quantity/i })).toBeDisabled();
  });
});

describe('the speed is a throttle from a worm to a rocket', () => {
  const comparison = { fuel: 750, fullFuel: 1_000, minutes: 40, fullMinutes: 20 };

  it('runs slow to fast, left to right, a worm at one end and a rocket at the other', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()} comparison={comparison} />);
    const throttle = view.container.querySelector<HTMLElement>('[data-pace-throttle]')!;
    expect(throttle.querySelector('[data-pace-end="slow"]')).not.toBeNull();
    expect(throttle.querySelector('[data-pace-end="fast"]')).not.toBeNull();
    expect(within(throttle).getAllByRole('radio').map((rung) => rung.getAttribute('aria-label') ?? rung.textContent))
      .toEqual(['10%', '25%', '50%', '75%', 'Full']);
    // The fill stands where the pace does: 50% sits (0.5 − 0.1) / 0.9 of the way along.
    expect(throttle.style.getPropertyValue('--pace')).toBe(String((0.5 - 0.1) / 0.9));
  });

  it('keeps every rung on the bar and locks the ones this flight may not take', () => {
    render(<PaceRow paces={[1, 0.75]} pace={1} onChange={vi.fn()} comparison={comparison} />);
    expect(screen.getByRole('radio', { name: '75%' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: '50%' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Full' })).toBeChecked();
  });

  it('drags to the nearest speed this flight may take', () => {
    const onChange = vi.fn();
    const view = render(<PaceRow paces={[1, 0.75, 0.5]} pace={1} onChange={onChange} comparison={comparison} />);
    const track = view.container.querySelector<HTMLElement>('[data-pace-track]')!;
    track.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20, x: 0, y: 0, toJSON: () => ({}) });
    track.setPointerCapture = vi.fn();
    // jsdom has no PointerEvent: a mouse event under the pointer's name carries the position.
    fireEvent(track, new MouseEvent('pointerdown', { clientX: 0, button: 0, bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    fireEvent(track, new MouseEvent('pointermove', { clientX: 150, bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(0.75);
  });

  /**
   * THE THUMB LANDS WHERE IT LANDS (owner 2026-11-17: "sürükleyerek sağa sola çekmekte zorluk çekiyorum,
   * olmuyor veya arada oluyor"). A phone's touch adjustment hands a press near the bar to the speed label
   * under it — a button the browser lets scroll away — so the drag died after one move. The whole throttle,
   * labels and ends too, now takes the press and the drag, measured along the bar, and scrolls nothing.
   */
  it('takes the drag wherever the thumb lands on the throttle, a speed’s label too', () => {
    const onChange = vi.fn();
    const view = render(<PaceRow paces={[1, 0.75, 0.5]} pace={1} onChange={onChange} comparison={comparison} />);
    const throttle = view.container.querySelector<HTMLElement>('[data-pace-throttle]')!;
    const track = view.container.querySelector<HTMLElement>('[data-pace-track]')!;
    track.getBoundingClientRect = () => ({ left: 20, width: 200, top: 0, height: 20, right: 220, bottom: 20, x: 20, y: 0, toJSON: () => ({}) });
    const capture = vi.fn();
    throttle.setPointerCapture = capture;
    const label = screen.getByRole('radio', { name: '50%' });
    fireEvent(label, new MouseEvent('pointerdown', { clientX: 20, button: 0, bubbles: true }));
    expect(capture).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    fireEvent(label, new MouseEvent('pointermove', { clientX: 170, bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(0.75);
    // A press past the bar's end, on the rocket, is full speed.
    fireEvent(throttle.querySelector('[data-pace-end="fast"]')!, new MouseEvent('pointermove', { clientX: 260, bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('reads the trade as two deltas under the bar, no full-speed baseline sentences', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()} comparison={comparison} />);
    expect(view.container.querySelector('[data-pace-saving]')).toHaveTextContent('−250');
    expect(view.container.querySelector('[data-pace-delay]')).toHaveTextContent(`+${durationPrecise(20)}`);
    expect(view.container).not.toHaveTextContent(/full speed:/i);
  });
});

describe('the price is one line, its rules one press away', () => {
  it('says what the world goes without in one line and keeps the rules behind the ⓘ', async () => {
    const view = open({ DART: 6 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    const warning = view.container.querySelector<HTMLElement>('[data-launch-warning]')!;
    expect(warning).toHaveTextContent(/^Kestrel-12 · .+ without this fleet$/);
    const price = view.container.querySelector<HTMLElement>('[data-launch-price]')!;
    expect(price).not.toHaveTextContent(/cannot be raided/i);
    await user.click(within(price).getByRole('button', { name: i18n.t('launch.priceRules') }));
    expect(price).toHaveTextContent(/cannot be raided/i);
    expect(price.querySelector('[data-launch-recall]')).not.toBeNull();
    // The held commit stands alone in its box: the tutorial hand finds one button there.
    expect(within(view.container.querySelector<HTMLElement>('[data-launch-commit]')!).getAllByRole('button')).toHaveLength(1);
  });
});
