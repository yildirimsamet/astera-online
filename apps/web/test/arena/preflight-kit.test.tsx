import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { ClassPicker } from '../../src/arena/ClassPicker.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { LoopLine } from '../../src/arena/LoopLine.js';
import { ModePicker } from '../../src/arena/ModePicker.js';

vi.mock('../../src/arena/assets/load.js', () => ({ loadArenaAssets: () => Promise.resolve({ colliders: new Map(), rivals: [], classes: new Map(), fx: new Map(), sounds: new Map(), music: new Map() }) }));
vi.mock('../../src/arena/assets/memory.js', () => ({ assetTextureBytes: () => 0, releaseKtx2: () => undefined }));
vi.mock('../../src/arena/client.js', () => ({ createArenaClient: () => ({ warm: () => Promise.resolve(), start: vi.fn(), setHud: vi.fn(), setPhase: vi.fn(),
  dispose: vi.fn(), setSpectator: vi.fn(), reset: vi.fn(), friendAt: vi.fn(), metrics: { fps: 60 } }) }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');

/**
 * G12-b (2026-11-16): THE FLIGHT DESK ON THE GAME KIT. "Which ship, which way, and go." The
 * desk keeps the ship and the field the picture: the class on kit choices over a dark glass
 * panel, its numbers on the kit's figures, the flight's kind on kit plates that say what each is
 * worth, and one lit launch that says why it cannot go when it cannot.
 */

const OLD = /(^|\s)ap-(class|mode|loop|dock|ship|keys|eyebrow)|(^|\s)(text|bg|border|font)-v2-/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));

const zero = { alloy: 0, crystal: 0, deuterium: 0 };
const hangar = (readyAt: string | null) => ({
  core: 9, minCore: 9, ship: { class: 'akinci', level: 2, fuel: 223, ammo: 100, hold: [0, 0, 0], readyAt, readyReason: readyAt ? 'repair' : null,
    flying: false, changeUntil: null, xp: 0, xpNext: 150, levelCap: 9, abilities: {}, upgrade: zero },
  refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 500, alloy: 500, crystal: 500, cap: zero, sent: zero,
  resetsAt: '2026-10-25T00:00:00Z', entryClosesAt: '2099-11-25T00:00:00Z',
});
const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const lobby = { id: id(20), state: 'forming', leaderId: id(2), joined: true, members: [1, 2].map((n) => ({ playerId: id(n), name: n === 1 ? 'Ada' : 'Bora',
  ready: false, tactic: 'smoke', outcome: null, blocked: null, ship: { class: 'akinci', level: 2, fuel: 200, fuelMax: 250, readyAt: null } })) };
const serve = (readyAt: string | null, team: typeof lobby | null = null) => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/arena/hangar' ? hangar(readyAt)
    : { playerId: id(1), clanId: team ? id(10) : null, canCreate: false, capacity: 5, claims: [], team }), { status: 200 }))));
};

let language: string;
beforeEach(async () => { language = i18n.language; await i18n.changeLanguage('tr'); vi.stubGlobal('screen', { orientation: {} }); });
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(language); });

describe('the flight desk on the kit', () => {
  it('heads the desk with the kit’s display title and draws none of the old look', async () => {
    serve(null);
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await screen.findByText('Akıncı');
    expect(screen.getByRole('heading', { level: 1, name: 'Komutan Gemisi' })).toHaveClass('gk-display');
    const desk = view.container.querySelector('[data-screen="preflight"] section')!;
    expect(oldPaint(desk)).toEqual([]);
    expect(view.container.querySelector('.ap-launch')).toHaveClass('gk-btn', 'gk-btn--action');
    expect(screen.getByRole('button', { name: /Ana gezegene dön/ })).toHaveClass('gk-btn');
  });

  it('says on the launch why a ship under repair cannot go', async () => {
    serve(new Date(Date.now() + 3_600_000).toISOString());
    render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    const launch = await screen.findByRole('button', { name: /Tamirde/ });
    expect(launch).toBeDisabled();
    expect(launch).toHaveClass('ap-launch', 'gk-btn--action');
  });
});

describe('the flight desk in a team lobby', () => {
  // The team's own presses (ready, launch together) run the lobby; a dead launch beside them only hid them.
  it('says who starts the launch in a note instead of a press that cannot be pressed', async () => {
    serve(null, lobby);
    const view = render(<Sandbox credential={() => Promise.resolve('tok')} onLeave={vi.fn()} />);
    await screen.findByText('Bora');
    expect((await screen.findByText('Kalkışı klan liderin başlatır.')).closest('.gk-inote')).not.toBeNull();
    expect(view.container.querySelector('.ap-launch')).toBeNull();
  });
});

describe('the class on the kit', () => {
  it('offers the classes as kit choices and lays the numbers on kit figures, coloured by the class', () => {
    const view = render(<ClassPicker c={arenaCopy()} value="muhafiz" onPick={vi.fn()} />);
    const root = view.container.querySelector('section')!;
    expect(root).toHaveClass('gk-shipclass');
    expect(root).toHaveAttribute('data-ship', 'muhafiz');
    expect(oldPaint(root)).toEqual([]);
    expect(screen.getAllByRole('radio').every((radio) => radio.classList.contains('gk-tab'))).toBe(true);
    expect(root.querySelectorAll('.gk-shipclass__stats li .gk-num')).toHaveLength(8);
  });
});

describe('the flight’s kind on the kit', () => {
  it('names its choice, and a shut live room says the Core it waits for', () => {
    const onPick = vi.fn();
    render(<ModePicker c={arenaCopy()} mode="solo" lock={{ core: 7, need: 9 }} onPick={onPick} />);
    const group = screen.getByRole('radiogroup', { name: 'Uçuş türü' });
    expect(group).toHaveClass('gk-choices');
    const live = screen.getByRole('radio', { name: /Gerçek uçuş/ });
    expect(live).toHaveClass('gk-tab');
    expect(live).toBeDisabled();
    expect(live).toHaveTextContent('Çekirdek 9 gerekir · şu an 7');
  });
});

describe('the loop on the kit', () => {
  it('opens its three steps in a kit well behind a kit help mark', () => {
    const view = render(<LoopLine c={arenaCopy()} />);
    expect(view.container.querySelector('.gk-loop .gk-glyph')).not.toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(view.container.querySelector('ol')).toHaveClass('gk-well');
    expect(oldPaint(view.container.firstElementChild!)).toEqual([]);
  });
});
