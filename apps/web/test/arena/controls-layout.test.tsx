import { act, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FlightControls } from '../../src/arena/Controls.js';
import { createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * S22 profile 2026-10-23: the stick's paint loop read the pad's box every frame, after the HUD
 * had written styles, so every frame paid a forced layout (~6 % of the main thread). Boxes are
 * measured on mount, resize and touch-down only; a frame and a finger moving read none.
 */
const H = 780;
const box = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) });

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number; readonly pointerType: string; readonly width: number; readonly height: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse'; this.width = init.width ?? 1; this.height = init.height ?? 1;
  }
}
beforeAll(() => { if (!('PointerEvent' in window)) vi.stubGlobal('PointerEvent', TestPointerEvent); });
afterAll(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.restoreAllMocks(); });

const mount = () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  const reads = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('ac-stick-pad')) return box(0, 437, 202, H - 437);
    if (this.classList.contains('ac-fire')) return box(250, H - 120, 84, 84);
    if (this.classList.contains('ac-turbo')) return box(180, H - 88, 58, 58);
    if (this.classList.contains('ac-chord')) return box(198, H - 158, 154, 90);
    return box(0, 0, 0, 0);
  });
  const controls = createControls();
  const view = render(<FlightControls controls={controls} store={createHudStore()} onLand={() => undefined} onCancel={() => undefined} />);
  const q = (selector: string): HTMLElement => {
    const element = view.container.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`no ${selector}`);
    return element;
  };
  const pad = q('.ac-stick-pad'); const zone = q('.ac-chord');
  pad.setPointerCapture = () => undefined; zone.setPointerCapture = () => undefined;
  const runFrames = (n: number): void => { for (let i = 0; i < n; i++) frames.splice(0).forEach(callback => { callback(performance.now()); }); };
  return { controls, pad, zone, ring: q('.ac-stick'), reads, runFrames };
};

describe('flight controls read no layout per frame', () => {
  it('paints the held stick for many frames without measuring anything', () => {
    const { pad, reads, runFrames } = mount();
    act(() => { fireEvent.pointerDown(pad, { pointerId: 2, clientX: 110, clientY: 640, pointerType: 'touch' }); });
    reads.mockClear();
    act(() => { fireEvent.pointerMove(pad, { pointerId: 2, clientX: 60, clientY: 640, pointerType: 'touch' }); runFrames(30); });
    expect(reads).not.toHaveBeenCalled();
  });

  it('places the ring under the touch, in the pad’s own coordinates', () => {
    const { controls, pad, ring, runFrames } = mount();
    act(() => { fireEvent.pointerDown(pad, { pointerId: 2, clientX: 120, clientY: 640, pointerType: 'touch' }); runFrames(1); });
    expect(ring.hasAttribute('data-active')).toBe(true);
    expect(ring.style.left).toBe(`${String(controls.stickCenter.x)}px`);
    expect(ring.style.top).toBe(`${String(controls.stickCenter.y - 437)}px`);
    act(() => { fireEvent.pointerUp(pad, { pointerId: 2, clientX: 120, clientY: 640, pointerType: 'touch' }); runFrames(1); });
    expect(ring.hasAttribute('data-active')).toBe(false);
    expect(ring.style.left).toBe('');
  });

  it('a thumb sliding over FIRE and TURBO measures no key', () => {
    const { controls, zone, reads } = mount();
    act(() => { fireEvent.pointerDown(zone, { pointerId: 4, clientX: 292, clientY: H - 78, pointerType: 'touch' }); });
    expect(controls.pressed('fire')).toBe(true);
    reads.mockClear();
    act(() => {
      for (let x = 292; x > 200; x -= 8) fireEvent.pointerMove(zone, { pointerId: 4, clientX: x, clientY: H - 70, pointerType: 'touch' });
    });
    expect(reads).not.toHaveBeenCalled();
    expect(controls.pressed('turbo')).toBe(true);
    act(() => { fireEvent.pointerUp(zone, { pointerId: 4, clientX: 209, clientY: H - 59, pointerType: 'touch' }); });
    expect([controls.pressed('fire'), controls.pressed('turbo')]).toEqual([false, false]);
  });
});
