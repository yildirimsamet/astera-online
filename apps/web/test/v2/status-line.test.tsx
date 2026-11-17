import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusLine, type StatusLineProps } from '../../src/v2/hud/StatusLine.js';

/**
 * WHAT HOLDS OVER YOUR WORLDS, UNDER THE TOP BAR (G1-b, 2026-11-14). The shield used to
 * ride the menu button in 8 px and the boosts and the vacation were strips of plain
 * text; now each is a chip of its own colour with its time, and a press says what it
 * means. The world you are reading and a reward waiting to be claimed sit on the same
 * line. Nothing holds, nothing is drawn.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const H = 3_600_000;

const props = (over: Partial<StatusLineProps> = {}): StatusLineProps => ({
  now: NOW,
  world: null,
  shield: null,
  recoveryUntil: null,
  signalUntil: null,
  vacationUntil: null,
  onWorld: vi.fn(),
  onHint: vi.fn(),
  ...over,
});

describe('the status line', () => {
  it('draws nothing while nothing holds', () => {
    const { container } = render(<StatusLine {...props()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the world being read only once there is a second one, and opens the worlds', async () => {
    const all = props({ world: { capital: false, name: 'Hollow' } });
    render(<StatusLine {...all} />);
    await userEvent.click(screen.getByRole('button', { name: 'COLONY · Hollow' }));
    expect(all.onWorld).toHaveBeenCalledTimes(1);
  });

  /** Owner 2026-11-17 (ek-14): the world button was a big square of its own; it is one of the pills now. */
  it('draws the world as a pill like the badges under it, with a drop mark', () => {
    render(<StatusLine {...props({ world: { capital: true, name: 'Hollow' } })} />);
    const pill = screen.getByRole('button', { name: /Hollow/ }).querySelector('.gk-status');
    expect(pill).toHaveAttribute('data-tone', 'self');
    expect(pill).toHaveTextContent('Hollow');
    expect(pill?.querySelector('.gk-status__drop')).not.toBeNull();
  });

  it('wears the shield with its time rounded down, and says the rule on a press', async () => {
    const all = props({ shield: { until: NOW + 7 * H + 20 * 60_000, kind: 'NEWCOMER' } });
    const { rerender } = render(<StatusLine {...all} />);
    await userEvent.click(screen.getByRole('button', { name: 'Newcomer shield · 7h' }));
    expect(all.onHint).toHaveBeenCalledWith('You cannot be raided for 7h 20m');
    rerender(<StatusLine {...props({ shield: { until: NOW + 42 * 60_000, kind: 'NEWCOMER' } })} />);
    expect(screen.getByRole('button', { name: 'Newcomer shield · 42m' })).toBeInTheDocument();
    rerender(<StatusLine {...props({ shield: { until: NOW + 50 * H, kind: 'RECOVERY' } })} />);
    expect(screen.getByRole('button', { name: 'Recovery shield · 2d 2h' })).toBeInTheDocument();
    rerender(<StatusLine {...props({ shield: { until: NOW - 1, kind: 'NEWCOMER' } })} />);
    expect(screen.queryByRole('button', { name: /shield/ })).toBeNull();
  });

  it('wears the recovery boost in the shield’s colour, the two being one story', async () => {
    const all = props({ shield: { until: NOW + 5 * H, kind: 'RECOVERY' }, recoveryUntil: NOW + 5 * H });
    const { container } = render(<StatusLine {...all} />);
    await userEvent.click(screen.getByRole('button', { name: 'Recovery production · +50% · 5h' }));
    expect(all.onHint).toHaveBeenCalledWith('+50% output while shielded');
    const tones = [...container.querySelectorAll('.gk-status')].map((chip) => chip.getAttribute('data-tone'));
    // Owner 2026-11-17 (ek-7): each kind its own colour — a shield is green.
    expect(tones).toEqual(['good', 'good']);
  });

  it('tells a signal boost from a shield and a break by colour (owner 2026-11-17, ek-7)', () => {
    const { container } = render(<StatusLine {...props({ shield: { until: NOW + 5 * H, kind: 'NEWCOMER' }, signalUntil: NOW + H, vacationUntil: NOW + 9 * H })} />);
    const tones = [...container.querySelectorAll('.gk-status')].map((chip) => chip.getAttribute('data-tone'));
    expect(tones).toEqual(['good', 'self', 'info']);
  });

  it('shows the signal’s production with its factor, and how to use it on a press', async () => {
    const all = props({ signalUntil: NOW + 59 * 60_000 });
    render(<StatusLine {...all} />);
    await userEvent.click(screen.getByRole('button', { name: 'Signal production · ×2 · 59m' }));
    expect(all.onHint).toHaveBeenCalledWith(expect.stringMatching(/collect during the boost/i));
  });

  it('folds the recovery boost into the signal’s factor while both run', () => {
    render(<StatusLine {...props({ signalUntil: NOW + H, recoveryUntil: NOW + 5 * H })} />);
    expect(screen.getByRole('button', { name: /^Signal production · ×2\.5/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Recovery production/ })).toBeNull();
  });

  it('says a vacation and until when it protects you', async () => {
    const all = props({ vacationUntil: NOW + 30 * H });
    render(<StatusLine {...all} />);
    await userEvent.click(screen.getByRole('button', { name: /^Vacation mode · / }));
    expect(all.onHint).toHaveBeenCalledWith(expect.stringMatching(/^Protected until /));
  });

  /** H1 (owner 2026-11-16): the gift stands with the galaxy's tools; the chips say only what holds. */
  it('carries no gift: it stands with the galaxy’s tools', () => {
    render(<StatusLine {...props()} />);
    expect(screen.queryByRole('button', { name: /^Rewards/ })).toBeNull();
  });
});
