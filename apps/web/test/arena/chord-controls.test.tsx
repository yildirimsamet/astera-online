import { act, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FlightControls } from '../../src/arena/Controls.js';
import { createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

/** Owner 2026-10-21: one thumb across TURBO and FIRE holds both, and lifting it lets both go. */
const H = 812;
const box = (cx: number, cy: number, r: number): DOMRect =>
  ({ left: cx - r, top: cy - r, right: cx + r, bottom: cy + r, width: 2 * r, height: 2 * r, x: cx - r, y: cy - r, toJSON: () => ({}) });

// jsdom has no PointerEvent; without one the events carry no pointer id or position.
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

describe('fire + turbo zone', () => {
  it('holds both keys for a thumb between them and releases both on lift', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('ac-fire')) return box(292, H - 78, 42);
      if (this.classList.contains('ac-turbo')) return box(209, H - 59, 29);
      return box(0, 0, 0);
    });
    const controls = createControls(); const store = createHudStore();
    const view = render(<FlightControls controls={controls} store={store} onLand={() => undefined} onCancel={() => undefined} />);
    const zone = view.container.querySelector('.ac-chord');
    if (!zone) throw new Error('no zone');
    zone.setPointerCapture = () => undefined;
    act(() => { fireEvent.pointerDown(zone, { pointerId: 3, clientX: 244, clientY: H - 67, pointerType: 'touch' }); });
    expect(controls.pressed('fire') && controls.pressed('turbo')).toBe(true);
    act(() => { fireEvent.pointerMove(zone, { pointerId: 3, clientX: 292, clientY: H - 78, pointerType: 'touch' }); });
    expect([controls.pressed('fire'), controls.pressed('turbo')]).toEqual([true, false]);
    act(() => { fireEvent.pointerUp(zone, { pointerId: 3, clientX: 292, clientY: H - 78, pointerType: 'touch' }); });
    expect([controls.pressed('fire'), controls.pressed('turbo')]).toEqual([false, false]);
  });
});
