import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomBar } from '../../src/v2/kit/RoomBar.js';

const part = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-part="${name}"]`);

/**
 * A WORLD'S ROOM, IN YOUR OWN COLOUR. D1/D2 (owner, round 2): no white or grey bars —
 * home, away, queued and this order are the same colour in three strengths and a
 * pattern, and the legend under the bar names each one with the swatch it wears.
 */
describe('the room bar', () => {
  it('draws each part at its share of the room', () => {
    render(<RoomBar label="Hangar room" total={60} home={30} away={6} queued={3} incoming={6} />);
    expect(part('home')!.style.width).toBe('50%');
    expect(part('away')!.style.width).toBe('10%');
    expect(part('queued')!.style.width).toBe('5%');
    expect(part('incoming')!.style.width).toBe('10%');
  });

  it('reads the room taken, the order on top, and the whole', () => {
    render(<RoomBar label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    expect(document.querySelector('[data-room-figure]')).toHaveTextContent('38 +4 / 60');
    expect(screen.getByRole('img', { name: /hangar room.*42.*60/i })).toBeInTheDocument();
  });

  it('names every part it draws in the legend, and what is still free', () => {
    render(<RoomBar label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    const legend = document.querySelector('[data-room-legend]')!;
    expect(legend).toHaveTextContent(/home 30/);
    expect(legend).toHaveTextContent(/away 6/);
    expect(legend).toHaveTextContent(/queued 2/);
    expect(legend).toHaveTextContent(/this order 4/);
    expect(legend).toHaveTextContent(/free 18/);
  });

  it('leaves out a part that is empty', () => {
    render(<RoomBar label="Ground room" total={20} home={4} away={0} queued={0} />);
    expect(part('away')).toBeNull();
    expect(part('queued')).toBeNull();
    expect(part('incoming')).toBeNull();
    expect(document.querySelector('[data-room-legend]')).not.toHaveTextContent(/away|queued|this order/);
  });

  it('wears your colour, never grey or white', () => {
    render(<RoomBar label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    expect(part('home')).toHaveClass('bg-v2-self');
    for (const name of ['home', 'away', 'queued', 'incoming']) {
      expect(part(name)!.className).not.toMatch(/bone|ink|line|white|grey|gray/);
    }
  });

  /** An order that would not fit is refused elsewhere; the bar never draws past its end. */
  it('never draws past its own end', () => {
    render(<RoomBar label="Hangar room" total={10} home={8} away={0} queued={0} incoming={6} />);
    const widths = ['home', 'incoming'].map((name) => Number.parseFloat(part(name)!.style.width));
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(100);
    expect(document.querySelector('[data-room-legend]')).toHaveTextContent(/free 0/);
  });

  it('survives a world with no room at all', () => {
    render(<RoomBar label="Hangar room" total={0} home={0} away={0} queued={0} />);
    expect(part('home')).toBeNull();
    expect(document.querySelector('[data-room-figure]')).toHaveTextContent('0 / 0');
  });
});
