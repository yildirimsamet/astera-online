import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const target: GalaxyPlanet = {
  id: 'p2',
  name: 'Tharsis',
  owner: 'Sable',
  position: { x: 120, y: 0, z: 80 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
};

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

describe('choosing a fleet to attack with', () => {
  it('uses exact one-ship steps even for a large hangar and exposes Max', async () => {
    render(
      <LaunchSheet
        target={target}
        planet={planetView({ fleet: { WASP: 200 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    const user = userEvent.setup();
    const quantity = screen.getByRole('textbox', { name: /wasp quantity/i });

    expect(quantity).toHaveValue('0');
    expect(quantity).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: /more wasp/i }));
    expect(quantity).toHaveValue('1');
    await user.click(screen.getByRole('button', { name: /max wasp/i }));
    expect(quantity).toHaveValue('200');
  });
});

/**
 * WHAT IS ALREADY IN THE AIR. Owner report.
 *
 * The sheet offers what is standing on the world, which is correct — nothing in
 * flight can be launched again. What was wrong is that a hull entirely away lost
 * its row and the sheet simply read as a smaller fleet. A raid is a twelve-minute
 * round trip; the player who sent it has often forgotten by the time they open
 * this.
 *
 * The caption may not promise a return: `fleetAway` includes transfer and
 * settlement fleets, which are handed to the destination world and never come
 * home. It states what is true of every mission kind instead.
 */
describe('the fleet that is already away', () => {
  it('names what is in the air, including a hull with nothing left at home', () => {
    render(
      <LaunchSheet
        target={target}
        planet={planetView({
          fleet: { LANCE: 2 },
          fleetAway: { WASP: 83, HAULER: 2 },
        })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    const note = screen.getByText(/away on a flight/i);
    expect(note).toHaveTextContent('83 Wasp');
    expect(note).toHaveTextContent('2 Hauler');
    // The row is genuinely gone — that is the behaviour the note explains.
    expect(screen.queryByRole('textbox', { name: /wasp quantity/i })).toBeNull();
    expect(screen.getByRole('textbox', { name: /lance quantity/i })).toHaveValue('0');
  });

  /**
   * A Prospector cannot be put in an attack fleet, so listing one here would
   * promise a craft this sheet can never send.
   */
  it('says nothing about a mining run', () => {
    render(
      <LaunchSheet
        target={target}
        planet={planetView({ fleet: { WASP: 4 }, fleetAway: { PROSPECTOR: 2 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.queryByText(/away on a flight/i)).toBeNull();
  });

  /**
   * The empty-list message counted `fleet` whole, and `fleet` carries the
   * Prospector — so a world whose only craft at home was a miner showed an empty
   * list with no sentence under it at all.
   */
  it('still says the hangar is empty when the only craft at home is a miner', () => {
    render(
      <LaunchSheet
        target={target}
        planet={planetView({ fleet: { PROSPECTOR: 1 }, fleetAway: { WASP: 12 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.getByText(/no ships at home/i)).toBeInTheDocument();
    expect(screen.getByText(/away on a flight/i)).toHaveTextContent('12 Wasp');
  });
});

/**
 * THE BET, AS A SHAPE. Owner instruction, D142.
 *
 * This sheet's headline has always been a COUNT of units left holding, and a
 * count is the wrong measure of a garrison: twelve Wasps and three Bulwarks are
 * the same number and not remotely the same defence. The bar is made of POWER,
 * and the split between what stays and what leaves is the decision being made —
 * drawn as the thing being taken away from the thing that remains.
 */
describe('what the launch costs the world it leaves', () => {
  const show = (fleet: Record<string, number>, ground: Record<string, number> = {}) => {
    render(
      <LaunchSheet
        target={target}
        planet={planetView({ fleet, ground })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    return {
      holds: () => Number.parseFloat(
        document.querySelector<HTMLElement>('[data-part="holds"]')!.style.width,
      ),
      leaves: () => Number.parseFloat(
        document.querySelector<HTMLElement>('[data-part="leaves"]')!.style.width,
      ),
    };
  };

  it('draws the whole garrison as holding before anything is packed', () => {
    const bar = show({ WASP: 6 });
    expect(bar.holds()).toBeCloseTo(100, 1);
    expect(bar.leaves()).toBeCloseTo(0, 1);
  });

  it('carves the departing fleet out of the garrison as it is packed', async () => {
    const bar = show({ WASP: 4 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more wasp/i }));
    expect(bar.leaves()).toBeCloseTo(25, 1);
    expect(bar.holds()).toBeCloseTo(75, 1);
  });

  /**
   * THE REASON THE BAR IS POWER AND NOT A HULL COUNT. Sending one of two Bulwarks
   * must not look like sending one of two Wasps when the ground battery behind
   * them is unchanged; the fraction of the DEFENCE that leaves is the fact.
   */
  it('measures what leaves by what it was worth, not by how many hulls it was', async () => {
    const user = userEvent.setup();
    const light = show({ WASP: 1, BULWARK: 1 });
    await user.click(screen.getByRole('button', { name: /more wasp/i }));
    const waspShare = light.leaves();
    cleanup();

    const heavy = show({ WASP: 1, BULWARK: 1 });
    await user.click(screen.getByRole('button', { name: /more bulwark/i }));
    expect(heavy.leaves()).toBeGreaterThan(waspShare);
  });

  it('says the split out loud for anyone who cannot see the bar', () => {
    show({ WASP: 3 });
    expect(screen.getByRole('img', { name: /defence power holds/i })).toBeInTheDocument();
  });

  /** A world with nothing standing must not divide by zero. */
  it('survives a world whose every craft is already away', () => {
    expect(() => show({})).not.toThrow();
  });
});

/**
 * THE FUEL IS A SPEND AGAINST A TANK, so it is drawn as one. T6 put the figure on
 * this sheet and turned it red when the tank could not cover it — which says
 * "refused" and not how far off, so a commander ten deuterium short and one a
 * thousand short read the same screen.
 */
describe('the fuel this launch burns', () => {
  const packOne = async (deuterium: number) => {
    render(
      <LaunchSheet
        target={target}
        planet={planetView({ fleet: { WASP: 2 } }, { deuterium })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /more wasp/i }));
  };

  it('draws what is left of the tank when the flight is covered', async () => {
    await packOne(10_000);
    const bar = document.querySelector('[data-spend-bar]');
    expect(bar).toHaveAttribute('data-short', 'false');
    expect(document.querySelector('[data-spend-left]')).toBeInTheDocument();
  });

  it('runs past the end of the tank when it is not, and names the gap', async () => {
    await packOne(0);
    expect(document.querySelector('[data-spend-bar]')).toHaveAttribute('data-short', 'true');
    expect(document.querySelector('[data-spend-short]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send \d+ ships/i })).toBeDisabled();
  });
});
