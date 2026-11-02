import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useVisibleTelemetry } from '../src/lib/playerAnalytics/useVisibleTelemetry.js';
const telemetry = vi.hoisted(() => ({ observe: vi.fn<(name: string, properties: Record<string, unknown>) => void>(), analyticsRecording: vi.fn(() => true), ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => telemetry);
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function Surface({ blocker = null }: { blocker?: string | null }) {
  const ref = useVisibleTelemetry('development_item', 'TELESCOPE', blocker);
  return <div ref={ref}>Item details</div>;
}
const bounds = vi.fn(() => new DOMRect(0, 0, 300, 100));
beforeEach(() => {
  vi.clearAllMocks(); telemetry.analyticsRecording.mockReturnValue(true);
  vi.stubEnv('VITE_ASTERA_PLAYER_ANALYTICS', '1');
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(bounds);
});
it('observes a visible disabled requirement once without claiming an attempted command', () => {
  const view = render(<Surface blocker="insufficient_resources" />);
  view.rerender(<Surface blocker="insufficient_resources" />);
  expect(telemetry.observe.mock.calls.map(([name]) => name)).toEqual(['surface_visible', 'blocker_visible']);
  view.rerender(<Surface blocker="requirements" />);
  expect(telemetry.observe).toHaveBeenCalledTimes(3);
  expect(telemetry.observe).toHaveBeenLastCalledWith('blocker_visible', { surface: 'development_item', subject: 'TELESCOPE', code: 'requirements' });
});
it('waits for actual visibility and explicit permission, then captures only the current blocker', () => {
  const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  render(<Surface blocker="requirements" />); expect(telemetry.observe).not.toHaveBeenCalled();
  state.mockReturnValue('visible'); telemetry.analyticsRecording.mockReturnValue(false);
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(telemetry.observe).not.toHaveBeenCalled();
  telemetry.analyticsRecording.mockReturnValue(true);
  act(() => { window.dispatchEvent(new Event(telemetry.ANALYTICS_READY_EVENT)); });
  expect(telemetry.observe).toHaveBeenCalledTimes(2);
});
it('does not install presentation measurement while the build switch is off', () => {
  vi.stubEnv('VITE_ASTERA_PLAYER_ANALYTICS', '0');
  render(<Surface blocker="requirements" />);
  expect(bounds).not.toHaveBeenCalled();
  expect(telemetry.observe).not.toHaveBeenCalled();
});
it('does not treat a zero-area observer target as a visible requirement', () => {
  let report: ((bounds: DOMRect) => void) | undefined;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: (entries: { target: Element; isIntersecting: boolean; intersectionRect: DOMRect }[]) => void) {}
    observe(target: Element) { report = bounds => { this.callback([{ target, isIntersecting: true, intersectionRect: bounds }]); }; }
    disconnect() { report = undefined; }
  });
  render(<Surface blocker="requirements" />);
  act(() => { report?.(new DOMRect(0, 0, 0, 0)); });
  expect(telemetry.observe).not.toHaveBeenCalled();
  act(() => { report?.(new DOMRect(0, 0, 300, 100)); });
  expect(telemetry.observe).toHaveBeenCalledTimes(2);
});
