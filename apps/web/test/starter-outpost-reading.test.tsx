import { fleetCargo, type ClassReading, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, IntelView } from '../src/api/schemas.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';
import { IntelScreen } from '../src/screens/IntelScreen.js';
import { vesselToPlanetView } from '../src/starter/adapter.js';
import { OutpostReading, sealedVictoryCrate } from '../src/starter/OutpostReading.js';
import { setStarterMode, starterFetch } from '../src/starter/transport.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';

/**
 * THE FIRST HUNT'S READING (plan §5.4, F4). Two probe reports side by side: who holds each outpost,
 * the triangle that decides the fight with each ship beside its class, and what the holds can carry
 * home. The inputs and the rule, never the answer.
 */
const NOW = new Date('2026-11-08T12:00:00.000Z').getTime();
/** A probe reads each class's share in whole percents, as the server stores it. */
const WALL: ClassReading = { kind: 'RANGES', shares: { BULWARK: { low: 55, high: 100 }, SKIRMISHER: { low: 0, high: 45 }, LANCE: { low: 0, high: 45 } } };
/** What the yard's two Darts carry home; the miner stays behind. */
const CARRY = fleetCargo({ DART: 2 }, {});
const yard: VesselProgress = { modules: { REFINERY: 3, SURVEY: 1, SHIPYARD: 1 }, facts: ['FIRST_PROBE_REPORT'], parts: 0, fuel: 0 };

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); setStarterMode(false); });

describe('the first victory crate, before the win', () => {
  const crates = (state: 'sealed' | 'ready' | 'opened') => vesselSchema.parse(wireVessel({
    progress: yard,
    crates: [{ id: 'FIRST_OUTPOST_VICTORY', module: 'SHIPYARD', stage: 1, fact: 'FIRST_OUTPOST_VICTORY', alloy: 450, crystal: 200, state }],
  }));

  it('is offered while it is sealed, and not once it is won', () => {
    expect(sealedVictoryCrate(crates('sealed'))).toEqual({ alloy: 450, crystal: 200 });
    expect(sealedVictoryCrate(crates('ready'))).toBeNull();
    expect(sealedVictoryCrate(crates('opened'))).toBeNull();
  });
});

describe('an outpost\'s reading', () => {
  const draw = (over: Partial<Parameters<typeof OutpostReading>[0]> = {}) =>
    render(<OutpostReading reading={WALL} carry={70} stock={{ low: 99, high: 263 }} crate={null} {...over} />);

  it('puts the player\'s own fleet on the triangle, and leaves the verdict to them', () => {
    draw({ own: 'SKIRMISHER' });
    expect(document.querySelector('[data-rung="SKIRMISHER"]')?.hasAttribute('data-own')).toBe(true);
    expect(document.querySelector('[data-rung="BULWARK"]')?.hasAttribute('data-own')).toBe(false);
    expect(document.querySelector('[data-outpost-own]')?.textContent).toContain('Skirmisher');
    expect(document.querySelector('[data-testid="outpost-reading"]')?.textContent).not.toMatch(/\b(win|lose|advantage)\b/i);
  });

  it('says nothing of a fleet it does not have', () => {
    draw();
    expect(document.querySelector('[data-own]')).toBeNull();
    expect(document.querySelector('[data-outpost-own]')).toBeNull();
  });

  it('reads the guard as the probe read it, every class with its range', () => {
    draw();
    const guard = document.querySelector('[data-outpost-guard]');
    expect(guard?.querySelector('[data-guard-class="BULWARK"]')?.textContent).toBe('Bulwark 55–100%');
    expect(guard?.querySelector('[data-guard-class="SKIRMISHER"]')?.textContent).toBe('Skirmisher 0–45%');
    expect(guard?.querySelector('[data-guard-class="LANCE"]')?.textContent).toBe('Lance 0–45%');
  });

  it('reads an older report\'s exact shares in percents too', () => {
    draw({ reading: { kind: 'SHARES', shares: { LANCE: 60, BULWARK: 30, SKIRMISHER: 10 } } });
    const classes = [...document.querySelectorAll('[data-outpost-guard] [data-guard-class]')];
    expect(classes.map(cls => cls.textContent)).toEqual(['Lance 60%', 'Bulwark 30%', 'Skirmisher 10%']);
    expect(document.querySelector('[data-outpost-cycle] [data-lit]')?.getAttribute('data-rung')).toBe('LANCE');
  });

  it('draws the triangle in the order that beats, each class beside the ship that flies it', () => {
    draw();
    const rungs = [...document.querySelectorAll('[data-outpost-cycle] [data-rung]')];
    expect(rungs.map(rung => rung.getAttribute('data-rung'))).toEqual(['SKIRMISHER', 'BULWARK', 'LANCE']);
    expect(rungs.map(rung => rung.textContent)).toEqual([expect.stringMatching(/Skirmisher.*Dart/), expect.stringMatching(/Bulwark.*Warden/), expect.stringMatching(/Lance.*Pike/)]);
    // The arrows' key names the wrap too, so the last class beating the first is read, not guessed.
    expect(document.querySelector('[data-outpost-beats]')?.textContent).toBe('› beats the next · ↺ Lance › Skirmisher');
  });

  it('gives the reading and the rule, and names no ship to bring', () => {
    draw();
    expect(document.body.textContent).not.toMatch(/bring/i);
  });

  it('says what the holds carry against the stock, and warns when they cannot lift its least', () => {
    draw();
    const carry = document.querySelector('[data-outpost-carry]');
    expect(carry?.textContent).toMatch(/70/);
    expect(carry?.textContent).toMatch(/99.263/);
    expect(carry?.hasAttribute('data-short')).toBe(true);
    cleanup();
    draw({ carry: 700 });
    expect(document.querySelector('[data-outpost-carry]')?.hasAttribute('data-short')).toBe(false);
  });

  it('offers the first victory crate while it is sealed', () => {
    draw({ crate: { alloy: 450, crystal: 200 } });
    expect(document.querySelector('[data-outpost-crate]')?.textContent).toMatch(/450.*200/);
    cleanup();
    draw();
    expect(document.querySelector('[data-outpost-crate]')).toBeNull();
  });

  it('says a guard that is gone is gone', () => {
    draw({ reading: { kind: 'NONE' } });
    expect(document.querySelector('[data-outpost-guard]')?.textContent).toMatch(/no guard/i);
  });
});

