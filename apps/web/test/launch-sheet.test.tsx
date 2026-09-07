import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
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
import { AcademyLessonContext } from '../src/onboarding/lessonScope.js';
import { academyLessonFleet } from '@astera/rules';
import { hullLabel } from '../src/i18n/names.js';

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

/**
 * OPEN EVERY BAND THE PICKER IS HOLDING SHUT.
 *
 * The picker folds its families on owner instruction — one open on arrival, the
 * rest shut with their counts on them. Most tests here are about a hull rather
 * than about the fold, so they reach past it deliberately. The fold itself is held
 * down in `ship-list-density.test.tsx`.
 */
const openAllBands = async (user: ReturnType<typeof userEvent.setup>) => {
  for (const band of screen.queryAllByRole('button', { expanded: false })) {
    await user.click(band);
  }
};

describe('choosing a fleet to attack with', () => {
  it('quotes the Academy leg and opens cargo without overwriting live folds', async () => {
    localStorage.setItem('astera.accordion.launch', '[]');
    render(<AcademyLessonContext.Provider value="raid"><LaunchSheet
      target={{ kind: 'world', world: target }} planet={planetView({ fleet: { DART: 3, COURIER: 1 } })}
      onClose={vi.fn()} onLaunched={vi.fn()} /></AcademyLessonContext.Provider>, { wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: /dart quantity/i }), '2');
    await user.type(screen.getByRole('textbox', { name: /courier quantity/i }), '1');
    expect(screen.getAllByText('6s').length).toBeGreaterThan(0);
    expect(localStorage.getItem('astera.accordion.launch')).toBe('[]');
    localStorage.removeItem('astera.accordion.launch');
  });
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
 * THE PICKER IS GROUPED THE WAY THE SHIPYARD IS. Owner instruction.
 *
 * Committing a fleet is the one irreversible control in the game, and it offered a
 * flat tier-ordered list — so the counter cycle, which is the whole of combat, had
 * to be reconstructed hull by hull from four numbers on each row. The bands say
 * what a row is FOR before the player reads what it costs, and they are the same
 * four bands, in the same order, as the tab the ships were bought on.
 */
describe('the picker is banded by what a hull is for', () => {
  const bandOrder = () =>
    [...document.querySelectorAll('[data-fleet-family]')].map(
      (node) => node.getAttribute('data-fleet-family'),
    );

  it('bands a world raid Offensive, Defensive, Special, Cargo', () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView(
          { fleet: { DART: 4, RAMPART: 2, NULLIFIER: 1, COURIER: 3 } },
          { deuterium: 500_000 },
        )}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    expect(bandOrder()).toEqual(['OFFENSIVE', 'DEFENSIVE', 'SPECIALIST', 'CARGO']);
    expect(screen.getByText('Offensive hulls')).toBeInTheDocument();
    expect(screen.getByText('Specialist hulls')).toBeInTheDocument();
  });

  it('bands a pirate raid the same way, off the same order', () => {
    render(
      <LaunchSheet
        target={{
          kind: 'pirate',
          pirate: {
            id: 'pirate-2',
            callsign: 'VEX9',
            zone: 'IDENTIFIED' as const,
            at: { x: 400, y: 0, z: 0 },
            expiresInMinutes: 180,
            reachMinutes: 12,
            reach: [{ hull: 'DART' as const, minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
            level: 2,
            fleet: { VIPER: 3 },
            damageMult: 0.65,
            mass: 'MEDIUM' as const,
          },
        }}
        planet={planetView({ fleet: { DART: 4, COURIER: 1 } }, { deuterium: 500_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    expect(bandOrder()).toEqual(['OFFENSIVE', 'CARGO']);
  });

  /** A band is a heading for rows that exist; an empty one is a lie about the fleet. */
  it('heads no band for a family the world has nothing of', () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { DART: 4 } }, { deuterium: 500_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    expect(bandOrder()).toEqual(['OFFENSIVE']);
    expect(screen.queryByText('Cargo hulls')).not.toBeInTheDocument();
  });

  /**
   * Every hull still keeps its own row: a band groups the picker and now FOLDS it,
   * but folding is not trimming — every hull standing here is one tap away.
   */
  it('keeps one row per hull standing at home', async () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView(
          { fleet: { DART: 4, PIKE: 1, RAMPART: 2, COURIER: 3 } },
          { deuterium: 500_000 },
        )}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );

    await openAllBands(userEvent.setup());
    for (const name of [/dart quantity/i, /pike quantity/i, /rampart quantity/i, /courier quantity/i]) {
      expect(screen.getByRole('textbox', { name })).toBeInTheDocument();
    }
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
  /**
   * THE GARRISON BAR IS GONE, ON OWNER INSTRUCTION.
   *
   * *"Bu filo dışarıdayken sectionları kaldır. Büyük çok yer kaplıyor ve gereksiz"* —
   * quoting `launch.whileAway`'s own Turkish heading. The plate filled roughly a
   * third of the sheet above the picker, and it argued about a decision the player
   * had not made yet while they were still making it.
   *
   * WHAT IT CARRIED IS NOT LOST, and that is what these tests now hold down. The
   * garrison count and the irreversibility both live on the confirmation step, one
   * press before the fleet stops being recallable, which is where a warning is
   * read rather than scrolled past.
   */
  const show = (fleet: Record<string, number>) => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet }, { deuterium: 50_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
  };

  it('spends no plate on the garrison while the player is still choosing', () => {
    show({ DART: 6 });
    expect(document.querySelector('[data-defence-bar]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/while this fleet is away/i);
  });

  it('names the garrison that stays behind at the moment of commitment', async () => {
    show({ DART: 4 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    await user.click(screen.getByRole('button', { name: /^send/i }));
    // Four at home, one packed: three hold.
    expect(document.body.textContent).toMatch(/holds 3 units until it comes back/i);
    expect(document.body.textContent).toMatch(/cannot be recalled/i);
  });

  it('still teaches fleetsave, which is what makes the risk cut both ways', async () => {
    show({ DART: 4 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    await user.click(screen.getByRole('button', { name: /^send/i }));
    expect(document.body.textContent).toMatch(/cannot be raided/i);
  });
});

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
      { hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } },
      { hull: 'RAMPART', minutes: 44, distance: 1500, at: { x: 0, y: 0, z: 1500 } },
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
    await openAllBands(user);
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
    await openAllBands(user);
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
    await openAllBands(user);
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
    open(pirate({ reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }] }));
    const user = userEvent.setup();
    await openAllBands(user);
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
    await openAllBands(user);
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  /**
   * AND THE DISC IS TOLD WHERE THE FLEET WOULD GO. D124 · D155.
   *
   * Every figure on this sheet was a number in a box: "44 minutes, 1,500 units"
   * about a coordinate nothing on screen named. A pirate is on a closed orbit, so
   * the wing flies to a point AHEAD of the contact the player tapped — and with
   * nothing drawn there, the launch read as the squadron setting off somewhere
   * unrelated. The mining lane has marked its rendezvous since D40.
   *
   * IT FOLLOWS THE SELECTION, because the rendezvous does: adding a slow hull
   * moves the whole wing's meeting point, which is the single most surprising
   * consequence of the picker and the one worth SEEING rather than reading.
   *
   * AND IT IS CLEARED ON THE WAY OUT. A mark left behind by a closed sheet is a
   * target the player never committed to, sitting on the disc as though they had.
   */
  it('tells the disc where the chosen wing would meet it', async () => {
    const onAim = vi.fn();
    const { unmount } = render(
      <LaunchSheet
        target={{ kind: 'pirate', pirate: pirate() }}
        planet={planetView({ fleet: { DART: 20, RAMPART: 2 } }, { deuterium: 500_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
        onAim={onAim}
      />,
      { wrapper },
    );
    const user = userEvent.setup();

    // Nothing selected is nothing to draw: there is no rendezvous yet.
    expect(onAim).toHaveBeenLastCalledWith(null);

    await openAllBands(user);
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(onAim).toHaveBeenLastCalledWith({ x: 900, y: 0, z: 0 });

    // The slow hull drags the meeting point with it.
    await user.click(screen.getByRole('button', { name: /max.*rampart/i }));
    expect(onAim).toHaveBeenLastCalledWith({ x: 0, y: 0, z: 1500 });

    unmount();
    expect(onAim).toHaveBeenLastCalledWith(null);
  });

  /** The bet is the same bet, so the last screen before it says the same thing. */
  it('keeps the confirmation step and the fleetsave line', async () => {
    open(pirate());
    const user = userEvent.setup();
    await openAllBands(user);
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText(/ships in flight cannot be raided/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });
});

/**
 * A CONTROL THAT CANNOT WORK MUST NOT BE OFFERED. `interface.md` I1.
 *
 * `launchAttack` refuses a fleet with no combat hull in it — `NOT_A_WARSHIP`,
 * checked before the transaction opens — and this sheet let the commander pack a
 * hold of Couriers, press the irreversible control, sit through the confirmation
 * step and learn the rule from a red toast. It is the same failure the bay and
 * the fuel refusals were given their own lines for: every other reason this
 * commitment can be refused is stated on the button before it is pressed.
 */
describe('a fleet that cannot fight', () => {
  const packAll = async (hull: string) => {
    const user = userEvent.setup();
    // These tests are about the escort rule, not the fold; reach past it.
    await openAllBands(user);
    await user.click(screen.getByRole('button', { name: new RegExp(`max ${hull}`, 'i') }));
  };

  it('refuses a hold of cargo hulls, on the button, before it is pressed', async () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { COURIER: 3 } }, { deuterium: 5_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    await packAll('courier');

    const commit = screen.getByRole('button', { name: /warship|send/i });
    expect(commit).toBeDisabled();
    expect(commit).toHaveTextContent(/add a warship/i);
  });

  it('accepts the same hold the moment one warship joins it', async () => {
    render(
      <LaunchSheet
        target={{ kind: 'world', world: target }}
        planet={planetView({ fleet: { COURIER: 3, DART: 1 } }, { deuterium: 5_000 })}
        onClose={vi.fn()}
        onLaunched={vi.fn()}
      />,
      { wrapper },
    );
    await packAll('courier');
    await packAll('dart');

    const commit = screen.getByRole('button', { name: /send/i });
    expect(commit).toBeEnabled();
  });
});

/**
 * THE PICKER INSIDE A LESSON. Owner report, and it was a dead button.
 *
 * The Academy teaches exactly one way to fill this picker — press Max — and its
 * hand points at nothing else. But the raid lesson's private API demanded
 * `{ DART: 2, COURIER: 1 }` while the commander stood on three Darts, a captured
 * Warden and a Prospector. Max sent three Darts, the launch was refused, and
 * because the Academy silences toasts the refusal arrived as a commit button that
 * did nothing at all.
 *
 * The rule is now the same on both sides: a lesson names its hulls, the picker
 * offers ONLY those, and Max on each row is by construction the fleet the lesson
 * expects. The captured Warden stays in the hangar — it is a real warship and it
 * would be legal to send, but the lesson never taught it and a third row asks a
 * question the tutorial has no answer for.
 */
describe('the picker while a lesson is running', () => {
  const holding = planetView({
    fleet: { DART: 3, COURIER: 1, WARDEN: 1, PROSPECTOR: 1 },
    buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1, HANGAR: 3 },
  });

  const lessonSheet = (lesson: 'pirate' | 'raid') => render(
    <AcademyLessonContext.Provider value={lesson}>
      <LaunchSheet planet={holding} target={{ kind: 'world', world: target }}
        onClose={vi.fn()} onLaunched={vi.fn()} />
    </AcademyLessonContext.Provider>,
    { wrapper },
  );

  it('shows the captured hull but will not let the lesson spend it', () => {
    /*
      OWNER CORRECTION, and it is the better reading. Hiding the Warden made the
      commander's own prize vanish from the one screen that lists their fleet —
      they had just been told they captured it. It stays on the roster, and the
      controls that would add it are dead: the lesson says what it wants without
      pretending the ship is not there.
    */
    const view = lessonSheet('raid');
    expect(screen.getByText(hullLabel('DART'))).toBeInTheDocument();
    expect(screen.getByText(hullLabel('COURIER'))).toBeInTheDocument();
    expect(screen.getByText(hullLabel('WARDEN'))).toBeInTheDocument();

    const warden = view.container.querySelector('[data-hull-row="WARDEN"]');
    expect(warden, 'the captured hull has no row').not.toBeNull();
    for (const control of warden!.querySelectorAll('button')) {
      expect(control, `${control.getAttribute('aria-label') ?? ''} is still live`).toBeDisabled();
    }

    // A miner was never launchable from here, lesson or no lesson.
    expect(screen.queryByText(hullLabel('PROSPECTOR'))).not.toBeInTheDocument();
  });

  it('narrows the pirate lesson to the Darts alone', () => {
    lessonSheet('pirate');
    expect(screen.getByText(hullLabel('DART'))).toBeInTheDocument();
    const courier = screen.queryByText(hullLabel('COURIER'));
    if (courier) {
      // Present is fine; spendable is not.
      const row = courier.closest('[data-hull-row]');
      for (const control of row!.querySelectorAll('button')) expect(control).toBeDisabled();
    }
  });

  it('makes Max produce exactly the fleet each lesson expects', async () => {
    const user = userEvent.setup();

    lessonSheet('raid');
    for (const max of screen.getAllByRole('button', { name: /max/i })) await user.click(max);
    for (const [hull, count] of Object.entries(academyLessonFleet('raid'))) {
      expect(
        screen.getByRole('textbox', { name: new RegExp(hullLabel(hull as 'DART'), 'i') }),
        `${hull} did not fill to the lesson's count`,
      ).toHaveValue(String(count));
    }
  });

  it('caps the pirate lesson at two Darts even though three are standing', async () => {
    const user = userEvent.setup();
    lessonSheet('pirate');
    for (const max of screen.getAllByRole('button', { name: /max/i })) await user.click(max);
    expect(screen.getByRole('textbox', { name: new RegExp(hullLabel('DART'), 'i') }))
      .toHaveValue(String(academyLessonFleet('pirate').DART));
  });
});

/**
 * THE ORDER A LESSON READS IN. Owner instruction: Warden, Dart, Courier.
 *
 * Outside a lesson the picker is banded — Offensive · Defensive · Special · Cargo,
 * `roster.ts`, and that stays exactly as it is. Inside one it is three ships, and
 * four band headings over three rows is the "never hold a section open" rule
 * broken for no gain. So a lesson reads as one list, in the order the lesson means:
 *
 *   · what it will NOT let you send, first — the captured Warden is the
 *     commander's prize and belongs where they can see it, but it is context, not
 *     the task;
 *   · then the hulls the lesson wants, in the order `academyLessonFleet` names
 *     them, so the two Max presses the hand teaches run top to bottom without a
 *     dead row between them.
 *
 * It is a rule, not a hard-coded triple: add a hull to the lesson and it lands in
 * the right half on its own.
 */
describe('the order a lesson lists ships in', () => {
  const holding = planetView({
    fleet: { DART: 3, COURIER: 1, WARDEN: 1, PROSPECTOR: 1 },
    buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1, HANGAR: 3 },
  });

  const rows = (lesson: 'pirate' | 'raid' | null) => {
    const sheet = (
      <LaunchSheet planet={holding} target={{ kind: 'world', world: target }}
        onClose={vi.fn()} onLaunched={vi.fn()} />
    );
    const view = render(
      lesson === null
        ? sheet
        : <AcademyLessonContext.Provider value={lesson}>{sheet}</AcademyLessonContext.Provider>,
      { wrapper },
    );
    return [...view.container.querySelectorAll('[data-hull-row]')]
      .map((row) => row.getAttribute('data-hull-row'));
  };

  it('puts the kept-back prize first, then the lesson’s own ships in its order', () => {
    expect(rows('raid')).toEqual(['WARDEN', 'DART', 'COURIER']);
  });

  it('leaves the ordinary picker banded, which is not this order', () => {
    // Offensive before Defensive before Cargo — `roster.ts`, untouched.
    expect(rows(null)).toEqual(['DART', 'WARDEN', 'COURIER']);
  });
});
