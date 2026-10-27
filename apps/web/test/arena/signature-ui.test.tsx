import { fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, ARENA_TUNING as T, SIGNATURE_COOLDOWN, createSandboxWorld, type Pilot, type ShipClass } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { ClassPicker, TacticPicker } from '../../src/arena/ClassPicker.js';
import { FlightControls } from '../../src/arena/Controls.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { AIM_WINDOW_MS, DOUBLE_TAP_MS, GAME_KEY, ONE_PRESS_KEYS, createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * Y4c, owner 2026-10-23: the right thumb holds FIRE, TURBO, A and B. A is the class's
 * signature: the Akıncı's missile leaves at once on a held lock; the Muhafız's shield and the
 * Kılavuz's repair are aimed: one tap, then the friend; two taps, oneself. B is the tactic
 * chosen in the hangar. Owner 2026-10-27: the keys are Q and E, and the friend is chosen in a
 * tray on the screen (desktop-controls.test.tsx).
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
}
beforeAll(() => { if (!('PointerEvent' in window)) vi.stubGlobal('PointerEvent', TestPointerEvent); });
afterAll(() => { vi.unstubAllGlobals(); });
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(previous); });

const tap = (controls: ReturnType<typeof createControls>, time: number): void => {
  controls.actionDown('signature', 1, time); controls.actionUp('signature', 1, time + 40);
};

describe('the A slot on the controls', () => {
  it('sends the missile on one press, at no one: the lock picks the target', () => {
    const controls = createControls();
    controls.setSignature({ aimed: false, self: () => 4, friends: () => 0 });
    tap(controls, 0);
    const intent = controls.sample();
    expect([intent.signature, intent.signatureTarget]).toEqual([true, -1]);
    expect(controls.sample().signature).toBe(false);
  });

  it('aims a shield or repair: one tap waits for a friend, a second tap soon after casts on oneself', () => {
    const controls = createControls();
    controls.setSignature({ aimed: true, self: () => 4, friends: () => 1 });
    tap(controls, 0);
    expect(controls.sample().signature).toBe(false);
    expect(controls.aiming(100)).toBe(true);
    tap(controls, DOUBLE_TAP_MS - 50);
    const intent = controls.sample();
    expect([intent.signature, intent.signatureTarget]).toEqual([true, 4]);
    expect(controls.aiming(DOUBLE_TAP_MS)).toBe(false);
  });

  it('casts on the friend tapped while aiming, and aiming runs out', () => {
    const controls = createControls();
    controls.setSignature({ aimed: true, self: () => 4, friends: () => 1 });
    tap(controls, 0);
    controls.signatureAt(7, 500);
    const intent = controls.sample();
    expect([intent.signature, intent.signatureTarget]).toEqual([true, 7]);
    tap(controls, 1000);
    expect(controls.aiming(1000 + AIM_WINDOW_MS + 1)).toBe(false);
    controls.signatureAt(7, 1000 + AIM_WINDOW_MS + 1);
    expect(controls.sample().signature).toBe(false);
  });

  it('takes two slow taps as two aims, never as a cast on oneself', () => {
    const controls = createControls();
    controls.setSignature({ aimed: true, self: () => 4, friends: () => 1 });
    tap(controls, 0); tap(controls, DOUBLE_TAP_MS + 100);
    expect(controls.sample().signature).toBe(false);
    expect(controls.aiming(DOUBLE_TAP_MS + 200)).toBe(true);
  });

  it('answers the keyboard: Q is A, one cast a press however long it is held', () => {
    const controls = createControls();
    controls.setSignature({ aimed: false, self: () => 4, friends: () => 0 });
    controls.keyDown('KeyQ'); controls.keyUp('KeyQ');
    expect(controls.sample().signature).toBe(true);
    expect(GAME_KEY.test('KeyQ')).toBe(true);
    expect(ONE_PRESS_KEYS).toContain('KeyQ');
  });
});

const flying = (ship: ShipClass, patch: Partial<Pilot> = {}) => {
  const world = createSandboxWorld({ bots: 0, ship });
  Object.assign(world.pilot, patch);
  const store = createHudStore();
  store.publish(world, 'flight', false, false);
  return store;
};
const keys = (ship: ShipClass, patch: Partial<Pilot> = {}) =>
  render(<FlightControls controls={createControls()} store={flying(ship, patch)} onLand={() => undefined} onCancel={() => undefined} />).container;

