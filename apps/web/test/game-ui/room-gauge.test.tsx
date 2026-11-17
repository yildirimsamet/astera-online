import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomGauge } from '../../src/game-ui/index.js';

const part = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`.gk-room__bar [data-part="${name}"]`);

/**
 * A WORLD'S ROOM, IN THE KIT (stage 4.2, the yard). D1/D2 (owner, round 2): no white or
 * grey bars — home, away, queued and this order are your colour in three strengths and a
 * pattern, and the legend under the bar names each one with the swatch it wears, so no
 * part is told by its colour alone.
 */
describe('the room gauge', () => {
  it('draws each part at its share of the room', () => {
    render(<RoomGauge label="Hangar room" total={60} home={30} away={6} queued={3} incoming={6} />);
    expect(part('home')!.style.width).toBe('50%');
    expect(part('away')!.style.width).toBe('10%');
    expect(part('queued')!.style.width).toBe('5%');
    expect(part('incoming')!.style.width).toBe('10%');
  });

  it('reads the room taken, the order on top, and the whole', () => {
    render(<RoomGauge label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    expect(document.querySelector('[data-room-figure]')).toHaveTextContent('38 +4 / 60');
    expect(screen.getByRole('img', { name: /hangar room.*42.*60/i })).toBeInTheDocument();
  });

  it('names every part it draws in the legend, and what is still free', () => {
    render(<RoomGauge label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    const legend = document.querySelector('[data-room-legend]')!;
    expect(legend).toHaveTextContent(/home 30/);
    expect(legend).toHaveTextContent(/away 6/);
    expect(legend).toHaveTextContent(/queued 2/);
    expect(legend).toHaveTextContent(/this order 4/);
    expect(legend).toHaveTextContent(/free 18/);
  });

  it('gives each legend word the swatch of the part it names, so colour is never alone', () => {
    render(<RoomGauge label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    const swatches = [...document.querySelectorAll('[data-room-legend] .gk-room__swatch')].map((swatch) => swatch.getAttribute('data-part'));
    expect(swatches).toEqual(['home', 'away', 'queued', 'incoming']);
  });

  it('leaves out a part that is empty', () => {
    render(<RoomGauge label="Ground room" total={20} home={4} away={0} queued={0} />);
    expect(part('away')).toBeNull();
    expect(part('queued')).toBeNull();
    expect(part('incoming')).toBeNull();
    expect(document.querySelector('[data-room-legend]')).not.toHaveTextContent(/away|queued|this order/);
  });

  /** Owner 2026-11-17: an empty room says "0 / 30" once — no "free 30" legend under it. */
  it('draws no legend for an empty room, the figure already says it', () => {
    render(<RoomGauge label="Ground room" total={30} home={0} away={0} queued={0} />);
    expect(document.querySelector('[data-room-legend]')).toBeNull();
    expect(document.querySelector('[data-room-figure]')).toHaveTextContent('0 / 30');
  });

  it('is drawn in the kit: a glass well, no old v2 face and nothing under the type floor', () => {
    const { container } = render(<RoomGauge label="Hangar room" total={60} home={30} away={6} queued={2} incoming={4} />);
    expect(container.querySelector('[data-room-bar]')).toHaveClass('gk-well');
    expect(container.innerHTML).not.toMatch(/v2-|text-micro|text-caption/);
  });

  /** An order that would not fit is refused elsewhere; the gauge never draws past its end. */
  it('never draws past its own end', () => {
    render(<RoomGauge label="Hangar room" total={10} home={8} away={0} queued={0} incoming={6} />);
    const widths = ['home', 'incoming'].map((name) => Number.parseFloat(part(name)!.style.width));
    expect(widths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(100);
    expect(document.querySelector('[data-room-legend]')).toHaveTextContent(/free 0/);
  });

  it('carries what the section adds inside its card', () => {
    render(<RoomGauge label="Ground room" total={20} home={4} away={0} queued={0}><span data-extra="">Thorn 2</span></RoomGauge>);
    expect(document.querySelector('[data-room-bar] [data-extra]')).toHaveTextContent('Thorn 2');
  });

  it('survives a world with no room at all', () => {
    render(<RoomGauge label="Hangar room" total={0} home={0} away={0} queued={0} />);
    expect(part('home')).toBeNull();
    expect(document.querySelector('[data-room-figure]')).toHaveTextContent('0 / 0');
  });
});
