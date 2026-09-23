import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRequest } from '../../src/lib/useRequest.js';

/**
 * A REQUEST FROM OUTSIDE, AS A COUNTER. The shell asks the galaxy to fly home or
 * to open the Worlds sheet by bumping a number; the galaxy answers each new value
 * once. The value it mounts with is not a request (D56): the rig already frames
 * the opening, and answering it would fight that.
 */

describe('a counted request', () => {
  it('ignores the value it mounts with', () => {
    const onRequest = vi.fn();
    renderHook(({ request }) => { useRequest(request, onRequest); }, { initialProps: { request: 3 } });
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('answers each new value once', () => {
    const onRequest = vi.fn();
    const { rerender } = renderHook(({ request }) => { useRequest(request, onRequest); }, { initialProps: { request: 0 } });
    rerender({ request: 1 });
    rerender({ request: 1 });
    rerender({ request: 2 });
    expect(onRequest).toHaveBeenCalledTimes(2);
  });

  it('never answers an absent request', () => {
    const onRequest = vi.fn();
    const { rerender } = renderHook(({ request }: { request: number | undefined }) => { useRequest(request, onRequest); }, {
      initialProps: { request: undefined },
    });
    rerender({ request: undefined });
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('calls the latest handler, not the one it mounted with', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ request, handler }) => { useRequest(request, handler); }, {
      initialProps: { request: 0, handler: first },
    });
    rerender({ request: 1, handler: second });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
