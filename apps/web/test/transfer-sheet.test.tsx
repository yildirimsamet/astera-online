import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HULLS, hangarCapacity } from '@astera/rules';
import { compact } from '../src/lib/format.js';
import { TransferSheet } from '../src/screens/TransferSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const { mutate, useTransfer } = vi.hoisted(() => {
  const transferMutation = vi.fn();
  return {
    mutate: transferMutation,
    useTransfer: vi.fn((_originPlanetId: string) => ({
      mutate: transferMutation,
      isPending: false,
    })),
  };
});
vi.mock('../src/api/queries.js', () => ({
  useTransfer,
}));

const target = {
  id: 'colony-1',
  name: 'Haven',
  owner: 'Commander',
  kind: 'COLONY' as const,
  controller: { kind: 'PLAYER' as const, playerId: 'player-1', displayName: 'Commander' },
  position: { x: 100, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  satellites: [],
  shielded: false,
  isSelf: false,
  state: { kind: 'NORMAL' as const },
  isOwned: true,
  isCapital: false,
};

describe('world transfer sheet', () => {
  beforeEach(() => {
    mutate.mockReset();
    useTransfer.mockClear();
  });

  it('shows cargo capacity and updates the defence left at origin', async () => {
    const user = userEvent.setup();
    const planet = planetView({
      fleet: { WASP: 2, HAULER: 1 },
      ground: { THORN: 3 },
    }, {
      id: 'capital-1',
      alloy: 10_000,
      crystal: 5_000,
      deuterium: 500,
    });
    render(
      <ToastProvider>
        <TransferSheet
          target={target}
          planet={planet}
          onClose={vi.fn()}
          onLaunched={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(useTransfer).toHaveBeenCalledWith('capital-1');
    expect(screen.getByText(/6 craft remain at origin/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'More Wasp' }));
    expect(screen.getByText(/5 craft remain at origin/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More Hauler' }));
    expect(screen.getByText(new RegExp(`0 / ${compact(HULLS.HAULER.cargo)}`, 'i'))).toBeInTheDocument();
    const alloy = screen.getByRole('slider', { name: /Alloy/i });
    // One Hauler's hold, off the constant — the slider's ceiling IS the cargo.
    const hold = String(HULLS.HAULER.cargo);
    expect(alloy).toHaveAttribute('max', hold);
    fireEvent.change(alloy, { target: { value: hold } });
    expect(alloy).toHaveValue(hold);
    expect(screen.getByRole('button', { name: /transfer — no recall/i })).toBeEnabled();
  });

  it('does not offer a transfer that the owned destination Hangar will reject', async () => {
    const user = userEvent.setup();
    const hangar = hangarCapacity(0);
    render(
      <ToastProvider>
        <TransferSheet
          target={target}
          targetPlanet={planetView({
            fleet: { WASP: hangar },
            capacity: { hangar, hangarUsed: hangar, ground: 100, groundUsed: 0 },
          }, { id: target.id })}
          planet={planetView({ fleet: { WASP: 1 } }, { id: 'capital-1' })}
          onClose={vi.fn()}
          onLaunched={vi.fn()}
        />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'More Wasp' }));
    /*
      THE REFUSAL IS DRAWN, NOT WRITTEN. D142's rule reached this sheet: the
      sentence "Destination Hangar after landing: 40 + 1 / 40" is now the same
      three-part bar the build sheet uses, so the assertion moves from the prose
      to the picture — the room reads as over its ceiling and the card is marked
      FULL. The reading survives in full for a screen reader, which is where the
      figures still have to exist.
    */
    expect(
      screen.getByRole('img', {
        name: new RegExp(`${String(hangar + 1)} of ${String(hangar)} used`, 'i'),
      }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-full]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /transfer — no recall/i })).toBeDisabled();
  });

  /**
   * THE COMPLAINT THIS SECTION EXISTS FOR.
   *
   * The craft list was built from `MOVABLE.filter(count > 0)`, so a commander with
   * no Hauler saw no Hauler ROW — the cargo readout sat at `0 / 0`, all three
   * sliders were pinned at zero, and nothing anywhere said why. The server has
   * refused this for as long as it has existed (`TRANSFER_NEEDS_CARGO_HULL`); the
   * screen simply never spoke the sentence. Ore carriers are now always listed,
   * whether or not the world has any.
   */
  describe('why ore is not moving', () => {
    const render0 = (fleet: Record<string, number>) =>
      render(
        <ToastProvider>
          <TransferSheet
            target={target}
            planet={planetView({ fleet }, { id: 'capital-1', alloy: 10_000, crystal: 5_000 })}
            onClose={vi.fn()}
            onLaunched={vi.fn()}
          />
        </ToastProvider>,
      );

    it('lists the ore carriers even on a world that owns none of them', () => {
      render0({ WASP: 2 });

      for (const name of ['Hauler', 'Runner']) {
        const more = screen.getByRole('button', { name: `More ${name}` });
        expect(more).toBeInTheDocument();
        expect(more).toBeDisabled();
      }
      expect(screen.getAllByText(/none at this world/i).length).toBe(2);
    });

    it('says a world with no carrier cannot move ore at all', () => {
      render0({ WASP: 2 });

      expect(screen.getByText(/no Hauler or Runner/i)).toBeInTheDocument();
      // Never `0 / 0`, which reads as a limit the player is up against when what
      // is true is that there is no hold on this mission at all.
      expect(screen.getByText('Cargo')).toHaveTextContent('Cargo —');
    });

    it('tells a world that owns a carrier to put one in the fleet', () => {
      render0({ WASP: 2, HAULER: 1 });

      expect(screen.getByText(/add a Hauler or Runner/i)).toBeInTheDocument();
      expect(screen.queryByText(/no Hauler or Runner/i)).not.toBeInTheDocument();
    });

    it('cannot be dragged into a load it will not be allowed to send', () => {
      render0({ WASP: 2 });

      for (const resource of [/Alloy/i, /Crystal/i, /Deuterium/i]) {
        expect(screen.getByRole('slider', { name: resource })).toHaveAttribute('max', '0');
      }
    });

    it('drops the notice the moment a carrier is loaded', async () => {
      const user = userEvent.setup();
      render0({ WASP: 2, HAULER: 1 });

      await user.click(screen.getByRole('button', { name: 'More Hauler' }));

      expect(screen.queryByText(/add a Hauler or Runner/i)).not.toBeInTheDocument();
      expect(screen.getByText(new RegExp(`0 / ${compact(HULLS.HAULER.cargo)}`, 'i')))
        .toBeInTheDocument();
    });
  });
});

