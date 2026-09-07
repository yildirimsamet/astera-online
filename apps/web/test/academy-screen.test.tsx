import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Academy, AcademyScreen } from '../src/onboarding/Academy.jsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../src/api/context.js';
import { Api } from '../src/api/client.js';
import { academyFetch } from '../src/onboarding/academyFetch.js';
import { openAcademy, beginAcademyOrder, beginAcademyFlight, advanceAcademy, type AcademyWorld } from '../src/onboarding/academyWorld.js';
import { ACADEMY_STEPS } from '@astera/rules';
import { saveAcademy } from '../src/onboarding/academyStorage.js';
import * as analytics from '../src/lib/analytics.js';
import type * as GateModule from '../src/onboarding/Gate.jsx';

afterEach(() => { localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

function lesson(world: AcademyWorld, replay = false) {
  const write = vi.fn();
  const api = new Api({ fetch: academyFetch(() => world, write) });
  const mine = vi.spyOn(api, 'mine');
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ApiProvider api={api}><AcademyScreen world={world} write={write} api={api} replay={replay}
      onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} /></ApiProvider>
  </QueryClientProvider>);
  return { mine, write };
}

vi.mock('../src/screens/GalaxyView.jsx', () => ({ GalaxyView: ({ panel, planetGroup, frameTelescope, openingHome, onPanel, onFocused, coachTap, coachFocus }: {
  panel: string | null; planetGroup: string; frameTelescope?: boolean; openingHome?: boolean;
  onPanel: (panel: null | 'report') => void; onFocused?: (focus: { kind: 'planet'; id: string }) => void;
  coachTap?: { label: string; onTap: () => void } | null;
  coachFocus?: { focus: { kind: string; id?: string }; request: number } | null;
}) => <div data-testid="academy-galaxy" data-coach-request={coachFocus?.request} data-coach-kind={coachFocus?.focus.kind} data-panel={panel} data-group={planetGroup} data-framing={frameTelescope} data-opening-home={openingHome}>
  {/* The real disc pins this to the focused subject; the stub only has to exist. */}
  {coachTap && <button type="button" data-academy-tap-target aria-label={coachTap.label} onClick={coachTap.onTap} />}
  <div data-sheet-scroll data-testid="menu-scroll" />
  <button data-academy-home onClick={() => { onFocused?.({ kind: 'planet', id: 'academy-home' }); }}>Home planet</button>
  <button data-tab="orbit">Intel</button><button data-tab="defend">Defend</button><button data-tab="reach">Fleet</button>
  <button data-sensor-toggle="telescope">Telescope switch</button>
  <button id="row-DEUTERIUM_PLANT" onClick={() => { onPanel('report'); }}>Deuterium detail</button>
  <button data-sheet-panel onClick={() => { onPanel('report'); }}>Open report</button>
  <div data-sheet-panel><header><button onClick={() => { onPanel(null); }}>Close report</button></header></div>
</div> }));
vi.mock('../src/shell/StatusBar.js', () => ({ StatusBar: () => null }));
vi.mock('../src/shell/PendingStrip.js', () => ({ PendingStrip: () => null }));
vi.mock('../src/onboarding/Gate.jsx', async (original) => ({ ...await original<typeof GateModule>(), useScrollIntoView: () => undefined }));

