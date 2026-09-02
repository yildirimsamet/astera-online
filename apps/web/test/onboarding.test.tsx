import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../src/api/context.js';
import { Api } from '../src/api/client.js';
import { LandingScreen } from '../src/screens/LandingScreen.jsx';
import { ServersScreen } from '../src/screens/ServersScreen.jsx';
import type { HistoricalSeasonResult, ServerRow } from '../src/api/schemas.js';
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
          {...(props.latestResult === undefined ? {} : { latestResult: props.latestResult })}
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

  it('shows an unseen permanent record after its planet has been wiped', async () => {
    window.localStorage.clear();
    const latestResult: HistoricalSeasonResult = {
      seasonId: 'old-season',
      accountId: 'account-1',
      shard: 'EU-1',
      shardName: 'Vantage',
      finalRank: 2,
      dominion: 184,
      damageDealt: 12_450,
      damageTaken: 8_200,
      rivalName: 'Rook',
      biggestRaid: 4_800,
      title: 'Vanguard',
      recap: {
        commanderName: 'Sable',
        planetName: 'Kestrel-12',
        battles: 9,
        attacks: 6,
        defences: 3,
        rival: { commanderName: 'Rook', battles: 4 },
        biggestRaid: { value: 4_800, opponentName: 'Rook' },
      },
      createdAt: new Date('2026-08-22T18:00:00Z'),
    };
    show([server()], { latestResult });

    expect(await screen.findByRole('heading', { name: 'Vanguard' })).toBeInTheDocument();
    /**
     * NOT "explore the final galaxy" — from the server list there is no galaxy
     * behind this screen to go back to, and the season it records is gone. The
     * button has to say what it does, and it has to be there at all: the record
     * used to be a screen a commander could open and not get out of.
     */
    expect(screen.queryByRole('button', { name: /explore the final galaxy/i })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole('button', { name: /^close$/i })[0]!);
    expect(screen.getByRole('button', { name: /last season record/i })).toBeInTheDocument();
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
 * THE WAY OUT. D21, corrected at D54, and MOVED — not weakened — by the menu.
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
 * THE CONTROL IS NOW THE MENU, and the header no longer prints the commander's
 * name in the open. That is an owner decision — the header had four controls in it
 * and the two stock figures beside them are the most-read numbers in the game — and
 * it is a real relaxation of D54's second test, so it is recorded rather than
 * quietly dropped. What is kept is everything the finding was actually about: the
 * control is permanent, it is a plain DOM button, its accessible name carries both
 * the commander and what is behind it, and the sheet it opens is titled with the
 * player's own name. What is given up is the name being legible without opening
 * anything, against a hamburger, which is the one glyph on a phone that needs no
 * label to read as "everything else is in here".
 *
 * The three tests below are what keep it a way out: the control exists, it opens
 * the menu, and it still says who you are to anyone who asks it.
 */
describe('reaching the way out', () => {
  const header = async (onOpen = vi.fn(), payload = planetPayload()) => {
    const { StatusBar } = await import('../src/shell/StatusBar.js');
    const { ToastProvider } = await import('../src/ui/Toast.js');
    const { wrapper: Wrapper, queries } = harness();

    // The header renders nothing until it knows what the player holds.
    queries.setQueryData(['planet'], payload);
    queries.setQueryData(['season'], seasonPayload());

    render(
      <Wrapper>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={onOpen} onFocusPlanet={vi.fn()} />
        </ToastProvider>
      </Wrapper>,
    );
    return { onOpen };
  };

  it('offers a permanent way into the account, from the header', async () => {
    const { onOpen } = await header();
    const control = screen.getByRole('button', { name: /commander Vantage/i });
    await userEvent.setup().click(control);
    expect(onOpen).toHaveBeenCalledWith('menu');
  });

  it('shows the real Deuterium balance before Spectrometry is complete', async () => {
    await header();
    expect(screen.getByLabelText('Deuterium')).toHaveTextContent('0');
    expect(within(screen.getByLabelText('Deuterium')).getByRole('meter')).toBeInTheDocument();
    expect(screen.getAllByRole('meter')).toHaveLength(3);
  });

  it('keeps all exact balances visible and gives the Works a third vessel', async () => {
    const payload = planetPayload();
    payload.planet.alloy = 27_721;
    payload.planet.crystal = 76_687;
    payload.planet.deuterium = 12_345;
    await header(vi.fn(), payload);
    const strip = document.querySelector('[data-resource-strip]');
    expect(strip).toHaveTextContent('27,721');
    expect(strip).toHaveTextContent('76,687');
    expect(strip).toHaveTextContent('12,345');
    expect(strip?.querySelector('.truncate')).toBeNull();
    expect(document.querySelectorAll('.works-vessel')).toHaveLength(3);
    expect(document.querySelector('.works-fill-deuterium')).not.toBeNull();
  });

  it('gives a ready Collect action a restrained cue using the house icon system', async () => {
    const payload = planetPayload();
    payload.planet.bufferAlloy = 120;
    await header(vi.fn(), payload);

    const collect = screen.getByRole('button', { name: /collect 120/i });
    expect(collect).toHaveClass('works-ready');
    const mark = collect.querySelector('.collect-mark');
    expect(mark?.tagName.toLowerCase()).toBe('svg');
    expect(mark).toHaveAttribute('viewBox', '0 0 24 24');
    expect(mark).toHaveAttribute('stroke', 'currentColor');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  /**
   * IT NAMES WHAT IS BEHIND IT, which is the whole of the D54 finding. A control
   * whose label describes something other than the surface it opens is not a way
   * in — that is how a button reading SEASON produced "there is no logout button"
   * while opening the sheet with sign-out in it.
   */
  it('says whose account it is and what is inside', async () => {
    await header();
    const control = screen.getByRole('button', { name: /commander Vantage/i });
    const label = control.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/vantage/i);
    expect(label).toMatch(/account/i);
  });

  /**
   * The two surfaces that came off the header are reachable from the sheet, and
   * they are LABELLED — a menu is read rather than recognised, so a row with only
   * a glyph on it would have moved the D54 problem one level down.
   */
  it('keeps leaderboard and rewards as named menu rows after Intel moves to the disc', async () => {
    const { MenuPanel } = await import('../src/shell/MenuPanel.js');
    const onOpen = vi.fn();
    const { wrapper: Wrapper } = harness();

    render(
      <Wrapper>
        <MenuPanel
          galaxy="Vantage"
          shard="EU-1"
          endsAt={new Date(Date.now() + 3_600_000)}
          onOpen={onOpen}
          onSignOut={vi.fn()}
        />
      </Wrapper>,
    );

    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: /galaxy chat/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /rewards/i }));
    expect(onOpen).toHaveBeenCalledWith('rewards');
    await user.click(screen.getByRole('button', { name: /leaderboard/i }));
    expect(onOpen).toHaveBeenCalledWith('leaderboard');
    /*
      RESEARCH AND THE CLAN ARE NOT HERE, and that is the owner's instruction rather
      than an omission. They are marks on the disc now (`DiscControls`), because
      they are things a commander DOES; a menu is where you look things UP. Two
      doors onto one surface is how a player learns that neither is the real one.
    */
    expect(screen.queryByRole('button', { name: /research/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /clan/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /intel/i })).toBeNull();
  });

  it('offers an accessible sound level beside the mute switch', async () => {
    const { MenuPanel } = await import('../src/shell/MenuPanel.js');
    const { setMusicVolume, musicVolume } = await import('../src/lib/music.js');
    const { wrapper: Wrapper } = harness();
    setMusicVolume(0.35);

    render(
      <Wrapper>
        <MenuPanel
          galaxy="Vantage"
          shard="EU-1"
          endsAt={null}
          onOpen={vi.fn()}
          onSignOut={vi.fn()}
        />
      </Wrapper>,
    );

    const slider = screen.getByRole('slider', { name: /music volume/i });
    expect(slider).toHaveValue('35');
    fireEvent.change(slider, { target: { value: '36' } });
    expect(musicVolume()).toBeCloseTo(0.36, 5);
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
   * It is a MENU ROW now rather than a header control, and this test is what keeps
   * it a route that exists with nothing in the mailbox: the notifications list is
   * deliberately empty here, which is the whole point of the bug it came from.
   */
  it('does not duplicate the disc Intel control in the menu when the mailbox is empty', async () => {
    const onOpen = vi.fn();
    const { MenuPanel } = await import('../src/shell/MenuPanel.js');
    const { wrapper: Wrapper, queries } = harness();

    // Nothing has happened to this player, which is the whole point.
    queries.setQueryData(['notifications'], { notifications: [] });

    render(
      <Wrapper>
        <MenuPanel
          galaxy="Vantage"
          shard="EU-1"
          endsAt={null}
          onOpen={onOpen}
          onSignOut={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.queryByRole('button', { name: /intel/i })).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('lights the announcement bell and shows a count while a post is unread', async () => {
    const { MenuPanel } = await import('../src/shell/MenuPanel.js');
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(['announcements'], {
      announcements: [{
        id: crypto.randomUUID(),
        title: 'Update',
        bodyHtml: '<p>New</p>',
        publishedAt: new Date(),
        seen: false,
      }],
    });

    render(
      <Wrapper>
        <MenuPanel
          galaxy="Vantage"
          shard="EU-1"
          endsAt={null}
          onOpen={vi.fn()}
          onSignOut={vi.fn()}
        />
      </Wrapper>,
    );

    const announcements = screen.getByRole('button', { name: /announcement/i });
    expect(announcements.querySelector('[data-attention="true"]')).toHaveClass('text-opportunity');
    expect(announcements).toHaveTextContent('1');
  });

  it('offers one-tap focus for a live Rival and a clear action for a reclaimed one', async () => {
    const { MenuPanel } = await import('../src/shell/MenuPanel.js');
    const onFocusRival = vi.fn();
    const onClearRival = vi.fn();
    const { wrapper: Wrapper } = harness();

    const { rerender } = render(
      <Wrapper>
        <MenuPanel
          galaxy="Vantage"
          shard="EU-1"
          endsAt={null}
          rival={{ owner: 'Sable', name: 'Orrery-8' }}
          onFocusRival={onFocusRival}
          onOpen={vi.fn()}
          onSignOut={vi.fn()}
        />
      </Wrapper>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /rival · sable/i }));
    expect(onFocusRival).toHaveBeenCalledOnce();

    rerender(
      <Wrapper>
        <MenuPanel
          galaxy="Vantage"
          shard="EU-1"
          endsAt={null}
          rivalLost
          onClearRival={onClearRival}
          onOpen={vi.fn()}
          onSignOut={vi.fn()}
        />
      </Wrapper>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /rival signal lost/i }));
    expect(onClearRival).toHaveBeenCalledOnce();
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
      deuterium: 0,
      alloyCap: 5000,
      crystalCap: 1000,
      deuteriumCap: 500,
      alloyPerHour: 160,
      crystalPerHour: 56,
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      bufferAlloyCap: 640,
      bufferCrystalCap: 224,
      bufferDeuteriumCap: 112,
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
    research: [],
    fleet: { DART: 12 },
    ground: {},
    fleetAway: {},
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
