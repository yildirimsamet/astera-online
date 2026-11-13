import { STARTER, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import i18n from '../src/i18n/index.js';
import { JumpCall } from '../src/starter/JumpCall.js';
import { VesselScreen } from '../src/starter/VesselScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { wireVessel } from './starterVesselFixture.js';

/**
 * A SHIP THAT CAN LEAVE SAYS SO WHERE THE PLAYER IS (owner playtest 2026-11-09). The galaxy carries a
 * call to the jump once the first loop is done (plan 2026-11-13 §4.3). The ship opens on the drive once
 * the hold is full, when leaving is the advice; while it has room the ship opens on its repairs.
 */
const repaired: VesselProgress = {
  modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 },
  facts: ['FIRST_MINING_SENT', 'FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'],
  parts: 0,
  fuel: 0,
};

const ship = (progress: VesselProgress, alloy: number = STARTER.carry.alloy, crystal: number = STARTER.carry.crystal) =>
  vesselSchema.parse(wireVessel({ alloy, crystal, deuterium: 200, progress }));

const wrap = (children: React.ReactNode) => {
  const fetch: typeof globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'NOPE', message: 'nope' }), { status: 404 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><ApiProvider api={new Api({ fetch, authTransport: null })}><WorldProvider><ToastProvider>{children}</ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>;
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('a ship ready to leave', () => {
  const driveTab = () => screen.getAllByRole('tab').find(tab => tab.getAttribute('data-guide') === 'system-DRIVE');

  it('opens on the drive once the hold is full, where the jump is prepared', () => {
    render(wrap(<VesselScreen vessel={ship(repaired)} fetchedAt={Date.now()} />));
    expect(driveTab()).toHaveAttribute('aria-selected', 'true');
  });

  it('opens on its repairs while the hold still has room', () => {
    render(wrap(<VesselScreen vessel={ship(repaired, 500, 200)} fetchedAt={Date.now()} />));
    expect(driveTab()).toHaveAttribute('aria-selected', 'false');
  });

  it('calls the player to the jump from the galaxy, and the call opens the ship', () => {
    const onOpen = vi.fn();
    render(<JumpCall progress={repaired} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /jump/iu }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('says nothing before the first loop is done', () => {
    const { container } = render(<JumpCall progress={{ ...repaired, facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN'] }} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
