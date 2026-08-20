import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../src/api/context.js';
import { Api } from '../src/api/client.js';
import { LandingScreen } from '../src/screens/LandingScreen.jsx';
import { ServersScreen } from '../src/screens/ServersScreen.jsx';
import type { ServerRow } from '../src/api/schemas.js';
import type { Loader } from '../src/lib/preload.js';

/**
 * THE WAY IN. D21.
 *
 * Two screens stand between a stranger and a planet, and neither of them is part
 * of the game — which is exactly why they are worth testing hard. Everything past
 * this point has been played; nothing here has, and a form that refuses a valid
 * name or a list that offers a galaxy it cannot deliver is a player who never
 * arrives at any of it.
 *
 * The 3D scene is stubbed. It is a canvas of moving hulls with no assertions to
 * make, and WebGL does not exist in jsdom.
 */
vi.mock('../src/landing/LandingScene.jsx', () => ({
  LandingScene: () => <div data-testid="landing-scene" />,
}));

const server = (over: Partial<ServerRow> = {}): ServerRow => ({
  code: 'EU-1',
  name: 'Vantage',
  ordinal: 1,
  planets: 38,
  capacity: 50,
  online: 6,
  status: 'open',
  endsAt: new Date('2026-03-15T00:00:00.000Z'),
  yours: false,
  ...over,
});

/**
 * A client whose only job is to answer `/api/servers`.
 *
 * Both screens read it through react-query, so the wrapper below supplies a fresh
 * QueryClient per test — a shared cache would let one test's server list decide
 * the next one's assertions.
 */
function harness(servers: ServerRow[] = [server()]) {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ servers, placement: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { wrapper, fetch, queries };
}

/**
 * The front door waits for its own sky before it opens (D23), and jsdom never
 * loads a subresource — so every test here supplies a loader that is already done
 * and then waits one tick for the door. The wait itself is covered in
 * `preload.test.ts`; this file is about what is behind it.
 */
const instantly: Loader = () => Promise.resolve();

const openDoor = async (): Promise<void> => {
  await screen.findByRole('button', { name: /check your planet/i });
};

