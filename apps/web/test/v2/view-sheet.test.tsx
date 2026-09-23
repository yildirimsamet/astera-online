import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { ViewChip, ViewSheet, type ViewSheetProps } from '../../src/v2/hud/ViewSheet.js';

/**
 * THE VIEW CHIP. The "every surface's new place" table (docs/ui-v2/gozlemevi.md):
 * the sensor switches and the events guide move from the disc's corner into one
 * chip at top right, and the disc caption (`DiscReadout`) heads the sheet it
 * opens. The rules the old switches kept come with them.
 */

const props = (over: Partial<ViewSheetProps> = {}): ViewSheetProps => ({
  shard: 'EU-1',
  online: 6,
  onlineToday: 41,
  counts: { worlds: 212, fleetsAway: 3, rocks: 9, pirates: 0, wrecks: 1 },
  telescope: true,
  onToggleTelescope: vi.fn(),
  onOpenEvents: vi.fn(),
  onClose: vi.fn(),
  ...over,
});

describe('the view chip', () => {
  it('opens the view', async () => {
    const onOpen = vi.fn();
    render(<ViewChip layersOn onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'View' })).toHaveAttribute('data-view-chip');
  });
});

describe('the view sheet', () => {
  it('names the galaxy by its code and says who is in it, now and today', () => {
    render(<ViewSheet {...props()} />);
    expect(screen.getByText('EU-1')).toBeInTheDocument();
    expect(screen.getByText('6 online')).toBeInTheDocument();
    expect(screen.getByText('41 in 24h')).toBeInTheDocument();
  });

  it('omits a figure an older server does not send', () => {
    render(<ViewSheet {...props({ onlineToday: undefined })} />);
    expect(screen.queryByText(/24h/)).toBeNull();
  });

  it('counts what is out there, leaving out what is not', () => {
    render(<ViewSheet {...props()} />);
    const caption = screen.getByTestId('view-caption');
    expect(caption).toHaveTextContent(/212 worlds/);
    expect(caption).not.toHaveTextContent(/pirate/i);
  });

  it('always offers the Telescope layer and reports its switch', async () => {
    const onToggleTelescope = vi.fn();
    render(<ViewSheet {...props({ onToggleTelescope })} />);
    const telescope = screen.getByRole('switch', { name: /Telescope reach/ });
    expect(telescope).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(telescope);
    expect(onToggleTelescope).toHaveBeenCalledTimes(1);
  });

  it('offers no Radar layer to a commander with no Radar — absent, not dead', () => {
    render(<ViewSheet {...props()} />);
    expect(screen.queryByRole('switch', { name: /Radar/ })).toBeNull();
  });

  it('offers the Radar layer once a Radar is running', async () => {
    const onToggleRadar = vi.fn();
    render(<ViewSheet {...props({ radar: false, onToggleRadar })} />);
    const radar = screen.getByRole('switch', { name: /Radar reach/ });
    expect(radar).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(radar);
    expect(onToggleRadar).toHaveBeenCalledTimes(1);
  });

  /**
   * A LAYER IS SWITCHED TO BE SEEN. The sheet closes on the press so the circle it
   * just drew is on screen at once — and the Academy's Telescope exercise, which
   * offers no close button, is not left under a sheet.
   */
  it('closes itself once a layer is switched, so the result shows on the map', async () => {
    const onClose = vi.fn();
    const onToggleTelescope = vi.fn();
    render(<ViewSheet {...props({ onClose, onToggleTelescope })} />);
    await userEvent.click(screen.getByRole('switch', { name: /Telescope reach/ }));
    expect(onToggleTelescope).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks each layer by its instrument, for the Academy to point at', () => {
    render(<ViewSheet {...props({ radar: false, onToggleRadar: vi.fn() })} />);
    expect(screen.getByRole('switch', { name: /Telescope reach/ })).toHaveAttribute('data-sensor-toggle', 'telescope');
    expect(screen.getByRole('switch', { name: /Radar reach/ })).toHaveAttribute('data-sensor-toggle', 'radar');
  });

  it('opens the galaxy events guide', async () => {
    const onOpenEvents = vi.fn();
    render(<ViewSheet {...props({ onOpenEvents })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Galaxy events guide' }));
    expect(onOpenEvents).toHaveBeenCalledTimes(1);
  });

  it('speaks Turkish', async () => {
    render(<ViewSheet {...props()} />);
    await act(async () => { await i18n.changeLanguage('tr'); });
    expect(within(screen.getByRole('dialog')).getByText('6 çevrimiçi')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Teleskop menzili/ })).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('en'); });
  });
});
