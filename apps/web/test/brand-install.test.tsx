import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallButton, InstallProvider } from '../src/brand/Install.js';
import { INSTALLED_PWA_KEY } from '../src/brand/installedPwa.js';
import { copyText } from '../src/lib/clipboard.js';

vi.mock('../src/lib/clipboard.js', () => ({ copyText: vi.fn() }));

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  twitterIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.60',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  windowsFirefox: (version: number) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${version}.0) Gecko/20100101 Firefox/${version}.0`,
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
};
const MOBILE = 'Add to home screen';
const DESKTOP = 'Save for quick access';

const as = (ua: string) => { vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua); };
// The related-app check resolves through several promise hops before React hears of it.
const flush = () => act(async () => { for (let hop = 0; hop < 10; hop++) await Promise.resolve(); });
const show = () => render(<InstallProvider><InstallButton /></InstallProvider>);

function offer(choice: Promise<{ outcome: 'accepted' | 'dismissed' }> = Promise.resolve({ outcome: 'accepted' }), prompt = vi.fn(() => Promise.resolve())) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.defineProperties(event, { prompt: { value: prompt }, userChoice: { value: choice } });
  act(() => { window.dispatchEvent(event); });
  return { event, prompt };
}

async function openGuide(name = MOBILE) {
  fireEvent.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog');
}

