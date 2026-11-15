import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoorRow } from '../../src/game-ui/index.js';
import { haptic } from '../../src/lib/haptics.js';
import { playSound } from '../../src/lib/sound.js';
import type * as Haptics from '../../src/lib/haptics.js';
import type * as Sound from '../../src/lib/sound.js';

vi.mock('../../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), playSound: vi.fn() }));
vi.mock('../../src/lib/haptics.js', async (original) => ({ ...await original<typeof Haptics>(), haptic: vi.fn() }));

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

beforeEach(() => { vi.mocked(playSound).mockClear(); vi.mocked(haptic).mockClear(); });

/**
 * A WAY IN (C23, 2026-11-15): a page of the account — vacation, the recovery email, the
 * country — is one row that says what it is, where it stands, and that it opens somewhere.
 */
describe('the door row', () => {
  it('opens on a press that began on it, with one click and one tick', () => {
    const onPress = vi.fn();
    render(<DoorRow glyph="lock" title="Vacation mode" sub="Pause your worlds while you are away." onPress={onPress} />);
    const door = screen.getByRole('button', { name: /Vacation mode/ });
    fireEvent.click(door, { detail: 1 });
    expect(onPress).not.toHaveBeenCalled();
    press(door);
    expect(onPress).toHaveBeenCalledOnce();
    expect(vi.mocked(playSound).mock.calls).toEqual([['tap']]);
    expect(vi.mocked(haptic).mock.calls).toEqual([['tap']]);
  });

  it('still opens from the keyboard', () => {
    const onPress = vi.fn();
    render(<DoorRow glyph="shield" title="Recovery email" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: /Recovery email/ }), { detail: 0 });
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('says where it stands and wears the tone of that standing', () => {
    render(<DoorRow glyph="shield" title="No recovery email" sub="Add email" tone="warn" onPress={vi.fn()} />);
    const door = screen.getByRole('button', { name: /No recovery email/ });
    expect(door).toHaveAttribute('data-tone', 'warn');
    expect(door).toHaveTextContent('Add email');
    expect(door.querySelector('.gk-door__mark svg')).not.toBeNull();
  });

  it('can lead with a picture of its own (a flag) and name itself in full for a reader', () => {
    render(<DoorRow lead={<img alt="" src="/flag.svg" />} title="Country" value="Türkiye" spoken="Country: Türkiye. Change" onPress={vi.fn()} />);
    const door = screen.getByRole('button', { name: 'Country: Türkiye. Change' });
    expect(door.querySelector('.gk-door__mark img')).not.toBeNull();
    expect(door).toHaveTextContent('Türkiye');
  });
});
