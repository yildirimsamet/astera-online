import { act, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { arenaCopy } from '../../src/arena/copy.js';
import { PING_HOLD_MS, PingWheel } from '../../src/arena/PingWheel.js';

// jsdom has no PointerEvent; without one the events carry no pointer id or position.
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number; readonly pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse'; }
}
beforeAll(() => { if (!('PointerEvent' in window)) vi.stubGlobal('PointerEvent', TestPointerEvent); });
afterAll(() => { vi.unstubAllGlobals(); });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

/** Owner 2026-10-22: hold anywhere, a round wheel of four calls opens; slide or tap to call. */
describe('the ping wheel', () => {
  const c = arenaCopy();
  const setup = () => {
    const onPing = vi.fn();
    // The spot is fixed when the wheel opens: each aim is a new object, so a late aim would show.
    let aims = 0;
    const aim = vi.fn((x: number, y: number) => ({ x, y, z: ++aims }));
    const view = render(<PingWheel c={c} aim={aim} onPing={onPing} />);
    const pad = view.container.querySelector('.ap-ping-pad');
    if (!(pad instanceof HTMLElement)) throw new Error('no pad');
    pad.setPointerCapture = () => undefined;
    const at = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number): void => {
      act(() => { fireEvent[type](pad, { pointerId: 4, clientX: x, clientY: y, pointerType: 'touch' }); });
    };
    return { view, onPing, aim, at };
  };

  it('opens the four calls where a finger is held still', () => {
    const { view, at } = setup();
    at('pointerDown', 200, 400);
    expect(view.queryAllByRole('button')).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(PING_HOLD_MS); });
    expect(view.getAllByRole('button').map(b => b.textContent)).toEqual([c.pings.enemy, c.pings.farm, c.pings.go, c.pings.danger]);
  });

  it('calls the slice the finger slides onto when it lifts', () => {
    const { onPing, at, view } = setup();
    at('pointerDown', 200, 400); act(() => { vi.advanceTimersByTime(PING_HOLD_MS); });
    at('pointerMove', 202, 340); at('pointerUp', 202, 340);
    expect(onPing).toHaveBeenCalledWith('enemy', { x: 200, y: 400, z: 1 });
    expect(view.queryAllByRole('button')).toHaveLength(0);
  });

  it('stays open when lifted at its centre, and a tap on a call sends it', () => {
    const { onPing, at, view } = setup();
    at('pointerDown', 200, 400); act(() => { vi.advanceTimersByTime(PING_HOLD_MS); }); at('pointerUp', 200, 400);
    expect(view.getAllByRole('button')).toHaveLength(4);
    act(() => { fireEvent.click(view.getByRole('button', { name: c.pings.go })); });
    expect(onPing).toHaveBeenCalledWith('go', { x: 200, y: 400, z: 1 });
    expect(view.queryAllByRole('button')).toHaveLength(0);
  });

  it('ignores a quick tap and a drag; a tap beside an open wheel closes it', () => {
    const { onPing, at, view } = setup();
    at('pointerDown', 200, 400); act(() => { vi.advanceTimersByTime(100); }); at('pointerUp', 200, 400);
    act(() => { vi.advanceTimersByTime(PING_HOLD_MS); });
    at('pointerDown', 200, 400); at('pointerMove', 240, 400); act(() => { vi.advanceTimersByTime(PING_HOLD_MS); });
    expect(view.queryAllByRole('button')).toHaveLength(0);
    at('pointerUp', 240, 400);
    at('pointerDown', 100, 300); act(() => { vi.advanceTimersByTime(PING_HOLD_MS); }); at('pointerUp', 100, 300);
    at('pointerDown', 300, 600); at('pointerUp', 300, 600);
    expect(view.queryAllByRole('button')).toHaveLength(0);
    expect(onPing).not.toHaveBeenCalled();
  });

  // Owner 2026-10-22: the view turns while the wheel waits; the call still marks the first spot.
  it('marks the spot held when the wheel opened, however long the choice takes', () => {
    const { onPing, aim, at, view } = setup();
    at('pointerDown', 120, 300); act(() => { vi.advanceTimersByTime(PING_HOLD_MS); }); at('pointerUp', 120, 300);
    expect(aim).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { fireEvent.click(view.getByRole('button', { name: c.pings.danger })); });
    expect(aim).toHaveBeenCalledTimes(1);
    expect(onPing).toHaveBeenCalledWith('danger', { x: 120, y: 300, z: 1 });
  });

  it('leaves the controls free while it waits: the wheel layer only takes its own calls', () => {
    const { at, view } = setup();
    at('pointerDown', 200, 400); act(() => { vi.advanceTimersByTime(PING_HOLD_MS); }); at('pointerUp', 200, 400);
    const pad = view.container.querySelector('.ap-ping-pad');
    const wheel = view.container.querySelector('.ap-wheel');
    expect(pad?.contains(wheel ?? null)).toBe(false);
  });
});
