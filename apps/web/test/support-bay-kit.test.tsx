import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { planetSchema, type PlanetView } from '../src/api/schemas.js';
import { clockTime } from '../src/lib/time.js';
import { ClanSupportBay, DefencePostureCard } from '../src/screens/ClanSupportBay.js';
import { planetView } from './fixtures.js';

/**
 * G2-h3 (2026-11-15): THE DEFENCE POSTURE AND THE CLAN SUPPORT BAY ON THE GAME KIT. Under the
 * Hangar the host decides two things — does my fleet lift off an overwhelming raid, do I let
 * clanmates stand here — and reads who stands guard and at what stakes. A switch is the
 * decision itself: flipping it applies it, as a breaker does, with no form to save. Sending
 * ships home (closing the door on standing waves, or one wave) is a short hold, the weight the
 * owner gave the confirm dialogs it replaces (2026-11-14).
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

function world(escape: boolean, support: boolean, options: {
  locked?: boolean; waves?: ReturnType<typeof wave>[]; used?: number; reserved?: number;
} = {}): PlanetView {
  const posture = escape && support ? 'ESCAPE_SUPPORT' : escape ? 'ESCAPE' : support ? 'SUPPORT' : 'HOLD';
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...planetView(),
    rulesetVersion: 15,
    defencePosture: {
      posture: posture === 'ESCAPE_SUPPORT' ? 'SUPPORT' : posture,
      stance: posture,
      escape,
      support,
      supportLocked: options.locked ? 'NOT_IN_CLAN' : null,
    },
    clanSupport: {
      room: { used: options.used ?? 0, reserved: options.reserved ?? 0, total: 470 },
      waves: options.waves ?? [],
    },
  })));
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

function show(node: React.ReactNode, fetch = vi.fn(), honorSoloCredit = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const view = render(<QueryClientProvider client={client}><ApiProvider api={api}>{node}</ApiProvider></QueryClientProvider>);
  return { fetch, ...view };
}

const sent = (fetch: ReturnType<typeof vi.fn>, call = 0): unknown => {
  const [, init] = fetch.mock.calls[call] as [string, RequestInit];
  return JSON.parse(typeof init.body === 'string' ? init.body : '');
};
const toggle = (name: RegExp) => screen.getByRole('switch', { name });

/** Every class the v2 look painted with. */
const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|rounded-chip/;
const v2Painted = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

describe('the defence posture on the kit', () => {
  it('is a kit well of two switches, with no form to save', () => {
    show(<DefencePostureCard planet={world(true, false)} />);
    const card = document.querySelector('[data-defence-posture]')!;
    expect(card).toHaveClass('gk-well');
    expect(toggle(/tactical retreat/i)).toHaveClass('gk-toggle');
    expect(toggle(/tactical retreat/i)).toHaveAttribute('aria-checked', 'true');
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: /^save/i })).toBeNull();
  });

  it('applies a switch the moment it is flipped', async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ planet: planetView(), returnedWaves: 0 }));
    show(<DefencePostureCard planet={world(true, false)} />, fetch);
    await userEvent.click(toggle(/clan support/i));
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => { expect(fetch).toHaveBeenCalledTimes(1); });
    expect((fetch.mock.calls[0] as [string])[0]).toContain('/defence-posture');
    expect(sent(fetch)).toEqual({ escape: true, support: true });
  });

  it('puts the switch back and says why when the server refuses', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'NOT_IN_CLAN', message: 'Clan support needs a clan' } }), {
      status: 403, headers: { 'content-type': 'application/json' },
    }));
    show(<DefencePostureCard planet={world(true, false)} />, fetch);
    await userEvent.click(toggle(/clan support/i));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'false');
  });

  it('asks with a short hold before closing the door on standing waves, and Keep leaves it open', async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ planet: planetView(), returnedWaves: 1 }));
    show(<DefencePostureCard planet={world(true, true, { waves: [wave()] })} />, fetch);
    await userEvent.click(toggle(/clan support/i));
    expect(fetch).not.toHaveBeenCalled();
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/1 support wave home/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /keep support/i }));
    expect(screen.queryByText(/1 support wave home/i)).toBeNull();

    await userEvent.click(toggle(/clan support/i));
    const hold = screen.getByRole('button', { name: /^send home/i });
    expect(hold).toHaveClass('gk-hold', 'gk-hold--md');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('600ms');
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    await waitFor(() => { expect(fetch).toHaveBeenCalledTimes(1); });
    expect(sent(fetch)).toEqual({ escape: true, support: false });
  });

  it('keeps a locked switch still and says why outside a clan', async () => {
    const fetch = vi.fn();
    show(<DefencePostureCard planet={world(true, false, { locked: true })} />, fetch);
    expect(toggle(/clan support/i)).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(toggle(/clan support/i));
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'false');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/join a clan/i)).toBeInTheDocument();
  });

  it('states the Honor rule on a kit banner where the season shares it', () => {
    show(<DefencePostureCard planet={world(false, false)} />, vi.fn(), true);
    const notice = document.querySelector('[data-honor-shared-policy] .gk-banner')!;
    expect(notice).not.toBeNull();
    expect(notice).toHaveTextContent(/Shared sides cannot earn positive Honor/);
  });

  it('leaves none of the v2 look, in any state', () => {
    const states = [world(true, false), world(false, false), world(true, true), world(true, false, { locked: true })];
    for (const planet of states) {
      const { unmount } = show(<DefencePostureCard planet={planet} />, vi.fn(), true);
      expect(v2Painted(document.querySelector('[data-defence-posture]')!)).toEqual([]);
      unmount();
    }
  });
});

