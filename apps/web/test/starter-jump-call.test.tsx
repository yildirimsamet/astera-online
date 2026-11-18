import { STARTER, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { WorldProvider } from '../src/api/world.js';
import i18n from '../src/i18n/index.js';
import { JumpCall, jumpCallQuiet } from '../src/starter/JumpCall.js';
import { VesselScreen } from '../src/starter/VesselScreen.js';
import { StarterLesson } from '../src/starter/tutorial/visualGoal.js';
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

  // Item 24: the guide asks about the jump where it is prepared, whatever the hold.
  it('opens on the drive while the guide asks about the jump or points at it', () => {
    for (const id of ['jumpAsk', 'jumpGo'] as const) {
      const { unmount } = render(wrap(<StarterLesson.Provider value={{ kind: 'step', id, step: 'read', marks: [], chapter: 9, strict: false }}>
        <VesselScreen vessel={ship(repaired, 500, 200)} fetchedAt={Date.now()} />
      </StarterLesson.Provider>));
      expect(driveTab()).toHaveAttribute('aria-selected', 'true');
      unmount();
    }
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

/**
 * ONE ORDER AT A TIME (owner phone playtest 2026-11-18, items 24 and 27). Once the player has chosen to grow
 * first, the guide leads on (the report, the yard's ship) while the call stays where it is: quiet, an option
 * and not an order, so the guide's line and the next-step line are the only things saying what to do.
 */
describe('the call to the jump while the guide leads elsewhere', () => {
  it('is quiet while the guide speaks of anything but the jump', () => {
    expect(jumpCallQuiet({ guided: true, step: { id: 'openReport' } })).toBe(true);
    expect(jumpCallQuiet({ guided: true, step: { id: 'buildShip' } })).toBe(true);
  });

  it('calls as before while the guide is on the jump, is off, or has nothing left to say', () => {
    expect(jumpCallQuiet({ guided: true, step: { id: 'jumpAsk' } })).toBe(false);
    expect(jumpCallQuiet({ guided: true, step: { id: 'jumpGo' } })).toBe(false);
    expect(jumpCallQuiet({ guided: false, step: { id: 'openReport' } })).toBe(false);
    expect(jumpCallQuiet({ guided: true, step: null })).toBe(false);
    expect(jumpCallQuiet(null)).toBe(false);
  });

  it('says when quiet that the jump waits for the player, and still opens the ship', () => {
    const onOpen = vi.fn();
    render(<JumpCall progress={repaired} onOpen={onOpen} quiet />);
    const call = screen.getByRole('button', { name: /jump/iu });
    expect(call).toHaveAttribute('data-quiet', '');
    expect(screen.getByText(i18n.t('starter.jumpCall.later'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('starter.jumpCall.line'))).toBeNull();
    fireEvent.click(call);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('gives the order when it calls', () => {
    render(<JumpCall progress={repaired} onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /jump/iu })).not.toHaveAttribute('data-quiet');
    expect(screen.getByText(i18n.t('starter.jumpCall.line'))).toBeInTheDocument();
  });
});

