import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESK_QUERY, useMedia } from '../../src/lib/media.js';

/**
 * E11: the desk layout is chosen by the width of the window, and follows it when the
 * window is resized; with no `matchMedia` at all (jsdom, an old engine) it is the phone.
 */

type Listener = () => void;

function stubMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  const list = {
    get matches() { return matches; },
    addEventListener: (_type: string, listener: Listener) => { listeners.add(listener); },
    removeEventListener: (_type: string, listener: Listener) => { listeners.delete(listener); },
  };
  const matchMedia = vi.fn((_query: string) => list);
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    listeners,
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('useMedia', () => {
  it('asks for the desk at 1100 px, the spec’s three-column width', () => {
    expect(DESK_QUERY).toBe('(min-width: 1100px)');
  });

  it('reads the window as it is on the first render', () => {
    const media = stubMedia(true);
    const { result } = renderHook(() => useMedia(DESK_QUERY));
    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith(DESK_QUERY);
  });

  it('follows a resize across the line, both ways', () => {
    const media = stubMedia(false);
    const { result } = renderHook(() => useMedia(DESK_QUERY));
    expect(result.current).toBe(false);
    act(() => { media.set(true); });
    expect(result.current).toBe(true);
    act(() => { media.set(false); });
    expect(result.current).toBe(false);
  });

  it('stops listening when it unmounts', () => {
    const media = stubMedia(false);
    const { unmount } = renderHook(() => useMedia(DESK_QUERY));
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('is the phone where there is no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMedia(DESK_QUERY));
    expect(result.current).toBe(false);
  });
});