describe('the clan support bay on the kit', () => {
  const lands = new Date(Date.now() + 6 * 60_000);
  const two = () => world(false, true, { used: 140, reserved: 20, waves: [wave(), wave({
    id: 'wave-2', status: 'OUTBOUND', sender: { playerId: 'zeynep', name: 'Zeynep' },
    fleet: { DART: 8 }, bulk: 20, stationedAt: null, expiresAt: null,
    arriveAt: lands.toISOString(),
  })] });

  it('reads the bay as a kit gauge with who stands and who flies in', () => {
    show(<ClanSupportBay planet={two()} />);
    const bay = document.querySelector('[data-support-bay]')!;
    expect(bay).toHaveClass('gk-well');
    expect(bay.querySelector('[data-part="standing"]')).not.toBeNull();
    expect(bay.querySelector('[data-part="inbound"]')).not.toBeNull();
    expect(screen.getByRole('img', { name: /160 of 470 support room/i })).toBeInTheDocument();
  });

  it('draws each wave on a ring row: the time it stays, or the clock it lands', () => {
    show(<ClanSupportBay planet={two()} />);
    const [standing, inbound] = screen.getAllByRole('listitem');
    expect(standing!.querySelector('.gk-trow')).toHaveTextContent('Ali');
    expect(within(standing!).getByText('left')).toBeInTheDocument();
    expect(inbound!.querySelector('.gk-trow')).toHaveTextContent('Zeynep');
    expect(inbound!.querySelector('.gk-timer__arc')).not.toBeNull();
    expect(within(inbound!).getByText(`at ${clockTime(lands)}`)).toBeInTheDocument();
  });

  it('keeps the stakes in sight and their rule one press away', async () => {
    const base = world(false, true, { waves: [wave({ fleet: { DART: 40 } })] });
    show(<ClanSupportBay planet={{ ...base, fleet: { DART: 40 }, ground: {}, faults: [] }} />);
    expect(screen.getByText(/dominion ×2 · lose ×2, win ÷2/i)).toBeInTheDocument();
    expect(screen.queryByText(/capped at 5/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /how the factor works/i }));
    expect(screen.getByText(/capped at 5/i)).toBeInTheDocument();
  });

  it('marks a damaged wave on a kit chip', () => {
    show(<ClanSupportBay planet={world(false, true, { waves: [wave({ damaged: true })] })} />);
    expect(screen.getByText(/damaged/i)).toHaveClass('gk-sbay__damaged');
  });

  it('sends a wave home only by a short hold that says no fuel comes back', async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ wave: { ...wave(), status: 'RETURNING',
      returnReason: 'SENT_BACK', returnAt: new Date(Date.now() + HOUR).toISOString() } }));
    show(<ClanSupportBay planet={world(false, true, { waves: [wave()] })} />, fetch);
    const hold = screen.getByRole('button', { name: /^send back/i });
    expect(hold).toHaveClass('gk-hold', 'gk-hold--md');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('600ms');
    expect(hold).toHaveTextContent(/no fuel comes back/i);
    await userEvent.click(hold);
    expect(fetch).not.toHaveBeenCalled();
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    await waitFor(() => { expect(fetch).toHaveBeenCalledTimes(1); });
    expect((fetch.mock.calls[0] as [string])[0]).toContain('/api/clan/support/wave-1/send-back');
  });

  it('folds a long list behind a kit button', async () => {
    const waves = ['a', 'b', 'c', 'd', 'e'].map((id) => wave({ id, sender: { playerId: id, name: id.toUpperCase() } }));
    show(<ClanSupportBay planet={world(false, true, { waves })} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    const more = screen.getByRole('button', { name: /show 2 more waves/i });
    expect(more).toHaveClass('gk-btn');
    await userEvent.click(more);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('leaves none of the v2 look, open or closed', () => {
    for (const planet of [two(), world(true, false)]) {
      const { unmount } = show(<ClanSupportBay planet={planet} />);
      expect(v2Painted(document.querySelector('[data-support-bay]')!)).toEqual([]);
      unmount();
    }
  });
});
