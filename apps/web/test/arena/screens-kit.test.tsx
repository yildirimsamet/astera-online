import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaWorld } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { SortieSummary } from '../../src/arena/Hangar.js';
import type { HudStore } from '../../src/arena/store.js';

vi.mock('../../src/arena/assets/load.js', () => ({ loadArenaAssets: () => Promise.resolve({ colliders: new Map(), rivals: [], classes: new Map(), fx: new Map(), sounds: new Map(), music: new Map() }) }));
vi.mock('../../src/arena/assets/memory.js', () => ({ assetTextureBytes: () => 0, releaseKtx2: () => undefined }));
vi.mock('../../src/arena/client.js', () => ({ createArenaClient: () => ({ warm: () => Promise.resolve(), start: vi.fn(), setHud: vi.fn(), setPhase: vi.fn(),
  dispose: vi.fn(), setSpectator: vi.fn(), reset: vi.fn(), friendAt: vi.fn(), metrics: { fps: 60 } }) }));
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');

/**
 * G12-c (2026-11-16): THE ARENA'S OWN SCREENS ON THE GAME KIT. "What happened, and what now?"
 * The result card says how the flight ended in the colour of the ending, its numbers on kit
 * figures, the next flight as the lit press; the settings over the flight are kit switches,
 * kit choices and a kit slider; nothing claims a scattered hold that was empty.
 */

const OLD = /(^|\s)(ap-(mode|eyebrow|keys|credits)|ar-(card|stats|points|kinds|what)|am-graphics|ss-|as-)|(^|\s)(text|bg|border|font)-v2-/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));
const isArena = (value: unknown): value is { world: ArenaWorld; store: HudStore } => typeof value === 'object' && value !== null && 'world' in value && 'store' in value;
const arena = (): { world: ArenaWorld; store: HudStore } => {
  const value: unknown = Reflect.get(window, '__arena');
  if (!isArena(value)) throw new Error('the arena did not open');
  return value;
};

let language: string;
beforeEach(async () => {
  language = i18n.language; await i18n.changeLanguage('tr');
  vi.stubGlobal('screen', { orientation: {} });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 503 }))));
});
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(language); });

async function practice() {
  const view = render(<Sandbox credential={() => Promise.resolve(null)} onLeave={vi.fn()} />);
  fireEvent.click(await screen.findByRole('radio', { name: /Antrenman/ }));
  fireEvent.click(view.container.querySelector('.ap-launch')!);
  await waitFor(() => { expect(view.container.querySelector('main')?.dataset.screen).toBe('flight'); });
  return view;
}

describe('the settings over a flight on the kit', () => {
  it('are a kit card of switches, choices and a slider, with the way back lit', async () => {
    await practice();
    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    const menu = screen.getByRole('dialog', { name: 'Ayarlar' });
    expect(menu).toHaveClass('gk-arenacard');
    expect(oldPaint(menu)).toEqual([]);
    expect(screen.getByRole('switch', { name: /Yukarı-aşağı ters/ })).toHaveClass('gk-toggle');
    expect(screen.getByRole('switch', { name: /Ses/ })).toHaveClass('gk-toggle');
    expect(screen.getByRole('radiogroup', { name: 'Grafik' })).toHaveClass('gk-choices');
    expect(screen.getByRole('button', { name: 'Uçuşa dön' })).toHaveClass('gk-btn--action');
    expect(menu.querySelector('details.gk-rules')).toHaveTextContent('Emeği geçenler');
  });
});

describe('the result of a practice flight on the kit', () => {
  it('says the ending in its colour, counts on kit figures, and never claims an empty hold scattered', async () => {
    const view = await practice();
    act(() => { const { world, store } = arena(); world.pilot.phase = 'dead'; store.publish(world, 'flight', false, false); });
    const title = await screen.findByRole('heading', { level: 2, name: 'Gemin yok edildi' }, { timeout: 5000 });
    expect(title).toHaveClass('gk-display');
    const card = view.container.querySelector('.gk-arenacard')!;
    expect(card).toHaveAttribute('data-tone', 'hostile');
    expect(oldPaint(card)).toEqual([]);
    expect(card.querySelectorAll('dl.gk-figures .gk-figure')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Şimdi uç/ })).toHaveClass('gk-btn--action');
    expect(card).not.toHaveTextContent(arenaCopy().deadHint);
    expect(card).not.toHaveTextContent(arenaCopy().emptyHint);
    expect(card).toHaveTextContent('Ambar boştu; kargo kaybın yok.');
  }, 10_000);
});

describe('what a real flight brought home, on the kit', () => {
  it('heads its parts with kit labels and draws the haul as kit chips', () => {
    const view = render(<SortieSummary c={arenaCopy()} now={Date.now()} hold={[0, 0, 0]} report={{ outcome: 'extracted',
      deposit: { alloy: 120, crystal: 40, deuterium: 0 }, overflow: { alloy: 0, crystal: 0, deuterium: 0 }, xp: { earned: 30, kept: 30, banked: 30 },
      readyAt: null, readyReason: null }} />);
    const root = view.container.firstElementChild!;
    expect(oldPaint(root)).toEqual([]);
    expect(screen.getByText('Başkente gitti')).toHaveClass('gk-label');
    expect(root.querySelectorAll('.gk-haulchip')).toHaveLength(2);
  });
});
