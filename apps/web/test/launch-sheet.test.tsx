import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet, PirateContact } from '../src/api/schemas.js';
import { resetClock, serverNow } from '../src/lib/clock.js';
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
  it('accepts an empty numeric count and clamps direct entry to the ships at home', async () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { DART: 200 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    const user = userEvent.setup();
    const quantity = screen.getByRole('textbox', { name: /dart quantity/i });

    expect(quantity).toHaveValue('0');
    expect(quantity).not.toHaveAttribute('readonly');

    await user.clear(quantity);
    expect(quantity).toHaveValue('');

    await user.type(quantity, 'fleet');
    expect(quantity).toHaveValue('');

    await user.type(quantity, '250');
    expect(quantity).toHaveValue('200');
  });

  it('uses exact one-ship steps even for a large hangar and exposes Max', async () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { DART: 200 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    const user = userEvent.setup();
    const quantity = screen.getByRole('textbox', { name: /dart quantity/i });

    await user.click(screen.getByRole('button', { name: /more dart/i }));
    expect(quantity).toHaveValue('1');
    await user.click(screen.getByRole('button', { name: /max dart/i }));
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
        target={{ kind: 'world', world: target }}
        planet={planetView({
          fleet: { PIKE: 2 },
          fleetAway: { DART: 83, COURIER: 2 },
        })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    const note = screen.getByText(/away on a flight/i);
    expect(note).toHaveTextContent('83 Dart');
    expect(note).toHaveTextContent('2 Courier');
    // The row is genuinely gone — that is the behaviour the note explains.
    expect(screen.queryByRole('textbox', { name: /dart quantity/i })).toBeNull();
    expect(screen.getByRole('textbox', { name: /pike quantity/i })).toHaveValue('0');
  });

  /**
   * A Prospector cannot be put in an attack fleet, so listing one here would
   * promise a craft this sheet can never send.
   */
  it('says nothing about a mining run', () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { DART: 4 }, fleetAway: { PROSPECTOR: 2 } })}
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
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { PROSPECTOR: 1 }, fleetAway: { DART: 12 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.getByText(/no ships at home/i)).toBeInTheDocument();
    expect(screen.getByText(/away on a flight/i)).toHaveTextContent('12 Dart');
  });
});

/**
 * THE BET, AS A SHAPE. Owner instruction, D142.
 *
 * This sheet's headline has always been a COUNT of units left holding, and a
 * count is the wrong measure of a garrison: twelve Darts and three Bulwarks are
 * the same number and not remotely the same defence. The bar is made of POWER,
 * and the split between what stays and what leaves is the decision being made —
 * drawn as the thing being taken away from the thing that remains.
 */
describe('what the launch costs the world it leaves', () => {
  const show = (fleet: Record<string, number>, ground: Record<string, number> = {}) => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
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
    const bar = show({ DART: 6 });
    expect(bar.holds()).toBeCloseTo(100, 1);
    expect(bar.leaves()).toBeCloseTo(0, 1);
  });

  it('carves the departing fleet out of the garrison as it is packed', async () => {
    const bar = show({ DART: 4 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    expect(bar.leaves()).toBeCloseTo(25, 1);
    expect(bar.holds()).toBeCloseTo(75, 1);
  });

  /**
   * THE REASON THE BAR IS POWER AND NOT A HULL COUNT. Sending one of two Bulwarks
   * must not look like sending one of two Darts when the ground battery behind
   * them is unchanged; the fraction of the DEFENCE that leaves is the fact.
   */
  it('measures what leaves by what it was worth, not by how many hulls it was', async () => {
    const user = userEvent.setup();
    const light = show({ DART: 1, RAMPART: 1 });
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    const dartShare = light.leaves();
    cleanup();

    const heavy = show({ DART: 1, RAMPART: 1 });
    await user.click(screen.getByRole('button', { name: /more rampart/i }));
    expect(heavy.leaves()).toBeGreaterThan(dartShare);
  });

  it('says the split out loud for anyone who cannot see the bar', () => {
    show({ DART: 3 });
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
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { DART: 2 } }, { deuterium })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /more dart/i }));
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
    /*
      AND THE BUTTON NAMES THE REASON RATHER THAN GOING QUIETLY GREY. D142.

      It used to read "Send 20 ships" and simply not press, which teaches nothing —
      `interface.md` asks an unavailable action to stay visible WITH its reason, and
      short fuel is one of five this commitment can be refused for.
    */
    const commit = screen.getByRole('button', { name: /not enough deuterium/i });
    expect(commit).toBeDisabled();
  });
});

