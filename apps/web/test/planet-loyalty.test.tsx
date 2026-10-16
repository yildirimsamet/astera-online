import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planetSchema } from '../src/api/schemas.js';
import { DefenceReadings, PlanetHero } from '../src/ui/PlanetHero.js';
import { PLANET_SKIN_CATALOG } from '../src/ui/skinCatalog.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => { vi.useRealTimers(); });

describe('colony building protection', () => {
  it('freezes the remaining protection on vacation and resumes at its exact end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
    render(<PlanetHero planet={planetView({
      loyalty: { value: 100, minutesLeft: null },
      vacationUntil: new Date('2026-10-17T12:00:00Z'),
      faultProtectedUntil: new Date('2026-10-18T00:00:00Z'),
    })} />);
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('Fault protection paused · 12h 00m remaining');
    act(() => {
      vi.setSystemTime(new Date('2026-10-16T18:00:00Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('Fault protection paused · 12h 00m remaining');
    act(() => {
      vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('No new faults for 11h 59m');
    expect(screen.getByTestId('fault-protection')).not.toHaveTextContent('paused');
  });

  it('shows the authoritative countdown and expires without refreshing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const planet = planetSchema.parse({ ...planetView({ loyalty: { value: 100, minutesLeft: null } }),
      faultProtectedUntil: '2026-10-16T00:00:00Z' });
    render(<PlanetHero planet={planet} />);
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('No new faults for 12h 00m');
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('Start any building upgrade to renew 12 hours of protection on this colony.');
    act(() => {
      vi.setSystemTime(new Date('2026-10-16T00:00:00Z'));
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('Start any building upgrade');
    expect(screen.getByTestId('fault-protection')).not.toHaveTextContent('No new faults for');
  });

  it('explains the rule on an unprotected colony and stays hidden on a capital', () => {
    const view = render(<PlanetHero planet={planetView({ loyalty: { value: 100, minutesLeft: null } })} />);
    expect(screen.getByTestId('fault-protection')).toHaveTextContent('Start any building upgrade');
    view.rerender(<PlanetHero planet={planetView()} />);
    expect(screen.queryByTestId('fault-protection')).toBeNull();
  });
});

describe('the planet hero states colony loyalty', () => {
  it('wears the equipped skin in the base portrait', () => {
    render(<PlanetHero planet={planetView({}, { skinId: 'planet-ice' })} />);
    expect(document.querySelector('[role="img"] img[src]')).toHaveAttribute('src', PLANET_SKIN_CATALOG['planet-ice'].image);
  });
  it('shows a full loyalty bar at 100%', () => {
    render(
      <PlanetHero
        planet={planetView({ loyalty: { value: 100, minutesLeft: null } })}
      />,
    );

    const line = screen.getByTestId('loyalty-line');
    expect(line).toHaveTextContent('100%');
    // Every way a colony loses loyalty at once, the Death Star included (owner, 2026-10-01).
    expect(line).toHaveTextContent('Partial defeat −15 · decisive defeat −30 · Death Star −20');
    expect(line.querySelector('[data-loyalty-bar]')).toHaveStyle({ width: '100%' });
  });

  /** Owner, round 2: no grey bars. A colony's loyalty is yours, so it wears your colour. */
  it('draws loyalty in your colour, never grey', () => {
    render(<PlanetHero planet={planetView({ loyalty: { value: 80, minutesLeft: null } })} />);
    const bar = screen.getByTestId('loyalty-line').querySelector('[data-loyalty-bar]')!;
    expect(bar).toHaveClass('bg-v2-self');
    expect(bar.className).not.toMatch(/ink|bone|grey|gray/);
  });

  it('does not invent loyalty for a payload without it', () => {
    render(<PlanetHero planet={planetView()} />);
    expect(screen.queryByTestId('loyalty-line')).toBeNull();
  });
});

describe('the planet hero reflects a command-core outage', () => {
  const coreFault = {
    id: 'fault-core',
    kind: 'CORE_OUTAGE' as const,
    startedAt: new Date(),
    cost: { alloy: 100, crystal: 0, deuterium: 0 },
    repair: null,
  };

  const outage = planetView({
    fleet: {},
    ground: { THORN: 5 },
    faults: [coreFault],
  }, { shield: 800, shieldMax: 1_000, shieldPerHour: 100 });

  it('hides the Aegis dome', () => {
    const view = render(<PlanetHero planet={outage} />);
    expect(view.container.querySelector('[data-planet-portrait] [class~="border-crystal/35"]'))
      .toBeNull();
  });

  it('excludes offline ground guns from firepower and says the shield is dark', () => {
    render(<DefenceReadings planet={outage} />);
    expect(screen.getByTestId('planet-firepower')).toHaveTextContent('0');
    expect(screen.getByTestId('planet-shield')).toHaveTextContent(/offline/i);
  });
});
