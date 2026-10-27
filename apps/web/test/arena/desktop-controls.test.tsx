import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSandboxWorld, type Pilot } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { FlightControls, aimKey, aimTargets } from '../../src/arena/Controls.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { GAME_KEY, MOUSE_DEADZONE, MOUSE_POINTER, MOUSE_RADIUS, ONE_PRESS_KEYS, createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * Owner 2026-10-27, the Yarık on a desktop: the mouse steers instead of the stick, the left
 * button fires, Q is the ability and E the tactic (Shift stays turbo), M opens the map, Tab
 * the list, Esc lets the mouse go. And the shield and repair: "insanlar … anlamıyor, basıyorum
 * çalışmıyor diyorlar" — who it goes to is asked on the screen, not left to a double tap.
 */
let previous = 'en';
beforeEach(async () => {
  previous = i18n.language; await i18n.changeLanguage('tr');
  Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
});
afterEach(async () => { await i18n.changeLanguage(previous); });

const aimed = (friends: number) => {
  const controls = createControls();
  controls.setSignature({ aimed: true, self: () => 4, friends: () => friends });
  return controls;
};

describe('the keyboard', () => {
  it('casts the ability on Q and the tactic on E, one each per press', () => {
    const controls = createControls();
    controls.setSignature({ aimed: false, self: () => 4, friends: () => 0 }); controls.setTactic('radar');
    controls.keyDown('KeyQ'); controls.keyUp('KeyQ');
    expect(controls.sample()).toMatchObject({ signature: true, radar: false });
    controls.keyDown('KeyE'); controls.keyUp('KeyE');
    expect(controls.sample()).toMatchObject({ signature: false, radar: true });
    for (const key of ['KeyQ', 'KeyE']) { expect(GAME_KEY.test(key)).toBe(true); expect(ONE_PRESS_KEYS).toContain(key); }
  });

  it('no longer answers V, and keeps Shift as turbo', () => {
    const controls = createControls();
    controls.setSignature({ aimed: false, self: () => 4, friends: () => 0 });
    expect(GAME_KEY.test('KeyV')).toBe(false);
    controls.keyDown('KeyV');
    expect(controls.sample().signature).toBe(false);
    controls.keyDown('ShiftLeft');
    expect(controls.sample().turbo).toBe(true);
  });
});

describe('a shield or repair with no one to give it to', () => {
  it('goes on the pilot at once: there is no friend to wait for', () => {
    const controls = aimed(0);
    controls.actionDown('signature', 1, 0); controls.actionUp('signature', 1, 40);
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: 4 });
    expect(controls.aiming(100)).toBe(false);
  });

  it('waits for the choice when a friend flies, and can be cancelled', () => {
    const controls = aimed(2);
    controls.actionDown('signature', 1, 0); controls.actionUp('signature', 1, 40);
    expect(controls.sample().signature).toBe(false);
    expect(controls.aiming(100)).toBe(true);
    controls.cancelAim();
    expect(controls.aiming(100)).toBe(false);
  });
});