/**
 * WHAT THIS SHEET SAYS ABOUT HOW OLD ITS TARGET IS. D151.
 *
 * This is the surface where a fleet becomes irreversible, and until D151 it said
 * only the target's NAME — a name copied straight out of a frozen probe record,
 * printed exactly as it is for a world under a live Telescope. A commander
 * committing twelve hulls against a three-day-old snapshot of a world that had
 * changed hands twice since was shown nothing at all to tell them so.
 *
 * The fog does not move: this adds no fact the player had not already bought. It
 * states the PROVENANCE of the facts already on the screen, which is the half an
 * information game cannot leave off its commitment surface.
 */
describe('how old the target is, on the surface where the fleet is committed', () => {
  /**
   * `seenAt` IS SERVER-AUTHORED, so the fixture has to write it on the server's
   * epoch. Building it from the device clock instead makes a drifting phone look
   * correct in a test and wrong in a player's hand — the offset cancels itself out
   * of both sides of the subtraction, which is precisely the bug going unseen.
   */
  const remembered = (minutes: number): GalaxyPlanet => ({
    ...target,
    intel: 'REMEMBERED' as const,
    seenAt: new Date(serverNow() - minutes * 60_000),
  });

  const open = (over: GalaxyPlanet) => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: over }}
        planet={planetView({ fleet: { DART: 4 } })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
  };

  it('stamps the age of the record on a remembered world', () => {
    open(remembered(190));
    expect(screen.getByText(/3h 10.*ago/i)).toBeInTheDocument();
  });

  /** A live reading has no age, and inventing one would be the same lie inverted. */
  it('says nothing about age on a world under a live reading', () => {
    open(target);
    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument();
  });

  /**
   * AND AN UNSURVEYED WORLD KEEPS THE LINE IT ALREADY HAD. There is no record to
   * be old — "nobody has looked here" is the whole of what is true.
   */
  it('leaves an unsurveyed world saying only that nobody has looked', () => {
    open({ ...target, intel: 'UNKNOWN' as const, name: '', owner: '' });
    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /nobody has looked here/i })).toBeInTheDocument();
  });

  /**
   * THE AGE IS READ ON THE SERVER'S CLOCK, NOT THE PHONE'S. D51 · D52.
   *
   * `seenAt` is written by the server, so subtracting a device `Date.now()` from
   * it yields the age PLUS whatever that phone's clock is wrong by. The disc label
   * draws the same record through `serverNow()`, so the two surfaces disagreed by
   * exactly the offset — and the one that was wrong was the commitment screen.
   *
   * A drifting phone clock is ordinary, which is why `noteServerTime` exists at
   * all. `Math.max(0, …)` in `recordAgeMinutes` then hides the failure rather than
   * showing it: a device running fast prints a plausible wrong number instead of
   * an obviously impossible one.
   */
  it('reads the record age on the server clock, not the device clock', () => {
    // This phone is six minutes fast; the offset the app measured says so.
    resetClock(-6 * 60_000);
    try {
      open(remembered(30));
      expect(screen.getByText(/30m.*ago/i)).toBeInTheDocument();
      // 36m is what a device-clock read produces, and it is the whole bug.
      expect(screen.queryByText(/36m/i)).not.toBeInTheDocument();
    } finally {
      resetClock();
    }
  });
});

/**
 * ONE COMMITMENT SURFACE, TWO KINDS OF TARGET. D150 — OWNER INSTRUCTION.
 *
 * A raid on a pirate is the same bet as a raid on a world: ships leave, the world
 * is uncovered for the round trip, fuel is paid up front and nothing can be
 * recalled. It had its own picker anyway, inside the focus rail, and that second
 * surface quietly dropped most of what makes this screen a decision — the hull
 * stats a counter cycle is chosen with, the cargo the haul is capped by, the fuel
 * against the tank, the hangar, the ships already away, and the confirmation step
 * with the fleetsave line on it. The owner's question was the right one: why are
 * these not the same component.
 *
 * THE FOG SHAPE IS ALSO THE SAME, which is what makes the merge honest rather than
 * convenient. A world is RESOLVED or UNKNOWN; a pirate is IDENTIFIED or CONTACT.
 * Both let a commander commit a fleet at something they cannot read, and both must
 * refuse to invent the half they were not sold.
 */
