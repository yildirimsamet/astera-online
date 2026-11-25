import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('shows locked Common moon build card before Lunar Capture and allows ordering after research', async () => {
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
    // Review U3: the build is a 1 s hold.
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(readyBtn, { button: 0 });
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      fireEvent.pointerUp(readyBtn);
    } finally { vi.useRealTimers(); }
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
    expect(screen.getByTestId('moon-cracks').textContent).toContain('7/9');
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

    // Switch sub-tabs: Moon Gate -> Gözcü
    fireEvent.click(screen.getByRole('tab', { name: /Moon Gate|Ay Kapısı/i }));
    expect(screen.getByTestId('moon-gate-card')).toBeDefined();
    expect(screen.queryByTestId('moon-hop-card')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Gözcü/i }));
    expect(screen.getByTestId('moon-scan-card')).toBeDefined();
    expect(screen.queryByTestId('moon-gate-card')).toBeNull();
  });
});

/*
  Sentez (plan 2026-11-24 §3.1). Owner 2026-11-25: "Ay menüsünde Asteryum için ayrı, görece ince bir section yap;
  üretildiği belli olsun: ne kadar üretildi, ne kadar sonra üretilecek, ana gezegene aktarmaya ne kadar kaldı".
  Nothing is shipped: each unit lands in the Synthesis Lab's stock the moment it is made, and the section says so.
*/
describe('the Asteryum a moon makes', () => {
  const HOUR = 3_600_000;
  const draw = (moon: Partial<PlanetMoon>, synthesisEnabled: boolean) => render(
    <I18nextProvider i18n={i18n}>
      <MoonPanel planet={makePlanet({ moon: makeMoon(moon) })} moonsEnabled synthesisEnabled={synthesisEnabled} otherMoons={[]} scanTargets={[]} />
    </I18nextProvider>,
  );

  it('has its own slim section: the rate, what the moon has made, the next unit, and that it lands in the lab at once', async () => {
    await i18n.changeLanguage('en');
    // A Rare moon makes 1.5 a day (owner 2026-11-25 halved the rates), one every 16 h: 8 h since the last count is
    // half a unit, and 8 h to the next.
    draw({ rarity: 'RARE', asterium: { syncedAt: new Date(Date.now() - 8 * HOUR), fraction: 0, produced: 7 } }, true);
    const part = screen.getByTestId('moon-asterium');
    expect(part.querySelector('img')?.getAttribute('src')).toBe('/assets/images/resources/asterium.webp');
    expect(part).toHaveTextContent('1.5 a day');
    expect(part).toHaveTextContent('7 made so far');
    expect(part).toHaveTextContent(/Next unit in (7h 59m|8h 00m)/);
    expect(part).toHaveTextContent(/straight to your Synthesis Lab stock/);
    const fill = part.querySelector<HTMLElement>('[data-moon-asterium-progress]');
    expect(Number.parseFloat(fill?.style.width ?? '')).toBeCloseTo(50, 0);
  });

  it('counts a unit made since the last read into what the moon has made', async () => {
    await i18n.changeLanguage('en');
    draw({ rarity: 'RARE', asterium: { syncedAt: new Date(Date.now() - 20 * HOUR), fraction: 0, produced: 7 } }, true);
    expect(screen.getByTestId('moon-asterium')).toHaveTextContent('8 made so far');
  });

  it('says a shut moon makes nothing until it opens, and says nothing where the galaxy has no laboratory', async () => {
    await i18n.changeLanguage('en');
    const view = draw({ rarity: 'EPIC', closedUntil: new Date(Date.now() + HOUR),
      asterium: { syncedAt: new Date(Date.now() - HOUR), fraction: 0.25, produced: 2 } }, true);
    expect(screen.getByTestId('moon-asterium')).toHaveTextContent(/Shut: makes again in (59m \d+s|1h 00m)/);
    view.unmount();
    draw({ rarity: 'EPIC' }, false);
    expect(screen.queryByTestId('moon-asterium')).toBeNull();
  });
});

