import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FreeSlot, QueueSlot } from '../../src/game-ui/index.js';

/**
 * A SLOT OF WORK ON A WORLD (stage 4.1, the base screen). An order is a ring around its
 * picture that fills as it builds, its name and the time until it is done beside it. Only
 * the head runs: an order behind it wears an hourglass and "Queued" instead of a clock that
 * is not moving. An empty slot says so, because room left must be seen without counting.
 * A slot is a glance, not a control: a press opens the sheet where an order is cancelled.
 */

const slot = (props: Partial<Parameters<typeof QueueSlot>[0]> = {}) =>
  render(
    <QueueSlot
      art="/art/refinery.webp"
      name="Alaşım Rafinerisi"
      progress={0.25}
      left="2 sa 10 dk"
      state="running"
      label="Alaşım Rafinerisi · 2 sa 10 dk"
      onPress={() => undefined}
      {...props}
    />,
  );

const arcOffset = (container: HTMLElement): number => {
  const arc = container.querySelector('.gk-qslot__arc');
  return Number(arc?.getAttribute('stroke-dashoffset'));
};
const arcLength = (container: HTMLElement): number => {
  const arc = container.querySelector('.gk-qslot__arc');
  return Number(arc?.getAttribute('stroke-dasharray'));
};

describe('the queue slot', () => {
  it('names the order and its time for a screen reader, and prints both on the slot', () => {
    slot();
    const button = screen.getByRole('button', { name: 'Alaşım Rafinerisi · 2 sa 10 dk' });
    expect(button).toHaveTextContent('Alaşım Rafinerisi');
    expect(button).toHaveTextContent('2 sa 10 dk');
    expect(button).toHaveAttribute('data-state', 'running');
  });

  it('fills its ring to how far the order has built, and never past full or below empty', () => {
    const quarter = slot({ progress: 0.25 });
    expect(arcOffset(quarter.container)).toBeCloseTo(arcLength(quarter.container) * 0.75);
    quarter.unmount();
    const over = slot({ progress: 1.4 });
    expect(arcOffset(over.container)).toBeCloseTo(0);
    over.unmount();
    const under = slot({ progress: -0.2 });
    expect(arcOffset(under.container)).toBeCloseTo(arcLength(under.container));
  });

  it('counts a batch, and says nothing for a single order', () => {
    const batch = slot({ count: 12 });
    expect(batch.container).toHaveTextContent('×12');
    batch.unmount();
    const single = slot({ count: 1 });
    expect(single.container).not.toHaveTextContent('×');
  });

  it('marks an order behind the head as waiting, with an hourglass beside its word', () => {
    const { container } = slot({ state: 'waiting', progress: 0, left: 'Sırada' });
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'waiting');
    expect(container.querySelector('.gk-qslot__left svg')).not.toBeNull();
    expect(container.querySelector('.gk-qslot__left')).toHaveTextContent('Sırada');
  });

  it('opens the queue on a press', () => {
    const onPress = vi.fn();
    slot({ onPress });
    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws no picture when the order has none', () => {
    const { container } = slot({ art: null });
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('the free slot', () => {
  it('says the room is free and is not a control', () => {
    const { container } = render(<FreeSlot text="boş" />);
    const free = container.querySelector('[data-free-slot]');
    expect(free).toHaveTextContent('boş');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

/** A kit press answers with its own sound, so the mixer's click must not sound as well (G2-c). */
describe('a press on a queue slot', () => {
  it('answers with its own sound alone', () => {
    slot();
    expect(screen.getByRole('button', { name: 'Alaşım Rafinerisi · 2 sa 10 dk' })).toHaveAttribute('data-own-sound');
  });
});