describe('the landing screen', () => {
  /**
   * THE MIDDLE OF THIS PAGE IS THE GAME, NOT A PARAGRAPH. Owner decision.
   *
   * It carried the premise and the stake — two paragraphs a stranger reads after
   * they have already decided from the picture. They are gone, the wordmark sits
   * high, and what is left is a sky, one line about who is in there, and one door.
   */
  it('shows a sky and a door, and asks for nothing', async () => {
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={vi.fn()} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    expect(screen.getByText(/your planet is ready/i)).toBeInTheDocument();
    // No form until it is asked for, and no wall of copy in front of the scene.
    expect(screen.queryByLabelText(/commander name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/one planet in a galaxy of/i)).not.toBeInTheDocument();
  });

  /**
   * The empty shard is the project's second-highest risk, and this line is where a
   * visitor decides whether anyone is in here. It must never say "0 commanders"
   * because the request has not landed yet.
   */
  it('shows how busy the world is, once it knows', async () => {
    const { wrapper: Wrapper } = harness([
      server({ planets: 50, online: 9 }),
      server({ code: 'EU-2', name: 'Kestrel', ordinal: 2, planets: 12, online: 4 }),
    ]);
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={vi.fn()} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    expect(await screen.findByText('62')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('says nothing about population while the answer is unknown', async () => {
    const { wrapper: Wrapper } = harness([]);
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={vi.fn()} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();
    expect(screen.queryByText(/commanders hold a world/i)).not.toBeInTheDocument();
  });

  /**
   * THE PRIMARY DOOR STOPPED BEING A FORM. D56.
   *
   * A stranger is asked for a password after ninety seconds of the real game, not
   * before it — so the loud button starts the rehearsal and nothing on this page
   * asks for anything until they have something worth keeping.
   */
  it('begins the rehearsal on the primary door rather than asking for a password', async () => {
    const user = userEvent.setup();
    const onBegin = vi.fn(() => Promise.resolve());
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={vi.fn()} onBegin={onBegin} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /check your planet/i }));
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens sign-in on the second door, and can still swap to making a commander', async () => {
    const user = userEvent.setup();
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={vi.fn()} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /^i already have a commander$/i }));
    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /i need a commander/i }));
    expect(screen.getByRole('dialog', { name: /create a commander/i })).toBeInTheDocument();
  });

  /** Somebody sent back here to sign in lands on the form, not on the front page. */
  it('opens the form it was asked to open', async () => {
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen
          onAuthenticate={vi.fn()}
          onBegin={vi.fn(() => Promise.resolve())}
          open="login"
          loadAsset={instantly}
        />
      </Wrapper>,
    );
    await openDoor();

    expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits what was typed', async () => {
    const user = userEvent.setup();
    const onAuthenticate = vi.fn(() => Promise.resolve());
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={onAuthenticate} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /^i already have a commander$/i }));
    await user.click(screen.getByRole('button', { name: /i need a commander/i }));
    await user.type(screen.getByLabelText(/commander name/i), 'Vantage');
    await user.type(screen.getByLabelText(/password/i), 'a-real-password');
    await user.click(screen.getByRole('button', { name: /create commander/i }));

    expect(onAuthenticate).toHaveBeenCalledWith('register', 'Vantage', 'a-real-password');
  });

  it('trims a name before sending it, so a stray space is not a different commander', async () => {
    const user = userEvent.setup();
    const onAuthenticate = vi.fn(() => Promise.resolve());
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={onAuthenticate} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /^i already have a commander$/i }));
    const form = screen.getByRole('dialog');
    await user.type(within(form).getByLabelText(/commander name/i), '  Vantage  ');
    await user.type(within(form).getByLabelText(/password/i), 'a-real-password');
    await user.click(within(form).getByRole('button', { name: /^sign in$/i }));

    expect(onAuthenticate).toHaveBeenCalledWith('login', 'Vantage', 'a-real-password');
  });

  it.each([
    ['a name that is too short', 'ab', 'a-real-password', /3-16 letters/i],
    ['a name with punctuation', 'van.tage', 'a-real-password', /3-16 letters/i],
    ['a password that is too short', 'Vantage', 'short', /at least 8 characters/i],
  ])('refuses %s without a round trip', async (_label, username, password, complaint) => {
    const user = userEvent.setup();
    const onAuthenticate = vi.fn(() => Promise.resolve());
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={onAuthenticate} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /^i already have a commander$/i }));
    await user.click(screen.getByRole('button', { name: /i need a commander/i }));
    await user.type(screen.getByLabelText(/commander name/i), username);
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole('button', { name: /create commander/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(complaint);
    expect(onAuthenticate).not.toHaveBeenCalled();
  });

  /**
   * A refused sign-in must not empty the form. Retyping a password on a phone
   * because the server said no is how a player decides the game is not worth it.
   */
  it('keeps what was typed when the server refuses', async () => {
    const user = userEvent.setup();
    const onAuthenticate = vi.fn(() =>
      Promise.reject(new Error('That name and password do not match')),
    );
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={onAuthenticate} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /^i already have a commander$/i }));
    const form = screen.getByRole('dialog');
    await user.type(within(form).getByLabelText(/commander name/i), 'Vantage');
    await user.type(within(form).getByLabelText(/password/i), 'wrong-password');
    await user.click(within(form).getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(within(form).getByLabelText(/commander name/i)).toHaveValue('Vantage');
    // And the button is pressable again, not stuck on "Making contact".
    expect(within(form).getByRole('button', { name: /^sign in$/i })).toBeEnabled();
  });

  it('closes on Escape rather than trapping the player in a modal', async () => {
    const user = userEvent.setup();
    const { wrapper: Wrapper } = harness();
    render(
      <Wrapper>
        <LandingScreen onAuthenticate={vi.fn()} onBegin={vi.fn(() => Promise.resolve())} loadAsset={instantly} />
      </Wrapper>,
    );
    await openDoor();

    await user.click(screen.getByRole('button', { name: /^i already have a commander$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('the server list', () => {
  const show = (servers: ServerRow[], props: Partial<Parameters<typeof ServersScreen>[0]> = {}) => {
    const { wrapper: Wrapper } = harness(servers);
    return render(
      <Wrapper>
        <ServersScreen
          displayName="Sable"
          onChoose={props.onChoose ?? vi.fn()}
          onSignOut={props.onSignOut ?? vi.fn()}
          {...(props.error === undefined ? {} : { error: props.error })}
        />
      </Wrapper>,
    );
  };

  it('shows every galaxy with its population', async () => {
    show([
      server(),
      server({ code: 'EU-2', name: 'Kestrel', ordinal: 2, planets: 0, status: 'locked' }),
    ]);

    expect(await screen.findByText('Kestrel')).toBeInTheDocument();
    expect(screen.getByText('Vantage')).toBeInTheDocument();
    expect(screen.getByText('38/50')).toBeInTheDocument();
  });

  /**
   * THE SEQUENTIAL-FILL RULE, AS THE PLAYER MEETS IT.
   *
   * Exactly one galaxy offers a way in. A locked one must say why rather than
   * showing a button that will be refused — a control that exists and cannot work
   * is worse than no control.
   */
  it('offers a way in on the open galaxy and nowhere else', async () => {
    show([
      server({ code: 'EU-1', name: 'Vantage', ordinal: 1, planets: 50, status: 'full', online: 0 }),
      server({ code: 'EU-2', name: 'Kestrel', ordinal: 2, planets: 4, status: 'open' }),
      server({ code: 'EU-3', name: 'Halcyon', ordinal: 3, planets: 0, status: 'locked', online: 0 }),
    ]);

    await screen.findByText('Kestrel');
    expect(screen.getAllByRole('button', { name: /^join$/i })).toHaveLength(1);
    expect(screen.getByText(/^full$/i)).toBeInTheDocument();
    expect(screen.getByText(/opens when the one above fills/i)).toBeInTheDocument();
  });

  it('names the galaxy it is joining', async () => {
    const onChoose = vi.fn();
    show([server({ code: 'EU-4', name: 'Orrery', ordinal: 4 })], { onChoose });

    await screen.findByText('Orrery');
    await userEvent.setup().click(screen.getByRole('button', { name: /^join$/i }));
    expect(onChoose).toHaveBeenCalledWith('EU-4');
  });

  /** A second press mid-join would send a second request for the same planet. */
  it('cannot be pressed twice', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    show(
      [
        server(),
        server({ code: 'EU-2', name: 'Kestrel', ordinal: 2, planets: 0, status: 'locked' }),
      ],
      { onChoose },
    );

    await screen.findByText('Kestrel');
    const join = screen.getByRole('button', { name: /^join$/i });
    await user.click(join);
    expect(onChoose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /…/ }));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('reports a refusal without sending the player back to the front door', async () => {
    show([server()], { error: 'Vantage is full' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/vantage is full/i);
    // Still on the list, still signed in.
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('says so plainly when the whole world is full', async () => {
    show([server({ planets: 50, status: 'full' })]);
    expect(await screen.findByText(/every galaxy is full/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^join$/i })).not.toBeInTheDocument();
  });

  it('offers a way out', async () => {
    const onSignOut = vi.fn();
    show([server()], { onSignOut });
    await userEvent.setup().click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });
});

/**
 * THE WAY OUT. D21, corrected.
 *
 * Sign-out was briefly at the foot of the planet sheet, which is opened by tapping
 * your own world in the 3D disc. It worked, and it put the most basic account
 * control in the game behind a hit-test against a sphere — a player who cannot find
 * their planet could not sign out.
 *
 * So it hangs off a header control, which is a plain DOM button that is always on
 * screen. That was true for a long time and STILL produced "there is no logout
 * button": the button said SEASON and drew a duration under it, so every player who
 * looked at it saw a clock. A permanent control that names something else is not a
 * permanent way in.
 *
 * These two tests are what keep it one — that the control exists, and that it says
 * the player's own name.
 */
describe('reaching the way out', () => {
  it('offers a commander control in the header at all times', async () => {
    const onOpen = vi.fn();
    const { StatusBar } = await import('../src/shell/StatusBar.js');
    const { ToastProvider } = await import('../src/ui/Toast.js');
    const { wrapper: Wrapper, queries } = harness();

    // The header renders nothing until it knows what the player holds.
    queries.setQueryData(['planet'], planetPayload());
    queries.setQueryData(['season'], seasonPayload());

    render(
      <Wrapper>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={onOpen} />
        </ToastProvider>
      </Wrapper>,
    );

    const control = screen.getByRole('button', { name: /commander Vantage/i });
    await userEvent.setup().click(control);
    expect(onOpen).toHaveBeenCalledWith('commander');
  });

  /**
   * The name has to be VISIBLE, not only in the accessible name. This is the
   * difference between the control a player finds and the one they walk past, and
   * it is the entire content of the bug report that produced it.
   */
  it('states the commander name on the control, in the open', async () => {
    const { StatusBar } = await import('../src/shell/StatusBar.js');
    const { ToastProvider } = await import('../src/ui/Toast.js');
    const { wrapper: Wrapper, queries } = harness();

    queries.setQueryData(['planet'], planetPayload());
    queries.setQueryData(['season'], seasonPayload());

    render(
      <Wrapper>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={vi.fn()} />
        </ToastProvider>
      </Wrapper>,
    );

    const control = screen.getByRole('button', { name: /commander Vantage/i });
    expect(control.textContent).toContain('Vantage');
  });

  /**
   * THE WAY INTO WHAT YOU KNOW. Owner-reported bug.
   *
   * The Intel centre — telescope readings, probe reports, battle reports, the
   * radar log — had exactly one route into it: tapping a notification of the right
   * KIND inside Signals. A player with an empty mailbox could not open it at all,
   * which means the surface that holds "the information is the game" existed only
   * as a side effect of somebody else acting on them.
   *
   * It is a header control now, and this test is what keeps it one.
   */
  it('offers a way into the intel centre with an empty mailbox', async () => {
    const onOpen = vi.fn();
    const { StatusBar } = await import('../src/shell/StatusBar.js');
    const { ToastProvider } = await import('../src/ui/Toast.js');
    const { wrapper: Wrapper, queries } = harness();

    queries.setQueryData(['planet'], planetPayload());
    queries.setQueryData(['season'], seasonPayload());
    // Nothing has happened to this player, which is the whole point.
    queries.setQueryData(['notifications'], { notifications: [] });

    render(
      <Wrapper>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={onOpen} />
        </ToastProvider>
      </Wrapper>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /intel/i }));
    expect(onOpen).toHaveBeenCalledWith('intel');
  });
});

/** The minimum a header needs to render. Nothing here is under test. */
function planetPayload() {
  return {
    planet: {
      id: 'p1',
      name: 'Kestrel-12',
      position: { x: 0, y: 0, z: 0 },
      alloy: 500,
      crystal: 120,
      alloyCap: 5000,
      crystalCap: 1000,
      alloyPerHour: 160,
      crystalPerHour: 56,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferAlloyCap: 640,
      bufferCrystalCap: 224,
      vaultFloor: 300,
      shield: 0,
      disruptedUntil: null,
    },
    buildings: { CORE: 1, REFINERY: 1, EXTRACTOR: 1, VAULT: 0, SHIPYARD: 0 },
    nextCosts: {},
    instruments: {},
    instrumentCosts: {},
    orbit: [],
    orbitSlots: 1,
    flight: { used: 0, total: 3 },
    satelliteCosts: {},
    fleet: { WASP: 12 },
    ground: {},
    score: { wealth: 1200, dominion: 0 },
  };
}

function seasonPayload() {
  return {
    seasonId: 's1',
    shard: 'EU-1',
    shardName: 'Vantage',
    seed: 4242,
    status: 'live',
    startsAt: new Date('2026-03-01T00:00:00.000Z'),
    endsAt: new Date('2026-03-15T00:00:00.000Z'),
    playerCap: 50,
    players: 38,
  };
}
