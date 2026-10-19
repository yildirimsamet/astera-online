import { StrictMode, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAndroidBack, useNativeBack } from '../src/platform/nativeBack.js';

const mocks = vi.hoisted(() => ({
  addListener: vi.fn<(event: 'backButton', listener: (data: { canGoBack: boolean }) => void) => Promise<PluginListenerHandle>>(),
  minimizeApp: vi.fn<() => Promise<void>>(),
  toggleBackButtonHandler: vi.fn<(options: { enabled: boolean }) => Promise<void>>(),
}));
vi.mock('@capacitor/app', () => ({ App: mocks }));
const remove = vi.fn<() => Promise<void>>();
let stop: (() => void) | undefined;
beforeEach(() => {
  mocks.addListener.mockReset().mockResolvedValue({ remove });
  mocks.minimizeApp.mockReset().mockResolvedValue(undefined);
  mocks.toggleBackButtonHandler.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(undefined);
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
});
afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); });
const back = () => {
  const callback = mocks.addListener.mock.calls[0]?.[1];
  if (!callback) throw new Error('No Android back listener');
  act(() => { callback({ canGoBack: true }); });
};
function Dialog({ title, onBack, children, visible = true }: {
  title: string; onBack: () => void; children?: ReactNode; visible?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useNativeBack(panel, onBack, visible);
  return visible ? <div ref={panel} role="dialog" aria-label={title}>{children}</div> : null;
}

describe('Android back reaches one surface', () => {
  it('minimizes at the root without using WebView history or logout', () => {
    stop = startAndroidBack();
    back();
    expect(mocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
    expect(mocks.minimizeApp).toHaveBeenCalledOnce();
  });
  it('dispatches only to the last modal and never through its parent', () => {
    const parent = vi.fn(); const child = vi.fn();
    render(<Dialog title="Parent" onBack={parent}><Dialog title="Child" onBack={child} /></Dialog>);
    stop = startAndroidBack(); back();
    expect(child).toHaveBeenCalledOnce(); expect(parent).not.toHaveBeenCalled();
    expect(mocks.minimizeApp).not.toHaveBeenCalled();
  });
  it('preserves an undismissable dialog by minimizing without changing its state', () => {
    render(<div role="dialog">Required form</div>);
    stop = startAndroidBack(); back();
    expect(mocks.minimizeApp).toHaveBeenCalledOnce();
  });
  it('binds a modal that appears later and reads its latest callback', () => {
    const previous = vi.fn(); const current = vi.fn();
    const view = render(<Dialog title="Later" onBack={previous} visible={false} />);
    view.rerender(<Dialog title="Later" onBack={previous} />);
    view.rerender(<Dialog title="Later" onBack={current} />);
    stop = startAndroidBack(); back();
    expect(previous).not.toHaveBeenCalled(); expect(current).toHaveBeenCalledOnce();
  });
  it('detaches a DOM listener when its component unmounts', () => {
    const onBack = vi.fn();
    const view = render(<Dialog title="Temporary" onBack={onBack} />);
    const node = view.getByRole('dialog'); view.unmount();
    fireEvent(node, new Event('astera:native-back', { cancelable: true }));
    expect(onBack).not.toHaveBeenCalled();
  });
  it.each(['web', 'ios', 'future-native'])('does not register Android navigation on %s', platform => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
    if (platform === 'web') vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    stop = startAndroidBack();
    expect(mocks.addListener).not.toHaveBeenCalled(); expect(mocks.minimizeApp).not.toHaveBeenCalled();
  });
  it('does not call an unavailable plugin', () => {
    vi.mocked(Capacitor.isPluginAvailable).mockReturnValue(false);
    stop = startAndroidBack(); expect(mocks.addListener).not.toHaveBeenCalled();
  });
  it('ignores callbacks after cleanup and removes a late registration handle', async () => {
    let resolve: ((handle: PluginListenerHandle) => void) | undefined;
    mocks.addListener.mockImplementation(() => new Promise(done => { resolve = done; }));
    const cleanup = startAndroidBack(); cleanup(); back();
    expect(mocks.minimizeApp).not.toHaveBeenCalled();
    resolve?.({ remove }); await waitFor(() => { expect(remove).toHaveBeenCalledOnce(); });
  });
});


it('binds only one DOM handler after a StrictMode remount', () => {
  const onBack = vi.fn();
  render(<StrictMode><Dialog title="Strict" onBack={onBack} /></StrictMode>);
  stop = startAndroidBack(); back();
  expect(onBack).toHaveBeenCalledOnce();
});


it('enables the native handler only after registering the JS listener and releases it on cleanup', async () => {
  stop = startAndroidBack();
  await waitFor(() => { expect(mocks.toggleBackButtonHandler).toHaveBeenCalledWith({ enabled: true }); });
  stop(); stop = undefined;
  await waitFor(() => { expect(remove).toHaveBeenCalledOnce(); });
  expect(mocks.toggleBackButtonHandler).toHaveBeenLastCalledWith({ enabled: false });
});

it('keeps OS Back when native listener registration rejects', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  mocks.addListener.mockRejectedValueOnce(new Error('Bridge unavailable'));
  stop = startAndroidBack();
  await waitFor(() => { expect(warning).toHaveBeenCalled(); });
  expect(mocks.toggleBackButtonHandler).not.toHaveBeenCalled();
});

it('dismisses a temporary popover and context before minimizing the app', () => {
  const popover = vi.fn(); const context = vi.fn();
  function Surface({ kind, onBack }: { kind: string; onBack: () => void }) {
    const panel = useRef<HTMLElement>(null);
    useNativeBack(panel, onBack);
    return <section ref={panel} data-native-back-layer={kind} />;
  }
  const view = render(<><Surface kind="context" onBack={context} /><Surface kind="popover" onBack={popover} /></>);
  stop = startAndroidBack(); back();
  expect(popover).toHaveBeenCalledOnce(); expect(context).not.toHaveBeenCalled();
  expect(mocks.minimizeApp).not.toHaveBeenCalled();
  view.rerender(<Surface kind="context" onBack={context} />); back();
  expect(context).toHaveBeenCalledOnce(); expect(mocks.minimizeApp).not.toHaveBeenCalled();
  view.unmount(); back(); expect(mocks.minimizeApp).toHaveBeenCalledOnce();
});
