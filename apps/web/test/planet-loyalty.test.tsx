import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DefenceReadings, PlanetHero } from '../src/ui/PlanetHero.js';
import { PLANET_SKIN_CATALOG } from '../src/ui/skinCatalog.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

beforeEach(async () => {
  await i18n.changeLanguage('en');
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
    expect(line).toHaveTextContent('Partial defeat −15 · decisive defeat −30');
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
