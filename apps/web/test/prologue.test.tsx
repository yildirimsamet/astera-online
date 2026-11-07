import { STARTER, VESSEL_HULLS, VESSEL_SYSTEMS } from '@astera/rules';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Handbook } from '../src/onboarding/prologue/Handbook.js';
import { HOLD_MS, Prologue, THROW_MS } from '../src/onboarding/prologue/Prologue.js';
import { BURN_MS, PATCH_MS, WARP_MS, openPrologue, prologueAct, prologueHeld, prologueHull, prologueStep, prologueTick, restorePrologue, savePrologue } from '../src/onboarding/prologue/world.js';

vi.mock('../src/lib/playerAnalytics/runtime.js', async (original) => ({ ...await original<object>(), observe: (...args: unknown[]) => { seen.push(args); } }));
const seen: unknown[][] = [];
const heard: string[] = [];
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<object>(), playSound: (cue: string) => { heard.push(cue); } }));
// WebGL does not run here; the scene's own checks are visual (tools/visual).
vi.mock('../src/onboarding/prologue/ShipScene.js', () => ({ default: () => null, preloadShip: () => undefined }));
// The account sheet is tested on its own; here it only has to hand back what it was given.
vi.mock('../src/onboarding/ClaimDialog.js', () => ({
  ClaimDialog: ({ introduction, onClaim }: { introduction?: string; onClaim: (u: string, p: string) => Promise<void> }) => (
    <div role="dialog">{introduction}<button type="button" data-testid="claim-submit" onClick={() => { void onClaim('pilot', 'fixture-password'); }}>go</button></div>
  ),
}));

const END = { onClaim: vi.fn(() => Promise.resolve()), onSignIn: vi.fn(), onLeave: vi.fn() };

beforeEach(() => {
  localStorage.clear(); seen.length = 0; heard.length = 0; vi.useFakeTimers(); vi.clearAllMocks();
  // jsdom has no pointer capture; the controls ask for it on every press.
  HTMLElement.prototype.setPointerCapture = () => undefined;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const press = () => { fireEvent.click(screen.getByTestId('prologue-action')); };
const stage = () => screen.getByTestId('prologue').getAttribute('data-stage');
const wait = (ms: number) => { act(() => { vi.advanceTimersByTime(ms + 200); }); };
/** A tap on the breaker throws it; the lights try once the handle lands. */
const throwSwitch = () => {
  const lever = screen.getByTestId('prologue-switch');
  fireEvent.pointerDown(lever);
  fireEvent.pointerUp(lever);
  wait(THROW_MS);
};
/** Press and keep pressing until the ring is full. */
const hold = (id: string) => {
  fireEvent.pointerDown(screen.getByTestId(id));
  wait(HOLD_MS);
};

describe('the handbook', () => {
  it('lists its rules and can play the opening again without an account', () => {
    render(<Handbook onClose={vi.fn()} />);
    // Repairs, salvage crates, holds, sight, fleets and the jump.
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getByTestId('handbook-replay'));
    expect(stage()).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('handbook')).toBeTruthy();
  });
});

describe('the road', () => {
  it('has one way through, and an action out of turn does nothing', () => {
    const start = openPrologue(0);
    expect(prologueAct(start, 'collect', 1)).toBe(start);
    expect(prologueAct(start, 'claim', 1)).toBe(start);
    const lit = prologueAct(start, 'power', 1);
    expect(lit.stage).toBe('powered');
    expect(prologueAct(lit, 'power', 2)).toBe(lit);
  });

  it('finishes the two timed things on its own, and not before', () => {
    const burning = prologueAct(prologueAct(openPrologue(0), 'power', 0), 'burn', 10);
    expect(prologueTick(burning, 10 + BURN_MS - 1).stage).toBe('burning');
    expect(prologueTick(burning, 10 + BURN_MS).stage).toBe('batch');
  });

  it('ends on what the server will build, played or skipped', () => {
    const skipped = prologueAct(openPrologue(0), 'skip', 1);
    expect(skipped.stage).toBe('claim');
    expect(prologueHeld(skipped)).toEqual({ alloy: STARTER.opening.alloy, crystal: STARTER.opening.crystal });
  });

  /**
   * THE SIGNAL IS A PLACE (owner 2026-11-06). Tapping it flies the view out to a ship adrift, and the
   * claim is made in front of it: a player asked to sign up for a button would not; for a ship, yes.
   */
  it('flies to the signal, finds a ship, and is claimed there', () => {
    const signal = { stage: 'signal' as const, since: 0 };
    expect(prologueAct(signal, 'claim', 1)).toBe(signal);
    const warping = prologueAct(signal, 'travel', 1);
    expect(warping.stage).toBe('warping');
    expect(prologueTick(warping, 1 + WARP_MS - 1).stage).toBe('warping');
    const found = prologueTick(warping, 1 + WARP_MS);
    expect(found.stage).toBe('found');
    expect(prologueAct(found, 'claim', 2).stage).toBe('claim');
    expect(prologueStep('found')).toBe(5);
  });

  it('shows one hull, and keeps showing it after a reload', () => {
    const hull = prologueHull();
    expect(VESSEL_HULLS).toContain(hull);
    expect(prologueHull()).toBe(hull);
    localStorage.setItem('astera.prologue.hull', 'SAUCER');
    expect(VESSEL_HULLS).toContain(prologueHull());
  });

  it('picks up after a reload, and shrugs off a nonsense save', () => {
    savePrologue('collected');
    expect(restorePrologue(5).stage).toBe('collected');
    localStorage.setItem('astera.prologue', 'landed');
    expect(restorePrologue(5).stage).toBe('dark');
  });
});

