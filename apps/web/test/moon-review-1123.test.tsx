import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MOON } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { moonT } from '../src/i18n/moon.js';
import type { PlanetMoon, PlanetView } from '../src/api/schemas.js';
import { MoonPanel, type MoonPanelProps } from '../src/screens/MoonPanel.js';
import { moon as trMoon } from '../src/i18n/locales/tr/moon.js';
import { moon as enMoon } from '../src/i18n/locales/en/moon.js';
import { moon as deMoon } from '../src/i18n/locales/de/moon.js';
import { moon as esMoon } from '../src/i18n/locales/es/moon.js';
import { moon as frMoon } from '../src/i18n/locales/fr/moon.js';
import { moon as jaMoon } from '../src/i18n/locales/ja/moon.js';
import { moonListChanges } from '../src/galaxy/moonOrbit.js';
import { galaxyArticles } from '../src/wiki/galaxy-content.js';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';

/*
  Ay takeover review 2026-11-23 — the Moon page, verified findings:
  U3 build is a hold · F2 research in progress · U7 no fleet chips without a moon · W1 the refusal sits on
  the card that was pressed · W2 an unnamed world is "unknown", never an id · W3 no fake cloaked routes ·
  W5 a busy scanner says so · U1 moves listed once · U2 the header explains durability in place ·
  U4 rule numbers come from the rules · W6 the Wiki's moon numbers are the rules' · W8 the first birth plays.
*/
const moon = (over: Partial<PlanetMoon> = {}): PlanetMoon => ({
  rarity: 'RARE', origin: 'BATTLE', cracks: 2, crackLimit: 5, lastHitAt: new Date(Date.now() - 3_600_000),
  gateReadyAt: null, closedUntil: null, visualSeed: 42, fleet: { DART: 10 }, dockUsed: 100, dockCapacity: 1550,
  dockFree: 1450, scanRange: 2250, scanPierces: false, moves: [], ...over,
});

const planet = (over: { moon?: PlanetMoon | null; lunarCapture?: boolean; researching?: boolean; fleet?: Record<string, number> } = {}): PlanetView => ({
  planet: { id: 'p-home', name: 'Alpha', alloy: 50_000, crystal: 30_000, deuterium: 2_000, position: { x: 0, y: 0, z: 0 } },
  buildings: { CORE: 10 },
  fleet: over.fleet ?? { DART: 8 },
  research: [{ id: 'LUNAR_CAPTURE', level: over.lunarCapture === false ? 0 : 1 }],
  researchQueue: over.researching ? [{
    id: 'r1', slot: 0, projectId: 'LUNAR_CAPTURE', level: 1, cost: { alloy: 0, crystal: 0, deuterium: 0 },
    startedAt: new Date(Date.now() - 60_000), finishesAt: new Date(Date.now() + 2 * 3_600_000), pausedAt: null,
  }] : [],
  queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] },
  moon: over.moon === undefined ? null : over.moon,
} as unknown as PlanetView);

const show = (props: Partial<MoonPanelProps> & { planet: PlanetView }) => render(
  <I18nextProvider i18n={i18n}>
    <MoonPanel moonsEnabled otherMoons={[]} scanTargets={[]} {...props} />
  </I18nextProvider>,
);

