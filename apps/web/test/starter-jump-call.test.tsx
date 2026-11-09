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
 * call to the jump, and the ship opens on the drive, where "prepare the jump" is: it used to open on
 * the refinery, with every repair done and the way out one tab away.
 */
const repaired: VesselProgress = {
  modules: { REFINERY: 4, EXTRACTOR: 3, TELESCOPE: 1, RADAR: 1, SURVEY: 2, SHIPYARD: 1, VAULT: 1, HANGAR: 2, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1, DRIVE_THRUST: 1 },
  facts: ['FIRST_MINING_SENT', 'FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_OUTPOST_VICTORY'],
  parts: 0,
  fuel: STARTER.fuelForJump,
};

const ship = (progress: VesselProgress) => vesselSchema.parse(wireVessel({ alloy: 4000, crystal: 1500, deuterium: 200, progress }));

const wrap = (children: React.ReactNode) => {
  const fetch: typeof globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'NOPE', message: 'nope' }), { status: 404 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><ApiProvider api={new Api({ fetch, authTransport: null })}><WorldProvider><ToastProvider>{children}</ToastProvider></WorldProvider></ApiProvider></QueryClientProvider>;
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('a ship ready to leave', () => {
  it('opens on the drive, where the jump is prepared', () => {
    render(wrap(<VesselScreen vessel={ship(repaired)} fetchedAt={Date.now()} />));
    const drive = screen.getAllByRole('tab').find(tab => tab.getAttribute('data-guide') === 'system-DRIVE');
    expect(drive).toHaveAttribute('aria-selected', 'true');
  });

  it('calls the player to the jump from the galaxy, and the call opens the ship', () => {
    const onOpen = vi.fn();
    render(<JumpCall progress={repaired} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /jump/iu }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('says nothing while the tank is not full', () => {
    const { container } = render(<JumpCall progress={{ ...repaired, fuel: STARTER.fuelForJump - 1 }} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
