import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { LandingScreen } from '../src/screens/LandingScreen.js';
import { commanderKnownHere, forgetCommander, rememberCommander } from '../src/lib/returning.js';

/**
 * THE FRONT DOOR, AND THE SECOND PLANET IT USED TO HAND OUT. Owner-reported bug.
 *
 * *"onboarding bitirdim ve logout oldum → tekrar preview sayfasına yönlendirildim
 * → CLAIM YOUR PLANET → başka bir serverda yeniden gezegen veriyor."*
 *
 * REPRODUCED AGAINST THE REAL API BEFORE ANYTHING WAS CHANGED, and the server was
 * not at fault: the same credentials come back to the same account and the same
 * planet with nothing replayed, and `ALREADY_PLACED` still refuses a second
 * galaxy. What produced the second world was the DOOR — the loud control on this
 * page starts a rehearsal, the rehearsal ends in a dialog asking you to CREATE a
 * commander, and a new name is a legitimately new account entitled to a seat.
 *
 * So the weights invert for a device that has held a commander. These tests hold
 * three things: that a stranger still meets D56's door unchanged, that a returning
 * player meets the way back in, and that BOTH doors stay reachable from either
 * state — because the flag is a hint about emphasis and must never become a gate.
 */

/**
 * The 3D scene is stubbed: it is a canvas of moving hulls with no assertions to
 * make, WebGL does not exist in jsdom, and `react-use-measure` throws outright on
 * a document with no ResizeObserver. The door is what this file is about.
 */
vi.mock('../src/landing/LandingScene.jsx', () => ({
  LandingScene: () => <div data-testid="landing-scene" />,
}));

const harness = () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
};

/** jsdom loads no subresources, so the cover would sit over the page for its whole deadline. */
const loadAsset = () => Promise.resolve();

const show = (known: boolean, onBegin = vi.fn(() => Promise.resolve())) => {
  const Wrapper = harness();
  render(
    <Wrapper>
      <LandingScreen
        onAuthenticate={vi.fn(() => Promise.resolve())}
        onBegin={onBegin}
        loadAsset={loadAsset}
        knownCommander={() => known}
      />
    </Wrapper>,
  );
  return { onBegin };
};

/** The one control drawn as the page's primary door, whichever it happens to be. */
const loudDoor = () => document.querySelector('button.enter');

afterEach(() => {
  forgetCommander();
});

describe('the front door on a device nobody has played on', () => {
  it('leads with the rehearsal, exactly as D56 designed it', async () => {
    const { onBegin } = show(false);

    const door = loudDoor();
    expect(door?.textContent).toMatch(/check your planet/i);

    await userEvent.setup().click(door!);
    expect(onBegin).toHaveBeenCalled();
  });

  it('still offers signing in, quietly, for somebody on a new browser', async () => {
    show(false);
    await userEvent.setup().click(screen.getByRole('button', { name: /already have a commander/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('the front door on a device that has held a commander', () => {
  it('leads with the way back in, not with onboarding', async () => {
    const { onBegin } = show(true);

    const door = loudDoor();
    expect(door?.textContent).toMatch(/sign in/i);
    // The whole bug in one assertion: the loud control must not start a rehearsal.
    expect(door?.textContent).not.toMatch(/check your planet/i);

    await userEvent.setup().click(door!);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(onBegin).not.toHaveBeenCalled();
  });

  it('says the planet is still there rather than that one is ready', () => {
    show(true);
    expect(screen.getByText(/where you left it/i)).toBeInTheDocument();
    expect(screen.queryByText(/your planet is ready/i)).not.toBeInTheDocument();
  });

  /**
   * A HINT, NEVER A GATE. A shared phone, or somebody deliberately making a second
   * commander, must still get through — the flag decides which control is loud and
   * locks nothing.
   */
  it('still lets a genuinely new commander start, from the quiet line', async () => {
    const { onBegin } = show(true);
    await userEvent.setup().click(screen.getByRole('button', { name: /start a new commander/i }));
    expect(onBegin).toHaveBeenCalled();
  });
});

describe('remembering a commander', () => {
  it('starts unknown, and holds once marked', () => {
    forgetCommander();
    expect(commanderKnownHere()).toBe(false);
    rememberCommander();
    expect(commanderKnownHere()).toBe(true);
    forgetCommander();
    expect(commanderKnownHere()).toBe(false);
  });

  /**
   * SAFARI IN PRIVATE BROWSING THROWS ON ACCESS, not on write — and this is read
   * during a render of the one screen that must never fail to draw. An exception
   * here would take the whole front door down and leave a black page.
   */
  it('treats a storage that throws as a device nobody has played on', () => {
    const boom = () => {
      throw new Error('storage is disabled');
    };
    const spy = vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(boom);

    expect(() => commanderKnownHere()).not.toThrow();
    expect(commanderKnownHere()).toBe(false);
    expect(() => {
      rememberCommander();
    }).not.toThrow();

    spy.mockRestore();
  });

  /** And the page still renders its first-time door through that failure. */
  it('draws the first-time door when storage cannot be read at all', () => {
    const spy = vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage is disabled');
    });

    const Wrapper = harness();
    render(
      <Wrapper>
        <LandingScreen
          onAuthenticate={vi.fn(() => Promise.resolve())}
          onBegin={vi.fn(() => Promise.resolve())}
          loadAsset={loadAsset}
        />
      </Wrapper>,
    );

    expect(loudDoor()?.textContent).toMatch(/check your planet/i);
    spy.mockRestore();
  });
});