/**
 * THE COST THIS SHEET NEVER MENTIONED. T6.
 *
 * A transfer burns `missionFuel(fleet, distance, 1)` at launch, and this screen
 * said nothing about it — while offering a deuterium slider that goes all the way
 * to the tank. Load every drop and press send and the server answers
 * `INSUFFICIENT_FUEL`, because its guard is `held − cargo < fuel`. The raid sheet
 * has quoted its fuel since T6; this one is the same launch through another door.
 *
 * A screen may not offer a commitment the server will refuse (D53) — and it may not
 * cause a refusal it cannot explain, which is the worse half: without the figure
 * there is no way to know how much deuterium to leave behind.
 */
describe('what a transfer burns', () => {
  const withFleet = (deuterium: number) => planetView({
    fleet: { HAULER: 4, WASP: 2 },
  }, { id: 'capital-1', alloy: 50_000, crystal: 50_000, deuterium });

  const open = (deuterium: number) => render(
    <ToastProvider>
      <TransferSheet
        target={target}
        planet={withFleet(deuterium)}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />
    </ToastProvider>,
  );

  const load = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'More Hauler' }));
  };

  it('quotes the fuel once a fleet is chosen', async () => {
    const user = userEvent.setup();
    const view = open(50_000);
    await load(user);

    const fuel = view.container.querySelector('[data-transfer-fuel]');
    expect(fuel).toBeInTheDocument();
    expect(fuel?.textContent ?? '').toMatch(/\d/);
  });

  it('says nothing about fuel while nothing is going', () => {
    expect(open(50_000).container.querySelector('[data-transfer-fuel]')).toBeNull();
  });

  /**
   * The cargo is spoken for before the fuel is, which is the sum the server takes.
   * A tank loaded to the brim leaves nothing to fly on.
   */
  it('refuses to send a load that leaves no fuel behind', async () => {
    const user = userEvent.setup();
    const view = open(30);
    await load(user);
    const deuterium = screen.getByRole('slider', { name: /Deuterium/i });
    fireEvent.change(deuterium, { target: { value: '30' } });

    expect(screen.getByRole('button', { name: /transfer — no recall/i })).toBeDisabled();
    expect(view.container.querySelector('[data-transfer-fuel]')).toHaveTextContent(/\d/);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('still sends when the tank covers the flight', async () => {
    const user = userEvent.setup();
    open(50_000);
    await load(user);

    expect(screen.getByRole('button', { name: /transfer — no recall/i })).toBeEnabled();
  });
});

