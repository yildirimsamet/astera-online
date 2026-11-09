import { renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useDisposable } from '../src/lib/useDisposable.js';

/**
 * A watcher's flames threw "Flame batch has been disposed" every frame (walk 2026-11-09): React's strict
 * mode ran the effect's cleanup once and the memoised batch stayed disposed. What a hook hands out must be alive.
 */
class Thing { disposed = false; dispose(): void { this.disposed = true; } }
const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

describe('useDisposable', () => {
  it('hands out a live object under strict mode, and disposes it on unmount', () => {
    const made: Thing[] = [];
    const view = renderHook(() => useDisposable(() => { const t = new Thing(); made.push(t); return t; }, []), { wrapper: strict });
    expect(view.result.current).not.toBeNull();
    expect(view.result.current!.disposed).toBe(false);
    view.unmount();
    expect(made.every(t => t.disposed)).toBe(true);
  });

  it('makes a new one when its inputs change and disposes the old', () => {
    const view = renderHook(({ k }) => useDisposable(() => Object.assign(new Thing(), { k }), [k]), { initialProps: { k: 1 } });
    const first = view.result.current!;
    view.rerender({ k: 2 });
    expect(first.disposed).toBe(true);
    expect(view.result.current!.k).toBe(2);
    expect(view.result.current!.disposed).toBe(false);
  });
});
