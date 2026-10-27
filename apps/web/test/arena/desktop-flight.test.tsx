import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaWorld } from '@astera/rules/arena';
import type { HudStore } from '../../src/arena/store.js';
import type { ArenaControls } from '../../src/arena/input.js';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';

/** Owner 2026-10-27: the Yarık's desktop keys on the flight page (desktop-controls.test.tsx has the controls). */
const flight = vi.hoisted(() => ({ args: null as { world: ArenaWorld; store: HudStore; controls: ArenaControls } | null,
  friendAt: null as ((x: number, y: number) => number | null) | null }));
vi.mock('../../src/arena/assets/load.js', () => ({ loadArenaAssets: () => Promise.resolve({ colliders: new Map(), rivals: [], classes: new Map(), fx: new Map(), sounds: new Map(), music: new Map() }) }));
vi.mock('../../src/arena/assets/memory.js', () => ({ assetTextureBytes: () => 0, releaseKtx2: () => undefined }));
vi.mock('../../src/arena/client.js', () => ({ createArenaClient: (args: typeof flight.args) => {
  flight.args = args;
  const friendAt = vi.fn((_x: number, _y: number): number | null => null); flight.friendAt = friendAt;
  return { warm: () => Promise.resolve(), start: vi.fn(), setHud: vi.fn(), setPhase: vi.fn(), dispose: vi.fn(),
    setSpectator: vi.fn(), reset: vi.fn(), friendAt, metrics: { fps: 60 } };
} }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number; readonly pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse'; }
}
let language: string;
let locked: Element | null = null;
const lock = vi.fn(() => { locked = document.querySelector('canvas.arena-canvas'); document.dispatchEvent(new Event('pointerlockchange')); });
const unlock = vi.fn(() => { locked = null; document.dispatchEvent(new Event('pointerlockchange')); });
beforeEach(async () => {
  language = i18n.language; await i18n.changeLanguage('tr'); flight.args = null; locked = null;
  vi.stubGlobal('screen', { orientation: {} });
  if (!('PointerEvent' in window)) vi.stubGlobal('PointerEvent', TestPointerEvent);
  Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => locked });
  Object.defineProperty(document, 'exitPointerLock', { configurable: true, value: unlock });
  Object.defineProperty(HTMLCanvasElement.prototype, 'requestPointerLock', { configurable: true, value: lock });
});
afterEach(async () => {
  vi.unstubAllGlobals(); await i18n.changeLanguage(language);
  Reflect.deleteProperty(document, 'pointerLockElement'); Reflect.deleteProperty(document, 'exitPointerLock');
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'requestPointerLock');
});

async function fly() {
  const view = render(<Sandbox onLeave={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: arenaCopy().launch }));
  await waitFor(() => { expect(view.container.querySelector('main')?.dataset.screen).toBe('flight'); });
  const args = flight.args; if (!args) throw new Error('No flight');
  return { view, ...args };
}

