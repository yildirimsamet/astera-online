import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n/index.js';
import type { PlanetMoon, PlanetView } from '../src/api/schemas.js';
import { MoonPanel } from '../src/screens/MoonPanel.js';

function makeMoon(overrides: Partial<PlanetMoon> = {}): PlanetMoon {
  return {
    rarity: 'RARE',
    origin: 'BATTLE',
    cracks: 2,
    crackLimit: 5,
    lastHitAt: new Date('2026-11-22T08:00:00.000Z'),
    gateReadyAt: null,
    closedUntil: null,
    visualSeed: 42,
    fleet: { DART: 10 },
    dockUsed: 100,
    dockCapacity: 1550,
    dockFree: 1450,
    scanRange: 2250,
    scanPierces: false,
    moves: [],
    ...overrides,
  };
}

function makePlanet(overrides: {
  moon?: PlanetMoon | null;
  lunarCapture?: boolean;
  alloy?: number;
  crystal?: number;
  deuterium?: number;
  fleet?: Record<string, number>;
  moonOrdered?: boolean;
} = {}): PlanetView {
  return {
    planet: {
      id: 'p-home',
      name: 'Alpha',
      alloy: overrides.alloy ?? 50_000,
      crystal: overrides.crystal ?? 30_000,
      deuterium: overrides.deuterium ?? 2_000,
      position: { x: 0, y: 0, z: 0 },
    },
    buildings: { CORE: 10 },
    fleet: overrides.fleet ?? { DART: 8 },
    research: [
      { id: 'LUNAR_CAPTURE', level: overrides.lunarCapture ? 1 : 0 },
    ],
    queues: {
      CONSTRUCTION: overrides.moonOrdered
        ? [{ id: 'o1', kind: 'MOON', subject: 'COMMON', count: 1, finishesAt: new Date('2026-11-22T17:00:00.000Z') }]
        : [],
      YARD: [],
      REPAIR: [],
    },
    moon: overrides.moon === undefined ? null : overrides.moon,
  } as unknown as PlanetView;
}

describe('MoonPanel (F9b)', () => {
  it('renders nothing when moons are disabled and the planet has no moon', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <MoonPanel planet={makePlanet()} moonsEnabled={false} otherMoons={[]} scanTargets={[]} />
      </I18nextProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows locked Common moon build card before Lunar Capture and allows ordering after research', () => {
    const onOrderMoon = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <MoonPanel
          planet={makePlanet({ lunarCapture: false })}
          moonsEnabled
          otherMoons={[]}
          scanTargets={[]}
          onOrderMoon={onOrderMoon}
        />
      </I18nextProvider>,
    );
    const buildBtn = within(screen.getByTestId('moon-panel-empty')).getByRole<HTMLButtonElement>('button');
    expect(buildBtn.disabled).toBe(true);

    rerender(
      <I18nextProvider i18n={i18n}>
        <MoonPanel
          planet={makePlanet({ lunarCapture: true })}
          moonsEnabled
          otherMoons={[]}
          scanTargets={[]}
          onOrderMoon={onOrderMoon}
        />
      </I18nextProvider>,
    );
    const readyBtn = within(screen.getByTestId('moon-panel-empty')).getByRole<HTMLButtonElement>('button');
    expect(readyBtn.disabled).toBe(false);
    fireEvent.click(readyBtn);
    expect(onOrderMoon).toHaveBeenCalledWith('p-home');
  });

  it('renders moon stats, dock gauge, cracks, hop action, and Legendary Gözcü badge', async () => {
    const onHop = vi.fn().mockResolvedValue(undefined);
    const onScan = vi.fn().mockResolvedValue({ id: 's1', scannedAt: new Date(), pierced: true, rows: [] });
    render(
      <I18nextProvider i18n={i18n}>
        <MoonPanel
          planet={makePlanet({
            lunarCapture: true,
            moon: makeMoon({ rarity: 'LEGENDARY', scanPierces: true, cracks: 2, crackLimit: 9 }),
          })}
          moonsEnabled
          otherMoons={[{ planetId: 'p-col', name: 'Beta', position: { x: 400, y: 0, z: 0 }, rarity: 'COMMON' }]}
          scanTargets={[{ planetId: 'p-enemy', name: 'Gamma', distance: 600 }]}
          onHop={onHop}
          onScan={onScan}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('moon-rarity').textContent).toMatch(/Legendary|Efsanevi/i);
    expect(screen.getByTestId('moon-cracks').textContent).toContain('2/9');
    expect(screen.getByTestId('moon-pierce-badge')).toBeDefined();
    expect(screen.getByTestId('moon-split-planet')).toBeDefined();
    expect(screen.getByTestId('moon-split-moon')).toBeDefined();

    const hopCard = screen.getByTestId('moon-hop-card');
    const getHopSubmit = () =>
      within(hopCard).getAllByRole<HTMLButtonElement>('button').at(-1)!;

    // Nothing selected yet -> submit stays disabled until commander chooses ships
    expect(getHopSubmit().disabled).toBe(true);

    // Commander can pick an exact subset via the per-hull stepper
    const dartRow = screen.getByTestId('moon-hop-row-DART');
    const dartInput = within(dartRow).getByRole<HTMLInputElement>('textbox');
    fireEvent.change(dartInput, { target: { value: '3' } });
    expect(getHopSubmit().disabled).toBe(false);
    fireEvent.click(getHopSubmit());
    expect(onHop).toHaveBeenCalledWith('p-home', 'UP', { DART: 3 });

    // Wait for first hop to settle, then choose all ships via Select All
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('moon-hop-select-all'));
      expect(getHopSubmit().disabled).toBe(false);
    });
    fireEvent.click(getHopSubmit());
    expect(onHop).toHaveBeenCalledWith('p-home', 'UP', { DART: 8 });
  });
});