describe('Academy ownership and progression', () => {
  it.each(['core', 'extractor', 'aegis', 'darts', 'prospector'] as const)('scrolls the menu to its waiting queue when %s starts', (id) => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    const now = Date.now();
    lesson(beginAcademyOrder(openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === id)), id, now));
    const scroll = vi.fn();
    screen.getByTestId('menu-scroll').scrollTo = scroll;
    act(() => { [...frames].forEach((frame) => { frame(0); }); });
    expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(screen.getByText(/order is underway/i)).toBeInTheDocument();
  });
  it('opens with a flight toward home and teaches the planet press instead of Continue', () => {
    render(<Academy onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByTestId('academy-galaxy')).toHaveAttribute('data-opening-home', 'true');
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(document.querySelector('img[src$="tutorial-hand-icon.png"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home planet' }));
    expect(screen.getByTestId('academy-galaxy')).toHaveAttribute('data-panel', 'planet');
    expect(screen.getByText(/Production menu/i)).toBeInTheDocument();
  });
  it('points at Show the target before a launch sheet exists', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'pirate')));
    vi.spyOn(screen.getByRole('button', { name: 'Show the target' }), 'getBoundingClientRect').mockReturnValue(new DOMRect(170, 90, 90, 30));
    [...frames].forEach((frame) => { frame(0); });
    expect(document.querySelector('img[src$="tutorial-hand-icon.png"]')?.parentElement?.style.visibility).toBe('visible');
  });
  it('points to the report close control after it has been opened', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => { frames.push(fn); return frames.length; });
    lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'pirateReport')));
    fireEvent.click(screen.getByRole('button', { name: 'Open report' }));
    vi.spyOn(screen.getByRole('button', { name: 'Close report' }), 'getBoundingClientRect').mockReturnValue(new DOMRect(320, 180, 36, 36));
    [...frames].forEach((frame) => { frame(0); });
    expect(document.querySelector('img[src$="tutorial-hand-icon.png"]')?.parentElement?.style.visibility).toBe('visible');
  });
  it('does not promise another exit package at the end of a replay', () => {
    lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'departure')), true);
    expect(screen.getByText(/Practice complete.*No rewards/i)).toBeInTheDocument();
    expect(screen.queryByText(/will move into your real galaxy/i)).not.toBeInTheDocument();
  });
  it('keeps untaught galaxy controls out of the opening and reveals Telescope for its exercise', () => {
    const view = render(<Academy onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(view.container.querySelector('[data-academy]')).toHaveAttribute('data-academy-step', 'welcome');
    const styles = Array.from(view.container.querySelectorAll('style')).map((node) => node.textContent).join('');
    expect(styles).toContain('[data-academy] [data-disc-controls]{display:none}');
    expect(styles).toContain('[data-academy] [data-sensor-toggles]{display:none}');
  });
  it('blocks detail-sheet presses in an introduction but not Continue', () => {
    const world = openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'deuterium'));
    const { write } = lesson(world);
    fireEvent.click(screen.getByRole('button', { name: 'Deuterium detail' }));
    expect(screen.getByTestId('academy-galaxy')).toHaveAttribute('data-panel', 'planet');
    expect(write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ step: world.step + 1 }));
  });
  /**
   * THE SPHERE, THEN SOMETHING INSIDE IT, THEN ON. Owner instruction.
   *
   * A radius on its own is a fact, not a reason. One second after the sphere opens
   * a world appears inside it, and only then does the beat mean what it is trying
   * to say — *this is what sight is for.* The advance moved out to leave that
   * demonstration on screen for more than a blink; at the old four seconds the
   * player had three, most of which is the sphere still growing.
   */
  it('opens the sphere, puts a world in it a second later, then advances once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const world = openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'telescope'));
    const { write } = lesson(world);
    fireEvent.click(screen.getByRole('button', { name: 'Telescope switch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Telescope switch' }));

    act(() => { vi.advanceTimersByTime(999); });
    expect(write).not.toHaveBeenCalled();

    // The demonstration world, and NOT an advance: the beat is still running.
    act(() => { vi.advanceTimersByTime(1); });
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ sightDemo: true, step: world.step }));

    act(() => { vi.advanceTimersByTime(4999); });
    expect(write).toHaveBeenCalledOnce();
    act(() => { vi.advanceTimersByTime(1); });
    expect(write).toHaveBeenCalledTimes(2);
    // And it leaves with the demonstration switched off behind it.
    expect(write).toHaveBeenLastCalledWith(
      expect.objectContaining({ step: world.step + 1, sightDemo: false }),
    );
  });
  it('advances the battle lesson on closing the read report, without a Continue', () => {
    const world = openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'pirateReport'));
    const { write } = lesson(world);
    fireEvent.click(screen.getByRole('button', { name: 'Open report' }));
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close report' }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ step: world.step + 1 }));
  });
  it.each(['deuterium', 'foundry', 'uplink', 'radar', 'veil', 'thorn', 'bastion', 'hangar'] as const)('frames %s without a hand and offers a pulsing Continue', (id) => {
    lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === id)));
    expect(document.querySelector('img[src$="tutorial-hand-icon.png"]')).toBeNull();
    expect(document.querySelector('[data-tutorial-intro]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' }).className).toContain('academy-continue');
    expect(screen.getByText(/introduction only/i)).toBeInTheDocument();
  });
  it.each([['intel', 'grow', 'Intel'], ['defend', 'orbit', 'Defend'], ['fleet', 'defend', 'Fleet']] as const)('keeps the planet menu open until %s is clicked', (id, previous, name) => {
    const world = openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === id));
    const { write } = lesson(world);
    expect(screen.getByTestId('academy-galaxy')).toHaveAttribute('data-panel', 'planet');
    expect(screen.getByTestId('academy-galaxy')).toHaveAttribute('data-group', previous);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name }));
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ step: world.step + 1 }));
  });
  it('frames Telescope after the real toggle without offering Continue', () => {
    lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'telescope')));
    fireEvent.click(screen.getByRole('button', { name: 'Telescope switch' }));
    expect(screen.getByTestId('academy-galaxy')).toHaveAttribute('data-framing', 'true');
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });
  it('resumes the saved lesson while replay starts fresh and leaves that save alone', () => {
    saveAcademy(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'production')));
    const saved = localStorage.getItem('astera.academy.v1');
    const view = render(<Academy onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/Production menu/i)).toBeInTheDocument();
    view.unmount();
    render(<Academy replay onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/private training galaxy/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home planet' }));
    expect(localStorage.getItem('astera.academy.v1')).toBe(saved);
  });
  /**
   * LOOK AT IT FIRST, THEN COMMIT TO IT. Owner instruction, all three missions.
   *
   * "Show the target" used to open the launch surface outright, so a commander was
   * asked to send ships at a rock, a pirate or a world they had never actually
   * SEEN — the one thing the disc exists to show them. It now flies the camera
   * onto the subject with no rail over it, and the sheet waits behind a tap on the
   * target itself.
   */
  it('flies to the target first and opens nothing until it is tapped', async () => {
    const { mine } = lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'mine')));

    fireEvent.click(screen.getByRole('button', { name: 'Show the target' }));
    // The camera has been asked to go, and NOTHING has opened over it.
    expect(screen.queryByTestId('academy-mining-target')).toBeNull();
    expect(mine).not.toHaveBeenCalled();

    const target = screen.getByRole('button', { name: 'Tap the target' });
    fireEvent.click(target);
    expect(await screen.findByTestId('academy-mining-target')).toBeInTheDocument();
    // Still nothing sent: the sheet is where the fleet is chosen.
    expect(mine).not.toHaveBeenCalled();
  });

  it('offers the same two steps at the pirate, and hides the tap target once the sheet is up', async () => {
    lesson(openAcademy(Date.now(), ACADEMY_STEPS.findIndex((s) => s.id === 'pirate')));

    fireEvent.click(screen.getByRole('button', { name: 'Show the target' }));
    const target = screen.getByRole('button', { name: 'Tap the target' });
    expect(target).toBeInTheDocument();

    fireEvent.click(target);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Tap the target' })).toBeNull();
    });
  });
  it('opens an actual battle signal before allowing the report lesson to continue', async () => {
    const start = Date.now() - 60_000;
    const world = advanceAcademy(beginAcademyFlight(openAcademy(start, ACADEMY_STEPS.findIndex((s) => s.id === 'pirate')), 'pirate', start), Date.now());
    lesson(world);
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /unread/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open battle notification' })).not.toBeInTheDocument();
  });
  it('opens a clearly local lesson without fetching a real preview', () => {
    const network = vi.spyOn(globalThis, 'fetch');
    render(<Academy onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/private training galaxy/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Home planet' }));
    expect(screen.getByText(/Production menu/i)).toBeInTheDocument();
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });
  it('leaves a replay without claiming or changing the real account', () => {
    const onLeave = vi.fn();
    const onClaim = vi.fn();
    render(<Academy replay onClaim={onClaim} onSignIn={vi.fn()} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Return to galaxy' }));
    expect(onLeave).toHaveBeenCalledOnce();
    expect(onClaim).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('skip leads to credentials, never silently creates an account', () => {
    const track = vi.spyOn(analytics, 'track');
    const onClaim = vi.fn();
    render(<Academy onClaim={onClaim} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByLabelText('Commander name')).toBeInTheDocument();
    expect(screen.queryByText(/four orders are staged/i)).not.toBeInTheDocument();
    expect(screen.getByText(/completed Academy progress/i)).toBeInTheDocument();
    expect(onClaim).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('tutorial_skip', { step: 0, lesson: 'welcome' });
  });
});

/**
 * EVERY AIM IS A NEW REQUEST, ACROSS THE WHOLE ACADEMY.
 *
 * Owner report: *"korsan aşamasında ekranı hareket ettirirsem, asteroid aşamasında
 * show target buton'a basınca asteroid'e zoom olmuyor. hiç zoom olmuyor."*
 *
 * The camera was innocent. `GalaxyView` guards its coach focus with
 * `handled.current === request`, and the counter was being reset to zero on every
 * step change — so the FIRST aim of every lesson was request 1, and request 1 had
 * already been spent on the pirate. The asteroid beat asked for a camera move that
 * the disc had, by its own bookkeeping, already performed.
 *
 * A request is a monotonic signal, which is the pattern the rest of this file
 * already uses (`homeSignal`, `focusRequest`). It counts up for the life of the
 * Academy and is never reset; whether an aim is CURRENT is a separate boolean.
 */
describe('aiming twice in one Academy', () => {
  const request = () => screen.getByTestId('academy-galaxy').getAttribute('data-coach-request');

  it('never repeats a request number between lessons', () => {
    const now = Date.now();
    const at = (id: string) => openAcademy(now, ACADEMY_STEPS.findIndex((s) => s.id === id));
    const write = vi.fn();
    const api = new Api({ fetch: academyFetch(() => at('pirate'), write) });
    const screenFor = (world: ReturnType<typeof at>) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ApiProvider api={api}>
          <AcademyScreen world={world} write={write} api={api} replay={false}
            onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />
        </ApiProvider>
      </QueryClientProvider>
    );

    const view = render(screenFor(at('pirate')));
    fireEvent.click(screen.getByRole('button', { name: 'Show the target' }));
    const first = request();
    expect(first).toBeTruthy();

    // The SAME mounted screen, moved on to the asteroid lesson — which is what
    // makes the collision possible: the disc keeps the request it last handled.
    view.rerender(screenFor(at('mine')));
    fireEvent.click(screen.getByRole('button', { name: 'Show the target' }));

    expect(screen.getByTestId('academy-galaxy').getAttribute('data-coach-kind')).toBe('asteroid');
    expect(request(), 'the second lesson reused the first lesson’s request').not.toBe(first);
  });
});