const providers = (children: ReactNode) => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queries}><ApiProvider api={new Api({ fetch: vi.fn<typeof globalThis.fetch>(), authTransport: null })}><WorldProvider><ToastProvider>
    {children}
  </ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>);
};
const report = (over: Record<string, unknown> = {}) => ({
  targetPlanetId: 'post', targetName: 'Solen', targetUsername: 'Solen', at: new Date(NOW - 60_000), accuracy: 0.55,
  stock: { low: 99, high: 263 }, deuteriumStock: null, defence: { low: 595, high: 1570 }, fleetSize: { low: 0, high: 3 },
  fleetHome: true, detected: false, outpost: true, classReading: WALL, ...over,
});

describe('the outpost card', () => {
  const outpost = { id: 'post', name: 'Solen', body: 'OUTPOST', position: { x: 60, y: 0, z: 0 }, coreTier: 1, coreLevel: 1, intel: 'RESOLVED',
    state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, kind: 'NEUTRAL' } as unknown as GalaxyPlanet;
  const open = (probeReports: IntelView['probeReports']) => {
    const intel: IntelView = { watching: [], probeReports, probeCooldowns: [], radarLog: [], probeCost: { alloy: 65, crystal: 40, deuterium: 0 } };
    const ship = vesselSchema.parse(wireVessel({ progress: yard, fleet: { DART: 2, PROSPECTOR: 1 } }));
    providers(<PlanetFocus target={outpost} planet={vesselToPlanetView(ship)} intel={intel} reports={[]} now={NOW} onClose={vi.fn()} onAttack={vi.fn()}
      onInstallTelescope={vi.fn()} onLaunched={vi.fn()} onSettle={vi.fn()} open onToggle={vi.fn()} />);
  };

  it('says the holds limit the take, with what this fleet carries', () => {
    open([]);
    expect(screen.getAllByTestId('outpost-rule')[0]?.textContent).toContain(`carry ${String(CARRY)}`);
  });

  it('reads the guard and the triangle once a probe has been there', () => {
    open([report()]);
    expect(document.querySelector('[data-testid="outpost-reading"] [data-outpost-guard]')).not.toBeNull();
    expect(document.querySelector('[data-testid="outpost-reading"] [data-outpost-cycle]')).not.toBeNull();
  });

  it('reads nothing it has not paid for', () => {
    open([]);
    expect(document.querySelector('[data-testid="outpost-reading"]')).toBeNull();
  });
});

