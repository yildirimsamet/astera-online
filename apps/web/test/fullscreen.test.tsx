import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandMasthead } from '../src/brand/Identity.js';
import { INSTALLED_PWA_KEY } from '../src/brand/installedPwa.js';

let active: Element | null = null;
const set = (target: object, key: string, value: unknown) => Object.defineProperty(target, key, { configurable: true, value });
const show = () => render(<BrandMasthead onShop={vi.fn()} />);
const enterButton = () => screen.getByRole('button', { name: 'Enter fullscreen' });
const exitButton = () => screen.getByRole('button', { name: 'Exit fullscreen' });
const change = (element: Element | null, event = 'fullscreenchange') => {
  act(() => {
    active = element;
    document.dispatchEvent(new Event(event));
  });
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
function native() {
  const request = vi.fn(() => {
    active = document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    active = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  set(document.documentElement, 'requestFullscreen', request);
  set(document, 'exitFullscreen', exit);
  set(document, 'fullscreenEnabled', true);
  return { request, exit };
}

class DisplayQuery extends EventTarget {
  constructor(readonly media: string, public matches = false) { super(); }
}
function display(mode: string) {
  const queries = new Map<string, DisplayQuery>();
  set(window, 'matchMedia', (query: string) => {
    let media = queries.get(query);
    if (!media) { media = new DisplayQuery(query, query === `(display-mode: ${mode})`); queries.set(query, media); }
    return media;
  });
  return queries;
}

beforeEach(() => {
  active = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });
});
afterEach(() => {
  vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear();
  for (const key of ['fullscreenElement', 'fullscreenEnabled', 'exitFullscreen', 'webkitFullscreenElement', 'webkitFullscreenEnabled', 'webkitExitFullscreen']) Reflect.deleteProperty(document, key);
  for (const key of ['requestFullscreen', 'webkitRequestFullscreen']) Reflect.deleteProperty(document.documentElement, key);
  Reflect.deleteProperty(window, 'matchMedia'); Reflect.deleteProperty(navigator, 'standalone');
});

describe('fullscreen beside the store', () => {
  it('places the compact shop and keyboard-accessible fullscreen control in that order', async () => {
    const { request } = native();
    show();
    const shop = screen.getByRole('button', { name: 'Shop' });
    const button = enterButton();
    expect(shop.nextElementSibling).toBe(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(request).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('requests the whole document in the click, including body portals, and toggles native exit', async () => {
    const { request, exit } = native();
    show();
    fireEvent.click(enterButton());
    expect(request).toHaveBeenCalledOnce(); // No await before requesting: keep user activation.
    await flush();
    expect(exitButton()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(exitButton());
    await flush();
    expect(exit).toHaveBeenCalledOnce();
    expect(enterButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('follows Esc, swipe and other externally triggered changes instead of remembering a click', () => {
    native(); show();
    change(document.documentElement);
    expect(exitButton()).toHaveAttribute('aria-pressed', 'true');
    change(null);
    expect(enterButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('suppresses rapid repeated requests and refreshes state on promise completion even without an event', async () => {
    const { request } = native();
    let complete = () => { /* assigned by promise */ };
    request.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
    show();
    fireEvent.click(enterButton()); fireEvent.click(enterButton());
    expect(request).toHaveBeenCalledOnce();
    expect(enterButton()).toBeDisabled();
    await act(async () => { active = document.documentElement; complete(); await Promise.resolve(); });
    expect(exitButton()).toBeEnabled();
  });

  it.each(['reject', 'throw'] as const)('handles a %s without showing false success and allows another user-initiated attempt', async kind => {
    const { request } = native();
    request.mockImplementationOnce(() => { if (kind === 'throw') throw new Error('denied'); return Promise.reject(new Error('denied')); });
    show(); fireEvent.click(enterButton()); await flush();
    expect(enterButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('alert')).toHaveTextContent('Fullscreen could not open');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(enterButton()); await flush();
    expect(exitButton()).toBeEnabled();
  });

  it('keeps the current state when native exit rejects', async () => {
    const { exit } = native(); active = document.documentElement; show();
    exit.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(exitButton()); await flush();
    expect(exitButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Fullscreen could not close');
  });

  it('supports WebKit void-return methods and prefixed events without calling absent standard methods', () => {
    set(document, 'webkitFullscreenEnabled', true);
    Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, get: () => active });
    const request = vi.fn(); const exit = vi.fn();
    set(document.documentElement, 'webkitRequestFullscreen', request);
    set(document, 'webkitExitFullscreen', exit);
    show(); fireEvent.click(enterButton());
    expect(request).toHaveBeenCalledOnce();
    expect(enterButton()).toBeDisabled();
    change(document.documentElement, 'webkitfullscreenchange');
    expect(exitButton()).toBeEnabled();
    fireEvent.click(exitButton()); expect(exit).toHaveBeenCalledOnce();
    change(null, 'webkitfullscreenchange');
    expect(enterButton()).toBeEnabled();
  });

  it('recovers from a legacy request that never reports success or error', () => {
    vi.useFakeTimers();
    set(document, 'webkitFullscreenEnabled', true);
    set(document.documentElement, 'webkitRequestFullscreen', vi.fn());
    set(document, 'webkitExitFullscreen', vi.fn());
    show(); fireEvent.click(enterButton());
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(enterButton()).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Fullscreen could not open');
  });

  it('handles native error events and ignores a stale request completion after an external change', async () => {
    const { request, exit } = native();
    let reject = (_error: Error) => { /* assigned by promise */ };
    request.mockImplementationOnce(() => new Promise<void>((_resolve, no) => { reject = no; }));
    exit.mockImplementationOnce(() => new Promise<void>(() => { /* transition still pending */ }));
    show(); fireEvent.click(enterButton());
    change(document.documentElement);
    fireEvent.click(exitButton());
    await act(async () => { reject(new Error('stale')); await Promise.resolve(); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(exitButton()).toBeDisabled();
    act(() => { document.dispatchEvent(new Event('fullscreenerror')); });
    expect(exitButton()).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Fullscreen could not close');
  });

  it('honours denied document policy even when a prefixed method is present', () => {
    const { request } = native(); set(document, 'fullscreenEnabled', false);
    const legacy = vi.fn(); set(document.documentElement, 'webkitRequestFullscreen', legacy);
    set(document, 'webkitExitFullscreen', vi.fn()); set(document, 'webkitFullscreenEnabled', true);
    show(); fireEvent.click(enterButton());
    expect(request).not.toHaveBeenCalled(); expect(legacy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('cannot put this page in fullscreen');
  });

  it('places fallback help outside the masthead stacking context so game sheets cannot obscure it', () => {
    show(); fireEvent.click(enterButton());
    expect(screen.getByRole('dialog').closest('.brand-masthead')).toBeNull();
  });

  it('shows real iPhone Home Screen steps and does not mistake installation history for current app display', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1');
    localStorage.setItem(INSTALLED_PWA_KEY, '1');
    show(); fireEvent.click(enterButton());
    const guide = screen.getByRole('dialog');
    expect(guide).toHaveTextContent('Open the Share menu');
    expect(guide).toHaveTextContent('Choose Add to Home Screen');
    expect(guide).toHaveTextContent('Open as Web App');
    expect(guide).toHaveTextContent('home screen icon');
    expect(enterButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('recognises actual iOS standalone launch without an install loop', () => {
    set(navigator, 'standalone', true); show();
    expect(screen.getByRole('button', { name: 'App view is already active' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('can still request immersive native fullscreen inside an Android standalone app', async () => {
    display('standalone'); native(); show();
    fireEvent.click(enterButton()); await flush();
    expect(exitButton()).toBeEnabled();
  });

  it('tracks browser-controlled fullscreen without promising a JavaScript exit', () => {
    const queries = display('fullscreen'); native(); show();
    expect(screen.getByRole('button', { name: 'Fullscreen is already active' })).toBeDisabled();
    act(() => { const query = queries.get('(display-mode: fullscreen)')!; query.matches = false; query.dispatchEvent(new Event('change')); });
    expect(enterButton()).toBeEnabled();
  });

  it('cleans up native/display listeners without forcing fullscreen exit on unmount', () => {
    const { exit } = native();
    const remove = vi.spyOn(document, 'removeEventListener');
    const queries = display('browser');
    const view = show(); change(document.documentElement); view.unmount();
    expect(exit).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('webkitfullscreenchange', expect.any(Function));
    act(() => { queries.get('(display-mode: fullscreen)')!.dispatchEvent(new Event('change')); });
  });

  it('keeps non-game mastheads unchanged', () => {
    render(<BrandMasthead />);
    expect(screen.queryByRole('button', { name: 'Enter fullscreen' })).not.toBeInTheDocument();
  });
});
