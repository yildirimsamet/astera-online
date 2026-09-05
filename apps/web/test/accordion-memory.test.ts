import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAccordion } from '../src/lib/accordion.js';

/**
 * WHICH SECTIONS A COMMANDER LEFT OPEN, REMEMBERED. Owner instruction:
 * *"Ayrıca akordionların state'i storage'da falan saklanmalı."*
 *
 * Folding is what bought back the screen; making the player re-open the same band
 * on every visit is how that saving turns into a tax. A commander who lives in the
 * Cargo band should find the Cargo band open.
 *
 * IT IS PER DEVICE, NOT PER COMMANDER. This is a preference about the phone in
 * their hand — the same category `MenuPanel` already keeps the sound switch and
 * the language in — so `localStorage` is the right store and the server never
 * hears about it.
 *
 * EVERY READ AND WRITE IS GUARDED. A private window, cleared site data or a
 * browser set to block storage throws on ACCESS rather than returning null, and a
 * throw here would take out the whole panel to remember a chevron.
 */

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('useAccordion', () => {
  it('opens what the caller says to open, the first time', () => {
    const { result } = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    expect(result.current.isOpen('OFFENSIVE')).toBe(true);
    expect(result.current.isOpen('CARGO')).toBe(false);
  });

  it('toggles a section', () => {
    const { result } = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    act(() => { result.current.toggle('CARGO'); });
    expect(result.current.isOpen('CARGO')).toBe(true);
    act(() => { result.current.toggle('CARGO'); });
    expect(result.current.isOpen('CARGO')).toBe(false);
  });

  it('remembers the choice for the next visit', () => {
    const first = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    act(() => { first.result.current.toggle('CARGO'); });
    act(() => { first.result.current.toggle('OFFENSIVE'); });
    first.unmount();

    const second = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    expect(second.result.current.isOpen('CARGO')).toBe(true);
    expect(second.result.current.isOpen('OFFENSIVE')).toBe(false);
  });

  /** A remembered set of NOTHING is a real answer and must not fall back to the seed. */
  it('remembers that everything was closed', () => {
    const first = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    act(() => { first.result.current.toggle('OFFENSIVE'); });
    first.unmount();

    const second = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    expect(second.result.current.isOpen('OFFENSIVE')).toBe(false);
  });

  it('keeps two surfaces apart', () => {
    const fleet = renderHook(() => useAccordion('fleet', []));
    act(() => { fleet.result.current.toggle('OFFENSIVE'); });
    const research = renderHook(() => useAccordion('research', []));
    expect(research.result.current.isOpen('OFFENSIVE')).toBe(false);
  });

  it('survives a storage that refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    expect(result.current.isOpen('OFFENSIVE')).toBe(true);
  });

  it('survives a storage that refuses to be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useAccordion('fleet', []));
    expect(() => { act(() => { result.current.toggle('CARGO'); }); }).not.toThrow();
    expect(result.current.isOpen('CARGO')).toBe(true);
  });

  /** Corrupt or foreign JSON is not a crash; it is an absent preference. */
  it('ignores a stored value it cannot read', () => {
    window.localStorage.setItem('astera.accordion.fleet', '{"not":"an array"}');
    const { result } = renderHook(() => useAccordion('fleet', ['OFFENSIVE']));
    expect(result.current.isOpen('OFFENSIVE')).toBe(true);
  });
});
