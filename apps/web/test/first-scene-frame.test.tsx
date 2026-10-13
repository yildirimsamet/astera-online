import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FirstSceneFrame } from '../src/galaxy/SceneWarmup.js';
const frame = vi.hoisted(() => ({ draw: () => undefined }));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: () => undefined) => { frame.draw = callback; },
  useThree: vi.fn(),
}));
beforeEach(() => { vi.useFakeTimers(); });
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
