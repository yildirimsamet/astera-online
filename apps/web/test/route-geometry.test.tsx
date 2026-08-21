import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLine } from '../src/galaxy/Fleets.js';

/**
 * ONE BUFFER PER CRAFT, NOT ONE PER REFETCH.
 *
 * Every route on the disc used to be a `BufferGeometry` built inside a `useMemo`
 * keyed on the leg's endpoints — derived from a payload that came back as a brand
 * new object on every read (see `api/structural.ts`). So a fresh buffer was
 * allocated for every craft in the galaxy several times a minute.
 *
 * AND THE OLD ONE WAS NEVER FREED. Replacing the `geometry` prop of a mounted
 * object hands three.js a new buffer and drops the previous one on the floor;
 * nothing unmounted, so nothing disposed it. That is a GPU allocation per craft per
 * refetch for as long as the tab is open, and it shows up as a scene that gets
 * choppier the longer somebody plays — which is the hardest kind of bug to connect
 * to its cause.
 *
 * Both ends are written every frame anyway, so the buffer never needed rebuilding.
 */
describe('a route line', () => {
  it('is the same buffer across re-renders', () => {
    const { result, rerender } = renderHook(() => useLine());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it('has room for exactly the two points it draws', () => {
    const { result } = renderHook(() => useLine());
    const position = result.current.getAttribute('position');
    expect(position.count).toBe(2);
    expect(position.itemSize).toBe(3);
  });

  it('is disposed when its craft leaves the disc', () => {
    const { result, unmount } = renderHook(() => useLine());
    const dispose = vi.spyOn(result.current, 'dispose');
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  /** A contact only publishes a route when it is a mining or salvage run (D24). */
  it('allocates nothing for a craft that has no line to draw', () => {
    const { result } = renderHook(() => useLine(false));
    expect(result.current).toBeNull();
  });

  it('does not throw on unmount when there was no line', () => {
    const { unmount } = renderHook(() => useLine(false));
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