describe('a desktop flight', () => {
  it('takes the mouse on a click in the sky, steers with it, fires on its button, and gives it back on Esc', async () => {
    const { view, controls } = await fly();
    const main = view.container.querySelector('main')!;
    expect(screen.getByText(arenaCopy().mouseHint)).toBeInTheDocument();
    fireEvent.pointerDown(main, { pointerType: 'mouse', button: 0 });
    expect(lock).toHaveBeenCalledOnce();
    expect(screen.queryByText(arenaCopy().mouseHint)).toBeNull();
    // jsdom has no movementX; a browser fills it on every move under a pointer lock.
    const move = new MouseEvent('mousemove'); Object.defineProperties(move, { movementX: { value: 60 }, movementY: { value: 0 } });
    act(() => { document.dispatchEvent(move); });
    controls.sample();
    expect(controls.stick.x).toBeGreaterThan(0);
    fireEvent.mouseDown(document, { button: 0 });
    expect(controls.firing).toBe(true);
    fireEvent.mouseUp(document, { button: 0 });
    expect(controls.firing).toBe(false);
    // Esc lets the mouse go (the browser's own Esc does too), and with it the mouse's hold on the ship.
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
    expect(unlock).toHaveBeenCalledOnce();
    fireEvent.mouseDown(document, { button: 0 });
    expect(controls.firing).toBe(false);
    expect(screen.getByText(arenaCopy().mouseHint)).toBeInTheDocument();
  });

  // Owner 2026-10-27 (second pass): "oyun başladığında mouse modu otomatik açılmalı".
  it('takes the mouse with the launch itself on a desktop, so no second click is needed', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('pointer: fine'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const { controls } = await fly();
    expect(lock).toHaveBeenCalledOnce();
    expect(controls.mouseSteering).toBe(true);
    expect(screen.queryByText(arenaCopy().mouseHint)).toBeNull();
  });

  it('takes the mouse again when the menu is left for the flight', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('pointer: fine'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    await fly();
    fireEvent.click(screen.getByRole('button', { name: arenaCopy().settings }));
    expect(unlock).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: arenaCopy().resume }));
    expect(lock).toHaveBeenCalledTimes(2);
  });

  // Under the lock the cursor is hidden and its last spot stale: a click picks the friend on the crosshair.
  it('under the lock picks the friend a click aims at on the crosshair', async () => {
    const { view, controls } = await fly();
    const main = view.container.querySelector('main')!;
    fireEvent.pointerDown(main, { pointerType: 'mouse', button: 0 });
    vi.spyOn(controls, 'aiming').mockReturnValue(true);
    fireEvent.pointerDown(view.container.querySelector('canvas')!, { pointerType: 'mouse', button: 0, clientX: 12, clientY: 30 });
    expect(flight.friendAt).toHaveBeenLastCalledWith(window.innerWidth / 2, window.innerHeight / 2);
  });

  it('leaves the pointer alone at launch on a touch screen', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('pointer: coarse'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    await fly();
    expect(lock).not.toHaveBeenCalled();
  });

  it('never takes the pointer from a finger, nor from a click on a key', async () => {
    const { view } = await fly();
    fireEvent.pointerDown(view.container.querySelector('main')!, { pointerType: 'touch' });
    fireEvent.pointerDown(view.container.querySelector('.ac-signature')!, { pointerType: 'mouse', button: 0, pointerId: 3 });
    expect(lock).not.toHaveBeenCalled();
  });

  it('opens and shuts the map on M', async () => {
    await fly();
    fireEvent.keyDown(window, { code: 'KeyM' });
    expect(screen.getByRole('dialog', { name: arenaCopy().mapTitle })).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'KeyM' });
    expect(screen.queryByRole('dialog', { name: arenaCopy().mapTitle })).toBeNull();
  });

  it('shows the list while Tab is held, and keeps Tab from moving the focus', async () => {
    await fly();
    const press = new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', cancelable: true });
    act(() => { window.dispatchEvent(press); });
    expect(press.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: arenaCopy().standings })).toBeInTheDocument();
    fireEvent.keyUp(window, { code: 'Tab', key: 'Tab' });
    expect(screen.queryByRole('dialog', { name: arenaCopy().standings })).toBeNull();
    // A Tab let go in another window never reaches this one: leaving the window closes the list.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', key: 'Tab', cancelable: true })); });
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(screen.queryByRole('dialog', { name: arenaCopy().standings })).toBeNull();
  });

  it('lets the mouse go when the menu opens', async () => {
    const { view } = await fly();
    fireEvent.pointerDown(view.container.querySelector('main')!, { pointerType: 'mouse', button: 0 });
    fireEvent.click(screen.getByRole('button', { name: arenaCopy().settings }));
    expect(unlock).toHaveBeenCalled();
  });

  it('casts a practice repair on Q straight onto the pilot: no friend flies there', async () => {
    const { controls, world } = await fly();
    fireEvent.keyDown(window, { code: 'KeyQ' });
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: world.pilot.id });
  });
});
