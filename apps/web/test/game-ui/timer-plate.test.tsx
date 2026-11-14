import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timer, TimerPlate, TimerRow } from '../../src/game-ui/index.js';
import { haptic } from '../../src/lib/haptics.js';
import { playSound } from '../../src/lib/sound.js';
import type * as Sound from '../../src/lib/sound.js';
import type * as Haptics from '../../src/lib/haptics.js';

vi.mock('../../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), playSound: vi.fn() }));
vi.mock('../../src/lib/haptics.js', async (original) => ({ ...await original<typeof Haptics>(), haptic: vi.fn() }));

/**
 * THE TIMER PLATE (G1-c, 2026-11-14): the one timer that matters most, under the top bar.
 * A cut plate in the colour of whose it is — your colour, an enemy's red, a warning's
 * amber — a ring that drains as the time runs out, the time itself large, what it is and
 * one clause under it, and "+N" for the timers behind it. The whole plate is one press.
 *
 * And the ring alone, for a list of timers: the same ring, the same mark, no time beside it;
 * and the row a list of timers is made of: ring, what it is, and the time with the clock
 * time it lands at — or, for an order whose clock is not running yet, an hourglass and why.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

const plate = (props: Partial<Parameters<typeof TimerPlate>[0]> = {}) => render(
  <TimerPlate tone="self" glyph="rocket" remaining={30} total={120} time="4 dk 12 sn" title="Filon → Kestrel" detail="12 gemi" label="En acil sayaç" onPress={() => undefined} {...props} />,
);

const arc = (container: HTMLElement) => container.querySelector('.gk-timer__arc');

beforeEach(() => { vi.mocked(playSound).mockClear(); vi.mocked(haptic).mockClear(); });

describe('the timer plate', () => {
  it('is one press that names the timer, its clause and its time', () => {
    const onPress = vi.fn();
    plate({ onPress });
    const button = screen.getByRole('button', { name: /En acil sayaç/ });
    expect(button).toHaveTextContent('Filon → Kestrel');
    expect(button).toHaveTextContent('12 gemi');
    expect(button).toHaveTextContent('4 dk 12 sn');
    press(button);
    expect(onPress).toHaveBeenCalledOnce();
    expect(vi.mocked(playSound).mock.calls.map(([cue]) => cue)).toEqual(['tap']);
    expect(vi.mocked(haptic)).toHaveBeenCalledWith('tap');
  });

  it.each(['self', 'hostile', 'warn'] as const)('wears the %s colour on the plate and the ring', (tone) => {
    const { container } = plate({ tone });
    expect(screen.getByRole('button')).toHaveAttribute('data-tone', tone);
    expect(container.querySelector('.gk-timer')).toHaveAttribute('data-tone', tone);
  });

  it('drains the ring to the share of the whole still left', () => {
    const { container } = plate({ remaining: 30, total: 120 });
    const ring = arc(container);
    const length = Number(ring?.getAttribute('stroke-dasharray'));
    expect(Number(ring?.getAttribute('stroke-dashoffset'))).toBeCloseTo(length * 0.75);
  });

  it('draws only the track when the whole is not known, never a guessed arc', () => {
    const { container } = plate({ total: 0 });
    expect(container.querySelector('.gk-timer__track')).not.toBeNull();
    expect(arc(container)).toBeNull();
  });

  it('carries the mark of what it is', () => {
    const { container } = plate({ glyph: 'siren' });
    expect(container.querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'siren');
  });

  it('says how many timers wait behind it, and nothing when none do', () => {
    const { rerender } = plate({ more: 3 });
    expect(screen.getByText('+3')).toBeInTheDocument();
    rerender(<TimerPlate tone="self" glyph="rocket" remaining={30} total={120} time="4 dk" title="Filon" label="En acil sayaç" onPress={() => undefined} more={0} />);
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });

  it('announces an enemy once by its title, never the ticking time', () => {
    plate({ tone: 'hostile', live: true });
    expect(screen.getByText('Filon → Kestrel')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('4 dk 12 sn')).not.toHaveAttribute('aria-live');
  });

  it('beats its ring while the time runs: something is under way (owner, 2026-09-24)', () => {
    const { container } = plate();
    expect(container.querySelector('.gk-timer')).toHaveAttribute('data-beat');
  });
});

describe('the ring alone', () => {
  it('draws the ring and its mark with no time beside it', () => {
    const { container } = render(<Timer remaining={10} total={40} glyph="up" tone="self" />);
    expect(container.querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'up');
    expect(container.querySelector('.gk-timer__time')).toBeNull();
  });

  it('keeps the old look when no colour is asked for', () => {
    const { container } = render(<Timer remaining={10} total={40} text="0:10" />);
    expect(container.querySelector('.gk-timer')).not.toHaveAttribute('data-tone');
    expect(screen.getByText('0:10')).toBeInTheDocument();
  });
});

describe('the timer row', () => {
  it('reads the ring, the timer, its clause, its time and the clock time it lands at', () => {
    const { container } = render(<TimerRow tone="self" glyph="up" remaining={10} total={40} title="Alaşım Rafinerisi 4" detail="İş bitiyor" time="2 dk 00 sn" at="14:32'te" />);
    expect(container).toHaveTextContent('Alaşım Rafinerisi 4');
    expect(container).toHaveTextContent('İş bitiyor');
    expect(container).toHaveTextContent('2 dk 00 sn');
    expect(container).toHaveTextContent("14:32'te");
    expect(container.querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'up');
    // Information, not a control, when there is nowhere to go.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('becomes one press when it can take you to the timer', () => {
    const onPress = vi.fn();
    render(<TimerRow tone="hostile" glyph="siren" remaining={10} total={40} title="Saldırı → Kestrel" time="4 dk" onPress={onPress} />);
    press(screen.getByRole('button', { name: /Saldırı → Kestrel/ }));
    expect(onPress).toHaveBeenCalledOnce();
    expect(screen.getByRole('button')).toHaveAttribute('data-tone', 'hostile');
  });

  it('holds an order behind the head with an hourglass and the word, never a still clock', () => {
    const { container } = render(<TimerRow tone="self" glyph="up" remaining={0} total={0} title="Depo 3" detail="Öndeki bitince başlar" waiting="Sırada" />);
    expect(container.querySelector('[data-waiting]')).toHaveTextContent('Sırada');
    expect(container.querySelector('.gk-timer__arc')).toBeNull();
    expect(container.querySelector('.gk-trow__time')).toBeNull();
  });
});