describe('the mouse', () => {
  // Owner 2026-10-27 (second pass): "mouse'u durdurunca yönümü düzlüyor … dönmeye devam etmeli. Orta alanda
  // çok ufak bir yüzdelik bırakabiliriz". The mouse is a stick that stays where it was pushed.
  it('steers only while it holds the pointer, saturating at full deflection', () => {
    const controls = createControls();
    controls.mouseMove(MOUSE_RADIUS, 0); controls.sample();
    expect(controls.stick.x).toBe(0);
    controls.steerWithMouse(true);
    controls.mouseMove(MOUSE_RADIUS / 2, 0);
    controls.sample();
    expect(controls.stick.x).toBeCloseTo((0.5 - MOUSE_DEADZONE) / (1 - MOUSE_DEADZONE), 6);
    controls.mouseMove(MOUSE_RADIUS * 4, -MOUSE_RADIUS * 4);
    controls.sample();
    expect(Math.hypot(controls.stick.x, controls.stick.y)).toBeCloseTo(1, 6);
    expect(controls.stick.x).toBeGreaterThan(0); expect(controls.stick.y).toBeLessThan(0);
  });

  it('keeps turning while the mouse rests, and flies straight once it is back in the small centre', () => {
    const controls = createControls(); controls.steerWithMouse(true);
    controls.mouseMove(MOUSE_RADIUS * 0.6, 0);
    for (let tick = 0; tick < 90; tick++) controls.sample();
    expect(controls.stick.x).toBeGreaterThan(0.5);
    controls.mouseMove(-MOUSE_RADIUS * 0.6 + MOUSE_RADIUS * MOUSE_DEADZONE * 0.5, 0);
    controls.sample();
    expect(controls.stick.x).toBe(0);
    expect(MOUSE_DEADZONE).toBeGreaterThan(0); expect(MOUSE_DEADZONE).toBeLessThanOrEqual(0.08);
    expect(controls.mouseAim.x).toBeCloseTo(MOUSE_DEADZONE * 0.5, 6);
  });

  it('gives way to WASD, comes back to where the mouse holds it, and lets go when the pointer is released', () => {
    const controls = createControls(); controls.steerWithMouse(true);
    controls.mouseMove(MOUSE_RADIUS, 0); controls.keyDown('KeyA');
    controls.sample();
    expect(controls.stick.x).toBe(-1);
    controls.keyUp('KeyA'); controls.sample();
    expect(controls.stick.x).toBe(1);
    controls.steerWithMouse(false);
    controls.sample();
    expect(controls.stick.x).toBe(0);
    controls.steerWithMouse(true); controls.sample();
    expect(controls.stick.x).toBe(0);
  });

  it('fires while its left button is down', () => {
    const controls = createControls();
    controls.actionDown('fire', MOUSE_POINTER, 0);
    expect(controls.sample().fire).toBe(true);
    controls.actionUp('fire', MOUSE_POINTER, 100);
    expect(controls.sample().fire).toBe(false);
  });
});

const store = (friends: { id: number; hull: number; at: number }[], patch: Partial<Pilot> = {}) => {
  const world = createSandboxWorld({ bots: 0, ship: 'muhafiz' });
  Object.assign(world.pilot, { clanId: 'c' }, patch);
  for (const friend of friends) {
    const drone = Object.assign(createSandboxWorld({ bots: 0, ship: 'kilavuz' }).pilot, { id: friend.id, clanId: 'c' });
    drone.hull = drone.hull * friend.hull; drone.p.x = world.pilot.p.x + friend.at; drone.p.y = world.pilot.p.y; drone.p.z = world.pilot.p.z;
    world.drones.push(drone);
  }
  const hud = createHudStore();
  hud.publish(world, 'flight', false, false);
  return { hud, world };
};

const press = (container: HTMLElement, pointerId: number): void => {
  const key = container.querySelector('.ac-signature')!;
  fireEvent.pointerDown(key, { pointerId }); fireEvent.pointerUp(key, { pointerId });
};

