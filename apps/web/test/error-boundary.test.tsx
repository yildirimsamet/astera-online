import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../src/shell/ErrorBoundary.js';
import { readCrashes } from '../src/shell/crashReport.js';
import { copyText } from '../src/lib/clipboard.js';
import i18n from '../src/i18n/index.js';

vi.mock('../src/lib/clipboard.js', () => ({ copyText: vi.fn() }));

/**
 * THE BLACK SCREEN, CAUGHT.
 *
 * Owner report: a commander taps a world and the screen goes dark and stays dark
 * until they reload. The app had no boundary anywhere — `grep ErrorBoundary`
 * returned nothing — so a single throw in a render unmounted the entire tree and
 * left the body's own dark ground behind. That is the symptom exactly.
 *
 * TWO JOBS, AND THE SECOND IS THE REASON THIS WAS BUILT FIRST. It keeps the
 * player in a screen they can act on, and it CAPTURES what threw. The owner's
 * instruction was to learn the cause before choosing a fix, and a boundary is
 * also the measurement: if the black screen turns into this fallback, the cause
 * is a render error and the report names it. If a player still gets a black
 * screen with nothing on it, the cause is NOT a React error — it is the WebGL
 * context, which a boundary cannot see, and that is worth knowing too.
 */

/** A component that fails the way a real one does: while rendering. */
function Boom({ message = 'Cannot read properties of undefined' }: { message?: string }): ReactNode {
  throw new Error(message);
}

const show = (children: ReactNode, onReload = vi.fn()) => {
  const result = render(<ErrorBoundary onReload={onReload}>{children}</ErrorBoundary>);
  return { ...result, onReload };
};

beforeEach(async () => {
  window.localStorage.clear();
  // `restoreMocks` clears the factory's implementation between tests, so the
  // clipboard's answer is stated per test rather than once at the mock.
  vi.mocked(copyText).mockResolvedValue(true);
  // React reports every caught error through `console.error`. That is correct
  // behaviour being exercised on purpose here, not noise worth reading.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
});

describe('ErrorBoundary', () => {
  it('is invisible while nothing is wrong', () => {
    show(<p>the disc</p>);

    expect(screen.getByText('the disc')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces a crashed tree with a screen instead of leaving it blank', () => {
    show(<Boom />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('crash.title'))).toBeInTheDocument();
  });

  /*
    THE ONE CONTROL. A crashed 3D scene cannot be trusted to re-mount into a good
    state, and a "try again" that re-renders the same broken screen would just
    crash again in front of the player. Reload is the honest recovery, so it is
    the only thing offered and it is never folded.
  */
  it('offers a reload and nothing else to guess at', () => {
    const { onReload } = show(<Boom />);

    const reload = screen.getByRole('button', { name: i18n.t('crash.reload') });
    reload.click();

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('folds the technical detail and opens it on a tap', async () => {
    const user = userEvent.setup();
    show(<Boom message="planet sheet blew up" />);

    expect(screen.queryByText(/planet sheet blew up/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('crash.detailShow') }));

    expect(screen.getByText(/planet sheet blew up/)).toBeInTheDocument();
  });

  /*
    THE REPORT IS THE POINT. A player on a phone cannot open a console, so the
    only route from their crash to the person who can fix it is a control that
    hands them the text. It is a CONTROL, so it is drawn whether the detail is
    folded or not.
  */
  it('copies the whole report without opening the fold first', async () => {
    const user = userEvent.setup();
    show(<Boom message="planet sheet blew up" />);

    await user.click(screen.getByRole('button', { name: i18n.t('crash.copy') }));

    expect(vi.mocked(copyText)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(copyText).mock.calls[0]?.[0]).toContain('planet sheet blew up');
    expect(await screen.findByText(i18n.t('crash.copied'))).toBeInTheDocument();
  });

  it('says so when the browser refuses the clipboard', async () => {
    vi.mocked(copyText).mockResolvedValueOnce(false);
    const user = userEvent.setup();
    show(<Boom />);

    await user.click(screen.getByRole('button', { name: i18n.t('crash.copy') }));

    expect(await screen.findByText(i18n.t('crash.copyFailed'))).toBeInTheDocument();
  });

  /*
    The player will reload — that is what the screen tells them to do — and the
    evidence has to survive it, because they are far more likely to describe the
    crash later than to copy it in the moment.
  */
  it('writes the crash down so it outlives the reload', () => {
    show(<Boom message="planet sheet blew up" />);

    const [latest] = readCrashes();
    expect(latest?.message).toContain('planet sheet blew up');
    expect(latest?.componentStack).toContain('Boom');
  });

  /*
    A boundary nobody mounted is not a floor, it is a file. This is the one
    assertion that cannot be made by rendering the component, so it reads the
    entry point: `<App />` must be INSIDE it, not beside it.
  */
  it('is mounted around the whole application, not merely available', () => {
    // Vitest runs from the package root; `import.meta.url` is an http URL here.
    const entry = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    const opens = entry.indexOf('<ErrorBoundary>');
    const app = entry.indexOf('<App />');
    const closes = entry.indexOf('</ErrorBoundary>');

    expect(opens).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(opens);
    expect(closes).toBeGreaterThan(app);
  });

  it('still shows the screen on a device that refuses storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    show(<Boom />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
