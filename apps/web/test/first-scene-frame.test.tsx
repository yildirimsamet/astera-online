import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FirstSceneFrame } from '../src/galaxy/SceneWarmup.js';
const frame = vi.hoisted(() => ({ draw: () => undefined, lost: false }));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => undefined) => { frame.draw = callback; },
  useThree: (select: (state: unknown) => unknown) => select({ gl: { getContext: () => ({ isContextLost: () => frame.lost }) } }),
}));
beforeEach(() => { vi.useFakeTimers(); frame.lost = false; });
afterEach(() => { vi.useRealTimers(); });
it('keeps the opening covered until preparation has returned home and drawn, then signals once', () => {
  const onDrawn = vi.fn();
  const settled = { current: false };
  const view = render(<FirstSceneFrame ready settled={settled} onDrawn={onDrawn} />);
  act(() => { frame.draw(); vi.runOnlyPendingTimers(); });
  expect(onDrawn).not.toHaveBeenCalled();
  settled.current = true;
  act(() => { frame.draw(); });
  expect(onDrawn).not.toHaveBeenCalled();
  act(() => { vi.runOnlyPendingTimers(); frame.draw(); vi.runOnlyPendingTimers(); });
  expect(onDrawn).toHaveBeenCalledOnce();
  view.unmount();
});
it('preserves canvases without preparation and cancels a queued ready callback on unmount', () => {
  const onDrawn = vi.fn();
  const view = render(<FirstSceneFrame ready={false} onDrawn={onDrawn} />);
  act(() => { frame.draw(); vi.runOnlyPendingTimers(); });
  expect(onDrawn).not.toHaveBeenCalled();
  view.rerender(<FirstSceneFrame ready onDrawn={onDrawn} />);
  act(() => { frame.draw(); });
  view.unmount();
  act(() => { vi.runOnlyPendingTimers(); });
  expect(onDrawn).not.toHaveBeenCalled();
});
it('waits for a live context even if preparation settled on context loss', () => {
  const onDrawn = vi.fn();
  const view = render(<FirstSceneFrame ready settled={{ current: true }} onDrawn={onDrawn} />);
  frame.lost = true;
  act(() => { frame.draw(); vi.runOnlyPendingTimers(); });
  expect(onDrawn).not.toHaveBeenCalled();
  frame.lost = false;
  act(() => { frame.draw(); vi.runOnlyPendingTimers(); });
  expect(onDrawn).toHaveBeenCalledOnce();
  view.unmount();
});
it('does not announce a queued first frame if the context is lost before its callback', () => {
  const onDrawn = vi.fn();
  const view = render(<FirstSceneFrame ready onDrawn={onDrawn} />);
  act(() => { frame.draw(); });
  frame.lost = true;
  act(() => { vi.runOnlyPendingTimers(); });
  expect(onDrawn).not.toHaveBeenCalled();
  frame.lost = false;
  act(() => { frame.draw(); vi.runOnlyPendingTimers(); });
  expect(onDrawn).toHaveBeenCalledOnce();
  view.unmount();
});
