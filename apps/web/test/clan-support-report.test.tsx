import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReports } from '../src/screens/BattleReports.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the defending line in the battle report (P12): who stood in it,
 * what each lost and kept, and the Dominion each carried. The raider reads names and
 * losses only — the server sends `sent`/`survivors` null to them, and nothing is drawn
 * in their place.
 */

const member = (over: Record<string, unknown>) => ({
  playerId: 'p', name: 'P', role: 'SUPPORT', losses: {}, sent: null, survivors: null, dominion: 0, ...over,
});

const wire = (attacking: boolean) => ({
  kind: 'BATTLE', id: 'r1', missionId: 'm1', at: '2026-10-01T12:00:00Z', grade: 'PARTIAL',
  rounds: [], attacking, opponentName: attacking ? 'Ali' : 'Raider', opponentPlanet: attacking ? 'Vega' : 'Home',
  opponentPlanetId: attacking ? 'vega' : 'home', yourPlanet: attacking ? 'Home' : 'Vega',
  yourPlanetId: attacking ? 'home' : 'vega', neutral: false,
  yourLosses: { DART: 3 }, theirLosses: { PIKE: 5, RAMPART: 1 }, yourFleet: { DART: 40 },
  theirFleet: {}, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: attacking ? 40 : -30,
  shieldAbsorbed: 0, cargoLimited: false, defenceSalvage: {},
  defenseLine: {
    defenderCount: 2,
    dominionFactor: 1.5,
    members: [
      member({ playerId: 'ali', name: 'Ali', role: 'HOST', losses: { RAMPART: 1 }, dominion: -30,
        ...(attacking ? {} : { sent: { RAMPART: 6 }, survivors: { RAMPART: 5 } }) }),
      member({ playerId: 'zey', name: 'Zeynep', losses: { PIKE: 5 }, dominion: 0,
        ...(attacking ? {} : { sent: { PIKE: 12 }, survivors: { PIKE: 7 } }) }),
    ],
  },
});

async function open(attacking: boolean) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ reports: [wire(attacking)], rivals: [] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}><BattleReports /></ApiProvider></QueryClientProvider>);
  await userEvent.click(await screen.findByRole('button', { name: attacking ? /Ali/ : /Raider/ }));
  return screen.getByRole('region', { name: /defending line/i });
}

beforeEach(async () => {
  const i18n = (await import('../src/i18n/index.js')).default;
  await i18n.changeLanguage('en');
});

describe('the defending line in a battle report', () => {
  it('lists the host first and every supporter, with what each lost, kept and carried', async () => {
    const line = await open(false);
    const rows = within(line).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Ali')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/^host$/i)).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/lost 1/)).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/kept 5/)).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/−30/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Zeynep')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/kept 7/)).toBeInTheDocument();
    // Only the host's Dominion moves (owner, 2026-10-02): a supporter's row carries none.
    expect(within(rows[1]!).queryByText(/dominion/i)).toBeNull();
    // The factor multiplies the host's OWN fight; the total's sign can be the supporters'
    // losses, so the line names no direction (the rule under it says which way each goes).
    expect(within(line).getByText(/support ×1\.5 · the host’s own fight was multiplied by it/i)).toBeInTheDocument();
    expect(within(line).queryByText(/grew|shrank/i)).toBeNull();
    expect(within(line).getByText(/only the host’s dominion changes/i)).toHaveTextContent(/supporters’ permanent ship losses are added separately at resource value/i);
  });

  it('shows the raider names and losses, and nothing about what survived', async () => {
    const line = await open(true);
    const rows = within(line).getAllByRole('listitem');
    expect(within(rows[1]!).getByText(/lost 5/)).toBeInTheDocument();
    expect(within(line).queryByText(/kept/)).toBeNull();
  });
});

describe('a joint war against a supported line', () => {
  beforeEach(async () => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage('en');
  });

  it('sets the attackers against the one defender whose Dominion moves', async () => {
    const joint = {
      ...wire(true),
      jointWar: {
        operationId: 'op', clan: { id: 'c', name: 'Nova', tag: 'NOVA' }, coordinatorPlayerId: 'lead',
        target: { playerId: 'ali', planetId: 'vega', name: 'Vega', x: 0, y: 0, z: 0 },
        attackerCount: 2, defenderCount: 2, baseExchange: 900, adjustedTransfer: 600,
        sent: { DART: 80 }, losses: { DART: 6 }, survivors: { DART: 74 },
        participants: [],
      },
    };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ reports: [joint], rivals: [] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    render(<QueryClientProvider client={client}><ApiProvider api={api}><BattleReports /></ApiProvider></QueryClientProvider>);
    await userEvent.click(await screen.findByRole('button', { name: /Ali/ }));
    expect(screen.getByText(/2 attackers vs 1 defender/i)).toBeInTheDocument();
  });
});

describe('a supporter’s report', () => {
  beforeEach(async () => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage('en');
  });

  /*
    The fight was at a clanmate's world, so the supporter has no world in it: the report
    names the line they stood in, and its verdict is the line's — never "your defence".
  */
  it('names the clanmate’s line and world instead of a world of the reader’s own', async () => {
    const supporting = {
      ...wire(false),
      yourPlanet: '', yourPlanetId: null,
      supportedAt: { planetId: 'vega', planetName: 'Vega', hostName: 'Ali' },
    };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ reports: [supporting], rivals: [] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
    render(<QueryClientProvider client={client}><ApiProvider api={api}><BattleReports /></ApiProvider></QueryClientProvider>);
    const row = await screen.findByRole('button', { name: /Raider/ });
    expect(row).toHaveTextContent(/raided in Ali’s line by/i);
    expect(screen.getByText('Vega')).toBeInTheDocument();
    await userEvent.click(row);
    expect(screen.getAllByText(/the line you stood in was partly breached/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/your defence was partly breached/i)).toBeNull();
    expect(screen.getByText(/you stood in Ali’s line at Vega/i)).toBeInTheDocument();
    expect(screen.getByText(/battle report · Vega/i)).toBeInTheDocument();
  });
});