describe('the target tray', () => {
  const names: Record<number, string> = { 7: 'Ada', 8: 'Bora' };
  const open = (friends: { id: number; hull: number; at: number }[]) => {
    const { hud, world } = store(friends);
    const controls = createControls();
    controls.setSignature({ aimed: true, self: () => world.pilot.id, friends: () => friends.length });
    const view = render(<FlightControls controls={controls} store={hud} nameOf={id => names[id] ?? '?'} onLand={() => undefined} onCancel={() => undefined} />);
    return { view, controls, world };
  };

  it('stays shut until the ability is pressed', () => {
    const { view } = open([{ id: 7, hull: 1, at: 100 }]);
    expect(view.container.querySelector('.ac-aim-tray')).toBeNull();
  });

  it('asks who the shield is for: yourself first, then friends nearest first, each with its hull', () => {
    const { view } = open([{ id: 8, hull: 0.9, at: 400 }, { id: 7, hull: 0.3, at: 120 }]);
    press(view.container, 1);
    const tray = view.getByRole('group', { name: arenaCopy().aimTitle.muhafiz });
    const chips = [...tray.querySelectorAll<HTMLButtonElement>('.ac-aim-chip')];
    expect(chips.map(chip => chip.querySelector('b')?.textContent)).toEqual([arenaCopy().aimSelf, 'Ada', 'Bora']);
    expect(chips.map(chip => chip.querySelector('kbd')?.textContent)).toEqual(['1', '2', '3']);
    expect(chips[1]?.querySelector('small')?.textContent).toBe('120 m');
    expect(Number(chips[1]?.style.getPropertyValue('--hp'))).toBeCloseTo(0.3, 6);
  });

  it('casts on the friend tapped in it and closes', () => {
    const { view, controls } = open([{ id: 7, hull: 1, at: 120 }]);
    press(view.container, 1);
    fireEvent.pointerDown(view.getByRole('button', { name: /Ada/ }), { pointerId: 2 });
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: 7 });
    expect(view.container.querySelector('.ac-aim-tray')).toBeNull();
  });

  it('casts on oneself from the first chip, and closes on its cancel', () => {
    const { view, controls, world } = open([{ id: 7, hull: 1, at: 120 }]);
    press(view.container, 1);
    fireEvent.pointerDown(view.getByRole('button', { name: new RegExp(arenaCopy().aimSelf) }), { pointerId: 2 });
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: world.pilot.id });
    press(view.container, 3);
    fireEvent.pointerDown(view.getByRole('button', { name: arenaCopy().aimCancel }), { pointerId: 4 });
    expect(view.container.querySelector('.ac-aim-tray')).toBeNull();
    expect(controls.sample().signature).toBe(false);
  });

  it('orders the same targets the number keys pick', () => {
    const { hud } = store([{ id: 8, hull: 1, at: 400 }, { id: 7, hull: 1, at: 120 }]);
    expect(aimTargets(hud.getSnapshot()).map(friend => friend.id)).toEqual([7, 8]);
  });

  it('picks with the number keys: 1 yourself, 2 on the nearest friend; nothing when no aim waits', () => {
    const { hud, world } = store([{ id: 8, hull: 1, at: 400 }, { id: 7, hull: 1, at: 120 }]);
    const controls = createControls();
    controls.setSignature({ aimed: true, self: () => world.pilot.id, friends: () => 2 });
    expect(aimKey(controls, hud.getSnapshot(), 'Digit2', 0)).toBe(false);
    controls.actionDown('signature', 1, 0); controls.actionUp('signature', 1, 40);
    expect(aimKey(controls, hud.getSnapshot(), 'Digit2', 100)).toBe(true);
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: 7 });
    controls.actionDown('signature', 2, 1000); controls.actionUp('signature', 2, 1040);
    expect(aimKey(controls, hud.getSnapshot(), 'Digit1', 1100)).toBe(true);
    expect(controls.sample()).toMatchObject({ signature: true, signatureTarget: world.pilot.id });
    controls.actionDown('signature', 3, 2000); controls.actionUp('signature', 3, 2040);
    expect(aimKey(controls, hud.getSnapshot(), 'Digit5', 2100)).toBe(false);
    expect(aimKey(controls, hud.getSnapshot(), 'KeyW', 2100)).toBe(false);
  });

  it('names each key on a desktop: the click, Shift, Q and E', () => {
    const { view } = open([]);
    const caps = [...view.container.querySelectorAll('.ac-action kbd')].map(cap => cap.textContent);
    expect(caps).toEqual([arenaCopy().keyFire, 'Shift', 'Q', 'E']);
  });
});
