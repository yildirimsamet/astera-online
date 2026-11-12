import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomNav, Dialog, GameHold, GameTabs, Lever, RewardPod, Slider, Toggle, UnitCard } from '../../src/game-ui/index.js';
import { POD_OPEN_MS } from '../../src/game-ui/RewardPod.js';
import { playSound } from '../../src/lib/sound.js';
import type * as Sound from '../../src/lib/sound.js';

vi.mock('../../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), playSound: vi.fn() }));

/**
 * EACH KIT MOMENT HAS ITS OWN SOUND (owner's picks, 2026-11-12, out/ui-kit/sesler): the pod
 * rattles and unseals, a hold charges, a tab clicks, a lever throws, a refused press says
 * no, a count ticks up, a new rank rings. The Kenney files ship beside the old cues.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};
const cues = (): unknown[] => vi.mocked(playSound).mock.calls.map(([cue]) => cue);

beforeEach(() => { vi.mocked(playSound).mockClear(); });
afterEach(() => { vi.useRealTimers(); });

describe('the picked sounds', () => {
  it.each(['rattle', 'unseal', 'rankup', 'tick', 'charge', 'refuse', 'lever', 'tab'])('ships %s as a file the mixer loads', (cue) => {
    expect(existsSync(`public/assets/audio/premium/${cue}-v1.mp3`)).toBe(true);
  });
});

describe('the kit plays them at its moments', () => {
  it('rattles the pod on a tap and unseals it when the lid blows', () => {
    vi.useFakeTimers();
    render(<RewardPod label="Kapsülü aç" onOpen={() => undefined} />);
    press(screen.getByRole('button', { name: /Kapsülü aç/ }));
    expect(cues()).toContain('rattle');
    act(() => { vi.advanceTimersByTime(POD_OPEN_MS); });
    expect(cues()).toContain('unseal');
  });

  it('charges while a hold is down', () => {
    render(<GameHold label="Attack" detail="39 ships" onCommit={() => undefined} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /Attack/ }), { button: 0 });
    expect(cues()).toContain('charge');
  });

  it('clicks a tab open and says no to a locked one', () => {
    const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'members', label: 'Members' }, { id: 'war', label: 'War', locked: 'Clan level 2' }];
    render(<GameTabs label="Clan" tabs={tabs} value="overview" onChange={() => undefined} />);
    press(screen.getByRole('tab', { name: /Members/ }));
    expect(cues()).toContain('tab');
    press(screen.getByRole('tab', { name: /War/ }));
    expect(cues()).toContain('refuse');
  });

  it('clicks a place in the bottom bar and says no to a locked one', () => {
    render(<BottomNav label="Main" items={[{ id: 'galaxy', label: 'Galaxy' }, { id: 'base', label: 'Base' }, { id: 'clan', label: 'Clan', locked: 'Shipyard 2' }]} value="galaxy" onChange={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    press(within(nav).getByRole('button', { name: /Base/ }));
    expect(cues()).toContain('tab');
    press(within(nav).getByRole('button', { name: /Clan/ }));
    expect(cues()).toContain('refuse');
  });

  it('throws the lever and the switch with the lever sound', () => {
    render(<Lever label="Speed" options={[{ id: 'full', label: 'Full' }, { id: '50', label: '50%' }]} value="full" onChange={() => undefined} />);
    press(screen.getByRole('radio', { name: '50%' }));
    expect(cues()).toContain('lever');
    vi.mocked(playSound).mockClear();
    render(<Toggle label="Escort" checked={false} onChange={() => undefined} />);
    press(screen.getByRole('switch', { name: /Escort/ }));
    expect(cues()).toContain('lever');
  });

  it('ticks as a count goes up, on the ship card and on the slider', () => {
    const { unmount } = render(<UnitCard name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={0.625} home={40} chosen={24} onChange={() => undefined} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /more Dart/i }), { button: 0 });
    fireEvent.pointerUp(screen.getByRole('button', { name: /more Dart/i }));
    expect(cues()).toContain('tick');
    unmount();
    vi.mocked(playSound).mockClear();
    render(<Slider label="Pike" value={4} max={20} onChange={() => undefined} />);
    press(screen.getByRole('button', { name: /max/i }));
    expect(cues()).toContain('tick');
  });

  it('rings a dialog in with its own sound, once', () => {
    const { rerender } = render(<Dialog ribbon="Rank up" sound="rankup"><p>Commander II</p></Dialog>);
    rerender(<Dialog ribbon="Rank up" sound="rankup"><p>Commander II</p></Dialog>);
    expect(cues().filter((cue) => cue === 'rankup')).toHaveLength(1);
  });
});