/*
  THE MOON TAB, LAID OUT (owner 2026-11-25: "her şey bir yerde, alt alta iç içe… Dayanıklılık, hemen altında
  aynı sectionda Asteryum, onun altında Ay Rıhtımı kapasitesi"). One part, one job, top to bottom:
  the moon itself (its picture, rarity, origin, durability), what is on its way, its Asteryum, then the tabs.
  The dock's capacity is read where the dock is: beside the hangar's, in the fleet split.
*/
describe('the moon tab\'s parts', () => {
  const draw = (moon: Partial<PlanetMoon>) => render(
    <I18nextProvider i18n={i18n}>
      <MoonPanel planet={makePlanet({ moon: makeMoon(moon) })} moonsEnabled synthesisEnabled otherMoons={[]} scanTargets={[]} />
    </I18nextProvider>,
  );
  const header = (): Element => {
    const found = document.querySelector('[data-moon-header]');
    if (!found) throw new Error('no moon header');
    return found;
  };

  it('opens on the moon itself: its picture by rarity, its rarity, origin and durability, and nothing else', () => {
    draw({ rarity: 'EPIC', origin: 'BATTLE', cracks: 1, crackLimit: 7 });
    const portrait = header().querySelector<HTMLElement>('[data-moon-portrait]');
    expect(portrait?.getAttribute('data-rarity')).toBe('EPIC');
    // The galaxy's own surfaces: an Epic or Legendary moon is the ancient one, as it is drawn in the galaxy.
    expect(portrait?.querySelector<HTMLElement>('[data-moon-surface]')?.style.backgroundImage).toContain('moon-ancient-2x1.webp');
    expect(within(header() as HTMLElement).getByTestId('moon-rarity')).toBeDefined();
    expect(within(header() as HTMLElement).getByTestId('moon-cracks')).toBeDefined();
    expect(header().querySelector('[data-testid="moon-asterium"]')).toBeNull();
    expect(header().querySelector('[data-moon-dock-gauge]')).toBeNull();
  });

  it('reads durability as cells, one per crack the moon can take, the whole ones lit', () => {
    draw({ cracks: 2, crackLimit: 5 });
    const cells = [...header().querySelectorAll('[data-moon-durability] [data-cell]')];
    expect(cells).toHaveLength(5);
    expect(cells.filter((cell) => cell.getAttribute('data-cell') === 'whole')).toHaveLength(3);
  });

  it('gives the Asteryum its own part, after the moon and before the tabs', () => {
    draw({});
    const part = screen.getByTestId('moon-asterium');
    const tabs = screen.getByRole('tablist');
    expect(header().compareDocumentPosition(part) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(part.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads the dock\'s capacity beside the hangar\'s, once', () => {
    draw({ dockUsed: 100, dockCapacity: 1550 });
    const gauges = document.querySelectorAll('[data-moon-dock-gauge]');
    expect(gauges).toHaveLength(1);
    expect(screen.getByTestId('moon-split-moon').contains(gauges[0]!)).toBe(true);
  });

  it('lists what is on its way as its own part, outside the moon\'s header', () => {
    draw({ moves: [{ id: 'm1', kind: 'HOP_UP', fleet: { DART: 3 }, fromPlanetId: 'p-home', toPlanetId: 'p-home',
      departAt: new Date(Date.now() - 30_000), arriveAt: new Date(Date.now() + 60_000) }] });
    const moves = document.querySelector('[data-moon-moves]');
    expect(moves).not.toBeNull();
    expect(header().contains(moves)).toBe(false);
  });
});

describe('the Moon Gate\'s destination', () => {
  it('says what its numbers are: how far the other moon is, and the room its dock has free', async () => {
    await i18n.changeLanguage('en');
    render(
      <I18nextProvider i18n={i18n}>
        <MoonPanel planet={makePlanet({ moon: makeMoon() })} moonsEnabled otherMoons={[{ planetId: 'p-col', name: 'Beta',
          position: { x: 400, y: 0, z: 0 }, rarity: 'COMMON', dockFree: 300, dockCapacity: 470, gateReadyAt: null, closedUntil: null }]} scanTargets={[]} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Moon Gate/i }));
    expect(screen.getByTestId('moon-gate-dest-facts').textContent).toBe('400 units away · 300 room free');
  });
});