describe('the screen', () => {
  it('plays from the dark to the signal with switch and held controls, and asks nothing of the network', () => {
    const net = vi.spyOn(globalThis, 'fetch');
    render(<Prologue {...END} />);
    expect(stage()).toBe('dark');
    expect(screen.queryByTestId('prologue-holds')).toBeNull();
    expect(screen.getByTestId('prologue-switch').getAttribute('role')).toBe('switch');
    throwSwitch();
    expect(stage()).toBe('powered');
    expect(screen.getByTestId('prologue-holds').textContent).toContain(String(STARTER.opening.crystal));
    expect(screen.getByTestId('prologue-systems').querySelectorAll('li')).toHaveLength(VESSEL_SYSTEMS.length);
    hold('prologue-ignite');
    expect(stage()).toBe('burning');
    expect(screen.getByTestId('prologue-fire')).toBeTruthy();
    expect(screen.getByTestId('prologue-furnace-light')).toBeTruthy();
    wait(BURN_MS);
    expect(stage()).toBe('batch');
    press();
    expect(stage()).toBe('collected');
    expect(screen.getByTestId('prologue-holds').textContent).toContain(String(STARTER.opening.alloy));
    hold('prologue-weld');
    expect(stage()).toBe('patching');
    wait(PATCH_MS);
    expect(stage()).toBe('signal');
    expect(screen.getByTestId('prologue-signal')).toBeTruthy();
    expect(net).not.toHaveBeenCalled();
  });

  it('answers every turn with a sound', () => {
    render(<Prologue {...END} />);
    throwSwitch();
    hold('prologue-ignite');
    expect(heard).toEqual(expect.arrayContaining(['switch', 'ignite']));
  });

  /** Owner playtest 2026-11-06: a modern tool, not a hammer, and a weld heard until the patch holds. */
  it('strikes the arc on the hold and keeps the torch sounding through the patch', () => {
    render(<Prologue {...END} />);
    throwSwitch();
    hold('prologue-ignite');
    wait(BURN_MS);
    press();
    heard.length = 0;
    fireEvent.pointerDown(screen.getByTestId('prologue-weld'));
    expect(heard).toEqual(['arc']);
    expect(screen.getByTestId('prologue-torch')).toBeTruthy();
    expect(screen.queryByTestId('prologue-hammer')).toBeNull();
    wait(HOLD_MS);
    expect(stage()).toBe('patching');
    expect(heard).toEqual(['arc', 'weld']);
  });

  /** Owner playtest 2026-11-07: a commander can stall at the first batch; the hand points at Collect. */
  it('points at the first batch until it is collected', () => {
    render(<Prologue {...END} />);
    throwSwitch();
    hold('prologue-ignite');
    expect(document.querySelector('[data-tap-ripple]')).toBeNull();
    wait(BURN_MS);
    expect(stage()).toBe('batch');
    expect(document.querySelector('[data-tap-ripple]')).not.toBeNull();
    press();
    expect(document.querySelector('[data-tap-ripple]')).toBeNull();
  });

  it('does nothing for a hold let go too early', () => {
    render(<Prologue {...END} />);
    throwSwitch();
    const ignite = screen.getByTestId('prologue-ignite');
    fireEvent.pointerDown(ignite);
    act(() => { vi.advanceTimersByTime(HOLD_MS / 2); });
    fireEvent.pointerUp(ignite);
    wait(HOLD_MS);
    expect(stage()).toBe('powered');
  });

  it('jumps to the signal, shows the ship it hands over, and claims that hull', async () => {
    savePrologue('signal');
    render(<Prologue {...END} />);
    fireEvent.click(screen.getByTestId('prologue-signal'));
    expect(stage()).toBe('warping');
    expect(screen.getByTestId('prologue-warp')).toBeTruthy();
    // The ship's scene is already there under the diving bridge, so the white clears straight onto it.
    expect(screen.getByTestId('prologue-reveal')).toBeTruthy();
    expect(screen.getByTestId('prologue-bridge').className).toContain('is-diving');
    expect(heard).toContain('warp');
    wait(WARP_MS);
    expect(stage()).toBe('found');
    expect(screen.queryByTestId('prologue-bridge')).toBeNull();
    expect(screen.getByTestId('prologue-whiteout')).toBeTruthy();
    const hull = prologueHull();
    expect(screen.getByTestId('prologue-reveal').getAttribute('data-hull')).toBe(hull);
    hold('prologue-claim');
    expect(stage()).toBe('claim');
    fireEvent.click(screen.getByTestId('claim-submit'));
    await act(async () => { await Promise.resolve(); });
    expect(END.onClaim).toHaveBeenCalledWith('pilot', 'fixture-password', [], undefined, undefined, hull);
  });

  it('asks for the account only at the end, and sends no progress with it', async () => {
    render(<Prologue {...END} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(stage()).toBe('claim');
    expect(screen.queryByTestId('prologue-action')).toBeNull();
    expect(document.body.textContent).toContain(String(STARTER.opening.alloy));
    await Promise.resolve();
  });

  it('lets someone with an account walk out at any point', () => {
    render(<Prologue {...END} />);
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(END.onSignIn).toHaveBeenCalledTimes(1);
  });

  it('tells the old funnel which tutorial this was', () => {
    render(<Prologue {...END} />);
    throwSwitch();
    const started = seen.find(call => call[0] === 'training_started');
    expect(started?.[1]).toMatchObject({ trainingVersion: 'prologue.v1' });
    expect(seen.find(call => call[0] === 'training_action_accepted')?.[1]).toMatchObject({ code: 'power' });
  });

  it('from the menu, ends at the door it came in by, and keeps no record', () => {
    render(<Prologue {...END} replay />);
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    throwSwitch();
    expect(localStorage.getItem('astera.prologue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(END.onLeave).toHaveBeenCalledTimes(1);
  });
});