describe('committing a fleet at a pirate', () => {
  const pirate = (over: Partial<PirateContact> = {}): PirateContact => ({
    id: 'pirate-1',
    callsign: 'VEX7',
    zone: 'IDENTIFIED',
    at: { x: 400, y: 0, z: 0 },
    expiresInMinutes: 180,
    reachMinutes: 12,
    reach: [
      { hull: 'DART', minutes: 12, distance: 900 },
      { hull: 'RAMPART', minutes: 44, distance: 1500 },
    ],
    level: 2,
    fleet: { VIPER: 3, COURIER: 1 },
    damageMult: 0.65,
    mass: 'MEDIUM',
    ...over,
  });

  const open = (target: PirateContact, fleet = { DART: 20, RAMPART: 2 }) => {
    render(
      <LaunchSheet
        target={{ kind: 'pirate', pirate: target }}
        // A full tank: fuel has its own refusal and its own test, and a dry world
        // would make every assertion here read the wrong reason off the button.
        planet={planetView({ fleet }, { deuterium: 500_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
  };

  /**
   * THE FOUR NUMBERS A HULL IS CHOSEN WITH. D142.
   *
   * The counter cycle is the whole of combat and this is the one screen a player
   * actually chooses between hulls on. The rail offered a name and a count.
   */
  it('offers the same picker, with the stats a hull is chosen on', async () => {
    open(pirate());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));

    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('20');
    // `StatStrip` — attack, hull, speed, cargo, fuel — beside every hull row. It
    // renders no labels at `row` size, so the shape is what is asserted.
    expect(document.querySelectorAll('.stats .stat-attack')).toHaveLength(2);
    expect(document.querySelectorAll('.stats .stat-cargo')).toHaveLength(2);
  });

  /**
   * AND THE FIGURE THE WHOLE FEATURE IS THROTTLED BY.
   *
   * Cargo room is bought with combat power on the way out: what a raid carries home
   * is capped by the holds it brought, and the report says so afterwards. The rail
   * told the player that in a sentence and then showed them neither the hoard nor
   * their own cargo — the one number they were being told to manage was not on the
   * screen at all.
   */
  it('shows the cargo, the distance and the fuel against the tank', async () => {
    open(pirate());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));

    expect(screen.getByText(/cargo/i)).toBeInTheDocument();
    expect(screen.getByText(/^900$/)).toBeInTheDocument();
    expect(screen.getByText(/fuel/i)).toBeInTheDocument();
  });

  /**
   * THE MINUTE IS THE SERVER'S, AND IT BELONGS TO THE SLOWEST SHIP SELECTED.
   * A rendezvous is a numerical solve against a moving target; the client asks.
   */
  it('quotes the rendezvous the launch will actually use', async () => {
    open(pirate());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(screen.getByText('12m')).toBeInTheDocument();

    // Add the slow hull and the whole wing flies at its rendezvous instead.
    await user.click(screen.getByRole('button', { name: /max.*rampart/i }));
    expect(screen.getByText('44m')).toBeInTheDocument();
  });

  /**
   * A HULL WITH NO ROW CANNOT GET THERE, and the two refusals are different.
   *
   * An empty table means nothing standing here can catch it. A table with no row
   * for the slowest ship SELECTED means THIS fleet cannot — a faster one could.
   * Saying "nothing could" in the second case tells a commander their world is
   * helpless when what they need to do is leave the slow hull behind.
   */
  it('refuses a fleet whose slowest ship cannot make the rendezvous', async () => {
    open(pirate({ reach: [{ hull: 'DART', minutes: 12, distance: 900 }] }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    await user.click(screen.getByRole('button', { name: /max.*rampart/i }));

    const commit = screen.getByRole('button', { name: /leave the slow ships behind/i });
    expect(commit).toBeDisabled();

    // Drop it and the same wing is offered the earlier rendezvous instead.
    await user.click(screen.getByRole('button', { name: /fewer rampart/i }));
    await user.click(screen.getByRole('button', { name: /fewer rampart/i }));
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  /**
   * AND A CONTACT IS NOT A READING. D123.
   *
   * A Radar return has no level and no crew, and this surface may not invent
   * either — but the launch itself stays available, because diving at a question
   * mark is exactly the gamble D150 exists to create.
   */
  it('names no level and no crew for an unidentified contact', async () => {
    open(pirate({ zone: 'CONTACT', level: undefined, fleet: undefined, damageMult: undefined }));

    expect(screen.getByText(/unidentified contact/i)).toBeInTheDocument();
    expect(screen.queryByText(/VEX7/)).toBeNull();
    expect(screen.queryByText(/less damage/i)).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  /** The bet is the same bet, so the last screen before it says the same thing. */
  it('keeps the confirmation step and the fleetsave line', async () => {
    open(pirate());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText(/ships in flight cannot be raided/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });
});