describe('Moon page — takeover review', () => {
  it('U3: building a moon is a hold, not a tap', async () => {
    const onOrderMoon = vi.fn().mockResolvedValue(undefined);
    show({ planet: planet(), onOrderMoon });
    const hold = within(screen.getByTestId('moon-panel-empty')).getByRole('button', { name: new RegExp(moonT('build.action')) });
    fireEvent.click(hold);
    expect(onOrderMoon).not.toHaveBeenCalled();
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(hold, { button: 0 });
      await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
      fireEvent.pointerUp(hold);
    } finally { vi.useRealTimers(); }
    expect(onOrderMoon).toHaveBeenCalledWith('p-home');
  });

  it('F2: while Lunar Capture is being researched, the card says so instead of "research first"', () => {
    show({ planet: planet({ lunarCapture: false, researching: true }) });
    const card = screen.getByTestId('moon-panel-empty');
    expect(within(card).getByTestId('moon-research-running')).toBeDefined();
    expect(within(card).queryByText(moonT('build.needResearch'))).toBeNull();
  });

  it('owner 2026-11-24: without Lunar Capture the card says "research first" once and its one action is the research', () => {
    const onOpenResearch = vi.fn();
    show({ planet: planet({ lunarCapture: false }), onOpenResearch });
    const card = screen.getByTestId('moon-panel-empty');
    expect(within(card).getAllByText(moonT('build.needResearch'))).toHaveLength(1);
    expect(within(card).queryByTestId('moon-build-btn')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: new RegExp(moonT('guide.openResearch'), 'i') }));
    expect(onOpenResearch).toHaveBeenCalledTimes(1);
  });

  it('U7: without a moon the page does not list the planet fleet', () => {
    show({ planet: planet() });
    expect(within(screen.getByTestId('moon-panel-empty')).queryByText(moonT('fleetSplit.planet'))).toBeNull();
  });

  it('W1: a refused hop is told on the hop card itself', async () => {
    const onHop = vi.fn().mockRejectedValue(new Error('nope'));
    show({ planet: planet({ moon: moon() }), onHop });
    const card = screen.getByTestId('moon-hop-card');
    fireEvent.click(within(card).getByTestId('moon-hop-select-all'));
    await act(async () => { fireEvent.click(within(card).getByTestId('moon-hop-submit')); await Promise.resolve(); });
    expect(within(card).getByRole('alert')).toBeDefined();
  });

  it('W2 + W3: an unnamed world reads as unknown, and no route is drawn as cloaked', async () => {
    const onScanVisual = vi.fn();
    const onScan = vi.fn().mockResolvedValue({
      id: 's1', scannedAt: new Date(), pierced: true,
      rows: [{ direction: 'IN', otherPlanetId: 'deadbeef-0000-0000-0000-000000000000', arriveAt: new Date(Date.now() + 60_000), size: 'LIGHT' }],
    });
    show({ planet: planet({ moon: moon({ scanPierces: true }) }), onScan, onScanVisual,
      scanTargets: [{ planetId: 'p-enemy', name: 'Gamma', distance: 600 }] });
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(moonT('tabs.scan')) }));
    await act(async () => { fireEvent.click(screen.getByTestId('moon-scan-btn')); await Promise.resolve(); });
    const result = screen.getByTestId('moon-scan-result');
    expect(result.textContent).not.toContain('deadbeef');
    expect(result.textContent).toContain(moonT('scan.unknownWorld'));
    const routes = onScanVisual.mock.calls[0]?.[3] as readonly { cloaked?: boolean }[];
    expect(routes.every((route) => route.cloaked !== true)).toBe(true);
  });

  it('W5: a scan in flight says it is scanning', async () => {
    const onScan = vi.fn().mockReturnValue(new Promise(() => undefined));
    show({ planet: planet({ moon: moon() }), onScan, scanTargets: [{ planetId: 'p-enemy', name: 'Gamma', distance: 600 }] });
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(moonT('tabs.scan')) }));
    await act(async () => { fireEvent.click(screen.getByTestId('moon-scan-btn')); await Promise.resolve(); });
    expect(screen.getByTestId('moon-scan-btn').textContent).toContain(moonT('scan.scanning'));
  });

  it('U1: a move in progress is listed once', () => {
    const now = Date.now();
    show({ planet: planet({ moon: moon({ moves: [{
      id: 'mv', kind: 'HOP_UP', fromPlanetId: 'p-home', toPlanetId: 'p-home', fleet: { DART: 3 },
      departAt: new Date(now - 10_000), arriveAt: new Date(now + 80_000),
    }] }) }) });
    expect(screen.getAllByText(new RegExp(moonT('hop.movingUp')))).toHaveLength(1);
  });

  it('U2: no bare "?" button; the heal timer says what it counts down to', () => {
    show({ planet: planet({ moon: moon() }) });
    expect(screen.getAllByRole('button').some((button) => button.textContent.trim() === '?')).toBe(false);
    expect(screen.getByTestId('moon-heal').textContent).toContain(moonT('status.healShort', { time: '' }).trim());
  });

  it('U4: rule copy in every language carries no hand-typed numbers', () => {
    const keys = [
      ['build', 'subtitle'], ['guide', 'wayBuild'], ['guide', 'headerRule'], ['guide', 'dockRule'], ['guide', 'gateRule'],
      ['guide', 'scanRule'], ['hop', 'subtitle'], ['gate', 'subtitle'], ['body', 'deathStarMoonHint'], ['scan', 'action'], ['scan', 'subtitle'],
      ['scan', 'historyEmpty'], ['build', 'needResearch'],
    ] as const;
    for (const locale of [trMoon, enMoon, deMoon, esMoon, frMoon, jaMoon]) {
      for (const [group, key] of keys) {
        const text: string = (locale[group] as Record<string, string>)[key] ?? '';
        // "1 durability" and "at 0" are the rule's shape, not a tuned number; anything else must come from MOON.
        expect(text.replace(/\{\{[^}]+\}\}/g, ''), `${group}.${key}`).not.toMatch(/[2-9]|[0-9]{2,}/);
      }
    }
  });

  it('W6: the Wiki moon page states the rules’ own dock and Gözcü numbers', () => {
    const topic = galaxyArticles.find((entry) => entry.id === 'galaxy.moons');
    const text = JSON.stringify(topic);
    for (const n of [MOON.gateCapacity.RARE, MOON.gateCapacity.EPIC, MOON.scanRange.RARE, MOON.scanRange.EPIC]) {
      expect(text).toMatch(new RegExp(n.toLocaleString('en-US')));
    }
    expect(text).not.toMatch(/1,600|3,700|2,500 Gözcü|3,200/);
  });

  it('W8: the first moon a galaxy ever sees is a birth, even after an empty first load', () => {
    let state = moonListChanges({ hydrated: false, known: new Set() }, []);
    expect(state.births).toEqual([]);
    state = moonListChanges(state, ['p-1']);
    expect(state.births).toEqual(['p-1']);
    expect(moonListChanges(state, []).gone).toEqual(['p-1']);
  });

  it('only a Gözcü refusal says Gözcü: a ship or probe out of reach keeps its own sentence', async () => {
    await i18n.changeLanguage('en');
    expect(describeError(new ApiError('OUT_OF_RANGE', 'raw', 409, { context: 'gozcu' }))).toBe(moonT('errors.OUT_OF_RANGE'));
    const ship = describeError(new ApiError('OUT_OF_RANGE', 'raw', 409, { context: 'ship', reach: 340 }));
    expect(ship).not.toContain('Gözcü');
    expect(ship).toContain('340');
  });

  it('gate card: the chosen destination’s distance and free room, and both gates’ recharge, are on the card', () => {
    show({ planet: planet({ moon: moon() }), otherMoons: [{
      planetId: 'p-2', name: 'Beta', position: { x: 300, y: 0, z: 0 }, rarity: 'LEGENDARY', dockFree: 5_000, dockCapacity: 7_270,
    }] });
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(moonT('tabs.gate')) }));
    const card = screen.getByTestId('moon-gate-card');
    expect(within(card).getByTestId('moon-gate-dest-facts').textContent).toContain('300');
    expect(card.textContent).toContain(moonT('gate.rechargeAfter', {
      fromHours: MOON.gateChargeHours.RARE, toHours: MOON.gateChargeHours.LEGENDARY,
    }));
  });

  it('English names the room ships take as space, not "bulk"', () => {
    for (const text of [enMoon.fleetSplit.bulk, enMoon.picker.selected, enMoon.picker.selectedLimit, enMoon.picker.fillGate]) {
      expect(text.replace(/\{\{[^}]+\}\}/g, '').toLowerCase()).not.toContain('bulk');
      expect(text).not.toContain('Cap');
    }
  });
});
