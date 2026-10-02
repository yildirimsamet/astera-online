import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { planetSchema, type PlanetView } from '../src/api/schemas.js';
import { ClanSupportBay, DefencePostureCard } from '../src/screens/ClanSupportBay.js';
import { EscapeReadout } from '../src/ui/EscapeReadout.js';
import { planetView } from './fixtures.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the Hangar page's two toggles and its support bay (P12).
 */

const HOUR = 3_600_000;
const wave = (over: Record<string, unknown> = {}) => ({
  id: 'wave-1',
  status: 'STATIONED',
  sender: { playerId: 'ali', name: 'Ali' },
  host: { playerId: 'me', name: 'Me' },
  originPlanetId: 'origin',
  hostPlanetId: 'world',
  hostPlanetName: 'Vega',
  fleet: { PIKE: 12, RAMPART: 4 },
  bulk: 140,
  damaged: false,
  sentAt: new Date(Date.now() - HOUR).toISOString(),
  arriveAt: new Date(Date.now() - HOUR / 2).toISOString(),
  stationedAt: new Date(Date.now() - HOUR / 2).toISOString(),
  expiresAt: new Date(Date.now() + 11 * HOUR).toISOString(),
  returnAt: null,
  returnReason: null,
  outOfBand: false,
  battles: 0,
  ...over,
});

function world(posture: 'ESCAPE' | 'SUPPORT' | 'HOLD', options: {
  locked?: boolean; waves?: ReturnType<typeof wave>[]; used?: number; reserved?: number;
} = {}): PlanetView {
  const base = planetView();
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...base,
    rulesetVersion: 15,
    defencePosture: {
      posture,
      escape: posture === 'ESCAPE',
      support: posture === 'SUPPORT',
      supportLocked: options.locked ? 'NOT_IN_CLAN' : null,
    },
    clanSupport: {
      room: { used: options.used ?? 0, reserved: options.reserved ?? 0, total: 470 },
      waves: options.waves ?? [],
    },
  })));
}

function show(node: React.ReactNode, fetch = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>{node}</ApiProvider></QueryClientProvider>);
  return { api, fetch };
}

const toggle = (name: RegExp) => screen.getByRole('checkbox', { name });

