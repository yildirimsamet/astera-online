import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MISSION_PACES } from '@astera/rules';
import { describe, expect, it, vi } from 'vitest';
import { EscortRow } from '../src/ui/EscortRow.js';
import { PaceRow } from '../src/ui/PaceRow.js';
import { RadiationPreview } from '../src/ui/RadiationPreview.js';
import { SpendBar } from '../src/ui/SpendBar.js';

/**
 * G4-e2 (2026-11-15): THE LAUNCH'S CONTROLS ON THE GAME KIT. "How fast, with whom, at what
 * cost?" The pace is the kit's choice plates; the escort is the kit's switch, thrown; the
 * tank the trip draws on and the dose the route deals are read in kit colour at the kit's
 * type floor.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-(control|chip|cell|full)|v2-legend|(^|\s)text-(micro|caption|body|faint|bone|threat-ink)(\s|$)|(^|\s)(socket|readout)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));
const NOW = Date.parse('2026-10-25T12:00:00Z');

describe('the launch controls on the kit', () => {
  it('picks the pace on the kit’s throttle, the trade read under it', async () => {
    const onChange = vi.fn();
    const view = render(<PaceRow data-launch-pace paces={MISSION_PACES} pace={1} onChange={onChange} brief="less fuel, slower"
      comparison={{ fuel: 1_000, fullFuel: 1_000, minutes: 20, fullMinutes: 20 }} />);
    const row = view.container.querySelector<HTMLElement>('[data-launch-pace]')!;
    expect(oldPaint(row)).toEqual([]);
    expect(screen.getByRole('radiogroup')).toHaveClass('gk-throttle__rungs');
    expect(row.querySelector('[data-pace-comparison]')).toHaveClass('gk-pace__trade');
    await userEvent.setup().click(screen.getByRole('radio', { name: '50%' }));
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it('throws the escort on the kit’s switch, a busy ship locked with its reason', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<EscortRow escort={{ kind: 'ready', ship: 'kilavuz', level: 4, bonuses: { damage: 1, hull: 1, time: 0.96, fuel: 0.93 } }}
      on={false} onChange={onChange} now={NOW} />);
    const toggle = screen.getByRole('switch', { name: /commander ship escorts/i });
    expect(toggle).toHaveClass('gk-toggle');
    expect(toggle).toHaveAttribute('data-own-sound');
    expect(oldPaint(container)).toEqual([]);
    await userEvent.setup().click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<EscortRow escort={{ kind: 'busy', ship: 'kilavuz', level: 4, reason: 'repair', until: NOW + 30 * 60_000 }}
      on={false} onChange={onChange} now={NOW} />);
    expect(screen.getByRole('switch', { name: /commander ship escorts/i })).toHaveAttribute('data-locked');
  });

  it('reads the tank on the ruler in kit colour, the shortfall named', () => {
    const { container } = render(<SpendBar inline stock={40} spend={100} tone="deuterium" label="Fuel" />);
    expect(oldPaint(container)).toEqual([]);
    expect(container.querySelector('[data-spend-bar]')).toHaveClass('gk-fuel');
    expect(container.querySelector('[data-spend-short]')).toHaveTextContent(/60/);
  });

  it('says what the route deals in kit notes', () => {
    const { container } = render(<RadiationPreview combat radiation={{ kind: 'HP', doseHp: 3, destroyed: 1, docks: true, lostFleet: { DART: 1 },
      lots: [{ hull: 'DART', count: 2, maxHp: 19, remainingHp: 16, healthPct: 84, needsDock: false }] }} />);
    expect(oldPaint(container)).toEqual([]);
    expect(container.querySelector('[data-radiation-warning]')).toHaveClass('gk-dose');
  });
});