/**
 * THE SAME FACTS THE RAID SHEET DRAWS, ON THE OTHER DOOR ONTO THE SAME VERB. D142.
 *
 * This sheet was five grey sentences stacked on each other — an ETA, a `400 /
 * 1200`, a fuel line, a destination-room sum and a defence tally — every one of
 * them a quantity measured against a limit and written out for the player to
 * assemble. Each is now the shape the rest of the game already uses for it.
 */
describe('what a transfer costs the world it leaves', () => {
  const show = (fleet: Record<string, number>, stock: Record<string, number> = {}) => render(
    <ToastProvider>
      <TransferSheet
        target={target}
        planet={planetView({ fleet, ground: { THORN: 2 } }, stock)}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />
    </ToastProvider>,
  );

  const part = (name: string): number => Number.parseFloat(
    document.querySelector<HTMLElement>(`[data-origin-defence] [data-part="${name}"]`)!.style.width,
  );

  it('draws the whole garrison as holding before anything is packed', () => {
    show({ WASP: 4 });
    expect(part('holds')).toBeCloseTo(100, 1);
    expect(part('leaves')).toBeCloseTo(0, 1);
  });

  it('carves the departing craft out of it as they are packed', async () => {
    show({ WASP: 4 });
    await userEvent.setup().click(screen.getByRole('button', { name: 'More Wasp' }));
    expect(part('leaves')).toBeGreaterThan(0);
    expect(part('holds')).toBeLessThan(100);
  });

  /**
   * THE GROUND BATTERY CANNOT MOVE, so it is never part of what leaves — which is
   * the rule the shape has to obey to be worth drawing at all.
   */
  it('never counts ground defence as leaving', async () => {
    show({ WASP: 1 });
    await userEvent.setup().click(screen.getByRole('button', { name: 'More Wasp' }));
    expect(part('holds')).toBeGreaterThan(0);
  });
});

/**
 * THE FUEL AND THE HOLD COME OUT OF THE SAME THREE STORES, and the server's guard
 * is on the SUM: what is left after the cargo has to cover the flight. Loading the
 * last of the tank as cargo now visibly eats the fuel bar rather than producing a
 * refusal on commit with nothing on screen to explain it.
 */
describe('the deuterium a transfer spends twice', () => {
  it('measures the flight against what the hold has not already taken', async () => {
    render(
      <ToastProvider>
        <TransferSheet
          target={target}
          planet={planetView({ fleet: { HAULER: 1 } }, { deuterium: 400 })}
          onClose={vi.fn()}
          onLaunched={vi.fn()}
        />
      </ToastProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More Hauler' }));
    expect(document.querySelector('[data-transfer-fuel] [data-spend-bar]'))
      .toHaveAttribute('data-short', 'false');

    // Load every drop of it and the flight can no longer be paid for.
    const slider = screen.getByRole('slider', { name: /Deuterium/i });
    fireEvent.change(slider, { target: { value: '400' } });
    expect(document.querySelector('[data-transfer-fuel] [data-spend-bar]'))
      .toHaveAttribute('data-short', 'true');
    expect(screen.getByRole('button', { name: /transfer — no recall/i })).toBeDisabled();
  });
});