describe('the defence posture card', () => {
  it('shows the retreat on and support off by default, and says what each does', () => {
    show(<DefencePostureCard planet={world('ESCAPE')} />);
    expect(toggle(/tactical retreat/i)).toHaveAttribute('aria-checked', 'true');
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/lifts off and survives/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save/i })).toBeDisabled();
  });

  it('turns the retreat off the moment support is turned on, and only then offers Save', async () => {
    const user = userEvent.setup();
    show(<DefencePostureCard planet={world('ESCAPE')} />);
    await user.click(toggle(/clan support/i));
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'true');
    expect(toggle(/tactical retreat/i)).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /^save/i })).toBeEnabled();
  });

  it('lets both be off — and says the fleet then always fights', async () => {
    const user = userEvent.setup();
    show(<DefencePostureCard planet={world('ESCAPE')} />);
    await user.click(toggle(/tactical retreat/i));
    expect(toggle(/tactical retreat/i)).toHaveAttribute('aria-checked', 'false');
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/always fights/i)).toBeInTheDocument();
  });

  it('keeps support switched off and says why outside a clan', async () => {
    const user = userEvent.setup();
    show(<DefencePostureCard planet={world('ESCAPE', { locked: true })} />);
    expect(screen.getByText(/join a clan/i)).toBeInTheDocument();
    await user.click(toggle(/clan support/i));
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'false');
  });

  it('asks before a save sends standing waves home', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ planet: planetView(), returnedWaves: 1 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    show(<DefencePostureCard planet={world('SUPPORT', { waves: [wave()] })} />, fetch);
    await user.click(toggle(/tactical retreat/i));
    await user.click(screen.getByRole('button', { name: /^save/i }));
    expect(screen.getByText(/1 support wave home/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /send them home and save/i }));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/defence-posture');
    expect(JSON.parse(typeof init.body === 'string' ? init.body : '')).toEqual({ escape: true, support: false });
  });

  it('is not drawn in a season dealt before the rule', () => {
    const base = planetSchema.parse(JSON.parse(JSON.stringify({ ...planetView(), rulesetVersion: 14 })));
    show(<DefencePostureCard planet={base} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('the clan support bay', () => {
  it('measures the bay against the world’s own room and lists who stands here', () => {
    show(<ClanSupportBay planet={world('SUPPORT', { used: 140, reserved: 20, waves: [wave(), wave({
      id: 'wave-2', status: 'OUTBOUND', sender: { playerId: 'zeynep', name: 'Zeynep' },
      fleet: { DART: 8 }, bulk: 20, stationedAt: null, expiresAt: null,
      arriveAt: new Date(Date.now() + 6 * 60_000).toISOString(),
    })] })} />);
    expect(screen.getByRole('img', { name: /160 of 470 support room/i })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Ali')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/left/i)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/arrives in/i)).toBeInTheDocument();
    expect(screen.getByText(/never retreats/i)).toBeInTheDocument();
  });

  /*
    THE STAKES THE HOST HAS ACCEPTED (owner, 2026-10-02): the support multiplies the host's
    Dominion by line power ÷ host power, at most ×5. The bay states it for the waves standing
    in band now, against the host's own line.
  */
  it('states the Dominion factor the standing support puts on the host', () => {
    const base = world('SUPPORT', { waves: [wave({ fleet: { DART: 40 } })] });
    // The host's own line: 40 Darts, so equal support doubles the stakes.
    const planet = { ...base, fleet: { DART: 40 }, ground: {}, faults: [] };
    show(<ClanSupportBay planet={planet} />);
    expect(screen.getByText(/dominion ×2 · lose ×2, win ÷2/i)).toBeInTheDocument();
  });

  it('leaves out a wave that drifted out of the band — it would go home before the fight', () => {
    const base = world('SUPPORT', { waves: [wave({ fleet: { DART: 40 }, outOfBand: true })] });
    show(<ClanSupportBay planet={{ ...base, fleet: { DART: 40 }, ground: {}, faults: [] }} />);
    expect(screen.getByText(/dominion ×1/i)).toBeInTheDocument();
  });

  it('flags a damaged wave and one that drifted out of the band', () => {
    show(<ClanSupportBay planet={world('SUPPORT', { waves: [wave({ damaged: true, outOfBand: true })] })} />);
    expect(screen.getByText(/damaged/i)).toBeInTheDocument();
    expect(screen.getByText(/out of tier band/i)).toBeInTheDocument();
  });

  it('sends a wave back after one confirming tap', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ wave: { ...wave(), status: 'RETURNING',
      returnReason: 'SENT_BACK', returnAt: new Date(Date.now() + HOUR).toISOString() } }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    show(<ClanSupportBay planet={world('SUPPORT', { waves: [wave()] })} />, fetch);
    await user.click(screen.getByRole('button', { name: /send back/i }));
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^send back$/i }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch.mock.calls[0] as [string])[0]).toContain('/api/clan/support/wave-1/send-back');
  });

  it('says how to open the bay when support is off and nobody stands here', () => {
    show(<ClanSupportBay planet={world('ESCAPE')} />);
    expect(screen.getByText(/turn on clan support/i)).toBeInTheDocument();
  });

  it('offers no way to open it outside a clan — the card already says to join one', () => {
    show(<ClanSupportBay planet={world('ESCAPE', { locked: true })} />);
    expect(screen.queryByText(/turn on clan support/i)).toBeNull();
  });
});

describe('the Defend tab’s retreat line under a posture', () => {
  const LINE = { DART: 40 };

  it('says the fleet never retreats while clan support is on, and where to change it', () => {
    render(<EscapeReadout fleet={LINE} ground={{}} deuterium={500} rulesetVersion={15} posture="SUPPORT" />);
    const line = screen.getByTestId('escape-readout');
    expect(line).toHaveTextContent(/never retreats/i);
    expect(line).toHaveTextContent(/hangar/i);
    expect(line).not.toHaveTextContent(/firepower/i);
  });

  it('says the fleet fights every raid with both off', () => {
    render(<EscapeReadout fleet={LINE} ground={{}} deuterium={500} rulesetVersion={15} posture="HOLD" />);
    expect(screen.getByTestId('escape-readout')).toHaveTextContent(/fights every raid/i);
  });

  it('keeps the retreat figure under the default posture', () => {
    render(<EscapeReadout fleet={LINE} ground={{}} deuterium={500} rulesetVersion={15} posture="ESCAPE" />);
    expect(screen.getByTestId('escape-readout')).not.toHaveTextContent(/never retreats/i);
  });
});
