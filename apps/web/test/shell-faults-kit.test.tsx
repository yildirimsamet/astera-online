import { Capacitor } from '@capacitor/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { BlockedScreen } from '../src/shell/BlockedScreen.js';
import { ErrorBoundary } from '../src/shell/ErrorBoundary.js';
import { MaintenanceScreen } from '../src/shell/MaintenanceScreen.js';
import { UpdateRequired } from '../src/shell/UpdateRequired.js';

vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ observe: vi.fn() }));
vi.mock('../src/lib/clipboard.js', () => ({ copyText: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../src/brand/OpeningScene.js', () => ({ OpeningScene: () => <div /> }));

/**
 * G13-a (2026-11-16): THE SCREENS BEFORE AND AROUND THE GAME ON THE KIT. A crash says what
 * happened over one lit press to reload, the report's two tools as quiet kit presses, the
 * report itself in a well. The maintenance and update screens keep the opening's brand scene;
 * only what they say and the one press they offer speak the kit.
 */

const OLD = /(^|\s)(slab|slab-primary|legend|text-dim|text-faint|text-bone|rounded-cell|font-v2-mono)(\s|$)|(^|\s)(text|bg)-v2-|(^|\s)text-(micro|body|caption|label|title)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => OLD.test(name));

function Boom(): never { throw new Error('the planet sheet blew up'); }

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the crash screen on the kit', () => {
  it('reloads on the one lit kit press and keeps the report’s tools quiet', () => {
    const onReload = vi.fn();
    render(<ErrorBoundary onReload={onReload}><Boom /></ErrorBoundary>);
    const alert = screen.getByRole('alert');
    expect(oldPaint(alert)).toEqual([]);
    const reload = screen.getByRole('button', { name: i18n.t('crash.reload') });
    expect(reload).toHaveClass('gk-btn', 'gk-btn--action');
    expect(screen.getByRole('button', { name: i18n.t('crash.copy') })).toHaveClass('gk-btn', 'gk-btn--ghost');
    const detail = screen.getByRole('button', { name: i18n.t('crash.detailShow') });
    expect(detail).toHaveClass('gk-btn--ghost');
    expect(detail).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the report in a kit well', () => {
    render(<ErrorBoundary onReload={vi.fn()}><Boom /></ErrorBoundary>);
    const detail = screen.getByRole('button', { name: i18n.t('crash.detailShow') });
    fireEvent.pointerDown(detail, { button: 0 });
    fireEvent.click(detail, { detail: 1 });
    expect(screen.getByRole('button', { name: i18n.t('crash.detailHide') })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/planet sheet blew up/).closest('.gk-well')).not.toBeNull();
  });
});

describe('the update screen on the kit', () => {
  it('reloads the web on a lit kit press', () => {
    render(<UpdateRequired />);
    const alert = screen.getByRole('alert');
    expect(oldPaint(alert)).toEqual([]);
    expect(screen.getByRole('button', { name: i18n.t('app.reloadGame') })).toHaveClass('gk-btn', 'gk-btn--action');
  });

  it('sends Android to the store on a link that wears the same press', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    render(<UpdateRequired />);
    expect(screen.getByRole('link', { name: i18n.t('app.updateStore') })).toHaveClass('gk-btn', 'gk-btn--action');
    expect(oldPaint(screen.getByRole('alert'))).toEqual([]);
  });
});

describe('the maintenance screen on the kit', () => {
  it('says the window and its countdown in the kit’s type', () => {
    const api = new Api({ fetch: () => new Promise<Response>(() => undefined), authTransport: null });
    render(<ApiProvider api={api}><MaintenanceScreen endsAt={new Date(Date.now() + 40 * 60_000).toISOString()} /></ApiProvider>);
    const status = screen.getByRole('status');
    expect(oldPaint(status)).toEqual([]);
    expect(screen.getByRole('heading', { name: i18n.t('app.maintenanceTitle') })).toHaveClass('gk-display');
    expect(screen.getByRole('timer')).toHaveClass('gk-num');
  });
});

/** The app refused at the door (an IP block, a closed region): what it is, why, and one press to try again. */
describe('the blocked screen on the kit', () => {
  it('names the block and its reason, and tries again on a kit press', () => {
    const onRetry = vi.fn();
    render(<BlockedScreen message="Access from this network is blocked." onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(oldPaint(alert)).toEqual([]);
    expect(screen.getByRole('heading', { name: i18n.t('app.blockedTitle') })).toHaveClass('gk-display');
    expect(screen.getByText('Access from this network is blocked.')).toHaveClass('gk-sub');
    const retry = screen.getByRole('button', { name: i18n.t('app.blockedRetry') });
    expect(retry).toHaveClass('gk-btn', 'gk-btn--action');
    fireEvent.pointerDown(retry, { button: 0 });
    fireEvent.click(retry, { detail: 1 });
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

