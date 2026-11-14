import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { DefenceReadings } from '../src/ui/PlanetHero.js';
import { FleetCards } from '../src/ui/FleetCards.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * G2-g, 2026-11-14: THE HEAD OF THE DEFENCE TAB ON THE GAME KIT. The player's moment: "how does
 * my world stand?" — four readings (what a probe measures, what the line is made of, the shield,
 * what a raid could take) and the force itself, every word at the kit's 12 px floor or above.
 */

const v2Classes = (root: HTMLElement): string[] => [...root.querySelectorAll<HTMLElement>('[class]'), root]
  .flatMap((node) => [...node.classList])
  .filter((name) => /^(v2-|font-v2|text-micro|text-caption|text-v2|bg-v2|border-v2|text-faint|text-dim|text-bone|legend|num$)/.test(name));

const world = (over: Partial<Omit<PlanetView, 'planet'>> = {}, stock: Partial<PlanetView['planet']> = {}) => planetView({
  fleet: { DART: 6, VIPER: 2, COURIER: 3 },
  fleetAway: { DART: 2 },
  ground: { THORN: 3 },
  buildings: { CORE: 6, VAULT: 1 },
  ...over,
}, { shield: 90, shieldMax: 150, shieldPerHour: 50, ...stock });

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* a private window is fine */ }
});

describe('the defence readings on the kit', () => {
  it('are four kit verdict plates, with nothing of the v2 boxes left', () => {
    const { container } = render(<DefenceReadings planet={world()} />);
    const head = container.querySelector<HTMLElement>('[data-defence-readings]')!;
    expect(head.closest('.gk')).not.toBeNull();
    expect(head.querySelectorAll('.gk-verdict')).toHaveLength(4);
    expect(v2Classes(head)).toEqual([]);
  });

  it('gives each reading its picture and its tone', () => {
    render(<DefenceReadings planet={world()} />);
    for (const id of ['planet-firepower-plate', 'planet-defence', 'planet-shield', 'planet-exposed']) {
      expect(screen.getByTestId(id).querySelector('.gk-verdict__coin svg')).not.toBeNull();
    }
    expect(screen.getByTestId('planet-shield')).toHaveAttribute('data-tone', 'good');
    expect(screen.getByTestId('planet-defence')).toHaveAttribute('data-tone', 'neutral');
  });

  it('draws the shield charge on the kit bar', () => {
    render(<DefenceReadings planet={world()} />);
    const bar = within(screen.getByTestId('planet-shield')).getByRole('progressbar', { name: 'Aegis shield charge' });
    expect(bar).toHaveClass('gk-bar');
    expect(bar).toHaveAttribute('aria-valuenow', '90');
    expect(bar).toHaveAttribute('aria-valuemax', '150');
  });

  it('reads a shield under a third as a warning and a missing one as a gap', () => {
    const { unmount } = render(<DefenceReadings planet={world({}, { shield: 30 })} />);
    expect(screen.getByTestId('planet-shield')).toHaveAttribute('data-tone', 'warn');
    unmount();
    render(<DefenceReadings planet={world({}, { shield: 0, shieldMax: 0 })} />);
    expect(screen.getByTestId('planet-shield')).toHaveAttribute('data-tone', 'gap');
  });
});

describe('the defence line in every language', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });

  // The German plural said "12 wird versendet" (12 is being sent), the transports stood "in der Zeile"
  // (in a line of text), and the Spanish guns were pistols.
  it.each([
    ['de', '4 Schiffe · 3 Bodengeschütze', '2 Transporter in der Linie'],
    ['es', '4 naves · 3 cañones', '2 transportes en la línea'],
  ])('names ships, guns and transports plainly in %s', async (language, line, transports) => {
    await i18n.changeLanguage(language);
    render(<DefenceReadings planet={world({ fleet: { DART: 4, COURIER: 2 }, ground: { THORN: 3 } })} />);
    expect(screen.getByTestId('planet-defence')).toHaveTextContent(line);
    expect(screen.getByTestId('planet-defence')).toHaveTextContent(transports);
  });
});

describe('the force under the readings, on the kit', () => {
  it('folds each family behind a 44 px kit head that carries its count', async () => {
    render(<FleetCards fleet={{ DART: 6, COURIER: 3 }} fleetAway={{ DART: 2 }} />);
    const heads = screen.getAllByRole('button');
    expect(heads.every((head) => head.classList.contains('gk-fleetband__head'))).toBe(true);
    const shut = heads.find((head) => head.getAttribute('aria-expanded') === 'false')!;
    expect(shut).toHaveTextContent('3');
    await userEvent.click(shut);
    expect(screen.getByTestId('fleet-card-COURIER')).toHaveClass('gk-fleetchip');
  });

  it('draws each hull as a kit chip, home and away apart, with no v2 type left', () => {
    const { container } = render(<FleetCards fleet={{ DART: 6 }} fleetAway={{ DART: 2 }} fleetDocked={{ DART: 1 }} />);
    expect(screen.getByTestId('fleet-card-DART')).toHaveClass('gk-fleetchip');
    expect(screen.getByTestId('fleet-home-DART')).toHaveTextContent('6');
    expect(screen.getByTestId('fleet-away-DART')).toHaveTextContent('2');
    expect(screen.getByTestId('fleet-docked-DART')).toHaveTextContent('1');
    expect(v2Classes(container)).toEqual([]);
  });
});