describe('the A and B keys', () => {
  it('shows FIRE, TURBO, the class\'s signature and only the tactic chosen', () => {
    const view = keys('muhafiz', { tactic: 'cloak' });
    expect([...view.querySelectorAll('.ac-action')].map(key => key.classList[1])).toEqual(['ac-fire', 'ac-turbo', 'ac-signature', 'ac-cloak']);
    expect(view.querySelector('.ac-signature small')?.textContent).toBe(arenaCopy().signatures.muhafiz.name);
    expect(view.querySelector('.ac-smoke')).toBeNull();
  });

  it('holds the missile back until the lock holds, its ring filling as the lock builds', () => {
    const building = keys('akinci', { lockTarget: 9, lockTicks: Math.round(T.lockTime * T.tickRate / 2) });
    const key = building.querySelector<HTMLButtonElement>('.ac-signature');
    expect(key?.disabled).toBe(true);
    expect(Number(key?.style.getPropertyValue('--charge'))).toBeCloseTo(0.5, 6);
    const ready = keys('akinci', { lockTarget: 9, lockTicks: Math.round(T.lockTime * T.tickRate) });
    expect(ready.querySelector<HTMLButtonElement>('.ac-signature')?.disabled).toBe(false);
    expect(ready.querySelector('.ac-signature')?.classList.contains('is-ready')).toBe(true);
  });

  it('counts the cooldown down on the A key', () => {
    const view = keys('kilavuz', { signatureCooldown: 12 * T.tickRate });
    const key = view.querySelector<HTMLButtonElement>('.ac-signature');
    expect(key?.disabled).toBe(true);
    expect(key?.querySelector('small')?.textContent).toBe('12');
    expect(Number(key?.style.getPropertyValue('--charge'))).toBeCloseTo(12 / SIGNATURE_COOLDOWN.kilavuz, 6);
  });

  it('asks who an aimed signature goes to while it waits for a friend', () => {
    const controls = createControls();
    controls.setSignature({ aimed: true, self: () => 0, friends: () => 1 });
    const view = render(<FlightControls controls={controls} store={flying('kilavuz')} onLand={() => undefined} onCancel={() => undefined} />).container;
    const key = view.querySelector<HTMLElement>('.ac-signature'); if (!key) throw new Error('no key');
    key.setPointerCapture = () => undefined;
    fireEvent.pointerDown(key, { pointerId: 3 }); fireEvent.pointerUp(key, { pointerId: 3 });
    expect(view.querySelector('.ac-aim-tray strong')?.textContent).toBe(arenaCopy().aimTitle.kilavuz);
  });
});

describe('the hangar', () => {
  it('names each class\'s signature beside its line', () => {
    const view = render(<ClassPicker c={arenaCopy()} value="akinci" onPick={() => undefined} />);
    expect(view.container.querySelector('.ap-class-signature')?.textContent).toContain(arenaCopy().signatures.akinci.name);
  });

  it('offers the B slot as one choice of the tactics, the picked one checked', () => {
    let picked = '';
    const view = render(<TacticPicker c={arenaCopy()} value="smoke" onPick={tactic => { picked = tactic; }} />);
    const radios = [...view.container.querySelectorAll('[role="radio"]')];
    const c = arenaCopy();
    expect(radios.map(radio => radio.querySelector('b')?.textContent)).toEqual([c.smoke, c.cloak, c.illusion, c.radar]);
    expect(radios.map(radio => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    const cloak = radios[1]; if (!cloak) throw new Error('no radio');
    fireEvent.click(cloak);
    expect(picked).toBe('cloak');
  });
});

describe('the HUD store', () => {
  it('publishes the tactic, the A cooldown in seconds, the lock share, the warning, shield and repair time', () => {
    const store = flying('akinci', { tactic: 'cloak', signatureCooldown: 3 * T.tickRate, lockTarget: 2, lockTicks: Math.round(T.lockTime * T.tickRate),
      threat: 3, ward: 2 * T.tickRate, mend: T.tickRate });
    const s = store.getSnapshot();
    expect([s.tactic, s.signatureCooldown, s.lockProgress, s.lockReady, s.threat, s.ward, s.mend]).toEqual(['cloak', 3, 1, true, 3, 2, 1]);
  });
});

const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null, crystal: null,
  damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
const hud = (ship: ShipClass, patch: Partial<Pilot>) =>
  render(<ArenaHud store={flying(ship, patch)} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />).container;

describe('the HUD line', () => {
  it('warns of a lock building, a lock held and a missile coming, each with what to do, over the spawn shield', () => {
    const c = arenaCopy();
    for (const [threat, tone] of [[1, 'warn'], [2, 'hostile'], [3, 'hostile']] as const) {
      const note = hud('kilavuz', { threat }).querySelector('.ah-note');
      expect(note?.querySelector('strong')?.textContent).toBe(c.threats[threat]);
      expect(note?.querySelector('span')?.textContent).toBe(c.threatHints[threat]);
      expect(note?.classList.contains(`tone-${tone}`)).toBe(true);
    }
  });

  it('counts a raised shield and a running repair down, with what they do', () => {
    const c = arenaCopy();
    const ward = hud('muhafiz', { shield: 0, ward: 5 * T.tickRate, shieldHp: 60, shieldMax: T.wardHp }).querySelector('.ah-note');
    expect(ward?.querySelector('strong')?.textContent).toBe(`${c.signatures.muhafiz.name} · 5 s`);
    expect(ward?.querySelector('span')?.textContent).toBe(c.wardHint);
    const mend = hud('kilavuz', { shield: 0, mend: 2 * T.tickRate }).querySelector('.ah-note');
    expect(mend?.querySelector('strong')?.textContent).toBe(`${c.signatures.kilavuz.name} · 2 s`);
    expect(mend?.querySelector('span')?.textContent).toBe(c.mendHint);
  });

  it('keeps a mark ready to point at whatever is aiming at the pilot', () => {
    expect(hud('kilavuz', {}).querySelector('.ah-incoming')).not.toBeNull();
  });
});