function relatedApps(answer: () => Promise<unknown>) {
  Object.defineProperty(window.navigator, 'getInstalledRelatedApps', { configurable: true, value: answer });
}
const ownApp = [{ platform: 'webapp', id: `${window.location.origin}/`, url: '/manifest.webmanifest' }];

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
  Reflect.deleteProperty(window.navigator, 'getInstalledRelatedApps');
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('the native install offer', () => {
  it('opens the guide first and calls the browser prompt only from its button', async () => {
    as(UA.android);
    show();
    const { event, prompt } = offer();
    expect(event.defaultPrevented).toBe(true);
    await openGuide();
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); await Promise.resolve(); await Promise.resolve(); });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    // An accepted choice is not proof of installation; appinstalled is.
    expect(screen.getByRole('button', { name: MOBILE })).toBeInTheDocument();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBeNull();
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBe('1');
  });

  it('keeps manual steps after a dismissed prompt and uses each offer once', async () => {
    as(UA.android);
    show();
    const { prompt } = offer(Promise.resolve({ outcome: 'dismissed' }));
    await openGuide();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); await Promise.resolve(); await Promise.resolve(); });
    const dialog = screen.getByRole('dialog');
    expect(prompt).toHaveBeenCalledOnce();
    expect(dialog).toHaveTextContent('You can add it later from your browser’s menu.');
    expect(dialog).toHaveTextContent('Open the browser menu and choose Install app or Add to Home screen.');
    expect(within(dialog).queryByRole('button', { name: 'Install app' })).toBeNull();
  });

  it('falls back to manual steps when the prompt cannot open', async () => {
    as(UA.android);
    show();
    offer(Promise.resolve({ outcome: 'dismissed' }), vi.fn(() => Promise.reject(new Error('unsupported'))));
    await openGuide();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole('dialog')).toHaveTextContent('The install dialog could not open.');
    expect(screen.getByRole('dialog')).toHaveTextContent('Open the browser menu');
  });

  it('waits for the browser without blocking the close button', async () => {
    as(UA.android);
    show();
    offer(new Promise(() => undefined));
    await openGuide();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Install app' })); await Promise.resolve(); });
    expect(screen.getByRole('dialog')).toHaveTextContent('Waiting for your choice in the browser…');
    expect(screen.getByRole('button', { name: 'Install app' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adds the native action when the offer arrives after the guide opened', async () => {
    as(UA.android);
    show();
    const dialog = await openGuide();
    expect(within(dialog).queryByRole('button', { name: 'Install app' })).toBeNull();
    offer();
    expect(within(dialog).getByRole('button', { name: 'Install app' })).toBeInTheDocument();
  });

  it('ignores malformed install events', async () => {
    as(UA.android);
    show();
    const event = new Event('beforeinstallprompt', { cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    const dialog = await openGuide();
    expect(within(dialog).queryByRole('button', { name: 'Install app' })).toBeNull();
  });
});

describe('manual guides', () => {
  it('shows the three iPhone steps', async () => {
    as(UA.iphone);
    show();
    const dialog = await openGuide();
    expect(within(dialog).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['1Open the Share menu', '2Choose Add to Home Screen', '3Tap Add']);
    expect(dialog).toHaveTextContent('If Add is unavailable, open the address in Safari.');
  });

  it('recognises an iPad using a desktop user agent', async () => {
    as(UA.macSafari);
    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, get: () => 5 });
    show();
    expect(await openGuide()).toHaveTextContent('Open the Share menu');
  });

  it('sends in-app browsers to the platform browser with the address', async () => {
    as(UA.twitterIphone);
    const first = show();
    const dialog = await openGuide();
    expect(dialog).toHaveTextContent('Choose Open in browser from the app’s menu. You can use Safari');
    expect(dialog).toHaveTextContent('asteraonline.space');
    first.unmount();
    vi.restoreAllMocks();
    as(UA.instagramAndroid);
    show();
    expect(await openGuide()).toHaveTextContent('You can use Chrome');
  });

  it('gives Firefox for Android its own menu path', async () => {
    as(UA.firefoxAndroid);
    show();
    expect(await openGuide()).toHaveTextContent('In the Firefox menu, choose Install');
  });

  it('copies the address and reports the actual result', async () => {
    as(UA.android);
    vi.mocked(copyText).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    show();
    await openGuide();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy address' })); await Promise.resolve(); });
    expect(copyText).toHaveBeenCalledWith('https://asteraonline.space');
    expect(screen.getByRole('button', { name: 'Address copied' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Address copied' })); await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Could not copy' })).toBeInTheDocument();
  });

  it('names the guide once for screen readers', async () => {
    as(UA.android);
    show();
    const dialog = await openGuide();
    expect(within(dialog).getAllByRole('heading', { name: 'Keep Astera within reach' })).toHaveLength(1);
    expect(within(dialog).getAllByText('Astera Online')).toHaveLength(1);
  });
});

describe('desktop wording', () => {
  it('offers quick access, not a home screen, and speaks of clicks', async () => {
    as(UA.windowsChrome);
    show();
    const dialog = await openGuide(DESKTOP);
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
    expect(dialog).toHaveTextContent('Return to your galaxy in one click.');
    expect(dialog).not.toHaveTextContent(/\btap\b/i);
    expect(dialog).toHaveTextContent('If Chrome shows an install icon in the address bar, click it.');
    expect(dialog).toHaveTextContent('Ctrl+D');
  });

  it('keeps the mobile wording on phones', async () => {
    as(UA.android);
    show();
    expect(await openGuide()).toHaveTextContent('Return to your galaxy with a single tap.');
  });

  it('gives Safari on Mac the Dock path and the Command key', async () => {
    as(UA.macSafari);
    show();
    const dialog = await openGuide(DESKTOP);
    expect(dialog).toHaveTextContent('File → Add to Dock');
    expect(dialog).toHaveTextContent('⌘+D');
  });

  it.each([
    [UA.windowsFirefox(143), true],
    [UA.windowsFirefox(142), false],
    [UA.linuxFirefox, false],
  ])('mentions the Firefox web app icon only where it exists (%s)', async (ua, expected) => {
    as(ua);
    show();
    const dialog = await openGuide(DESKTOP);
    expect(dialog.textContent.includes('web app icon')).toBe(expected);
    expect(dialog).toHaveTextContent('Add a bookmark');
  });
});

describe('installed players', () => {
  it('never offers installation inside the installed app', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: query === '(display-mode: standalone)', addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    as(UA.android);
    show();
    await flush();
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBe('1');
  });

  it('hides the action for a remembered installation until the browser offers it again', async () => {
    localStorage.setItem(INSTALLED_PWA_KEY, '1');
    as(UA.android);
    show();
    await flush();
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
    offer();
    expect(screen.getByRole('button', { name: MOBILE })).toBeInTheDocument();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBeNull();
  });

  it('hides the action and closes the guide when another tab confirms installation', async () => {
    as(UA.android);
    show();
    await openGuide();
    localStorage.setItem(INSTALLED_PWA_KEY, '1');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: INSTALLED_PWA_KEY })); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
  });

  it('hides the action when the browser reports this app as installed', async () => {
    relatedApps(() => Promise.resolve(ownApp));
    as(UA.android);
    show();
    await flush();
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBe('1');
  });

  it('does not treat an empty report as an uninstall', async () => {
    localStorage.setItem(INSTALLED_PWA_KEY, '1');
    relatedApps(() => Promise.resolve([]));
    as(UA.android);
    show();
    await flush();
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
  });

  it('shows the guide after a slow check, and a late positive answer still hides it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let answer: (apps: unknown) => void = () => undefined;
    relatedApps(() => new Promise((resolve) => { answer = resolve; }));
    as(UA.android);
    show();
    await act(async () => { await vi.advanceTimersByTimeAsync(1499); });
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole('button', { name: MOBILE })).toBeInTheDocument();
    answer(ownApp);
    await flush();
    expect(screen.queryByRole('button', { name: MOBILE })).toBeNull();
  });

  it('does not let an older positive answer override a newer native offer', async () => {
    let answer: (apps: unknown) => void = () => undefined;
    relatedApps(() => new Promise((resolve) => { answer = resolve; }));
    as(UA.android);
    show();
    offer();
    expect(screen.getByRole('button', { name: MOBILE })).toBeInTheDocument();
    answer(ownApp);
    await flush();
    expect(screen.getByRole('button', { name: MOBILE })).toBeInTheDocument();
    expect(localStorage.getItem(INSTALLED_PWA_KEY)).toBeNull();
  });
});
