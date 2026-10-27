import { act, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FlightControls } from '../../src/arena/Controls.js';
import { chordLink, createControls } from '../../src/arena/input.js';
import { createHudStore, type HudStore } from '../../src/arena/store.js';

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

  const FIRE = { x: 292, y: H - 78, r: 42 }; const TURBO = { x: 209, y: H - 59, r: 29 };
  const mount = (store: HudStore = createHudStore()) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('ac-fire')) return box(FIRE.x, FIRE.y, FIRE.r);
      if (this.classList.contains('ac-turbo')) return box(TURBO.x, TURBO.y, TURBO.r);
      if (this.classList.contains('ac-chord')) return box(100, H - 70, 50);
      return box(0, 0, 0);
    });
    const controls = createControls();
    const view = render(<FlightControls controls={controls} store={store} onLand={() => undefined} onCancel={() => undefined} />);
    const zone = view.container.querySelector('.ac-chord');
    const link = view.container.querySelector<HTMLElement>('.ac-link');
    if (!zone || !link) throw new Error('no zone or link');
    zone.setPointerCapture = () => undefined;
    return { controls, zone, link };
  };

  it('draws the strip that holds both where it is, joined to both keys', () => {
    const { link } = mount();
    const expected = chordLink(FIRE, TURBO);
    // Placed in the zone (its box starts at 50, H - 120), pivoting on TURBO's centre.
    expect(parseFloat(link.style.left)).toBeCloseTo(TURBO.x - 50, 6);
    expect(parseFloat(link.style.top)).toBeCloseTo(TURBO.y - (H - 120) - expected.half, 6);
    expect(parseFloat(link.style.width)).toBeCloseTo(expected.end - expected.start, 6);
    expect(parseFloat(link.style.height)).toBeCloseTo(2 * expected.half, 6);
    expect(link.style.transform).toBe(`rotate(${String(expected.angle)}rad) translateX(${String(expected.start)}px)`);
  });

  it('lights the link while one thumb holds both, and lets it go on lift', () => {
    const { zone, link } = mount();
    expect(link.classList.contains('is-linked')).toBe(false);
    act(() => { fireEvent.pointerDown(zone, { pointerId: 4, clientX: 244, clientY: H - 67, pointerType: 'touch' }); });
    expect(link.classList.contains('is-linked')).toBe(true);
    act(() => { fireEvent.pointerUp(zone, { pointerId: 4, clientX: 244, clientY: H - 67, pointerType: 'touch' }); });
    expect(link.classList.contains('is-linked')).toBe(false);
  });

  it('keeps TURBO working with an empty magazine: an empty gun must not stop the escape', () => {
    const live = createHudStore();
    const empty = { ...live.getSnapshot(), ammo: 0 };
    const { controls, zone, link } = mount({ ...live, getSnapshot: () => empty });
    act(() => { fireEvent.pointerDown(zone, { pointerId: 5, clientX: TURBO.x, clientY: TURBO.y, pointerType: 'touch' }); });
    expect([controls.pressed('fire'), controls.pressed('turbo')]).toEqual([false, true]);
    act(() => { fireEvent.pointerMove(zone, { pointerId: 5, clientX: 244, clientY: H - 67, pointerType: 'touch' }); });
    expect([controls.pressed('fire'), controls.pressed('turbo')]).toEqual([false, true]);
    expect(link.classList.contains('is-off')).toBe(true);
    act(() => { fireEvent.pointerUp(zone, { pointerId: 5, clientX: 244, clientY: H - 67, pointerType: 'touch' }); });
    expect(controls.pressed('turbo')).toBe(false);
  });
});