describe('an outpost\'s probe report on the intel page', () => {
  const draw = async (reports: object[], onOpenDossier?: (id: string) => void, won = false) => {
    const answer = (path: string) => {
      if (path.includes('/intel')) return { watching: [], radarLog: [], probeReports: reports, probeCost: { alloy: 1, crystal: 1, deuterium: 0 } };
      if (path.includes('/galaxy')) return { you: { planetId: 'ship-1', playerId: 'ship-1' }, planets: [], rivals: [], result: null };
      return { vessel: wireVessel({ progress: won ? { ...yard, facts: [...yard.facts, 'FIRST_OUTPOST_VICTORY'] } : yard, fleet: { DART: 2 } }) };
    };
    const fetch = vi.fn((input: RequestInfo | URL) => Promise.resolve(new Response(JSON.stringify(answer(urlOf(input))), { status: 200, headers: { 'content-type': 'application/json' } })));
    setStarterMode(true);
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queries}><ApiProvider api={new Api({ fetch: starterFetch(fetch, () => true) })}><IntelScreen onOpenOrbit={() => undefined} {...(onOpenDossier ? { onOpenDossier } : {})} /></ApiProvider></QueryClientProvider>);
    await screen.findAllByText(/Telescope/);
    fireEvent.click(screen.getByRole('tab', { name: /Reports/ }));
  };

  it('reads its guard, the triangle and the holds, under the outpost\'s own name and picture', async () => {
    await draw([report(), report({ targetPlanetId: 'them', targetName: 'Ember', targetUsername: 'Ember', outpost: undefined, classReading: undefined, repair: { low: 30, high: 50 } })]);
    const reports = await screen.findAllByTestId('outpost-reading');
    expect(reports).toHaveLength(1);
    expect(reports[0]?.querySelector('[data-outpost-carry]')?.textContent).toContain(String(CARRY));
    expect(screen.getAllByText('Solen')).toHaveLength(1);
    const card = reports[0]?.closest('article');
    expect(card?.querySelector('img')?.getAttribute('src')).not.toMatch(/hero-/);
  });

  // Owner playtest 2026-11-08: "ne yapmam bekleniyor saldırmam mı lazım nasıl saldırıcam? Tıklıyom bişey olmuyor".
  it('says how to compare the two and what to do next, while the first hunt is on', async () => {
    await draw([report()], vi.fn());
    const how = await screen.findByTestId('hunt-howto');
    expect(how.textContent).toMatch(/guard/i);
    expect(how.textContent).toMatch(/line/i);
    expect(how.textContent).toMatch(/Attack/);
  });

  it('gives each outpost a door to its attack', async () => {
    const onOpenDossier = vi.fn();
    await draw([report(), report({ targetPlanetId: 'b2', targetName: 'Kora', targetUsername: 'Kora' })], onOpenDossier);
    const doors = await screen.findAllByRole('button', { name: 'Attack' });
    expect(doors).toHaveLength(2);
    fireEvent.click(doors[1]!);
    expect(onOpenDossier).toHaveBeenCalledWith('b2');
  });

  it('opens the same door from the outpost\'s name', async () => {
    const onOpenDossier = vi.fn();
    await draw([report()], onOpenDossier);
    fireEvent.click(await screen.findByRole('button', { name: /Solen/ }));
    expect(onOpenDossier).toHaveBeenCalledWith(report().targetPlanetId);
  });

  it('stops explaining once the first outpost has fallen', async () => {
    await draw([report()], vi.fn(), true);
    await screen.findAllByTestId('outpost-reading');
    expect(screen.queryByTestId('hunt-howto')).toBeNull();
  });

  it('leaves a player\'s report as it was: no door to an attack from here', async () => {
    await draw([report({ targetPlanetId: 'them', targetName: 'Ember', targetUsername: 'Ember', outpost: undefined, classReading: undefined })], vi.fn());
    await screen.findByText('Ember');
    expect(screen.queryByRole('button', { name: 'Attack' })).toBeNull();
    expect(screen.queryByTestId('hunt-howto')).toBeNull();
  });
});
